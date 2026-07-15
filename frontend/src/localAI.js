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

  if (!bullets.length) {
    bullets.push('Contributed to projects using listed skills.')
  }

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
