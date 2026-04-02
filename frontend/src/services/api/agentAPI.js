// =====================================================
// Agent API Service — Frontend → Backend
// ─────────────────────────────────────────────────────
// CRUD + Chat + Templates + Suggestions
// =====================================================
import { apiCall } from './httpClient';

// ══════════════════════════════════════════════════════
// CRUD
// ══════════════════════════════════════════════════════

/**
 * List all agents for current user
 */
export async function listAgents() {
  return apiCall('/agents');
}

/**
 * Get single agent details
 * @param {string} agentId
 */
export async function getAgent(agentId) {
  return apiCall(`/agents/${agentId}`);
}

/**
 * Create a new agent
 * @param {object} data - { name, description, templateId, personality, language, greeting, voice, llm, ... }
 */
export async function createAgent(data) {
  return apiCall('/agents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing agent
 * @param {string} agentId
 * @param {object} data - fields to update
 */
export async function updateAgent(agentId, data) {
  return apiCall(`/agents/${agentId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Delete an agent
 * @param {string} agentId
 */
export async function deleteAgent(agentId) {
  return apiCall(`/agents/${agentId}`, {
    method: 'DELETE',
  });
}

// ══════════════════════════════════════════════════════
// Templates
// ══════════════════════════════════════════════════════

/**
 * Get available agent templates
 */
export async function getAgentTemplates() {
  return apiCall('/agents/templates');
}

// ══════════════════════════════════════════════════════
// Chat Test
// ══════════════════════════════════════════════════════

/**
 * Send a chat message to test the agent
 * @param {string} agentId
 * @param {Array} messages - [{ role: 'user'|'assistant', content: '...' }]
 */
export async function chatWithAgent(agentId, messages) {
  return apiCall(`/agents/${agentId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
}

// ══════════════════════════════════════════════════════
// AI Suggestions
// ══════════════════════════════════════════════════════

/**
 * Get AI-generated suggestions for greeting or instructions
 * @param {object} params - { role, companyName, type: 'greeting'|'instructions' }
 */
export async function suggestContent(params) {
  return apiCall('/agents/suggest', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ══════════════════════════════════════════════════════
// ElevenLabs Voices
// ══════════════════════════════════════════════════════

/**
 * Get available ElevenLabs voices (cached 1hr on backend)
 * @returns {{ success: boolean, voices: Array<{ voice_id, name, category, preview_url, labels, gender, language }> }}
 */
export async function getElevenLabsVoices() {
  return apiCall('/voices/elevenlabs');
}

/**
 * Clone a voice using ElevenLabs Instant Voice Cloning
 * @param {FormData} formData - must include: name, files (audio blobs)
 * @returns {{ success: boolean, voice_id: string, name: string }}
 */
export async function cloneVoice(formData) {
  const token = (await import('./httpClient')).getToken();
  const response = await fetch('/api/voices/clone', {
    method: 'POST',
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
      // No Content-Type — browser sets multipart boundary automatically
    },
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
  return data;
}

/**
 * Delete a cloned voice from ElevenLabs
 * @param {string} voiceId
 */
export async function deleteVoice(voiceId) {
  return apiCall(`/voices/${voiceId}`, { method: 'DELETE' });
}

/**
 * Get agent's LiveKit config (for voice test)
 * @param {string} agentId
 */
export async function getAgentLiveKitConfig(agentId) {
  return apiCall(`/agents/${agentId}/livekit-config`);
}
