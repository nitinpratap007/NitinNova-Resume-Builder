import { findTemplate, fontOptions, fontSizePresets } from './templateData'

// Single source of truth for resume rendering.
// Both the live preview (JSX) and the text-based PDF (jsPDF) consume this
// layout object, so what you see is what ATS reads.
export const PAGE_W = 700          // preview width in px
export const PDF_SCALE = 595.28 / 700 // px (preview) -> pt (A4 page width)

export function buildResumeLayout(p) {
  const t = findTemplate(p.template || '')
  const ats = !t || t.kind !== 'creative'
  const cfg = (t && t.ats) || {}

  const LEGACY_DEFAULT = '#eef2ff' // old Form default — treat as "not customized"
  const customized = p.bgColor && String(p.bgColor).toLowerCase() !== LEGACY_DEFAULT
  const accent = customized
    ? p.bgColor
    : (cfg.accent || (t && t.palette && t.palette[0]) || '#6366f1')

  const heading = ats ? (cfg.heading || 'rule') : 'accent'   // 'rule' | 'accent' | 'plain'
  const align = ats ? (cfg.align || 'left') : 'left'          // 'center' | 'left'
  const band = !ats                                           // colored header band (creative only)

  const fc = fontOptions.find(f => f.id === (p.fontFamily || 'helvetica')) || fontOptions[0]
  const sz = fontSizePresets.find(s => s.id === (p.fontSizePreset || 'normal')) || fontSizePresets[1]
  const margins = Number(p.margins) || 40

  const name = (p.name || '').trim() || 'Your Name'
  const nameDisplay = ats ? name.toUpperCase() : name
  const headline = (p.headline || '').trim()
  const location = (p.location || '').trim()

  const contact = []
  if (location) contact.push(location)
  const phoneEmail = [p.phone, p.email].map(x => (x || '').trim()).filter(Boolean).join(' | ')
  if (phoneEmail) contact.push(phoneEmail)

  const links = []
  if (p.socialGithub) links.push({ label: 'GitHub', value: p.socialGithub })
  if (p.socialLinkedin) links.push({ label: 'LinkedIn', value: p.socialLinkedin })
  if (p.socialPortfolio) links.push({ label: 'Portfolio', value: p.socialPortfolio })
  const linksLine = links.map(l => `${l.label}: ${l.value}`).join(' | ')
  if (linksLine) contact.push(linksLine)

  // Skills: categorized groups (fallback to flat string)
  let skillLines = (p.skillGroups || [])
    .filter(g => g && (g.items || []).length)
    .map(g => ({ label: (g.category || '').trim(), items: g.items }))
  if (!skillLines.length && (p.skills || '').trim()) {
    skillLines = [{ label: '', items: p.skills.split('\n').map(s => s.trim()).filter(Boolean) }]
  }

  // Projects: polished bullets first; fall back to raw project lines if the
  // bullets contain nothing but the filtered "Technologies:" line
  const polish = (p.bullets || []).map(s => (s || '').trim()).filter(s => s && !s.startsWith('Technologies:'))
  const rawLines = (p.projects || '').split('\n').map(s => (s || '').trim()).filter(Boolean)
  const projects = (polish.length ? polish : rawLines).map(line => {
    const i = line.indexOf(' - ')
    if (i > 0) return { title: line.slice(0, i), rest: line.slice(i + 3).trim() }
    return { title: line, rest: '' }
  })

  const education = (p.education || '').trim()
  const summary = (p.summary || '').trim()

  const sections = (p.sections || [])
    .filter(s => s && (s.title || '').trim() && (s.content || '').trim())
    .map(s => ({ title: s.title.trim(), content: s.content }))

  return {
    ats, band, heading, align, accent, fc, sz, margins,
    nameDisplay, headline, contact, linksLine,
    summary, skillLines, projects, education, sections,
    // photos are ATS-unfriendly -> only creative templates embed them
    photo: ats ? '' : (p.photo || ''),
    photoShape: p.photoShape || 'circle',
    hasHead: !!(headline || contact.length),
  }
}
