import axios from 'axios'

const base = (import.meta.env && import.meta.env.VITE_API_URL) ? import.meta.env.VITE_API_URL : 'http://localhost:5000'
const API = axios.create({ baseURL: base })

// Add auth header automatically from localStorage
API.interceptors.request.use(cfg => {
	const token = localStorage.getItem('token')
	if (token) cfg.headers['Authorization'] = `Bearer ${token}`
	return cfg
})

export default API
