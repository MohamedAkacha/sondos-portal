// =====================================================
// Agent Controller — إدارة المساعدين الأذكياء
// ─────────────────────────────────────────────────────
// CRUD + Chat Test + Templates + Suggest
// =====================================================
const Agent = require('../models/Agent');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const { agentTemplates } = require('../data/agentTemplates');
const PhoneNumber = require('../models/PhoneNumber');
const livekitSip = require('../utils/livekitSip');

// ── Helper: Check agent limit for user's plan ──
async function checkAgentLimit(userId) {
  const subscription = await Subscription.findOne({ user: userId, status: 'active' }).populate('plan');
  const maxAgents = subscription?.plan?.limits?.maxAgents || 1;
  const currentCount = await Agent.countDocuments({ userId });
  return { allowed: currentCount < maxAgents, current: currentCount, max: maxAgents };
}

// ══════════════════════════════════════════════════════
// GET /api/agents — List user's agents
// ══════════════════════════════════════════════════════
exports.listAgents = async (req, res) => {
  try {
    const agents = await Agent.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      agents: agents.map(a => ({
        id: a._id,
        name: a.name,
        description: a.description,
        avatar: a.avatar,
        status: a.status,
        language: a.language,
        personality: a.personality,
        voice: a.voice,
        stats: a.stats,
        createdAt: a.createdAt,
      })),
      total: agents.length,
    });
  } catch (error) {
    console.error('[Agents List]', error.message);
    res.status(500).json({ success: false, message: 'فشل جلب المساعدين' });
  }
};

// ══════════════════════════════════════════════════════
// GET /api/agents/templates — Get available templates
// ══════════════════════════════════════════════════════
exports.getTemplates = async (req, res) => {
  try {
    res.json({ success: true, templates: agentTemplates });
  } catch (error) {
    res.status(500).json({ success: false, message: 'فشل جلب القوالب' });
  }
};

// ══════════════════════════════════════════════════════
// GET /api/agents/:id — Get single agent details
// ══════════════════════════════════════════════════════
exports.getAgent = async (req, res) => {
  try {
    const agent = await Agent.findOne({ _id: req.params.id, userId: req.user._id });
    if (!agent) {
      return res.status(404).json({ success: false, message: 'المساعد غير موجود' });
    }
    res.json({ success: true, agent: agent.toPublicJSON() });
  } catch (error) {
    console.error('[Agent Get]', error.message);
    res.status(500).json({ success: false, message: 'فشل جلب المساعد' });
  }
};

