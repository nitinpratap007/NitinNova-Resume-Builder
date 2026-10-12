import React, { useEffect, useState } from 'react'
import { getVersions, pushVersion } from '../storage'

// Modal listing saved snapshots of ONE profile (web-only feature).
// Restoring a version loads it into the editor — it does not delete history.
export default function VersionHistory({ profile, onClose, onRestore, onToast }) {
  const [versions, setVersions] = useState(null)

  // Esc closes the dialog (documented shortcut on the Settings page)
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let alive = true
    getVersions(profile.id).then(v => { if (alive) setVersions(v) })
    return () => { alive = false }
  }, [profile.id])

  async function snapshotNow() {
    try {
      await pushVersion(profile.id, profile)
      const v = await getVersions(profile.id)
      setVersions(v)
      if (onToast) onToast('Snapshot saved to history.')
    } catch (e) {
      if (onToast) onToast('Could not save snapshot: ' + (e.message || 'storage error'))
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Version history">
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3 style={{ margin: 0 }}>Version history — {profile.name || 'Untitled'}</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px 12px', fontSize: '13px' }}>Close</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={snapshotNow} style={{ padding: '7px 14px', fontSize: '13px' }}>
            + Save snapshot now
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>
            Last 10 versions kept on this device
          </span>
        </div>

        {versions === null && <p style={{ color: 'var(--text-muted)' }}>Loading history…</p>}

        {versions !== null && versions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: '6px' }}>No versions yet.</p>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Every time you press <strong>Save</strong> in the editor, a snapshot is stored here automatically.
            </p>
          </div>
        )}

        {versions !== null && versions.length > 0 && (
          <ul className="version-list">
            {versions.map((v, i) => (
              <li key={v.at + '_' + i} className="version-item">
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>
                    {new Date(v.at).toLocaleString()}
                    {i === 0 && <span className="version-latest">latest</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {v.snapshot?.name || 'Untitled'} · {Object.keys(v.snapshot || {}).length} fields
                  </div>
                </div>
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => { onRestore(v.snapshot); onClose() }}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="modal-footnote">
          Restoring loads that version into the editor. Your current work is snapshotted first, so nothing is lost.
        </p>
      </div>
    </div>
  )
}
