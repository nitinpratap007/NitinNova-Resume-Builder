import React, { useState, useRef, useCallback, useEffect } from 'react'
import { buildResumeLayout, PAGE_W } from '../resumeLayout'
import { exportResumePdf } from '../pdfBuilder'

export default function Preview({ polished, savedId, saveTrigger }) {
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const previewRef = useRef(null)
  const busyRef = useRef(false)

  useEffect(() => {
    if (saveTrigger > 0 && polished && !busyRef.current) {
      busyRef.current = true
      setSaving(true)
      exportResumePdf(polished, savedId)
        .then(r => setStatus(r.message))
        .finally(() => { setSaving(false); busyRef.current = false })
    }
  }, [saveTrigger])

  const exportPDF = useCallback(async () => {
    // Re-entry guard: double clicks / stacked triggers never run a second
    // export while one is in flight (prevents duplicate/corrupted files).
    if (busyRef.current) return
    busyRef.current = true
    setSaving(true)
    const r = await exportResumePdf(polished, savedId)
    setStatus(r.message)
    setSaving(false)
    busyRef.current = false
  }, [polished, savedId])

  if (!polished) {
    return (
      <div className="glass-card preview-panel" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
        Live preview will appear here as you fill in details.
      </div>
    )
  }

  const L = buildResumeLayout(polished)
  const bodySz = L.sz.bodySize
  const headSz = L.sz.headingSize
  const nameSz = L.sz.nameSize
  const m = L.margins
  const center = L.align === 'center'
  const fgOnBand = L.band ? (isLight(L.accent) ? '#0f172a' : '#ffffff') : null

  // section heading style — matches pdfBuilder.sectionHeading exactly
  const headingStyle = {
    margin: '0 0 6px',
    fontSize: `${headSz}px`,
    fontWeight: 700,
    color: '#0f172a',
    textTransform: 'uppercase',
    borderBottom: L.heading === 'rule' ? '1px solid #cbd5e1'
      : L.heading === 'accent' ? `1.5px solid ${L.accent}` : 'none',
    paddingBottom: '4px',
    lineHeight: 1.3,
  }

  const Section = ({ title, children }) => (
    <section className="resume-section" style={{ marginTop: `${Math.round(bodySz * 1.4)}px` }}>
      <h3 style={headingStyle}>{title}</h3>
      {children}
    </section>
  )

  const paraStyle = { color: '#1f2937', whiteSpace: 'pre-wrap', lineHeight: 1.5, margin: 0 }

  return (
    <div className="glass-card preview-panel animate-fade-in" style={{ display: 'grid', gap: '16px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ margin: 0 }}>Live Preview</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '11px', padding: '4px 10px', borderRadius: '100px', fontWeight: 700,
            background: L.ats ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
            color: L.ats ? '#6ee7b7' : '#fcd34d',
            border: `1px solid ${L.ats ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'}`,
          }}>{L.ats ? 'ATS SAFE' : 'CREATIVE'}</span>
          <button className="btn btn-primary" onClick={exportPDF} disabled={saving}
            style={{ padding: '8px 14px', fontSize: '13px' }}>
            {saving ? 'Saving...' : 'Download PDF'}
          </button>
        </div>
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
        <div ref={previewRef} id="resume-preview" style={{
          background: '#fff', color: '#1f2937', width: PAGE_W + 'px', margin: '0 auto',
          fontSize: `${bodySz}px`, lineHeight: 1.5, textAlign: 'left', fontFamily: L.fc.value,
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)', overflow: 'hidden',
        }}>
          {/* ---------- header ---------- */}
          {L.band ? (
            <div style={{
              background: L.accent, color: fgOnBand,
              padding: `${Math.round(m * 0.55)}px ${m}px`,
              display: 'flex', alignItems: 'center', gap: '20px',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: `${nameSz}px`, fontWeight: 800, lineHeight: 1.2 }}>
                  {L.nameDisplay}
                </h1>
                {L.headline && (
                  <div style={{ fontSize: `${Math.round(bodySz * 1.1)}px`, fontWeight: 600, marginTop: '4px', opacity: 0.95 }}>
                    {L.headline}
                  </div>
                )}
                <div style={{ marginTop: '6px', fontSize: `${bodySz}px`, opacity: 0.92, display: 'grid', gap: '2px' }}>
                  {L.contact.map((c, i) => <div key={i}>{c}</div>)}
                </div>
              </div>
              {L.photo && (
                <img src={L.photo} alt="" style={{
                  width: '76px', height: '76px', flexShrink: 0,
                  borderRadius: L.photoShape === 'circle' ? '50%' : L.photoShape === 'rounded' ? '14px' : '4px',
                  objectFit: 'cover', border: `2px solid ${fgOnBand}`,
                }} />
              )}
            </div>
          ) : (
            <div style={{ padding: `${Math.round(m * 0.7)}px ${m}px 0`, textAlign: center ? 'center' : 'left' }}>
              <h1 style={{ margin: 0, fontSize: `${nameSz}px`, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                {L.nameDisplay}
              </h1>
              {L.headline && (
                <div style={{ fontSize: `${Math.round(bodySz * 1.1)}px`, fontWeight: 600, color: '#1f2937', marginTop: '4px' }}>
                  {L.headline}
                </div>
              )}
              <div style={{ marginTop: '6px', fontSize: `${bodySz}px`, color: '#475569', display: 'grid', gap: '2px' }}>
                {L.contact.map((c, i) => <div key={i}>{c}</div>)}
              </div>
            </div>
          )}

          {/* ---------- body ---------- */}
          <div style={{ padding: `${L.band ? Math.round(m * 0.4) : Math.round(bodySz * 1.2)}px ${m}px ${m}px` }}>
            {L.summary && (
              <Section title="Professional Summary">
                <p style={paraStyle}>{L.summary}</p>
              </Section>
            )}

            {L.skillLines.length > 0 && (
              <Section title="Technical Skills">
                <div style={{ display: 'grid', gap: '3px' }}>
                  {L.skillLines.map((g, i) => (
                    <div key={i} style={{ color: '#1f2937', lineHeight: 1.5 }}>
                      {g.label && <strong style={{ color: '#0f172a' }}>{g.label}: </strong>}
                      {g.items.join(', ')}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {L.projects.length > 0 && (
              <Section title="Projects">
                <div style={{ display: 'grid', gap: '4px' }}>
                  {L.projects.map((pr, i) => (
                    <div key={i} style={{ color: '#1f2937', lineHeight: 1.5, paddingLeft: '14px', textIndent: '-14px' }}>
                      - <strong style={{ color: '#0f172a' }}>{pr.title}</strong>
                      {pr.rest && <> - {pr.rest}</>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {L.education && (
              <Section title="Education">
                <p style={paraStyle}>{L.education}</p>
              </Section>
            )}

            {L.sections.map((sec, i) => (
              <Section key={i} title={sec.title}>
                <p style={paraStyle}>{sec.content}</p>
              </Section>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function isLight(hex) {
  const h = (hex || '').replace('#', '')
  if (h.length < 6) return false
  const n = parseInt(h.slice(0, 6), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55
}