// ══════════════════════════════════════════════════════
// POST /api/agents — Create new agent
// ══════════════════════════════════════════════════════
exports.createAgent = async (req, res) => {
  try {
    // Check plan limit
    const limit = await checkAgentLimit(req.user._id);
    if (!limit.allowed) {
      return res.status(403).json({
        success: false,
        message: `وصلت الحد الأقصى من المساعدين (${limit.max}). قم بترقية باقتك لإضافة المزيد.`,
      });
    }

    const {
      name, description, avatar, templateId,
      personality, language, greeting,
      systemPrompt, useCustomPrompt,
      voice, llm, stt,
      workingHours, maxCallDuration,
    } = req.body;

    // If creating from template, merge template defaults
    let defaults = {};
    if (templateId) {
      const template = agentTemplates.find(t => t.id === templateId);
      if (template) {
        defaults = {
          personality: template.personality,
          language: template.language,
          greeting: template.greeting,
          voice: template.voice,
          llm: template.llm,
          templateId: template.id,
        };
      }
    }

    const agent = await Agent.create({
      userId: req.user._id,
      name: name || defaults.name || 'مساعد جديد',
      description: description || '',
      avatar: avatar || '🤖',
      personality: personality || defaults.personality,
      language: language || defaults.language || 'ar',
      greeting: greeting || defaults.greeting || 'أهلاً وسهلاً، كيف أقدر أساعدك؟',
      systemPrompt: systemPrompt || '',
      useCustomPrompt: useCustomPrompt || false,
      voice: voice || defaults.voice,
      llm: llm || defaults.llm,
      stt: stt,
      workingHours: workingHours,
      maxCallDuration: maxCallDuration || 300,
      templateId: templateId || null,
    });

    console.log(`[Agent Created] ${agent.name} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء المساعد بنجاح',
      agent: agent.toPublicJSON(),
    });
  } catch (error) {
    console.error('[Agent Create]', error.message);
    res.status(500).json({ success: false, message: 'فشل إنشاء المساعد' });
  }
};

// ══════════════════════════════════════════════════════
// PUT /api/agents/:id — Update agent
// ══════════════════════════════════════════════════════
exports.updateAgent = async (req, res) => {
  try {
    const agent = await Agent.findOne({ _id: req.params.id, userId: req.user._id });
    if (!agent) {
      return res.status(404).json({ success: false, message: 'المساعد غير موجود' });
    }

    // Allowed fields to update
    const allowedFields = [
      'name', 'description', 'avatar', 'status',
      'personality', 'language', 'greeting',
      'systemPrompt', 'useCustomPrompt',
      'voice', 'llm', 'stt',
      'workingHours', 'maxCallDuration',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] === 'object' && !Array.isArray(req.body[field]) && agent[field]) {
          // Merge nested objects (personality, voice, llm, stt, workingHours)
          Object.assign(agent[field], req.body[field]);
          agent.markModified(field);
        } else {
          agent[field] = req.body[field];
        }
      }
    }

    await agent.save();

    // ── Sync linked phones when agent STATUS changes ──
    const statusChanged = req.body.status !== undefined;
    if (statusChanged && livekitSip.isConfigured()) {
      try {
        const linkedPhones = await PhoneNumber.find({
          agentId: agent._id,
          sipTrunkId: { $ne: '' },
        });

        if (linkedPhones.length > 0) {
          if (agent.status === 'inactive' || agent.status === 'draft') {
            // ── Agent DISABLED → remove dispatch rules from all linked phones ──
            let disabledCount = 0;
            for (const phone of linkedPhones) {
              if (phone.sipDispatchRuleId) {
                try {
                  await livekitSip.deleteDispatchRule(phone.sipDispatchRuleId);
                } catch (e) {
                  console.error(`[Agent Status Sync] Rule delete failed for ${phone.phoneNumber}:`, e.message);
                }
              }
              phone.sipDispatchRuleId = '';
              phone.status = 'inactive';
              phone.statusMessage = `المساعد "${agent.name}" تم تعطيله — المكالمات متوقفة`;
              await phone.save();
              disabledCount++;
            }
            console.log(`[Agent Status Sync] Agent disabled → ${disabledCount} phone(s) disabled`);

          } else if (agent.status === 'active') {
            // ── Agent RE-ENABLED → recreate dispatch rules for inactive phones ──
            const agentConfig = agent.toLiveKitConfig();
            let enabledCount = 0;
            for (const phone of linkedPhones) {
              if (phone.status === 'inactive' && !phone.sipDispatchRuleId) {
                try {
                  const rule = await livekitSip.createDispatchRule({
                    name: `Route ${phone.phoneNumber} → ${agent.name}`,
                    trunkIds: [phone.sipTrunkId],
                    roomPrefix: 'sondos-sip-',
                    metadata: {
                      agentConfig,
                      source: 'sip',
                      phoneNumber: phone.phoneNumber,
                      userId: agent.userId.toString(),
                    },
                  });
                  phone.sipDispatchRuleId = rule.dispatchRuleId;
                  phone.status = 'active';
                  phone.statusMessage = '';
                  await phone.save();
                  enabledCount++;
                } catch (sipErr) {
                  console.error(`[Agent Status Sync] Rule create failed for ${phone.phoneNumber}:`, sipErr.message);
                  phone.statusMessage = `فشل إعادة تفعيل SIP: ${sipErr.message}`;
                  await phone.save();
                }
              }
            }
            console.log(`[Agent Status Sync] Agent re-enabled → ${enabledCount} phone(s) re-enabled`);
          }
        }
      } catch (syncErr) {
        console.error('[Agent Status Sync] Error:', syncErr.message);
      }
    }

    // ── Sync SIP Dispatch Rules for linked phone numbers ──
    // If any SIP-relevant field changed (not status), update all dispatch rules
    const sipFields = ['personality', 'language', 'greeting', 'systemPrompt', 'useCustomPrompt', 'voice', 'llm', 'stt', 'workingHours'];
    const sipFieldChanged = sipFields.some(f => req.body[f] !== undefined);

    if (sipFieldChanged && !statusChanged && livekitSip.isConfigured()) {
      try {
        const linkedPhones = await PhoneNumber.find({
          agentId: agent._id,
          sipTrunkId: { $ne: '' },
          sipDispatchRuleId: { $ne: '' },
        });

        if (linkedPhones.length > 0) {
          const agentConfig = agent.toLiveKitConfig();
          let syncedCount = 0;

          for (const phone of linkedPhones) {
            try {
              // Delete old rule
              await livekitSip.deleteDispatchRule(phone.sipDispatchRuleId);

              // Create new rule with updated agent config
              const rule = await livekitSip.createDispatchRule({
                name: `Route ${phone.phoneNumber} → ${agent.name}`,
                trunkIds: [phone.sipTrunkId],
                roomPrefix: 'sondos-sip-',
                metadata: {
                  agentConfig,
                  source: 'sip',
                  phoneNumber: phone.phoneNumber,
                  userId: agent.userId.toString(),
                },
              });

              phone.sipDispatchRuleId = rule.dispatchRuleId;
              phone.status = 'active';
              phone.statusMessage = '';
              await phone.save();
              syncedCount++;
            } catch (sipErr) {
              console.error(`[Agent SIP Sync] Failed for ${phone.phoneNumber}:`, sipErr.message);
              phone.statusMessage = `فشل مزامنة SIP: ${sipErr.message}`;
              await phone.save();
            }
          }

          console.log(`[Agent SIP Sync] ${syncedCount}/${linkedPhones.length} dispatch rules updated for agent ${agent.name}`);
        }
      } catch (syncErr) {
        // Don't fail the agent update if SIP sync fails
        console.error('[Agent SIP Sync] Error:', syncErr.message);
      }
    }

    console.log(`[Agent Updated] ${agent.name} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'تم تحديث المساعد بنجاح',
      agent: agent.toPublicJSON(),
    });
  } catch (error) {
    console.error('[Agent Update]', error.message);
    res.status(500).json({ success: false, message: 'فشل تحديث المساعد' });
  }
};

