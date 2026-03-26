// =====================================================
// Telnyx Integration — شراء وإدارة أرقام الهاتف
// ─────────────────────────────────────────────────────
// Buy numbers, configure SIP, release numbers
// Requires: TELNYX_API_KEY
// =====================================================

const TELNYX_API_KEY = process.env.TELNYX_API_KEY || '';
const TELNYX_API = 'https://api.telnyx.com/v2';

// ── Auth header ──
function authHeader() {
  return { 'Authorization': `Bearer ${TELNYX_API_KEY}`, 'Content-Type': 'application/json' };
}

/**
 * Check if Telnyx is configured
 */
function isConfigured() {
  return !!TELNYX_API_KEY;
}

/**
 * List available phone numbers for purchase
 * @param {string} country - ISO country code (SA, AE, US, etc.)
 * @param {object} options - { limit, contains, locality }
 */
async function listAvailableNumbers(country = 'US', options = {}) {
  if (!isConfigured()) throw new Error('Telnyx غير مُعد');

  let url = `${TELNYX_API}/available_phone_numbers?filter[country_code]=${country}&filter[limit]=${options.limit || 10}`;
  if (options.contains) url += `&filter[phone_number][contains]=${encodeURIComponent(options.contains)}`;
  if (options.locality) url += `&filter[locality]=${encodeURIComponent(options.locality)}`;

  const res = await fetch(url, { headers: authHeader() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telnyx error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return (data.data || []).map(n => ({
    phoneNumber: n.phone_number,
    friendlyName: n.phone_number,
    country: n.region_information?.[0]?.region_type === 'country' ? n.region_information[0].region_name : country,
    region: n.region_information?.[0]?.region_name || '',
    capabilities: {
      voice: n.features?.includes('voice') || true,
      sms: n.features?.includes('sms') || false,
      mms: n.features?.includes('mms') || false,
    },
    costMonthly: n.cost_information?.monthly_cost || 0,
    currency: n.cost_information?.currency || 'USD',
  }));
}

/**
 * Purchase (order) a phone number
 * @param {string} phoneNumber - E.164 format
 * @param {string} connectionId - Telnyx SIP connection ID (optional)
 */
async function purchaseNumber(phoneNumber, connectionId = '') {
  if (!isConfigured()) throw new Error('Telnyx غير مُعد');

  const body = {
    phone_numbers: [{ phone_number: phoneNumber }],
  };
  if (connectionId) {
    body.connection_id = connectionId;
  }

  const res = await fetch(`${TELNYX_API}/number_orders`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telnyx purchase error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const order = data.data;
  return {
    orderId: order.id,
    phoneNumber: order.phone_numbers?.[0]?.phone_number || phoneNumber,
    status: order.status,
  };
}

/**
 * Configure a number to use a specific SIP connection
 * @param {string} phoneNumberId - Telnyx phone number ID
 * @param {string} connectionId - Telnyx SIP connection ID
 */
async function configureNumberSip(phoneNumberId, connectionId) {
  if (!isConfigured()) throw new Error('Telnyx غير مُعد');

  const res = await fetch(`${TELNYX_API}/phone_numbers/${phoneNumberId}`, {
    method: 'PATCH',
    headers: authHeader(),
    body: JSON.stringify({ connection_id: connectionId }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telnyx config error (${res.status}): ${err}`);
  }

  return { success: true };
}

/**
 * Release (delete) a phone number
 * @param {string} phoneNumberId - Telnyx phone number ID
 */
async function releaseNumber(phoneNumberId) {
  if (!isConfigured()) throw new Error('Telnyx غير مُعد');

  const res = await fetch(`${TELNYX_API}/phone_numbers/${phoneNumberId}`, {
    method: 'DELETE',
    headers: authHeader(),
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Telnyx release error (${res.status}): ${err}`);
  }

  return { success: true };
}

/**
 * Get account balance
 */
async function getBalance() {
  if (!isConfigured()) throw new Error('Telnyx غير مُعد');

  const res = await fetch(`${TELNYX_API}/balance`, { headers: authHeader() });
  if (!res.ok) throw new Error('Failed to fetch Telnyx balance');

  const data = await res.json();
  return {
    balance: data.data?.balance || '0',
    currency: data.data?.currency || 'USD',
  };
}

module.exports = {
  isConfigured,
  listAvailableNumbers,
  purchaseNumber,
  configureNumberSip,
  releaseNumber,
  getBalance,
};
