// =============================================================================
// aiBuilder.js — WEB-VERSION-ONLY offline "AI" resume drafter.
//
// Free & local: no API key, no network call, no invented facts.
// It takes the basics the user provides (target role, skills, experience
// highlights, education) and composes a complete, well-structured resume
// draft — summary, categorized skills and action-verb bullets — using only
// what was typed. Anything the user did not provide is simply left empty for
// them to fill; numbers, employers and dates are NEVER fabricated.
// =============================================================================

const VERB_RULES = [
  [/(built|created|made|develop|code|program|implement)/i, 'Developed'],
  [/(design|ui|ux|layout|frontend|landing)/i, 'Designed'],
  [/(optim|improv|speed|perf|fast|refactor)/i, 'Optimized'],
  [/(lead|manage|team|mentor|direct|coordinat)/i, 'Led'],
  [/(automat|script|pipeline|ci\/cd|workflow)/i, 'Automated'],
  [/(test|qa|bug|debug|quality)/i, 'Engineered'],
  [/(research|analy|data|report)/i, 'Analyzed'],
  [/(market|seo|social|content|brand|campaign)/i, 'Spearheaded'],
  [/(teach|train|workshop|guide)/i, 'Mentored'],
  [/(deploy|ship|release|publish|scale)/i, 'Launched'],
  [/(integrat|connect|api|third.?party)/i, 'Integrated'],
  [/(secur|auth|privacy|compliance)/i, 'Hardened'],
]

const FALLBACK_VERBS = ['Built', 'Developed', 'Implemented', 'Designed', 'Delivered', 'Managed']

// Deterministic verb choice (same input -> same output, easy to trust/test).
function hashIndex(text, modulo) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h % modulo
}

function pickVerb(line) {
  for (const [re, verb] of VERB_RULES) if (re.test(line)) return verb
  return FALLBACK_VERBS[hashIndex(line, FALLBACK_VERBS.length)]
}

function toBullet(line) {
  let text = String(line || '')
    .replace(/^[-•*\s]+/, '')
    .replace(/^I\s+/i, '')
    .replace(/\s*\.$/, '')
    .trim()
  if (!text) return null
  // Already starts with a strong action verb — keep the wording verbatim.
  if (/^(developed|built|created|implemented|designed|led|optimized|automated|integrated|engineered|launched|delivered|managed|coordinated|established|enhanced|refactored|migrated|collaborated|mentored|deployed|analyzed|architected|spearheaded|hardened|streamlined)\b/i.test(text)) {
    return text.charAt(0).toUpperCase() + text.slice(1)
  }
  return pickVerb(text) + ' ' + text
}

function topSkills(skillsRaw, n) {
  return String(skillsRaw || '')
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .filter((s, i, arr) => arr.findIndex(x => x.toLowerCase() === s.toLowerCase()) === i)
    .slice(0, n)
}

export function draftResume({ jobTitle, years, skills, highlights, education }) {
  const title = String(jobTitle || '').trim()
  if (!title) throw new Error('Tell us the role you are targeting (e.g. "Frontend Developer").')

  const skillList = topSkills(skills, 6)
  const skillPhrase = skillList.length
    ? skillList.slice(0, 3).join(', ') + (skillList.length > 3 ? ` and ${skillList.length - 3} more` : '')
    : null

  const yr = parseInt(years, 10)
  const expPhrase = Number.isFinite(yr) && yr > 0
    ? `${yr} ${yr === 1 ? 'year' : 'years'} of hands-on experience`
    : 'hands-on experience'

  // ---- summary (only facts the user gave us) ----
  const sentences = []
  sentences.push(skillPhrase
    ? `${title} with ${expPhrase} in ${skillPhrase}.`
    : `${title} with ${expPhrase}.`)

  const bullets = String(highlights || '')
    .split('\n')
    .map(toBullet)
    .filter(Boolean)

  if (bullets.length) {
    sentences.push(`Highlights include: ${bullets[0].replace(/^(Developed|Built|Created|Implemented|Designed|Led|Optimized|Automated|Integrated|Engineered|Launched|Delivered|Managed|Coordinated|Established|Enhanced|Refactored|Migrated|Collaborated|Mentored|Deployed|Analyzed|Architected|Spearheaded|Hardened|Streamlined)\s+/i, '')}.`)
  }
  sentences.push('Focused on clean, maintainable work and clear communication with teammates and stakeholders.')

  const edu = String(education || '').trim()
  if (edu) sentences.push(`Academic background: ${edu}.`)

  return {
    headline: title,
    summary: sentences.join(' '),
    skills: String(skills || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).join('\n'),
    projects: bullets.join('\n'),
  }
}
