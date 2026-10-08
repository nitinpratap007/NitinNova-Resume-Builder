// resumeImport.js — client-side resume file import & parsing
// Supports PDF, DOCX, TXT → structured resume data
// Zero server upload; all processing local

import * as pdfjsLib from 'pdfjs-dist'
import { normalizeResumeData } from './resumeNormalize'

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

// ---- File validation --------------------------------------------------------

export const SUPPORTED_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export function validateFile(file) {
  if (!file) return { ok: false, error: 'No file selected.' }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: `File too large (${(file.size/1024/1024).toFixed(1)} MB). Maximum is ${MAX_FILE_SIZE/1024/1024} MB.` }
  }
  const ext = SUPPORTED_TYPES[file.type]
  if (!ext) {
    return { ok: false, error: 'Unsupported file type. Please select a PDF, DOCX, or TXT resume.' }
  }
  return { ok: true, ext }
}

// ---- Text extraction --------------------------------------------------------

export async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join(' ')
    pages.push(pageText)
  }
  const fullText = pages.join('\n\n')
  // Detect scanned/image-based PDF
  const totalChars = fullText.trim().length
  if (totalChars < 50) {
    return { text: fullText, isScanned: true, pageCount: pdf.numPages }
  }
  return { text: fullText, isScanned: false, pageCount: pdf.numPages }
}

export async function extractTextFromDOCX(file) {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return { text: result.value, messages: result.messages }
}

export async function extractTextFromTXT(file) {
  return { text: await file.text() }
}

export async function extractText(file) {
  const validation = validateFile(file)
  if (!validation.ok) throw new Error(validation.error)

  if (file.type === 'application/pdf') return extractTextFromPDF(file)
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return extractTextFromDOCX(file)
  if (file.type === 'text/plain') return extractTextFromTXT(file)
  throw new Error('Unsupported file type')
}

// ---- Section detection & normalization --------------------------------------

const SECTION_PATTERNS = {
  personal: /^(personal|contact|profile|header)$/i,
  summary: /^(summary|professional summary|profile summary|career objective|objective|about me|about)$/i,
  experience: /^(experience|work experience|employment|employment history|professional experience|career history|work history)$/i,
  education: /^(education|academic|qualifications|degrees)$/i,
  skills: /^(skills|technical skills|core competencies|competencies|expertise|technologies|tech stack)$/i,
  projects: /^(projects|personal projects|key projects|project experience|portfolio)$/i,
  certifications: /^(certifications|certificates|licenses|credentials)$/i,
  achievements: /^(achievements|accomplishments|awards|honors|recognitions)$/i,
  languages: /^(languages|language proficiency)$/i,
  interests: /^(interests|hobbies|personal interests)$/i,
  volunteer: /^(volunteer|volunteering|community|community involvement)$/i,
  publications: /^(publications|papers|research)$/i,
}

function detectSection(line) {
  const clean = line.trim().replace(/[:\-–—]+$/, '').toLowerCase()
  for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
    if (pattern.test(clean)) return key
  }
  return null
}

function extractEmail(text) {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : ''
}

