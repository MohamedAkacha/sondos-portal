// =====================================================
// Voice Service — Gallery + Clone + Model Tracking
// =====================================================
const Voice = require('../models/Voice');

const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY || '';
const ELEVEN_API_BASE = 'https://api.elevenlabs.io/v1';

// Cache
let voicesCache = null;
let voicesCacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

class VoiceService {

  // ── Get ElevenLabs voice gallery (cached) ──
  async getElevenLabsVoices() {
    if (!ELEVEN_API_KEY) throw Object.assign(new Error('ElevenLabs API key not configured'), { statusCode: 400 });

    const now = Date.now();
    if (voicesCache && (now - voicesCacheTime) < CACHE_TTL_MS) {
      return voicesCache;
    }

    const response = await fetch(`${ELEVEN_API_BASE}/voices`, {
      headers: { 'xi-api-key': ELEVEN_API_KEY, 'Accept': 'application/json' },
    });

    if (!response.ok) throw new Error(`ElevenLabs API error (${response.status})`);

    const data = await response.json();
    const voices = (data.voices || []).map(v => ({
      voiceId: v.voice_id,
      name: v.name,
      category: v.category,
      labels: v.labels || {},
      previewUrl: v.preview_url || '',
    }));

    voicesCache = voices;
    voicesCacheTime = now;
    return voices;
  }

  // ── Get OpenAI preset voices ──
  getOpenAIVoices() {
    return [
      { voiceId: 'alloy', name: 'Alloy', category: 'preset', labels: { gender: 'neutral' } },
      { voiceId: 'echo', name: 'Echo', category: 'preset', labels: { gender: 'male' } },
      { voiceId: 'fable', name: 'Fable', category: 'preset', labels: { gender: 'female' } },
      { voiceId: 'onyx', name: 'Onyx', category: 'preset', labels: { gender: 'male' } },
      { voiceId: 'nova', name: 'Nova', category: 'preset', labels: { gender: 'female' } },
      { voiceId: 'shimmer', name: 'Shimmer', category: 'preset', labels: { gender: 'female' } },
    ];
  }

  // ── Get user's cloned voices ──
  async getUserVoices(userId) {
    return await Voice.find({ userId, type: 'cloned' }).sort({ createdAt: -1 });
  }

  // ── Clone a voice via ElevenLabs ──
  async cloneVoice(userId, name, file) {
    if (!ELEVEN_API_KEY) throw Object.assign(new Error('ElevenLabs API key not configured'), { statusCode: 400 });

    // Create record first
    const voice = await Voice.create({
      userId,
      name,
      provider: 'elevenlabs',
      providerVoiceId: '',
      type: 'cloned',
      cloneStatus: 'processing',
      cloneFileName: file.originalname,
    });

    try {
      // Send to ElevenLabs
      const FormData = (await import('form-data')).default;
      const fs = require('fs');

      const formData = new FormData();
      formData.append('name', `sondos_${userId}_${name}`);
      formData.append('files', fs.createReadStream(file.path), file.originalname);
      formData.append('description', `Cloned voice for Sondos AI user`);

      const response = await fetch(`${ELEVEN_API_BASE}/voices/add`, {
        method: 'POST',
        headers: { 'xi-api-key': ELEVEN_API_KEY, ...formData.getHeaders() },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ElevenLabs clone error: ${errText}`);
      }

      const data = await response.json();
      voice.providerVoiceId = data.voice_id;
      voice.cloneStatus = 'ready';
      await voice.save();

      // Invalidate cache
      voicesCache = null;

      return voice;

    } catch (err) {
      voice.cloneStatus = 'failed';
      await voice.save();
      throw err;
    }
  }

  // ── Delete a cloned voice ──
  async deleteVoice(userId, voiceId) {
    const voice = await Voice.findOne({ _id: voiceId, userId });
    if (!voice) throw Object.assign(new Error('الصوت غير موجود'), { statusCode: 404 });

    // Delete from ElevenLabs if cloned
    if (voice.type === 'cloned' && voice.providerVoiceId && ELEVEN_API_KEY) {
      try {
        await fetch(`${ELEVEN_API_BASE}/voices/${voice.providerVoiceId}`, {
          method: 'DELETE',
          headers: { 'xi-api-key': ELEVEN_API_KEY },
        });
      } catch (err) {
        console.error('ElevenLabs voice delete error:', err.message);
      }
      voicesCache = null;
    }

    await voice.deleteOne();
    return voice;
  }
}

module.exports = new VoiceService();
