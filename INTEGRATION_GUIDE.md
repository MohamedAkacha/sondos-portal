# Sondos AI — ElevenLabs + GPT-5.4 Integration Guide

## What Changed (4 files)

### 1. `sondos-agent/requirements.txt`
- Added `livekit-plugins-elevenlabs==0.7.5`

### 2. `sondos-agent/env.example`
- Added `ELEVENLABS_API_KEY` variable

### 3. `sondos-agent/agent.py` (v3 → v4)
- Added `from livekit.plugins import ... elevenlabs`
- Added `ttsProvider` field to config parser
- `build_stt()` — new `elevenlabs` branch (ElevenLabs Scribe STT)
- `build_tts()` — rewritten with provider switch (OpenAI vs ElevenLabs)
- Updated all logging to show provider info

### 4. `frontend/src/pages/client/TestAgentPage.jsx`
- Default LLM changed from `gpt-4o-mini` → `gpt-5.4-mini`
- Added `ttsProvider` to agent config state
- STT dropdown: added "ElevenLabs Scribe" option
- LLM dropdown: now shows 5 models (gpt-5.4, gpt-5.4-mini, gpt-5.4-nano, gpt-4o, gpt-4o-mini)
- New TTS Provider dropdown (OpenAI vs ElevenLabs)
- TTS Voice dropdown: dynamically shows voices based on selected provider
- TTS Model dropdown: dynamically shows models based on selected provider

---

## Setup Steps

### Step 1: Replace the files
Copy each file to the same path in your project (overwrite the old ones).

### Step 2: Add ElevenLabs API Key
In your Agent Worker `.env` file (and Render Dashboard), add:
```
ELEVENLABS_API_KEY=your_key_here
```

### Step 3: Install new dependency
```bash
cd sondos-agent
pip install -r requirements.txt
```

### Step 4: Rebuild on Render
Push to git → Render will auto-rebuild both services.

---

## How It Works

The user picks providers from the UI:

| Setting | Options |
|---------|---------|
| STT Provider | Deepgram Nova-2 / ElevenLabs Scribe / OpenAI Whisper |
| LLM Model | GPT-5.4 / GPT-5.4 Mini / GPT-5.4 Nano / GPT-4o / GPT-4o Mini |
| TTS Provider | OpenAI TTS / ElevenLabs |
| TTS Voice | Dynamic — changes based on selected TTS provider |
| TTS Model | Dynamic — changes based on selected TTS provider |

All settings flow: **Frontend → Backend → Room Metadata → Agent**

The Backend required **zero changes** — it already passes all fields through transparently.

---

## ElevenLabs API Key Permissions Needed
- ✅ Text to Speech → Access
- ✅ Speech to Text → Access
- ❌ Everything else → No Access
