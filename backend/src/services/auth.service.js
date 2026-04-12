// =====================================================
// Auth Service — Business Logic for Authentication
// =====================================================
const User = require('../models/User');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const Notification = require('../models/Notification');
const FlowConfig = require('../models/FlowConfig');
const Agent = require('../models/Agent');
const TokenBlacklist = require('../models/TokenBlacklist');
const { generateTokenPair, verifyRefreshToken, generateAccessToken } = require('../utils/token');
const { generateToken } = require('../utils/helpers');
const moyasar = require('../utils/moyasar');
const emailService = require('./email.service');

class AuthService {

  // ══════════════════════════════════════════════════════
  // Register with Payment
  // ══════════════════════════════════════════════════════
  async registerWithPayment({ name, email, phone, company, timezone, password, planId, moyasarPaymentId }) {
    // 1. Check duplicate email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw Object.assign(new Error('البريد الإلكتروني مسجل مسبقاً'), { statusCode: 400 });
    }

    // 2. Look up plan
    const plan = await this._findPlan(planId);
    if (!plan || !plan.isActive) {
      throw Object.assign(new Error('الباقة غير متاحة'), { statusCode: 404 });
    }

    // 3. Verify Moyasar payment (with retries)
    const moyasarPayment = await this._verifyPayment(moyasarPaymentId);

    // 4. Check payment not already used
    const existingPayment = await Payment.findOne({ moyasarPaymentId });
    if (existingPayment) {
      throw Object.assign(new Error('عملية الدفع مستخدمة مسبقاً'), { statusCode: 400 });
    }

