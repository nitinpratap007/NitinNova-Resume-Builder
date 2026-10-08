import React, { useEffect, useState } from 'react'
import API from '../api'
import { exportResumePdf } from '../pdfBuilder'
import ImportResume from './ImportResume'

const PROFILES_KEY = 'nitinnova_resume_profiles'

const IS_ADMIN_BUILD = import.meta.env.VITE_ADMIN_BUILD === 'true'

function loadLocalProfiles() {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]')
  } catch { return [] }
}

function saveLocalProfiles(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
}

export default function Dashboard({ onLoadProfile, isAdmin, onGoAuth }) {
  const [profiles, setProfiles] = useState([])
  const [cloudResumes, setCloudResumes] = useState([])
  const [tab, setTab] = useState('local')
  const [cloudState, setCloudState] = useState('loading') // loading | ok | offline
  const [showImport, setShowImport] = useState(false)

  const canAccessCloud = IS_ADMIN_BUILD && isAdmin

  useEffect(() => {
    setProfiles(loadLocalProfiles())
    if (canAccessCloud) fetchCloud()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccessCloud])

  function handleImportedResume(resumeData) {
    // Map imported data to the exact structure Form expects
    const profile = {
      id: Date.now(),
      name: resumeData.name || 'Imported Resume',
      headline: resumeData.headline || '',
      location: resumeData.location || '',
      summary: resumeData.summary || '',
      email: resumeData.email || '',
      phone: resumeData.phone || '',
      education: resumeData.education || '',
      skills: resumeData.skills || '',
      projects: resumeData.projects || '',
      skillGroups: resumeData.skillGroups && resumeData.skillGroups.length
        ? resumeData.skillGroups
        : [], // Form will auto-organize from skills string if empty
      sections: (resumeData.sections || []).map(s => ({
        id: s.id || Date.now() + Math.random(),
        title: s.title || '',
        content: s.content || '',
      })),
      photo: resumeData.photo || '',
      photoShape: resumeData.photoShape || 'circle',
      bgColor: resumeData.bgColor || '#eef2ff',
      socialGithub: resumeData.socialGithub || '',
      socialLinkedin: resumeData.socialLinkedin || '',
      socialPortfolio: resumeData.socialPortfolio || '',
      template: resumeData.template || 'modern-minimal',
      templateMode: resumeData.templateMode || 'online',
      fontFamily: resumeData.fontFamily || 'helvetica',
      fontSizePreset: resumeData.fontSizePreset || 'normal',
      margins: resumeData.margins || 40,
      bullets: resumeData.bullets || [],
      savedAt: new Date().toISOString(),
    }
    // Save to local profiles
    const existing = loadLocalProfiles()
    saveLocalProfiles([profile, ...existing])
    setProfiles([profile, ...profiles])
    setShowImport(false)
    onLoadProfile(profile)
  }

  function closeImport() {
    setShowImport(false)
  }

  async function fetchCloud() {
    try {
      const res = await API.get('/my/resumes')
      if (res.data.ok) {
        setCloudResumes(res.data.resumes)
        setCloudState('ok')
      } else setCloudState('offline')
    } catch (err) {
      const status = err && err.response && err.response.status
      // 401/403 = the admin JWT is missing or expired (15 min lifetime)
      setCloudState(status === 401 || status === 403 ? 'auth' : 'offline')
    }
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
      // Fetch the full resume state, then render it with the SAME client-side
      // pipeline as the live preview — no server-side (ReportLab) template.
      const res = await API.get(`/resumes/${id}`)
      const r = res.data.resume
      const state = {
        ...(r.polished || {}),
        id: r.id,
        name: r.name,
        email: r.email,
        education: r.education,
        skills: r.skills,
        projects: r.projects,
        sections: r.sections,
        template: r.template,
        templateMode: r.templateMode,
        bgColor: r.bgColor,
        photoShape: r.photoShape,
        photo: r.photo,
      }
      const pdf = await exportResumePdf(state, r.id)
      alert(pdf.ok ? `Saved: ${pdf.filename || 'PDF'}` : pdf.message)
    } catch { alert('Download failed') }
  }

  return (
    <div className="glass-card animate-fade-in" style={{ display: 'grid', gap: '20px' }}>
      {showImport ? (
        <ImportResume onImport={handleImportedResume} onCancel={closeImport} />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ margin: 0 }}>My Resumes</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={createNew} style={{ padding: '10px 20px' }}>
                + New Resume
              </button>
              <button className="btn btn-secondary" onClick={() => setShowImport(true)} style={{ padding: '10px 20px' }}>
                📥 Import Resume
              </button>
            </div>
          </div>
        </>
      )}

      <div className="tabs-header">
        <button
          type="button"
          className={`tab-btn ${tab === 'local' ? 'active' : ''}`}
          onClick={() => setTab('local')}
        >
          Local Profiles ({profiles.length})
        </button>
        {canAccessCloud && (
          <button
            type="button"
            className={`tab-btn ${tab === 'cloud' ? 'active' : ''}`}
            onClick={() => setTab('cloud')}
          >
            Cloud ({cloudResumes.length})
          </button>
        )}
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
          {!canAccessCloud && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>Cloud resumes are admin-only</p>
              <p style={{ fontSize: '13px' }}>Sign in with the admin account to access cloud-saved resumes.</p>
              {onGoAuth && (
                <button className="btn btn-secondary" onClick={onGoAuth} style={{ marginTop: '12px', padding: '8px 16px', fontSize: '13px' }}>
                  Admin Login
                </button>
              )}
            </div>
          )}
          {canAccessCloud && cloudResumes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '16px', marginBottom: '8px' }}>
                {cloudState === 'loading' ? 'Checking cloud...' : cloudState === 'auth' ? 'Admin session expired' : cloudState === 'offline' ? 'Cloud sync unavailable' : 'No cloud resumes'}
              </p>
              <p style={{ fontSize: '13px' }}>
                {cloudState === 'auth'
                  ? 'Your admin session has expired (tokens last 15 minutes). Please log in again.'
                  : cloudState === 'offline'
                    ? 'The online backend is unreachable right now. Your resumes are safe in the Local tab — try again when you are online.'
                    : 'Save a resume to the cloud to access it from any device.'}
              </p>
              {cloudState !== 'loading' && (
                <button className="btn btn-secondary" onClick={cloudState === 'auth' && onGoAuth ? onGoAuth : fetchCloud}
                  style={{ marginTop: '12px', padding: '8px 16px', fontSize: '13px' }}>
                  {cloudState === 'auth' ? 'Admin Login' : 'Retry'}
                </button>
              )}
            </div>
          )}
          {canAccessCloud && cloudResumes.map(r => (
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
