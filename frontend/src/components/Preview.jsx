import React, { useState, useRef, useCallback, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Toast } from '@capacitor/toast'
import { templateSets, fontOptions, fontSizePresets } from '../templateData'

function getLayoutStyle(t) {
  const all = templateSets
  const found = [...(all.online || []), ...(all.offline || [])].find(x => x.id === t)
  const s = (found && found.style) || 'ats'
  if (['gradient', 'boldheader', 'dark', 'portfolio'].includes(s)) return 'gradient'
  if (['photo', 'side', 'doublecol'].includes(s)) return 'sidebar'
  if (['executive', 'elegant', 'classic', 'tech', 'timeline'].includes(s)) return 'professional'
  return 'clean'
}

async function doExportPDF(el, savedId, setStatus) {
  setStatus('')
  try {
    const canvas = await html2canvas(el, {
      scale: 3, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
      width: el.scrollWidth, height: el.scrollHeight, windowWidth: el.scrollWidth,
    })
    const imgData = canvas.toDataURL('image/png')
    const pdfW = 612, pdfH = 792
    const imgRatio = canvas.width / canvas.height
    let w, h
    if (imgRatio > pdfW / pdfH) { w = pdfW; h = pdfW / imgRatio }
    else { h = pdfH; w = pdfH * imgRatio }
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const xOff = (pdfW - w) / 2
    const yOff = (pdfH - h) / 2
    doc.addImage(imgData, 'PNG', xOff, yOff, w, h)
    const fn = savedId ? 'resume_' + savedId + '.pdf' : 'resume_' + Date.now() + '.pdf'

    if (Capacitor.isNativePlatform()) {
      const b64 = doc.output('datauristring').split(',')[1]
      let saved = false
      try { await Filesystem.writeFile({ path: fn, data: b64, directory: Directory.Documents, recursive: true }); saved = true } catch {}
      if (!saved) try { await Filesystem.writeFile({ path: fn, data: b64, directory: Directory.Cache, recursive: true }); saved = true } catch {}
      if (!saved) try { await Filesystem.writeFile({ path: fn, data: b64, directory: Directory.Data, recursive: true }); saved = true } catch {}
      if (saved) {
        await Toast.show({ text: 'Resume saved to Documents!' })
        setStatus('Resume saved to phone Documents folder!')
      } else {
        doc.save(fn)
        setStatus('PDF downloaded!')
      }
    } else {
      doc.save(fn)
      setStatus('PDF downloaded!')
    }
  } catch (e) {
    console.error('PDF error:', e)
    setStatus('Error: ' + (e.message || String(e)))
  }
}

