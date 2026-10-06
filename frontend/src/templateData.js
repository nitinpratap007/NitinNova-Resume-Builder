// kind: 'ats'       -> single-column, no photo, black text, ATS-parsable structure
// kind: 'creative'  -> decorative layout, NOT ATS-safe (kept for design use)
// ats.heading: 'rule' (UPPERCASE + underline) | 'accent' (UPPERCASE + accent underline) | 'plain' (UPPERCASE bold, no line)
// ats.align:   'center' | 'left' for the header block
export const templateSets = {
  online: [
    {
      id: 'creative-gradient',
      name: 'Creative Gradient',
      description: 'Bold gradient header with modern section cards. (Not ATS-safe)',
      palette: ['#3f51b5', '#ff4081', '#ffffff'],
      style: 'gradient',
      kind: 'creative',
      showImage: false,
    },
    {
      id: 'modern-minimal',
      name: 'Modern Minimal',
      description: 'ATS single column, left header, crisp underline headings.',
      palette: ['#222831', '#eeeeee', '#00adb5'],
      style: 'minimal',
      kind: 'ats',
      ats: { heading: 'rule', align: 'left', accent: '#00adb5' },
      showImage: false,
    },
    {
      id: 'dark-glass',
      name: 'Dark Glass',
      description: 'Stylish dark theme with glass sections. (Not ATS-safe)',
      palette: ['#0b132b', '#1f4287', '#ffffff'],
      style: 'dark',
      kind: 'creative',
      showImage: false,
    },
    {
      id: 'ats-clean',
      name: 'ATS Clean',
      description: 'ATS-friendly single column, centered header. Perfect for job portals.',
      palette: ['#1a1a2e', '#ffffff', '#e94560'],
      style: 'ats',
      kind: 'ats',
      ats: { heading: 'accent', align: 'center', accent: '#e94560' },
      showImage: false,
    },
    {
      id: 'executive-pro',
      name: 'Executive Pro',
      description: 'Refined single column for senior professionals and managers.',
      palette: ['#1b2a4a', '#c9a227', '#f5f5f5'],
      style: 'executive',
      kind: 'ats',
      ats: { heading: 'rule', align: 'left', accent: '#c9a227' },
      showImage: false,
    },
    {
      id: 'tech-stack',
      name: 'Tech Stack',
      description: 'Developer-focused plain headings, maximum keyword clarity.',
      palette: ['#0d1117', '#58a6ff', '#c9d1d9'],
      style: 'tech',
      kind: 'ats',
      ats: { heading: 'plain', align: 'left', accent: '#58a6ff' },
      showImage: false,
    },
    {
      id: 'creative-portfolio',
      name: 'Creative Portfolio',
      description: 'Vibrant portfolio-style with color blocks and photo support. (Not ATS-safe)',
      palette: ['#6c5ce7', '#fd79a8', '#ffffff'],
      style: 'portfolio',
      kind: 'creative',
      showImage: true,
    },
    {
      id: 'timeline-pro',
      name: 'Timeline Pro',
      description: 'Centered plain headings with clean date-first entries.',
      palette: ['#2d3436', '#00b894', '#ffffff'],
      style: 'timeline',
      kind: 'ats',
      ats: { heading: 'plain', align: 'center', accent: '#00b894' },
      showImage: false,
    },
  ],
  offline: [
    {
      id: 'photo-profile',
      name: 'Photo Profile',
      description: 'Offline resume with a photo block and clean side panel. (Not ATS-safe)',
      palette: ['#2e3d49', '#f2f2f2', '#fdd835'],
      style: 'photo',
      kind: 'creative',
      showImage: true,
    },
    {
      id: 'classic-box',
      name: 'Classic Box',
      description: 'Trusted centered layout with clear underline headings.',
      palette: ['#1f2937', '#ffffff', '#2563eb'],
      style: 'classic',
      kind: 'ats',
      ats: { heading: 'rule', align: 'center', accent: '#2563eb' },
      showImage: false,
    },
    {
      id: 'warm-side',
      name: 'Warm Side',
      description: 'Single column with accent underline headings and left header.',
      palette: ['#7c3aed', '#faf5ff', '#334155'],
      style: 'side',
      kind: 'ats',
      ats: { heading: 'accent', align: 'left', accent: '#7c3aed' },
      showImage: false,
    },
    {
      id: 'bold-header',
      name: 'Bold Header',
      description: 'Centered header with bold typography and accent line.',
      palette: ['#e63946', '#1d3557', '#f1faee'],
      style: 'boldheader',
      kind: 'ats',
      ats: { heading: 'plain', align: 'center', accent: '#e63946' },
      showImage: false,
    },
    {
      id: 'simple-ats',
      name: 'Simple ATS',
      description: 'Ultra-clean single column. Maximum ATS compatibility.',
      palette: ['#000000', '#ffffff', '#555555'],
      style: 'simpleats',
      kind: 'ats',
      ats: { heading: 'rule', align: 'center', accent: '#000000' },
      showImage: false,
    },
    {
      id: 'professional-elegant',
      name: 'Professional Elegant',
      description: 'Elegant serif-inspired single column with refined spacing.',
      palette: ['#34495e', '#ecf0f1', '#2980b9'],
      style: 'elegant',
      kind: 'ats',
      ats: { heading: 'accent', align: 'left', accent: '#2980b9' },
      showImage: false,
    },
    {
      id: 'fresher-starter',
      name: 'Fresher Starter',
      description: 'Perfect for fresh graduates. Highlights education and skills.',
      palette: ['#0097a7', '#e0f7fa', '#263238'],
      style: 'fresher',
      kind: 'ats',
      ats: { heading: 'plain', align: 'left', accent: '#0097a7' },
      showImage: false,
    },
    {
      id: 'double-column',
      name: 'Double Column',
      description: 'Single-column ATS layout with grouped skill lines. (Now ATS-safe)',
      palette: ['#455a64', '#eceff1', '#ff6f00'],
      style: 'doublecol',
      kind: 'ats',
      ats: { heading: 'rule', align: 'left', accent: '#ff6f00' },
      showImage: false,
    },
  ]
}

