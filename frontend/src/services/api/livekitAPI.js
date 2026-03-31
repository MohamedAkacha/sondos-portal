// =====================================================
// LiveKit API Service — Frontend → Backend
// ─────────────────────────────────────────────────────
// Token generation + Call records + Transcript
// =====================================================
import { apiCall } from './httpClient';

/**
 * Generate a LiveKit token for web call
 * @param {object} [options] - { roomName, sttProvider, llmModel, ttsVoice, systemPrompt }
 */
export async function getLivekitToken(options = {}) {
  return apiCall('/livekit/token', {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

/**
 * Check if LiveKit is configured on backend
 */
export async function getLivekitStatus() {
  return apiCall('/livekit/status');
}

// ── Call Records ──

/**
 * List LiveKit calls (paginated)
 * @param {object} [params] - { page, limit, status }
 */
export async function listLivekitCalls(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.status) query.set('status', params.status);
  if (params.phoneNumber) query.set('phoneNumber', params.phoneNumber);
  if (params.source) query.set('source', params.source);
  if (params.direction) query.set('direction', params.direction);
  const qs = query.toString();
  return apiCall(`/livekit/calls${qs ? `?${qs}` : ''}`);
}

/**
 * Get single call details
 * @param {string} callId
 */
export async function getLivekitCall(callId) {
  return apiCall(`/livekit/calls/${callId}`);
}

/**
 * Get call stats summary
 */
export async function getLivekitCallStats() {
  return apiCall('/livekit/calls/stats/summary');
}

/**
 * Save transcript entries for a call
 * @param {string} callId
 * @param {Array} entries - [{ speaker, text, timestamp }]
 */
export async function saveLivekitTranscript(callId, entries) {
  return apiCall(`/livekit/calls/${callId}/transcript`, {
    method: 'POST',
    body: JSON.stringify({ entries }),
  });
}