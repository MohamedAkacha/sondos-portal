#!/bin/bash
# =====================================================
# Sondos AI v2 — سكريبت التنظيف النهائي
# شغّل هذا السكريبت بعد نسخ كل الملفات من outputs
# =====================================================

echo "🧹 بدء التنظيف..."

# ── E1: حذف ملفات الباكند القديمة ──
echo ""
echo "── E1: حذف ملفات الباكند القديمة ──"
for f in backend/src/controllers/sondos.controller.js backend/src/routes/sondos.routes.js backend/src/utils/autocalls.js; do
  if [ -f "$f" ]; then
    rm "$f"
    echo "  ✅ حذف: $f"
  else
    echo "  ⏭️  غير موجود: $f"
  fi
done

# ── E2: حذف sondosAPI.js ──
echo ""
echo "── E2: حذف sondosAPI.js ──"
if [ -f "frontend/src/services/api/sondosAPI.js" ]; then
  rm "frontend/src/services/api/sondosAPI.js"
  echo "  ✅ حذف: sondosAPI.js"
else
  echo "  ⏭️  غير موجود (تم حذفه مسبقاً)"
fi

# ── E3: فحص إذا فيه import لـ sondosAPI ──
echo ""
echo "── E3: فحص المراجع المتبقية ──"
refs=$(grep -rl "from.*sondosAPI" frontend/src/ 2>/dev/null | grep -v node_modules)
if [ -z "$refs" ]; then
  echo "  ✅ لا توجد مراجع لـ sondosAPI"
else
  echo "  ⚠️  ملفات لا زالت تستورد sondosAPI:"
  echo "$refs" | while read f; do echo "    ❌ $f"; done
  echo "  → هذي الملفات تحتاج استبدال بالنسخ من outputs"
fi

# ── E4: فحص AGENT_SECRET ──
echo ""
echo "── E4: فحص المتغيرات البيئية ──"
if [ -f "backend/.env" ]; then
  grep -q "AGENT_SECRET" backend/.env && echo "  ✅ AGENT_SECRET موجود" || echo "  ⚠️  أضف AGENT_SECRET=your_secret_here في backend/.env"
  grep -q "JWT_SECRET" backend/.env && echo "  ✅ JWT_SECRET موجود" || echo "  ⚠️  JWT_SECRET مفقود!"
else
  echo "  ⚠️  ملف backend/.env غير موجود"
fi

# ── E5: فحص Build ──
echo ""
echo "── E5: فحص Build ──"
echo "  شغّل الأوامر التالية يدوياً:"
echo ""
echo "  cd backend && npm run dev"
echo "  # تأكد: MongoDB connected + Server running on port 5000"
echo ""
echo "  cd frontend && npm run dev"
echo "  # تأكد: كل الصفحات تفتح بدون شاشة بيضاء"
echo ""
echo "  cd frontend && npm run build"
echo "  # تأكد: Build يكتمل بدون أخطاء"

# ── E6: Checklist ──
echo ""
echo "==========================================="
echo "📋 CHECKLIST — تحقق يدوياً"
echo "==========================================="
echo "  [ ] الصفحة الرئيسية تعرض إحصائيات"
echo "  [ ] صفحة المكالمات تعرض بيانات"
echo "  [ ] صفحة العملاء تعرض بيانات"
echo "  [ ] إعدادات المساعد — 11 تبويب يشتغلون"
echo "  [ ] صفحة الأدوات — إنشاء/تعديل/حذف"
echo "  [ ] صفحة الدردشة — قائمة المحادثات"
echo "  [ ] صفحة التحليلات — بيانات KPI"
echo "  [ ] صفحة الاستخدام والفوترة"
echo "  [ ] صفحة المتغيرات المستخرجة"
echo "  [ ] صفحة ذاكرة المحادثات"
echo "  [ ] ودجت الدردشة: localhost:5000/widget/sondos-chat.js"
echo "  [ ] مفاتيح API — إنشاء/حذف"
echo "  [ ] Webhooks — إنشاء/اختبار"
echo "  [ ] التبديل عربي/إنجليزي — لا مفاتيح خام"
echo "  [ ] Light/Dark mode — كل الصفحات متوافقة"
echo ""
echo "✅ التنظيف اكتمل!"
