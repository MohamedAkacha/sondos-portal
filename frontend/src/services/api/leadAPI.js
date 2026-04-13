import httpClient from './httpClient';

const leadAPI = {
  getAll: (params) => httpClient.get('/api/leads', { params }),
  getById: (id) => httpClient.get(`/api/leads/${id}`),
  create: (data) => httpClient.post('/api/leads', data),
  update: (id, data) => httpClient.put(`/api/leads/${id}`, data),
  delete: (id) => httpClient.delete(`/api/leads/${id}`),
  bulkDelete: (ids) => httpClient.post('/api/leads/bulk-delete', { ids }),
  updateStatus: (id, status) => httpClient.patch(`/api/leads/${id}/status`, { status }),
  importCSV: (rows) => httpClient.post('/api/leads/import', { rows }),
  exportCSV: (params) => httpClient.get('/api/leads/export', { params }),
  getStats: () => httpClient.get('/api/leads/stats'),
};

export default leadAPI;
