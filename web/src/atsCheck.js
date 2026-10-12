// atsCheck.js — WEB-VERSION-ONLY ATS readiness checklist.
//
// Pure analysis of the CURRENT resume state: identifies missing sections,
// inconsistent dates and formatting concerns. It NEVER invents or rewrites
// content — it only reports what is (not) present.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const YEAR_RE = /\b(19|20)\d{2}\b/g

function countWords(s) {
  return String(s || '').trim().split(/\s+/).filter(Boolean).length
}

function collectText(p) {
  return [
    p.summary, p.education, p.projects,
    ...(p.sections || []).map(s => s.title + ' ' + s.content),
    (p.skillGroups || []).flatMap(g => g.items || []).join(' '),
    (p.skillGroups || []).map(g => g.category).join(' '),
  ].filter(Boolean).join('\n')
}

// Find year ranges like "2020-2023", "2019 - Present" anywhere in the text.
function findYearRanges(text) {
  const ranges = []
  const re = /\b((?:19|20)\d{2})\s*(?:-|–|—|to)\s*((?:19|20)\d{2}|present|current|now)\b/gi
  let m
  while ((m = re.exec(text)) !== null) {
    ranges.push({ start: parseInt(m[1], 10), endRaw: m[2], end: /^\d{4}$/.test(m[2]) ? parseInt(m[2], 10) : null })
  }
  return ranges
}

export function runAtsCheck(p) {
  const checks = []
  const add = (id, label, status, detail) => checks.push({ id, label, status, detail })

  // ---- contact ----
  if (p.name && p.name.trim()) add('name', 'Full name present', 'pass', '')
  else add('name', 'Full name present', 'fail', 'Add your name in the Personal tab.')

  if (p.email && EMAIL_RE.test(p.email.trim())) add('email', 'Valid email address', 'pass', '')
  else if (p.email) add('email', 'Valid email address', 'warn', 'The email format looks unusual — double-check it.')
  else add('email', 'Valid email address', 'fail', 'Recruiters need a contact email.')

  if (p.phone && p.phone.replace(/[^\d]/g, '').length >= 7) add('phone', 'Phone number present', 'pass', '')
  else add('phone', 'Phone number present', 'warn', 'Add a phone number so recruiters can reach you.')

  if (p.headline && p.headline.trim()) add('headline', 'Headline / target title', 'pass', '')
  else add('headline', 'Headline / target title', 'warn', 'A short professional headline helps ATS match roles.')

  if (p.location && p.location.trim()) add('location', 'Location', 'pass', '')
  else add('location', 'Location', 'info', 'Optional, but useful for local roles.')

  // ---- content sections ----
  const summaryWords = countWords(p.summary)
  if (summaryWords >= 20) add('summary', 'Professional summary (20+ words)', 'pass', '')
  else if (summaryWords > 0) add('summary', 'Professional summary (20+ words)', 'warn', `Only ${summaryWords} word${summaryWords === 1 ? '' : 's'} — aim for 2–4 lines.`)
  else add('summary', 'Professional summary (20+ words)', 'fail', 'Add a short summary at the top of the Personal tab.')

  const skillItems = (p.skillGroups || []).flatMap(g => g.items || []).filter(Boolean)
  if (skillItems.length >= 6) add('skills', 'Skills section (6+ skills)', 'pass', '')
  else if (skillItems.length > 0) add('skills', 'Skills section (6+ skills)', 'warn', `Only ${skillItems.length} skill${skillItems.length === 1 ? '' : 's'} listed — most roles expect more.`)
  else add('skills', 'Skills section (6+ skills)', 'fail', 'No skills found. Add a skill category or use Auto-organize.')

  const entries = String(p.projects || '').split('\n').map(s => s.trim()).filter(Boolean)
  if (entries.length >= 2) add('experience', 'Experience / projects (2+ entries)', 'pass', '')
  else if (entries.length === 1) add('experience', 'Experience / projects (2+ entries)', 'warn', 'Only one entry — add more roles/projects if you have them.')
  else add('experience', 'Experience / projects (2+ entries)', 'fail', 'Add at least one experience or project entry.')

  if (p.education && p.education.trim()) add('education', 'Education present', 'pass', '')
  else add('education', 'Education present', 'warn', 'Education is expected by most recruiters and ATS.')

  const customSections = (p.sections || []).filter(s => (s.title || '').trim() && (s.content || '').trim())
  if (customSections.length > 0) add('sections', `Extra sections (${customSections.length})`, 'pass', customSections.map(s => s.title).join(', '))
  else add('sections', 'Extra sections (certifications, languages, …)', 'info', 'Optional — add in the Sections tab if relevant.')

  // ---- dates ----
  const allText = collectText(p)
  const ranges = findYearRanges(allText)
  const thisYear = new Date().getFullYear()
  if (ranges.length === 0) {
    add('dates', 'Dates included for experience/education', 'warn', 'No year ranges found (e.g. 2020-2023). ATS and recruiters use dates to verify timelines.')
  } else {
    const bad = ranges.filter(r => r.end !== null && (r.end < r.start || r.end > thisYear + 1))
    const ancient = ranges.filter(r => r.start < 1940)
    if (bad.length) {
      add('dates', 'Date ranges are consistent', 'fail',
        bad.map(r => `${r.start}-${r.endRaw}`).join(', ') + ' — end year is before start or in the future.')
    } else if (ancient.length) {
      add('dates', 'Date ranges are consistent', 'warn', 'Some years look unusually old — please verify.')
    } else {
      add('dates', 'Date ranges are consistent', 'pass', `${ranges.length} date range${ranges.length === 1 ? '' : 's'} found.`)
    }
    const openEnded = ranges.filter(r => r.end === null).length
    if (openEnded > 0 && !bad.length) {
      add('dates-open', 'Current role clearly marked', 'info', `${openEnded} range${openEnded === 1 ? '' : 's'} end in "Present/Current" — good for current positions.`)
    }
  }

  // ---- links ----
  const links = [p.socialGithub, p.socialLinkedin, p.socialPortfolio].filter(Boolean)
  const badLinks = links.filter(l => /\s/.test(l) || (!/^https?:\/\//i.test(l) && !/^[\w.-]+\.[a-z]{2,}/i.test(l)))
  if (links.length === 0) add('links', 'Profile links (GitHub / LinkedIn)', 'info', 'Optional — add them in the Personal tab if relevant.')
  else if (badLinks.length) add('links', 'Profile links look valid', 'warn', `Check: ${badLinks.join(', ')}`)
  else add('links', 'Profile links look valid', 'pass', `${links.length} link${links.length === 1 ? '' : 's'}.`)

  // ---- length ----
  const totalWords = countWords(allText)
  if (totalWords < 120) add('length', 'Sufficient content (~120+ words)', 'warn', `Only ~${totalWords} words — the page may look sparse.`)
  else if (totalWords > 750) add('length', 'Content fits a typical resume', 'warn', `~${totalWords} words — likely more than one page. Trim or split sections.`)
  else add('length', 'Content fits a typical resume', 'pass', `~${totalWords} words (one page is typical).`)

  // ---- template awareness ----
  if (p.photo && String(p.template || '').toLowerCase().includes('ats')) {
    add('photo', 'Photo handling on ATS templates', 'info', 'ATS templates intentionally hide the photo — switch to a creative template to show it.')
  }

  const score = checks.reduce((n, c) => n + (c.status === 'pass' ? 1 : c.status === 'warn' ? 0.5 : 0), 0)
  const grade = Math.round((score / checks.length) * 100)

  return { checks, grade }
}
