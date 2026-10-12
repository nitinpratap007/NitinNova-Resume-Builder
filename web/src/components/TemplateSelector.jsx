import React, { useState } from 'react'
import { templateSets } from '../templateData'

const STYLE_ICONS = {
  gradient: '🎨', minimal: '✨', dark: '🌙', ats: '📋', executive: '👔',
  tech: '💻', portfolio: '🖼️', timeline: '📅', photo: '📸', classic: '📄',
  side: '📑', boldheader: '🔤', simpleats: '📝', elegant: '🏅', fresher: '🎓', doublecol: '📊',
}

export default function TemplateSelector({ mode, template, bgColor, onChange, onBgColorChange }) {
  const templates = templateSets[mode] || []
  const [previewHover, setPreviewHover] = useState(null)
  const selected = templates.find(t => t.id === template) || templates[0] || null

  return (
    <div style={{
      padding: 16, border: '1px solid var(--border-color)', borderRadius: 12,
      background: 'rgba(255,255,255,0.03)', boxShadow: '0 4px 18px rgba(0,0,0,0.06)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '16px' }}>
          {mode === 'online' ? '🌐 Online Templates' : '📴 Offline Templates'} ({templates.length})
        </h3>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
        gap: 10,
      }}>
        {templates.map(t => {
          const isCreative = t.kind === 'creative'
          return (
          <div
            key={t.id}
            onClick={() => onChange(t.id)}
            onMouseEnter={() => setPreviewHover(t.id)}
            onMouseLeave={() => setPreviewHover(null)}
            style={{
              padding: '14px 12px',
              border: template === t.id ? `2px solid ${bgColor || '#4f46e5'}` : '1px solid var(--border-color)',
              borderRadius: 10,
              background: template === t.id
                ? `linear-gradient(135deg, ${bgColor || '#4f46e5'}10, ${bgColor || '#4f46e5'}05)`
                : 'rgba(255,255,255,0.02)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              transform: previewHover === t.id ? 'translateY(-2px)' : 'none',
              boxShadow: template === t.id ? `0 4px 16px ${bgColor || '#4f46e5'}30` : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '16px' }}>{STYLE_ICONS[t.style] || '📄'}</span>
              <strong style={{ fontSize: '13px' }}>{t.name}</strong>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{
                padding: '2px 7px', borderRadius: 6, fontSize: '10px', fontWeight: 700,
                background: isCreative ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                color: isCreative ? '#fcd34d' : '#6ee7b7',
                border: `1px solid ${isCreative ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.35)'}`,
              }}>{isCreative ? 'Creative' : 'ATS Safe'}</span>
              {t.showImage && (
                <span style={{
                  padding: '2px 7px', borderRadius: 6, fontSize: '10px',
                  background: 'rgba(14,165,233,0.15)', color: '#38bdf8'
                }}>Photo</span>
              )}
            </div>
            <p style={{ fontSize: '11px', margin: '4px 0', minHeight: 30, opacity: 0.7, lineHeight: '1.3' }}>
              {t.description}
            </p>
            <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
              {t.palette.map((color, i) => (
                <span key={i} style={{
                  width: 14, height: 14, background: color,
                  borderRadius: 3, border: '1px solid rgba(255,255,255,0.15)'
                }} />
              ))}
            </div>
          </div>
          )
        })}
      </div>

      {selected && (
        <div style={{
          marginTop: 14, padding: 12, borderRadius: 10,
          background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)'
        }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: '13px' }}>
            Accent Color for: {selected.name}
            {selected.kind !== 'creative' && (
              <span style={{ fontWeight: 400, fontSize: '11px', opacity: 0.7 }}> — underlines &amp; accents only (ATS-safe, never a background)</span>
            )}
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {selected.palette.map((color, i) => (
              <button key={i} type="button" onClick={() => onBgColorChange(color)} style={{
                width: 28, height: 28, borderRadius: '50%',
                border: bgColor === color ? '3px solid #2563eb' : '1px solid #cbd5e1',
                background: color, cursor: 'pointer', transition: 'all 0.2s'
              }} />
            ))}
            <input type="color" value={bgColor} onChange={e => onBgColorChange(e.target.value)}
              style={{ width: 40, height: 40, border: 'none', padding: 0, marginLeft: 4, cursor: 'pointer' }} />
          </div>
        </div>
      )}
    </div>
  )
}