export function findTemplate(id) {
  return [...(templateSets.online || []), ...(templateSets.offline || [])].find(t => t.id === id) || null
}

export function isAtsTemplate(id) {
  const t = findTemplate(id)
  return !t || t.kind !== 'creative'
}

// Default skill categories for the ATS structure
export const defaultSkillCategories = [
  'Languages', 'Frontend', 'Backend', 'Databases',
  'AI & APIs', 'Mobile Development', 'DevOps & Tools', 'Core Concepts'
]

// Pre-created sections for new resumes (user can rename / remove / reorder)
export const defaultSections = [
  { title: 'Certifications & Training', content: '' },
  { title: 'Soft Skills', content: '' },
]

export const fontOptions = [
  { id: 'helvetica', name: 'Helvetica', value: "'Inter', 'Helvetica', sans-serif", pdfFont: 'Helvetica' },
  { id: 'georgia', name: 'Georgia', value: "'Georgia', 'Times New Roman', serif", pdfFont: 'Times-Roman' },
  { id: 'roboto', name: 'Roboto', value: "'Roboto', 'Arial', sans-serif", pdfFont: 'Helvetica' },
  { id: 'arial', name: 'Arial', value: "'Arial', sans-serif", pdfFont: 'Helvetica' },
  { id: 'courier', name: 'Courier New', value: "'Courier New', monospace", pdfFont: 'Courier' },
  { id: 'outfit', name: 'Outfit', value: "'Outfit', sans-serif", pdfFont: 'Helvetica' },
]

export const fontSizePresets = [
  { id: 'compact', name: 'Compact', bodySize: 10, headingSize: 14, nameSize: 22 },
  { id: 'normal', name: 'Normal', bodySize: 11, headingSize: 16, nameSize: 26 },
  { id: 'large', name: 'Large', bodySize: 12, headingSize: 18, nameSize: 30 },
]

export const coverLetterTemplates = [
  { id: 'professional', name: 'Professional', description: 'Formal tone for corporate applications' },
  { id: 'creative', name: 'Creative', description: 'Engaging tone for creative roles' },
  { id: 'technical', name: 'Technical', description: 'Focused on skills and technical expertise' },
  { id: 'entry-level', name: 'Entry Level', description: 'For freshers and career changers' },
]
