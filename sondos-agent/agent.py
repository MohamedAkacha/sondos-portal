"""
╔══════════════════════════════════════════════════════════════╗
║  Sondos AI — LiveKit Voice Agent Worker (v7)                ║
║  ─────────────────────────────────────────────────────────   ║
║  LiveKit Agents 1.5 — AgentSession API                      ║
║  Fully dynamic — zero hardcoded config                      ║
║  All settings come from room metadata (set by backend)      ║
║  STT (Deepgram / ElevenLabs Scribe / Whisper)                ║
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

# ── Outbound timeouts ──
OUTBOUND_RING_TIMEOUT = 60    # seconds — wait for SIP participant to join (ringing)
OUTBOUND_SPEECH_TIMEOUT = 60  # seconds — wait for customer to speak after answering


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
        "ttsLanguage":    agent_cfg.get("ttsLanguage", agent_cfg.get("sttLanguage", "ar")),
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

async def save_transcript_to_backend(room_name: str, transcript: list[dict], usage: dict | None = None):
    """POST transcript + usage to backend API."""
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
    # ── Attach ElevenLabs usage if available ──
    if usage:
        payload["elevenLabsUsage"] = usage

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
    """Build STT instance based on config provider.
    
    Supports: deepgram, elevenlabs, openai
    Fallback: If ElevenLabs fails (missing key, quota, etc), auto-fallback to Deepgram.
    """
    provider = config["sttProvider"]
    language = config["sttLanguage"]
    model = config["sttModel"]

    if provider == "deepgram":
        logger.info(f"🎧 STT: Deepgram {model} (lang={language})")
        return deepgram.STT(model=model, language=language)

    elif provider == "elevenlabs":
        # ── ElevenLabs Scribe v2 Realtime — streaming STT ──
        # KEY FIX: Must enable server_vad for auto-commit of transcripts!
        # Without it, STT produces partials but never commits → Agent never responds
        eleven_key = os.getenv("ELEVEN_API_KEY", "")
        if not eleven_key:
            logger.warning("⚠️ ELEVEN_API_KEY not set — falling back to Deepgram for STT")
            return deepgram.STT(model="nova-2", language=language)

        try:
            eleven_model = "scribe_v2_realtime"
            eleven_lang = language if language != "multi" else None

            stt_instance = elevenlabs.STT(
                model_id=eleven_model,
                api_key=eleven_key,
                language_code=eleven_lang,
            )
            logger.info(f"🎧 STT: ElevenLabs {eleven_model} (lang={eleven_lang or 'auto'})")
            return stt_instance

        except Exception as e:
            logger.error(f"❌ ElevenLabs STT init failed: {e} — falling back to Deepgram")
            return deepgram.STT(model="nova-2", language=language)

    elif provider == "openai":
        logger.info(f"🎧 STT: OpenAI Whisper (lang={language})")
        return openai.STT(model="whisper-1", language=language)

    else:
        logger.warning(f"⚠️ Unknown STT provider '{provider}' — falling back to Deepgram")
        return deepgram.STT(model="nova-2", language=language)


def build_tts(config: dict):
    """Build TTS instance based on config provider.

    Supports: openai, elevenlabs
    Fallback: If ElevenLabs fails (missing key, quota, etc), auto-fallback to OpenAI TTS.
    """
    provider = config["ttsProvider"]
    model = config["ttsModel"]
    voice = config["ttsVoice"]
    language = config.get("ttsLanguage", config.get("sttLanguage", "ar"))  # dedicated TTS language

    if provider == "elevenlabs":
        # ── ElevenLabs TTS ──
        # Requires ELEVEN_API_KEY env var
        eleven_key = os.getenv("ELEVEN_API_KEY", "")
        if not eleven_key:
            logger.warning("⚠️ ELEVEN_API_KEY not set — falling back to OpenAI TTS")
            return openai.TTS(model="tts-1", voice="nova")

        try:
            # Prefer Flash model for live calls (75ms latency, 50% cheaper)
            # Only override if the model is the old default or empty
            if model in ("tts-1", "tts-1-hd", "", None):
                eleven_model = "eleven_flash_v2_5"
            else:
                eleven_model = model

            # Map language for ElevenLabs
            eleven_lang = language if language != "multi" else None

            logger.info(
                f"🔊 TTS: ElevenLabs model={eleven_model} voice={voice} "
                f"lang={eleven_lang or 'auto'}"
            )
            return elevenlabs.TTS(
                model=eleven_model,
                voice_id=voice,
                language=eleven_lang,
                api_key=eleven_key,
                inactivity_timeout=180,  # Prevent WebSocket closing after 20s of silence
            )
        except Exception as e:
            logger.error(f"❌ ElevenLabs TTS init failed: {e} — falling back to OpenAI TTS")
            return openai.TTS(model="tts-1", voice="nova")

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

    # ── SIP Inbound: Wait for room metadata (injected by webhook) ──
    # For SIP calls, metadata is set on the participant, not the room.
    # The backend webhook copies it to room metadata, but needs a moment.
    if ctx.room.name.startswith("sondos-sip-") and not ctx.room.metadata:
        logger.info("⏳ SIP room — waiting for metadata injection from backend...")
        for attempt in range(8):  # Wait up to 8 seconds
            await asyncio.sleep(1)
            if ctx.room.metadata:
                logger.info(f"✅ Room metadata received after {attempt + 1}s")
                break
        else:
            # ── Last resort: check SIP participant metadata ──
            logger.warning("⚠️ Room metadata still empty — checking participant metadata...")
            for p in ctx.room.remote_participants.values():
                if p.metadata:
                    try:
                        test = json.loads(p.metadata)
                        if test.get("agentConfig"):
                            logger.info(f"✅ Found agentConfig in participant {p.identity} metadata")
                            # Manually set on room object for parse_room_config
                            ctx.room.metadata = p.metadata
                            break
                    except (json.JSONDecodeError, AttributeError):
                        pass

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

    # ── ElevenLabs usage tracking (Step 24) ──
    tts_total_chars = 0
    stt_start_time = datetime.now(timezone.utc)

    def add_transcript(speaker: str, text: str):
        nonlocal tts_total_chars
        transcript.append({
            "speaker": speaker,
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        # Count TTS characters (agent speech = sent to TTS)
        if speaker == "agent" and text:
            tts_total_chars += len(text)

    # ── Create AgentSession ──
    session = AgentSession(
        vad=silero.VAD.load(),
        stt=stt,
        llm=llm_instance,
        tts=tts,
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

    # ── Wait for the human participant (SIP caller) ──
    # Without this, session.start() may not bind to the SIP participant's audio
    participant = await ctx.wait_for_participant()
    logger.info(f"👤 Target participant: {participant.identity} → {ctx.room.name}")

    # ── Start the session ──
    await session.start(
        agent=agent,
        room=ctx.room,
        participant=participant,
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

    # ── Outbound: two-phase timeout ──
    # Phase 1: Wait for SIP participant to join (ringing → answer)
    # Phase 2: Wait for customer to speak after answering
    if is_outbound:
        sip_participant_joined = asyncio.Event()

        # Listen for SIP participant joining the room
        @ctx.room.on("participant_connected")
        def on_participant_connected(participant):
            identity = participant.identity or ""
            # SIP participants have identities like "caller-966501234567" or "sip-..."
            if identity.startswith("caller-") or identity.startswith("sip") or "sip" in identity.lower():
                logger.info(f"📞 SIP participant joined: {identity} → {ctx.room.name}")
                sip_participant_joined.set()

        async def outbound_timeout_check():
            # ── Phase 1: Wait for SIP participant to join (customer answers the phone) ──
            try:
                await asyncio.wait_for(sip_participant_joined.wait(), timeout=OUTBOUND_RING_TIMEOUT)
                logger.info(f"✅ Customer answered — starting speech timer ({OUTBOUND_SPEECH_TIMEOUT}s) → {ctx.room.name}")
            except asyncio.TimeoutError:
                # Phone rang but nobody answered within 60s
                logger.info(f"⏰ Outbound ring timeout — no answer in {OUTBOUND_RING_TIMEOUT}s → {ctx.room.name}")
                add_transcript("system", f"[المكالمة أُغلقت — لم يرد العميل خلال {OUTBOUND_RING_TIMEOUT} ثانية]")
                await report_call_result(ctx.room.name, "no_answer")
                await save_transcript_to_backend(ctx.room.name, transcript, build_usage())
                try:
                    await ctx.room.disconnect()
                except Exception:
                    pass
                return

            # ── Phase 2: Wait for customer to speak after answering ──
            await asyncio.sleep(OUTBOUND_SPEECH_TIMEOUT)
            if not user_has_spoken:
                logger.info(f"⏰ Outbound speech timeout — customer answered but didn't speak in {OUTBOUND_SPEECH_TIMEOUT}s → {ctx.room.name}")
                add_transcript("system", f"[المكالمة أُغلقت — العميل ردّ لكن لم يتحدث خلال {OUTBOUND_SPEECH_TIMEOUT} ثانية]")
                await report_call_result(ctx.room.name, "no_answer")
                await save_transcript_to_backend(ctx.room.name, transcript, build_usage())
                try:
                    await ctx.room.disconnect()
                except Exception:
                    pass

        timeout_task = asyncio.create_task(outbound_timeout_check())

    # ── Build ElevenLabs usage data (Step 24) ──
    def build_usage() -> dict:
        stt_secs = int((datetime.now(timezone.utc) - stt_start_time).total_seconds())
        return {
            "ttsProvider": config["ttsProvider"],
            "sttProvider": config["sttProvider"],
            "ttsCharacters": tts_total_chars,
            "sttSeconds": stt_secs,
        }

    # ── Wait for disconnect, then save transcript ──
    @ctx.room.on("disconnected")
    def on_disconnect():
        usage = build_usage()
        logger.info(
            f"📴 Room disconnected: {ctx.room.name} | Transcript: {len(transcript)} entries | "
            f"Direction: {direction_label} | TTS chars: {usage['ttsCharacters']} | STT secs: {usage['sttSeconds']}"
        )
        # Cancel timeout if still running
        if is_outbound and timeout_task and not timeout_task.done():
            timeout_task.cancel()
        asyncio.create_task(save_transcript_to_backend(ctx.room.name, transcript, usage))

    # Keep alive until room closes
    try:
        await asyncio.Future()
    except asyncio.CancelledError:
        logger.info(f"🛑 Agent task cancelled for room: {ctx.room.name}")
        if is_outbound and timeout_task and not timeout_task.done():
            timeout_task.cancel()
        await save_transcript_to_backend(ctx.room.name, transcript, build_usage())


# ══════════════════════════════════════════════════════
# Worker Entry Point
# ══════════════════════════════════════════════════════

if __name__ == "__main__":
    cli.run_app(server)