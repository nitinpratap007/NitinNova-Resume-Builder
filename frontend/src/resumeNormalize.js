// ---------------------------------------------------------------------------
// resumeNormalize.js — data normalization / migration layer
//
// Guards every entry point where resume data can come FROM OUTSIDE the editor
// (localStorage drafts, saved profiles, PDF export) so corrupted/legacy data
// can never produce duplicated sections, items or text in the preview or the
// exported PDF. All helpers are pure and never mutate their input.
// ---------------------------------------------------------------------------

function cleanLines(value) {
  return String(value || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
}

// Remove EXACT duplicate lines (case-insensitive), preserving order.
// Only identical copies are dropped — intentional repeats of similar text are kept.
function dedupeLines(value) {
  const seen = new Set()
  return cleanLines(value).filter(line => {
    const key = line.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Normalize a resume object into a safe, duplicate-free shape.
// Unknown/extra fields are preserved untouched; the known fields are cleaned.
export function normalizeResumeData(data) {
  const d = { ...(data || {}) }

  // 1) strings — trim, never null
  const strKeys = [
    'name', 'headline', 'location', 'summary', 'email', 'phone',
    'education', 'skills', 'projects',
    'socialGithub', 'socialLinkedin', 'socialPortfolio', 'photo',
  ]
  for (const k of strKeys) {
    d[k] = typeof d[k] === 'string' ? d[k].trim() : ''
  }

  // 2) project lines — drop exact duplicates (accumulation artifact)
  d.projects = dedupeLines(d.projects).join('\n')

  // 3) flat legacy skills string — same dedupe (older drafts can carry the
  //    accumulation artifact here too; skillGroups are handled further down)
  d.skills = dedupeLines(d.skills).join('\n')

  // 4) polished bullets — drop exact duplicates, drop empties
  if (!Array.isArray(d.bullets)) d.bullets = []
  else {
    const seen = new Set()
    d.bullets = d.bullets
      .map(b => (typeof b === 'string' ? b.trim() : ''))
      .filter(Boolean)
      .filter(b => {
        const key = b.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  }

  // 4) sections — dedupe by id, then by exact (title + content) pair.
  //    Empty sections are dropped here too (they render as nothing anyway).
  if (!Array.isArray(d.sections)) d.sections = []
  else {
    const seenIds = new Set()
    const seenPairs = new Set()
    d.sections = d.sections.filter(s => {
      if (!s || typeof s !== 'object') return false
      const title = String(s.title || '').trim()
      const content = String(s.content || '').trim()
      if (!title || !content) return false
      const id = s.id != null ? String(s.id) : ''
      if (id && seenIds.has(id)) return false
      if (id) seenIds.add(id)
      const pair = `${title.toLowerCase()}\u0000${content.toLowerCase()}`
      if (seenPairs.has(pair)) return false
      seenPairs.add(pair)
      return true
    })
  }

  // 5) skill groups — drop exact-duplicate groups, dedupe items inside a group
  if (!Array.isArray(d.skillGroups)) d.skillGroups = []
  else {
    const seenGroups = new Set()
    const groups = []
    for (const g of d.skillGroups) {
      if (!g || typeof g !== 'object') continue
      const cat = String(g.category || '').trim()
      const items = (g.items || []).map(i => (typeof i === 'string' ? i.trim() : '')).filter(Boolean)
      const seenItems = new Set()
      const uniqueItems = items.filter(i => {
        const key = i.toLowerCase()
        if (seenItems.has(key)) return false
        seenItems.add(key)
        return true
      })
      const groupKey = `${cat.toLowerCase()}\u0000${uniqueItems.join(',').toLowerCase()}`
      if (seenGroups.has(groupKey)) continue
      seenGroups.add(groupKey)
      groups.push({ ...g, category: cat, items: uniqueItems })
    }
    d.skillGroups = groups
  }

  return d
}

// Safe download filename: meaningful + filesystem-friendly.
// Example:  "Nitin Pattap"  ->  "Nitin_Pattap_NitinNova_Resume.pdf"
export function safePdfFilename(name) {
  const sanitized = String(name || '')
    .replace(/[\\/:*?"<>|]+/g, '') // strip invalid FS chars
    .replace(/\s+/g, '_')          // spaces -> underscores
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)                  // keep filename sane
  return (sanitized ? sanitized + '_' : '') + 'NitinNova_Resume.pdf'
}