export default function Preview({ polished, savedId, saveTrigger }) {
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const previewRef = useRef(null)

  useEffect(() => {
    if (saveTrigger > 0 && previewRef.current && polished) {
      setSaving(true)
      doExportPDF(previewRef.current, savedId, setStatus).finally(() => setSaving(false))
    }
  }, [saveTrigger])

  const exportPDF = useCallback(async () => {
    if (!previewRef.current) return
    setSaving(true)
    await doExportPDF(previewRef.current, savedId, setStatus)
    setSaving(false)
  }, [savedId])

  if (!polished) {
    return (
      <div className="glass-card preview-panel" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
        Live preview will appear here as you fill in details.
      </div>
    )
  }

  const p = polished
  const tid = p.template || 'photo-profile'
  const layout = getLayoutStyle(tid)
  const accent = p.bgColor || '#6366f1'
  const skills = (p.skills || '').split('\n').filter(Boolean)
  const bullets = (p.bullets || []).filter(b => !b.startsWith('Technologies:'))
  const fc = fontOptions.find(f => f.id === (p.fontFamily || 'helvetica')) || fontOptions[0]
  const sz = fontSizePresets.find(s => s.id === (p.fontSizePreset || 'normal')) || fontSizePresets[1]
  const nameSz = sz.nameSize || 26
  const bodySz = sz.bodySize || 11
  const headSz = sz.headingSize || 16
  const shape = p.photoShape || 'circle'

  const hdr = (c) => ({ color: '#0f172a', borderBottom: `2px solid ${c}`, paddingBottom: '6px', fontSize: `${headSz}px` })

  function photoCSS(sz2) {
    const br = shape === 'circle' ? '50%' : shape === 'rounded' ? '16px' : '6px'
    return { width: sz2, height: sz2, borderRadius: br, objectFit: 'cover' }
  }

  const PAGE_W = 700

  return (
    <div className="glass-card preview-panel animate-fade-in" style={{ display: 'grid', gap: '16px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ margin: 0 }}>Live Preview</h3>
        <button className="btn btn-primary" onClick={exportPDF} disabled={saving}
          style={{ padding: '8px 14px', fontSize: '13px' }}>
          {saving ? 'Saving...' : 'Download PDF'}
        </button>
      </div>

      {status && (
        <div style={{
          padding: '10px 14px', fontSize: '13px', borderRadius: '8px',
          backgroundColor: status.startsWith('Error') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
          border: `1px solid ${status.startsWith('Error') ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
          color: status.startsWith('Error') ? '#fca5a5' : '#6ee7b7'
        }}>{status}</div>
      )}

      <div style={{ overflowX: 'auto', borderRadius: '12px' }}>
        <div ref={previewRef} style={{
          background: '#fff', color: '#1e293b', width: PAGE_W + 'px', margin: '0 auto',
          fontSize: `${bodySz}px`, lineHeight: '1.5', textAlign: 'left', fontFamily: fc.value,
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)', overflow: 'hidden'
        }}>
          {layout === 'gradient' ? (
            <div>
              <div style={{ background: accent, color: '#fff', padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: `${nameSz}px`, fontWeight: 800 }}>{p.name || 'Your Name'}</h1>
                  <p style={{ margin: '6px 0 0', opacity: 0.9 }}>{p.email || ''} {p.phone ? `| ${p.phone}` : ''}</p>
                  {(p.socialGithub || p.socialLinkedin || p.socialPortfolio) && (
                    <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', opacity: 0.85 }}>
                      {p.socialGithub && <span>GitHub: {p.socialGithub}</span>}
                      {p.socialLinkedin && <span>LinkedIn: {p.socialLinkedin}</span>}
                      {p.socialPortfolio && <span>Web: {p.socialPortfolio}</span>}
                    </div>
                  )}
                </div>
                {p.photo && <img src={p.photo} alt="" style={{ ...photoCSS('80px'), border: '3px solid #fff', flexShrink: 0 }} />}
              </div>
              <div style={{ padding: '32px', display: 'grid', gap: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div><h3 style={hdr(accent)}>Education</h3><p style={{ color: '#475569', whiteSpace: 'pre-wrap', marginTop: '8px' }}>{p.education || 'No details.'}</p></div>
                  <div><h3 style={hdr(accent)}>Skills</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                      {skills.map((sk, i) => <span key={i} style={{ padding: '4px 10px', backgroundColor: `${accent}10`, border: `1px solid ${accent}30`, borderRadius: '100px', fontSize: '12px', color: accent, fontWeight: 500 }}>{sk}</span>)}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 style={hdr(accent)}>Experience & Projects</h3>
                  <ul style={{ paddingLeft: '18px', marginTop: '10px', display: 'grid', gap: '8px' }}>
                    {bullets.length > 0 ? bullets.map((b, i) => <li key={i} style={{ color: '#334155' }}>{b}</li>) : <li style={{ color: '#94a3b8', listStyleType: 'none' }}>{p.projects || 'No projects listed.'}</li>}
                  </ul>
                </div>
                {p.sections && p.sections.map((sec, i) => (
                  <div key={i}><h3 style={hdr(accent)}>{sec.title}</h3><p style={{ color: '#334155', whiteSpace: 'pre-wrap', marginTop: '8px' }}>{sec.content}</p></div>
                ))}
              </div>
            </div>
          ) : layout === 'sidebar' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr' }}>
              <div style={{ background: '#f8fafc', padding: '32px 20px', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {p.photo && <div style={{ textAlign: 'center' }}><img src={p.photo} alt="" style={{ ...photoCSS('96px'), border: `2px solid ${accent}` }} /></div>}
                <div><h4 style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px', color: accent, marginBottom: '8px' }}>CONTACT</h4>
                  <div style={{ display: 'grid', gap: '6px', fontSize: '11px', color: '#475569', wordBreak: 'break-all' }}>
                    <div>{p.email}</div>{p.phone && <div>{p.phone}</div>}
                    {p.socialGithub && <div>GitHub: {p.socialGithub}</div>}
                    {p.socialLinkedin && <div>LinkedIn: {p.socialLinkedin}</div>}
                    {p.socialPortfolio && <div>Web: {p.socialPortfolio}</div>}
                  </div>
                </div>
                <div><h4 style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px', color: accent, marginBottom: '8px' }}>EDUCATION</h4>
                  <p style={{ fontSize: '11px', color: '#475569', whiteSpace: 'pre-wrap' }}>{p.education || 'No details.'}</p>
                </div>
                <div><h4 style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '1px', color: accent, marginBottom: '8px' }}>SKILLS</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {skills.map((sk, i) => <span key={i} style={{ padding: '2px 8px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '10px', color: '#334155' }}>{sk}</span>)}
                  </div>
                </div>
              </div>
              <div style={{ padding: '32px' }}>
                <h1 style={{ margin: 0, fontSize: `${nameSz}px`, fontWeight: 800, color: '#0f172a' }}>{p.name || 'Your Name'}</h1>
                <div style={{ width: '40px', height: '4px', background: accent, marginTop: '12px', marginBottom: '28px' }}></div>
                <div style={{ display: 'grid', gap: '24px' }}>
                  <div><h3 style={{ color: '#0f172a', fontSize: `${headSz}px`, borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>Projects & Experience</h3>
                    <ul style={{ paddingLeft: '18px', marginTop: '10px', display: 'grid', gap: '8px' }}>
                      {bullets.length > 0 ? bullets.map((b, i) => <li key={i} style={{ color: '#334155' }}>{b}</li>) : <li style={{ color: '#94a3b8', listStyleType: 'none' }}>{p.projects || 'No projects.'}</li>}
                    </ul>
                  </div>
                  {p.sections && p.sections.map((sec, i) => (
                    <div key={i}><h3 style={{ color: '#0f172a', fontSize: `${headSz}px`, borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>{sec.title}</h3>
                      <p style={{ color: '#334155', whiteSpace: 'pre-wrap', marginTop: '8px' }}>{sec.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : layout === 'professional' ? (
            <div style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: `${nameSz}px`, color: '#0f172a', fontWeight: 700 }}>{p.name || 'Your Name'}</h1>
                  <p style={{ margin: '6px 0 0', color: '#475569' }}>{p.email || ''} {p.phone ? `| ${p.phone}` : ''}</p>
                  {(p.socialGithub || p.socialLinkedin || p.socialPortfolio) && (
                    <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#64748b' }}>
                      {p.socialGithub && <span>GitHub: {p.socialGithub}</span>}
                      {p.socialLinkedin && <span>LinkedIn: {p.socialLinkedin}</span>}
                      {p.socialPortfolio && <span>Web: {p.socialPortfolio}</span>}
                    </div>
                  )}
                </div>
                {p.photo && <img src={p.photo} alt="" style={{ ...photoCSS('64px'), border: `2px solid ${accent}` }} />}
              </div>
              <div style={{ borderBottom: `2px solid ${accent}`, marginBottom: '24px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div><h3 style={hdr(accent)}>Education</h3><p style={{ color: '#334155', whiteSpace: 'pre-wrap', marginTop: '8px' }}>{p.education || 'No details.'}</p></div>
                <div><h3 style={hdr(accent)}>Skills</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {skills.map((sk, i) => <span key={i} style={{ padding: '3px 8px', backgroundColor: '#f1f5f9', borderRadius: '4px', fontSize: '11px', color: '#334155' }}>{sk}</span>)}
                  </div>
                </div>
              </div>
              <div>
                <h3 style={hdr(accent)}>Projects & Experience</h3>
                <ul style={{ paddingLeft: '18px', marginTop: '10px', display: 'grid', gap: '8px' }}>
                  {bullets.length > 0 ? bullets.map((b, i) => <li key={i} style={{ color: '#334155' }}>{b}</li>) : <li style={{ color: '#94a3b8', listStyleType: 'none' }}>{p.projects || 'No projects.'}</li>}
                </ul>
              </div>
              {p.sections && p.sections.map((sec, i) => (
                <div key={i} style={{ marginTop: '20px' }}><h3 style={hdr(accent)}>{sec.title}</h3><p style={{ color: '#334155', whiteSpace: 'pre-wrap', marginTop: '8px' }}>{sec.content}</p></div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '40px' }}>
              <div style={{ textAlign: 'center', marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: `${nameSz + 4}px`, color: '#0f172a', fontWeight: 700 }}>{p.name || 'Your Name'}</h1>
                  <p style={{ margin: '8px 0 0', color: '#475569' }}>{p.email || ''} {p.phone ? `| ${p.phone}` : ''}</p>
                  {(p.socialGithub || p.socialLinkedin || p.socialPortfolio) && (
                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '12px', color: '#64748b' }}>
                      {p.socialGithub && <span>GitHub: {p.socialGithub}</span>}
                      {p.socialLinkedin && <span>LinkedIn: {p.socialLinkedin}</span>}
                      {p.socialPortfolio && <span>Web: {p.socialPortfolio}</span>}
                    </div>
                  )}
                </div>
                {p.photo && <img src={p.photo} alt="" style={{ ...photoCSS('70px'), border: '2px solid #e2e8f0', flexShrink: 0 }} />}
              </div>
              <div style={{ borderBottom: '2px solid #0f172a', marginBottom: '28px' }} />
              <div style={{ display: 'grid', gap: '28px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
                  <div><h3 style={{ color: '#0f172a', fontSize: `${headSz - 1}px`, fontWeight: 700, textTransform: 'uppercase' }}>Education</h3>
                    <p style={{ color: '#334155', whiteSpace: 'pre-wrap', marginTop: '6px' }}>{p.education || 'No details.'}</p></div>
                  <div><h3 style={{ color: '#0f172a', fontSize: `${headSz - 1}px`, fontWeight: 700, textTransform: 'uppercase' }}>Skills</h3>
                    <p style={{ color: '#334155', whiteSpace: 'pre-wrap', marginTop: '6px' }}>{skills.join(' | ') || 'No skills.'}</p></div>
                </div>
                <div>
                  <h3 style={{ color: '#0f172a', fontSize: `${headSz - 1}px`, fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>Projects & Experience</h3>
                  <ul style={{ paddingLeft: '18px', marginTop: '10px', display: 'grid', gap: '8px' }}>
                    {bullets.length > 0 ? bullets.map((b, i) => <li key={i} style={{ color: '#334155' }}>{b}</li>) : <li style={{ color: '#94a3b8', listStyleType: 'none' }}>{p.projects || 'No projects.'}</li>}
                  </ul>
                </div>
                {p.sections && p.sections.map((sec, i) => (
                  <div key={i}><h3 style={{ color: '#0f172a', fontSize: `${headSz - 1}px`, fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>{sec.title}</h3>
                    <p style={{ color: '#334155', whiteSpace: 'pre-wrap', marginTop: '8px' }}>{sec.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
