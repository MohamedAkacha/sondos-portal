// =====================================================
// Campaign Runner — محرك تنفيذ حملات المكالمات الصادرة
// ─────────────────────────────────────────────────────
// Polls active campaigns every 30s
// Dials contacts one-by-one with configurable delays
// Updates per-contact results and campaign aggregates
// Handles retries for unanswered calls
// =====================================================
const Campaign = require('../models/Campaign');
const Agent = require('../models/Agent');
const PhoneNumber = require('../models/PhoneNumber');
const LiveKitCall = require('../models/LiveKitCall');
const livekitSip = require('./livekitSip');

const POLL_INTERVAL_MS = 30_000; // Check for work every 30s
let isRunning = false;
let pollTimer = null;

// ══════════════════════════════════════════════════════
// Main Loop
// ══════════════════════════════════════════════════════

async function tick() {
  if (isRunning) return; // Prevent overlapping ticks
  isRunning = true;

  try {
    const campaigns = await Campaign.find({ status: 'active' });
    for (const campaign of campaigns) {
      try {
        await processCampaign(campaign);
      } catch (err) {
        console.error(`[CampaignRunner] Error processing "${campaign.name}":`, err.message);
      }
    }
  } catch (err) {
    console.error('[CampaignRunner] Tick error:', err.message);
  } finally {
    isRunning = false;
  }
}

// ══════════════════════════════════════════════════════
// Process Single Campaign
// ══════════════════════════════════════════════════════

async function processCampaign(campaign) {
  // ── 1. Check schedule ──
  if (!isWithinSchedule(campaign)) return;

  // ── 2. Load agent + phone ──
  const agent = await Agent.findById(campaign.agentId);
  if (!agent || agent.callDirection === 'inbound') {
    campaign.status = 'paused';
    campaign.statusMessage = 'المساعد غير صالح';
    await campaign.save();
    console.log(`[CampaignRunner] Paused "${campaign.name}" — agent invalid`);
    return;
  }

  const phone = await PhoneNumber.findById(campaign.phoneNumberId);
  if (!phone || phone.status !== 'active') {
    campaign.status = 'paused';
    campaign.statusMessage = 'رقم الهاتف غير مفعّل';
    await campaign.save();
    console.log(`[CampaignRunner] Paused "${campaign.name}" — phone inactive`);
    return;
  }

  // ── 3. Check for completed calls and update results ──
  await syncCallResults(campaign);

  // ── 4. Find next contact to dial ──
  const contact = pickNextContact(campaign);
  if (!contact) {
    // Check if all done
    const pending = campaign.contacts.filter(c =>
      c.status === 'pending' || c.status === 'calling'
    );
    if (pending.length === 0) {
      campaign.status = 'completed';
      campaign.completedAt = new Date();
      await campaign.save();
      console.log(`[CampaignRunner] ✅ Campaign "${campaign.name}" completed`);
    }
    return;
  }

  // ── 5. Check concurrent call limit ──
  const activeCalls = campaign.contacts.filter(c => c.status === 'calling').length;
  if (activeCalls >= (campaign.settings.concurrentCalls || 1)) return;

  // ── 6. Dial the contact ──
  await dialContact(campaign, contact, agent, phone);
}

// ══════════════════════════════════════════════════════
// Schedule Check
// ══════════════════════════════════════════════════════

function isWithinSchedule(campaign) {
  const s = campaign.schedule;
  const now = new Date();

  if (s.startAt && now < new Date(s.startAt)) return false;
  if (s.endAt && now > new Date(s.endAt)) return false;

  try {
    const tz = s.timezone || 'Asia/Riyadh';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      weekday: 'short',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const weekday = parts.find(p => p.type === 'weekday')?.value;
    const dayNum = dayMap[weekday] ?? 0;

    if (!s.activeDays?.includes(dayNum)) return false;
    if (hour < (s.dailyStartHour ?? 9)) return false;
    if (hour >= (s.dailyEndHour ?? 18)) return false;
    return true;
  } catch {
    return true; // If timezone calc fails, allow
  }
}

// ══════════════════════════════════════════════════════
// Pick Next Contact
// ══════════════════════════════════════════════════════

