// =====================================================
// Phone Controller — إدارة أرقام الهاتف
// ─────────────────────────────────────────────────────
// 3 modes: Twilio purchase, Telnyx purchase, Custom SIP
// All modes create LiveKit SIP Trunk + Dispatch Rule
// =====================================================
const PhoneNumber = require('../models/PhoneNumber');
const Agent = require('../models/Agent');
const Subscription = require('../models/Subscription');
const twilio = require('../utils/twilio');
const telnyx = require('../utils/telnyx');
const livekitSip = require('../utils/livekitSip');

// ── Helper: Check phone number limit ──
async function checkPhoneLimit(userId) {
  const subscription = await Subscription.findOne({ user: userId, status: 'active' }).populate('plan');
  const maxPhones = subscription?.plan?.limits?.maxPhoneNumbers || 1;
  const currentCount = await PhoneNumber.countDocuments({ userId });
  return { allowed: currentCount < maxPhones, current: currentCount, max: maxPhones };
}

// ── Helper: Get LiveKit SIP Inbound URI ──
// Priority: LIVEKIT_SIP_URI env var → auto-extract from LIVEKIT_URL
function getSipInboundUri() {
  // 1. Check explicit env var (e.g. "4gz4kilfp9u.sip.livekit.cloud")
  const explicit = process.env.LIVEKIT_SIP_URI || '';
  if (explicit) return explicit;

  // 2. Auto-extract from LIVEKIT_URL (fallback)
  try {
    const livekitUrl = process.env.LIVEKIT_URL || '';
    const urlStr = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
    const parsed = new URL(urlStr);
    const hostParts = parsed.hostname.split('.');
    if (hostParts.length >= 3) {
      return `${hostParts[0]}.sip.livekit.cloud`;
    }
  } catch (e) {
    console.error('[SIP URI] Failed to build:', e.message);
  }
  return '';
}

// ══════════════════════════════════════════════════════
// GET /api/phones — List user's phone numbers
// ══════════════════════════════════════════════════════
exports.listPhones = async (req, res) => {
  try {
    const phones = await PhoneNumber.find({ userId: req.user._id })
      .populate('agentId', 'name avatar status')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      phones: phones.map(p => ({
        id: p._id,
        phoneNumber: p.phoneNumber,
        friendlyName: p.friendlyName,
        country: p.country,
        provider: p.provider,
        status: p.status,
        statusMessage: p.statusMessage,
        // SIP trunk IDs + URI
        sipTrunkId: p.sipTrunkId || '',
        sipOutboundTrunkId: p.sipOutboundTrunkId || '',
        sipDispatchRuleId: p.sipDispatchRuleId || '',
        sipInboundUri: p.sipInboundUri || '',
        agent: p.agentId ? { id: p.agentId._id, name: p.agentId.name, avatar: p.agentId.avatar, status: p.agentId.status } : null,
        settings: p.settings,
        monthlyPrice: p.monthlyPrice,
        currency: p.currency,
        stats: p.stats,
        createdAt: p.createdAt,
      })),
      total: phones.length,
    });
  } catch (error) {
    console.error('[Phones List]', error.message);
    res.status(500).json({ success: false, message: 'فشل جلب الأرقام' });
  }
};

// ══════════════════════════════════════════════════════
// GET /api/phones/:id — Get single phone details
// ══════════════════════════════════════════════════════
exports.getPhone = async (req, res) => {
  try {
    const phone = await PhoneNumber.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('agentId', 'name avatar status');
    if (!phone) {
      return res.status(404).json({ success: false, message: 'الرقم غير موجود' });
    }
    res.json({ success: true, phone: phone.toPublicJSON() });
  } catch (error) {
    console.error('[Phone Get]', error.message);
    res.status(500).json({ success: false, message: 'فشل جلب الرقم' });
  }
};

