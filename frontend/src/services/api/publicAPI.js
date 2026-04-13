import httpClient from './httpClient';

export const apikeyAPI = {
  getAll: () => httpClient.get('/api/apikeys'),
  create: (data) => httpClient.post('/api/apikeys', data),
  delete: (id) => httpClient.delete(`/api/apikeys/${id}`),
  toggle: (id) => httpClient.post(`/api/apikeys/${id}/toggle`),
};

export const webhookAPI = {
  getAll: () => httpClient.get('/api/webhooks'),
  getById: (id) => httpClient.get(`/api/webhooks/${id}`),
  create: (data) => httpClient.post('/api/webhooks', data),
  update: (id, data) => httpClient.put(`/api/webhooks/${id}`, data),
  delete: (id) => httpClient.delete(`/api/webhooks/${id}`),
  test: (id) => httpClient.post(`/api/webhooks/${id}/test`),
};
