import React, { useState, useCallback } from 'react'
import { importResumeFile, validateFile, getImportSummary, SUPPORTED_TYPES, MAX_FILE_SIZE } from '../resumeImport'

// State: idle → selecting → reading → extracting → analyzing → review → importing → success/error
const STATES = {
  IDLE: 'idle',
  SELECTING: 'selecting',
  READING: 'reading',
  EXTRACTING: 'extracting',
  ANALYZING: 'analyzing',
  REVIEW: 'review',
  IMPORTING: 'importing',
  SUCCESS: 'success',
  ERROR: 'error',
  UNSUPPORTED: 'unsupported',
}

const PROGRESS_STEPS = [
  { key: 'reading', label: 'Reading file…' },
  { key: 'extracting', label: 'Extracting text…' },
  { key: 'analyzing', label: 'Analyzing sections…' },
  { key: 'review', label: 'Ready to review' },
]

export default function ImportResume({ onImport, onCancel }) {
  const [state, setState] = useState(STATES.IDLE)
  const [file, setFile] = useState(null)
  const [parsedData, setParsedData] = useState(null)
  const [error, setError] = useState('')
  const [progressStep, setProgressStep] = useState(0)
  const [fileInputRef, setFileInputRef] = useState(null)
  const [showRawText, setShowRawText] = useState(false)

  const triggerFilePicker = useCallback(() => {
    // fileInputRef is the DOM element (set via ref={setFileInputRef}),
    // NOT a ref object — so there is no .current property.
    const el = (fileInputRef && fileInputRef.current) ? fileInputRef.current : fileInputRef
    if (el && typeof el.click === 'function') { el.click(); return }
    // Fallback for Android WebView quirks
    const fallback = document.querySelector('input[type="file"][data-import-input]')
    if (fallback) fallback.click()
  }, [fileInputRef])

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const validation = validateFile(selectedFile)
    if (!validation.ok) {
      setError(validation.error)
      setState(STATES.UNSUPPORTED)
      return
    }

    setFile(selectedFile)
    setError('')
    setState(STATES.READING)
    setProgressStep(0)

    try {
      // Reading file
      setState(STATES.EXTRACTING)
      setProgressStep(1)

      const result = await importResumeFile(selectedFile)

      setState(STATES.ANALYZING)
      setProgressStep(2)

      // Small delay to show analyzing step
      await new Promise(r => setTimeout(r, 300))

      setParsedData(result)
      setState(STATES.REVIEW)
      setProgressStep(3)
    } catch (err) {
      setError(err.message || 'Failed to import resume. Please try another file.')
      setState(STATES.ERROR)
    }
  }

  const handleConfirmImport = () => {
    if (!parsedData) return
    setState(STATES.IMPORTING)
    // The Form composes the resume body from the `projects` textarea
    // (one entry per line) — imported experience entries live in
    // `bullets`, which the Form ignores. Merge them into `projects` so
    // experience renders in the resume AND stays editable.
    const expLines = (parsedData.bullets || []).filter(Boolean)
    const projLines = (parsedData.projects || '').split('\n').map(s => s.trim()).filter(Boolean)
    const mergedProjects = [...expLines, ...projLines].join('\n')
    // Normalize the data before importing
    const normalized = {
      name: parsedData.name || '',
      headline: parsedData.headline || '',
      location: parsedData.location || '',
      summary: parsedData.summary || '',
      email: parsedData.email || '',
      phone: parsedData.phone || '',
      education: parsedData.education || '',
      skills: parsedData.skills || '',
      projects: mergedProjects,
      skillGroups: parsedData.skillGroups || [],
      sections: parsedData.sections || [],
      bullets: parsedData.bullets || [],
      photo: parsedData.photo || '',
      photoShape: parsedData.photoShape || 'circle',
      bgColor: parsedData.bgColor || '#eef2ff',
      socialGithub: parsedData.socialGithub || '',
      socialLinkedin: parsedData.socialLinkedin || '',
      socialPortfolio: parsedData.socialPortfolio || '',
      template: parsedData.template || 'modern-minimal',
      templateMode: parsedData.templateMode || 'online',
      fontFamily: parsedData.fontFamily || 'helvetica',
      fontSizePreset: parsedData.fontSizePreset || 'normal',
      margins: parsedData.margins || 40,
    }
    onImport(normalized)
    setState(STATES.SUCCESS)
  }

  const handleBackToIdle = () => {
    setState(STATES.IDLE)
    setFile(null)
    setParsedData(null)
    setError('')
    setProgressStep(0)
    const el = fileInputRef && fileInputRef.current ? fileInputRef.current : fileInputRef
    if (el) el.value = ''
  }

  const renderStep = (step, index) => {
    const isActive = index <= progressStep
    return (
      <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: isActive ? 'var(--primary)' : 'var(--border-color)',
          color: isActive ? '#fff' : 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 600, flexShrink: 0,
        }}>
          {isActive && index < progressStep ? '✓' : index + 1}
        </div>
        <span style={{
          fontSize: 13,
          color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
          fontWeight: isActive ? 600 : 400,
        }}>
          {step.label}
        </span>
        {index < PROGRESS_STEPS.length - 1 && (
          <div style={{
            flex: 1, height: 2, marginLeft: 8,
            background: index < progressStep ? 'var(--primary)' : 'var(--border-color)',
            borderRadius: 1,
          }} />
        )}
      </div>
    )
  }

  if (state === STATES.IDLE) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', textAlign: 'center' }}>
        <input type="file" data-import-input ref={setFileInputRef} style={{ position: 'fixed', left: '-9999px', width: 1, height: 1, opacity: 0 }} accept=".pdf,.docx,.txt" onChange={handleFileChange} />
        <div style={{
          width: 96, height: 96, borderRadius: 24,
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24, boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: '24px' }}>Import Existing Resume</h2>
        <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', fontSize: '15px', maxWidth: 360 }}>
          Open a resume from your device and continue editing it.
        </p>
        <button
          onClick={triggerFilePicker}
          className="btn btn-primary"
          style={{ padding: '14px 32px', fontSize: '16px', width: '100%', maxWidth: 320 }}
        >
          📁 Select Resume File
        </button>
        <p style={{ marginTop: 16, fontSize: '12px', color: 'var(--text-muted)' }}>
          Supports PDF, DOCX, TXT · Max 10 MB · 🔒 Stays on your device
        </p>
        <button onClick={onCancel} className="btn btn-secondary" style={{ marginTop: 20, padding: '10px 20px' }}>
          Cancel
        </button>
      </div>
    )
  }

  if (state === STATES.READING || state === STATES.EXTRACTING || state === STATES.ANALYZING) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--primary)',
          animation: 'spin 1s linear infinite',
          marginBottom: 24,
        }} />
        <h3 style={{ margin: '0 0 8px', fontSize: '20px' }}>
          {state === STATES.READING ? 'Reading your resume…' :
           state === STATES.EXTRACTING ? 'Extracting text…' :
           'Analyzing sections…'}
        </h3>
        <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', fontSize: '14px' }}>
          {file ? file.name : ''}
        </p>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {PROGRESS_STEPS.map((step, index) => renderStep(step, index))}
        </div>
        <style jsx>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    )
  }

  if (state === STATES.ERROR || state === STATES.UNSUPPORTED) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(239,68,68,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '20px', color: '#ef4444' }}>
          {state === STATES.UNSUPPORTED ? 'Unsupported File' : 'Import Failed'}
        </h3>
        <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)', fontSize: '14px', maxWidth: 360 }}>
          {error}
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={handleBackToIdle} className="btn btn-primary" style={{ padding: '12px 24px' }}>
            Try Another File
          </button>
          <button onClick={onCancel} className="btn btn-secondary" style={{ padding: '10px 20px' }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (state === STATES.REVIEW) {
    const summary = getImportSummary(parsedData)
    const hasUncertain = parsedData.isScanned || parsedData.extractedText?.length < 100

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '24px', maxWidth: 700, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(16,185,129,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ margin: '0 0 4px', fontSize: '22px' }}>Resume Imported Successfully</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
            {file?.name} ({Math.round(file.size / 1024)} KB)
          </p>
        </div>

        {hasUncertain && (
          <div style={{
            padding: '14px 16px', background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10,
            color: '#f59e0b', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <strong>⚠️ Review Recommended</strong>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {parsedData.isScanned
                  ? 'This PDF appears to be scanned or image-based. Text extraction may require OCR.'
                  : 'Some content may need manual review. Please check the extracted sections below.'}
              </p>
            </div>
          </div>
        )}

        <div style={{
          padding: '16px', background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border-color)', borderRadius: 12,
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>We found:</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Personal Info', value: summary.personal ? '✓' : '—', ok: summary.personal },
              { label: 'Professional Summary', value: summary.summary ? '✓' : '—', ok: summary.summary },
              { label: 'Experience', value: `${summary.experience} entries`, ok: summary.experience > 0 },
              { label: 'Education', value: summary.education ? '✓' : '—', ok: summary.education },
              { label: 'Skills', value: `${summary.skills} items`, ok: summary.skills > 0 },
              { label: 'Projects', value: `${summary.projects} entries`, ok: summary.projects > 0 },
              { label: 'Other Sections', value: `${summary.sections} sections`, ok: summary.sections > 0 },
            ].map((item, idx) => (
              <div key={idx} style={{
                padding: '12px', background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-color)', borderRadius: 8,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '18px', fontWeight: 600, color: item.ok ? '#10b981' : 'var(--text-muted)' }}>
                  {item.value}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {parsedData.isScanned && (
          <div style={{
            padding: '16px', background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10,
            color: '#f59e0b', fontSize: '13px',
          }}>
            <strong>📄 Scanned PDF Detected</strong>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              This PDF appears to be scanned or image-based. Text extraction may require OCR.
              You can still proceed, but you may need to manually enter some information.
            </p>
          </div>
        )}

        <div style={{ padding: '16px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10 }}>
          <strong>🔒 Privacy Notice</strong>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Your resume stays on your device unless you explicitly choose an online/AI feature.
            No data is uploaded automatically.
          </p>
        </div>

        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
            {showRawText ? 'Hide' : 'Show'} extracted text (for debugging)
          </summary>
          <pre style={{
            marginTop: 12, padding: '12px', background: '#0f172a', borderRadius: 8,
            fontSize: '11px', color: '#e2e8f0', overflow: 'auto', maxHeight: 200,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {parsedData.extractedText?.slice(0, 3000) || '(no text extracted)'}
          </pre>
        </details>

        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={handleConfirmImport} className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '16px' }}>
            ✅ Import & Open Editor
          </button>
          <button onClick={handleBackToIdle} className="btn btn-secondary" style={{ padding: '12px 24px' }}>
            ↩ Try Different File
          </button>
          <button onClick={onCancel} className="btn btn-secondary" style={{ padding: '10px 20px', background: 'transparent', borderColor: 'var(--border-color)' }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (state === STATES.SUCCESS) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(16,185,129,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: '24px' }}>Import Complete</h2>
        <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', fontSize: '15px' }}>
          Your resume has been imported and is ready to edit.
        </p>
        <button onClick={onCancel} className="btn btn-primary" style={{ padding: '14px 32px', fontSize: '16px' }}>
          Continue to Editor
        </button>
      </div>
    )
  }

  return null
}