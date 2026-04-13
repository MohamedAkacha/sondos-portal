"""
Handoff Tool — Transfers call to human agent queue
"""
import json
import logging
import aiohttp
import os

logger = logging.getLogger("sondos-agent.tools.handoff")

BACKEND_URL = os.getenv("SONDOS_BACKEND_URL", "").rstrip("/")
AGENT_SECRET = os.getenv("SONDOS_AGENT_SECRET", "")


async def execute_handoff(user_id: str, agent_id: str, call_id: str, reason: str, contact_phone: str = "", contact_name: str = "", summary: str = "") -> str:
    """Create a handoff queue entry via backend API."""
    if not BACKEND_URL or not AGENT_SECRET:
        return json.dumps({"error": "Backend not configured"})

    url = f"{BACKEND_URL}/api/internal/handoff/create"
    headers = {"X-Agent-Secret": AGENT_SECRET, "Content-Type": "application/json"}

    payload = {
        "userId": user_id,
        "agentId": agent_id,
        "callId": call_id,
        "sourceType": "call",
        "contactPhone": contact_phone,
        "contactName": contact_name,
        "reason": reason,
        "conversationSummary": summary,
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    logger.info(f"✅ Handoff created for call {call_id}: {reason}")
                    return json.dumps({"action": "handoff_created", "message": "تم تحويل المكالمة لموظف. سيتصل بك قريباً."})
                else:
                    text = await resp.text()
                    logger.error(f"❌ Handoff creation failed ({resp.status}): {text}")
                    return json.dumps({"error": "Failed to create handoff"})
    except Exception as e:
        logger.error(f"❌ Handoff error: {e}")
        return json.dumps({"error": str(e)})
