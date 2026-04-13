import httpClient from './httpClient';

const chatAPI = {
  startSession: (agentId, data) => httpClient.post(`/api/chat/${agentId}/sessions`, data),
  getSessions: (params) => httpClient.get('/api/chat/sessions', { params }),
  getSession: (sessionId) => httpClient.get(`/api/chat/sessions/${sessionId}`),
  sendMessage: (sessionId, message) => httpClient.post(`/api/chat/sessions/${sessionId}/message`, { message }),
  endSession: (sessionId) => httpClient.delete(`/api/chat/sessions/${sessionId}`),
};

export default chatAPI;
