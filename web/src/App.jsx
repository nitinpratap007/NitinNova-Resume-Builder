import React, { useState, useEffect, useCallback } from 'react'
import Form from './components/Form'
import Preview from './components/Preview'
import Auth from './components/Auth'
import Developer from './components/Developer'
import Feedback from './components/Feedback'
import AdminPanel from './components/AdminPanel'
import CoverLetter from './components/CoverLetter'
import Dashboard from './components/Dashboard'
import Welcome from './components/Welcome'
import Settings from './components/Settings'
import { getSession, logout as clearSession } from './auth'

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

// ---- lightweight hash routing (web replacement for the Android back button) ----
// Only route NAMES ever appear in the URL — never resume data.
const KNOWN_ROUTES = ['welcome', 'home', 'dashboard', 'cover-letter', 'feedback', 'developer', 'settings', 'auth', 'admin']
// Explorable without an account; everything that touches resume data needs one.
const PUBLIC_ROUTES = ['welcome', 'auth', 'feedback', 'developer']
// Owner-only (hidden from everyone else — no nav entry unless you are signed in as owner)
const ADMIN_ROUTES = ['admin']

function routeFromHash() {
  const h = (window.location.hash || '').replace(/^#\/?/, '').split('?')[0]
  return KNOWN_ROUTES.includes(h) ? h : 'welcome'
}

export default function App() {
  const [polished, setPolished] = useState(null)
  const [savedId, setSavedId] = useState(null)
  const [route, setRoute] = useState(routeFromHash)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileToLoad, setProfileToLoad] = useState(null)
  const [toast, setToast] = useState('')
  // Device-local session (auth.js). null = signed out (can still explore).
  const [session, setSession] = useState(getSession)
  const [pendingRoute, setPendingRoute] = useState(null) // where to go after login
  const [appSettings, setAppSettings] = useState({
    appName: 'NitinNova',
    appTagline: 'CareerCraft by Nitin Pratap',
    primaryColor: '#6366f1',
    showShareButton: true,
  })

  // keep URL hash in sync with the route (back/forward buttons work natively)
  useEffect(() => {
    const target = '#/' + route
    if (window.location.hash !== target) {
      window.history.replaceState(null, '', target)
    }
  }, [route])

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    setSidebarOpen(false)
    // Leaving the editor clears the "open profile" pointer: returning via
    // Resume Builder then restores the autosaved draft (latest work) rather
    // than a stale saved copy. Dashboard "Edit"/Import set it right before
    // navigating TO home, so they are unaffected (state batches in one tick).
    if (route !== 'home') setProfileToLoad(null)
  }, [route])

  // ---- login gate -------------------------------------------------------------
  // Private routes (resume data) require an account; the owner-only routes are
  // additionally invisible unless the session carries the owner role.
  useEffect(() => {
    if (!session && !PUBLIC_ROUTES.includes(route)) {
      setPendingRoute(prev => prev || (route === 'welcome' ? null : route))
      setRoute('auth')
      return
    }
    if (session && route === 'auth') {
      setRoute('welcome')
      return
    }
    if (session && ADMIN_ROUTES.includes(route) && session.role !== 'admin') {
      setRoute('welcome')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, session])

  // Escape closes the mobile sidebar (web equivalent of Android back-for-menu)
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape' && sidebarOpen) setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  const showToast = useCallback((msg) => {
    setToast(msg)
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast(''), 3200)
  }, [])

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
    // Locally saved (owner) settings apply on boot — no network involved.
    try {
      const local = JSON.parse(localStorage.getItem('nitinnova_admin_settings') || 'null')
      if (local) applyAppSettings(local)
      else document.title = 'NitinNova - CareerCraft by Nitin Pratap'
    } catch { document.title = 'NitinNova - CareerCraft by Nitin Pratap' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onAuth(s) {
    setSession(s)
    const target = pendingRoute
    setPendingRoute(null)
    setRoute(target && PUBLIC_ROUTES.includes(target) === false ? target : 'welcome')
  }

  function logout() {
    clearSession()
    setSession(null)
    setRoute('welcome')
  }

  function navigate(r) {
    // Clicking a private nav item while signed out routes through the login
    // screen and returns you to the destination afterwards.
    if (!session && !PUBLIC_ROUTES.includes(r)) {
      setPendingRoute(r)
      setRoute('auth')
      setSidebarOpen(false)
      return
    }
    if (r === 'admin' && (!session || session.role !== 'admin')) {
      setRoute('welcome')
      setSidebarOpen(false)
      return
    }
    setRoute(r)
    setSidebarOpen(false)
    // Move focus to main content for keyboard/screen-reader users
    try { document.querySelector('.main-content')?.focus?.() } catch {}
  }

  function handleLoadProfile(profile) {
    setProfileToLoad(profile)
    setRoute('home')
  }

  async function handleShare() {
    const shareData = {
      title: appSettings.appName,
      text: `Check out ${appSettings.appName} — ${appSettings.appTagline} (works right in your browser)!`,
      url: window.location.origin + window.location.pathname,
    }
    // Web Share API (mobile/Chrome) → clipboard fallback (desktop)
    try {
      if (navigator.share) {
        await navigator.share(shareData)
        return
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return // user cancelled the share sheet
    }
    try {
      await navigator.clipboard.writeText(shareData.url)
      showToast('Link copied to clipboard!')
    } catch {
      showToast('Copy this page URL to share it.')
    }
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
          <button className={`nav-button ${route === 'welcome' ? 'active' : ''}`}
            onClick={() => navigate('welcome')}>
            <span>{'\u2302'}</span> Home
          </button>
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
          <button className={`nav-button ${route === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}>
            <span>{'\u2699\uFE0F'}</span> Settings &amp; Privacy
          </button>
          <button className={`nav-button ${route === 'feedback' ? 'active' : ''}`}
            onClick={() => navigate('feedback')}>
            <span>{'\uD83D\uDCAC'}</span> Feedback
          </button>
          <button className={`nav-button ${route === 'developer' ? 'active' : ''}`}
            onClick={() => navigate('developer')}>
            <span>{'\uD83D\uDC64'}</span> Developer
          </button>
          {session && session.role === 'admin' && (
            <button className={`nav-button ${route === 'admin' ? 'active' : ''}`}
              onClick={() => navigate('admin')}>
              <span>{'\uD83D\uDEE1\uFE0F'}</span> Admin Panel
            </button>
          )}
          {appSettings.showShareButton && (
            <button className="nav-button" onClick={handleShare}>
              <span>{'\uD83D\uDD17'}</span> Share
            </button>
          )}
          {session ? (
            <>
              <div className="nav-user-chip" title="Signed in on this device">
                <span>{'\uD83D\uDC64'}</span>
                <span className="nav-user-name">{session.name || session.email}</span>
              </div>
              <button className="nav-button logout-button" onClick={logout}>
                <span>{'\uD83D\uDEAA'}</span> Log out
              </button>
            </>
          ) : (
            <button className={`nav-button ${route === 'auth' ? 'active' : ''}`}
              onClick={() => navigate('auth')}>
              <span>{'\uD83D\uDD11'}</span> Log in / Sign up
            </button>
          )}
        </nav>

        <div className="sidebar-footnote">
          Resumes stay on this device — a free account is only needed to start building.
        </div>
      </aside>

      <main className="main-content" tabIndex={-1}>
        <div className="animate-fade-in">
          {route === 'welcome' && (
            <Welcome onNavigate={navigate} onNewResume={() => navigate('home')}
              onOpenDashboard={() => navigate('dashboard')} session={session} />
          )}
          {route === 'home' && session && (
            <div className="grid-2col">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Form
                  onPolished={(p) => setPolished(p)}
                  onSaved={(id) => setSavedId(id)}
                  initialData={profileToLoad}
                  onToast={showToast}
                />
              </div>
              <div style={{ position: 'sticky', top: '40px', alignSelf: 'start' }}>
                <Preview polished={polished} savedId={savedId} onToast={showToast} />
              </div>
            </div>
          )}
          {route === 'dashboard' && session && (
            <Dashboard onLoadProfile={handleLoadProfile} isAdmin={session.role === 'admin'}
              onGoAuth={() => navigate('auth')} onToast={showToast} />
          )}
          {route === 'cover-letter' && session && <CoverLetter formData={polished || {}} />}
          {route === 'auth' && <Auth onAuth={onAuth} onBack={() => navigate('welcome')} />}
          {route === 'developer' && <Developer />}
          {route === 'feedback' && <Feedback />}
          {route === 'settings' && session && <Settings onToast={showToast} />}
          {route === 'admin' && session && session.role === 'admin' && <AdminPanel />}
        </div>
      </main>

      {toast && (
        <div className="app-toast" role="status" aria-live="polite">{toast}</div>
      )}
    </div>
    </ErrorBoundary>
  )
}
