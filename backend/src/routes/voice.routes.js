// =====================================================
// Voice Routes — أصوات ElevenLabs + استنساخ
// ─────────────────────────────────────────────────────
// JWT auth required for all routes
// Rate limited: clone 3/hr, list 10/min
// =====================================================
const router = require('express').Router();
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const voiceCtrl = require('../controllers/voice.controller');
const { protect, adminOnly } = require('../middleware/auth');

// ── Multer: audio files in memory ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) cb(null, true);
    else cb(new Error('نوع الملف غير مدعوم — يرجى رفع ملف صوتي'), false);
  },
});

// ── Rate limiters (Step 22) ──
const cloneLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { success: false, message: 'تجاوزت حد الاستنساخ — 3 مرات بالساعة. حاول لاحقاً.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `clone_${req.user?._id || req.ip}`,
});

const voicesListLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, message: 'طلبات كثيرة — حاول بعد دقيقة' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `voices_${req.user?._id || req.ip}`,
});

router.use(protect);

// Get available ElevenLabs voices (cached 1hr + rate limited 10/min)
router.get('/elevenlabs', voicesListLimiter, voiceCtrl.getElevenLabsVoices);

// Clone a voice (rate limited 3/hr + plan limit check)
router.post('/clone', cloneLimiter, upload.array('files', 5), voiceCtrl.cloneVoice);

// Delete a cloned voice
router.delete('/:voiceId', voiceCtrl.deleteVoice);

// Admin: clear voices cache
router.post('/elevenlabs/clear-cache', adminOnly, voiceCtrl.clearVoicesCache);

module.exports = router;