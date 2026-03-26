// =====================================================
// Twilio Integration — شراء وإدارة أرقام الهاتف
// ─────────────────────────────────────────────────────
// Buy numbers, configure SIP, release numbers
// Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
// =====================================================

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';

// Base URL for Twilio REST API
const TWILIO_API = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`;

// ── Auth header ──
function authHeader() {
  const encoded = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  return { 'Authorization': `Basic ${encoded}`, 'Content-Type': 'application/x-www-form-urlencoded' };
}

// ── URL encode object ──
function urlEncode(obj) {
  return Object.entries(obj).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

/**
 * Check if Twilio is configured
 */
function isConfigured() {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN);
}

/**
 * List available phone numbers for purchase
 * @param {string} country - ISO country code (SA, AE, US, etc.)
 * @param {object} options - { type: 'local'|'tollFree'|'mobile', contains, limit }
 */
async function listAvailableNumbers(country = 'US', options = {}) {
  if (!isConfigured()) throw new Error('Twilio غير مُعد');

  const type = options.type || 'Local';
  const typePath = type.charAt(0).toUpperCase() + type.slice(1);
  let url = `${TWILIO_API}/AvailablePhoneNumbers/${country}/${typePath}.json?PageSize=${options.limit || 10}`;
  
  if (options.contains) url += `&Contains=${encodeURIComponent(options.contains)}`;
  if (options.areaCode) url += `&AreaCode=${options.areaCode}`;

  const res = await fetch(url, { headers: authHeader() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return (data.available_phone_numbers || []).map(n => ({
    phoneNumber: n.phone_number,
    friendlyName: n.friendly_name,
    country: n.iso_country,
    region: n.region,
    capabilities: {
      voice: n.capabilities?.voice || false,
      sms: n.capabilities?.SMS || false,
      mms: n.capabilities?.MMS || false,
    },
  }));
}

/**
 * Purchase a phone number
 * @param {string} phoneNumber - E.164 format (+966...)
 * @param {string} sipDomain - SIP URI to forward calls to (LiveKit SIP)
 */
async function purchaseNumber(phoneNumber, sipDomain = '') {
  if (!isConfigured()) throw new Error('Twilio غير مُعد');

  const body = { PhoneNumber: phoneNumber };
  
  // If SIP domain provided, configure voice to forward via SIP
  if (sipDomain) {
    body.VoiceUrl = ''; // Clear webhook
    body.SipDomainSid = sipDomain;
  }

  const res = await fetch(`${TWILIO_API}/IncomingPhoneNumbers.json`, {
    method: 'POST',
    headers: authHeader(),
    body: urlEncode(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio purchase error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    sid: data.sid,
    phoneNumber: data.phone_number,
    friendlyName: data.friendly_name,
    country: data.iso_country,
    status: data.status,
  };
}

/**
 * Configure a number to forward calls via SIP
 * @param {string} numberSid - Twilio number SID
 * @param {string} sipUri - SIP URI (e.g., sip:+number@livekit-sip.example.com)
 */
async function configureNumberSip(numberSid, sipUri) {
  if (!isConfigured()) throw new Error('Twilio غير مُعد');

  // Use TwiML to forward to SIP
  const twiml = `<Response><Dial><Sip>${sipUri}</Sip></Dial></Response>`;
  const twimlBinRes = await fetch(`${TWILIO_API}/TwimlBins.json`, {
    method: 'POST',
    headers: authHeader(),
    body: urlEncode({ FriendlyName: `LiveKit SIP - ${numberSid}`, Twiml: twiml }),
  });

  if (!twimlBinRes.ok) {
    throw new Error('Failed to create TwiML Bin');
  }

  const bin = await twimlBinRes.json();

  // Update number to use TwiML Bin
  const res = await fetch(`${TWILIO_API}/IncomingPhoneNumbers/${numberSid}.json`, {
    method: 'POST',
    headers: authHeader(),
    body: urlEncode({ VoiceUrl: bin.url }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio config error (${res.status}): ${err}`);
  }

  return { success: true, twimlBinSid: bin.sid };
}

/**
 * Release (delete) a phone number
 * @param {string} numberSid - Twilio number SID
 */
async function releaseNumber(numberSid) {
  if (!isConfigured()) throw new Error('Twilio غير مُعد');

  const res = await fetch(`${TWILIO_API}/IncomingPhoneNumbers/${numberSid}.json`, {
    method: 'DELETE',
    headers: authHeader(),
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Twilio release error (${res.status}): ${err}`);
  }

  return { success: true };
}

/**
 * Get account info (balance, etc.)
 */
async function getAccountInfo() {
  if (!isConfigured()) throw new Error('Twilio غير مُعد');

  const res = await fetch(`${TWILIO_API}.json`, { headers: authHeader() });
  if (!res.ok) throw new Error('Failed to fetch Twilio account');

  const data = await res.json();
  return {
    friendlyName: data.friendly_name,
    status: data.status,
    type: data.type,
  };
}

module.exports = {
  isConfigured,
  listAvailableNumbers,
  purchaseNumber,
  configureNumberSip,
  releaseNumber,
  getAccountInfo,
};
