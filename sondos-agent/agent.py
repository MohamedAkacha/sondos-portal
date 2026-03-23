"""
╔══════════════════════════════════════════════════════════════╗
║  Sondos AI — LiveKit Voice Agent Worker (v2)                ║
║  ─────────────────────────────────────────────────────────   ║
║  STT (Deepgram) → LLM (OpenAI) → TTS (OpenAI)             ║
║  + Transcript saving to backend                             ║
║  + Dynamic config via room metadata                         ║
╚══════════════════════════════════════════════════════════════╝
"""

import os
import json
import logging
import asyncio
from datetime import datetime, timezone

import aiohttp
from dotenv import load_dotenv
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.pipeline import VoicePipelineAgent
from livekit.plugins import deepgram, openai, silero

# ── Load .env ──
load_dotenv()

# ── Logging ──
logger = logging.getLogger("sondos-agent")
logger.setLevel(logging.INFO)

# ── Backend Config ──
BACKEND_URL = os.getenv("SONDOS_BACKEND_URL", "").rstrip("/")
AGENT_SECRET = os.getenv("SONDOS_AGENT_SECRET", "")


# ══════════════════════════════════════════════════════
# Default Agent Configuration (fallback if no metadata)
# ══════════════════════════════════════════════════════

DEFAULT_SYSTEM_PROMPT = """\
أنت "سندس"، مساعدة ذكية تعمل في مجال الرعاية الصحية في المملكة العربية السعودية.

## شخصيتك:
- اسمك سندس، مساعدة ذكية صوتية
- تتكلمين باللهجة السعودية بشكل طبيعي ومهني
- تكونين ودودة ومحترفة وسريعة في الرد
- تساعدين في حجز المواعيد، الاستفسارات الطبية العامة، وتأكيد المواعيد

## تعليمات مهمة:
- ردودك تكون قصيرة ومباشرة (جملة أو جملتين كحد أقصى)
- لا تستخدمين نقاط أو قوائم في ردودك الصوتية
- إذا ما فهمتي السؤال، اطلبي التوضيح بلطف
- رحبي بالمتصل في أول المكالمة وعرفيه بنفسك

## مثال للترحيب:
"أهلاً وسهلاً، معك سندس المساعدة الذكية. كيف أقدر أساعدك اليوم؟"
"""

DEFAULT_GREETING = "أهلاً وسهلاً، معك سندس المساعدة الذكية. كيف أقدر أساعدك اليوم؟"

DEFAULT_CONFIG = {
    "sttProvider": "deepgram",
    "sttModel": "nova-2",
    "sttLanguage": "ar",
    "llmModel": "gpt-4o-mini",
    "llmTemperature": 0.7,
    "ttsModel": "tts-1",
    "ttsVoice": "nova",
    "systemPrompt": DEFAULT_SYSTEM_PROMPT,
    "greeting": DEFAULT_GREETING,
}


# ══════════════════════════════════════════════════════
# Helper: Parse room metadata for dynamic config
# ══════════════════════════════════════════════════════

def parse_room_config(room) -> dict:
    """Read agent config from room metadata (JSON string)."""
    config = dict(DEFAULT_CONFIG)

    metadata = room.metadata
    if not metadata:
        logger.info("ℹ️ No room metadata — using default config")
        return config

    try:
        meta = json.loads(metadata)
        agent_cfg = meta.get("agentConfig", {})

        if agent_cfg.get("sttProvider"):
            config["sttProvider"] = agent_cfg["sttProvider"]
        if agent_cfg.get("llmModel"):
            config["llmModel"] = agent_cfg["llmModel"]
        if agent_cfg.get("ttsVoice"):
            config["ttsVoice"] = agent_cfg["ttsVoice"]
        if agent_cfg.get("ttsModel"):
            config["ttsModel"] = agent_cfg["ttsModel"]
        if agent_cfg.get("systemPrompt"):
            config["systemPrompt"] = agent_cfg["systemPrompt"]
        if agent_cfg.get("greeting"):
            config["greeting"] = agent_cfg["greeting"]
        if agent_cfg.get("llmTemperature") is not None:
            config["llmTemperature"] = float(agent_cfg["llmTemperature"])

        logger.info(f"✅ Room config loaded: LLM={config['llmModel']}, Voice={config['ttsVoice']}")
    except (json.JSONDecodeError, KeyError) as e:
        logger.warning(f"⚠️ Failed to parse room metadata: {e} — using defaults")

    return config


# ══════════════════════════════════════════════════════
# Helper: Send transcript to backend
# ══════════════════════════════════════════════════════

