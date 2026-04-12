// =====================================================
// Auth Controller — Thin layer (delegates to AuthService)
// =====================================================
const authService = require('../services/auth.service');
const User = require('../models/User');

// POST /api/auth/register-with-payment
exports.registerWithPayment = async (req, res) => {
  try {
    const { user, tokens } = await authService.registerWithPayment(req.body);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب وتفعيل الاشتراك بنجاح',
      data: {
        user,
        token: tokens.accessToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'حدث خطأ في الخادم',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { user, tokens } = await authService.register(req.body);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح',
      data: {
        user,
        token: tokens.accessToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'حدث خطأ في الخادم',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { user, tokens } = await authService.login(req.body);

    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        user,
        token: tokens.accessToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    // If 2FA is required, tell the frontend
    if (error.requires2FA) {
      return res.status(401).json({
        success: false,
        message: error.message,
        requires2FA: true,
      });
    }
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'حدث خطأ في الخادم',
    });
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const result = await authService.forgotPassword(req.body);
    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'حدث خطأ في الخادم',
    });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const result = await authService.resetPassword(req.body);
    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'حدث خطأ في الخادم',
    });
  }
};

// POST /api/auth/verify-email
exports.verifyEmail = async (req, res) => {
  try {
    const result = await authService.verifyEmail(req.body);
    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'حدث خطأ في الخادم',
    });
  }
};

// POST /api/auth/refresh
exports.refresh = async (req, res) => {
  try {
    const result = await authService.refreshToken(req.body);
    res.json({
      success: true,
      data: {
        token: result.accessToken,
        accessToken: result.accessToken,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'حدث خطأ في الخادم',
    });
  }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    const result = await authService.logout(req.body);
    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, data: user.toPublicJSON() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
};