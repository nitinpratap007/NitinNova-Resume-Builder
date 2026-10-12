import React from 'react'
import { templateSets } from '../templateData'

// WEB-VERSION-ONLY home screen. The Android app opens straight into the
// editor; the web version adds a proper landing/home with working quick
// actions (not a mockup — every button navigates to the real feature).
export default function Welcome({ onNavigate, onNewResume, onOpenDashboard, session }) {
  const featured = [
    ...(templateSets.online || []).slice(0, 4),
    ...(templateSets.offline || []).slice(0, 2),
  ]

  const features = [
    { icon: '\u270D\uFE0F', title: 'Full editor', text: 'Personal info, summary, skills, experience, education and custom sections — add, edit, reorder.' },
    { icon: '\uD83E\uDDE0', title: 'AI drafting, free & offline', text: 'Describe the role and your skills — the built-in AI drafts a complete resume locally. No API key, no cost.' },
    { icon: '\uD83D\uDCC4', title: 'Import existing resume', text: 'Bring a PDF, DOCX or TXT resume in one pick — content lands in the editor ready to edit.' },
    { icon: '\uD83D\uDCCA', title: 'ATS-friendly PDF', text: 'Live preview that matches the download. Real selectable text, multi-page safe.' },
    { icon: '\uD83D\uDD12', title: 'Yours alone, on this device', text: 'A free account keeps your resumes private to you. Nothing is ever uploaded — it all stays in this browser.' },
    { icon: '\uD83D\uDD04', title: 'Version history & backup', text: 'Every save snapshots your resume. Restore an older version or export a backup file.' },
  ]

  return (
    <div className="welcome-page" style={{ display: 'grid', gap: '28px' }}>
      <section className="glass-card welcome-hero">
        <div className="welcome-badge">100% browser-based · no install · free</div>
        <h1>Build a resume you can be proud of — <span className="welcome-gradient">right in your browser</span></h1>
        <p className="welcome-sub">
          Create from scratch with AI help, or import the resume you already have and edit it in minutes.
          Live preview, PDF download, autosave — all local, all free.
        </p>
        <div className="welcome-actions">
          <button className="btn btn-primary" onClick={session ? onNewResume : () => onNavigate('auth')} style={{ padding: '13px 26px', fontSize: '15px' }}>
            {session ? '+ Create new resume' : '🔑 Sign up free to start'}
          </button>
          <button className="btn btn-secondary" onClick={onOpenDashboard} style={{ padding: '13px 26px', fontSize: '15px' }}>
            📥 Import existing resume
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('dashboard')} style={{ padding: '13px 26px', fontSize: '15px' }}>
            📂 My resumes
          </button>
          <a className="btn btn-secondary" href="./user.apk" download="NitinNova-Resume-Builder.apk"
            style={{ padding: '13px 26px', fontSize: '15px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            📱 Get the Android app
          </a>
        </div>
        <p className="welcome-note">
          🔒 Create a free account to start building. Your resumes never leave this device — local AI, local editing, local PDF.
        </p>
      </section>

      <section>
        <h2 className="welcome-h2">Everything you need</h2>
        <div className="welcome-feature-grid">
          {features.map(f => (
            <div key={f.title} className="glass-card welcome-feature">
              <div className="welcome-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="welcome-h2">Template gallery</h2>
        <p className="welcome-gallery-sub">
          Compare before you apply — switch templates any time from the editor's Design tab.
        </p>
        <div className="welcome-gallery">
          {featured.map(t => (
            <button key={t.id} className="welcome-template-card" onClick={session ? onNewResume : () => onNavigate('auth')}
              title={`Start with ${t.name}`} type="button">
              <span className="welcome-template-bar" style={{ background: t.palette?.[0] || '#6366f1' }}>
                <span className="welcome-template-accent" style={{ background: (t.ats && t.ats.accent) || t.palette?.[2] || '#fff' }} />
              </span>
              <span className="welcome-template-lines">
                <i /><i /><i /><i />
              </span>
              <span className="welcome-template-name">{t.name}</span>
              <span className={`welcome-template-kind ${t.kind === 'ats' ? 'ats' : ''}`}>
                {t.kind === 'ats' ? 'ATS-friendly' : 'Creative'}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="glass-card welcome-cta">
        <div>
          <h2 style={{ margin: '0 0 6px', fontSize: '20px' }}>Ready? Open the editor.</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
            {session ? 'You can import your old resume instead of starting from zero.' : 'Sign up free — it takes about ten seconds and stays on your device.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={session ? onNewResume : () => onNavigate('auth')}>
            {session ? 'Open editor' : 'Get started'}
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('settings')}>Settings &amp; privacy</button>
        </div>
      </section>
    </div>
  )
}