async def save_transcript_to_backend(room_name: str, transcript: list[dict]):
    """POST transcript to backend API."""
    if not BACKEND_URL or not AGENT_SECRET:
        logger.warning("⚠️ SONDOS_BACKEND_URL or SONDOS_AGENT_SECRET not set — skipping transcript save")
        return

    if not transcript:
        logger.info("ℹ️ No transcript entries to save")
        return

    url = f"{BACKEND_URL}/api/livekit/agent/transcript"
    payload = {
        "roomName": room_name,
        "entries": transcript,
    }
    headers = {
        "Content-Type": "application/json",
        "X-Agent-Secret": AGENT_SECRET,
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    logger.info(f"✅ Transcript saved: {len(transcript)} entries → {room_name}")
                else:
                    text = await resp.text()
                    logger.error(f"❌ Transcript save failed ({resp.status}): {text}")
    except Exception as e:
        logger.error(f"❌ Transcript save error: {e}")


# ══════════════════════════════════════════════════════
# Process Initialization (runs once per worker process)
# ══════════════════════════════════════════════════════

def prewarm(proc: JobProcess):
    """Pre-load the VAD model to avoid cold-start delay."""
    proc.userdata["vad"] = silero.VAD.load()
    logger.info("✅ VAD model pre-loaded")


# ══════════════════════════════════════════════════════
# Agent Entry Point (runs for each new room)
# ══════════════════════════════════════════════════════

async def entrypoint(ctx: JobContext):
    """Called when a participant joins a room — creates and starts the agent."""

    logger.info(f"🔗 Connecting to room: {ctx.room.name}")

    # ── Connect and wait for participant ──
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    participant = await ctx.wait_for_participant()
    logger.info(f"👤 Participant joined: {participant.identity}")

    # ── Read dynamic config from room metadata (Step 8) ──
    config = parse_room_config(ctx.room)

    # ── 1. STT — Deepgram (supports Arabic) ──
    stt = openai.STT(
        language=config.get("sttLanguage", "ar"),
        model="whisper-1",
    )
    # ── 2. LLM — OpenAI ──
    chat_ctx = llm.ChatContext()
    chat_ctx.append(role="system", text=config["systemPrompt"])

    llm_instance = openai.LLM(
        model=config["llmModel"],
        temperature=config["llmTemperature"],
    )

    # ── 3. TTS — OpenAI ──
    tts = openai.TTS(
        model=config.get("ttsModel", "tts-1"),
        voice=config["ttsVoice"],
    )

    # ── 4. VAD — Silero ──
    vad = ctx.proc.userdata["vad"]

    # ── Transcript collector (Step 6) ──
    transcript: list[dict] = []

    def add_transcript(speaker: str, text: str):
        transcript.append({
            "speaker": speaker,
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    # ── Create the Voice Pipeline Agent ──
    agent = VoicePipelineAgent(
        vad=vad,
        stt=stt,
        llm=llm_instance,
        tts=tts,
        chat_ctx=chat_ctx,
        allow_interruptions=True,
        min_endpointing_delay=0.5,
    )

    # ── Listen for transcript events ──
    @agent.on("user_speech_committed")
    def on_user_speech(msg):
        text = msg.content if hasattr(msg, "content") else str(msg)
        if text and text.strip():
            add_transcript("user", text.strip())
            logger.info(f"🎤 User: {text.strip()[:80]}")

    @agent.on("agent_speech_committed")
    def on_agent_speech(msg):
        text = msg.content if hasattr(msg, "content") else str(msg)
        if text and text.strip():
            add_transcript("agent", text.strip())
            logger.info(f"🤖 Agent: {text.strip()[:80]}")

    # ── Start the agent ──
    agent.start(ctx.room, participant)

    # Say greeting
    greeting = config["greeting"]
    add_transcript("agent", greeting)
    await agent.say(greeting, allow_interruptions=True)

    logger.info(f"🎙️ Agent started in room: {ctx.room.name} | LLM: {config['llmModel']} | Voice: {config['ttsVoice']}")

    # ── Wait for disconnect, then save transcript ──
    @ctx.room.on("disconnected")
    def on_disconnect():
        logger.info(f"📴 Room disconnected: {ctx.room.name} | Transcript: {len(transcript)} entries")
        asyncio.create_task(save_transcript_to_backend(ctx.room.name, transcript))

    # Keep the agent alive until room closes
    try:
        await asyncio.Future()  # Block forever — agent handles events
    except asyncio.CancelledError:
        logger.info(f"🛑 Agent task cancelled for room: {ctx.room.name}")
        # Save transcript on cancellation too
        await save_transcript_to_backend(ctx.room.name, transcript)


# ══════════════════════════════════════════════════════
# Worker Entry Point
# ══════════════════════════════════════════════════════

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        ),
    )