    // 5. Create user locally (NO external calls)
    const verificationToken = generateToken();
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      company: company || '',
      timezone: timezone || 'Asia/Riyadh',
      password,
      role: 'client',
      planId: plan._id,
      isVerified: false,
      verificationToken,
    });

    // 6. Create Payment record
    const payment = await Payment.create({
      user: user._id,
      plan: plan._id,
      moyasarPaymentId,
      amountHalala: plan.priceHalala,
      amountDisplay: plan.priceDisplay,
      currency: 'SAR',
      status: 'paid',
      type: 'subscription',
      description: `اشتراك ${plan.name} - سندس AI`,
      paidAt: new Date(),
      source: {
        type: moyasarPayment.source?.type || 'creditcard',
        company: moyasarPayment.source?.company || '',
        name: moyasarPayment.source?.name || '',
        number: moyasarPayment.source?.number || '',
      },
      metadata: {
        planName: plan.name,
        userName: name,
        userEmail: email.toLowerCase(),
        registrationType: 'register-with-payment',
      },
    });

    // 7. Create Subscription
    const subscription = new Subscription({
      user: user._id,
      plan: plan._id,
      lastPayment: payment._id,
      renewalCount: 1,
    });
    subscription.activate(payment, plan);
    await subscription.save();

    // 8. Seed FlowConfig from plan
    await this._seedFlowConfig(user._id, plan);

    // 9. Create default Agent
    await this._createDefaultAgent(user._id);

    // 10. Send verification email
    try { await emailService.sendVerificationEmail(user, verificationToken); } catch (_) {}

    // 11. Welcome notification
    await this._createWelcomeNotification(user._id, plan.name);

    // 12. Generate tokens
    const tokens = generateTokenPair(user._id);

    return { user: user.toPublicJSON(), tokens };
  }

  // ══════════════════════════════════════════════════════
  // Register Free Trial
  // ══════════════════════════════════════════════════════
  async register({ name, email, phone, company, timezone, password }) {
    // 1. Check duplicate email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw Object.assign(new Error('البريد الإلكتروني مسجل مسبقاً'), { statusCode: 400 });
    }

    // 2. Create user
    const verificationToken = generateToken();
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      company: company || '',
      timezone: timezone || 'Asia/Riyadh',
      password,
      role: 'client',
      isVerified: false,
      verificationToken,
    });

    // 3. Create free trial subscription (7 days)
    const freePlan = await Plan.findOne({ slug: 'free' });
    if (freePlan) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      await Subscription.create({
        user: user._id,
        plan: freePlan._id,
        status: 'active',
        startDate: new Date(),
        endDate,
        renewalCount: 0,
      });

      user.planId = freePlan._id;
      await user.save({ validateBeforeSave: false });
    }

    // 4. Create default Agent
    await this._createDefaultAgent(user._id);

    // 5. Send verification email
    try { await emailService.sendVerificationEmail(user, verificationToken); } catch (_) {}

    // 6. Welcome notification
    await this._createWelcomeNotification(user._id);

    // 7. Generate tokens
    const tokens = generateTokenPair(user._id);

    return { user: user.toPublicJSON(), tokens };
  }

  // ══════════════════════════════════════════════════════
  // Login
  // ══════════════════════════════════════════════════════
  async login({ email, password, twoFactorCode }) {
    // 1. Find user
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password +twoFactorSecret');

    if (!user) {
      throw Object.assign(new Error('بيانات الدخول غير صحيحة'), { statusCode: 401 });
    }

    // 2. Check active
    if (!user.isActive) {
      throw Object.assign(new Error('الحساب معطل — تواصل مع الدعم'), { statusCode: 401 });
    }

    // 3. Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw Object.assign(new Error('بيانات الدخول غير صحيحة'), { statusCode: 401 });
    }

    // 4. Check 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        throw Object.assign(new Error('رمز التحقق الثنائي مطلوب'), { statusCode: 401, requires2FA: true });
      }
      const { authenticator } = require('otplib');
      const isValid = authenticator.verify({ token: twoFactorCode, secret: user.twoFactorSecret });
      if (!isValid) {
        throw Object.assign(new Error('رمز التحقق الثنائي غير صحيح'), { statusCode: 401 });
      }
    }

    // 5. Update login tracking
    user.lastLogin = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save({ validateBeforeSave: false });

    // 6. Generate tokens
    const tokens = generateTokenPair(user._id);

    return { user: user.toPublicJSON(), tokens };
  }

  // ══════════════════════════════════════════════════════
  // Forgot Password
  // ══════════════════════════════════════════════════════
  async forgotPassword({ email }) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists
      return { message: 'إذا كان البريد مسجلاً، ستصلك رسالة لإعادة تعيين كلمة المرور' };
    }

    const resetToken = generateToken();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    try { await emailService.sendPasswordResetEmail(user, resetToken); } catch (_) {}

    return { message: 'إذا كان البريد مسجلاً، ستصلك رسالة لإعادة تعيين كلمة المرور' };
  }

  // ══════════════════════════════════════════════════════
  // Reset Password
  // ══════════════════════════════════════════════════════
  async resetPassword({ token, newPassword }) {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      throw Object.assign(new Error('رابط إعادة التعيين غير صالح أو منتهي'), { statusCode: 400 });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1; // Invalidate all sessions
    await user.save();

    return { message: 'تم تغيير كلمة المرور بنجاح' };
  }

  // ══════════════════════════════════════════════════════
  // Verify Email
  // ══════════════════════════════════════════════════════
  async verifyEmail({ token }) {
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      throw Object.assign(new Error('رابط التأكيد غير صالح'), { statusCode: 400 });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save({ validateBeforeSave: false });

    return { message: 'تم تأكيد البريد الإلكتروني بنجاح' };
  }

  // ══════════════════════════════════════════════════════
  // Refresh Token
  // ══════════════════════════════════════════════════════
  async refreshToken({ refreshToken }) {
    if (!refreshToken) {
      throw Object.assign(new Error('Refresh token مطلوب'), { statusCode: 400 });
    }

    const isBlacklisted = await TokenBlacklist.isBlacklisted(refreshToken);
    if (isBlacklisted) {
      throw Object.assign(new Error('التوكن ملغي — يرجى تسجيل الدخول'), { statusCode: 401 });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      throw Object.assign(new Error('Refresh token غير صالح أو منتهي'), { statusCode: 401 });
    }

    if (decoded.type !== 'refresh') {
      throw Object.assign(new Error('نوع التوكن غير صالح'), { statusCode: 401 });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      throw Object.assign(new Error('المستخدم غير موجود أو الحساب معطل'), { statusCode: 401 });
    }

    // Check tokenVersion
    if (user.tokenVersion && decoded.iat) {
      const tokenIssuedAt = decoded.iat * 1000;
      if (tokenIssuedAt < user.tokenVersion) {
        throw Object.assign(new Error('تم تغيير كلمة المرور — يرجى تسجيل الدخول'), { statusCode: 401 });
      }
    }

    const newAccessToken = generateAccessToken(user._id);
    return { accessToken: newAccessToken };
  }

  // ══════════════════════════════════════════════════════
  // Logout
  // ══════════════════════════════════════════════════════
  async logout({ refreshToken }) {
    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        await TokenBlacklist.revokeToken(refreshToken, decoded.id, 'logout');
      } catch (_) {}
    }
    return { message: 'تم تسجيل الخروج بنجاح' };
  }

  // ══════════════════════════════════════════════════════
  // Private Helpers
  // ══════════════════════════════════════════════════════

  async _findPlan(planId) {
    let plan = null;
    if (planId.match(/^[0-9a-fA-F]{24}$/)) {
      plan = await Plan.findById(planId);
    }
    if (!plan) plan = await Plan.findOne({ planCode: planId });
    if (!plan) plan = await Plan.findOne({ slug: planId });
    return plan;
  }

  async _verifyPayment(moyasarPaymentId) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;
    let moyasarPayment;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        moyasarPayment = await moyasar.fetchPayment(moyasarPaymentId);
        if (moyasarPayment.status === 'paid') return moyasarPayment;

        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
      } catch (err) {
        if (attempt === MAX_RETRIES) {
          throw Object.assign(new Error('فشل التحقق من عملية الدفع'), { statusCode: 400 });
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }

    throw Object.assign(
      new Error(`الدفع غير مكتمل - الحالة: ${moyasarPayment?.status}`),
      { statusCode: 400 }
    );
  }

  async _seedFlowConfig(userId, plan) {
    try {
      if (plan.automations && plan.automations.length > 0) {
        const flowDocs = plan.automations.map(auto => ({
          userId,
          flowName: auto.name,
          flowKey: auto.key,
          description: auto.description || '',
          isEnabled: true,
          planCode: plan.planCode || '',
        }));
        await FlowConfig.insertMany(flowDocs);
      }
    } catch (_) {}
  }

  async _createDefaultAgent(userId) {
    try {
      const existingAgent = await Agent.findOne({ userId });
      if (existingAgent) return;

      await Agent.create({
        userId,
        name: 'المساعد الأول',
        description: 'مساعدك الذكي الأول — جاهز للتخصيص',
        avatar: '🤖',
        status: 'draft',
      });
    } catch (_) {}
  }

  async _createWelcomeNotification(userId, planName) {
    try {
      await Notification.create({
        userId,
        title: 'مرحباً بك في Sondos AI! 🎉',
        message: planName
          ? `تم إنشاء حسابك وتفعيل ${planName} بنجاح. المساعد الذكي جاهز للعمل.`
          : 'تم إنشاء حسابك بنجاح. يمكنك الآن إعداد المساعد الذكي الخاص بك.',
        type: 'success',
      });
    } catch (_) {}
  }
}

module.exports = new AuthService();