// ══════════════════════════════════════════════════════
// GET /api/phones/providers — Check which providers are configured
// ══════════════════════════════════════════════════════
exports.getProviders = async (req, res) => {
  try {
    res.json({
      success: true,
      providers: {
        twilio: { available: twilio.isConfigured(), label: 'Twilio' },
        telnyx: { available: telnyx.isConfigured(), label: 'Telnyx' },
        custom: { available: true, label: 'SIP مخصص' },
      },
      livekitSip: livekitSip.isConfigured(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'فشل جلب المزوّدين' });
  }
};

// ══════════════════════════════════════════════════════
// GET /api/phones/sip-info — Get LiveKit SIP URI & Outbound IPs
// ──────────────────────────────────────────────────────
// Returns the SIP inbound URI and outbound IP addresses
// User needs these to configure their SIP provider (e.g. Exacall)
// Matches AutoCalls fields: "Our SIP address" + "Fixed outbound IP"
// ══════════════════════════════════════════════════════
exports.getSipInfo = async (req, res) => {
  try {
    const livekitUrl = process.env.LIVEKIT_URL || '';

    if (!livekitUrl) {
      return res.status(500).json({
        success: false,
        message: 'LiveKit غير مُعد — تواصل مع المدير',
      });
    }

    // ── Get SIP Inbound URI (from env var or auto-extract) ──
    const sipInboundUri = getSipInboundUri();

    // ── Get Outbound IPs ──
    let outboundIps = [];
    let outboundIpNote = '';

    if (livekitSip.isConfigured()) {
      outboundIpNote = 'تحقق من LiveKit Dashboard → SIP → Outbound IPs لمعرفة عناوين IP الصادرة';
    }

    console.log(`[SIP Info] URI: ${sipInboundUri}`);

    res.json({
      success: true,
      sipInboundUri,
      livekitUrl,
      outboundIps,
      outboundIpNote,
      livekitConfigured: livekitSip.isConfigured(),
    });
  } catch (error) {
    console.error('[SIP Info]', error.message);
    res.status(500).json({ success: false, message: 'فشل جلب معلومات SIP' });
  }
};

// ══════════════════════════════════════════════════════
// GET /api/phones/available — Search available numbers to buy
// ══════════════════════════════════════════════════════
exports.searchAvailable = async (req, res) => {
  try {
    const { provider, country, contains, limit } = req.query;

    if (!provider || !country) {
      return res.status(400).json({ success: false, message: 'المزوّد والبلد مطلوبين' });
    }

    let numbers = [];

    if (provider === 'twilio') {
      if (!twilio.isConfigured()) {
        return res.status(400).json({ success: false, message: 'Twilio غير مُعد — أضف TWILIO_ACCOUNT_SID و TWILIO_AUTH_TOKEN' });
      }
      numbers = await twilio.listAvailableNumbers(country, { contains, limit: parseInt(limit) || 10 });
    } else if (provider === 'telnyx') {
      if (!telnyx.isConfigured()) {
        return res.status(400).json({ success: false, message: 'Telnyx غير مُعد — أضف TELNYX_API_KEY' });
      }
      numbers = await telnyx.listAvailableNumbers(country, { contains, limit: parseInt(limit) || 10 });
    } else {
      return res.status(400).json({ success: false, message: 'مزوّد غير مدعوم' });
    }

    res.json({ success: true, numbers, provider, country });
  } catch (error) {
    console.error('[Phones Search]', error.message);
    res.status(500).json({ success: false, message: `فشل البحث: ${error.message}` });
  }
};

// ══════════════════════════════════════════════════════
// POST /api/phones/purchase — Buy a number from Twilio/Telnyx
// ══════════════════════════════════════════════════════
exports.purchaseNumber = async (req, res) => {
  try {
    // Check limit
    const limit = await checkPhoneLimit(req.user._id);
    if (!limit.allowed) {
      return res.status(403).json({
        success: false,
        message: `وصلت الحد الأقصى من الأرقام (${limit.max}). قم بترقية باقتك.`,
      });
    }

    const { provider, phoneNumber, agentId, country } = req.body;

    if (!provider || !phoneNumber) {
      return res.status(400).json({ success: false, message: 'المزوّد ورقم الهاتف مطلوبين' });
    }

    // Verify agent exists and belongs to user
    let agent = null;
    if (agentId) {
      agent = await Agent.findOne({ _id: agentId, userId: req.user._id });
      if (!agent) {
        return res.status(404).json({ success: false, message: 'المساعد غير موجود' });
      }
    }

    // Check if number already exists
    const existing = await PhoneNumber.findOne({ phoneNumber });
    if (existing) {
      return res.status(409).json({ success: false, message: 'هذا الرقم مسجل مسبقاً' });
    }

    // ── Step 1: Purchase from provider ──
    let purchaseResult;
    if (provider === 'twilio') {
      purchaseResult = await twilio.purchaseNumber(phoneNumber);
    } else if (provider === 'telnyx') {
      purchaseResult = await telnyx.purchaseNumber(phoneNumber);
    } else {
      return res.status(400).json({ success: false, message: 'مزوّد غير مدعوم للشراء' });
    }

    // ── Step 2: Create LiveKit SIP Trunk + Dispatch Rule ──
    let sipResult = { sipTrunkId: '', sipDispatchRuleId: '' };
    if (agent && livekitSip.isConfigured()) {
      try {
        sipResult = await livekitSip.setupPhoneNumber({
          phoneNumber,
          agentName: agent.name,
          agentConfig: agent.toLiveKitConfig(),
          userId: req.user._id.toString(),
        });
      } catch (sipErr) {
        console.error('[Phone SIP Setup]', sipErr.message);
        // Don't fail the purchase — SIP can be configured later
      }
    }

    // ── Step 3: Save to database ──
    const phone = await PhoneNumber.create({
      userId: req.user._id,
      agentId: agentId || null,
      phoneNumber,
      friendlyName: purchaseResult.friendlyName || phoneNumber,
      country: country || purchaseResult.country || 'US',
      provider,
      providerNumberSid: purchaseResult.sid || purchaseResult.orderId || '',
      sipTrunkId: sipResult.sipTrunkId,
      sipDispatchRuleId: sipResult.sipDispatchRuleId,
      status: sipResult.sipTrunkId ? 'active' : 'pending',
      statusMessage: sipResult.sipTrunkId ? '' : 'SIP trunk لم يُنشأ بعد',
    });

    console.log(`[Phone Purchased] ${phoneNumber} (${provider}) by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'تم شراء الرقم بنجاح',
      phone: phone.toPublicJSON(),
    });
  } catch (error) {
    console.error('[Phone Purchase]', error.message);
    res.status(500).json({ success: false, message: `فشل شراء الرقم: ${error.message}` });
  }
};

// ══════════════════════════════════════════════════════
// POST /api/phones/custom — Add custom SIP number
// ══════════════════════════════════════════════════════
exports.addCustomNumber = async (req, res) => {
  try {
    const limit = await checkPhoneLimit(req.user._id);
    if (!limit.allowed) {
      return res.status(403).json({
        success: false,
        message: `وصلت الحد الأقصى من الأرقام (${limit.max}).`,
      });
    }

    const {
      phoneNumber, friendlyName, agentId, country,
      // ── Authentication ──
      sipServer, sipPort, sipUsername, sipPassword, sipTransport,
      // ── Outbound Settings (AutoCalls fields) ──
      outboundFixedIp, outboundNumberFormat,
      // ── Inbound Settings (AutoCalls fields) ──
      inboundAuthType, allowedIpAddresses,
    } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'رقم الهاتف مطلوب' });
    }

    // Verify agent
    let agent = null;
    if (agentId) {
      agent = await Agent.findOne({ _id: agentId, userId: req.user._id });
      if (!agent) {
        return res.status(404).json({ success: false, message: 'المساعد غير موجود' });
      }
    }

    // Check duplicate
    const existing = await PhoneNumber.findOne({ phoneNumber });
    if (existing) {
      return res.status(409).json({ success: false, message: 'هذا الرقم مسجل مسبقاً' });
    }

    // ── Build SIP address with port (e.g. "2436.sipgw.exacall.com:5760") ──
    const sipServerClean = (sipServer || '').split(':')[0]; // Remove port if included
    const sipPortNum = sipPort || 5060;
    const sipAddressWithPort = sipServerClean ? `${sipServerClean}:${sipPortNum}` : '';

    // ── Build allowed addresses list ──
    // Use user-provided list (like AutoCalls), or fall back to SIP server address
    const resolvedAllowedAddresses = (allowedIpAddresses && allowedIpAddresses.length > 0)
      ? allowedIpAddresses
      : (sipServerClean ? [sipServerClean] : []);

    // ── Determine inbound auth config ──
    const authType = inboundAuthType || 'ip';
    const inboundAuthUsername = (authType === 'username_password') ? (sipUsername || '') : '';
    const inboundAuthPassword = (authType === 'username_password') ? (sipPassword || '') : '';

    // ── Build LiveKit SIP Inbound URI ──
    const sipInboundUri = getSipInboundUri();

    // ── Create LiveKit SIP Trunks (Inbound + Outbound) ──
    let sipResult = { sipTrunkId: '', sipDispatchRuleId: '', sipOutboundTrunkId: '' };
    if (agent && livekitSip.isConfigured()) {
      try {
        sipResult = await livekitSip.setupPhoneNumber({
          phoneNumber,
          agentName: agent.name,
          agentConfig: agent.toLiveKitConfig(),
          userId: req.user._id.toString(),
          // ── Direction: create both trunks if agent supports outbound ──
          direction: agent.callDirection || 'inbound',
          // ── Outbound SIP address (for Outbound Trunk) ──
          sipAddress: sipAddressWithPort,
          // ── Inbound: allowed addresses or auth ──
          allowedAddresses: (authType === 'ip') ? resolvedAllowedAddresses : [],
          authUsername: sipUsername || '',
          authPassword: sipPassword || '',
        });
      } catch (sipErr) {
        console.error('[Phone Custom SIP Setup]', sipErr.message);
      }
    }

    const phone = await PhoneNumber.create({
      userId: req.user._id,
      agentId: agentId || null,
      phoneNumber,
      friendlyName: friendlyName || phoneNumber,
      country: country || 'SA',
      provider: 'custom',
      customSip: {
        // ── Authentication ──
        sipServer: sipServerClean,
        sipPort: sipPortNum,
        sipUsername: sipUsername || '',
        sipPassword: sipPassword || '',
        sipTransport: sipTransport || 'udp',
        // ── Outbound Settings ──
        outboundFixedIp: outboundFixedIp || false,
        outboundNumberFormat: outboundNumberFormat || 'international_no_plus',
        // ── Inbound Settings ──
        inboundAuthType: authType,
        allowedIpAddresses: resolvedAllowedAddresses,
      },
      // ── LiveKit SIP IDs ──
      sipTrunkId: sipResult.sipTrunkId || '',
      sipDispatchRuleId: sipResult.sipDispatchRuleId || '',
      sipOutboundTrunkId: sipResult.sipOutboundTrunkId || '',
      sipInboundUri,
      // ── Status — active if ANY trunk was created (inbound OR outbound) ──
      status: (sipResult.sipTrunkId || sipResult.sipOutboundTrunkId) ? 'active' : 'pending',
      statusMessage: (sipResult.sipTrunkId || sipResult.sipOutboundTrunkId) ? '' : 'أدخل بيانات SIP وأعد المحاولة',
    });

    // ── Bug fix: Sync agent.phoneNumberId (bidirectional link) ──
    if (agent) {
      agent.phoneNumberId = phone._id;
      await agent.save();
      console.log(`[Phone Custom Added] Synced agent.phoneNumberId → ${phone._id}`);
    }

    console.log(`[Phone Custom Added] ${phoneNumber} by ${req.user.email} | Inbound: ${!!sipResult.sipTrunkId} | Outbound: ${!!sipResult.sipOutboundTrunkId} | URI: ${sipInboundUri}`);

    res.status(201).json({
      success: true,
      message: 'تم إضافة الرقم بنجاح',
      phone: phone.toPublicJSON(),
    });
  } catch (error) {
    console.error('[Phone Custom Add]', error.message);
    res.status(500).json({ success: false, message: `فشل إضافة الرقم: ${error.message}` });
  }
};

// ══════════════════════════════════════════════════════
// PUT /api/phones/:id — Update phone (change agent, settings)
// ══════════════════════════════════════════════════════
exports.updatePhone = async (req, res) => {
  try {
    const phone = await PhoneNumber.findOne({ _id: req.params.id, userId: req.user._id });
    if (!phone) {
      return res.status(404).json({ success: false, message: 'الرقم غير موجود' });
    }

    const { agentId, friendlyName, settings } = req.body;

    // ── Change linked agent ──
    if (agentId !== undefined) {
      if (agentId) {
        const agent = await Agent.findOne({ _id: agentId, userId: req.user._id });
        if (!agent) {
          return res.status(404).json({ success: false, message: 'المساعد غير موجود' });
        }

        phone.agentId = agent._id;

        // ── Bidirectional sync: update agent.phoneNumberId ──
        // Clear old agent's phoneNumberId if phone was linked to another agent
        const oldAgent = await Agent.findOne({ phoneNumberId: phone._id, _id: { $ne: agent._id } });
        if (oldAgent) {
          oldAgent.phoneNumberId = null;
          await oldAgent.save();
        }
        // Set new agent's phoneNumberId
        agent.phoneNumberId = phone._id;
        await agent.save();

        // Update LiveKit SIP dispatch rule with new agent config
        if (phone.sipTrunkId && phone.sipDispatchRuleId && livekitSip.isConfigured()) {
          try {
            // Delete old rule and create new one with updated metadata
            await livekitSip.deleteDispatchRule(phone.sipDispatchRuleId);
            const rule = await livekitSip.createDispatchRule({
              name: `Route ${phone.phoneNumber} → ${agent.name}`,
              trunkIds: [phone.sipTrunkId],
              roomPrefix: 'sondos-sip-',
              metadata: {
                agentConfig: agent.toLiveKitConfig(),
                source: 'sip',
                phoneNumber: phone.phoneNumber,
                userId: req.user._id.toString(),
              },
            });
            phone.sipDispatchRuleId = rule.dispatchRuleId;
            phone.status = 'active';
            phone.statusMessage = '';
          } catch (sipErr) {
            console.error('[Phone Update SIP]', sipErr.message);
            phone.statusMessage = `فشل تحديث SIP: ${sipErr.message}`;
          }
        }
      } else {
        // Unlink agent — clear both directions
        if (phone.agentId) {
          const oldAgent = await Agent.findById(phone.agentId);
          if (oldAgent && oldAgent.phoneNumberId?.toString() === phone._id.toString()) {
            oldAgent.phoneNumberId = null;
            await oldAgent.save();
          }
        }
        phone.agentId = null;
      }
    }

    if (friendlyName !== undefined) phone.friendlyName = friendlyName;
    if (settings) Object.assign(phone.settings, settings);

    await phone.save();

    console.log(`[Phone Updated] ${phone.phoneNumber} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'تم تحديث الرقم بنجاح',
      phone: phone.toPublicJSON(),
    });
  } catch (error) {
    console.error('[Phone Update]', error.message);
    res.status(500).json({ success: false, message: 'فشل تحديث الرقم' });
  }
};

