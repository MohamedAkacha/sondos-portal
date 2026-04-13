import httpClient from './httpClient';

const handoffAPI = {
  getQueue: (params) => httpClient.get('/api/handoff/queue', { params }),
  getStats: () => httpClient.get('/api/handoff/stats'),
  getById: (id) => httpClient.get(`/api/handoff/${id}`),
  assign: (id, assignedTo) => httpClient.post(`/api/handoff/${id}/assign`, { assignedTo }),
  startProgress: (id) => httpClient.post(`/api/handoff/${id}/start`),
  resolve: (id, resolution) => httpClient.post(`/api/handoff/${id}/resolve`, { resolution }),
};

export default handoffAPI;
