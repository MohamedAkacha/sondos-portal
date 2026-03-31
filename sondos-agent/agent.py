"""
╔══════════════════════════════════════════════════════════════╗
║  Sondos AI — LiveKit Voice Agent Worker (v6)                ║
║  ─────────────────────────────────────────────────────────   ║
║  LiveKit Agents 1.5 — AgentSession API                      ║
║  Fully dynamic — zero hardcoded config                      ║
║  All settings come from room metadata (set by backend)      ║
║  STT (Deepgram / Whisper)                                   ║
║  → LLM (OpenAI GPT-5.4 / 4o family)                        ║
║  → TTS (OpenAI / ElevenLabs — with voice cloning)           ║
║  + Transcript saving to backend                             ║
║  + Bidirectional calls (inbound + outbound)                 ║
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
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    cli,
)
from livekit.plugins import deepgram, openai, silero, elevenlabs

# ── Load .env ──
load_dotenv()

# ── Logging ──
logger = logging.getLogger("sondos-agent")
logger.setLevel(logging.INFO)

# ── Backend Config ──
BACKEND_URL = os.getenv("SONDOS_BACKEND_URL", "").rstrip("/")
AGENT_SECRET = os.getenv("SONDOS_AGENT_SECRET", "")

# ── Outbound no-answer timeout ──
OUTBOUND_NO_ANSWER_TIMEOUT = 30  # seconds


# ══════════════════════════════════════════════════════
# Helper: Parse room metadata for dynamic config
# ══════════════════════════════════════════════════════

def parse_room_config(room) -> dict:
    """
    Read agent config from room metadata (JSON string).
    ALL config must come from metadata — no hardcoded defaults.
    Backend is the single source of truth.
    """
    metadata = room.metadata
    if not metadata:
        logger.error("❌ No room metadata found — agent cannot start without config")
        raise ValueError("Room metadata is required.")

    try:
        meta = json.loads(metadata)
    except json.JSONDecodeError as e:
        logger.error(f"❌ Invalid room metadata JSON: {e}")
        raise ValueError(f"Invalid room metadata JSON: {e}")

    agent_cfg = meta.get("agentConfig")
    if not agent_cfg:
        logger.error("❌ No agentConfig in room metadata")
        raise ValueError("agentConfig missing from room metadata")

    # ── Validate required fields ──
    required_fields = ["systemPrompt", "greeting", "llmModel", "ttsVoice"]
    missing = [f for f in required_fields if not agent_cfg.get(f)]
    if missing:
        logger.error(f"❌ Missing required config fields: {missing}")
        raise ValueError(f"Missing required agentConfig fields: {missing}")

    # ── Determine call direction ──
    call_direction = agent_cfg.get("callDirection", "inbound")
    # Also check room-level metadata for direction
    if meta.get("direction") == "outbound" or meta.get("source") == "outbound":
        call_direction = "outbound"
    # Room name prefix check
    if room.name and room.name.startswith(("sondos-out-", "sondos-camp-")):
        call_direction = "outbound"

    config = {
        "sttProvider":    agent_cfg.get("sttProvider", "deepgram"),
        "sttModel":       agent_cfg.get("sttModel", "nova-2"),
        "sttLanguage":    agent_cfg.get("sttLanguage", "ar"),
        "llmModel":       agent_cfg["llmModel"],
        "llmTemperature": float(agent_cfg.get("llmTemperature", 0.7)),
        "ttsProvider":    agent_cfg.get("ttsProvider", "openai"),
        "ttsModel":       agent_cfg.get("ttsModel", "tts-1"),
        "ttsVoice":       agent_cfg["ttsVoice"],
        "systemPrompt":   agent_cfg["systemPrompt"],
        "greeting":       agent_cfg["greeting"],
        # ── Direction-specific ──
        "callDirection":  call_direction,
        "objective":      meta.get("objective", ""),
        "destination":    meta.get("destination", ""),
        "contactName":    meta.get("contactName", ""),
        "campaignId":     meta.get("campaignId", ""),
    }

    direction_label = "📞 OUTBOUND" if call_direction == "outbound" else "📲 INBOUND"
    logger.info(
        f"✅ Room config loaded [{direction_label}]: "
        f"STT={config['sttProvider']}/{config['sttModel']} "
        f"LLM={config['llmModel']} "
        f"TTS={config['ttsProvider']}/{config['ttsModel']}/{config['ttsVoice']}"
    )
    if call_direction == "outbound" and config["objective"]:
        logger.info(f"   🎯 Objective: {config['objective']}")

    return config


# ══════════════════════════════════════════════════════
# Helper: Build outbound system prompt
# ══════════════════════════════════════════════════════

def build_outbound_prompt(config: dict) -> str:
    """
    Enhance the system prompt with outbound-specific instructions.
    The base system prompt defines the agent's personality.
    We add objective and behavior instructions on top.
    """
    base_prompt = config["systemPrompt"]
    objective = config.get("objective", "")
    contact_name = config.get("contactName", "")

    outbound_instructions = """