function extractPhone(text) {
  const match = text.match(/(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/)
  return match ? match[0] : ''
}

function extractLinks(text) {
  const links = []
  const urlRegex = /(https?:\/\/[^\s]+)/g
  let match
  while ((match = urlRegex.exec(text)) !== null) {
    links.push(match[0])
  }
  return links
}

function extractName(lines) {
  // First non-empty line that looks like a name (2-4 words, capitalized)
  for (const line of lines.slice(0, 5)) {
    const clean = line.trim()
    if (!clean) continue
    const words = clean.split(/\s+/)
    if (words.length >= 2 && words.length <= 4 && words.every(w => /^[A-Z][a-z]+$/.test(w))) {
      return clean
    }
  }
  return ''
}

function splitIntoLines(text) {
  return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
}

function parseExperience(lines, startIdx) {
  const experiences = []
  let i = startIdx
  while (i < lines.length) {
    const line = lines[i]
    const section = detectSection(line)
    if (section && section !== 'experience') break

    // Look for job title + company pattern
    if (line.includes(' - ') || line.includes(' at ') || /^\d{4}\s*[-–]\s*\d{4}/.test(line)) {
      const exp = { title: '', company: '', dates: '', description: [] }
      // Try to parse "Title - Company" or "Title at Company"
      if (line.includes(' - ')) {
        const parts = line.split(' - ')
        exp.title = parts[0].trim()
        exp.company = parts[1].trim()
      } else if (line.includes(' at ')) {
        const parts = line.split(' at ')
        exp.title = parts[0].trim()
        exp.company = parts[1].trim()
      } else {
        exp.title = line
      }
      // Check next line for dates
      if (i + 1 < lines.length && /^\d{4}\s*[-–]\s*(\d{4}|present|current)/i.test(lines[i + 1])) {
        exp.dates = lines[i + 1]
        i++
      }
      // Collect bullet points
      let j = i + 1
      while (j < lines.length) {
        const nextLine = lines[j]
        const nextSection = detectSection(nextLine)
        if (nextSection) break
        if (/^\d{4}\s*[-–]\s*(\d{4}|present|current)/i.test(nextLine)) break
        if (nextLine.startsWith('•') || nextLine.startsWith('-') || nextLine.startsWith('*') || nextLine.startsWith('·')) {
          exp.description.push(nextLine.replace(/^[•\-\*\·]\s*/, ''))
        } else if (nextLine.length > 20) {
          exp.description.push(nextLine)
        } else {
          break
        }
        j++
      }
      experiences.push(exp)
      i = j - 1
    }
    i++
  }
  return { experiences, nextIdx: i }
}

function parseEducation(lines, startIdx) {
  const education = []
  let i = startIdx
  while (i < lines.length) {
    const line = lines[i]
    const section = detectSection(line)
    if (section && section !== 'education') break

    if (line && !detectSection(line)) {
      // Check for degree pattern
      if (/^(B\.?Tech|B\.?E|M\.?Tech|M\.?E|B\.?Sc|M\.?Sc|B\.?A|M\.?A|MBA|PhD|Ph\.?D|Diploma|Bachelor|Master)/i.test(line) ||
          /university|institute|college|school/i.test(line) ||
          /\d{4}\s*[-–]\s*\d{4}/.test(line)) {
        education.push(line)
      }
    }
    i++
  }
  return { education, nextIdx: i }
}

function parseSkills(lines, startIdx) {
  const skills = []
  let i = startIdx
  while (i < lines.length) {
    const line = lines[i]
    const section = detectSection(line)
    if (section && section !== 'skills') break

    if (line) {
      // Split by common delimiters
      const parts = line.split(/[,;|•\-\*]/).map(s => s.trim()).filter(Boolean)
      skills.push(...parts)
    }
    i++
  }
  return { skills: [...new Set(skills)], nextIdx: i }
}

function parseProjects(lines, startIdx) {
  const projects = []
  let i = startIdx
  while (i < lines.length) {
    const line = lines[i]
    const section = detectSection(line)
    if (section && section !== 'projects') break

    if (line && !detectSection(line) && line.length > 5) {
      projects.push(line)
    }
    i++
  }
  return { projects, nextIdx: i }
}

function parseCertifications(lines, startIdx) {
  const certs = []
  let i = startIdx
  while (i < lines.length) {
    const line = lines[i]
    const section = detectSection(line)
    if (section && section !== 'certifications') break

    if (line && !detectSection(line)) {
      certs.push(line)
    }
    i++
  }
  return { certifications: certs, nextIdx: i }
}

function parseAchievements(lines, startIdx) {
  const achievements = []
  let i = startIdx
  while (i < lines.length) {
    const line = lines[i]
    const section = detectSection(line)
    if (section && section !== 'achievements') break

    if (line && !detectSection(line)) {
      achievements.push(line)
    }
    i++
  }
  return { achievements, nextIdx: i }
}

function parseLanguages(lines, startIdx) {
  const languages = []
  let i = startIdx
  while (i < lines.length) {
    const line = lines[i]
    const section = detectSection(line)
    if (section && section !== 'languages') break

    if (line && !detectSection(line)) {
      languages.push(line)
    }
    i++
  }
  return { languages, nextIdx: i }
}

function parseInterests(lines, startIdx) {
  const interests = []
  let i = startIdx
  while (i < lines.length) {
    const line = lines[i]
    const section = detectSection(line)
    if (section && section !== 'interests') break

    if (line && !detectSection(line)) {
      interests.push(line)
    }
    i++
  }
  return { interests, nextIdx: i }
}

function parseVolunteer(lines, startIdx) {
  const volunteer = []
  let i = startIdx
  while (i < lines.length) {
    const line = lines[i]
    const section = detectSection(line)
    if (section && section !== 'volunteer') break

    if (line && !detectSection(line)) {
      volunteer.push(line)
    }
    i++
  }
  return { volunteer, nextIdx: i }
}

function parsePublications(lines, startIdx) {
  const pubs = []
  let i = startIdx
  while (i < lines.length) {
    const line = lines[i]
    const section = detectSection(line)
    if (section && section !== 'publications') break

    if (line && !detectSection(line)) {
      pubs.push(line)
    }
    i++
  }
  return { publications: pubs, nextIdx: i }
}

function parseGeneric(lines, startIdx, sectionKey) {
  const items = []
  let i = startIdx
  while (i < lines.length) {
    const line = lines[i]
    const section = detectSection(line)
    if (section && section !== sectionKey) break

    if (line && !detectSection(line)) {
      items.push(line)
    }
    i++
  }
  return { [sectionKey]: items, nextIdx: i }
}

// Helper to extract location from a line
function extractLocation(line) {
  const locPatterns = [
    /^location[:\-]\s*(.+)$/i,
    /^address[:\-]\s*(.+)$/i,
    /^based in[:\-]\s*(.+)$/i,
    /^city[:\-]\s*(.+)$/i,
  ]
  for (const pattern of locPatterns) {
    const match = line.match(pattern)
    if (match) return match[1].trim()
  }
  // If line looks like a location (city, state/country)
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s+[A-Z]{2,}$/.test(line.trim())) {
    return line.trim()
  }
  return ''
}

