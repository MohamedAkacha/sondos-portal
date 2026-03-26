"""
╔══════════════════════════════════════════════════════════════╗
║  Sondos AI — LiveKit Voice Agent Worker (v5)                ║
║  ─────────────────────────────────────────────────────────   ║
║  LiveKit Agents 1.5 — AgentSession API                      ║
║  Fully dynamic — zero hardcoded config                      ║
║  All settings come from room metadata (set by backend)      ║
║  STT (Deepgram / Whisper)                                   ║
║  → LLM (OpenAI GPT-5.4 / 4o family)                        ║
║  → TTS (OpenAI / ElevenLabs — with voice cloning)           ║
║  + Transcript saving to backend                             ║
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
    }

    logger.info(
        f"✅ Room config loaded: "
        f"STT={config['sttProvider']}/{config['sttModel']} "
        f"LLM={config['llmModel']} "
        f"TTS={config['ttsProvider']}/{config['ttsModel']}/{config['ttsVoice']}"
    )

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
                    logger.info(f"✅ Transcript saved: {len(transcript)} entries → {room_name}")
                else:
                    text = await resp.text()
                    logger.error(f"❌ Transcript save failed ({resp.status}): {text}")
    except Exception as e:
        logger.error(f"❌ Transcript save error: {e}")


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
        logger.info(f"🔊 TTS: ElevenLabs {model}/{voice}")
        return elevenlabs.TTS(
            model=model,
            voice_id=voice,
            language="ar",
            voice_settings=elevenlabs.VoiceSettings(
                stability=0.5,
                similarity_boost=0.75,
                style=0.0,
                use_speaker_boost=True,
            ),
        )
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

    # ── Build pipeline components from config ──
    stt = build_stt(config)
    llm_instance = build_llm(config)
    tts = build_tts(config)

    # ── Transcript collector ──
    transcript: list[dict] = []

    def add_transcript(speaker: str, text: str):
        transcript.append({
            "speaker": speaker,
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    # ── Create AgentSession (replaces VoicePipelineAgent in 1.x) ──
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
        text = msg.content if hasattr(msg, "content") else str(msg)
        if text and text.strip():
            add_transcript("user", text.strip())
            logger.info(f"🎤 User: {text.strip()[:80]}")

    @session.on("agent_speech_committed")
    def on_agent_speech(msg):
        text = msg.content if hasattr(msg, "content") else str(msg)
        if text and text.strip():
            add_transcript("agent", text.strip())
            logger.info(f"🤖 Agent: {text.strip()[:80]}")

    # ── Create Agent with system prompt ──
    agent = Agent(instructions=config["systemPrompt"])

    # ── Start the session ──
    await session.start(
        agent=agent,
        room=ctx.room,
    )

    # ── Say greeting ──
    greeting = config["greeting"]
    add_transcript("agent", greeting)
    await session.say(greeting, allow_interruptions=True)

    logger.info(
        f"🎙️ Agent started in room: {ctx.room.name} | "
        f"STT: {config['sttProvider']}/{config['sttModel']} | "
        f"LLM: {config['llmModel']} | "
        f"TTS: {config['ttsProvider']}/{config['ttsModel']}/{config['ttsVoice']}"
    )

    # ── Wait for disconnect, then save transcript ──
    @ctx.room.on("disconnected")
    def on_disconnect():
        logger.info(f"📴 Room disconnected: {ctx.room.name} | Transcript: {len(transcript)} entries")
        asyncio.create_task(save_transcript_to_backend(ctx.room.name, transcript))

    # Keep alive until room closes
    try:
        await asyncio.Future()
    except asyncio.CancelledError:
        logger.info(f"🛑 Agent task cancelled for room: {ctx.room.name}")
        await save_transcript_to_backend(ctx.room.name, transcript)


# ══════════════════════════════════════════════════════
# Worker Entry Point
# ══════════════════════════════════════════════════════

if __name__ == "__main__":
    cli.run_app(server)