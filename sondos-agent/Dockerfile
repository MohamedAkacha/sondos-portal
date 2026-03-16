# ══════════════════════════════════════════════════════
# Sondos AI — Agent Worker Dockerfile
# ══════════════════════════════════════════════════════

FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code
COPY agent.py .

# LiveKit agent worker expects these env vars:
# LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
# DEEPGRAM_API_KEY, OPENAI_API_KEY

# Start the agent worker
CMD ["python", "agent.py", "start"]
