import React, { useEffect, useState } from 'react'
import API from '../api'

export default function InviteFriend() {
  const [referrals, setReferrals] = useState([])
  const [status, setStatus] = useState('')

  useEffect(() => {
    fetchReferrals()
  }, [])

  async function fetchReferrals() {
    try {
      const res = await API.get('/referrals')
      if (res.data.ok) setReferrals(res.data.referrals)
    } catch (e) {
      console.error(e)
      setStatus('Unable to load referrals')
    }
  }

  async function createReferral() {
    try {
      const res = await API.post('/referrals')
      if (res.data.ok) {
        setStatus('Invite code created. Share it with friends!')
        fetchReferrals()
      }
    } catch (e) {
      console.error(e)
      setStatus('Failed to create invite.')
    }
  }

  function getAppLink(token) {
    const origin = window.location.origin
    return token ? `${origin}/?ref=${encodeURIComponent(token)}` : origin
  }

  function getShareText(token) {
    const appLink = getAppLink(token)
    return `Try NitinNova Resume Builder! Create beautiful resumes in minutes. ${appLink}${token ? `\nUse invite code: ${token}` : ''}\n\n📱 Please share the parent .apk file for the full app experience.`
  }

  function copyText(text) {
    navigator.clipboard.writeText(text)
    setStatus('Invite text copied to clipboard.')
  }

  function shareWeb(token) {
    const text = getShareText(token)
    if (navigator.share) {
      navigator.share({
        title: 'NitinNova Resume Builder',
        text,
        url: getAppLink(token),
      }).catch(() => {
        copyText(text)
      })
      return
    }
    copyText(text)
  }

  function openShareUrl(platform, token) {
    const text = encodeURIComponent(getShareText(token))
    let url = ''
    if (platform === 'whatsapp') {
      url = `https://api.whatsapp.com/send?text=${text}`
    } else if (platform === 'telegram') {
      url = `https://t.me/share/url?url=${encodeURIComponent(getAppLink(token))}&text=${text}`
    } else if (platform === 'email') {
      url = `mailto:?subject=${encodeURIComponent('Try NitinNova Resume Builder')}&body=${text}`
    }
    window.open(url, '_blank')
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Invite Friends</h2>
      <p>Share the resume builder with friends quickly via WhatsApp, Telegram, email or by copying the link.</p>

      <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
        <button onClick={createReferral} style={{ padding: '10px 16px', borderRadius: 10, background: '#2563eb', color: '#fff', border: 'none' }}>
          Create Invite Code
        </button>
        <button onClick={() => shareWeb()} style={{ padding: '10px 16px', borderRadius: 10, background: '#0ea5e9', color: '#fff', border: 'none' }}>
          Share App Link
        </button>
      </div>

      {status && (
        <div style={{ marginTop: 12, padding: 12, background: '#eef2ff', borderRadius: 10 }}>{status}</div>
      )}

      <div style={{ marginTop: 20 }}> 
        <h3>Quick Share</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => openShareUrl('whatsapp')} style={{ padding: '10px 14px', borderRadius: 10, background: '#25d366', color: '#fff', border: 'none' }}>
            Share on WhatsApp
          </button>
          <button onClick={() => openShareUrl('telegram')} style={{ padding: '10px 14px', borderRadius: 10, background: '#2aabee', color: '#fff', border: 'none' }}>
            Share on Telegram
          </button>
          <button onClick={() => openShareUrl('email')} style={{ padding: '10px 14px', borderRadius: 10, background: '#6d28d9', color: '#fff', border: 'none' }}>
            Share by Email
          </button>
          <button onClick={() => copyText(getShareText())} style={{ padding: '10px 14px', borderRadius: 10, background: '#64748b', color: '#fff', border: 'none' }}>
            Copy App Link
          </button>
        </div>
      </div>

      <div style={{ marginTop: 24, padding: 16, background: '#f8fafc', borderRadius: 16 }}>
        <h3 style={{ marginTop: 0 }}>Your Invite Codes</h3>
        {referrals.length === 0 && <div>No invites yet. Create one to share with friends.</div>}
        <ul style={{ paddingLeft: 18, marginTop: 12 }}>
          {referrals.map((ref) => (
            <li key={ref.id} style={{ marginBottom: 18, padding: 14, borderRadius: 14, background: '#fff', border: '1px solid #e2e8f0' }}>
              <div style={{ marginBottom: 6 }}><strong>{ref.token}</strong></div>
              <div style={{ fontSize: 12, color: '#475569' }}>Created: {new Date(ref.created_at).toLocaleString()}</div>
              <div style={{ fontSize: 12, color: '#475569' }}>Status: {ref.used_by ? `Used by user ${ref.used_by}` : 'Available'}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <button onClick={() => copyText(getShareText(ref.token))} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #4f46e5', background: '#eef2ff' }}>
                  Copy Invite Link
                </button>
                <button onClick={() => shareWeb(ref.token)} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff' }}>
                  Share Now
                </button>
                <button onClick={() => openShareUrl('whatsapp', ref.token)} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: '#25d366', color: '#fff' }}>
                  WhatsApp
                </button>
                <button onClick={() => openShareUrl('telegram', ref.token)} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: '#2aabee', color: '#fff' }}>
                  Telegram
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