// ══════════════════════════════════════════════════════
// POST /api/phones/:id/setup-sip — Retry SIP setup
// ══════════════════════════════════════════════════════
exports.setupSip = async (req, res) => {
  try {
    const phone = await PhoneNumber.findOne({ _id: req.params.id, userId: req.user._id });
    if (!phone) {
      return res.status(404).json({ success: false, message: 'الرقم غير موجود' });
    }

    if (!phone.agentId) {
      return res.status(400).json({ success: false, message: 'يجب ربط مساعد بالرقم أولاً' });
    }

    if (!livekitSip.isConfigured()) {
      return res.status(500).json({ success: false, message: 'LiveKit SIP غير مُعد' });
    }

    const agent = await Agent.findById(phone.agentId);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'المساعد غير موجود' });
    }

    // Clean up existing SIP resources
    if (phone.sipDispatchRuleId) {
      try { await livekitSip.deleteDispatchRule(phone.sipDispatchRuleId); } catch (e) {}
    }
    if (phone.sipTrunkId) {
      try { await livekitSip.deleteSipTrunk(phone.sipTrunkId); } catch (e) {}
    }
    if (phone.sipOutboundTrunkId) {
      try { await livekitSip.deleteSipTrunk(phone.sipOutboundTrunkId); } catch (e) {}
    }

    // ── Determine SIP address for outbound (with port) ──
    let sipAddress = '';
    if (phone.provider === 'custom' && phone.customSip?.sipServer) {
      const server = phone.customSip.sipServer;
      const port = phone.customSip.sipPort || 5060;
      sipAddress = `${server}:${port}`;
    } else if (phone.provider === 'twilio') {
      sipAddress = `${phone.phoneNumber.replace('+', '')}@${process.env.TWILIO_ACCOUNT_SID}.sip.twilio.com`;
    } else if (phone.provider === 'telnyx') {
      sipAddress = `${phone.phoneNumber.replace('+', '')}@sip.telnyx.com`;
    }

    // ── Determine allowed addresses from saved data (not auto-extracted) ──
    const authType = phone.customSip?.inboundAuthType || 'ip';
    let allowedAddresses = [];
    if (phone.provider === 'custom') {
      if (authType === 'ip') {
        // Use user-provided list, or fall back to SIP server
        allowedAddresses = (phone.customSip?.allowedIpAddresses?.length > 0)
          ? phone.customSip.allowedIpAddresses
          : (phone.customSip?.sipServer ? [phone.customSip.sipServer.split(':')[0]] : []);
      }
      // If username_password, no allowed addresses needed — auth handles it
    }

    // ── Determine inbound auth credentials ──
    const inboundAuthUsername = (authType === 'username_password' && phone.provider === 'custom')
      ? (phone.customSip?.sipUsername || '') : '';
    const inboundAuthPassword = (authType === 'username_password' && phone.provider === 'custom')
      ? phone.getSipPassword() : '';

    // ── Create new SIP setup (direction-aware) ──
    const sipResult = await livekitSip.setupPhoneNumber({
      phoneNumber: phone.phoneNumber,
      agentName: agent.name,
      agentConfig: agent.toLiveKitConfig(),
      userId: phone.userId.toString(),
      direction: agent.callDirection || 'inbound',
      sipAddress,
      allowedAddresses,
      authUsername: phone.provider === 'custom' ? (phone.customSip?.sipUsername || '') : '',
      authPassword: phone.provider === 'custom' ? phone.getSipPassword() : '',
    });

    // ── Build LiveKit SIP Inbound URI ──
    const sipInboundUri = getSipInboundUri();

    // ── Save results ──
    phone.sipTrunkId = sipResult.sipTrunkId || '';
    phone.sipDispatchRuleId = sipResult.sipDispatchRuleId || '';
    phone.sipOutboundTrunkId = sipResult.sipOutboundTrunkId || '';
    phone.sipInboundUri = sipInboundUri;
    phone.status = 'active';
    phone.statusMessage = '';
    await phone.save();

    console.log(`[Phone SIP Setup] ${phone.phoneNumber} → inbound: ${sipResult.sipTrunkId || 'none'} | outbound: ${sipResult.sipOutboundTrunkId || 'none'} | URI: ${sipInboundUri}`);

    res.json({
      success: true,
      message: 'تم إعداد SIP بنجاح — الرقم جاهز لاستقبال وإجراء المكالمات',
      phone: phone.toPublicJSON(),
    });
  } catch (error) {
    console.error('[Phone SIP Setup]', error.message);
    res.status(500).json({ success: false, message: `فشل إعداد SIP: ${error.message}` });
  }
};

