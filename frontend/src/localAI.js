// ---- ATS skill auto-organizer ---------------------------------------------
// Maps a skill keyword to one of the default categories. First match wins,
// so ordering matters (more specific rules first).
const SKILL_RULES = [
  ['AI & APIs', /^(openai|gpt|chatgpt|llm|langchain|hugging ?face|tensorflow|pytorch|keras|scikit|sklearn|machine learning|ml|deep learning|nlp|computer vision|generative ai|ai|ml api|gemini|claude|midjourney|stable diffusion|rag|prompt engineering|openai api|rest ?api|graphql api|api|apis)\b/i],
  ['Mobile Development', /^(android|ios|flutter|react native|capacitor|ionic|kotlin|swift|jetpack|expo|mobile|dart)\b/i],
  ['DevOps & Tools', /^(docker|kubernetes|k8s|aws|azure|gcp|google cloud|ci ?\/ ?cd|jenkins|github actions|gitlab|terraform|ansible|nginx|linux|ubuntu|git|devops|cloud|linux shell|bash|powershell|vitest|jest testing|webpack|vite|github|gitlab ci)\b/i],
  ['Databases', /^(mysql|postgres|postgresql|mongodb|mongo|redis|sqlite|firebase|oracle|cassandra|dynamodb|mariadb|sql server|elasticsearch|database|databases|supabase|prisma|sql)\b/i],
  ['Frontend', /^(react|next\.?js|vue|nuxt|angular|svelte|html|css|scss|sass|tailwind|bootstrap|redux|zustand|jquery|frontend|ui|ux|typescript|javascript|js|es6|dom|material ?ui|antd)\b/i],
  ['Backend', /^(node|express|flask|django|fastapi|spring|spring boot|laravel|nest\.?js|ruby on rails|php|rest ?api|grpc|websocket|backend|server|microservice|oauth|jwt|graphql)\b/i],
  ['Core Concepts', /^(dsa|data structures|algorithms|oop|object oriented|operating systems|dbms|system design|computer networks|security|testing|agile|scrum|solid|design patterns|problem solving|competitive programming)\b/i],
  ['Languages', /^(python|java|c\+\+|c#|c |go|golang|rust|ruby|scala|kotlin|swift|perl|r |matlab|sql|javascript|typescript|php|html|css|shell|pascal|lua|dart)\b/i],
]

function matchCategory(skill) {
  const s = String(skill).trim()
  if (!s) return null
  for (const [cat, re] of SKILL_RULES) {
    if (re.test(s)) return cat
  }
  return 'Core Concepts'
}

// Organize a flat newline/comma separated skill string into
// [{ id, category, items: [...] }]. Categories with 0 items are kept so the
// user sees the full ATS structure and can fill it in.
export function organizeSkills(skillsRaw, categories) {
  const cats = (categories && categories.length) ? categories : defaultCats()
  const tokens = String(skillsRaw || '')
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(Boolean)

  const groups = cats.map((c, i) => ({ id: Date.now() + i, category: c, items: [] }))
  const index = {}
  groups.forEach(g => { index[g.category] = g })

  tokens.forEach(tok => {
    const cat = matchCategory(tok)
    let target = index[cat]
    if (!target) {
      target = { id: Date.now() + groups.length, category: cat, items: [] }
      groups.push(target)
      index[cat] = target
    }
    if (!target.items.some(x => x.toLowerCase() === tok.toLowerCase())) target.items.push(tok)
  })

  return groups
}

function defaultCats() {
  return ['Languages', 'Frontend', 'Backend', 'Databases', 'AI & APIs', 'Mobile Development', 'DevOps & Tools', 'Core Concepts']
}

const ACTION_VERBS = [
  'Developed', 'Implemented', 'Designed', 'Architected', 'Built', 'Led',
  'Optimized', 'Automated', 'Integrated', 'Spearheaded', 'Streamlined',
  'Engineered', 'Launched', 'Delivered', 'Managed', 'Coordinated',
  'Established', 'Pioneered', 'Enhanced', 'Refactored', 'Migrated',
  'Collaborated', 'Mentored', 'Facilitated', 'Orchestrated', 'Deployed'
]

function pickVerb(line) {
  const lower = line.toLowerCase()
  if (/built|create|made|code|program/i.test(lower)) return 'Developed'
  if (/design|ui|ux|layout|visual/i.test(lower)) return 'Designed'
  if (/optim|improv|speed|perf|fast/i.test(lower)) return 'Optimized'
  if (/lead|manage|team|direct|oversee/i.test(lower)) return 'Led'
  if (/automat|script|pipeline|ci|cd/i.test(lower)) return 'Automated'
  if (/test|qa|bug|fix|debug/i.test(lower)) return 'Engineered'
  if (/research|analy|stud/i.test(lower)) return 'Analyzed'
  if (/market|brand|social|content|seo/i.test(lower)) return 'Spearheaded'
  if (/teach|train|mentor|guide/i.test(lower)) return 'Mentored'
  if (/deploy|ship|release|publish/i.test(lower)) return 'Launched'
  return ACTION_VERBS[Math.floor(Math.random() * ACTION_VERBS.length)]
}

function polishProjectLine(line) {
  let text = line.replace(/^I\s+/i, '').replace(/\.$/, '').trim()
  if (!text) return null
  // Never rewrite dated job/experience entries (e.g. "Title - Company (2020-2023)"
  // or "Role at Company 2019 - Present") — imported resume content must stay
  // verbatim; fabricating an action-verb prefix would falsify it.
  const hasDateRange = /(19|20)\d{2}\s*(?:-|–|—|to)\s*((19|20)\d{2}|present|current|now)\b/i.test(text)
  if (hasDateRange) return text
  const startsWithVerb = /^(built|developed|created|implemented|designed|maintained|led|optimized|automated|integrated|spearheaded|streamlined|engineered|launched|delivered|managed|coordinated|established|pioneered|enhanced|refactored|migrated|collaborated|mentored|facilitated|orchestrated|deployed|analyzed|architected)\b/i
  if (startsWithVerb.test(text)) {
    return text.charAt(0).toUpperCase() + text.slice(1)
  }
  return pickVerb(text) + ' ' + text
}

export function polishBullets(data) {
  const name = data.name || ''
  const education = data.education || ''
  const skillsRaw = data.skills || ''
  const projectsRaw = data.projects || ''
  const email = data.email || ''
  const phone = data.phone || ''

  const bullets = []

  projectsRaw.split('\n').map(s => s.trim()).filter(Boolean).forEach(line => {
    const polished = polishProjectLine(line)
    if (polished) bullets.push(polished)
  })

  const skills = skillsRaw.split('\n').map(s => s.trim()).filter(Boolean)
  if (skills.length) {
    bullets.push('Technologies: ' + skills.join(', '))
  }

  // NOTE: no placeholder bullet — fabricated content hurts ATS honesty.
  // If there are no projects, the Projects section is simply hidden.

  return {
    ...data,
    name,
    education,
    email,
    phone,
    skills: skillsRaw,
    bullets,
    photo: data.photo || '',
    sections: data.sections || [],
    bgColor: data.bgColor || '#eef2ff',
    socialGithub: data.socialGithub || '',
    socialLinkedin: data.socialLinkedin || '',
    socialPortfolio: data.socialPortfolio || '',
  }
}

export function generateCoverLetter(data, jobDescription = '', style = 'professional') {
  const name = data.name || 'Applicant'
  const email = data.email || ''
  const phone = data.phone || ''
  const skills = (data.skills || '').split('\n').map(s => s.trim()).filter(Boolean)
  const projects = (data.projects || '').split('\n').map(s => s.trim()).filter(Boolean)
  const education = data.education || ''

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  const firstProject = projects[0] || 'my recent projects'
  const topSkills = skills.slice(0, 5).join(', ') || 'my technical skills'

  const templates = {
    professional: {
      greeting: 'Dear Hiring Manager,',
      opening: `I am writing to express my strong interest in the position at your organization. With a proven track record in software development and a passion for delivering high-quality solutions, I am confident that my skills and experience align well with your team's goals.`,
      body: `Throughout my career, I have honed my expertise in ${topSkills}. My experience includes working on projects such as ${firstProject}, where I demonstrated my ability to deliver impactful results. My educational background in ${education || 'Computer Science'} has provided me with a solid foundation in both theoretical and practical aspects of technology.`,
      closing: `I would welcome the opportunity to discuss how my skills and enthusiasm can contribute to your team's success. Thank you for considering my application. I look forward to the possibility of contributing to your organization.`,
    },
    creative: {
      greeting: 'Dear Creative Team,',
      opening: `I'm excited to apply for this opportunity — it feels like the perfect intersection of my skills and passions. I thrive in environments where creativity meets technology, and I'd love to bring that energy to your team.`,
      body: `My toolkit includes ${topSkills}, and I've put them to work on exciting projects like ${firstProject}. I believe great work happens at the intersection of innovation and execution, and that's exactly where I aim to contribute. My background in ${education || 'Computer Science'} has taught me to think both analytically and creatively.`,
      closing: `I'd love the chance to share more about my work and learn about your vision. Let's create something remarkable together. Thank you for your time and consideration.`,
    },
    technical: {
      greeting: 'Dear Technical Hiring Team,',
      opening: `I am writing to express my interest in the technical role at your company. My hands-on experience with ${topSkills} makes me a strong candidate for this position, and I am eager to contribute to your engineering efforts.`,
      body: `In my previous work, I have successfully delivered solutions involving ${firstProject}. My technical proficiencies span across ${topSkills}, and I bring a methodical approach to problem-solving and system design. I hold a degree in ${education || 'Computer Science'} and continuously expand my technical knowledge.`,
      closing: `I am confident that my technical skills and dedication to quality engineering would make me a valuable addition to your team. I look forward to discussing how I can contribute to your projects. Thank you for your consideration.`,
    },
    'entry-level': {
      greeting: 'Dear Hiring Manager,',
      opening: `As a recent graduate eager to begin my professional career, I am thrilled to apply for this position. My academic background and project experience have prepared me to make meaningful contributions from day one.`,
      body: `During my studies in ${education || 'Computer Science'}, I developed strong skills in ${topSkills}. My hands-on experience includes working on ${firstProject}, which gave me practical insight into real-world development workflows. I am a quick learner, a collaborative team player, and deeply passionate about technology.`,
      closing: `I would be grateful for the opportunity to discuss how my fresh perspective and technical foundation can benefit your team. Thank you for considering my application.`,
    },
  }

  const t = templates[style] || templates.professional

  const jobMention = jobDescription
    ? `\n\nI noticed that your posting emphasizes ${jobDescription.slice(0, 200).replace(/\n/g, ' ')}, and I believe my background aligns well with these requirements.`
    : ''

  const letter = `${today}

${name}
${email}${phone ? ' | ' + phone : ''}

${t.greeting}

${t.opening}
${jobMention}

${t.body}

${t.closing}

Sincerely,
${name}`

  return letter
}
