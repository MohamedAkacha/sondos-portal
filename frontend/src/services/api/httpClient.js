// =====================================================
// HTTP Client — shared fetch wrapper with 401 interceptor
// =====================================================

const API_BASE = '/api';

// Global auth failure callback (set by AuthProvider)
let _onAuthFailed = null;
export const setOnAuthFailed = (callback) => { _onAuthFailed = callback; };

// Token helpers
export const getToken = () => localStorage.getItem('auth_token');
export const setToken = (token) => localStorage.setItem('auth_token', token);

export const clearAllAuth = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
};

/**
 * Authenticated fetch to our backend API
 */
export async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = getToken();

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);
  const data = await response.json();

  // Global 401 interceptor
  if (response.status === 401) {
    clearAllAuth();
    if (_onAuthFailed) _onAuthFailed();
    throw new Error(data.message || 'الجلسة منتهية — يرجى تسجيل الدخول');
  }

  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }

  return data;
}


// ── Axios-like wrapper for new API files ──
const httpClient = {
  get: (url, config = {}) => {
    const params = config.params ? '?' + new URLSearchParams(config.params).toString() : '';
    return apiCall(url + params).then(data => ({ data }));
  },
  post: (url, body, config = {}) => {
    if (body instanceof FormData) {
      const token = getToken();
      return fetch(`/api${url}`, {
        method: 'POST',
        headers: { ...(token && { 'Authorization': `Bearer ${token}` }) },
        body,
      }).then(r => r.json()).then(data => ({ data }));
    }
    return apiCall(url, { method: 'POST', body: JSON.stringify(body) }).then(data => ({ data }));
  },
  put: (url, body) => apiCall(url, { method: 'PUT', body: JSON.stringify(body) }).then(data => ({ data })),
  patch: (url, body) => apiCall(url, { method: 'PATCH', body: JSON.stringify(body) }).then(data => ({ data })),
  delete: (url) => apiCall(url, { method: 'DELETE' }).then(data => ({ data })),
};

export default httpClient;