function pickNextContact(campaign) {
  const maxRetries = campaign.settings.maxRetries ?? 2;
  const retryInterval = (campaign.settings.retryIntervalMinutes ?? 60) * 60_000;
  const now = Date.now();

  // Priority 1: Pending contacts (never called)
  const pending = campaign.contacts.find(c => c.status === 'pending');
  if (pending) return pending;

  // Priority 2: Failed contacts ready for retry
  const retryable = campaign.contacts.find(c => {
    if (c.status !== 'failed') return false;
    if (c.attempts >= maxRetries + 1) return false; // +1 for initial attempt
    if (c.nextRetryAt && now < new Date(c.nextRetryAt).getTime()) return false;
    return true;
  });

  return retryable || null;
}

// ══════════════════════════════════════════════════════
// Dial a Contact
// ══════════════════════════════════════════════════════

async function dialContact(campaign, contact, agent, phone) {
  const destination = contact.phone;
  if (!destination) return;

  contact.status = 'calling';
  contact.attempts += 1;
  contact.lastAttemptAt = new Date();
  await campaign.save();

  try {
    if (!livekitSip.isConfigured()) {
      throw new Error('LiveKit SIP not configured');
    }

    // ── Determine SIP address ──
    let sipAddress;
    if (phone.provider === 'twilio') {
      sipAddress = `${phone.phoneNumber.replace('+', '')}@${process.env.TWILIO_ACCOUNT_SID}.sip.twilio.com`;
    } else if (phone.provider === 'telnyx') {
      sipAddress = `${phone.phoneNumber.replace('+', '')}@sip.telnyx.com`;
    } else if (phone.provider === 'custom' && phone.customSip?.sipServer) {
      sipAddress = `${phone.phoneNumber.replace('+', '')}@${phone.customSip.sipServer}`;
    } else {
      throw new Error('Cannot determine SIP address');
    }

    // ── Ensure outbound trunk ──
    let outboundTrunkId = phone.sipOutboundTrunkId;
    if (!outboundTrunkId) {
      const trunk = await livekitSip.createOutboundTrunk({
        name: `Sondos Outbound - ${phone.phoneNumber}`,
        address: sipAddress,
        numbers: [phone.phoneNumber],
        authUsername: phone.provider === 'custom' ? (phone.customSip?.sipUsername || '') : '',
        authPassword: phone.provider === 'custom' ? phone.getSipPassword() : '',
      });
      outboundTrunkId = trunk.sipTrunkId;
      phone.sipOutboundTrunkId = outboundTrunkId;
      await phone.save();
    }

    // ── Create room ──
    const { RoomServiceClient } = require('livekit-server-sdk');
    const httpUrl = process.env.LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://');
    const roomService = new RoomServiceClient(httpUrl, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);

    const agentConfig = agent.toLiveKitConfig();
    const outbound = agent.outboundSettings || {};
    const userId = campaign.userId.toString();
    const roomName = `sondos-camp-${campaign._id.toString().slice(-6)}-${Date.now().toString(36)}`;

    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 120,
      maxParticipants: 4,
      metadata: JSON.stringify({
        agentConfig: {
          ...agentConfig,
          greeting: outbound.openingMessage || agentConfig.greeting,
          callDirection: 'outbound',
        },
        userId,
        source: 'outbound',
        direction: 'outbound',
        phoneNumber: phone.phoneNumber,
        destination,
        objective: outbound.objective || '',
        campaignId: campaign._id.toString(),
        contactName: contact.name || '',
      }),
    });

    // ── Dial ──
    const sipResult = await livekitSip.createSipParticipant({
      sipTrunkId: outboundTrunkId,
      sipCallTo: `sip:${destination.replace('+', '')}@${sipAddress.split('@')[1]}`,
      roomName,
      participantIdentity: `caller-${destination.replace('+', '')}`,
      participantName: contact.name || destination,
    });

    // ── Save call record ──
    await LiveKitCall.create({
      roomName,
      userId: campaign.userId,
      agentId: agent._id,
      status: 'active',
      startedAt: new Date(),
      source: 'sip',
      direction: 'outbound',
      phoneNumber: phone.phoneNumber,
      destination,
      agentConfig: agent.toLiveKitConfig(),
      metadata: {
        campaignId: campaign._id.toString(),
        contactId: contact._id.toString(),
        sipCallId: sipResult.sipCallId,
        objective: outbound.objective || '',
      },
    });

    contact.roomName = roomName;
    await campaign.save();

    console.log(`[CampaignRunner] 📞 "${campaign.name}" → ${destination} (attempt ${contact.attempts}) | Room: ${roomName}`);

    // ── Wait before next call ──
    const delay = (campaign.settings.delayBetweenCallsSeconds || 10) * 1000;
    await sleep(delay);

  } catch (err) {
    console.error(`[CampaignRunner] ❌ Dial failed for ${destination}:`, err.message);

    contact.status = 'failed';
    contact.callResult = 'error';
    contact.notes = err.message;

    const retryInterval = (campaign.settings.retryIntervalMinutes ?? 60) * 60_000;
    contact.nextRetryAt = new Date(Date.now() + retryInterval);

    await campaign.save();
    updateCampaignResults(campaign);
    await campaign.save();
  }
}

