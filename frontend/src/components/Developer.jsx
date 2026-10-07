import React, { useEffect, useState } from 'react'
import API from '../api'

const DEV_KEY = 'nitinnova_developer_info'

const DEFAULT_INFO = {
  name: 'Nitin Pratap',
  bio: 'Creator of NitinNova Resume Builder',
  email: 'pratapnitin242@gmail.com',
  phone: '9458701550',
  github: 'nitinpratap007',
  linkedin: '',
  instagram: '',
  youtube: '',
  portfolio: 'https://nitinpratap007.github.io/',
  projectName: 'NitinNova Resume Builder',
  projectLink: 'https://github.com/nitinpratap007/NitinNova-Resume-Builder',
}

export default function Developer() {
  const [info, setInfo] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(DEFAULT_INFO)
  const [saving, setSaving] = useState(false)

  const isAdmin = localStorage.getItem('is_admin') === '1'

  useEffect(() => { fetchInfo() }, [])

  async function fetchInfo() {
    try {
      const res = await API.get('/developer')
      if (res.data.ok && res.data.developer && res.data.developer.name) {
        const d = res.data.developer
        setInfo(d)
        setForm(d)
        try { localStorage.setItem(DEV_KEY, JSON.stringify(d)) } catch {}
        return
      }
    } catch {}
    try {
      const stored = localStorage.getItem(DEV_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setInfo(parsed)
        setForm(parsed)
      } else {
        setInfo(DEFAULT_INFO)
        setForm(DEFAULT_INFO)
      }
    } catch { setInfo(DEFAULT_INFO) }
  }

  function change(e) { setForm({ ...form, [e.target.name]: e.target.value }) }

  async function save() {
    setSaving(true)
    try {
      await API.post('/developer', form)
      localStorage.setItem(DEV_KEY, JSON.stringify(form))
      setEditing(false)
      setInfo(form)
      alert('Developer info saved!')
    } catch {
      localStorage.setItem(DEV_KEY, JSON.stringify(form))
      setEditing(false)
      setInfo(form)
      alert('Saved locally (offline).')
    } finally { setSaving(false) }
  }

  if (!info) return null

  return (
    <div className="glass-card animate-fade-in" style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '24px' }}>Developer Info</h2>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '14px' }}>
          Information about the creator of NitinNova
        </p>
      </div>

      {!editing && (
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '22px', color: 'var(--text-primary)' }}>{info.name}</h3>
            <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {info.bio}
            </p>
            {info.projectName && (
              <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(99,102,241,0.1)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.2)' }}>
                <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>Project:</strong>{' '}
                {info.projectLink ? (
                  <a href={info.projectLink.startsWith('http') ? info.projectLink : `https://${info.projectLink}`}
                    target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: '14px' }}>{info.projectName}</a>
                ) : <span style={{ fontSize: '14px' }}>{info.projectName}</span>}
              </div>
            )}
            <div style={{ display: 'grid', gap: '10px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              {info.email && <div>Email: <strong>{info.email}</strong></div>}
              {info.phone && <div>Contact: <strong>{info.phone}</strong></div>}
              {info.github && (
                <div>GitHub: <a href={info.github.startsWith('http') ? info.github : `https://github.com/${info.github}`}
                  target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>{info.github}</a></div>
              )}
              {info.linkedin && (
                <div>LinkedIn: <a href={info.linkedin.startsWith('http') ? info.linkedin : `https://linkedin.com/in/${info.linkedin}`}
                  target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>{info.linkedin}</a></div>
              )}
              {info.instagram && (
                <div>Instagram: <a href={info.instagram.startsWith('http') ? info.instagram : `https://instagram.com/${info.instagram}`}
                  target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>{info.instagram}</a></div>
              )}
              {info.youtube && (
                <div>YouTube: <a href={info.youtube.startsWith('http') ? info.youtube : `https://youtube.com/@${info.youtube}`}
                  target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>{info.youtube}</a></div>
              )}
              {info.portfolio && (
                <div>Portfolio: <a href={info.portfolio.startsWith('http') ? info.portfolio : `https://${info.portfolio}`}
                  target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>{info.portfolio}</a></div>
              )}
            </div>
          </div>

          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setEditing(true)} style={{ width: '100%', padding: '12px' }}>
              Edit Information
            </button>
          )}
        </div>
      )}

      {editing && isAdmin && (
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', display: 'grid', gap: '12px' }}>
            <h4 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>Developer Profile</h4>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Name</label>
              <input name="name" value={form.name} onChange={change} placeholder="Developer Name" /></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Bio</label>
              <textarea name="bio" value={form.bio} onChange={change} placeholder="About the developer" rows={3} /></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Email</label>
              <input name="email" value={form.email} onChange={change} placeholder="Public Email" /></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Phone</label>
              <input name="phone" value={form.phone} onChange={change} placeholder="Phone Number" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}><label>GitHub</label>
                <input name="github" value={form.github} onChange={change} placeholder="Username or URL" /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>LinkedIn</label>
                <input name="linkedin" value={form.linkedin} onChange={change} placeholder="Username or URL" /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Instagram</label>
                <input name="instagram" value={form.instagram} onChange={change} placeholder="Username or URL" /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>YouTube</label>
                <input name="youtube" value={form.youtube} onChange={change} placeholder="Channel name or URL" /></div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Portfolio Link</label>
              <input name="portfolio" value={form.portfolio} onChange={change} placeholder="Portfolio URL" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Project Name</label>
                <input name="projectName" value={form.projectName} onChange={change} placeholder="App / Project name" /></div>
              <div className="form-group" style={{ marginBottom: 0 }}><label>Project Link</label>
                <input name="projectLink" value={form.projectLink} onChange={change} placeholder="GitHub or website link" /></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button className="btn btn-primary" onClick={save} disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button className="btn btn-secondary" onClick={() => { setEditing(false); fetchInfo() }} style={{ flex: 1 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