// ══════════════════════════════════════════════════════
// DELETE /api/agents/:id — Delete agent
// ══════════════════════════════════════════════════════
exports.deleteAgent = async (req, res) => {
  try {
    const agent = await Agent.findOne({ _id: req.params.id, userId: req.user._id });
    if (!agent) {
      return res.status(404).json({ success: false, message: 'المساعد غير موجود' });
    }

    // ── Unlink all phone numbers assigned to this agent ──
    const linkedPhones = await PhoneNumber.find({ agentId: agent._id });

    if (linkedPhones.length > 0) {
      for (const phone of linkedPhones) {
        // Delete SIP dispatch rule (phone keeps its trunk but stops routing)
        if (phone.sipDispatchRuleId && livekitSip.isConfigured()) {
          try {
            await livekitSip.deleteDispatchRule(phone.sipDispatchRuleId);
            console.log(`[Agent Delete] Dispatch rule removed for ${phone.phoneNumber}`);
          } catch (sipErr) {
            console.error(`[Agent Delete] Failed to remove dispatch rule for ${phone.phoneNumber}:`, sipErr.message);
          }
        }

        // Unlink agent and mark as pending
        phone.agentId = null;
        phone.sipDispatchRuleId = '';
        phone.status = 'pending';
        phone.statusMessage = 'المساعد المربوط تم حذفه — اربط مساعد جديد';
        await phone.save();
      }

      console.log(`[Agent Delete] Unlinked ${linkedPhones.length} phone number(s) from agent ${agent.name}`);
    }

    // ── Delete the agent ──
    await Agent.deleteOne({ _id: agent._id });

    console.log(`[Agent Deleted] ${agent.name} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'تم حذف المساعد بنجاح',
      unlinkedPhones: linkedPhones.length,
    });
  } catch (error) {
    console.error('[Agent Delete]', error.message);
    res.status(500).json({ success: false, message: 'فشل حذف المساعد' });
  }
};

// ══════════════════════════════════════════════════════
// POST /api/agents/:id/chat — Test agent via text chat
// ──────────────────────────────────────────────────────
// Simple LLM call — no STT, no TTS, no LiveKit
// Uses same system prompt as the voice agent
// ══════════════════════════════════════════════════════
exports.chatWithAgent = async (req, res) => {
  try {
    const agent = await Agent.findOne({ _id: req.params.id, userId: req.user._id });
    if (!agent) {
      return res.status(404).json({ success: false, message: 'المساعد غير موجود' });
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'الرسائل مطلوبة' });
    }

    // Build the system prompt
    const systemPrompt = agent.useCustomPrompt ? agent.systemPrompt : agent.buildSystemPrompt();

    // Call OpenAI directly
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: agent.llm.model,
        temperature: agent.llm.temperature,
        max_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Agent Chat] OpenAI error:', err);
      return res.status(502).json({ success: false, message: 'فشل الاتصال بنموذج الذكاء' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';

    res.json({
      success: true,
      reply,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
      },
    });
  } catch (error) {
    console.error('[Agent Chat]', error.message);
    res.status(500).json({ success: false, message: 'فشل المحادثة مع المساعد' });
  }
};

// ══════════════════════════════════════════════════════
// POST /api/agents/suggest — AI-powered suggestions
// ──────────────────────────────────────────────────────
// Generate greeting / instructions based on role + company
// ══════════════════════════════════════════════════════
exports.suggestContent = async (req, res) => {
  try {
    const { role, companyName, type } = req.body;
    // type = 'greeting' or 'instructions'

    if (!role || !type) {
      return res.status(400).json({ success: false, message: 'الدور ونوع المحتوى مطلوبين' });
    }

    const prompt = type === 'greeting'
      ? `اكتب رسالة ترحيب قصيرة (جملة أو جملتين) لمساعد ذكي يعمل كـ "${role}" في شركة "${companyName || 'غير محدد'}". الرسالة باللغة العربية، ودودة ومهنية. لا تستخدم علامات ترقيم معقدة. أعطني 3 خيارات مختلفة، كل خيار في سطر منفصل.`
      : `اكتب تعليمات مختصرة (3-5 نقاط) لمساعد ذكي يعمل كـ "${role}" في شركة "${companyName || 'غير محدد'}". التعليمات توجّه سلوك المساعد في المكالمات الهاتفية. باللغة العربية.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.8,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      return res.status(502).json({ success: false, message: 'فشل توليد الاقتراحات' });
    }

    const data = await response.json();
    const suggestions = data.choices?.[0]?.message?.content || '';

    res.json({ success: true, suggestions });
  } catch (error) {
    console.error('[Agent Suggest]', error.message);
    res.status(500).json({ success: false, message: 'فشل توليد الاقتراحات' });
  }
};

// ══════════════════════════════════════════════════════
// GET /api/agents/:id/livekit-config — Get agent config for LiveKit
// ──────────────────────────────────────────────────────
// Used by the token endpoint to populate room metadata
// ══════════════════════════════════════════════════════
exports.getAgentLiveKitConfig = async (req, res) => {
  try {
    const agent = await Agent.findOne({ _id: req.params.id, userId: req.user._id });
    if (!agent) {
      return res.status(404).json({ success: false, message: 'المساعد غير موجود' });
    }
    if (agent.status !== 'active') {
      return res.status(400).json({ success: false, message: 'المساعد غير مفعّل' });
    }

    res.json({
      success: true,
      config: agent.toLiveKitConfig(),
    });
  } catch (error) {
    console.error('[Agent LiveKit Config]', error.message);
    res.status(500).json({ success: false, message: 'فشل جلب إعدادات المساعد' });
  }
};