// ══════════════════════════════════════════════════════
// DELETE /api/phones/:id — Release/delete a phone number
// ══════════════════════════════════════════════════════
exports.deletePhone = async (req, res) => {
  try {
    const phone = await PhoneNumber.findOne({ _id: req.params.id, userId: req.user._id });
    if (!phone) {
      return res.status(404).json({ success: false, message: 'الرقم غير موجود' });
    }

    // ── Step 1: Delete LiveKit SIP resources ──
    if (livekitSip.isConfigured()) {
      await livekitSip.teardownPhoneNumber(phone.sipTrunkId, phone.sipDispatchRuleId);
    }

    // ── Step 2: Release number from provider ──
    if (phone.provider === 'twilio' && phone.providerNumberSid && twilio.isConfigured()) {
      try {
        await twilio.releaseNumber(phone.providerNumberSid);
      } catch (err) {
        console.error('[Phone Twilio Release]', err.message);
      }
    } else if (phone.provider === 'telnyx' && phone.providerNumberSid && telnyx.isConfigured()) {
      try {
        await telnyx.releaseNumber(phone.providerNumberSid);
      } catch (err) {
        console.error('[Phone Telnyx Release]', err.message);
      }
    }

    // ── Step 3: Delete from database ──
    await phone.deleteOne();

    console.log(`[Phone Deleted] ${phone.phoneNumber} by ${req.user.email}`);

    res.json({ success: true, message: 'تم حذف الرقم بنجاح' });
  } catch (error) {
    console.error('[Phone Delete]', error.message);
    res.status(500).json({ success: false, message: 'فشل حذف الرقم' });
  }
};

