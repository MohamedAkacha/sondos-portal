// =====================================================
// Voice Controller — إدارة أصوات ElevenLabs
// ─────────────────────────────────────────────────────
// GET  /api/voices/elevenlabs      — fetch available voices
// POST /api/voices/clone           — instant voice clone
// DELETE /api/voices/:voiceId      — delete cloned voice
// Caches results for 1 hour to avoid rate limits
// =====================================================

const Subscription = require('../models/Subscription');
const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY || '';
const ELEVEN_API_BASE = 'https://api.elevenlabs.io/v1';

// ── In-memory cache (1 hour) ──
let voicesCache = null;
let voicesCacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ══════════════════════════════════════════════════════
// GET /api/voices/elevenlabs — List available voices
// ══════════════════════════════════════════════════════
exports.getElevenLabsVoices = async (req, res) => {
  try {
    if (!ELEVEN_API_KEY) {
      return res.status(400).json({
        success: false,
        message: 'مفتاح ElevenLabs API غير مُعد — أضف ELEVEN_API_KEY في متغيرات البيئة',
      });
    }

    // ── Return cached if fresh ──
    const now = Date.now();
    if (voicesCache && (now - voicesCacheTime) < CACHE_TTL_MS) {
      console.log('[Voices] Returning cached ElevenLabs voices');
      return res.json({ success: true, voices: voicesCache, cached: true });
    }

    // ── Fetch from ElevenLabs ──
    console.log('[Voices] Fetching voices from ElevenLabs API...');
    const response = await fetch(`${ELEVEN_API_BASE}/voices`, {
      headers: {
        'xi-api-key': ELEVEN_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Voices] ElevenLabs API error (${response.status}):`, errText);
      return res.status(response.status).json({
        success: false,
        message: `فشل جلب الأصوات من ElevenLabs (${response.status})`,
      });
    }

    const data = await response.json();
    const rawVoices = data.voices || [];

    // ── Transform to clean format ──
    const voices = rawVoices.map(v => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category || 'unknown',       // premade, cloned, generated
      preview_url: v.preview_url || null,
      labels: v.labels || {},                    // { accent, gender, age, language, ... }
      description: v.description || '',
      // Useful for UI display
      gender: v.labels?.gender || '',
      language: v.labels?.language || '',
      accent: v.labels?.accent || '',
      use_case: v.labels?.use_case || v.labels?.['use case'] || '',
    }));

    // ── Update cache ──
    voicesCache = voices;
    voicesCacheTime = now;

    console.log(`[Voices] Fetched ${voices.length} voices from ElevenLabs (cached for 1hr)`);

    res.json({
      success: true,
      voices,
      total: voices.length,
      cached: false,
    });
  } catch (error) {
    console.error('[Voices] Error:', error.message);
    res.status(500).json({ success: false, message: 'فشل جلب الأصوات' });
  }
};

// ══════════════════════════════════════════════════════
// POST /api/voices/elevenlabs/clear-cache — Admin only
// ══════════════════════════════════════════════════════
exports.clearVoicesCache = async (req, res) => {
  voicesCache = null;
  voicesCacheTime = 0;
  console.log('[Voices] Cache cleared');
  res.json({ success: true, message: 'تم مسح الذاكرة المؤقتة' });
};


// ══════════════════════════════════════════════════════
// POST /api/voices/clone — Instant Voice Clone
// ══════════════════════════════════════════════════════
exports.cloneVoice = async (req, res) => {
  try {
    if (!ELEVEN_API_KEY) {
      return res.status(400).json({ success: false, message: 'مفتاح ElevenLabs API غير مُعد' });
    }

    // ── Step 23: Check plan limit for cloned voices ──
    const userId = req.user._id;
    const subscription = await Subscription.findOne({ user: userId, status: 'active' }).populate('plan');
    const maxCloned = subscription?.plan?.limits?.maxClonedVoices ?? 1;

    // Count current cloned voices from ElevenLabs
    try {
      const voicesRes = await fetch(`${ELEVEN_API_BASE}/voices`, {
        headers: { 'xi-api-key': ELEVEN_API_KEY, 'Accept': 'application/json' },
      });
      if (voicesRes.ok) {
        const voicesData = await voicesRes.json();
        const clonedCount = (voicesData.voices || []).filter(v => v.category === 'cloned').length;
        if (clonedCount >= maxCloned) {
          return res.status(403).json({
            success: false,
            message: `وصلت للحد الأقصى من الأصوات المستنسخة (${maxCloned}). احذف صوت أو رقّي باقتك.`,
          });
        }
      }
    } catch (limitErr) {
      console.warn('[Voice Clone] Could not check clone limit:', limitErr.message);
      // Continue anyway — don't block on limit check failure
    }

    const { name, description } = req.body;
    const files = req.files;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'اسم الصوت مطلوب' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'يرجى رفع ملف صوتي واحد على الأقل' });
    }

    // ── Build multipart form for ElevenLabs ──
    const formData = new FormData();
    formData.append('name', name.trim());
    if (description) formData.append('description', description.trim());
    formData.append('remove_background_noise', 'true');
    formData.append('labels', JSON.stringify({
      language: req.body.language || 'ar',
      gender: req.body.gender || '',
    }));

    // Append audio files
    for (const file of files) {
      const blob = new Blob([file.buffer], { type: file.mimetype });
      formData.append('files', blob, file.originalname);
    }

    console.log(`[Voice Clone] Cloning voice "${name}" with ${files.length} file(s)...`);

    const response = await fetch(`${ELEVEN_API_BASE}/voices/add`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Voice Clone] ElevenLabs error (${response.status}):`, errText);

      let userMessage = 'فشل استنساخ الصوت';
      if (response.status === 401) userMessage = 'مفتاح ElevenLabs غير صالح';
      else if (response.status === 403) userMessage = 'باقتك لا تدعم استنساخ الأصوات — يرجى ترقية الباقة';
      else if (response.status === 429) userMessage = 'تجاوزت حد الطلبات — حاول بعد قليل';

      return res.status(response.status).json({ success: false, message: userMessage });
    }

    const data = await response.json();
    const voiceId = data.voice_id;

    console.log(`[Voice Clone] ✅ Voice cloned: "${name}" → ${voiceId}`);

    // ── Invalidate cache so new voice appears ──
    voicesCache = null;
    voicesCacheTime = 0;

    res.json({
      success: true,
      voice_id: voiceId,
      name: name.trim(),
      message: 'تم استنساخ الصوت بنجاح',
    });
  } catch (error) {
    console.error('[Voice Clone] Error:', error.message);
    res.status(500).json({ success: false, message: 'فشل استنساخ الصوت' });
  }
};


