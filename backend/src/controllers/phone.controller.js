// =====================================================
// Phone Controller — إدارة أرقام الهاتف
// ─────────────────────────────────────────────────────
// 3 modes: Twilio purchase, Telnyx purchase, Custom SIP
// All modes create LiveKit SIP Trunk + Dispatch Rule
// =====================================================
const PhoneNumber = require('../models/PhoneNumber');
const Agent = require('../models/Agent');
const twilio = require('../utils/twilio');
const telnyx = require('../utils/telnyx');
const livekitSip = require('../utils/livekitSip');

// ── Helper: Check phone number limit ──
async function checkPhoneLimit(userId) {
  // TODO: Read from user's plan when plan limits are added
  const maxPhones = 5;
  const currentCount = await PhoneNumber.countDocuments({ userId });
  return { allowed: currentCount < maxPhones, current: currentCount, max: maxPhones };
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

    const { phoneNumber, friendlyName, agentId, country, sipServer, sipUsername, sipPassword, sipTransport } = req.body;

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

    // ── Create LiveKit SIP Trunk ──
    let sipResult = { sipTrunkId: '', sipDispatchRuleId: '' };
    if (agent && livekitSip.isConfigured()) {
      try {
        sipResult = await livekitSip.setupPhoneNumber({
          phoneNumber,
          agentName: agent.name,
          agentConfig: agent.toLiveKitConfig(),
          allowedAddresses: sipServer ? [sipServer] : [],
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
        sipServer: sipServer || '',
        sipUsername: sipUsername || '',
        sipPassword: sipPassword || '',
        sipTransport: sipTransport || 'udp',
      },
      sipTrunkId: sipResult.sipTrunkId,
      sipDispatchRuleId: sipResult.sipDispatchRuleId,
      status: sipResult.sipTrunkId ? 'active' : 'pending',
      statusMessage: sipResult.sipTrunkId ? '' : 'أدخل بيانات SIP وأعد المحاولة',
    });

    console.log(`[Phone Custom Added] ${phoneNumber} by ${req.user.email}`);

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
        // Unlink agent
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

    // Create new SIP setup
    const sipResult = await livekitSip.setupPhoneNumber({
      phoneNumber: phone.phoneNumber,
      agentName: agent.name,
      agentConfig: agent.toLiveKitConfig(),
      allowedAddresses: phone.customSip?.sipServer ? [phone.customSip.sipServer] : [],
      authUsername: phone.customSip?.sipUsername || '',
      authPassword: phone.customSip?.sipPassword || '',
    });

    phone.sipTrunkId = sipResult.sipTrunkId;
    phone.sipDispatchRuleId = sipResult.sipDispatchRuleId;
    phone.status = 'active';
    phone.statusMessage = '';
    await phone.save();

    console.log(`[Phone SIP Setup] ${phone.phoneNumber} → trunk: ${sipResult.sipTrunkId}`);

    res.json({
      success: true,
      message: 'تم إعداد SIP بنجاح — الرقم جاهز لاستقبال المكالمات',
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
