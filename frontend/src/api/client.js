import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 60000
});

// Request Interceptor: Attach JWT Token if stored
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pb_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Normalize Errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    let message = error.response?.data?.detail || error.message;

    if (!error.response || error.code === 'ERR_NETWORK') {
      message = 'Backend server is not running on http://localhost:8000. Please start the backend service using uvicorn app.main:app --port 8000.';
    }

    if (status === 401 && window.location.pathname.startsWith('/app')) {
      localStorage.removeItem('pb_token');
      window.location.href = '/login';
    }

    console.warn(`API Notification (${status || 'Network'}):`, message);
    return Promise.reject(new Error(message));
  }
);

export const authApi = {
  login: (data) => apiClient.post('/auth/login', data),
  logout: () => apiClient.post('/auth/logout'),
  getMe: () => apiClient.get('/auth/me')
};

export const userApi = {
  getMe: () => apiClient.get('/users/me'),
  updateMe: (data) => apiClient.put('/users/me', data),
  changePassword: (data) => apiClient.post('/users/me/change-password', data)
};

export const dashboardApi = {
  getSummary: () => apiClient.get('/dashboard/summary')
};

export const doctorApi = {
  create: (data) => apiClient.post('/doctors', data),
  list: () => apiClient.get('/doctors'),
  get: (id) => apiClient.get(`/doctors/${id}`)
};

export const avatarLookApi = {
  list: () => apiClient.get('/avatar-looks'),
  get: (id) => apiClient.get(`/avatar-looks/${id}`)
};

export const avatarScenarioApi = {
  create: (data) => apiClient.post('/avatar-scenarios', data),
  uploadPhoto: (formData) => apiClient.post('/avatar-scenarios/upload-photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  createBaseAvatar: (formData) => apiClient.post('/avatar-scenarios/create-base-avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  generateLook: (formData) => apiClient.post('/avatar-scenarios/generate-look', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getStatus: (id) => apiClient.get(`/avatar-scenarios/${id}/status`),
  list: (doctorId) => apiClient.get('/avatar-scenarios', { params: { doctor_id: doctorId } }),
  get: (id) => apiClient.get(`/avatar-scenarios/${id}`),
  update: (id, data) => apiClient.put(`/avatar-scenarios/${id}`, data),
  delete: (id) => apiClient.delete(`/avatar-scenarios/${id}`)
};



export const voiceApi = {
  create: (data) => apiClient.post('/voices', data),
  list: (doctorId) => apiClient.get('/voices', { params: { doctor_id: doctorId } }),
  get: (id) => apiClient.get(`/voices/${id}`),
  delete: (id) => apiClient.delete(`/voices/${id}`)
};

export const heyGenApi = {
  getAvatars: () => apiClient.get('/heygen/avatars'),
  getAvatarsV3: () => apiClient.get('/heygen/avatars-v3'),
  getVoices: () => apiClient.get('/heygen/voices'),
  uploadPhotoAvatar: (formData) => apiClient.post('/heygen/photo-avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
};

export const videoApi = {
  generate: (data) => apiClient.post('/videos/generate', data),
  getStatus: (id) => apiClient.get(`/videos/${id}/status`),
  list: (doctorId) => apiClient.get('/videos', { params: { doctor_id: doctorId } }),
  get: (id) => apiClient.get(`/videos/${id}`)
};

export const publicApi = {
  getPublicVideo: (token) => apiClient.get(`/public/watch/${token}`)
};
