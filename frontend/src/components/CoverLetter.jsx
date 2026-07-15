import React, { useState } from 'react'
import { jsPDF } from 'jspdf'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Toast } from '@capacitor/toast'
import { generateCoverLetter } from '../localAI'
import { coverLetterTemplates } from '../templateData'
import axios from 'axios'

export default function CoverLetter({ formData }) {
  const [form, setForm] = useState({
    name: formData?.name || '',
    email: formData?.email || '',
    phone: formData?.phone || '',
    address: '',
    companyName: '',
    position: '',
    managerName: '',
  })
  const [jobDescription, setJobDescription] = useState('')
  const [style, setStyle] = useState('professional')
  const [letter, setLetter] = useState('')
  const [loading, setLoading] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function generateOnline() {
    setLoading(true)
    try {
      const res = await axios.post('http://localhost:5000/generate-cover-letter', {
        ...formData, ...form, jobDescription, style,
      })
      if (res.data.letter) setLetter(res.data.letter)
      else generateOffline()
    } catch { generateOffline() } finally { setLoading(false) }
  }

  function generateOffline() {
    const result = generateCoverLetter({ ...formData, ...form }, jobDescription, style)
    setLetter(result)
  }

  async function exportPDF() {
    setSaveMsg('')
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'letter' })
      const pageWidth = 612, margin = 60, contentWidth = pageWidth - margin * 2
      let y = 60

      doc.setFont('Helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor('#1e293b')

      const lines = letter.split('\n')
      lines.forEach(line => {
        if (line.trim() === '') { y += 14; return }
        const wrapped = doc.splitTextToSize(line, contentWidth)
        wrapped.forEach(wl => {
          if (y > 720) { doc.addPage(); y = 60 }
          doc.text(wl, margin, y); y += 16
        })
        y += 2
      })

      const name = (form.name || 'applicant').replace(/\s+/g, '_')
      const filename = `cover_letter_${name}.pdf`

      if (Capacitor.isNativePlatform()) {
        try {
          const perm = await Filesystem.requestPermissions()
          if (perm.publicStorage !== 'granted') { setSaveMsg('Permission denied — check Settings'); return }
          const dataUri = doc.output('datauristring')
          await Filesystem.writeFile({ path: filename, data: dataUri.split(',')[1], directory: Directory.Documents, recursive: true })
          await Toast.show({ text: `Cover letter saved: ${filename}` })
          setSaveMsg('PDF saved to Documents!')
        } catch (e) { setSaveMsg('Save error: ' + e.message) }
      } else {
        doc.save(filename)
        setSaveMsg('PDF downloaded!')
      }
    } catch (e) { setSaveMsg('Export failed: ' + e.message) }
  }

  return (
    <div className="glass-card animate-fade-in" style={{ display: 'grid', gap: '20px', maxWidth: '700px', margin: '0 auto' }}>
      <h2 style={{ margin: 0 }}>Cover Letter Generator</h2>

      <div className="form-group">
        <label>Your Details</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <input name="name" placeholder="Your Name" value={form.name} onChange={handleChange} />
          <input name="email" placeholder="Your Email" value={form.email} onChange={handleChange} />
          <input name="phone" placeholder="Your Phone" value={form.phone} onChange={handleChange} />
          <input name="address" placeholder="City, State" value={form.address} onChange={handleChange} />
        </div>
      </div>

      <div className="form-group">
        <label>Job Details</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <input name="companyName" placeholder="Company Name" value={form.companyName} onChange={handleChange} />
          <input name="position" placeholder="Position / Role" value={form.position} onChange={handleChange} />
          <input name="managerName" placeholder="Hiring Manager (optional)" value={form.managerName} onChange={handleChange} style={{ gridColumn: '1 / -1' }} />
        </div>
      </div>

      <div className="form-group">
        <label>Job Description (optional)</label>
        <textarea placeholder="Paste the job description here to tailor the letter..." value={jobDescription}
          onChange={e => setJobDescription(e.target.value)} rows={4} className="wide-textarea" />
      </div>

      <div className="form-group">
        <label>Cover Letter Style</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {coverLetterTemplates.map(t => (
            <button key={t.id} type="button"
              className={`btn ${style === t.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStyle(t.id)} style={{ padding: '12px', textAlign: 'left', fontSize: '13px' }}>
              <strong>{t.name}</strong>
              <span style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px', display: 'block' }}>{t.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={generateOnline} disabled={loading}>
          {loading ? 'Generating...' : 'Generate (AI)'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={generateOffline}>Offline Generate</button>
      </div>

      {letter && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0 }}>Your Cover Letter</h3>
            <button className="btn btn-success" onClick={exportPDF} style={{ padding: '8px 14px', fontSize: '13px' }}>Download PDF</button>
          </div>
          {saveMsg && <div className="status-msg">{saveMsg}</div>}
          <div style={{
            background: '#ffffff', color: '#1e293b', padding: '32px', borderRadius: 'var(--radius-md)',
            whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.8',
            fontFamily: "'Georgia', 'Times New Roman', serif", boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
          }}>{letter}</div>
        </div>
      )}
    </div>
  )
}
