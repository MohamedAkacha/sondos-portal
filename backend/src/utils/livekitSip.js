// =====================================================
// LiveKit SIP Integration — ربط أرقام الهاتف بـ LiveKit
// ─────────────────────────────────────────────────────
// Creates SIP Trunks + Dispatch Rules on LiveKit Cloud
// Flow: Phone call → SIP Trunk → LiveKit Room → Agent
// Requires: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
// =====================================================

const { AccessToken } = require('livekit-server-sdk');

const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

// LiveKit SIP API uses HTTP (not WebSocket)
const LIVEKIT_HTTP_URL = LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://');

/**
 * Generate a signed JWT for LiveKit API calls
 */
async function generateApiToken() {
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: 'sondos-sip-admin',
    ttl: 60, // 1 min
  });
  token.addGrant({
    roomAdmin: true,
    roomCreate: true,
    roomJoin: true,
    roomList: true,
  });
  // SIP permissions — required for trunk/rule management
  token.addSIPGrant({
    admin: true,
    call: true,
  });
  return await token.toJwt();
}

/**
 * Auth header for LiveKit API
 */
async function authHeader() {
  const jwt = await generateApiToken();
  return {
    'Authorization': `Bearer ${jwt}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Check if LiveKit SIP is available
 */
function isConfigured() {
  return !!(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
}

// ══════════════════════════════════════════════════════
// SIP Trunks
// ══════════════════════════════════════════════════════

/**
 * Create an Inbound SIP Trunk
 * This allows incoming calls to reach LiveKit
 * 
 * @param {object} config
 * @param {string} config.name - Trunk name (e.g., "Sondos - +966501234567")
 * @param {string[]} config.numbers - Phone numbers to accept (E.164)
 * @param {string[]} config.allowedAddresses - SIP server IPs to accept from (provider IPs)
 * @param {string} config.authUsername - SIP auth username (optional)
 * @param {string} config.authPassword - SIP auth password (optional)
 */
async function createInboundTrunk(config) {
  if (!isConfigured()) throw new Error('LiveKit SIP غير مُعد');

  const body = {
    trunk: {
      name: config.name || 'Sondos SIP Trunk',
      numbers: config.numbers || [],
      allowed_addresses: config.allowedAddresses || [],
    },
  };

  // Add auth if provided (for custom SIP trunks)
  if (config.authUsername) {
    body.trunk.auth_username = config.authUsername;
    body.trunk.auth_password = config.authPassword || '';
  }

  const res = await fetch(`${LIVEKIT_HTTP_URL}/twirp/livekit.SIP/CreateSIPInboundTrunk`, {
    method: 'POST',
    headers: await authHeader(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LiveKit SIP Trunk error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    sipTrunkId: data.sip_trunk_id,
    name: data.name,
    numbers: data.numbers,
  };
}

/**
 * Create an Outbound SIP Trunk (for making calls)
 * 
 * @param {object} config
 * @param {string} config.name - Trunk name
 * @param {string} config.address - SIP server address (e.g., "sip.twilio.com")
 * @param {string[]} config.numbers - From numbers (E.164)
 * @param {string} config.authUsername - SIP auth username
 * @param {string} config.authPassword - SIP auth password
 */
async function createOutboundTrunk(config) {
  if (!isConfigured()) throw new Error('LiveKit SIP غير مُعد');

  const body = {
    trunk: {
      name: config.name || 'Sondos Outbound Trunk',
      address: config.address,
      numbers: config.numbers || [],
      auth_username: config.authUsername || '',
      auth_password: config.authPassword || '',
    },
  };

  const res = await fetch(`${LIVEKIT_HTTP_URL}/twirp/livekit.SIP/CreateSIPOutboundTrunk`, {
    method: 'POST',
    headers: await authHeader(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LiveKit Outbound Trunk error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    sipTrunkId: data.sip_trunk_id,
    name: data.name,
    address: data.address,
  };
}

/**
 * Delete a SIP Trunk
 * @param {string} sipTrunkId
 */
async function deleteSipTrunk(sipTrunkId) {
  if (!isConfigured()) throw new Error('LiveKit SIP غير مُعد');

  const res = await fetch(`${LIVEKIT_HTTP_URL}/twirp/livekit.SIP/DeleteSIPTrunk`, {
    method: 'POST',
    headers: await authHeader(),
    body: JSON.stringify({ sip_trunk_id: sipTrunkId }),
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`LiveKit delete trunk error (${res.status}): ${err}`);
  }

  return { success: true };
}

/**
 * List all SIP Trunks
 */
async function listSipTrunks() {
  if (!isConfigured()) throw new Error('LiveKit SIP غير مُعد');

  const res = await fetch(`${LIVEKIT_HTTP_URL}/twirp/livekit.SIP/ListSIPInboundTrunk`, {
    method: 'POST',
    headers: await authHeader(),
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LiveKit list trunks error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.items || [];
}

// ══════════════════════════════════════════════════════
// Dispatch Rules
// ══════════════════════════════════════════════════════

/**
 * Create a Dispatch Rule
 * Routes incoming SIP calls to a LiveKit room where the agent will join
 *
 * @param {object} config
 * @param {string} config.name - Rule name
 * @param {string} config.trunkIds - SIP Trunk IDs to match
 * @param {string} config.roomPrefix - Room name prefix (agent room)
 * @param {object} config.metadata - Room metadata (agent config)
 */
async function createDispatchRule(config) {
  if (!isConfigured()) throw new Error('LiveKit SIP غير مُعد');

  const body = {
    rule: {
      name: config.name || 'Sondos Dispatch Rule',
      trunk_ids: config.trunkIds || [],
      // Create a new room for each call with auto-generated name
      rule: {
        dispatchRuleIndividual: {
          room_prefix: config.roomPrefix || 'sondos-sip-',
          pin: config.pin || '',
        },
      },
      metadata: config.metadata ? JSON.stringify(config.metadata) : '',
    },
  };

  const res = await fetch(`${LIVEKIT_HTTP_URL}/twirp/livekit.SIP/CreateSIPDispatchRule`, {
    method: 'POST',
    headers: await authHeader(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LiveKit dispatch rule error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    dispatchRuleId: data.sip_dispatch_rule_id,
    name: data.name,
    trunkIds: data.trunk_ids,
  };
}

/**
 * Delete a Dispatch Rule
 * @param {string} dispatchRuleId
 */
async function deleteDispatchRule(dispatchRuleId) {
  if (!isConfigured()) throw new Error('LiveKit SIP غير مُعد');

  const res = await fetch(`${LIVEKIT_HTTP_URL}/twirp/livekit.SIP/DeleteSIPDispatchRule`, {
    method: 'POST',
    headers: await authHeader(),
    body: JSON.stringify({ sip_dispatch_rule_id: dispatchRuleId }),
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`LiveKit delete rule error (${res.status}): ${err}`);
  }

  return { success: true };
}

/**
 * List all Dispatch Rules
 */
async function listDispatchRules() {
  if (!isConfigured()) throw new Error('LiveKit SIP غير مُعد');

  const res = await fetch(`${LIVEKIT_HTTP_URL}/twirp/livekit.SIP/ListSIPDispatchRule`, {
    method: 'POST',
    headers: await authHeader(),
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LiveKit list rules error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.items || [];
}

// ══════════════════════════════════════════════════════
// High-level: Setup full SIP pipeline for a phone number
// ══════════════════════════════════════════════════════

/**
 * Full setup: Create SIP Trunk + Dispatch Rule for a phone number + agent
 * 
 * @param {object} config
 * @param {string} config.phoneNumber - E.164 phone number
 * @param {string} config.agentName - Agent name for labeling
 * @param {object} config.agentConfig - Agent LiveKit config (from agent.toLiveKitConfig())
 * @param {string[]} config.allowedAddresses - Provider SIP IPs (optional)
 * @param {string} config.authUsername - SIP auth (optional)
 * @param {string} config.authPassword - SIP auth (optional)
 */
async function setupPhoneNumber(config) {
  // 1. Create Inbound SIP Trunk
  const trunk = await createInboundTrunk({
    name: `Sondos - ${config.phoneNumber} (${config.agentName})`,
    numbers: [config.phoneNumber],
    allowedAddresses: config.allowedAddresses || [],
    authUsername: config.authUsername || '',
    authPassword: config.authPassword || '',
  });

  // 2. Create Dispatch Rule → routes to room with agent metadata
  const rule = await createDispatchRule({
    name: `Route ${config.phoneNumber} → ${config.agentName}`,
    trunkIds: [trunk.sipTrunkId],
    roomPrefix: `sondos-sip-`,
    metadata: {
      agentConfig: config.agentConfig,
      source: 'sip',
      phoneNumber: config.phoneNumber,
      userId: config.userId || '',
    },
  });

  return {
    sipTrunkId: trunk.sipTrunkId,
    sipDispatchRuleId: rule.dispatchRuleId,
  };
}

/**
 * Full teardown: Delete SIP Trunk + Dispatch Rule
 */
async function teardownPhoneNumber(sipTrunkId, sipDispatchRuleId) {
  const results = { trunk: false, rule: false };

  if (sipDispatchRuleId) {
    try {
      await deleteDispatchRule(sipDispatchRuleId);
      results.rule = true;
    } catch (err) {
      console.error(`Failed to delete dispatch rule ${sipDispatchRuleId}:`, err.message);
    }
  }

  if (sipTrunkId) {
    try {
      await deleteSipTrunk(sipTrunkId);
      results.trunk = true;
    } catch (err) {
      console.error(`Failed to delete SIP trunk ${sipTrunkId}:`, err.message);
    }
  }

  return results;
}

module.exports = {
  isConfigured,
  createInboundTrunk,
  createOutboundTrunk,
  deleteSipTrunk,
  listSipTrunks,
  createDispatchRule,
  deleteDispatchRule,
  listDispatchRules,
  setupPhoneNumber,
  teardownPhoneNumber,
  createSipParticipant,
};

// ══════════════════════════════════════════════════════
// Outbound Call — dial out via SIP
// ══════════════════════════════════════════════════════

/**
 * Create a SIP participant (initiate outbound call)
 * LiveKit dials the destination number and connects to the room
 * @param {object} config
 * @param {string} config.sipTrunkId - Outbound SIP trunk ID
 * @param {string} config.sipCallTo - Destination SIP URI (e.g. sip:+966501234567@trunk)
 * @param {string} config.roomName - Room to connect the call to
 * @param {string} config.participantIdentity - Identity for the SIP participant
 * @param {string} config.participantName - Display name
 * @param {object} config.metadata - Room metadata (JSON stringified)
 */
async function createSipParticipant(config) {
  if (!isConfigured()) throw new Error('LiveKit SIP غير مُعد');

  const body = {
    sip_trunk_id: config.sipTrunkId,
    sip_call_to: config.sipCallTo,
    room_name: config.roomName,
    participant_identity: config.participantIdentity || 'sip-caller',
    participant_name: config.participantName || 'متصل',
    // dtmf: config.dtmf || '',
    // play_ringtone: config.playRingtone !== false,
  };

  const res = await fetch(`${LIVEKIT_HTTP_URL}/twirp/livekit.SIP/CreateSIPParticipant`, {
    method: 'POST',
    headers: await authHeader(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LiveKit SIP Participant error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    participantId: data.participant_id || data.sip_participant_id,
    participantIdentity: data.participant_identity,
    sipCallId: data.sip_call_id,
  };
}
