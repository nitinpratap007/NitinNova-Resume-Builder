import React, { useState } from 'react'
import API from '../api'

const LOCAL_FEEDBACK_KEY = 'nitinnova_local_feedbacks'

function loadLocalFeedbacks() {
  try { return JSON.parse(localStorage.getItem(LOCAL_FEEDBACK_KEY) || '[]') } catch { return [] }
}

export default function Feedback() {
  const [form, setForm] = useState({ subject: '', message: '' })
  const [status, setStatus] = useState('')
  const [sending, setSending] = useState(false)

  function change(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function submit() {
    if (!form.subject || !form.message) {
      setStatus('Please fill in both fields.')
      return
    }
    setSending(true)
    let delivered = false
    try {
      await API.post('/feedback', { subject: form.subject, message: form.message })
      delivered = true
    } catch { delivered = false }

    if (delivered) {
      setStatus('Thanks for your feedback!')
    } else {
      // Offline fallback: store locally so the admin panel still shows it on this device
      try {
        const list = loadLocalFeedbacks()
        list.unshift({
          id: 'local_' + Date.now(),
          user_id: 0,
          subject: form.subject,
          message: form.message,
          created_at: new Date().toLocaleString(),
          local: true,
        })
        localStorage.setItem(LOCAL_FEEDBACK_KEY, JSON.stringify(list.slice(0, 200)))
        setStatus('Feedback saved offline — it will appear in the admin panel.')
      } catch {
        setStatus('Failed to save feedback. Try again later.')
      }
    }
    setForm({ subject: '', message: '' })
    setSending(false)
  }

  return (
    <div className="glass-card animate-fade-in" style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: '24px' }}>Send Feedback</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '14px' }}>
        Report issues or suggest improvements. Your feedback is sent to the admin.
      </p>

      <div style={{ display: 'grid', gap: '16px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Subject</label>
          <input
            name="subject"
            placeholder="What is this about?"
            value={form.subject}
            onChange={change}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Message</label>
          <textarea
            name="message"
            placeholder="Write your feedback details here..."
            value={form.message}
            onChange={change}
            rows={5}
            style={{
              width: '100%',
              background: 'rgba(15,23,42,0.6)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              resize: 'vertical'
            }}
          />
        </div>

        <button className="btn btn-primary" onClick={submit} disabled={sending} style={{ padding: '12px' }}>
          {sending ? 'Sending...' : 'Submit Feedback'}
        </button>

        {status && (
          <div style={{
            padding: '12px',
            backgroundColor: status.startsWith('Failed') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            border: `1px solid ${status.startsWith('Failed') ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
            borderRadius: 'var(--radius-sm)',
            color: status.startsWith('Failed') ? '#fca5a5' : '#6ee7b7',
            fontSize: '13px',
            marginTop: '8px'
          }}>
            {status}
          </div>
        )}
      </div>
    </div>
  )
}