function extractHeadline(line) {
  // Skip contact info lines
  if (extractEmail(line) || extractPhone(line) || extractLocation(line)) return ''
  // Skip lines that are just labels
  if (/^(email|phone|location|address|github|linkedin|portfolio|github|linkedin)[:\-]/i.test(line)) return ''
  return line.trim()
}

export function parseResumeText(rawText) {
  const lines = splitIntoLines(rawText)
  const result = {
    name: '',
    headline: '',
    location: '',
    email: '',
    phone: '',
    socialGithub: '',
    socialLinkedin: '',
    socialPortfolio: '',
    summary: '',
    education: '',
    skills: '',
    projects: '',
    skillGroups: [],
    sections: [],
    bullets: [],
    rawText, // preserve original
  }

  // Extract contact info from entire text
  const allText = lines.join(' ')
  result.email = extractEmail(allText) || ''
  result.phone = extractPhone(allText) || ''

  const links = extractLinks(allText)
  for (const link of links) {
    if (link.includes('github') && !result.socialGithub) result.socialGithub = link
    else if (link.includes('linkedin') && !result.socialLinkedin) result.socialLinkedin = link
    else if (!result.socialPortfolio) result.socialPortfolio = link
  }

  // Detect name from first few lines
  result.name = extractName(lines) || ''

  let i = 0
  let currentSection = null
  const sectionContent = {}

  // Track if we've seen the name already
  let nameFound = false

  while (i < lines.length) {
    const line = lines[i]
    const section = detectSection(line)

    if (section) {
      currentSection = section
      sectionContent[section] = []
      i++
      continue
    }

    if (currentSection) {
      sectionContent[currentSection].push(line)
    } else {
      // Before first section, extract name, headline, location
      if (!nameFound && line.length > 1) {
        // Check if this looks like a name (first non-empty line with 2-4 capitalized words)
        if (!result.name && /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line.trim())) {
          result.name = line.trim()
          nameFound = true
        } else if (result.name && !nameFound) {
          nameFound = true
        }
      }
      
      // Extract location from lines like "Location: New Delhi, India"
      if (!result.location) {
        const loc = extractLocation(line)
        if (loc) result.location = loc
      }
      
      // Extract headline (first substantial line after name that's not contact info)
      if (!result.headline && line.length > 3) {
        const hl = extractHeadline(line)
        if (hl && hl !== result.name) result.headline = hl
      }
    }
    i++
  }

  // Now parse each section's content
  if (sectionContent.summary) {
    result.summary = sectionContent.summary.join(' ')
  }
  if (sectionContent.experience) {
    const { experiences } = parseExperience(sectionContent.experience, 0)
    result.bullets = experiences.map(e => {
      const desc = e.description.join(' | ')
      return `${e.title} - ${e.company}${e.dates ? ` (${e.dates})` : ''}${desc ? ` - ${desc}` : ''}`
    }).filter(Boolean)
  }
  if (sectionContent.education) {
    result.education = sectionContent.education.join('\n')
  }
  if (sectionContent.skills) {
    const { skills } = parseSkills(sectionContent.skills, 0)
    result.skills = skills.join('\n')
  }
  if (sectionContent.projects) {
    const { projects } = parseProjects(sectionContent.projects, 0)
    result.projects = projects.join('\n')
  }
  if (sectionContent.certifications) {
    const { certifications } = parseCertifications(sectionContent.certifications, 0)
    result.sections.push({ id: Date.now(), title: 'Certifications', content: certifications.join('\n') })
  }
  if (sectionContent.achievements) {
    const { achievements } = parseAchievements(sectionContent.achievements, 0)
    result.sections.push({ id: Date.now() + 1, title: 'Achievements', content: achievements.join('\n') })
  }
  if (sectionContent.languages) {
    const { languages } = parseLanguages(sectionContent.languages, 0)
    result.sections.push({ id: Date.now() + 2, title: 'Languages', content: languages.join('\n') })
  }
  if (sectionContent.interests) {
    const { interests } = parseInterests(sectionContent.interests, 0)
    result.sections.push({ id: Date.now() + 3, title: 'Interests', content: interests.join('\n') })
  }
  if (sectionContent.volunteer) {
    const { volunteer } = parseVolunteer(sectionContent.volunteer, 0)
    result.sections.push({ id: Date.now() + 4, title: 'Volunteer Experience', content: volunteer.join('\n') })
  }
  if (sectionContent.publications) {
    const { publications } = parsePublications(sectionContent.publications, 0)
    result.sections.push({ id: Date.now() + 5, title: 'Publications', content: publications.join('\n') })
  }

  // Remove empty sections
  result.sections = result.sections.filter(s => s.content.trim())

  return result
}

// ---- High-level import API --------------------------------------------------

export async function importResumeFile(file) {
  const { text, isScanned, pageCount } = await extractText(file)
  const parsed = parseResumeText(text)
  return {
    ...parsed,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    isScanned,
    pageCount,
    extractedText: text,
    importedAt: new Date().toISOString(),
  }
}

export function getImportSummary(parsed) {
  const counts = {
    personal: !!(parsed.name || parsed.email || parsed.phone),
    summary: !!parsed.summary,
    experience: parsed.bullets?.length || 0,
    education: !!parsed.education,
    skills: parsed.skills ? parsed.skills.split('\n').filter(Boolean).length : 0,
    projects: parsed.projects ? parsed.projects.split('\n').filter(Boolean).length : 0,
    sections: parsed.sections?.length || 0,
  }
  return counts
}