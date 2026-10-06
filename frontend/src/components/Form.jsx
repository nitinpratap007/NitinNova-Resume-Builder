import React, { useState, useEffect } from 'react'
import { polishBullets, organizeSkills } from '../localAI'
import TemplateSelector from './TemplateSelector'
import { templateSets, fontOptions, fontSizePresets, defaultSkillCategories, defaultSections } from '../templateData'
import API from '../api'

const DRAFT_KEY = 'resume_builder_draft'
const PROFILES_KEY = 'nitinnova_resume_profiles'

export default function Form({ onPolished, onSaved, onSavePdf, initialData }) {
  const [form, setForm] = useState({
    name: '', headline: '', location: '', summary: '',
    email: '', phone: '', education: '', skills: '', projects: '',
    skillGroups: [],
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
  // true only after the draft-load effect has run — prevents the draft-save
  // effect from overwriting the stored draft with the empty initial form
  // (StrictMode double-invokes effects, which made drafts never load)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (initialData) {
      setForm(prev => ({
        ...prev,
        name: initialData.name || '', headline: initialData.headline || '',
        location: initialData.location || '', summary: initialData.summary || '',
        email: initialData.email || '', phone: initialData.phone || '',
        education: initialData.education || '',
        skills: initialData.skills || '', projects: initialData.projects || '',
        skillGroups: initialData.skillGroups && initialData.skillGroups.length
          ? initialData.skillGroups
          : organizeSkills(initialData.skills || '', defaultSkillCategories),
        photo: initialData.photo || '', photoShape: initialData.photoShape || 'circle',
        bgColor: initialData.bgColor || '#eef2ff',
        socialGithub: initialData.socialGithub || '',
        socialLinkedin: initialData.socialLinkedin || '',
        socialPortfolio: initialData.socialPortfolio || '',
        sections: initialData.sections && initialData.sections.length
          ? initialData.sections
          : defaultSections.map((s, i) => ({ id: Date.now() + i, ...s })),
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
    if (!initialData) {
      try {
        const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
        if (draft && draft.form) {
          const f = draft.form
          // Migrate old drafts: seed skill groups + default sections once
          if (!f.skillGroups) f.skillGroups = organizeSkills(f.skills || '', defaultSkillCategories)
          if (!f.sections || !f.sections.length) {
            f.sections = defaultSections.map((s, i) => ({ id: Date.now() + i, ...s }))
          }
          setForm(prev => ({ ...prev, ...f }))
          setTemplate(draft.template || template)
          setTemplateMode(draft.templateMode || templateMode)
          if (draft.fontFamily) setFontFamily(draft.fontFamily)
          if (draft.fontSizePreset) setFontSizePreset(draft.fontSizePreset)
          if (draft.margins) setMargins(draft.margins)
        } else {
          // Fresh start: seed default sections so ATS structure is ready
          setForm(prev => prev.sections.length ? prev : ({
            ...prev,
            sections: defaultSections.map((s, i) => ({ id: Date.now() + i, ...s })),
          }))
        }
      } catch (err) { console.error('Load draft failed', err) }
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const draft = { form, template, templateMode, fontFamily, fontSizePreset, margins }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [hydrated, form, template, templateMode, fontFamily, fontSizePreset, margins])

  // Keep legacy `skills` string in sync with skill groups (used by AI polish + cover letter)
  useEffect(() => {
    const flat = (form.skillGroups || []).flatMap(g => g.items || []).join('\n')
    if (flat !== (form.skills || '')) setForm(prev => ({ ...prev, skills: flat }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.skillGroups])

  useEffect(() => {
    const p = polishBullets(form)
    const shaped = { ...p, template, templateMode, fontFamily, fontSizePreset, margins,
      sections: form.sections, bgColor: form.bgColor, photo: form.photo, photoShape: form.photoShape }
    onPolished(shaped)
  }, [form, template, templateMode, fontFamily, fontSizePreset, margins])

  // Active accent: customized color wins, else the template's default accent
  const activeAccent = (() => {
    const t = [...(templateSets.online || []), ...(templateSets.offline || [])].find(x => x.id === template)
    const customized = form.bgColor && form.bgColor.toLowerCase() !== '#eef2ff'
    if (customized) return form.bgColor
    return (t && t.ats && t.ats.accent) || (t && t.palette && t.palette[0]) || '#6366f1'
  })()

  function handleTemplateChange(id) {
    setTemplate(id)
    // keep the accent in sync with the newly selected template when untouched
    const t = [...(templateSets.online || []), ...(templateSets.offline || [])].find(x => x.id === id)
    const untouched = !form.bgColor || form.bgColor.toLowerCase() === '#eef2ff'
    if (t && untouched) {
      const accent = (t.ats && t.ats.accent) || (t.palette && t.palette[0])
      if (accent) setForm(prev => ({ ...prev, bgColor: accent }))
    }
  }

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

  // ---- Skill categories -------------------------------------------------
  function addSkillGroup() {
    setForm(prev => ({
      ...prev,
      skillGroups: [...(prev.skillGroups || []), { id: Date.now(), category: 'New Category', items: [] }]
    }))
  }
  function updateSkillGroup(id, patch) {
    setForm(prev => ({
      ...prev,
      skillGroups: (prev.skillGroups || []).map(g => g.id === id ? { ...g, ...patch } : g)
    }))
  }
  function removeSkillGroup(id) {
    setForm(prev => ({ ...prev, skillGroups: (prev.skillGroups || []).filter(g => g.id !== id) }))
  }
  function moveSkillGroup(index, direction) {
    const groups = [...(form.skillGroups || [])]
    const ni = index + direction
    if (ni < 0 || ni >= groups.length) return
    ;[groups[index], groups[ni]] = [groups[ni], groups[index]]
    setForm(prev => ({ ...prev, skillGroups: groups }))
  }
  function autoOrganizeSkills() {
    const merged = (form.skillGroups || []).flatMap(g => g.items || [])
    const source = merged.length ? merged.join('\n') : (form.skills || '')
    if (!source.trim()) { setStatusMessage('Add skills first, then auto-organize.'); return }
    const groups = organizeSkills(source, defaultSkillCategories)
    setForm(prev => ({ ...prev, skillGroups: groups, skills: groups.flatMap(g => g.items).join('\n') }))
    setStatusMessage('Skills organized into categories.')
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
      const res = await API.post('/generate-resume', form)
      // form first so new ATS fields (headline, location, summary, skillGroups)
      // survive even if the server response omits them
      const shaped = { ...form, ...res.data.polished, template, templateMode, fontFamily, fontSizePreset, margins,
        sections: form.sections, skillGroups: form.skillGroups,
        bgColor: form.bgColor, photo: form.photo, photoShape: form.photoShape }
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
          <TemplateSelector mode={templateMode} template={template} bgColor={activeAccent}
            onChange={handleTemplateChange} onBgColorChange={color => setForm(prev => ({ ...prev, bgColor: color }))} />
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
              <input type="color" value={activeAccent}
                onChange={e => setForm(prev => ({ ...prev, bgColor: e.target.value }))}
                style={{ width: '100%', height: '44px', padding: 0, border: 'none', cursor: 'pointer' }} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'personal' && (
        <div className="animate-fade-in" style={{ display: 'grid', gap: '14px' }}>
          <div className="form-group"><label>Full Name</label>
            <input name="name" placeholder="e.g. NITIN PRATAP" value={form.name} onChange={change} /></div>
          <div className="form-group"><label>Headline / Title</label>
            <input name="headline" placeholder="e.g. Software Developer | Full-Stack Developer | AI & Web Development"
              value={form.headline} onChange={change} /></div>
          <div className="form-group"><label>Location</label>
            <input name="location" placeholder="e.g. Bareilly, Uttar Pradesh, India"
              value={form.location} onChange={change} /></div>
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
          <div className="form-group"><label>Professional Summary</label>
            <textarea name="summary" rows={4}
              placeholder={"Full-stack developer skilled in React, Node.js and Python...\n3-4 lines describing your strengths, focus areas and goals."}
              value={form.summary} onChange={change} className="wide-textarea" /></div>
          <div className="form-group"><label>Education</label>
            <textarea name="education" rows={3} placeholder="B.Tech CS - GLA University (2020-2024)"
              value={form.education} onChange={change} /></div>
          <div className="form-group"><label>Profile Photo (creative templates only — hidden in ATS templates)</label>
            <input name="photo" type="file" accept="image/*" onChange={change} style={{ padding: '8px' }} /></div>
        </div>
      )}

      {activeTab === 'skills' && (
        <div className="animate-fade-in" style={{ display: 'grid', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Technical Skills (categorized)</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={autoOrganizeSkills}
                style={{ padding: '6px 12px', fontSize: '12px' }}>Auto-organize</button>
              <button type="button" className="btn btn-primary" onClick={addSkillGroup}
                style={{ padding: '6px 14px', fontSize: '13px' }}>+ Category</button>
            </div>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
            One skill per line inside each category. "Auto-organize" sorts your skills into the right categories automatically.
          </p>

          {(form.skillGroups || []).length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '16px' }}>
              No categories yet. Tap "+ Category" or "Auto-organize".
            </p>
          )}

          {(form.skillGroups || []).map((group, idx) => (
            <div key={group.id} className="section-card">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', minWidth: '32px' }}>#{idx + 1}</span>
                <input type="text" placeholder="Category name" value={group.category}
                  onChange={e => updateSkillGroup(group.id, { category: e.target.value })}
                  style={{ flex: 1, minWidth: '120px', fontWeight: 600 }} />
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => moveSkillGroup(idx, -1)}
                    disabled={idx === 0} style={{ padding: '5px 10px', fontSize: '12px' }}>Up</button>
                  <button type="button" className="btn btn-secondary" onClick={() => moveSkillGroup(idx, 1)}
                    disabled={idx === (form.skillGroups || []).length - 1} style={{ padding: '5px 10px', fontSize: '12px' }}>Down</button>
                  <button type="button" className="btn btn-danger" onClick={() => removeSkillGroup(group.id)}
                    style={{ padding: '5px 10px', fontSize: '12px' }}>Remove</button>
                </div>
              </div>
              <textarea placeholder={'React.js\nNext.js\nTailwind CSS'}
                value={(group.items || []).join('\n')}
                onChange={e => updateSkillGroup(group.id, {
                  items: e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
                })}
                rows={3} className="wide-textarea" style={{ marginTop: '8px', fontSize: '13px' }} />
            </div>
          ))}

          <div className="form-group" style={{ marginTop: '6px' }}>
            <label>Projects / Experience (one per line)</label>
            <textarea name="projects" rows={6}
              placeholder={"NitinNova Resume Builder - React & Flask\nAutomated Android APK build pipeline"}
              value={form.projects} onChange={change} className="wide-textarea" />
          </div>
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
