import axios from 'axios'

// The backend is OPTIONAL for the web version. When VITE_API_URL is not set,
// every call fails fast with a recognizable NO_BACKEND error instead of firing
// doomed requests at a static host — callers already fall back to local
// behaviour (offline polish, local storage, local feedback) in their catch blocks.
export const API_CONFIGURED = Boolean(import.meta.env && import.meta.env.VITE_API_URL)

const API = axios.create({
  baseURL: API_CONFIGURED ? import.meta.env.VITE_API_URL : '',
  timeout: 10000,
})

// Add auth header automatically from localStorage
API.interceptors.request.use(cfg => {
  if (!API_CONFIGURED) {
    const err = new Error('Online backend not configured (VITE_API_URL is unset)')
    err.code = 'NO_BACKEND'
    return Promise.reject(err)
  }
  const token = localStorage.getItem('token')
  if (token) cfg.headers['Authorization'] = `Bearer ${token}`
  return cfg
})

export default API
