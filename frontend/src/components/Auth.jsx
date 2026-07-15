import React, { useState } from 'react'

// Offline auth helpers using localStorage
const USERS_KEY = 'nitinnova_users'
const CURRENT_USER_KEY = 'nitinnova_current_user'

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
  } catch { return [] }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function change(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
    setSuccess('')
  }

  function handleLogin(e) {
    if (e) e.preventDefault()
    setError('')
    if (!form.email || !form.password) {
      setError('Please enter email and password.')
      return
    }

    if (mode === 'admin') {
      if (form.email === 'nitin.202410@gmail.com' && form.password === 'nitin@9761183207') {
        const token = 'admin_' + Date.now()
        localStorage.setItem('token', token)
        localStorage.setItem('is_admin', '1')
        const adminUser = { name: 'Admin Nitin', email: 'nitin.202410@gmail.com', role: 'admin' }
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(adminUser))
        onAuth({ token, is_admin: true })
        return
      } else {
        setError('Invalid admin credentials.')
        return
      }
    }

    const users = getUsers()
    const user = users.find(u => u.email === form.email && u.password === form.password)
    if (!user) {
      setError('Invalid email or password. Sign up if you are a new user.')
      return
    }
    // Save session
    const token = 'offline_' + Date.now()
    localStorage.setItem('token', token)
    localStorage.setItem('is_admin', '0')
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user))
    onAuth({ token, is_admin: false })
  }

  function handleSignup(e) {
    if (e) e.preventDefault()
    setError('')
    if (!form.name || !form.email || !form.password) {
      setError('Please fill in all fields.')
      return
    }
    if (form.password.length < 4) {
      setError('Password must be at least 4 characters.')
      return
    }
    const users = getUsers()
    if (users.find(u => u.email === form.email)) {
      setError('An account with this email already exists. Please log in.')
      return
    }
    const newUser = { name: form.name, email: form.email, password: form.password, createdAt: new Date().toISOString() }
    saveUsers([...users, newUser])
    // Auto login
    const token = 'offline_' + Date.now()
    localStorage.setItem('token', token)
    localStorage.setItem('is_admin', '0')
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser))
    setSuccess('Account created successfully!')
    setTimeout(() => onAuth({ token, is_admin: false }), 500)
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
          }}>🚀</div>
          <h2 style={{ margin: '0 0 6px', fontSize: '26px' }}>Welcome to NitinNova</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            {mode === 'login' ? 'Sign in to your account' : mode === 'signup' ? 'Create a new account' : 'Admin Access Only'}
          </p>
        </div>

        {/* Mode Toggle */}
        <div style={{
          display: 'flex', gap: '4px', padding: '4px', marginBottom: '24px',
          backgroundColor: 'rgba(15,23,42,0.4)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          overflowX: 'auto'
        }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); setSuccess('') }}
            style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: 'var(--radius-md)',
              cursor: 'pointer', fontWeight: 600, fontSize: '14px', fontFamily: 'var(--font-body)',
              transition: 'all 0.25s',
              backgroundColor: mode === 'login' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: mode === 'login' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: mode === 'login' ? 'var(--shadow-sm)' : 'none'
            }}
          >Sign In</button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); setSuccess('') }}
            style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: 'var(--radius-md)',
              cursor: 'pointer', fontWeight: 600, fontSize: '14px', fontFamily: 'var(--font-body)',
              transition: 'all 0.25s',
              backgroundColor: mode === 'signup' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: mode === 'signup' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: mode === 'signup' ? 'var(--shadow-sm)' : 'none'
            }}
          >Sign Up</button>
          <button
            type="button"
            onClick={() => { setMode('admin'); setError(''); setSuccess('') }}
            style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: 'var(--radius-md)',
              cursor: 'pointer', fontWeight: 600, fontSize: '14px', fontFamily: 'var(--font-body)',
              transition: 'all 0.25s',
              backgroundColor: mode === 'admin' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: mode === 'admin' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: mode === 'admin' ? 'var(--shadow-sm)' : 'none'
            }}
          >Admin</button>
        </div>

        {/* Form */}
        <form onSubmit={mode === 'signup' ? handleSignup : handleLogin} style={{ display: 'grid', gap: '16px' }}>
          {mode === 'signup' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Full Name</label>
              <input name="name" placeholder="Enter your name" value={form.name} onChange={change} />
            </div>
          )}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Email</label>
            <input name="email" type="email" placeholder="your.email@example.com" value={form.email} onChange={change} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Password</label>
            <input name="password" type="password" placeholder="Enter password" value={form.password} onChange={change} />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)',
              color: '#fca5a5', fontSize: '13px'
            }}>❌ {error}</div>
          )}

          {success && (
            <div style={{
              padding: '10px 14px', backgroundColor: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-sm)',
              color: '#6ee7b7', fontSize: '13px'
            }}>✅ {success}</div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px', marginTop: '4px' }}>
            {mode === 'signup' ? '✨ Create Account' : mode === 'admin' ? '🛡️ Admin Login' : '🔓 Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px' }}>
          🔒 All data is stored locally on your device. Works 100% offline.
        </p>
      </div>
    </div>
  )
}
