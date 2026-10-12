import React, { useState } from 'react'
import { signup, login, friendlyAuthError } from '../auth'

// WEB-VERSION-ONLY account screen.
// Visitors can explore the site freely; an account (free, stored only in
// this browser) is required to build resumes. Nothing here hints that any
// other kind of account exists — verification happens in ../auth.js.
export default function Auth({ onAuth, onBack }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  function change(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  function switchMode(next) {
    setMode(next)
    setError('')
    setForm({ name: '', email: '', password: '' })
  }

  async function submit(e) {
    if (e) e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = mode === 'signup'
        ? await signup(form)
        : await login(form.email, form.password)
      onAuth(session)
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', padding: '20px' }}>
      <div className="glass-card" style={{ maxWidth: '440px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '20px',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '28px', boxShadow: '0 0 30px rgba(99,102,241,0.4)'
          }}>📝</div>
          <h2 style={{ margin: '0 0 6px', fontSize: '24px' }}>
            {mode === 'signup' ? 'Create your free account' : 'Welcome back'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
            {mode === 'signup'
              ? 'Free forever — your account lives only in this browser.'
              : 'Log in to continue building your resume.'}
          </p>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: '16px' }}>
          {mode === 'signup' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Full name</label>
              <input name="name" type="text" placeholder="e.g. Alex Johnson"
                value={form.name} onChange={change} autoComplete="name" />
            </div>
          )}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Email</label>
            <input name="email" type="email" placeholder="you@example.com"
              value={form.email} onChange={change} autoComplete="email" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Password</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input name="password" type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'signup' ? `At least 8 characters` : 'Your password'}
                value={form.password} onChange={change} style={{ flex: 1 }}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
              <button type="button" className="btn btn-secondary"
                onClick={() => setShowPassword(!showPassword)}
                style={{ padding: '10px 14px', fontSize: '14px', whiteSpace: 'nowrap', height: '44px', alignSelf: 'flex-end' }}>
                {showPassword ? '🙈 Hide' : '👁️ Show'}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" style={{
              padding: '10px 14px', backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)',
              color: '#fca5a5', fontSize: '13px'
            }}>{error}</div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading}
            style={{ width: '100%', padding: '14px', fontSize: '16px', marginTop: '4px' }}>
            {loading ? 'Please wait…' : (mode === 'signup' ? 'Create account' : 'Log in')}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', marginTop: '16px' }}>
          {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
          <button type="button" onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: 0 }}>
            {mode === 'signup' ? 'Log in' : 'Sign up free'}
          </button>
        </p>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
          🔒 Passwords are hashed. Resumes never leave this device.
        </p>

        {onBack && (
          <p style={{ textAlign: 'center', marginTop: '14px' }}>
            <button type="button" onClick={onBack}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>
              ← Back to home
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
