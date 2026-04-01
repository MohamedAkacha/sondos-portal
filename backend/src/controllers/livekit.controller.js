// =====================================================
// LiveKit Controller — Full Feature Set (v2)
// ─────────────────────────────────────────────────────
// 1. Token generation + Room metadata (dynamic config)
// 2. Webhook receiver (room/participant events)
// 3. Agent transcript endpoint (internal auth)
// 4. Room management (admin: list/kick/delete)
// 5. Call records API (list/get/stats)
// =====================================================
const {
  AccessToken,
  WebhookReceiver,
  RoomServiceClient,
} = require('livekit-server-sdk');
const crypto = require('crypto');
const LiveKitCall = require('../models/LiveKitCall');
const Agent = require('../models/Agent');
const PhoneNumber = require('../models/PhoneNumber');

const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const AGENT_SECRET = process.env.SONDOS_AGENT_SECRET || '';

// ── Service clients ──
let webhookReceiver = null;
let roomService = null;

if (LIVEKIT_API_KEY && LIVEKIT_API_SECRET) {
  webhookReceiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

  // RoomServiceClient needs HTTP URL
  const httpUrl = LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://');
  roomService = new RoomServiceClient(httpUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}


// ╔══════════════════════════════════════════════════════════╗
// ║  1. TOKEN GENERATION + ROOM METADATA                     ║
// ╚══════════════════════════════════════════════════════════╝

// POST /api/livekit/token
exports.generateToken = async (req, res) => {
  try {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(500).json({ success: false, message: 'LiveKit غير مُعد — تواصل مع المدير' });
    }

    const userId = req.user._id.toString();
    const userName = req.user.name || 'مستخدم';

    const roomName = req.body.roomName
      || `sondos-test-${userId.slice(-6)}-${crypto.randomBytes(3).toString('hex')}`;

    // ── Agent config: from agentId (DB) or from request body (manual) ──
    // If agentId is provided, load DB config as base then apply any
    // overrides from the request body (so TestAgentPage edits take effect).
    let agentConfig;
    let agentId = req.body.agentId || null;

    // Fields that can be overridden from the request body
    const overrideFields = [
      'sttProvider', 'sttModel', 'sttLanguage',
      'llmModel', 'llmTemperature',
      'ttsProvider', 'ttsModel', 'ttsVoice',
      'systemPrompt', 'greeting',
    ];

    if (agentId) {
      // Load config from Agent model as the base
      const agent = await Agent.findOne({ _id: agentId, userId: req.user._id });
      if (!agent) {
        return res.status(404).json({ success: false, message: 'المساعد غير موجود' });
      }
      agentConfig = agent.toLiveKitConfig();

      // Apply overrides from request body (TestAgentPage sends modified values)
      for (const field of overrideFields) {
        if (req.body[field] !== undefined && req.body[field] !== null && req.body[field] !== '') {
          agentConfig[field] = req.body[field];
        }
      }

      const hasOverrides = overrideFields.some(f => req.body[f] !== undefined && req.body[f] !== null && req.body[f] !== '');
      console.log(`[LiveKit] Config loaded from Agent: ${agent.name} (${agentId})${hasOverrides ? ' + overrides from request' : ''}`);
    } else {
      // Manual config from request body (backwards compatible)
      agentConfig = {
        sttProvider:    req.body.sttProvider,
        sttModel:       req.body.sttModel,
        sttLanguage:    req.body.sttLanguage,
        llmModel:       req.body.llmModel,
        llmTemperature: req.body.llmTemperature,
        ttsProvider:    req.body.ttsProvider,
        ttsModel:       req.body.ttsModel,
        ttsVoice:       req.body.ttsVoice,
        systemPrompt:   req.body.systemPrompt,
        greeting:       req.body.greeting,
      };
    }

    // ── Validate required fields ──
    const requiredFields = ['systemPrompt', 'greeting', 'llmModel', 'ttsVoice'];
    const missingFields = requiredFields.filter(f => !agentConfig[f]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `حقول مطلوبة ناقصة: ${missingFields.join(', ')}`,
      });
    }

    // ── Create room with metadata so agent can read config (Step 8) ──
    if (roomService) {
      try {
        await roomService.createRoom({
          name: roomName,
          emptyTimeout: 300, // 5 min empty timeout
          metadata: JSON.stringify({ agentConfig, userId, userName }),
        });
        console.log(`[LiveKit] Room created with metadata: ${roomName}`);
      } catch (roomErr) {
        // Room might already exist — that's fine
        console.warn(`[LiveKit] Room create warning: ${roomErr.message}`);
      }
    }

    // ── Generate access token ──
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: userId,
      name: userName,
      ttl: 30 * 60,
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    // ── Save call record ──
    let callRecord = null;
    try {
      callRecord = await LiveKitCall.create({
        roomName,
        userId: req.user._id,
        status: 'created',
        agentConfig,
        agentId: agentId || undefined,
      });
    } catch (dbErr) {
      console.warn('[LiveKit] Failed to create call record:', dbErr.message);
    }

    console.log(`[LiveKit] Token generated for ${userName} (${userId}) → room: ${roomName}`);

    res.json({
      success: true,
      token: jwt,
      roomName,
      callId: callRecord?._id || null,
      livekitUrl: LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://'),
      wsUrl: LIVEKIT_URL,
    });
  } catch (error) {
    console.error('[LiveKit Token]', error.message);
    res.status(500).json({ success: false, message: 'فشل إنشاء رمز الاتصال' });
  }
};

