import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api', withCredentials: true });
let accessToken = sessionStorage.getItem('accessToken');
export function setToken(token: string | null) { accessToken = token; token ? sessionStorage.setItem('accessToken', token) : sessionStorage.removeItem('accessToken'); }
api.interceptors.request.use(config => { if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`; return config; });
api.interceptors.response.use(r => r, async err => { const original = err.config; if (err.response?.status === 401 && !original?._retry && !original?.url?.includes('/auth/')) { original._retry = true; try { const r = await api.post('/auth/refresh'); setToken(r.data.accessToken); original.headers.Authorization = `Bearer ${r.data.accessToken}`; return api(original); } catch {} } return Promise.reject(err); });
