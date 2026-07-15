import React, { useState, useEffect } from 'react'
import API from '../api'

const CUSTOM_SECTIONS_KEY = 'nitinnova_admin_sections'

export default function AdminPanel() {
  const [users, setUsers] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [customSections, setCustomSections] = useState([])
  const [newSection, setNewSection] = useState('')
  const [activeTab, setActiveTab] = useState('users')
  const [settings, setSettings] = useState({
    appName: 'NitinNova',
    appTagline: 'CareerCraft by Nitin Pratap',
    footerText: 'Built by Nitin Pratap',
    primaryColor: '#6366f1',
    showGuestLogin: false,
    showShareButton: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const sec = localStorage.getItem(CUSTOM_SECTIONS_KEY)
      setCustomSections(sec ? JSON.parse(sec) : ['Education', 'Skills', 'Projects & Experience'])
    } catch { setCustomSections(['Education', 'Skills', 'Projects & Experience']) }

    try {
      const res = await API.get('/api/admin-settings')
      if (res.data.ok) {
        const s = res.data.settings
        setSettings(prev => ({
          ...prev,
          appName: s.appName || prev.appName,
          appTagline: s.appTagline || prev.appTagline,
          footerText: s.footerText || prev.footerText,
          primaryColor: s.primaryColor || prev.primaryColor,
          showGuestLogin: s.showGuestLogin === 'true',
          showShareButton: s.showShareButton !== 'false',
        }))
      }
    } catch {}

    try {
      const res = await API.get('/feedbacks')
      if (res.data.ok) setFeedbacks(res.data.feedbacks || [])
    } catch {}

    try {
      const res = await API.get('/my/resumes')
      if (res.data.ok) setUsers(res.data.resumes || [])
    } catch {}
  }

  async function deleteFeedback(id) {
    if (!window.confirm('Delete this feedback?')) return
    setFeedbacks(prev => prev.filter(f => f.id !== id))
  }

  function addAppSection() {
    if (!newSection.trim()) return
    const updated = [...customSections, newSection.trim()]
    localStorage.setItem(CUSTOM_SECTIONS_KEY, JSON.stringify(updated))
    setCustomSections(updated)
    setNewSection('')
  }

  function removeAppSection(sec) {
    if (window.confirm(`Remove "${sec}"?`)) {
      const updated = customSections.filter(s => s !== sec)
      localStorage.setItem(CUSTOM_SECTIONS_KEY, JSON.stringify(updated))
      setCustomSections(updated)
    }
  }

  async function saveSettings() {
    setSaving(true)
    try {
      await API.post('/api/admin-settings', settings)
      alert('Settings saved to server!')
    } catch {
      alert('Saved locally (offline).')
    } finally { setSaving(false) }
  }

  return (
    <div className="glass-card animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0 }}>Admin Panel</h2>
        <span style={{ fontSize: '12px', background: 'rgba(239,68,68,0.2)', color: '#fca5a5', padding: '4px 10px', borderRadius: '100px', fontWeight: 600 }}>
          Super Admin
        </span>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button className={`btn ${activeTab === 'feedbacks' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('feedbacks')} style={{ padding: '8px 14px', fontSize: '13px' }}>
          Feedback ({feedbacks.length})
        </button>
        <button className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('config')} style={{ padding: '8px 14px', fontSize: '13px' }}>
          Sections
        </button>
        <button className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('settings')} style={{ padding: '8px 14px', fontSize: '13px' }}>
          Settings
        </button>
      </div>

      {activeTab === 'feedbacks' && (
        <div>
          {feedbacks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No feedbacks yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {feedbacks.map(f => (
                <div key={f.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'grid', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>User #{f.user_id}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{f.created_at}</span>
                  </div>
                  <h4 style={{ margin: '4px 0', color: 'var(--text-primary)' }}>{f.subject}</h4>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{f.message}</p>
                  <div style={{ textAlign: 'right' }}>
                    <button onClick={() => deleteFeedback(f.id)}
                      style={{ background: 'rgba(239,68,68,0.05)', color: '#fca5a5', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'config' && (
        <div style={{ display: 'grid', gap: '20px' }}>
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>App Resume Sections</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input value={newSection} onChange={e => setNewSection(e.target.value)}
                placeholder="e.g. Certifications, Internships" style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={addAppSection} style={{ padding: '0 16px' }}>Add</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {customSections.map(sec => (
                <span key={sec} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '100px', fontSize: '12px' }}>
                  {sec}
                  <button onClick={() => removeAppSection(sec)} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 0, fontWeight: 700 }}>x</button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', display: 'grid', gap: '12px' }}>
            <h4 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>App Settings</h4>
            <div className="form-group" style={{ marginBottom: 0 }}><label>App Name</label>
              <input value={settings.appName} onChange={e => setSettings(p => ({ ...p, appName: e.target.value }))} /></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label>App Tagline</label>
              <input value={settings.appTagline} onChange={e => setSettings(p => ({ ...p, appTagline: e.target.value }))} /></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Footer Text</label>
              <input value={settings.footerText} onChange={e => setSettings(p => ({ ...p, footerText: e.target.value }))} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Primary Color</label>
                <input type="color" value={settings.primaryColor} onChange={e => setSettings(p => ({ ...p, primaryColor: e.target.value }))}
                  style={{ width: '100%', height: '44px', padding: 0, border: 'none', cursor: 'pointer' }} /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Toggles</label>
                <div style={{ display: 'grid', gap: '8px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={settings.showShareButton}
                      onChange={e => setSettings(p => ({ ...p, showShareButton: e.target.checked }))} />
                    Show Share Button
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
