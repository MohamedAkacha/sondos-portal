// =====================================================
// Public Controller — Endpoints خارجية للأنظمة المتصلة
// ─────────────────────────────────────────────────────
// هذه الـ endpoints لا تحتاج توكن مستخدم
// تعتمد على API Key للمصادقة
// =====================================================
const User = require('../models/User');
const FlowConfig = require('../models/FlowConfig');

// ══════════════════════════════════════════════════════
// GET /api/public/automation-status
// ──────────────────────────────────────────────────────
// يُستخدم من الأنظمة الخارجية (n8n, make, custom)
// للتحقق من حالة الأتمتة قبل تنفيذ المكالمات
//
// المصادقة: X-API-Key header أو ?api_key query param
//
// Response:
// {
//   success: true,
//   automationEnabled: true/false,
//   user: { id, name, isActive }
// }
// ══════════════════════════════════════════════════════
exports.getAutomationStatus = async (req, res) => {
  try {
    // 1. استخراج API Key من الهيدر أو الكويري
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API Key مطلوب — أرسله في X-API-Key header أو api_key query parameter'
      });
    }

    // 2. البحث عن المستخدم بالـ API Key
    const user = await User.findOne({
      $or: [
        { sondosApiKey: apiKey },
        { api_key: apiKey }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'API Key غير صالح'
      });
    }

    // 3. التحقق من حالة الحساب
    if (!user.isActive) {
      return res.json({
        success: true,
        automationEnabled: false,
        reason: 'account_inactive',
        user: {
          id: user._id,
          name: user.name,
          isActive: false
        }
      });
    }

    // 4. إرجاع حالة الأتمتة
    res.json({
      success: true,
      automationEnabled: user.automationEnabled,
      user: {
        id: user._id,
        name: user.name,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('[Public Automation Status]', error.message);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
};

// ══════════════════════════════════════════════════════
// Helper: Extract user from API Key
// ══════════════════════════════════════════════════════
async function getUserByApiKey(req) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (!apiKey) return { error: 'API Key مطلوب — أرسله في X-API-Key header أو api_key query parameter', status: 401 };

  const user = await User.findOne({
    $or: [
      { sondosApiKey: apiKey },
      { api_key: apiKey }
    ]
  });

  if (!user) return { error: 'API Key غير صالح', status: 401 };
  if (!user.isActive) return { error: 'الحساب معطل', status: 403 };

  return { user };
}

// ══════════════════════════════════════════════════════
// GET /api/public/flow-status/:flowKey
// ──────────────────────────────────────────────────────
// التحقق من حالة أتمتة محددة — للأنظمة الخارجية
// المصادقة: X-API-Key header أو ?api_key query param
// ══════════════════════════════════════════════════════
exports.getFlowStatus = async (req, res) => {
  try {
    const result = await getUserByApiKey(req);
    if (result.error) {
      return res.status(result.status).json({ success: false, message: result.error });
    }
    const { user } = result;
    const { flowKey } = req.params;

    const flow = await FlowConfig.findOne({ userId: user._id, flowKey });

    if (!flow) {
      return res.status(404).json({
        success: false,
        message: `الأتمتة غير موجودة: ${flowKey}`
      });
    }

    // التحقق من الـ automation العام أيضاً
    const globalEnabled = user.automationEnabled !== false;

    res.json({
      success: true,
      flowKey: flow.flowKey,
      flowName: flow.flowName,
      isEnabled: flow.isEnabled && globalEnabled,
      flowEnabled: flow.isEnabled,
      globalAutomationEnabled: globalEnabled,
      user: {
        id: user._id,
        name: user.name,
      }
    });
  } catch (error) {
    console.error('[Public Flow Status]', error.message);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
};

// ══════════════════════════════════════════════════════
// GET /api/public/flows-status
// ──────────────────────────────────────────────────────
// جلب حالة كل الأتمتة مرة وحدة — للأنظمة الخارجية
// المصادقة: X-API-Key header أو ?api_key query param
// ══════════════════════════════════════════════════════
exports.getAllFlowsStatus = async (req, res) => {
  try {
    const result = await getUserByApiKey(req);
    if (result.error) {
      return res.status(result.status).json({ success: false, message: result.error });
    }
    const { user } = result;

    const flows = await FlowConfig.find({ userId: user._id }).sort({ createdAt: 1 });
    const globalEnabled = user.automationEnabled !== false;

    res.json({
      success: true,
      globalAutomationEnabled: globalEnabled,
      flows: flows.map(f => ({
        flowKey: f.flowKey,
        flowName: f.flowName,
        isEnabled: f.isEnabled && globalEnabled,
        flowEnabled: f.isEnabled,
      })),
      total: flows.length,
      user: {
        id: user._id,
        name: user.name,
      }
    });
  } catch (error) {
    console.error('[Public Flows Status]', error.message);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
};