// GET /api/livekit/status
exports.getStatus = async (req, res) => {
  res.json({
    success: true,
    configured: !!(LIVEKIT_API_KEY && LIVEKIT_API_SECRET),
    url: LIVEKIT_URL,
  });
};


// ╔══════════════════════════════════════════════════════════╗
// ║  2. WEBHOOK — LiveKit Cloud Events                       ║
// ╚══════════════════════════════════════════════════════════╝

// POST /api/livekit/webhook
exports.webhook = async (req, res) => {
  try {
    let event;

    if (webhookReceiver) {
      const rawBody = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      const authHeader = req.get('Authorization') || '';
      try {
        event = await webhookReceiver.receive(rawBody, authHeader);
      } catch (verifyErr) {
        console.error('[LiveKit Webhook] Signature failed:', verifyErr.message);
        return res.status(401).json({ success: false, message: 'Invalid signature' });
      }
    } else {
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }

    if (!event || !event.event) {
      return res.status(400).json({ success: false, message: 'Invalid event' });
    }

    const eventType = event.event;
    const room = event.room;
    const participant = event.participant;

    console.log(`[LiveKit Webhook] 📩 ${eventType} | Room: ${room?.name || 'N/A'}`);

    switch (eventType) {
      case 'room_started': {
        const roomName = room?.name;
        if (!roomName) break;

        // Extract userId from room metadata (set by dispatch rule or token endpoint)
        let userId = null;
        let source = 'web';
        let phoneNumber = null;
        let direction = 'inbound';
        let destination = null;
        let campaignId = null;
        let contactId = null;
        try {
          const meta = room.metadata ? JSON.parse(room.metadata) : {};
          userId = meta.userId || null;
          source = meta.source || 'web';
          phoneNumber = meta.phoneNumber || null;
          direction = meta.source === 'outbound' ? 'outbound' : roomName.startsWith('sondos-out-') || roomName.startsWith('sondos-camp-') ? 'outbound' : 'inbound';
          destination = meta.destination || null;
          campaignId = meta.campaignId || null;
          contactId = meta.contactId || null;
        } catch (e) { /* metadata not JSON, ignore */ }

        const updateFields = {
          roomSid: room.sid || '',
          status: 'active',
          startedAt: new Date(),
          ...(userId && { userId }),
          ...(source && { source }),
          ...(phoneNumber && { phoneNumber }),
          direction,
          ...(destination && { destination }),
          ...(campaignId && { metadata: { campaignId, contactId } }),
        };

        const callRecord = await LiveKitCall.findOneAndUpdate(
          { roomName, status: 'created' },
          { $set: updateFields },
          { new: true }
        );
        if (!callRecord) {
          await LiveKitCall.create({ roomName, ...updateFields });
        }

        if (source === 'sip') {
          console.log(`[LiveKit Webhook] 📞 SIP call started → ${roomName} | User: ${userId || 'unknown'} | Phone: ${phoneNumber || 'unknown'}`);
        }
        break;
      }

      case 'room_finished': {
        const roomName = room?.name;
        if (!roomName) break;
        const callRecord = await LiveKitCall.findOne({
          $or: [
            { roomName, status: 'active' },
            { roomName, status: 'created' },
          ],
        });
        if (callRecord) {
          const endedAt = new Date();
          const startedAt = callRecord.startedAt || callRecord.createdAt;
          callRecord.status = 'completed';
          callRecord.endedAt = endedAt;
          callRecord.durationSeconds = Math.round((endedAt - startedAt) / 1000);
          callRecord.roomSid = room.sid || callRecord.roomSid;
          await callRecord.save();
          console.log(`[LiveKit Webhook] ✅ Room finished → ${roomName} | ${callRecord.durationSeconds}s`);

          // ── Update Agent & PhoneNumber stats ──
          const duration = callRecord.durationSeconds || 0;
          let meta = {};
          try { meta = room.metadata ? JSON.parse(room.metadata) : {}; } catch (e) {}

          // Update Agent stats
          const agentId = callRecord.agentId || meta.agentConfig?.agentId;
          if (agentId) {
            try {
              await Agent.findByIdAndUpdate(agentId, {
                $inc: { 'stats.totalCalls': 1, 'stats.totalDurationSeconds': duration },
                $set: { 'stats.lastCallAt': endedAt },
              });
            } catch (e) { console.error('[Stats] Agent update failed:', e.message); }
          }

          // Update PhoneNumber stats (SIP calls only)
          const phoneNumber = callRecord.phoneNumber || meta.phoneNumber;
          if (phoneNumber) {
            try {
              await PhoneNumber.findOneAndUpdate(
                { phoneNumber },
                {
                  $inc: { 'stats.totalCalls': 1, 'stats.totalDurationSeconds': duration },
                  $set: { 'stats.lastCallAt': endedAt },
                },
              );
            } catch (e) { console.error('[Stats] PhoneNumber update failed:', e.message); }
          }
        }
        break;
      }

      case 'participant_joined': {
        const roomName = room?.name;
        if (!roomName || !participant) break;
        const identity = participant.identity || '';
        const name = participant.name || identity;
        const isAgent = !identity.match(/^[a-f0-9]{24}$/);
        const updateData = {
          $push: { participants: { identity, name, joinedAt: new Date(), isAgent } },
        };
        if (isAgent) updateData.$set = { agentJoined: true };
        await LiveKitCall.findOneAndUpdate(
          { roomName, status: { $in: ['created', 'active'] } },
          updateData
        );
        console.log(`[LiveKit Webhook] 👤 Joined: ${name} → ${roomName} ${isAgent ? '[AGENT]' : '[USER]'}`);
        break;
      }

      case 'participant_left': {
        const roomName = room?.name;
        if (!roomName || !participant) break;
        await LiveKitCall.findOneAndUpdate(
          { roomName, status: { $in: ['created', 'active'] }, 'participants.identity': participant.identity },
          { $set: { 'participants.$.leftAt': new Date() } }
        );
        break;
      }

      default:
        console.log(`[LiveKit Webhook] ℹ️ Unhandled: ${eventType}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[LiveKit Webhook] ❌', error.message);
    res.status(200).json({ success: true });
  }
};


// ╔══════════════════════════════════════════════════════════╗
// ║  3. AGENT TRANSCRIPT — Internal Auth (X-Agent-Secret)    ║
// ╚══════════════════════════════════════════════════════════╝

// POST /api/livekit/agent/transcript
exports.agentTranscript = async (req, res) => {
  try {
    const { roomName, entries } = req.body;

    if (!roomName || !entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, message: 'roomName and entries required' });
    }

    // Find call record by room name
    const callRecord = await LiveKitCall.findOne({
      roomName,
      status: { $in: ['created', 'active', 'completed'] },
    }).sort({ createdAt: -1 });

    if (!callRecord) {
      return res.status(404).json({ success: false, message: 'Call record not found' });
    }

    // Append transcript entries
    callRecord.transcript.push(
      ...entries.map(e => ({
        speaker: e.speaker || 'system',
        text: e.text || '',
        timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
      }))
    );

    await callRecord.save();

    console.log(`[LiveKit Agent] ✅ Transcript saved: ${entries.length} entries → ${roomName}`);

    res.json({
      success: true,
      message: `Saved ${entries.length} entries`,
      totalEntries: callRecord.transcript.length,
    });
  } catch (error) {
    console.error('[LiveKit Agent Transcript]', error.message);
    res.status(500).json({ success: false, message: 'Failed to save transcript' });
  }
};


// POST /api/livekit/agent/call-result
exports.agentCallResult = async (req, res) => {
  try {
    const { roomName, callResult } = req.body;

    if (!roomName || !callResult) {
      return res.status(400).json({ success: false, message: 'roomName and callResult required' });
    }

    const validResults = ['succeeded', 'refused', 'callback_requested', 'no_answer', 'error'];
    if (!validResults.includes(callResult)) {
      return res.status(400).json({ success: false, message: `Invalid callResult. Must be one of: ${validResults.join(', ')}` });
    }

    // Find call record
    const callRecord = await LiveKitCall.findOne({
      roomName,
      status: { $in: ['created', 'active', 'completed'] },
    }).sort({ createdAt: -1 });

    if (!callRecord) {
      return res.status(404).json({ success: false, message: 'Call record not found' });
    }

    callRecord.callResult = callResult;
    await callRecord.save();

    // ── If this call is part of a campaign, update the contact ──
    const campaignId = callRecord.metadata?.campaignId;
    if (campaignId) {
      try {
        const Campaign = require('../models/Campaign');
        const campaign = await Campaign.findById(campaignId);
        if (campaign) {
          const contact = campaign.contacts.find(c => c.roomName === roomName);
          if (contact) {
            contact.callResult = callResult;
            contact.status = callResult === 'no_answer' ? 'failed' : 'completed';
            contact.durationSeconds = callRecord.durationSeconds || 0;

            if (callResult === 'no_answer' || callResult === 'error') {
              const retryInterval = (campaign.settings.retryIntervalMinutes ?? 60) * 60_000;
              contact.nextRetryAt = new Date(Date.now() + retryInterval);
            }

            // Update aggregate results
            const contacts = campaign.contacts;
            const done = contacts.filter(c => c.status === 'completed' || c.status === 'failed' || c.status === 'skipped');
            campaign.results = {
              totalContacts: contacts.length,
              called: done.length,
              answered: contacts.filter(c => c.durationSeconds > 0).length,
              succeeded: contacts.filter(c => c.callResult === 'succeeded').length,
              refused: contacts.filter(c => c.callResult === 'refused').length,
              callbackRequested: contacts.filter(c => c.callResult === 'callback_requested').length,
              noAnswer: contacts.filter(c => c.callResult === 'no_answer').length,
              errors: contacts.filter(c => c.callResult === 'error').length,
              totalDurationSeconds: contacts.reduce((sum, c) => sum + (c.durationSeconds || 0), 0),
            };

            // Check if campaign is complete
            const pending = contacts.filter(c => c.status === 'pending' || c.status === 'calling');
            const retriable = contacts.filter(c =>
              c.status === 'failed' &&
              c.attempts < (campaign.settings.maxRetries ?? 2) + 1
            );
            if (pending.length === 0 && retriable.length === 0) {
              campaign.status = 'completed';
              campaign.completedAt = new Date();
            }

            await campaign.save();
            console.log(`[Agent Call Result] Campaign "${campaign.name}" updated: ${callResult} for ${contact.phone}`);
          }
        }
      } catch (campErr) {
        console.error('[Agent Call Result] Campaign update failed:', campErr.message);
      }
    }

    console.log(`[Agent Call Result] ✅ ${callResult} → ${roomName}`);

    res.json({
      success: true,
      message: `Call result saved: ${callResult}`,
    });
  } catch (error) {
    console.error('[Agent Call Result]', error.message);
    res.status(500).json({ success: false, message: 'Failed to save call result' });
  }
};


// ╔══════════════════════════════════════════════════════════╗
// ║  4. ROOM MANAGEMENT — Admin Only                         ║
// ╚══════════════════════════════════════════════════════════╝

// GET /api/livekit/admin/rooms
exports.listActiveRooms = async (req, res) => {
  try {
    if (!roomService) {
      return res.status(500).json({ success: false, message: 'LiveKit غير مُعد' });
    }

    const rooms = await roomService.listRooms();

    res.json({
      success: true,
      rooms: rooms.map(r => ({
        name: r.name,
        sid: r.sid,
        numParticipants: r.numParticipants,
        maxParticipants: r.maxParticipants,
        creationTime: r.creationTime ? new Date(Number(r.creationTime) * 1000).toISOString() : null,
        metadata: r.metadata || '',
      })),
      total: rooms.length,
    });
  } catch (error) {
    console.error('[LiveKit Rooms]', error.message);
    res.status(500).json({ success: false, message: 'فشل جلب الغرف' });
  }
};

// GET /api/livekit/admin/rooms/:roomName/participants
exports.listParticipants = async (req, res) => {
  try {
    if (!roomService) {
      return res.status(500).json({ success: false, message: 'LiveKit غير مُعد' });
    }

    const participants = await roomService.listParticipants(req.params.roomName);

    res.json({
      success: true,
      participants: participants.map(p => ({
        identity: p.identity,
        name: p.name,
        sid: p.sid,
        state: p.state,
        joinedAt: p.joinedAt ? new Date(Number(p.joinedAt) * 1000).toISOString() : null,
        metadata: p.metadata || '',
      })),
    });
  } catch (error) {
    console.error('[LiveKit Participants]', error.message);
    res.status(500).json({ success: false, message: 'فشل جلب المشاركين' });
  }
};

// DELETE /api/livekit/admin/rooms/:roomName
exports.deleteRoom = async (req, res) => {
  try {
    if (!roomService) {
      return res.status(500).json({ success: false, message: 'LiveKit غير مُعد' });
    }

    await roomService.deleteRoom(req.params.roomName);

    console.log(`[LiveKit Admin] 🗑️ Room deleted: ${req.params.roomName}`);

    res.json({ success: true, message: 'تم حذف الغرفة' });
  } catch (error) {
    console.error('[LiveKit Delete Room]', error.message);
    res.status(500).json({ success: false, message: 'فشل حذف الغرفة' });
  }
};

// POST /api/livekit/admin/rooms/:roomName/kick
exports.kickParticipant = async (req, res) => {
  try {
    if (!roomService) {
      return res.status(500).json({ success: false, message: 'LiveKit غير مُعد' });
    }

    const { identity } = req.body;
    if (!identity) {
      return res.status(400).json({ success: false, message: 'identity مطلوب' });
    }

    await roomService.removeParticipant(req.params.roomName, identity);

    console.log(`[LiveKit Admin] 🚫 Kicked ${identity} from ${req.params.roomName}`);

    res.json({ success: true, message: 'تم طرد المشارك' });
  } catch (error) {
    console.error('[LiveKit Kick]', error.message);
    res.status(500).json({ success: false, message: 'فشل طرد المشارك' });
  }
};


// ╔══════════════════════════════════════════════════════════╗
// ║  5. CALL RECORDS — List / Get / Stats / Transcript       ║
// ╚══════════════════════════════════════════════════════════╝

// POST /api/livekit/calls/:callId/transcript (user auth)
exports.saveTranscript = async (req, res) => {
  try {
    const { callId } = req.params;
    const { entries } = req.body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, message: 'لا توجد بيانات نص للحفظ' });
    }

    const callRecord = await LiveKitCall.findById(callId);
    if (!callRecord) {
      return res.status(404).json({ success: false, message: 'سجل المكالمة غير موجود' });
    }

    if (req.user.role !== 'admin' && callRecord.userId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'غير مصرح' });
    }

    callRecord.transcript.push(
      ...entries.map(e => ({
        speaker: e.speaker || 'system',
        text: e.text || '',
        timestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
      }))
    );
    await callRecord.save();

    res.json({ success: true, message: `تم حفظ ${entries.length} رسالة`, totalEntries: callRecord.transcript.length });
  } catch (error) {
    console.error('[LiveKit Transcript]', error.message);
    res.status(500).json({ success: false, message: 'فشل حفظ النص' });
  }
};

// GET /api/livekit/calls
exports.listCalls = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const filter = {};

    if (req.user.role !== 'admin') filter.userId = req.user._id;
    else if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.phoneNumber) filter.phoneNumber = req.query.phoneNumber;
    if (req.query.source) filter.source = req.query.source;
    if (req.query.direction) filter.direction = req.query.direction;

    const [calls, total] = await Promise.all([
      LiveKitCall.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('userId', 'name email').lean(),
      LiveKitCall.countDocuments(filter),
    ]);

    res.json({ success: true, calls, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('[LiveKit Calls]', error.message);
    res.status(500).json({ success: false, message: 'فشل جلب سجلات المكالمات' });
  }
};

// GET /api/livekit/calls/stats/summary
exports.getCallStats = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== 'admin') filter.userId = req.user._id;

    const [totalCalls, completedCalls, activeCalls, avgDuration] = await Promise.all([
      LiveKitCall.countDocuments(filter),
      LiveKitCall.countDocuments({ ...filter, status: 'completed' }),
      LiveKitCall.countDocuments({ ...filter, status: 'active' }),
      LiveKitCall.aggregate([
        { $match: { ...filter, status: 'completed', durationSeconds: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: '$durationSeconds' } } },
      ]),
    ]);

    res.json({
      success: true,
      stats: { totalCalls, completedCalls, activeCalls, avgDurationSeconds: Math.round(avgDuration[0]?.avg || 0) },
    });
  } catch (error) {
    console.error('[LiveKit Stats]', error.message);
    res.status(500).json({ success: false, message: 'فشل جلب الإحصائيات' });
  }
};

// GET /api/livekit/calls/:callId
exports.getCall = async (req, res) => {
  try {
    const call = await LiveKitCall.findById(req.params.callId).populate('userId', 'name email').lean();
    if (!call) return res.status(404).json({ success: false, message: 'سجل المكالمة غير موجود' });
    if (req.user.role !== 'admin' && call.userId?._id?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'غير مصرح' });
    }
    res.json({ success: true, call });
  } catch (error) {
    console.error('[LiveKit Call]', error.message);
    res.status(500).json({ success: false, message: 'فشل جلب تفاصيل المكالمة' });
  }
};