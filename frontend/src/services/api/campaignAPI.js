// =====================================================
// Campaign API — حملات المكالمات الصادرة
// =====================================================
import { apiCall } from './httpClient';

export const campaignAPI = {
  list: (status) => apiCall(`/campaigns${status ? `?status=${status}` : ''}`),
  get: (id) => apiCall(`/campaigns/${id}`),
  create: (data) => apiCall('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiCall(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiCall(`/campaigns/${id}`, { method: 'DELETE' }),
  start: (id) => apiCall(`/campaigns/${id}/start`, { method: 'POST' }),
  pause: (id) => apiCall(`/campaigns/${id}/pause`, { method: 'POST' }),
  results: (id) => apiCall(`/campaigns/${id}/results`),
};
