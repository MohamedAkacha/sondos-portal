import httpClient from './httpClient';

const analyticsAPI = {
  getOverview: (params) => httpClient.get('/api/analytics/overview', { params }),
  getCallAnalysis: (callId) => httpClient.get(`/api/analytics/call/${callId}`),
  getCallExtraction: (callId) => httpClient.get(`/api/analytics/extraction/${callId}`),
  analyzeCall: (callId) => httpClient.post(`/api/analytics/analyze/${callId}`),
  extractVariables: (callId) => httpClient.post(`/api/analytics/extract/${callId}`),

  // Extraction config
  getExtractionConfig: (agentId) => httpClient.get(`/api/extraction/config/${agentId}`),
  updateExtractionConfig: (agentId, data) => httpClient.put(`/api/extraction/config/${agentId}`, data),
  listExtractions: (params) => httpClient.get('/api/extraction/calls', { params }),
};

export default analyticsAPI;
