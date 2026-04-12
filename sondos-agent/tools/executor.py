"""
Tool Executor — Fetches tools from backend and executes them during calls.
Converts Sondos tools to OpenAI function calling format.
"""

import json
import logging
import aiohttp
import os

logger = logging.getLogger("sondos-agent.tools")

BACKEND_URL = os.getenv("SONDOS_BACKEND_URL", "").rstrip("/")
AGENT_SECRET = os.getenv("SONDOS_AGENT_SECRET", "")


async def fetch_tool_schemas(user_id: str, agent_id: str) -> list[dict]:
    """Fetch tool schemas from backend for a specific agent."""
    if not BACKEND_URL or not AGENT_SECRET:
        logger.warning("⚠️ Backend not configured — no tools available")
        return []

    url = f"{BACKEND_URL}/api/internal/tools/{user_id}/{agent_id}/schemas"
    headers = {"X-Agent-Secret": AGENT_SECRET, "Content-Type": "application/json"}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    tools = data.get("data", [])
                    logger.info(f"🔧 Loaded {len(tools)} tools for agent {agent_id}")
                    return tools
                else:
                    text = await resp.text()
                    logger.error(f"❌ Failed to fetch tools ({resp.status}): {text}")
                    return []
    except Exception as e:
        logger.error(f"❌ Tool fetch error: {e}")
        return []


def build_openai_tools(tool_schemas: list[dict]) -> list[dict]:
    """Convert Sondos tool schemas to OpenAI function calling format."""
    openai_tools = []
    for tool in tool_schemas:
        schema = tool.get("schema", {})
        if schema:
            openai_tools.append(schema)
    return openai_tools


async def execute_tool(tool_schemas: list[dict], function_name: str, arguments: dict) -> str:
    """Execute a tool call from the LLM.
    
    For built-in tools, executes locally.
    For custom_http tools, calls the backend execution endpoint.
    """
    # Find the tool config
    tool_config = None
    for tool in tool_schemas:
        config = tool.get("config", {})
        if config.get("functionName") == function_name:
            tool_config = config
            break

    if not tool_config:
        logger.warning(f"⚠️ Tool not found: {function_name}")
        return json.dumps({"error": f"Tool '{function_name}' not found"})

    tool_type = tool_config.get("type", "custom_http")
    tool_id = tool_config.get("id")

    logger.info(f"🔧 Executing tool: {function_name} (type={tool_type})")

    # ── Built-in tools ──
    if tool_type == "built_in":
        return await _execute_built_in(function_name, arguments)

    # ── Custom HTTP tools — delegate to backend ──
    if tool_type == "custom_http":
        return await _execute_via_backend(tool_id, arguments)

    return json.dumps({"error": f"Unknown tool type: {tool_type}"})


async def _execute_built_in(function_name: str, arguments: dict) -> str:
    """Execute a built-in tool locally."""

    if function_name == "end_call":
        reason = arguments.get("reason", "اكتمل الهدف")
        logger.info(f"📞 End call requested: {reason}")
        return json.dumps({"action": "end_call", "reason": reason})

    if function_name == "transfer_to_human":
        reason = arguments.get("reason", "طلب العميل")
        logger.info(f"👤 Human handoff requested: {reason}")
        return json.dumps({"action": "transfer_to_human", "reason": reason})

    if function_name == "capture_lead":
        logger.info(f"📋 Lead captured: {arguments}")
        # Send to backend
        return await _send_to_backend("/api/internal/leads/capture", arguments)

    if function_name == "send_sms":
        logger.info(f"📱 SMS requested: {arguments.get('phone')}")
        return await _send_to_backend("/api/internal/sms/send", arguments)

    if function_name == "knowledge_search":
        query = arguments.get("query", "")
        logger.info(f"🔍 Knowledge search: {query}")
        return await _send_to_backend("/api/internal/knowledge/search", {"query": query})

    return json.dumps({"error": f"Unknown built-in tool: {function_name}"})


async def _execute_via_backend(tool_id: str, params: dict) -> str:
    """Execute a custom HTTP tool via the backend."""
    if not BACKEND_URL or not AGENT_SECRET:
        return json.dumps({"error": "Backend not configured"})

    url = f"{BACKEND_URL}/api/internal/tools/execute"
    headers = {"X-Agent-Secret": AGENT_SECRET, "Content-Type": "application/json"}
    payload = {"toolId": tool_id, "params": params}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                data = await resp.json()
                result = data.get("data", {})
                if result.get("success"):
                    logger.info(f"✅ Tool executed successfully (HTTP {result.get('statusCode')})")
                    return json.dumps(result.get("data", {}))
                else:
                    logger.warning(f"⚠️ Tool execution failed: {result.get('error')}")
                    return json.dumps({"error": result.get("error", "Tool execution failed")})
    except Exception as e:
        logger.error(f"❌ Tool execution error: {e}")
        return json.dumps({"error": str(e)})


async def _send_to_backend(path: str, data: dict) -> str:
    """Send a request to the backend internal API."""
    if not BACKEND_URL or not AGENT_SECRET:
        return json.dumps({"error": "Backend not configured"})

    url = f"{BACKEND_URL}{path}"
    headers = {"X-Agent-Secret": AGENT_SECRET, "Content-Type": "application/json"}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=data, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                result = await resp.json()
                return json.dumps(result.get("data", result))
    except Exception as e:
        logger.error(f"❌ Backend call error ({path}): {e}")
        return json.dumps({"error": str(e)})
