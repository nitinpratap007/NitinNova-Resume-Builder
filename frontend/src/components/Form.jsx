import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { polishBullets } from '../localAI'
import TemplateSelector from './TemplateSelector'
import { templateSets, fontOptions, fontSizePresets } from '../templateData'

const DRAFT_KEY = 'resume_builder_draft'
const PROFILES_KEY = 'nitinnova_resume_profiles'

export default function Form({ onPolished, onSaved, onSavePdf, initialData }) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', education: '', skills: '', projects: '',
    photo: '', photoShape: 'circle', bgColor: '#eef2ff',
    socialGithub: '', socialLinkedin: '', socialPortfolio: '', sections: []
  })
  const [loading, setLoading] = useState(false)
  const [templateMode, setTemplateMode] = useState('offline')
  const [template, setTemplate] = useState('photo-profile')
  const [activeTab, setActiveTab] = useState('design')
  const [fontFamily, setFontFamily] = useState('helvetica')
  const [fontSizePreset, setFontSizePreset] = useState('normal')
  const [margins, setMargins] = useState(40)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    if (initialData) {
      setForm(prev => ({
        ...prev,
        name: initialData.name || '', email: initialData.email || '',
        phone: initialData.phone || '', education: initialData.education || '',
        skills: initialData.skills || '', projects: initialData.projects || '',
        photo: initialData.photo || '', photoShape: initialData.photoShape || 'circle',
        bgColor: initialData.bgColor || '#eef2ff',
        socialGithub: initialData.socialGithub || '',
        socialLinkedin: initialData.socialLinkedin || '',
        socialPortfolio: initialData.socialPortfolio || '',
        sections: initialData.sections || [],
      }))
      if (initialData.template) setTemplate(initialData.template)
      if (initialData.templateMode) setTemplateMode(initialData.templateMode)
      if (initialData.fontFamily) setFontFamily(initialData.fontFamily)
      if (initialData.fontSizePreset) setFontSizePreset(initialData.fontSizePreset)
      if (initialData.margins) setMargins(initialData.margins)
    }
  }, [initialData])

  useEffect(() => {
    const updateMode = () => setTemplateMode(navigator.onLine ? 'online' : 'offline')
    updateMode()
    window.addEventListener('online', updateMode)
    window.addEventListener('offline', updateMode)
    return () => { window.removeEventListener('online', updateMode); window.removeEventListener('offline', updateMode) }
  }, [])

  useEffect(() => {
    const available = templateSets[templateMode]
    if (available && !available.find(t => t.id === template)) setTemplate(available[0]?.id || '')
  }, [templateMode])

  useEffect(() => {
    if (initialData) return
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
      if (draft) {
        setForm(draft.form || form)
        setTemplate(draft.template || template)
        setTemplateMode(draft.templateMode || templateMode)
        if (draft.fontFamily) setFontFamily(draft.fontFamily)
        if (draft.fontSizePreset) setFontSizePreset(draft.fontSizePreset)
        if (draft.margins) setMargins(draft.margins)
      }
    } catch (err) { console.error('Load draft failed', err) }
  }, [])

  useEffect(() => {
    const draft = { form, template, templateMode, fontFamily, fontSizePreset, margins }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [form, template, templateMode, fontFamily, fontSizePreset, margins])

  useEffect(() => {
    const p = polishBullets(form)
    const shaped = { ...p, template, templateMode, fontFamily, fontSizePreset, margins,
      sections: form.sections, bgColor: form.bgColor, photo: form.photo, photoShape: form.photoShape }
    onPolished(shaped)
  }, [form, template, templateMode, fontFamily, fontSizePreset, margins])

  function change(e) {
    const { name, value, files } = e.target
    if (name === 'photo') {
      const file = files && files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = () => {
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const MAX = 1024
            let w = img.width, h = img.height
            if (w > h && w > MAX) { h *= MAX / w; w = MAX }
            else if (h > MAX) { w *= MAX / h; h = MAX }
            canvas.width = w; canvas.height = h
            canvas.getContext('2d').drawImage(img, 0, 0, w, h)
            setForm(prev => ({ ...prev, photo: canvas.toDataURL('image/png') }))
          }
          img.src = reader.result
        }
        reader.readAsDataURL(file)
        return
      }
    }
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function addSection() {
    setForm(prev => ({ ...prev, sections: [...(prev.sections || []), { id: Date.now(), title: 'New Section', content: '' }] }))
  }
  function updateSection(id, field, value) {
    setForm(prev => ({ ...prev, sections: (prev.sections || []).map(s => s.id === id ? { ...s, [field]: value } : s) }))
  }
  function removeSection(id) {
    setForm(prev => ({ ...prev, sections: (prev.sections || []).filter(s => s.id !== id) }))
  }
  function moveSection(index, direction) {
    const sections = [...(form.sections || [])]
    const ni = index + direction
    if (ni < 0 || ni >= sections.length) return
    ;[sections[index], sections[ni]] = [sections[ni], sections[index]]
    setForm(prev => ({ ...prev, sections }))
  }

  function saveAsProfile() {
    const profile = { id: Date.now(), ...form, template, templateMode, fontFamily, fontSizePreset, margins, savedAt: new Date().toISOString() }
    const existing = JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]')
    localStorage.setItem(PROFILES_KEY, JSON.stringify([profile, ...existing.filter(p => p.name !== profile.name)].slice(0, 30)))
    setStatusMessage(`Profile "${profile.name}" saved.`)
    if (onSavePdf) onSavePdf()
  }

  async function generate(e) {
    if (e) e.preventDefault()
    setLoading(true)
    try {
      const res = await axios.post('http://localhost:5000/generate-resume', form)
      const shaped = { ...res.data.polished, template, templateMode, fontFamily, fontSizePreset, margins,
        sections: form.sections, bgColor: form.bgColor, photo: form.photo, photoShape: form.photoShape }
      onPolished(shaped)
      setStatusMessage('AI polished successfully.')
    } catch { generateOffline() } finally { setLoading(false) }
  }

  function generateOffline(e) {
    if (e) e.preventDefault()
    const p = polishBullets(form)
    const shaped = { ...p, template, templateMode, fontFamily, fontSizePreset, margins,
      sections: form.sections, bgColor: form.bgColor, photo: form.photo, photoShape: form.photoShape }
    onPolished(shaped)
    setStatusMessage('Formatted offline.')
  }

  function save(e) {
    if (e) e.preventDefault()
    const profile = { id: Date.now(), ...form, template, templateMode, fontFamily, fontSizePreset, margins, savedAt: new Date().toISOString() }
    const existing = JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]')
    localStorage.setItem(PROFILES_KEY, JSON.stringify([profile, ...existing].slice(0, 30)))
    setStatusMessage('Saved locally.')
    if (onSavePdf) onSavePdf()
  }

  return (
    <div className="glass-card animate-fade-in form-panel">
      <h2 style={{ margin: '0 0 16px' }}>Resume Creator</h2>

      <div className="tabs-header">
        <button type="button" className={`tab-btn ${activeTab === 'design' ? 'active' : ''}`}
          onClick={() => setActiveTab('design')}>Design</button>
        <button type="button" className={`tab-btn ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => setActiveTab('personal')}>Personal</button>
        <button type="button" className={`tab-btn ${activeTab === 'skills' ? 'active' : ''}`}
          onClick={() => setActiveTab('skills')}>Experience</button>
        <button type="button" className={`tab-btn ${activeTab === 'sections' ? 'active' : ''}`}
          onClick={() => setActiveTab('sections')}>Sections</button>
      </div>

      {activeTab === 'design' && (
        <div className="animate-fade-in" style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className={`btn btn-secondary ${templateMode === 'offline' ? 'active' : ''}`}
              onClick={() => setTemplateMode('offline')} style={{ padding: '8px 14px', fontSize: '13px' }}>Offline</button>
            <button type="button" className={`btn btn-secondary ${templateMode === 'online' ? 'active' : ''}`}
              onClick={() => setTemplateMode('online')} style={{ padding: '8px 14px', fontSize: '13px' }}>Online</button>
          </div>
          <TemplateSelector mode={templateMode} template={template} bgColor={form.bgColor}
            onChange={setTemplate} onBgColorChange={color => setForm(prev => ({ ...prev, bgColor: color }))} />
          <div className="form-group">
            <label>Font Family</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {fontOptions.map(f => (
                <button key={f.id} type="button"
                  className={`btn ${fontFamily === f.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFontFamily(f.id)} style={{ padding: '10px', fontSize: '13px', fontFamily: f.value }}>{f.name}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Font Size</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {fontSizePresets.map(s => (
                <button key={s.id} type="button"
                  className={`btn ${fontSizePreset === s.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFontSizePreset(s.id)} style={{ padding: '10px', fontSize: '13px' }}>{s.name}</button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Page Margins: {margins}px</label>
            <input type="range" min="20" max="80" value={margins}
              onChange={e => setMargins(parseInt(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label>Photo Shape</label>
              <select name="photoShape" value={form.photoShape} onChange={change}>
                <option value="circle">Circle</option>
                <option value="rounded">Rounded</option>
                <option value="square">Square</option>
              </select>
            </div>
            <div className="form-group">
              <label>Color Accent</label>
              <input type="color" value={form.bgColor}
                onChange={e => setForm(prev => ({ ...prev, bgColor: e.target.value }))}
                style={{ width: '100%', height: '44px', padding: 0, border: 'none', cursor: 'pointer' }} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'personal' && (
        <div className="animate-fade-in" style={{ display: 'grid', gap: '14px' }}>
          <div className="form-group"><label>Full Name</label>
            <input name="name" placeholder="e.g. Nitin Pratap" value={form.name} onChange={change} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group"><label>Email</label>
              <input name="email" type="email" placeholder="e.g. nitin@gmail.com" value={form.email} onChange={change} /></div>
            <div className="form-group"><label>Phone</label>
              <input name="phone" placeholder="e.g. +91 9761183207" value={form.phone} onChange={change} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <div className="form-group"><label>GitHub</label>
              <input name="socialGithub" placeholder="github.com/user" value={form.socialGithub} onChange={change} /></div>
            <div className="form-group"><label>LinkedIn</label>
              <input name="socialLinkedin" placeholder="linkedin.com/in/user" value={form.socialLinkedin} onChange={change} /></div>
            <div className="form-group"><label>Portfolio</label>
              <input name="socialPortfolio" placeholder="portfolio.com" value={form.socialPortfolio} onChange={change} /></div>
          </div>
          <div className="form-group"><label>Education</label>
            <textarea name="education" rows={3} placeholder="B.Tech CS - GLA University (2020-2024)"
              value={form.education} onChange={change} /></div>
          <div className="form-group"><label>Profile Photo</label>
            <input name="photo" type="file" accept="image/*" onChange={change} style={{ padding: '8px' }} /></div>
        </div>
      )}

      {activeTab === 'skills' && (
        <div className="animate-fade-in" style={{ display: 'grid', gap: '14px' }}>
          <div className="form-group"><label>Skills (one per line)</label>
            <textarea name="skills" rows={5}
              placeholder={"React.js\nNode.js\nPython\nCapacitor"}
              value={form.skills} onChange={change} className="wide-textarea" /></div>
          <div className="form-group"><label>Projects / Experience (one per line)</label>
            <textarea name="projects" rows={6}
              placeholder={"NitinNova Resume Builder - React & Flask\nAutomated Android APK build pipeline"}
              value={form.projects} onChange={change} className="wide-textarea" /></div>
        </div>
      )}

      {activeTab === 'sections' && (
        <div className="animate-fade-in" style={{ display: 'grid', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Custom Sections</h3>
            <button type="button" className="btn btn-primary" onClick={addSection} style={{ padding: '6px 14px', fontSize: '13px' }}>+ Add</button>
          </div>
          {(form.sections || []).length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
              Tap "+ Add" to create a custom section like Certifications, Languages, or Volunteer Work.
            </p>
          )}
          {(form.sections || []).map((section, idx) => (
            <div key={section.id} className="section-card">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', minWidth: '32px' }}>#{idx + 1}</span>
                <input type="text" placeholder="Section Title" value={section.title}
                  onChange={e => updateSection(section.id, 'title', e.target.value)} style={{ flex: 1, minWidth: '100px' }} />
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => moveSection(idx, -1)}
                    disabled={idx === 0} style={{ padding: '5px 10px', fontSize: '12px' }}>Up</button>
                  <button type="button" className="btn btn-secondary" onClick={() => moveSection(idx, 1)}
                    disabled={idx === (form.sections || []).length - 1} style={{ padding: '5px 10px', fontSize: '12px' }}>Down</button>
                  <button type="button" className="btn btn-danger" onClick={() => removeSection(section.id)}
                    style={{ padding: '5px 10px', fontSize: '12px' }}>Remove</button>
                </div>
              </div>
              <textarea placeholder="Write your content here — you can see everything you type."
                value={section.content}
                onChange={e => updateSection(section.id, 'content', e.target.value)}
                rows={5} className="wide-textarea" />
            </div>
          ))}
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? 'Processing...' : 'AI Generate'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={generateOffline}>Format Offline</button>
        <button type="button" className="btn btn-success" onClick={save}>Save</button>
        <button type="button" className="btn btn-secondary" onClick={saveAsProfile}>Profile</button>
      </div>

      {statusMessage && <div className="status-msg">{statusMessage}</div>}
    </div>
  )
}
