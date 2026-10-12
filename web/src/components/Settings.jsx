import React, { useEffect, useState } from 'react'
import { API_CONFIGURED } from '../api'
import {
  exportAllData, importAllData, estimateUsage, clearAllAppData, STORAGE_BACKEND_LABEL,
} from '../storage'

function formatBytes(n) {
  if (!n) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function readFileText(file) {
  if (file.text) return file.text()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error('Could not read the file'))
    r.readAsText(file)
  })
}

// WEB-VERSION-ONLY settings & privacy page.
export default function Settings({ onToast }) {
  const [usage, setUsage] = useState({ usage: 0, quota: 0, backend: STORAGE_BACKEND_LABEL() })
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function refreshUsage() {
    const u = await estimateUsage()
    setUsage(u)
  }
  useEffect(() => { refreshUsage() }, [])

  async function handleExport() {
    setBusy(true)
    try {
      const data = await exportAllData()
      const stamp = new Date().toISOString().slice(0, 10)
      downloadJson(data, `nitinnova-backup-${stamp}.json`)
      setStatus(`Backup downloaded — ${data.profiles.length} resume(s). Keep it private: it contains your personal data.`)
      if (onToast) onToast('Backup downloaded.')
    } catch (e) {
      setStatus('Export failed: ' + (e.message || 'unknown error'))
    } finally { setBusy(false) }
  }

  async function handlePickFile(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { setStatus('Backup file is too large (max 20 MB).'); return }
    let text
    try { text = await readFileText(file) } catch (err) { setStatus('Could not read file: ' + err.message); return }

    const merge = window.confirm(
      'OK = MERGE backup into your current resumes.\nCancel = REPLACE everything with the backup.'
    )
    setBusy(true)
    try {
      const res = await importAllData(text, merge ? 'merge' : 'replace')
      if (res.ok) {
        setStatus(`Backup ${merge ? 'merged' : 'restored'} — ${res.imported} resume(s) imported. Refreshing…`)
        if (onToast) onToast('Backup imported successfully.')
        setTimeout(() => window.location.reload(), 900)
      } else {
        setStatus('Import failed: ' + res.error)
      }
    } catch (err) {
      setStatus('Import failed: ' + (err.message || 'unknown error'))
    } finally { setBusy(false) }
  }

  async function handleClear() {
    const ok1 = window.confirm('Delete ALL resumes, drafts and version history stored by this app in this browser?')
    if (!ok1) return
    const ok2 = window.confirm('This cannot be undone (export a backup first if unsure). Really delete everything?')
    if (!ok2) return
    try {
      await clearAllAppData()
      setStatus('All local resume data deleted.')
      if (onToast) onToast('All local data cleared.')
      refreshUsage()
    } catch (e) {
      setStatus('Clear failed: ' + (e.message || 'unknown error'))
    }
  }

  const shortcuts = [
    ['Ctrl / \u2318 + S', 'Save current resume (snapshot to history)'],
    ['Ctrl / \u2318 + D', 'Download PDF'],
    ['Ctrl / \u2318 + P', 'Print preview (browser print dialog)'],
    ['Ctrl / \u2318 + Z / + Y', 'Undo / redo while typing (browser native)'],
    ['Esc', 'Close menu / dialogs'],
  ]

  return (
    <div className="settings-page" style={{ display: 'grid', gap: '20px', maxWidth: '860px' }}>
      <section className="glass-card">
        <h2 style={{ margin: '0 0 4px', fontSize: '22px' }}>Settings &amp; Privacy</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
          Everything here runs locally in your browser. No account required.
        </p>
      </section>

      <section className="glass-card">
        <h3 style={{ margin: '0 0 10px', fontSize: '16px' }}>🔒 Privacy</h3>
        <ul className="settings-list">
          <li><strong>Your resumes are never uploaded automatically.</strong> Editing, preview, PDF export and resume import all happen on this device.</li>
          <li>Resumes are stored in <strong>{usage.backend}</strong> inside this browser profile — not on any server.</li>
          <li>Browser storage can be lost if you clear site data or use private browsing — <strong>export a backup regularly</strong>.</li>
          <li>Online actions (server AI polish, feedback submission) only run when you click them, and only work if a backend is configured
            ({API_CONFIGURED ? 'backend: configured' : 'backend: not configured — app is fully offline'}).</li>
          <li>No analytics or trackers. The only external request is Google Fonts CSS for typography.</li>
          <li>Clearing data here or via the button below is permanent unless you exported a backup.</li>
        </ul>
      </section>

      <section className="glass-card">
        <h3 style={{ margin: '0 0 10px', fontSize: '16px' }}>💾 Local storage</h3>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Used by the app</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{formatBytes(usage.usage)}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Browser quota</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{usage.quota ? formatBytes(usage.quota) : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Backend</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{API_CONFIGURED ? 'Connected' : 'Offline mode'}</div>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={refreshUsage} style={{ padding: '8px 16px', fontSize: '13px' }}>
          Refresh usage
        </button>
      </section>

      <section className="glass-card">
        <h3 style={{ margin: '0 0 10px', fontSize: '16px' }}>🔗 Backup &amp; restore</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: 0 }}>
          Export downloads a single JSON file containing all resumes, drafts and history.
          The file contains personal data — store it safely.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleExport} disabled={busy} style={{ padding: '10px 18px' }}>
            📥 Export backup
          </button>
          <label className="btn btn-secondary" style={{ padding: '10px 18px', cursor: 'pointer', margin: 0 }}>
            📤 Import backup
            <input type="file" accept="application/json,.json" onChange={handlePickFile}
              style={{ position: 'fixed', left: '-9999px', width: 1, height: 1 }} disabled={busy} />
          </label>
        </div>
        {status && <div className="status-msg" style={{ marginTop: '12px' }}>{status}</div>}
      </section>

      <section className="glass-card">
        <h3 style={{ margin: '0 0 10px', fontSize: '16px' }}>⌘ Keyboard shortcuts</h3>
        <table className="shortcut-table">
          <tbody>
            {shortcuts.map(([k, d]) => (
              <tr key={k}>
                <td><kbd>{k}</kbd></td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="glass-card">
        <h3 style={{ margin: '0 0 10px', fontSize: '16px' }}>🗑️ Danger zone</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: 0 }}>
          Deletes every resume, draft and version this app stored in this browser. Your original files
          on your device are never touched.
        </p>
        <button className="btn btn-danger" onClick={handleClear} disabled={busy} style={{ padding: '10px 18px' }}>
          Delete all app data
        </button>
      </section>
    </div>
  )
}
