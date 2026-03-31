// =====================================================
// Admin Controller — Dashboard + Users (AutoCalls) + Balance Transfer
// =====================================================
const User = require('../models/User');

const AUTOCALLS_API_BASE = 'https://app.autocalls.ai/api';

// Helper: Call AutoCalls White-Label API
async function autoCallsRequest(endpoint, options = {}) {
  const apiKey = process.env.AUTOCALLS_API_KEY;
  if (!apiKey) throw new Error('AUTOCALLS_API_KEY غير مُعد');

  const res = await fetch(`${AUTOCALLS_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data.message || data.error || `AutoCalls error: ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

// ══════════════════════════════════════════════════════
// GET /api/admin/dashboard — Stats from AutoCalls + Local DB
// ══════════════════════════════════════════════════════
exports.getDashboard = async (req, res) => {
  try {
    // Fetch users from AutoCalls
    let autoCallsUsers = [];
    try {
      const acRes = await autoCallsRequest('/white-label/users');
      autoCallsUsers = acRes.data || [];
    } catch (err) {
      console.error('[Dashboard] AutoCalls fetch failed:', err.message);
    }

    // Local DB stats
    const totalLocal = await User.countDocuments({ role: 'client' });
    const activeLocal = await User.countDocuments({ role: 'client', isActive: true });
    const inactiveLocal = await User.countDocuments({ role: 'client', isActive: false });

    // Monthly registrations (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyRegistrations = await User.aggregate([
      { $match: { role: 'client', createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Merge AutoCalls data with local users for recent list
    const localUsers = await User.find({ role: 'client' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name email company phone isActive createdAt lastLogin sondosApiKey api_key');

    const recentClients = localUsers.map(u => {
      const acUser = autoCallsUsers.find(ac => ac.email?.toLowerCase() === u.email?.toLowerCase());
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        company: u.company || '',
        phone: u.phone || '',
        isActive: u.isActive,
        hasApiKey: !!(u.sondosApiKey || u.api_key),
        createdAt: u.createdAt,
        lastLogin: u.lastLogin,
        // AutoCalls data
        autoCallsId: acUser?.id || null,
        minutes_balance: acUser?.minutes_balance ?? null,
        credits_balance: acUser?.credits_balance ?? null,
      };
    });

    // Total balance across all users
    const totalMinutes = autoCallsUsers.reduce((sum, u) => sum + (u.minutes_balance || 0), 0);
    const totalCredits = autoCallsUsers.reduce((sum, u) => sum + (u.credits_balance || 0), 0);

    res.json({
      success: true,
      data: {
        stats: {
          totalClients: autoCallsUsers.length || totalLocal,
          activeClients: activeLocal,
          inactiveClients: inactiveLocal,
          totalMinutes: Math.round(totalMinutes * 100) / 100,
          totalCredits: Math.round(totalCredits * 100) / 100,
        },
        recentClients,
        monthlyRegistrations,
      }
    });
  } catch (error) {
    console.error('[Dashboard]', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في تحميل البيانات' });
  }
};

// ══════════════════════════════════════════════════════
// GET /api/admin/users — Fetch from AutoCalls + merge local DB
// ══════════════════════════════════════════════════════
exports.getUsers = async (req, res) => {
  try {
    const { search, status } = req.query;

    // 1. Fetch all users from AutoCalls White-Label API
    let autoCallsUsers = [];
    try {
      const acRes = await autoCallsRequest('/white-label/users');
      autoCallsUsers = acRes.data || [];
    } catch (err) {
      console.error('[GetUsers] AutoCalls fetch failed:', err.message);
      // Fallback to local DB only
    }

    // 2. Fetch all local client users
    const localUsers = await User.find({ role: 'client' })
      .select('+plainPassword')
      .sort({ createdAt: -1 });

    // 3. Merge: AutoCalls users are the primary source, enriched with local data
    const localByEmail = {};
    localUsers.forEach(u => {
      localByEmail[u.email.toLowerCase()] = u;
    });

    let mergedUsers = autoCallsUsers.map(acUser => {
      const local = localByEmail[acUser.email?.toLowerCase()];
      return {
        id: local?._id?.toString() || null,
        autoCallsId: acUser.id,
        name: acUser.name || local?.name || '',
        email: acUser.email,
        phone: local?.phone || '',
        company: local?.company || '',
        isActive: local?.isActive ?? true,
        sondosApiKey: local?.sondosApiKey || local?.api_key || '',
        plainPassword: local?.plainPassword || '',
        minutes_balance: acUser.minutes_balance ?? 0,
        credits_balance: acUser.credits_balance ?? 0,
        createdAt: acUser.created_at || local?.createdAt || null,
        lastLogin: local?.lastLogin || null,
        // Flag if user exists in local DB
        hasLocalAccount: !!local,
      };
    });

    // Also add local users not in AutoCalls (edge case)
    const acEmails = new Set(autoCallsUsers.map(u => u.email?.toLowerCase()));
    localUsers.forEach(u => {
      if (!acEmails.has(u.email.toLowerCase())) {
        mergedUsers.push({
          id: u._id.toString(),
          autoCallsId: null,
          name: u.name,
          email: u.email,
          phone: u.phone || '',
          company: u.company || '',
          isActive: u.isActive,
          sondosApiKey: u.sondosApiKey || u.api_key || '',
          plainPassword: u.plainPassword || '',
          minutes_balance: null,
          credits_balance: null,
          createdAt: u.createdAt,
          lastLogin: u.lastLogin,
          hasLocalAccount: true,
        });
      }
    });

    // 4. Apply filters
    if (search) {
      const q = search.toLowerCase();
      mergedUsers = mergedUsers.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.includes(q) ||
        u.company?.toLowerCase().includes(q)
      );
    }

    if (status === 'active') mergedUsers = mergedUsers.filter(u => u.isActive);
    if (status === 'inactive') mergedUsers = mergedUsers.filter(u => !u.isActive);

    res.json({
      success: true,
      data: {
        users: mergedUsers,
        pagination: {
          total: mergedUsers.length,
          page: 1,
          pages: 1,
        }
      }
    });
  } catch (error) {
    console.error('[GetUsers]', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// ══════════════════════════════════════════════════════
// POST /api/admin/transfer-balance — AutoCalls White-Label API
// ══════════════════════════════════════════════════════
exports.transferBalance = async (req, res) => {
  try {
    const { user_id, email, transfer_type, operation, amount } = req.body;

    if (!email || !amount) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني والمبلغ مطلوبان' });
    }
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'المبلغ يجب أن يكون أكبر من صفر' });
    }

    const data = await autoCallsRequest('/white-label/transfer', {
      method: 'POST',
      body: JSON.stringify({
        user_id: user_id || undefined,
        email,
        transfer_type: transfer_type || 'balance',
        operation: operation || 'add',
        amount: parseFloat(amount),
      }),
    });

    res.json({
      success: true,
      message: `تم تحويل ${amount} بنجاح إلى ${email}`,
      data,
    });
  } catch (error) {
    console.error('[Transfer Balance]', error.message);
    res.status(error.status || 502).json({
      success: false,
      message: error.message || 'فشل الاتصال بخدمة AutoCalls',
      details: error.details,
    });
  }
};

// ══════════════════════════════════════════════════════
// GET /api/admin/users/:id — Single user (local DB)
// ══════════════════════════════════════════════════════
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('+plainPassword');
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    res.json({ success: true, data: user.toAdminJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// PUT /api/admin/users/:id
exports.updateUser = async (req, res) => {
  try {
    const { name, phone, company, timezone, role, isActive, sondosApiKey, api_key } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (company !== undefined) user.company = company;
    if (timezone) user.timezone = timezone;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (sondosApiKey !== undefined) { user.sondosApiKey = sondosApiKey; user.api_key = sondosApiKey; }
    if (api_key !== undefined) { user.api_key = api_key; user.sondosApiKey = api_key; }

    await user.save();
    res.json({ success: true, message: 'تم تحديث بيانات المستخدم', data: user.toAdminJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// PUT /api/admin/users/:id/status
exports.updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    user.isActive = isActive;
    await user.save();
    res.json({
      success: true,
      message: isActive ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب',
      data: user.toPublicJSON()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'لا يمكن حذف حساب المدير' });
    }
    await user.deleteOne();
    res.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};
// ══════════════════════════════════════════════════════
// POST /api/admin/sip-cleanup — Manual SIP resource cleanup
// ══════════════════════════════════════════════════════
exports.sipCleanup = async (req, res) => {
  try {
    const { runCleanup } = require('../utils/sipCleanup');
    const result = await runCleanup();

    if (result.skipped) {
      return res.json({ success: true, message: 'LiveKit SIP غير مُعد — لا حاجة للتنظيف', result });
    }

    res.json({
      success: true,
      message: `تم التنظيف — حُذفت ${result.orphanedTrunks} trunk و ${result.orphanedRules} rule، وأُصلحت ${result.staleDbRecords} سجلات`,
      result,
    });
  } catch (error) {
    console.error('[Admin SIP Cleanup]', error.message);
    res.status(500).json({ success: false, message: 'فشل التنظيف' });
  }
};
