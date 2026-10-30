import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const api = axios.create({ baseURL: API_BASE });

export const tokens = {
  get access() { return localStorage.getItem('accessToken'); },
  get refresh() { return localStorage.getItem('refreshToken'); },
  save({ accessToken, refreshToken }) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },
  clear() {
    ['accessToken', 'refreshToken', 'user'].forEach(k => localStorage.removeItem(k));
  },
};

api.interceptors.request.use(config => {
  if (tokens.access) config.headers.Authorization = `Bearer ${tokens.access}`;
  return config;
});

// Silent refresh. Exactly one refresh request is in flight at a time; every 401 that arrives meanwhile
// waits on the same promise and is replayed with the new token. Refresh tokens rotate on every use,
// so two parallel refreshes would trip the server's reuse detection and log the user out.
let refreshInFlight = null;

function refreshTokens() {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${API_BASE}/auth/refresh`, { refreshToken: tokens.refresh })
      .then(({ data }) => { tokens.save(data); return data.accessToken; })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

api.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config;
    const isAuthCall = original?.url?.startsWith('/auth/login') || original?.url?.startsWith('/auth/refresh');
    if (error.response?.status !== 401 || original._retried || isAuthCall || !tokens.refresh) {
      return Promise.reject(error);
    }
    original._retried = true;
    try {
      const accessToken = await refreshTokens();
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (refreshError) {
      tokens.clear();
      window.dispatchEvent(new Event('auth:expired'));
      return Promise.reject(refreshError);
    }
  },
);

/** The server's ApiError message (or a field error), falling back to a generic line. */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data;
  if (data?.fieldErrors && Object.keys(data.fieldErrors).length) return Object.values(data.fieldErrors)[0];
  if (data?.message) return data.message;
  if (!error?.response) return 'Cannot reach the server. Is the API gateway running on ' + API_BASE + '?';
  return fallback;
}

const withCorrelation = id => (id ? { headers: { 'X-Correlation-Id': id } } : {});

export const authApi = {
  login: body => api.post('/auth/login', body),
  register: body => api.post('/auth/register', body),
  logout: () => api.post('/auth/logout', { refreshToken: tokens.refresh }),
  logoutAll: () => api.post('/auth/logout-all'),
  profile: () => api.get('/auth/profile'),
  updateProfile: body => api.put('/auth/profile', body),
  sessions: () => api.get('/auth/sessions'),
  instructors: () => api.get('/auth/instructors'),
  directory: ids => api.get('/auth/directory', { params: { ids: [...new Set(ids)].join(',') } }),
  users: params => api.get('/auth/users', { params }),
  userStats: () => api.get('/auth/users/stats'),
  createInstructor: body => api.post('/auth/users/instructors', body),
  updateUser: (id, body) => api.put(`/auth/users/${id}`, body),
  setUserActive: (id, active) => api.put(`/auth/users/${id}/status`, null, { params: { active } }),
};

export const courseApi = {
  list: params => api.get('/courses', { params }),
  get: id => api.get(`/courses/${id}`),
  whoami: () => api.get('/courses/whoami'),
  create: body => api.post('/courses', body),
  update: (id, body) => api.put(`/courses/${id}`, body),
  remove: id => api.delete(`/courses/${id}`),
};

export const enrollmentApi = {
  hold: (courseId, correlationId) => api.post('/enrollments', { courseId }, withCorrelation(correlationId)),
  joinWaitlist: courseId => api.post('/enrollments/waitlist', null, { params: { courseId } }),
  mine: () => api.get('/enrollments/my'),
  get: id => api.get(`/enrollments/${id}`),
  cancel: id => api.put(`/enrollments/${id}/cancel`),
  roster: courseId => api.get(`/enrollments/course/${courseId}/roster`),
  search: params => api.get('/enrollments', { params }),
  stats: () => api.get('/enrollments/stats'),
};

export const paymentApi = {
  pay: (body, idempotencyKey, correlationId) => api.post('/payments', body, {
    headers: { 'Idempotency-Key': idempotencyKey, ...(correlationId ? { 'X-Correlation-Id': correlationId } : {}) },
  }),
  mine: () => api.get('/payments/my'),
  get: id => api.get(`/payments/${id}`),
  refund: id => api.post(`/payments/${id}/refund`),
  search: params => api.get('/payments', { params }),
  stats: () => api.get('/payments/stats'),
};

export const notificationApi = {
  mine: () => api.get('/notifications/my'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: id => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export const adminApi = {
  registry: () => api.get('/admin/registry'),
  trace: correlationId => api.get(`/admin/trace/${correlationId}`),
  circuitBreakers: () => api.get('/admin/circuitbreakers'),
};

export default api;