=== تعليمات المكالمة الصادرة ===
أنت تجري مكالمة صادرة — أنت المتصِل وليس المستقبل.
- ابدأ بتعريف نفسك ومن أين تتصل
- كن مباشراً ومحترماً — العميل لم يطلب هذا الاتصال
- لو العميل مشغول، اسأل عن وقت مناسب لمعاودة الاتصال
- لو العميل رفض بوضوح، اشكره واختم المكالمة بأدب
- لا تكرر نفسك أكثر من مرة
- اجعل المكالمة قصيرة ومركّزة
"""

    if objective:
        outbound_instructions += f"\n🎯 هدف المكالمة: {objective}\nركّز على تحقيق هذا الهدف بشكل مباشر.\n"

    if contact_name:
        outbound_instructions += f"\nاسم العميل: {contact_name} — استخدمه في المحادثة.\n"

    return base_prompt + outbound_instructions


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
                    logger.info(f"✅ Transcript saved: {len(transcript)} entries → {room_name}")
                else:
                    text = await resp.text()
                    logger.error(f"❌ Transcript save failed ({resp.status}): {text}")
    except Exception as e:
        logger.error(f"❌ Transcript save error: {e}")


# ══════════════════════════════════════════════════════
# Helper: Report call result to backend
# ══════════════════════════════════════════════════════

async def report_call_result(room_name: str, result: str):
    """POST call result (succeeded/refused/no_answer) to backend."""
    if not BACKEND_URL or not AGENT_SECRET:
        return

    url = f"{BACKEND_URL}/api/livekit/agent/call-result"
    payload = {
        "roomName": room_name,
        "callResult": result,
    }
    headers = {
        "Content-Type": "application/json",
        "X-Agent-Secret": AGENT_SECRET,
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    logger.info(f"✅ Call result reported: {result} → {room_name}")
                else:
                    text = await resp.text()
                    logger.error(f"❌ Call result report failed ({resp.status}): {text}")
    except Exception as e:
        logger.error(f"❌ Call result report error: {e}")


# ══════════════════════════════════════════════════════
# Builder functions — STT / LLM / TTS from config
# ══════════════════════════════════════════════════════

def build_stt(config: dict):
    """Build STT instance based on config provider."""
    provider = config["sttProvider"]
    language = config["sttLanguage"]
    model = config["sttModel"]

    if provider == "deepgram":
        logger.info(f"🎧 STT: Deepgram {model} (lang={language})")
        return deepgram.STT(model=model, language=language)
    elif provider == "openai":
        logger.info(f"🎧 STT: OpenAI Whisper (lang={language})")
        return openai.STT(model="whisper-1", language=language)
    else:
        logger.warning(f"⚠️ Unknown STT provider '{provider}' — falling back to Deepgram")
        return deepgram.STT(model="nova-2", language=language)


def build_tts(config: dict):
    """Build TTS instance based on config provider."""
    provider = config["ttsProvider"]
    model = config["ttsModel"]
    voice = config["ttsVoice"]

    if provider == "elevenlabs":
        logger.info(f"🔊 TTS: ElevenLabs {voice}")
        return elevenlabs.TTS(voice_id=voice)
    else:
        logger.info(f"🔊 TTS: OpenAI {model}/{voice}")
        return openai.TTS(model=model, voice=voice)


def build_llm(config: dict):
    """Build LLM instance based on config."""
    model = config["llmModel"]
    temperature = config["llmTemperature"]
    logger.info(f"🧠 LLM: {model} (temp={temperature})")
    return openai.LLM(model=model, temperature=temperature)


# ══════════════════════════════════════════════════════
# Agent Entry Point (LiveKit 1.5 — AgentSession API)
# ══════════════════════════════════════════════════════

server = AgentServer()


@server.rtc_session()
async def entrypoint(ctx: JobContext):
    """Called when a participant joins a room — creates and starts the agent."""

    logger.info(f"🔗 Joining room: {ctx.room.name}")

    # ── Connect to room (ensures metadata is available) ──
    await ctx.connect()

    # ── Read dynamic config from room metadata ──
    try:
        config = parse_room_config(ctx.room)
    except ValueError as e:
        logger.error(f"❌ Cannot start agent: {e}")
        return

    is_outbound = config["callDirection"] == "outbound"

    # ── Build system prompt (enhanced for outbound) ──
    if is_outbound:
        system_prompt = build_outbound_prompt(config)
    else:
        system_prompt = config["systemPrompt"]

    # ── Build pipeline components from config ──
    stt = build_stt(config)
    llm_instance = build_llm(config)
    tts = build_tts(config)

    # ── Transcript collector ──
    transcript: list[dict] = []
    user_has_spoken = False

    def add_transcript(speaker: str, text: str):
        transcript.append({
            "speaker": speaker,
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    # ── Create AgentSession ──
    session = AgentSession(
        vad=silero.VAD.load(),
        stt=stt,
        llm=llm_instance,
        tts=tts,
        allow_interruptions=True,
        min_endpointing_delay=0.5,
    )

    # ── Listen for transcript events ──
    @session.on("user_speech_committed")
    def on_user_speech(msg):
        nonlocal user_has_spoken
        text = msg.content if hasattr(msg, "content") else str(msg)
        if text and text.strip():
            user_has_spoken = True
            add_transcript("user", text.strip())
            logger.info(f"🎤 User: {text.strip()[:80]}")

    @session.on("agent_speech_committed")
    def on_agent_speech(msg):
        text = msg.content if hasattr(msg, "content") else str(msg)
        if text and text.strip():
            add_transcript("agent", text.strip())
            logger.info(f"🤖 Agent: {text.strip()[:80]}")

    # ── Create Agent with system prompt ──
    agent = Agent(instructions=system_prompt)

    # ── Start the session ──
    await session.start(
        agent=agent,
        room=ctx.room,
    )

    # ── Say greeting / opening message ──
    greeting = config["greeting"]
    add_transcript("agent", greeting)
    await session.say(greeting, allow_interruptions=True)

    direction_label = "OUTBOUND" if is_outbound else "INBOUND"
    logger.info(
        f"🎙️ Agent started [{direction_label}] in room: {ctx.room.name} | "
        f"STT: {config['sttProvider']}/{config['sttModel']} | "
        f"LLM: {config['llmModel']} | "
        f"TTS: {config['ttsProvider']}/{config['ttsModel']}/{config['ttsVoice']}"
    )

    # ── Outbound: no-answer timeout ──
    # If the customer doesn't speak within 30s, hang up
    if is_outbound:
        async def outbound_timeout_check():
            await asyncio.sleep(OUTBOUND_NO_ANSWER_TIMEOUT)
            if not user_has_spoken:
                logger.info(f"⏰ Outbound timeout — no answer in {OUTBOUND_NO_ANSWER_TIMEOUT}s → {ctx.room.name}")
                add_transcript("system", f"[المكالمة أُغلقت — لم يرد العميل خلال {OUTBOUND_NO_ANSWER_TIMEOUT} ثانية]")
                await report_call_result(ctx.room.name, "no_answer")
                await save_transcript_to_backend(ctx.room.name, transcript)
                # Disconnect from room
                try:
                    await ctx.room.disconnect()
                except Exception:
                    pass

        timeout_task = asyncio.create_task(outbound_timeout_check())

    # ── Wait for disconnect, then save transcript ──
    @ctx.room.on("disconnected")
    def on_disconnect():
        logger.info(f"📴 Room disconnected: {ctx.room.name} | Transcript: {len(transcript)} entries | Direction: {direction_label}")
        # Cancel timeout if still running
        if is_outbound and timeout_task and not timeout_task.done():
            timeout_task.cancel()
        asyncio.create_task(save_transcript_to_backend(ctx.room.name, transcript))

    # Keep alive until room closes
    try:
        await asyncio.Future()
    except asyncio.CancelledError:
        logger.info(f"🛑 Agent task cancelled for room: {ctx.room.name}")
        if is_outbound and timeout_task and not timeout_task.done():
            timeout_task.cancel()
        await save_transcript_to_backend(ctx.room.name, transcript)


# ══════════════════════════════════════════════════════
# Worker Entry Point
# ══════════════════════════════════════════════════════

if __name__ == "__main__":
    cli.run_app(server)