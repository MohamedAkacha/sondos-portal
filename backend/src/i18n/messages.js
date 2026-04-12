// =====================================================
// Backend i18n — Bilingual Error & Response Messages
// =====================================================

const messages = {
  ar: {
    auth: {
      emailRequired: 'البريد الإلكتروني مطلوب',
      emailExists: 'البريد الإلكتروني مسجل مسبقاً',
      invalidCredentials: 'بيانات الدخول غير صحيحة',
      accountDisabled: 'الحساب معطل — تواصل مع الدعم',
      passwordTooShort: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
      tokenExpired: 'انتهت صلاحية الجلسة — يرجى تسجيل الدخول',
      tokenInvalid: 'جلسة غير صالحة',
      resetLinkSent: 'إذا كان البريد مسجلاً، ستصلك رسالة لإعادة تعيين كلمة المرور',
      resetLinkInvalid: 'رابط إعادة التعيين غير صالح أو منتهي',
      passwordChanged: 'تم تغيير كلمة المرور بنجاح',
      emailVerified: 'تم تأكيد البريد الإلكتروني بنجاح',
      verifyLinkInvalid: 'رابط التأكيد غير صالح',
      twoFactorRequired: 'رمز التحقق الثنائي مطلوب',
      twoFactorInvalid: 'رمز التحقق الثنائي غير صحيح',
      logoutSuccess: 'تم تسجيل الخروج بنجاح',
      registerSuccess: 'تم إنشاء الحساب بنجاح',
      loginSuccess: 'تم تسجيل الدخول بنجاح',
    },
    agents: {
      nameRequired: 'اسم المساعد مطلوب',
      notFound: 'المساعد غير موجود',
      limitReached: 'وصلت للحد الأقصى من المساعدين في باقتك',
      created: 'تم إنشاء المساعد بنجاح',
      updated: 'تم تحديث المساعد بنجاح',
      deleted: 'تم حذف المساعد بنجاح',
    },
    tools: {
      notFound: 'الأداة غير موجودة',
      created: 'تم إنشاء الأداة بنجاح',
      testSuccess: 'نجح اختبار الأداة',
      testFailed: 'فشل اختبار الأداة',
    },
    knowledge: {
      notFound: 'قاعدة المعرفة غير موجودة',
      created: 'تم إنشاء قاعدة المعرفة بنجاح',
      documentUploaded: 'تم رفع المستند — جاري المعالجة',
      documentDeleted: 'تم حذف المستند بنجاح',
      unsupportedFormat: 'صيغة الملف غير مدعومة',
      fileTooLarge: 'حجم الملف كبير جداً',
    },
    leads: {
      notFound: 'العميل المحتمل غير موجود',
      created: 'تم إضافة العميل المحتمل بنجاح',
      imported: 'تم استيراد {{count}} عميل بنجاح',
    },
    payments: {
      verificationFailed: 'فشل التحقق من عملية الدفع',
      alreadyUsed: 'عملية الدفع مستخدمة مسبقاً',
      planNotFound: 'الباقة غير متاحة',
      success: 'تمت عملية الدفع بنجاح',
    },
    general: {
      serverError: 'حدث خطأ في الخادم',
      notFound: 'العنصر غير موجود',
      forbidden: 'ليس لديك صلاحية لهذا الإجراء',
      validationFailed: 'بيانات غير صالحة',
      rateLimited: 'طلبات كثيرة — حاول بعد قليل',
    },
  },

  en: {
    auth: {
      emailRequired: 'Email is required',
      emailExists: 'Email already registered',
      invalidCredentials: 'Invalid credentials',
      accountDisabled: 'Account disabled — contact support',
      passwordTooShort: 'Password must be at least 8 characters',
      tokenExpired: 'Session expired — please log in',
      tokenInvalid: 'Invalid session',
      resetLinkSent: 'If the email is registered, you will receive a reset link',
      resetLinkInvalid: 'Invalid or expired reset link',
      passwordChanged: 'Password changed successfully',
      emailVerified: 'Email verified successfully',
      verifyLinkInvalid: 'Invalid verification link',
      twoFactorRequired: '2FA code is required',
      twoFactorInvalid: 'Invalid 2FA code',
      logoutSuccess: 'Logged out successfully',
      registerSuccess: 'Account created successfully',
      loginSuccess: 'Logged in successfully',
    },
    agents: {
      nameRequired: 'Agent name is required',
      notFound: 'Agent not found',
      limitReached: 'You have reached the maximum number of agents for your plan',
      created: 'Agent created successfully',
      updated: 'Agent updated successfully',
      deleted: 'Agent deleted successfully',
    },
    tools: {
      notFound: 'Tool not found',
      created: 'Tool created successfully',
      testSuccess: 'Tool test passed',
      testFailed: 'Tool test failed',
    },
    knowledge: {
      notFound: 'Knowledge base not found',
      created: 'Knowledge base created successfully',
      documentUploaded: 'Document uploaded — processing',
      documentDeleted: 'Document deleted successfully',
      unsupportedFormat: 'Unsupported file format',
      fileTooLarge: 'File is too large',
    },
    leads: {
      notFound: 'Lead not found',
      created: 'Lead added successfully',
      imported: '{{count}} leads imported successfully',
    },
    payments: {
      verificationFailed: 'Payment verification failed',
      alreadyUsed: 'Payment already used',
      planNotFound: 'Plan not available',
      success: 'Payment successful',
    },
    general: {
      serverError: 'Server error occurred',
      notFound: 'Item not found',
      forbidden: 'You don\'t have permission for this action',
      validationFailed: 'Invalid data',
      rateLimited: 'Too many requests — try again later',
    },
  },
};

/**
 * Get a message by key and language
 * Usage: msg('ar', 'auth.emailExists')
 */
function msg(lang, key) {
  const keys = key.split('.');
  let result = messages[lang] || messages['ar'];
  for (const k of keys) {
    result = result?.[k];
  }
  return result || key;
}

module.exports = { messages, msg };
