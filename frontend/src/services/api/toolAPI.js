import httpClient from './httpClient';

const toolAPI = {
  getAll: (params) => httpClient.get('/api/tools', { params }),
  getById: (id) => httpClient.get(`/api/tools/${id}`),
  getBuiltIn: () => httpClient.get('/api/tools/built-in'),
  create: (data) => httpClient.post('/api/tools', data),
  update: (id, data) => httpClient.put(`/api/tools/${id}`, data),
  delete: (id) => httpClient.delete(`/api/tools/${id}`),
  test: (id, params) => httpClient.post(`/api/tools/${id}/test`, params),
  toggle: (id) => httpClient.post(`/api/tools/${id}/toggle`),
  getForAgent: (agentId) => httpClient.get(`/api/agents/${agentId}/tools`),
};

export default toolAPI;
