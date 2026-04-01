// =====================================================
// Phone Numbers API — دوال أرقام الهاتف
// =====================================================
import { apiCall } from './httpClient';

export const phoneAPI = {
  list: () => apiCall('/phones'),
  get: (id) => apiCall(`/phones/${id}`),
  getProviders: () => apiCall('/phones/providers'),
  getSipInfo: () => apiCall('/phones/sip-info'),
  searchAvailable: (provider, country, contains) =>
    apiCall(`/phones/available?provider=${provider}&country=${country}${contains ? `&contains=${contains}` : ''}&limit=10`),
  purchase: (data) => apiCall('/phones/purchase', { method: 'POST', body: JSON.stringify(data) }),
  addCustom: (data) => apiCall('/phones/custom', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiCall(`/phones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiCall(`/phones/${id}`, { method: 'DELETE' }),
  setupSip: (id) => apiCall(`/phones/${id}/setup-sip`, { method: 'POST' }),
  healthCheck: (id) => apiCall(`/phones/${id}/health`),
  toggle: (id) => apiCall(`/phones/${id}/toggle`, { method: 'POST' }),
  outbound: (id, destination) => apiCall(`/phones/${id}/outbound`, { method: 'POST', body: JSON.stringify({ destination }) }),
};
