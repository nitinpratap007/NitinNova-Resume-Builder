import React, { useState, useEffect } from 'react'
import { polishBullets, organizeSkills } from '../localAI'
import { draftResume } from '../aiBuilder'
import { normalizeResumeData } from '../resumeNormalize'
import TemplateSelector from './TemplateSelector'
import { templateSets, fontOptions, fontSizePresets, defaultSkillCategories, defaultSections } from '../templateData'
import API from '../api'
import { getDraft, queueDraftSave, onDraftStatus, getProfiles, saveProfiles, pushVersion } from '../storage'

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
  // autosave indicator: idle | saving | saved | error  (+ timestamp)
  const [saveStatus, setSaveStatus] = useState({ status: 'idle', at: null })
  // id of the profile currently open — repeated "Save" updates it in place
  // instead of duplicating it (web improvement over the APK behaviour).
  // Stored in localStorage (tiny flag, SYNCHRONOUS reads) so it survives
  // editor unmount/remount cycles — an async (IndexedDB) copy would race
  // the debounced draft write and duplicate profiles.
  const [activeProfileId, setActiveProfileId] = useState(() => {
    try {
      const v = localStorage.getItem('nn_active_profile_id')
      return v ? Number(v) : null
    } catch { return null }
  })
  function setActiveId(id) {
    setActiveProfileId(id)
    try {
      if (id === null || id === undefined) localStorage.removeItem('nn_active_profile_id')
      else localStorage.setItem('nn_active_profile_id', String(id))
    } catch {}
  }
  // true only after the draft-load effect has run — prevents the draft-save
  // effect from overwriting the stored draft with the empty initial form
  // (StrictMode double-invokes effects, which made drafts never load)
  const [hydrated, setHydrated] = useState(false)

  // ---- AI draft panel (web-only, FREE & offline — see aiBuilder.js) ----
  const [aiOpen, setAiOpen] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiForm, setAiForm] = useState({ jobTitle: '', years: '', skills: '', highlights: '', education: '' })

  // Autosave status feed (IndexedDB storage layer)
  useEffect(() => onDraftStatus((status, at) => setSaveStatus({ status, at })), [])

  useEffect(() => {
    if (initialData) {
      // Normalize the loaded profile (dedupe sections/skill groups/items) so
      // corrupted legacy data cannot produce duplicated preview/PDF content.
      const nd = normalizeResumeData(initialData)
      setForm(prev => ({
        ...prev,
        name: nd.name || '', headline: nd.headline || '',
        location: nd.location || '', summary: nd.summary || '',
        email: nd.email || '', phone: nd.phone || '',
        education: nd.education || '',
        skills: nd.skills || '', projects: nd.projects || '',
        skillGroups: nd.skillGroups && nd.skillGroups.length
          ? nd.skillGroups
          : organizeSkills(nd.skills || '', defaultSkillCategories),
        photo: nd.photo || '', photoShape: nd.photoShape || 'circle',
        bgColor: nd.bgColor || '#eef2ff',
        socialGithub: nd.socialGithub || '',
        socialLinkedin: nd.socialLinkedin || '',
        socialPortfolio: nd.socialPortfolio || '',
        sections: nd.sections && nd.sections.length
          ? nd.sections
          : defaultSections.map((s, i) => ({ id: Date.now() + i, ...s })),
      }))
      if (initialData.template) setTemplate(initialData.template)
      if (initialData.templateMode) setTemplateMode(initialData.templateMode)
      if (initialData.fontFamily) setFontFamily(initialData.fontFamily)
      if (initialData.fontSizePreset) setFontSizePreset(initialData.fontSizePreset)
      if (initialData.margins) setMargins(initialData.margins)
      setActiveId(typeof initialData.id === 'number' ? initialData.id : null)
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
    let alive = true
    async function loadDraft() {
      try {
        if (!initialData) {
          // IndexedDB draft (falls back to localStorage / legacy key migration)
          const draft = await getDraft()
          if (draft && draft.form && alive) {
            // Normalize legacy draft data (dedupe sections/groups/items) BEFORE
            // seeding defaults, so corrupted old drafts never duplicate content.
            const f = normalizeResumeData(draft.form)
            // Migrate old drafts: seed skill groups + default sections once
            if (!f.skillGroups || !f.skillGroups.length) f.skillGroups = organizeSkills(f.skills || '', defaultSkillCategories)
            if (!f.sections || !f.sections.length) {
              f.sections = defaultSections.map((s, i) => ({ id: Date.now() + i, ...s }))
            }
            setForm(prev => ({ ...prev, ...f }))
            setTemplate(draft.template || template)
            setTemplateMode(draft.templateMode || templateMode)
            if (draft.fontFamily) setFontFamily(draft.fontFamily)
            if (draft.fontSizePreset) setFontSizePreset(draft.fontSizePreset)
            if (draft.margins) setMargins(draft.margins)
          } else if (alive) {
            // Fresh start: seed default sections so ATS structure is ready
            setForm(prev => prev.sections.length ? prev : ({
              ...prev,
              sections: defaultSections.map((s, i) => ({ id: Date.now() + i, ...s })),
            }))
          }
        }
      } catch (err) { console.error('Load draft failed', err) }
      if (alive) setHydrated(true)
    }
    loadDraft()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const draft = { form, template, templateMode, fontFamily, fontSizePreset, margins }
    queueDraftSave(draft) // debounced IndexedDB write + visible autosave status
  }, [hydrated, form, template, templateMode, fontFamily, fontSizePreset, margins])

  // Ctrl/Cmd+S = save current resume (documented on the Settings page)
  useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileId, form, template, templateMode, fontFamily, fontSizePreset, margins])


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

  async function saveAsProfile() {
    const profile = { id: Date.now(), ...form, template, templateMode, fontFamily, fontSizePreset, margins, savedAt: new Date().toISOString() }
    setStatusMessage('Saving\u2026')
    try {
      const existing = await getProfiles()
      const next = [profile, ...existing.filter(p => p.name !== profile.name)].slice(0, 60)
      await saveProfiles(next)
      setActiveId(profile.id)
      await pushVersion(profile.id, profile)
      setStatusMessage(`Profile "${profile.name}" saved.`)
      if (onSaved) onSaved(profile.id)
    } catch (e) {
      setStatusMessage('Save failed: ' + (e && e.message ? e.message : 'storage unavailable'))
    }
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

  // AI Draft — fills the form from the basics the user typed. Runs 100%
  // locally (aiBuilder.js): free, offline, and it never invents facts.
  async function runAiDraft(e) {
    if (e) e.preventDefault()
    setAiError('')
    if (!aiForm.jobTitle.trim()) {
      setAiError('Tell us the role you are targeting (e.g. "Frontend Developer").')
      return
    }
    const hasContent = String(form.summary || '').trim() || String(form.projects || '').trim()
    if (hasContent && !window.confirm('This will replace your summary and experience lines with the AI draft. Continue?')) {
      return
    }
    setAiBusy(true)
    try {
      // yield a frame so the button shows its busy state before the (fast) local run
      await new Promise(r => setTimeout(r, 30))
      const d = draftResume(aiForm)
      setForm(prev => ({
        ...prev,
        headline: prev.headline || d.headline,
        summary: d.summary,
        skills: d.skills,
        skillGroups: organizeSkills(d.skills, defaultSkillCategories),
        projects: d.projects,
        education: prev.education || aiForm.education || '',
      }))
      setActiveTab('personal')
      if (onToast) onToast('Draft generated — review every line, then download your PDF.')
    } catch (err) {
      setAiError((err && err.message) || 'Could not generate a draft.')
    } finally {
      setAiBusy(false)
    }
  }

  async function save(e) {
    if (e) e.preventDefault()
    setStatusMessage('Saving\u2026')
    try {
      const existing = await getProfiles()
      const stamp = { ...form, template, templateMode, fontFamily, fontSizePreset, margins, savedAt: new Date().toISOString() }
      let profile
      if (activeProfileId !== null && existing.some(p => p.id === activeProfileId)) {
        // Update the open profile in place — repeated Save never duplicates it.
        profile = { ...existing.find(p => p.id === activeProfileId), ...stamp }
        await saveProfiles(existing.map(p => (p.id === activeProfileId ? profile : p)))
      } else {
        profile = { id: Date.now(), ...stamp }
        await saveProfiles([profile, ...existing].slice(0, 60))
        setActiveId(profile.id)
      }
      await pushVersion(profile.id, profile) // version-history snapshot
      setStatusMessage('Saved locally.')
      if (onSaved) onSaved(profile.id)
    } catch (err) {
      setStatusMessage('Save failed: ' + (err && err.message ? err.message : 'storage unavailable'))
    }
    if (onSavePdf) onSavePdf()
  }

  // Section completeness indicators (web-only): cheap counts shown as tab badges
  const tabInfo = (() => {
    const filled = ['name', 'headline', 'email', 'phone', 'summary', 'education']
      .filter(k => String(form[k] || '').trim()).length
    const skillItems = (form.skillGroups || []).flatMap(g => g.items || []).filter(Boolean).length
    const projLines = String(form.projects || '').split('\n').map(s => s.trim()).filter(Boolean).length
    const custom = (form.sections || []).filter(s => String(s.title || '').trim() || String(s.content || '').trim()).length
    return {
      personal: `${filled}/6`,
      personalTone: filled >= 6 ? 'ok' : filled >= 3 ? 'warn' : 'bad',
      exp: projLines ? String(projLines) : (skillItems ? '•' : '!'),
      expTone: skillItems > 0 && projLines > 0 ? 'ok' : (skillItems > 0 || projLines > 0) ? 'warn' : 'bad',
      sections: String(custom),
      sectionsTone: custom > 0 ? 'ok' : 'muted',
    }
  })()

  return (
    <div className="glass-card animate-fade-in form-panel">
      <div className="form-head">
        <h2 style={{ margin: 0 }}>Resume Creator</h2>
        <span className={`autosave-pill`} data-state={saveStatus.status} title="Drafts autosave to this device (IndexedDB)">
          {saveStatus.status === 'saving' ? 'Saving\u2026'
            : saveStatus.status === 'saved' ? `\u2713 Saved ${saveStatus.at ? new Date(saveStatus.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`
            : saveStatus.status === 'error' ? '\u26A0 Autosave failed'
            : '\uD83D\uDD12 On this device'}
        </span>
      </div>

      <div className="tabs-header">
        <button type="button" className={`tab-btn ${activeTab === 'design' ? 'active' : ''}`}
          onClick={() => setActiveTab('design')}>Design</button>
        <button type="button" className={`tab-btn ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => setActiveTab('personal')}>Personal
          <span className="tab-badge" data-tone={tabInfo.personalTone}>{tabInfo.personal}</span>
        </button>
        <button type="button" className={`tab-btn ${activeTab === 'skills' ? 'active' : ''}`}
          onClick={() => setActiveTab('skills')}>Experience
          <span className="tab-badge" data-tone={tabInfo.expTone}>{tabInfo.exp}</span>
        </button>
        <button type="button" className={`tab-btn ${activeTab === 'sections' ? 'active' : ''}`}
          onClick={() => setActiveTab('sections')}>Sections
          <span className="tab-badge" data-tone={tabInfo.sectionsTone}>{tabInfo.sections}</span>
        </button>
        <button type="button" className={`tab-btn ai-tab-btn ${aiOpen ? 'active' : ''}`}
          onClick={() => setAiOpen(o => !o)} aria-expanded={aiOpen}>
          ✨ AI Draft
        </button>
      </div>

      {aiOpen && (
        <form className="animate-fade-in ai-draft-panel" onSubmit={runAiDraft}
          style={{ display: 'grid', gap: '12px', marginBottom: '18px', padding: '16px',
            border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md, 12px)',
            background: 'rgba(99,102,241,0.05)' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            Tell the AI about yourself — it drafts your summary, skills and experience bullets instantly.
            Runs entirely on this device: free, offline, and it never invents facts you didn't type.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Target role *</label>
              <input value={aiForm.jobTitle} onChange={e => { setAiForm({ ...aiForm, jobTitle: e.target.value }); setAiError('') }}
                placeholder="e.g. Frontend Developer" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Years of experience</label>
              <input type="number" min="0" max="50" value={aiForm.years}
                onChange={e => setAiForm({ ...aiForm, years: e.target.value })}
                placeholder="e.g. 2" />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Your skills</label>
            <textarea rows={2} value={aiForm.skills}
              onChange={e => setAiForm({ ...aiForm, skills: e.target.value })}
              placeholder={"React, JavaScript, CSS\nPython, Flask, SQL"} className="wide-textarea" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>What you have worked on (one per line)</label>
            <textarea rows={3} value={aiForm.highlights}
              onChange={e => setAiForm({ ...aiForm, highlights: e.target.value })}
              placeholder={"built a resume builder with React and Flask\nautomated the Android APK release pipeline"}
              className="wide-textarea" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Education</label>
            <input value={aiForm.education}
              onChange={e => setAiForm({ ...aiForm, education: e.target.value })}
              placeholder="e.g. B.Tech Computer Science" />
          </div>
          {aiError && (
            <div role="alert" style={{ padding: '8px 12px', fontSize: '13px', color: '#fca5a5',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px' }}>
              {aiError}
            </div>
          )}
          <div>
            <button type="submit" className="btn btn-primary" disabled={aiBusy}
              style={{ padding: '10px 20px' }}>
              {aiBusy ? 'Drafting…' : '✨ Generate my resume draft'}
            </button>
          </div>
        </form>
      )}

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
              <input name="phone" placeholder="e.g. +91 98765 43210" value={form.phone} onChange={change} /></div>
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