// ══════════════════════════════════════════════════════
// GET /api/phones/:id/health — Check SIP health
// ══════════════════════════════════════════════════════
exports.healthCheck = async (req, res) => {
  try {
    const phone = await PhoneNumber.findOne({ _id: req.params.id, userId: req.user._id });
    if (!phone) {
      return res.status(404).json({ success: false, message: 'الرقم غير موجود' });
    }

    const health = {
      hasTrunk: !!phone.sipTrunkId,
      hasRule: !!phone.sipDispatchRuleId,
      hasAgent: !!phone.agentId,
      trunkAlive: false,
      ruleAlive: false,
      overall: 'unknown',
    };

    // If no SIP configured, return early
    if (!phone.sipTrunkId && !phone.sipDispatchRuleId) {
      health.overall = 'not_configured';
      return res.json({ success: true, health });
    }

    // Check LiveKit
    if (!livekitSip.isConfigured()) {
      health.overall = 'livekit_unavailable';
      return res.json({ success: true, health });
    }

    // Check trunk exists on LiveKit
    if (phone.sipTrunkId) {
      try {
        const trunks = await livekitSip.listSipTrunks();
        health.trunkAlive = trunks.some(t =>
          (t.sipTrunkId || t.sip_trunk_id) === phone.sipTrunkId
        );
      } catch (e) {
        console.error('[Health] Trunk check failed:', e.message);
      }
    }

    // Check dispatch rule exists on LiveKit
    if (phone.sipDispatchRuleId) {
      try {
        const rules = await livekitSip.listDispatchRules();
        health.ruleAlive = rules.some(r =>
          (r.sipDispatchRuleId || r.sip_dispatch_rule_id) === phone.sipDispatchRuleId
        );
      } catch (e) {
        console.error('[Health] Rule check failed:', e.message);
      }
    }

    // Determine overall status
    if (health.trunkAlive && health.ruleAlive && health.hasAgent) {
      health.overall = 'healthy';
    } else if (health.trunkAlive && health.ruleAlive && !health.hasAgent) {
      health.overall = 'no_agent';
    } else if (health.trunkAlive && !health.ruleAlive) {
      health.overall = 'rule_missing';
    } else if (!health.trunkAlive) {
      health.overall = 'trunk_missing';
    } else {
      health.overall = 'degraded';
    }

    res.json({ success: true, health });
  } catch (error) {
    console.error('[Phone Health]', error.message);
    res.status(500).json({ success: false, message: 'فشل فحص صحة الرقم' });
  }
};

