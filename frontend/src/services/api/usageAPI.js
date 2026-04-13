import httpClient from './httpClient';

const usageAPI = {
  getCurrent: () => httpClient.get('/api/usage/current'),
  getHistory: (params) => httpClient.get('/api/usage/history', { params }),
  getBreakdown: (params) => httpClient.get('/api/usage/breakdown', { params }),
  getDailyUsage: (days) => httpClient.get('/api/usage/daily', { params: { days } }),
  getStats: () => httpClient.get('/api/usage/stats'),
};

export default usageAPI;
