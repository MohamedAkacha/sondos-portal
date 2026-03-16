const { validationResult } = require('express-validator');
const User = require('../models/User');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const FlowConfig = require('../models/FlowConfig');

// GET /api/user/sondos-key — returns status only, NEVER the actual key
exports.getSondosKey = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const apiKey = user.sondosApiKey || user.api_key || '';
    const hasKey = !!apiKey && apiKey.length > 0;
    const masked = apiKey.length > 8
      ? apiKey.substring(0, 4) + '••••' + apiKey.substring(apiKey.length - 4)
      : apiKey ? '••••••••' : '';

    res.json({
      success: true,
      data: {
        hasKey,
        maskedKey: masked,
        // ⛔ apiKey is NEVER sent to frontend
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// PUT /api/user/sondos-key
exports.updateSondosKey = async (req, res) => {
  try {
    const { apiKey } = req.body;
    const user = await User.findById(req.user._id);
    user.sondosApiKey = apiKey;
    user.api_key = apiKey;
    await user.save();
    res.json({ success: true, message: 'تم حفظ مفتاح Sondos API بنجاح', data: user.toPublicJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// PUT /api/user/profile
exports.updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { name, phone, company, timezone, avatar, settings } = req.body;
    const user = await User.findById(req.user._id);

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (company !== undefined) user.company = company;
    if (timezone) user.timezone = timezone;
    if (avatar !== undefined) user.avatar = avatar;
    if (settings) user.settings = { ...user.settings, ...settings };

    await user.save();
    res.json({ success: true, message: 'تم تحديث البيانات بنجاح', data: user.toPublicJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// PUT /api/user/password
exports.changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// ══════════════════════════════════════════════════════
// PUT /api/user/automation — تفعيل/إيقاف الأتمتة
// ══════════════════════════════════════════════════════
exports.updateAutomation = async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'يرجى إرسال قيمة صحيحة (true أو false)'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { automationEnabled: enabled },
      { new: true }
    );

    res.json({
      success: true,
      message: enabled ? 'تم تفعيل الأتمتة بنجاح' : 'تم إيقاف الأتمتة بنجاح',
      data: {
        automationEnabled: user.automationEnabled
      }
    });
  } catch (error) {
    console.error('[Update Automation]', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// GET /api/user/automation — جلب حالة الأتمتة (محمي)
exports.getAutomation = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      success: true,
      data: {
        automationEnabled: user.automationEnabled
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// GET /api/user/api-key — جلب مفتاح API الكامل (محمي — للمستخدم فقط)
exports.getFullApiKey = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const apiKey = user.sondosApiKey || user.api_key || '';
    res.json({
      success: true,
      data: {
        apiKey: apiKey,
        hasKey: !!apiKey && apiKey.length > 0,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// ══════════════════════════════════════════════════════
// GET /api/user/my-plan — جلب تفاصيل باقة المستخدم + الاشتراك
// ══════════════════════════════════════════════════════
exports.getMyPlan = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.planId) {
      return res.json({
        success: true,
        data: { plan: null, subscription: null }
      });
    }

    // جلب الباقة
    const plan = await Plan.findById(user.planId);
    if (!plan) {
      return res.json({
        success: true,
        data: { plan: null, subscription: null }
      });
    }

    // جلب الاشتراك الفعّال
    const subscription = await Subscription.findOne({
      user: user._id,
      plan: plan._id,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        plan: {
          id: plan._id,
          name: plan.name,
          nameEn: plan.nameEn,
          planCode: plan.planCode,
          slug: plan.slug,
          description: plan.description,
          descriptionEn: plan.descriptionEn,
          priceDisplay: plan.priceDisplay,
          currency: plan.currency,
          period: plan.period,
          features: plan.features,
          limits: plan.limits,
          color: plan.color,
          icon: plan.icon,
          automations: plan.automations || [],
        },
        subscription: subscription ? {
          id: subscription._id,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          autoRenew: subscription.autoRenew,
          renewalCount: subscription.renewalCount,
          isValid: subscription.isValid(),
        } : null,
      }
    });
  } catch (error) {
    console.error('[Get My Plan]', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// ══════════════════════════════════════════════════════
// GET /api/user/my-flows — جلب كل الأتمتة الخاصة بالمستخدم
// ══════════════════════════════════════════════════════
exports.getMyFlows = async (req, res) => {
  try {
    const flows = await FlowConfig.find({ userId: req.user._id })
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      data: {
        flows: flows.map(f => f.toPublicJSON()),
        total: flows.length,
      }
    });
  } catch (error) {
    console.error('[Get My Flows]', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// ══════════════════════════════════════════════════════
// PUT /api/user/my-flows/:flowId/toggle — تفعيل/إيقاف أتمتة محددة
// ══════════════════════════════════════════════════════
exports.toggleFlow = async (req, res) => {
  try {
    const { enabled } = req.body;
    const { flowId } = req.params;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'يرجى إرسال قيمة صحيحة (true أو false)'
      });
    }

    const flow = await FlowConfig.findOneAndUpdate(
      { _id: flowId, userId: req.user._id },
      { isEnabled: enabled },
      { new: true }
    );

    if (!flow) {
      return res.status(404).json({
        success: false,
        message: 'الأتمتة غير موجودة'
      });
    }

    console.log(`[Toggle Flow] ${req.user._id} → ${flow.flowKey}: ${enabled}`);

    res.json({
      success: true,
      message: enabled ? 'تم تفعيل الأتمتة بنجاح' : 'تم إيقاف الأتمتة بنجاح',
      data: flow.toPublicJSON(),
    });
  } catch (error) {
    console.error('[Toggle Flow]', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};