// ══════════════════════════════════════════════════════
// Sync Call Results (check completed LiveKitCalls)
// ══════════════════════════════════════════════════════

async function syncCallResults(campaign) {
  const callingContacts = campaign.contacts.filter(c => c.status === 'calling' && c.roomName);
  if (callingContacts.length === 0) return;

  let changed = false;

  for (const contact of callingContacts) {
    const call = await LiveKitCall.findOne({ roomName: contact.roomName });
    if (!call) continue;

    if (call.status === 'completed' || call.status === 'failed' || call.status === 'timeout') {
      contact.durationSeconds = call.durationSeconds || 0;

      if (call.callResult) {
        contact.callResult = call.callResult;
        contact.status = 'completed';
      } else if (call.durationSeconds > 5) {
        // Call connected but no explicit result — mark as succeeded
        contact.callResult = 'succeeded';
        contact.status = 'completed';
      } else if (call.status === 'timeout' || call.durationSeconds === 0) {
        // No answer
        contact.callResult = 'no_answer';
        contact.status = 'failed';
        const retryInterval = (campaign.settings.retryIntervalMinutes ?? 60) * 60_000;
        contact.nextRetryAt = new Date(Date.now() + retryInterval);
      } else {
        contact.callResult = 'no_answer';
        contact.status = 'failed';
        const retryInterval = (campaign.settings.retryIntervalMinutes ?? 60) * 60_000;
        contact.nextRetryAt = new Date(Date.now() + retryInterval);
      }

      changed = true;
    }
  }

  if (changed) {
    updateCampaignResults(campaign);
    await campaign.save();
  }
}

// ══════════════════════════════════════════════════════
// Update Aggregate Results
// ══════════════════════════════════════════════════════

function updateCampaignResults(campaign) {
  const contacts = campaign.contacts;
  const completed = contacts.filter(c => c.status === 'completed' || c.status === 'failed' || c.status === 'skipped');

  campaign.results = {
    totalContacts: contacts.length,
    called: completed.length,
    answered: contacts.filter(c => c.durationSeconds > 0).length,
    succeeded: contacts.filter(c => c.callResult === 'succeeded').length,
    refused: contacts.filter(c => c.callResult === 'refused').length,
    callbackRequested: contacts.filter(c => c.callResult === 'callback_requested').length,
    noAnswer: contacts.filter(c => c.callResult === 'no_answer').length,
    errors: contacts.filter(c => c.callResult === 'error').length,
    totalDurationSeconds: contacts.reduce((sum, c) => sum + (c.durationSeconds || 0), 0),
  };
}

// ══════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ══════════════════════════════════════════════════════
// Start / Stop
// ══════════════════════════════════════════════════════

function start() {
  if (pollTimer) return;
  console.log(`[CampaignRunner] ▶ Started — polling every ${POLL_INTERVAL_MS / 1000}s`);
  // Initial tick after 10s (let server warm up)
  setTimeout(() => {
    tick();
    pollTimer = setInterval(tick, POLL_INTERVAL_MS);
  }, 10_000);
}

function stop() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('[CampaignRunner] ⏹ Stopped');
  }
}

module.exports = { start, stop, tick };
