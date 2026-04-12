import httpClient from './httpClient';

const knowledgeAPI = {
  // Knowledge Bases
  getAllBases: () => httpClient.get('/api/knowledge/bases'),
  getBase: (id) => httpClient.get(`/api/knowledge/bases/${id}`),
  createBase: (data) => httpClient.post('/api/knowledge/bases', data),
  updateBase: (id, data) => httpClient.put(`/api/knowledge/bases/${id}`, data),
  deleteBase: (id) => httpClient.delete(`/api/knowledge/bases/${id}`),

  // Documents
  getDocuments: (baseId) => httpClient.get(`/api/knowledge/bases/${baseId}/documents`),
  uploadDocument: (baseId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return httpClient.post(`/api/knowledge/bases/${baseId}/documents/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  addUrl: (baseId, url) => httpClient.post(`/api/knowledge/bases/${baseId}/documents/url`, { url }),
  addFaq: (baseId, question, answer) => httpClient.post(`/api/knowledge/bases/${baseId}/documents/faq`, { question, answer }),
  deleteDocument: (docId) => httpClient.delete(`/api/knowledge/documents/${docId}`),

  // Search
  search: (query, topK) => httpClient.post('/api/knowledge/search', { query, topK }),
};

export default knowledgeAPI;