// ══════════════════════════════════════════════════════
// DELETE /api/voices/:voiceId — Delete a cloned voice
// ══════════════════════════════════════════════════════
exports.deleteVoice = async (req, res) => {
  try {
    if (!ELEVEN_API_KEY) {
      return res.status(400).json({ success: false, message: 'مفتاح ElevenLabs API غير مُعد' });
    }

    const { voiceId } = req.params;
    if (!voiceId) {
      return res.status(400).json({ success: false, message: 'معرّف الصوت مطلوب' });
    }

    console.log(`[Voice Delete] Deleting voice: ${voiceId}`);

    const response = await fetch(`${ELEVEN_API_BASE}/voices/${voiceId}`, {
      method: 'DELETE',
      headers: {
        'xi-api-key': ELEVEN_API_KEY,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Voice Delete] ElevenLabs error (${response.status}):`, errText);
      return res.status(response.status).json({ success: false, message: 'فشل حذف الصوت' });
    }

    console.log(`[Voice Delete] ✅ Voice deleted: ${voiceId}`);

    // ── Invalidate cache ──
    voicesCache = null;
    voicesCacheTime = 0;

    res.json({ success: true, message: 'تم حذف الصوت بنجاح' });
  } catch (error) {
    console.error('[Voice Delete] Error:', error.message);
    res.status(500).json({ success: false, message: 'فشل حذف الصوت' });
  }
};