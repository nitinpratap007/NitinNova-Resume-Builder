import React, { useEffect, useState } from 'react'
import API from '../api'

const PROFILES_KEY = 'nitinnova_resume_profiles'

function loadLocalProfiles() {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]')
  } catch { return [] }
}

function saveLocalProfiles(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
}

export default function Dashboard({ onLoadProfile }) {
  const [profiles, setProfiles] = useState([])
  const [cloudResumes, setCloudResumes] = useState([])
  const [tab, setTab] = useState('local')
  const [cloudState, setCloudState] = useState('loading') // loading | ok | offline

  useEffect(() => {
    setProfiles(loadLocalProfiles())
    fetchCloud()
  }, [])

  async function fetchCloud() {
    try {
      const res = await API.get('/my/resumes')
      if (res.data.ok) {
        setCloudResumes(res.data.resumes)
        setCloudState('ok')
      } else setCloudState('offline')
    } catch { setCloudState('offline') }
  }

  function createNew() {
    onLoadProfile(null)
  }

  function loadProfile(profile) {
    onLoadProfile(profile)
  }

  function deleteLocalProfile(id) {
    if (!confirm('Delete this resume profile?')) return
    const next = profiles.filter(p => p.id !== id)
    saveLocalProfiles(next)
    setProfiles(next)
  }

  function duplicateProfile(profile) {
    const dup = {
      ...profile,
      id: Date.now(),
      name: (profile.name || 'Untitled') + ' (Copy)',
      savedAt: new Date().toISOString(),
    }
    const next = [dup, ...profiles]
    saveLocalProfiles(next)
    setProfiles(next)
  }

  async function deleteCloud(id) {
    if (!confirm('Delete cloud resume?')) return
    try {
      await API.delete(`/resumes/${id}`)
      fetchCloud()
    } catch { alert('Failed to delete') }
  }

  async function downloadCloud(id) {
    try {
      const res = await API.get(`/download/${id}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `resume_${id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch { alert('Download failed') }
  }

  return (
    <div className="glass-card animate-fade-in" style={{ display: 'grid', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0 }}>My Resumes</h2>
        <button className="btn btn-primary" onClick={createNew} style={{ padding: '10px 20px' }}>
          + New Resume
        </button>
      </div>

      <div className="tabs-header">
        <button
          type="button"
          className={`tab-btn ${tab === 'local' ? 'active' : ''}`}
          onClick={() => setTab('local')}
        >
          Local Profiles ({profiles.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === 'cloud' ? 'active' : ''}`}
          onClick={() => setTab('cloud')}
        >
          Cloud ({cloudResumes.length})
        </button>
      </div>

      {tab === 'local' && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {profiles.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>No saved profiles yet</p>
              <p style={{ fontSize: '13px' }}>Create a resume and save it as a profile to manage multiple versions.</p>
            </div>
          )}
          {profiles.map(p => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px', background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{p.name || 'Untitled Resume'}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {p.email || 'No email'} · {p.template || 'default'} · {new Date(p.savedAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={() => loadProfile(p)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                  Edit
                </button>
                <button className="btn btn-secondary" onClick={() => duplicateProfile(p)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                  Duplicate
                </button>
                <button className="btn btn-danger" onClick={() => deleteLocalProfile(p.id)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'cloud' && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {cloudResumes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>
                {cloudState === 'loading' ? 'Checking cloud...' : cloudState === 'offline' ? 'Cloud sync unavailable' : 'No cloud resumes'}
              </p>
              <p style={{ fontSize: '13px' }}>
                {cloudState === 'offline'
                  ? 'The online backend is unreachable right now. Your resumes are safe in the Local tab — try again when you are online.'
                  : 'Save a resume to the cloud to access it from any device.'}
              </p>
              {cloudState === 'offline' && (
                <button className="btn btn-secondary" onClick={fetchCloud} style={{ marginTop: '12px', padding: '8px 16px', fontSize: '13px' }}>
                  Retry
                </button>
              )}
            </div>
          )}
          {cloudResumes.map(r => (
            <div key={r.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px', background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{r.name || 'Untitled'}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {r.email || ''} · {r.template || 'default'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-success" onClick={() => downloadCloud(r.id)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                  Download
                </button>
                <button className="btn btn-danger" onClick={() => deleteCloud(r.id)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