// ══════════════════════════════════════════════════════
// POST /api/phones/:id/toggle — Enable/Disable phone
// ══════════════════════════════════════════════════════
exports.toggleStatus = async (req, res) => {
  try {
    const phone = await PhoneNumber.findOne({ _id: req.params.id, userId: req.user._id });
    if (!phone) {
      return res.status(404).json({ success: false, message: 'الرقم غير موجود' });
    }

    const isActive = phone.status === 'active';

    if (isActive) {
      // ── DISABLE: delete dispatch rule, keep trunk ──
      if (phone.sipDispatchRuleId && livekitSip.isConfigured()) {
        try {
          await livekitSip.deleteDispatchRule(phone.sipDispatchRuleId);
          console.log(`[Phone Toggle] Dispatch rule removed for ${phone.phoneNumber}`);
        } catch (e) {
          console.error('[Phone Toggle] Failed to delete rule:', e.message);
        }
      }
      phone.sipDispatchRuleId = '';
      phone.status = 'inactive';
      phone.statusMessage = 'تم تعطيل الرقم يدوياً — المكالمات متوقفة';
      await phone.save();

      res.json({
        success: true,
        message: 'تم تعطيل الرقم — المكالمات الواردة متوقفة',
        status: 'inactive',
      });

    } else {
      // ── ENABLE: recreate dispatch rule ──
      if (!phone.agentId) {
        return res.status(400).json({
          success: false,
          message: 'اربط مساعد بالرقم أولاً قبل التفعيل',
        });
      }

      const agent = await Agent.findById(phone.agentId);
      if (!agent) {
        return res.status(400).json({
          success: false,
          message: 'المساعد المربوط غير موجود — اربط مساعد جديد',
        });
      }

      if (!phone.sipTrunkId || !livekitSip.isConfigured()) {
        return res.status(400).json({
          success: false,
          message: 'SIP Trunk غير مُعد — أعد إعداد SIP أولاً',
        });
      }

      try {
        const rule = await livekitSip.createDispatchRule({
          name: `Route ${phone.phoneNumber} → ${agent.name}`,
          trunkIds: [phone.sipTrunkId],
          roomPrefix: 'sondos-sip-',
          metadata: {
            agentConfig: agent.toLiveKitConfig(),
            source: 'sip',
            phoneNumber: phone.phoneNumber,
            userId: phone.userId.toString(),
          },
        });

        phone.sipDispatchRuleId = rule.dispatchRuleId;
        phone.status = 'active';
        phone.statusMessage = '';
        await phone.save();

        res.json({
          success: true,
          message: 'تم تفعيل الرقم — المكالمات الواردة تعمل الآن',
          status: 'active',
        });
      } catch (sipErr) {
        phone.status = 'error';
        phone.statusMessage = `فشل إعادة إنشاء Dispatch Rule: ${sipErr.message}`;
        await phone.save();
        res.status(500).json({ success: false, message: sipErr.message });
      }
    }
  } catch (error) {
    console.error('[Phone Toggle]', error.message);
    res.status(500).json({ success: false, message: 'فشل تغيير حالة الرقم' });
  }
};

