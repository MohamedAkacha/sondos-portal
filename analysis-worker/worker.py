"""
╔══════════════════════════════════════════════════════╗
║  Sondos AI — Analysis Worker                         ║
║  Processes completed calls from Redis queue           ║
║  - Post-call analysis (summary, sentiment, intent)    ║
║  - Variable extraction                               ║
║  - Conversation memory update                        ║
╚══════════════════════════════════════════════════════╝
"""

import os
import json
import logging
import asyncio
import aiohttp
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("analysis-worker")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter('%(asctime)s [%(name)s] %(levelname)s: %(message)s'))
logger.addHandler(handler)

BACKEND_URL = os.getenv("SONDOS_BACKEND_URL", "").rstrip("/")
AGENT_SECRET = os.getenv("SONDOS_AGENT_SECRET", "")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "10"))  # seconds


async def trigger_analysis(call_id: str):
    """Tell backend to analyze a call."""
    url = f"{BACKEND_URL}/api/internal/analyze/{call_id}"
    headers = {"X-Agent-Secret": AGENT_SECRET, "Content-Type": "application/json"}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, timeout=aiohttp.ClientTimeout(total=60)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    logger.info(f"✅ Analysis completed for call {call_id}")
                    return data
                else:
                    text = await resp.text()
                    logger.error(f"❌ Analysis failed for {call_id} ({resp.status}): {text}")
                    return None
    except Exception as e:
        logger.error(f"❌ Analysis error for {call_id}: {e}")
        return None


async def trigger_extraction(call_id: str):
    """Tell backend to extract variables from a call."""
    url = f"{BACKEND_URL}/api/internal/extract/{call_id}"
    headers = {"X-Agent-Secret": AGENT_SECRET, "Content-Type": "application/json"}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, timeout=aiohttp.ClientTimeout(total=60)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    logger.info(f"✅ Extraction completed for call {call_id}")
                    return data
                else:
                    text = await resp.text()
                    logger.error(f"❌ Extraction failed for {call_id} ({resp.status}): {text}")
                    return None
    except Exception as e:
        logger.error(f"❌ Extraction error for {call_id}: {e}")
        return None


async def get_unprocessed_calls():
    """Fetch recently completed calls that haven't been analyzed yet."""
    url = f"{BACKEND_URL}/api/internal/calls/unanalyzed"
    headers = {"X-Agent-Secret": AGENT_SECRET}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("data", [])
                else:
                    return []
    except Exception as e:
        logger.error(f"❌ Failed to fetch unanalyzed calls: {e}")
        return []


async def process_call(call_id: str):
    """Process a single call: analyze + extract."""
    logger.info(f"🔄 Processing call: {call_id}")

    # Step 1: Post-call analysis
    await trigger_analysis(call_id)

    # Step 2: Variable extraction
    await trigger_extraction(call_id)

    logger.info(f"✅ Call processing complete: {call_id}")


async def main_loop():
    """Main polling loop — checks for unprocessed calls."""
    logger.info("🚀 Analysis Worker started")
    logger.info(f"   Backend: {BACKEND_URL}")
    logger.info(f"   Poll interval: {POLL_INTERVAL}s")

    if not BACKEND_URL or not AGENT_SECRET:
        logger.error("❌ SONDOS_BACKEND_URL and SONDOS_AGENT_SECRET must be set")
        return

    while True:
        try:
            calls = await get_unprocessed_calls()
            if calls:
                logger.info(f"📋 Found {len(calls)} unprocessed calls")
                for call in calls:
                    call_id = call.get("_id") or call.get("id")
                    if call_id:
                        await process_call(call_id)
            else:
                logger.debug("💤 No unprocessed calls")
        except Exception as e:
            logger.error(f"❌ Loop error: {e}")

        await asyncio.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main_loop())
