import React, { useState, useEffect } from 'react'
import { App as CapApp } from '@capacitor/app'
import { Toast } from '@capacitor/toast'
import { Share } from '@capacitor/share'
import API from './api'
import Form from './components/Form'
import Preview from './components/Preview'
import Auth from './components/Auth'
import Developer from './components/Developer'
import Feedback from './components/Feedback'
import AdminPanel from './components/AdminPanel'
import CoverLetter from './components/CoverLetter'
import Dashboard from './components/Dashboard'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('App crash:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#f8fafc', minHeight: '100vh', background: '#090d16' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '12px' }}>Something went wrong</h2>
          <p style={{ color: '#94a3b8', marginBottom: '20px' }}>{this.state.error?.message || 'Unknown error'}</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
            style={{ padding: '12px 24px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', cursor: 'pointer' }}>
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const initialToken = localStorage.getItem('token')
  const [polished, setPolished] = useState(null)
  const [savedId, setSavedId] = useState(null)
  const [route, setRoute] = useState('home')
  const [auth, setAuth] = useState({
    token: initialToken,
    is_admin: localStorage.getItem('is_admin') === '1'
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileToLoad, setProfileToLoad] = useState(null)
  const [saveTrigger, setSaveTrigger] = useState(0)
  const [appSettings, setAppSettings] = useState({
    appName: 'NitinNova',
    appTagline: 'CareerCraft by Nitin Pratap',
    primaryColor: '#6366f1',
    showShareButton: true,
  })

  useEffect(() => { setSidebarOpen(false) }, [route])

  useEffect(() => {
    fetchAppSettings()
  }, [])

  async function fetchAppSettings() {
    // Local (admin-saved offline) settings apply first, server can override
    try {
      const local = JSON.parse(localStorage.getItem('nitinnova_admin_settings') || 'null')
      if (local) applyAppSettings(local)
    } catch {}
    try {
      const res = await API.get('/api/admin-settings')
      if (res.data.ok) applyAppSettings(res.data.settings)
    } catch {}
  }

  function applyAppSettings(s) {
    const updated = {
      appName: s.appName || 'NitinNova',
      appTagline: s.appTagline || 'CareerCraft by Nitin Pratap',
      primaryColor: s.primaryColor || '#6366f1',
      showShareButton: s.showShareButton !== 'false' && s.showShareButton !== false,
    }
    setAppSettings(updated)
    document.title = `${updated.appName} - ${updated.appTagline}`
    if (updated.primaryColor && updated.primaryColor !== '#6366f1') {
      document.documentElement.style.setProperty('--primary', updated.primaryColor)
    }
  }

  useEffect(() => {
    let lastTime = 0
    const listener = CapApp.addListener('backButton', () => {
      if (route !== 'home' && route !== 'auth') {
        setRoute('home')
      } else {
        const now = Date.now()
        if (now - lastTime < 2000) {
          CapApp.exitApp()
        } else {
          lastTime = now
          Toast.show({ text: 'Press back again to exit' })
        }
      }
    })
    return () => { listener.then(l => l.remove()).catch(() => {}) }
  }, [route])

  // Storage access is handled silently at save time (Documents -> Cache -> Data
  // fallback chain in pdfBuilder). No permission prompts at login or anywhere.
  function onAuth(a) {
    setAuth(a)
    setRoute('home')
  }

  async function handleShare() {
    try {
      await Share.share({
        title: 'NitinNova',
        text: 'Check out NitinNova - CareerCraft by Nitin Pratap!',
        dialogTitle: 'Share with friends',
      })
    } catch (e) { console.warn('Sharing failed', e) }
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('is_admin')
    localStorage.removeItem('nitinnova_current_user')
    setAuth({ token: null, is_admin: false })
    setRoute('auth')
  }

  function navigate(r) {
    setRoute(r)
    setSidebarOpen(false)
  }

  function handleLoadProfile(profile) {
    setProfileToLoad(profile)
    setRoute('home')
  }

  return (
    <ErrorBoundary>
    <div className="app-container">
      <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
        {sidebarOpen ? '\u2715' : '\u2630'}
      </button>

      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand-section">
          <div className="brand-logo">{appSettings.appName.charAt(0) || 'N'}</div>
          <div>
            <h1 className="brand-name">{appSettings.appName}</h1>
            <span className="brand-tag">{appSettings.appTagline}</span>
          </div>
        </div>

        <nav className="nav-links">
          <button className={`nav-button ${route === 'home' ? 'active' : ''}`}
            onClick={() => navigate('home')}>
            <span>{'\uD83D\uDCDD'}</span> Resume Builder
          </button>
          <button className={`nav-button ${route === 'dashboard' ? 'active' : ''}`}
            onClick={() => navigate('dashboard')}>
            <span>{'\uD83D\uDCC2'}</span> My Resumes
          </button>
          <button className={`nav-button ${route === 'cover-letter' ? 'active' : ''}`}
            onClick={() => navigate('cover-letter')}>
            <span>{'\u2709\uFE0F'}</span> Cover Letter
          </button>
          <button className={`nav-button ${route === 'feedback' ? 'active' : ''}`}
            onClick={() => navigate('feedback')}>
            <span>{'\uD83D\uDCAC'}</span> Feedback
          </button>
          <button className={`nav-button ${route === 'developer' ? 'active' : ''}`}
            onClick={() => navigate('developer')}>
            <span>{'\uD83D\uDC64'}</span> Developer
          </button>
          {auth.is_admin && (
            <button className={`nav-button ${route === 'admin' ? 'active' : ''}`}
              onClick={() => navigate('admin')}>
              <span>{'\uD83D\uDEE1\uFE0F'}</span> Admin Panel
            </button>
          )}
          {appSettings.showShareButton && (
            <button className="nav-button" onClick={handleShare}>
              <span>{'\uD83D\uDD17'}</span> Share App
            </button>
          )}
          {auth.token ? (
            <button className="nav-button logout-button" onClick={logout}>
              <span>{'\uD83D\uDEAA'}</span> Logout
            </button>
          ) : (
            <button className={`nav-button ${route === 'auth' ? 'active' : ''}`}
              onClick={() => navigate('auth')}>
              <span>{'\uD83D\uDD11'}</span> Admin Login
            </button>
          )}
        </nav>
      </aside>

      <main className="main-content">
        <div className="animate-fade-in">
          {route === 'home' && (
            <div className="grid-2col">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Form
                  onPolished={(p) => setPolished(p)}
                  onSaved={(id) => setSavedId(id)}
                  onSavePdf={() => setSaveTrigger(n => n + 1)}
                  initialData={profileToLoad}
                />
              </div>
              <div style={{ position: 'sticky', top: '40px', alignSelf: 'start' }}>
                <Preview polished={polished} savedId={savedId} saveTrigger={saveTrigger} />
              </div>
            </div>
          )}
          {route === 'dashboard' && (
            <Dashboard onLoadProfile={handleLoadProfile} isAdmin={auth.is_admin} onGoAuth={() => navigate('auth')} />
          )}
          {route === 'cover-letter' && <CoverLetter formData={polished || {}} />}
          {route === 'auth' && <Auth onAuth={onAuth} />}
          {route === 'developer' && <Developer />}
          {route === 'feedback' && <Feedback />}
          {route === 'admin' && auth.token && auth.is_admin && <AdminPanel />}
        </div>
      </main>
    </div>
    </ErrorBoundary>
  )
}
