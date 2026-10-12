import React, { useEffect, useMemo } from 'react'
import { runAtsCheck } from '../atsCheck'

const STATUS_ICON = { pass: '\u2705', warn: '\u26A0\uFE0F', fail: '\u274C', info: '\u2139\uFE0F' }
const STATUS_LABEL = { pass: 'OK', warn: 'Needs attention', fail: 'Missing', info: 'Optional' }

// Modal checklist over the CURRENT resume data — read-only advice,
// it never modifies or fabricates resume content.
export default function AtsChecklist({ data, onClose }) {
  const result = useMemo(() => (data ? runAtsCheck(data) : { checks: [], grade: 0 }), [data])
  const { checks, grade } = result

  // Esc closes the dialog (documented shortcut on the Settings page)
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const counts = checks.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc }, {})

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="ATS readiness checklist">
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3 style={{ margin: 0 }}>ATS Readiness Checklist</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px 12px', fontSize: '13px' }}>Close</button>
        </div>

        <div className="ats-grade-row">
          <div className={`ats-grade ${grade >= 80 ? 'good' : grade >= 55 ? 'mid' : 'low'}`}>{grade}%</div>
          <div>
            <div style={{ fontWeight: 600 }}>
              {grade >= 80 ? 'Looks solid' : grade >= 55 ? 'Good start — a few gaps' : 'Needs work before applying'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {counts.pass || 0} passed · {counts.warn || 0} to review · {counts.fail || 0} missing · {counts.info || 0} optional
            </div>
          </div>
        </div>

        <ul className="ats-list">
          {checks.map(c => (
            <li key={c.id} className={`ats-item ${c.status}`}>
              <span className="ats-icon" aria-hidden="true">{STATUS_ICON[c.status]}</span>
              <div>
                <div className="ats-label">
                  {c.label}
                  <span className={`ats-status-tag ${c.status}`}>{STATUS_LABEL[c.status]}</span>
                </div>
                {c.detail ? <div className="ats-detail">{c.detail}</div> : null}
              </div>
            </li>
          ))}
        </ul>

        <p className="modal-footnote">
          This checklist only reads your resume as-is. It never invents or edits content —
          fix the flagged items yourself in the editor.
        </p>
      </div>
    </div>
  )
}
