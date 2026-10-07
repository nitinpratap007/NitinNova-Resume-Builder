import React, { useState } from 'react'
import API from '../api'

// Admin-only sign-in.
// The resume builder itself is fully offline-first and needs NO account.
// This screen exists solely so the admin can unlock the Cloud tab and the
// Admin Panel with a real backend JWT (issued by POST /auth/login).
// Falls back to offline verification when backend is unreachable.

const CURRENT_USER_KEY = 'nitinnova_current_user'

// Offline admin credentials (matches backend admin: nitin.202410@gmail.com / 9761183207)
const OFFLINE_ADMIN_EMAIL = 'nitin.202410@gmail.com'
const OFFLINE_ADMIN_PASSWORD = '9761183207'

export default function Auth({ onAuth }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function change(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  async function handleLogin(e) {
    if (e) e.preventDefault()
    setError('')
    if (!form.email || !form.password) {
      setError('Please enter admin email and password.')
      return
    }
    setLoading(true)
    let online = false
    try {
      const res = await API.post('/auth/login', { email: form.email, password: form.password })
      const data = res.data
      if (!data.ok || !data.token) {
        setError(data.error === 'invalid' ? 'Invalid admin credentials.' : 'Login failed.')
        return
      }
      localStorage.setItem('token', data.token)
      if (data.refresh) localStorage.setItem('refresh_token', data.refresh)
      localStorage.setItem('is_admin', data.is_admin ? '1' : '0')
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ email: form.email, role: data.is_admin ? 'admin' : 'user' }))
      onAuth({ token: data.token, is_admin: !!data.is_admin })
      online = true
    } catch (err) {
      const status = err && err.response && err.response.status
      if (status === 401 || status === 403) {
        setError('Invalid admin credentials.')
        return
      }
      // Network error — try offline verification
      if (form.email === OFFLINE_ADMIN_EMAIL && form.password === OFFLINE_ADMIN_PASSWORD) {
        const offlineToken = 'offline_admin_' + Date.now()
        localStorage.setItem('token', offlineToken)
        localStorage.setItem('is_admin', '1')
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ email: form.email, role: 'admin' }))
        onAuth({ token: offlineToken, is_admin: true })
        online = false
      } else {
        setError('Invalid admin credentials.')
        return
      }
    } finally {
      setLoading(false)
    }
    if (!online) {
      // Show a subtle notice that we're in offline mode
      setError('⚠️ Offline mode — Cloud sync unavailable. Admin Panel works locally.')
      setTimeout(() => setError(''), 5000)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', padding: '20px' }}>
      <div className="glass-card" style={{ maxWidth: '440px', width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '20px',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '28px', boxShadow: '0 0 30px rgba(99,102,241,0.4)'
          }}>🛡️</div>
          <h2 style={{ margin: '0 0 6px', fontSize: '24px' }}>Admin Access</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            Sign in to manage the Cloud tab and Admin Panel
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'grid', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Email</label>
            <input name="email" type="email" placeholder="admin@example.com" value={form.email} onChange={change} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Password</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter admin password" value={form.password} onChange={change} style={{ flex: 1 }} />
              <button type="button" className="btn btn-secondary" onClick={() => setShowPassword(!showPassword)} style={{ padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap', height: '44px', alignSelf: 'flex-end' }}>
                {showPassword ? '🙈 Hide' : '👁️ Show'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)',
              color: '#fca5a5', fontSize: '13px'
            }}>❌ {error}</div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading}
            style={{ width: '100%', padding: '14px', fontSize: '16px', marginTop: '4px' }}>
            {loading ? 'Signing in…' : '🛡️ Admin Login'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px' }}>
          The resume builder works without an account — sign-in is only needed for admin features.
        </p>
      </div>
    </div>
  )
}