// ══════════════════════════════════════════════════════
// POST /api/phones/:id/outbound — Initiate outbound call
// ══════════════════════════════════════════════════════
exports.initiateOutbound = async (req, res) => {
  try {
    const phone = await PhoneNumber.findOne({ _id: req.params.id, userId: req.user._id });
    if (!phone) {
      return res.status(404).json({ success: false, message: 'الرقم غير موجود' });
    }
    if (phone.status !== 'active') {
      return res.status(400).json({ success: false, message: 'الرقم غير مفعّل' });
    }
    if (!phone.agentId) {
      return res.status(400).json({ success: false, message: 'اربط مساعد بالرقم أولاً' });
    }

    const { destination } = req.body;
    if (!destination || !destination.startsWith('+')) {
      return res.status(400).json({ success: false, message: 'أدخل رقم الهاتف بصيغة دولية (مثال: +966501234567)' });
    }

    if (!livekitSip.isConfigured()) {
      return res.status(400).json({ success: false, message: 'LiveKit SIP غير مُعد' });
    }

    // Get agent config
    const agent = await Agent.findById(phone.agentId);
    if (!agent) {
      return res.status(400).json({ success: false, message: 'المساعد المربوط غير موجود' });
    }

    // ── Verify agent supports outbound calls ──
    if (agent.callDirection === 'inbound') {
      return res.status(400).json({
        success: false,
        message: 'المساعد لا يدعم المكالمات الصادرة — غيّر اتجاه المكالمات إلى "صادرة" أو "واردة وصادرة"',
      });
    }

    const agentConfig = agent.toLiveKitConfig();
    const outbound = agent.outboundSettings || {};
    const userId = req.user._id.toString();
    const roomName = `sondos-out-${userId.slice(-6)}-${Date.now().toString(36)}`;

    // ── Step 1: Format destination number based on outboundNumberFormat ──
    const numberFormat = phone.customSip?.outboundNumberFormat || 'international_no_plus';
    let formattedDestination = destination; // Default: keep as-is (+966501234567)

    if (numberFormat === 'international_no_plus') {
      // +966501234567 → 966501234567
      formattedDestination = destination.replace('+', '');
    } else if (numberFormat === 'international_plus') {
      // +966501234567 → +966501234567 (keep as-is)
      formattedDestination = destination;
    } else if (numberFormat === 'national') {
      // +966501234567 → 0501234567 (remove country code, add 0)
      // Handle Saudi (+966) and other country codes
      const withoutPlus = destination.replace('+', '');
      if (withoutPlus.startsWith('966')) {
        formattedDestination = '0' + withoutPlus.slice(3);
      } else if (withoutPlus.startsWith('1') && withoutPlus.length === 11) {
        // US/Canada: +1XXXXXXXXXX → XXXXXXXXXX
        formattedDestination = withoutPlus.slice(1);
      } else {
        // Generic: just remove +
        formattedDestination = withoutPlus;
      }
    }

    // ── Step 2: Determine outbound SIP address based on provider ──
    let sipAddress;
    if (phone.provider === 'twilio') {
      sipAddress = `${phone.phoneNumber.replace('+', '')}@${process.env.TWILIO_ACCOUNT_SID}.sip.twilio.com`;
    } else if (phone.provider === 'telnyx') {
      sipAddress = `${phone.phoneNumber.replace('+', '')}@sip.telnyx.com`;
    } else if (phone.provider === 'custom' && phone.customSip?.sipServer) {
      const server = phone.customSip.sipServer;
      const port = phone.customSip.sipPort || 5060;
      sipAddress = `${server}:${port}`;
    } else {
      return res.status(400).json({ success: false, message: 'لا يمكن تحديد عنوان SIP للمكالمات الصادرة' });
    }

    // ── Step 3: Create or reuse outbound trunk ──
    let outboundTrunkId = phone.sipOutboundTrunkId;
    if (!outboundTrunkId) {
      try {
        const trunk = await livekitSip.createOutboundTrunk({
          name: `Sondos Outbound - ${phone.phoneNumber}`,
          address: sipAddress,
          numbers: [phone.phoneNumber],
          authUsername: phone.provider === 'custom' ? (phone.customSip?.sipUsername || '') : '',
          authPassword: phone.provider === 'custom' ? phone.getSipPassword() : '',
        });
        outboundTrunkId = trunk.sipTrunkId;

        // Save for reuse
        phone.sipOutboundTrunkId = outboundTrunkId;
        await phone.save();
      } catch (trunkErr) {
        return res.status(500).json({ success: false, message: `فشل إنشاء Outbound Trunk: ${trunkErr.message}` });
      }
    }

    // ── Step 4: Create room with outbound-aware metadata ──
    const { RoomServiceClient } = require('livekit-server-sdk');
    const httpUrl = process.env.LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://');
    const roomService = new RoomServiceClient(httpUrl, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);

    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 120,
      maxParticipants: 4,
      metadata: JSON.stringify({
        agentConfig: {
          ...agentConfig,
          // Override greeting with outbound opening message
          greeting: outbound.openingMessage || agentConfig.greeting,
          callDirection: 'outbound',
        },
        userId,
        source: 'outbound',
        direction: 'outbound',
        phoneNumber: phone.phoneNumber,
        destination,
        objective: outbound.objective || '',
      }),
    });

    // ── Step 5: Dial out via SIP (using formatted number) ──
    const sipHost = sipAddress.includes('@') ? sipAddress.split('@')[1] : sipAddress;
    const sipCallTo = `sip:${formattedDestination}@${sipHost}`;

    const sipResult = await livekitSip.createSipParticipant({
      sipTrunkId: outboundTrunkId,
      sipCallTo,
      roomName,
      participantIdentity: `caller-${destination.replace('+', '')}`,
      participantName: destination,
    });

    // ── Step 6: Create call record with direction + destination ──
    const LiveKitCall = require('../models/LiveKitCall');
    await LiveKitCall.create({
      roomName,
      userId: req.user._id,
      agentId: agent._id,
      status: 'active',
      startedAt: new Date(),
      source: 'sip',
      direction: 'outbound',
      phoneNumber: phone.phoneNumber,
      destination,
      agentConfig: agent.toLiveKitConfig(),
      metadata: {
        sipCallId: sipResult.sipCallId,
        objective: outbound.objective || '',
        formattedDestination,
        numberFormat,
      },
    });

    console.log(`[Outbound Call] ${phone.phoneNumber} → ${destination} (formatted: ${formattedDestination}) | Room: ${roomName} | Agent: ${agent.name} | Format: ${numberFormat}`);

    res.json({
      success: true,
      message: `جاري الاتصال بـ ${destination}`,
      roomName,
      sipCallId: sipResult.sipCallId,
    });

  } catch (error) {
    console.error('[Outbound Call]', error.message);
    res.status(500).json({ success: false, message: error.message || 'فشل إجراء المكالمة' });
  }
};