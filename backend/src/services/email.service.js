// =====================================================
// Email Service — Verification, Password Reset, Notifications
// =====================================================
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this._init();
  }

  _init() {
    // Only create transporter if SMTP is configured
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      console.log('✅ Email service initialized');
    } else {
      console.warn('⚠️ Email service not configured — emails will be logged to console');
    }
  }

  /**
   * Send an email (or log it if SMTP is not configured)
   */
  async _send({ to, subject, html }) {
    if (!this.transporter) {
      console.log(`📧 [EMAIL] To: ${to} | Subject: ${subject}`);
      console.log(`📧 [EMAIL] Body preview: ${html.substring(0, 200)}...`);
      return { messageId: 'dev-mode', logged: true };
    }

    const result = await this.transporter.sendMail({
      from: `"سندس AI" <${process.env.SMTP_FROM || 'noreply@sondos.ai'}>`,
      to,
      subject,
      html,
    });

    return result;
  }

  /**
   * Send email verification link
   */
  async sendVerificationEmail(user, token) {
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    await this._send({
      to: user.email,
      subject: 'تأكيد البريد الإلكتروني — سندس AI',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>مرحباً ${user.name} 👋</h2>
          <p>شكراً لتسجيلك في سندس AI. يرجى تأكيد بريدك الإلكتروني بالضغط على الزر أدناه:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" 
               style="background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px;">
              تأكيد البريد الإلكتروني
            </a>
          </p>
          <p style="color: #888; font-size: 14px;">إذا لم تقم بالتسجيل، تجاهل هذا البريد.</p>
          <p style="color: #888; font-size: 14px;">الرابط صالح لمدة 24 ساعة.</p>
        </div>
      `,
    });
  }

  /**
   * Send password reset link
   */
  async sendPasswordResetEmail(user, token) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await this._send({
      to: user.email,
      subject: 'إعادة تعيين كلمة المرور — سندس AI',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>مرحباً ${user.name}</h2>
          <p>تلقينا طلباً لإعادة تعيين كلمة المرور. اضغط على الزر أدناه:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px;">
              إعادة تعيين كلمة المرور
            </a>
          </p>
          <p style="color: #888; font-size: 14px;">إذا لم تطلب إعادة التعيين، تجاهل هذا البريد.</p>
          <p style="color: #888; font-size: 14px;">الرابط صالح لمدة ساعة واحدة فقط.</p>
        </div>
      `,
    });
  }

  /**
   * Send welcome email after registration
   */
  async sendWelcomeEmail(user) {
    await this._send({
      to: user.email,
      subject: 'مرحباً بك في سندس AI! 🎉',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>مرحباً ${user.name}! 🎉</h2>
          <p>تم إنشاء حسابك بنجاح في سندس AI.</p>
          <p>يمكنك الآن:</p>
          <ul>
            <li>إنشاء مساعدك الذكي الأول</li>
            <li>إضافة قاعدة معرفة</li>
            <li>ربط أدوات خارجية</li>
            <li>بدء استقبال المكالمات</li>
          </ul>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/dashboard" 
               style="background: #6366f1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px;">
              ابدأ الآن
            </a>
          </p>
        </div>
      `,
    });
  }
}

// Singleton
module.exports = new EmailService();
