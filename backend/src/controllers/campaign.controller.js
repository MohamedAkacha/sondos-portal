// =====================================================
// Campaign Controller — حملات المكالمات الصادرة
// ─────────────────────────────────────────────────────
// CRUD + Start/Pause/Resume + Results
// =====================================================
const Campaign = require('../models/Campaign');
const Agent = require('../models/Agent');
const PhoneNumber = require('../models/PhoneNumber');

// ══════════════════════════════════════════════════════
// POST /api/campaigns — Create campaign
// ══════════════════════════════════════════════════════
exports.createCampaign = async (req, res) => {
  try {
    const { name, description, agentId, phoneNumberId, contacts, schedule, settings } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'اسم الحملة مطلوب' });
    }
    if (!agentId) {
      return res.status(400).json({ success: false, message: 'اختر مساعد للحملة' });
    }
    if (!phoneNumberId) {
      return res.status(400).json({ success: false, message: 'اختر رقم هاتف للحملة' });
    }
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ success: false, message: 'أضف جهة اتصال واحدة على الأقل' });
    }

    // Validate agent
    const agent = await Agent.findOne({ _id: agentId, userId: req.user._id });
    if (!agent) {
      return res.status(404).json({ success: false, message: 'المساعد غير موجود' });
    }
    if (agent.callDirection === 'inbound') {
      return res.status(400).json({ success: false, message: 'هذا المساعد للمكالمات الواردة فقط — غيّر النوع إلى "صادرة" أو "ثنائي"' });
    }

    // Validate phone
    const phone = await PhoneNumber.findOne({ _id: phoneNumberId, userId: req.user._id });
    if (!phone) {
      return res.status(404).json({ success: false, message: 'رقم الهاتف غير موجود' });
    }

    // Normalize contacts
    const normalizedContacts = contacts.map(c => ({
      phone: (c.phone || c.number || '').trim(),
      name: (c.name || '').trim(),
      status: 'pending',
      callResult: null,
      attempts: 0,
    })).filter(c => c.phone);

    if (normalizedContacts.length === 0) {
      return res.status(400).json({ success: false, message: 'لا توجد أرقام صالحة' });
    }

    const campaign = await Campaign.create({
      userId: req.user._id,
      agentId: agent._id,
      phoneNumberId: phone._id,
      name: name.trim(),
      description: description || '',
      contacts: normalizedContacts,
      schedule: {
        startAt: schedule?.startAt || null,
        endAt: schedule?.endAt || null,
        dailyStartHour: schedule?.dailyStartHour ?? 9,
        dailyEndHour: schedule?.dailyEndHour ?? 18,
        timezone: schedule?.timezone || 'Asia/Riyadh',
        activeDays: schedule?.activeDays || [0, 1, 2, 3, 4],
      },
      settings: {
        maxRetries: settings?.maxRetries ?? agent.outboundSettings?.maxRetries ?? 2,
        retryIntervalMinutes: settings?.retryIntervalMinutes ?? agent.outboundSettings?.retryIntervalMinutes ?? 60,
        concurrentCalls: settings?.concurrentCalls ?? 1,
        delayBetweenCallsSeconds: settings?.delayBetweenCallsSeconds ?? 10,
      },
    });

    console.log(`[Campaign Created] "${campaign.name}" — ${normalizedContacts.length} contacts | Agent: ${agent.name} | by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: `تم إنشاء الحملة "${campaign.name}" بـ ${normalizedContacts.length} جهة اتصال`,
      campaign: campaign.toPublicJSON(),
    });
  } catch (error) {
    console.error('[Campaign Create]', error.message);
    res.status(500).json({ success: false, message: 'فشل إنشاء الحملة' });
  }
};

// ══════════════════════════════════════════════════════
// GET /api/campaigns — List campaigns
// ══════════════════════════════════════════════════════
exports.listCampaigns = async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.status) filter.status = req.query.status;

    const campaigns = await Campaign.find(filter)
      .sort({ createdAt: -1 })
      .populate('agentId', 'name avatar')
      .populate('phoneNumberId', 'phoneNumber friendlyName')
      .lean();

    res.json({
      success: true,
      campaigns: campaigns.map(c => ({
        id: c._id,
        name: c.name,
        description: c.description,
        status: c.status,
        agent: c.agentId ? { id: c.agentId._id, name: c.agentId.name, avatar: c.agentId.avatar } : null,
        phone: c.phoneNumberId ? { id: c.phoneNumberId._id, number: c.phoneNumberId.phoneNumber, name: c.phoneNumberId.friendlyName } : null,
        contactsCount: c.contacts?.length || 0,
        results: c.results,
        progress: c.results?.totalContacts ? Math.round(c.results.called / c.results.totalContacts * 100) : 0,
        schedule: c.schedule,
        startedAt: c.startedAt,
        completedAt: c.completedAt,
        createdAt: c.createdAt,
      })),
      total: campaigns.length,
    });
  } catch (error) {
    console.error('[Campaign List]', error.message);
    res.status(500).json({ success: false, message: 'فشل جلب الحملات' });
  }
};

// ══════════════════════════════════════════════════════
// GET /api/campaigns/:id — Get campaign details
// ══════════════════════════════════════════════════════
exports.getCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('agentId', 'name avatar callDirection outboundSettings')
      .populate('phoneNumberId', 'phoneNumber friendlyName provider status');

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'الحملة غير موجودة' });
    }

    res.json({
      success: true,
      campaign: {
        ...campaign.toPublicJSON(),
        agent: campaign.agentId,
        phone: campaign.phoneNumberId,
        contacts: campaign.contacts,
      },
    });
  } catch (error) {
    console.error('[Campaign Get]', error.message);
    res.status(500).json({ success: false, message: 'فشل جلب الحملة' });
  }
};

// ══════════════════════════════════════════════════════
// PUT /api/campaigns/:id — Update campaign (draft only)
// ══════════════════════════════════════════════════════
exports.updateCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'الحملة غير موجودة' });
    }
    if (campaign.status !== 'draft' && campaign.status !== 'paused') {
      return res.status(400).json({ success: false, message: 'لا يمكن تعديل حملة نشطة — أوقفها أولاً' });
    }

    const { name, description, contacts, schedule, settings } = req.body;

    if (name !== undefined) campaign.name = name.trim();
    if (description !== undefined) campaign.description = description;
    if (schedule) Object.assign(campaign.schedule, schedule);
    if (settings) Object.assign(campaign.settings, settings);

    if (contacts && Array.isArray(contacts)) {
      campaign.contacts = contacts.map(c => ({
        phone: (c.phone || c.number || '').trim(),
        name: (c.name || '').trim(),
        status: c.status || 'pending',
        callResult: c.callResult || null,
        attempts: c.attempts || 0,
      })).filter(c => c.phone);
    }

    await campaign.save();

    res.json({
      success: true,
      message: 'تم تحديث الحملة',
      campaign: campaign.toPublicJSON(),
    });
  } catch (error) {
    console.error('[Campaign Update]', error.message);
    res.status(500).json({ success: false, message: 'فشل تحديث الحملة' });
  }
};

// ══════════════════════════════════════════════════════
// DELETE /api/campaigns/:id — Delete campaign
// ══════════════════════════════════════════════════════
exports.deleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'الحملة غير موجودة' });
    }
    if (campaign.status === 'active') {
      return res.status(400).json({ success: false, message: 'لا يمكن حذف حملة نشطة — أوقفها أولاً' });
    }

    await campaign.deleteOne();
    console.log(`[Campaign Deleted] "${campaign.name}" by ${req.user.email}`);

    res.json({ success: true, message: 'تم حذف الحملة' });
  } catch (error) {
    console.error('[Campaign Delete]', error.message);
    res.status(500).json({ success: false, message: 'فشل حذف الحملة' });
  }
};

// ══════════════════════════════════════════════════════
// POST /api/campaigns/:id/start — Start campaign
// ══════════════════════════════════════════════════════
exports.startCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'الحملة غير موجودة' });
    }
    if (campaign.status === 'active') {
      return res.status(400).json({ success: false, message: 'الحملة نشطة بالفعل' });
    }
    if (campaign.status === 'completed') {
      return res.status(400).json({ success: false, message: 'الحملة مكتملة — أنشئ حملة جديدة' });
    }

    // Validate agent still exists and is outbound
    const agent = await Agent.findById(campaign.agentId);
    if (!agent || agent.callDirection === 'inbound') {
      return res.status(400).json({ success: false, message: 'المساعد غير صالح للمكالمات الصادرة' });
    }

    // Validate phone is active
    const phone = await PhoneNumber.findById(campaign.phoneNumberId);
    if (!phone || phone.status !== 'active') {
      return res.status(400).json({ success: false, message: 'رقم الهاتف غير مفعّل' });
    }

    const pendingContacts = campaign.contacts.filter(c => c.status === 'pending' || c.status === 'failed');
    if (pendingContacts.length === 0) {
      return res.status(400).json({ success: false, message: 'لا توجد جهات اتصال معلّقة' });
    }

    campaign.status = 'active';
    if (!campaign.startedAt) campaign.startedAt = new Date();
    campaign.pausedAt = null;
    await campaign.save();

    console.log(`[Campaign Started] "${campaign.name}" — ${pendingContacts.length} pending contacts`);

    res.json({
      success: true,
      message: `تم بدء الحملة — ${pendingContacts.length} جهة اتصال معلّقة`,
      campaign: campaign.toPublicJSON(),
    });
  } catch (error) {
    console.error('[Campaign Start]', error.message);
    res.status(500).json({ success: false, message: 'فشل بدء الحملة' });
  }
};

// ══════════════════════════════════════════════════════
// POST /api/campaigns/:id/pause — Pause campaign
// ══════════════════════════════════════════════════════
exports.pauseCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'الحملة غير موجودة' });
    }
    if (campaign.status !== 'active') {
      return res.status(400).json({ success: false, message: 'الحملة ليست نشطة' });
    }

    campaign.status = 'paused';
    campaign.pausedAt = new Date();
    await campaign.save();

    console.log(`[Campaign Paused] "${campaign.name}"`);

    res.json({
      success: true,
      message: 'تم إيقاف الحملة مؤقتاً',
      campaign: campaign.toPublicJSON(),
    });
  } catch (error) {
    console.error('[Campaign Pause]', error.message);
    res.status(500).json({ success: false, message: 'فشل إيقاف الحملة' });
  }
};

// ══════════════════════════════════════════════════════
// GET /api/campaigns/:id/results — Campaign results
// ══════════════════════════════════════════════════════
exports.getCampaignResults = async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('agentId', 'name avatar')
      .populate('phoneNumberId', 'phoneNumber');

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'الحملة غير موجودة' });
    }

    // Group contacts by result
    const byResult = {};
    for (const c of campaign.contacts) {
      const key = c.callResult || c.status;
      if (!byResult[key]) byResult[key] = [];
      byResult[key].push({
        phone: c.phone,
        name: c.name,
        attempts: c.attempts,
        durationSeconds: c.durationSeconds,
        lastAttemptAt: c.lastAttemptAt,
      });
    }

    res.json({
      success: true,
      campaign: {
        id: campaign._id,
        name: campaign.name,
        status: campaign.status,
        agent: campaign.agentId,
        phone: campaign.phoneNumberId,
      },
      results: campaign.results,
      progress: campaign.progress,
      byResult,
      contacts: campaign.contacts.map(c => ({
        phone: c.phone,
        name: c.name,
        status: c.status,
        callResult: c.callResult,
        attempts: c.attempts,
        durationSeconds: c.durationSeconds,
        lastAttemptAt: c.lastAttemptAt,
        nextRetryAt: c.nextRetryAt,
      })),
    });
  } catch (error) {
    console.error('[Campaign Results]', error.message);
    res.status(500).json({ success: false, message: 'فشل جلب النتائج' });
  }
};
