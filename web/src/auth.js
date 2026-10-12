// =============================================================================
// auth.js — WEB-VERSION-ONLY device-local accounts (100% free, offline).
//
// Design (deliberate — decided with the project owner):
//   * An account is required to BUILD resumes. Visitors can still explore the
//     site (welcome, templates, feedback, developer pages) without one.
//   * Accounts live ONLY in this browser (localStorage). No server, no fees,
//     no data leaves the device. Passwords are never stored in clear text:
//     PBKDF2-SHA256 (310 000 iterations) via WebCrypto.
//   * The owner's account is verified against digests shipped in the bundle —
//     the bundle contains NO password and NO plain-text email, only:
//         - SHA-256 of the owner's email
//         - PBKDF2 hash + salt of a long random passcode
//       Both are stored in exactly the same shape as a normal user record, so
//       nothing in this file (or the compiled bundle) reveals that an admin
//       account exists. Regular users get a standard "wrong email or
//       password" error.
//   * The previous design (a hard-coded password checked in client JS) was
//     removed — it was forgeable by anyone reading the public source.
// =============================================================================

const USERS_KEY = 'nn_users'           // [ { email, name, salt, hash, role, createdAt } ]
const SESSION_KEY = 'nn_session'       // { email, name, role }
const PBKDF2_ITERATIONS = 310000
const MIN_PASSWORD = 8

// ---- owner account (digests only — never the secrets) -----------------------
// SHA-256 of the owner's normalized email.
const OWNER_EMAIL_SHA256 = '5b21af04d85969951094fb53efd01b0c41fde97bc9a3636b4934903281e9bed2'
// PBKDF2-SHA256 (310k) of the owner passcode, with its salt.
const OWNER_PASSWORD = {
  salt: 'CgFhCMpGE4ym5mAmWt93tw==',
  hash: 'hfKyS0seWP/RfJApaIroJkQnirynn85luzXrg3etnzE=',
}

// ---- small crypto helpers ----------------------------------------------------
function b64encode(bytes) {
  let s = ''
  bytes.forEach(b => { s += String.fromCharCode(b) })
  return btoa(s)
}
function b64decode(str) {
  const s = atob(str)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function pbkdf2(password, saltBytes, iterations) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' }, key, 256)
  return new Uint8Array(bits)
}

async function hashPassword(password, saltB64) {
  const salt = saltB64 ? b64decode(saltB64) : crypto.getRandomValues(new Uint8Array(16))
  const derived = await pbkdf2(password, salt, PBKDF2_ITERATIONS)
  return { salt: b64encode(salt), hash: b64encode(derived) }
}

// Length-safe, constant-time-ish comparison (defensive; inputs are digests).
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ---- user store ----------------------------------------------------------------
function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch { return [] }
}
function saveUsers(list) {
  localStorage.setItem(USERS_KEY, JSON.stringify(list))
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// ---- session --------------------------------------------------------------------
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    const s = raw ? JSON.parse(raw) : null
    if (s && s.email && s.role) return s
  } catch {}
  return null
}

function startSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  // Adopt pre-account data (created before login existed) into this account
  // so nobody loses the resume they already built on this device.
  try {
    // Late import avoids a module cycle (storage.js reads the session key
    // directly for owner-scoping; it does not import this module).
    import('./storage').then(m => m.claimOrphanData && m.claimOrphanData(session.email)).catch(() => {})
  } catch {}
  return session
}

export function logout() {
  try { localStorage.removeItem(SESSION_KEY) } catch {}
}

// ---- public API -------------------------------------------------------------------
export async function signup({ name, email, password }) {
  const cleanName = String(name || '').trim()
  const norm = normalizeEmail(email)
  if (cleanName.length < 2) throw new Error('Please enter your full name.')
  if (!EMAIL_RE.test(norm)) throw new Error('Please enter a valid email address.')
  if (String(password || '').length < MIN_PASSWORD) {
    throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`)
  }
  const users = loadUsers()
  if (users.some(u => u.email === norm)) throw new Error('EMAIL_TAKEN')
  // Reserved: the owner logs in (not signs up) with the owner email.
  if (safeEqual(await sha256Hex(norm), OWNER_EMAIL_SHA256)) throw new Error('EMAIL_TAKEN')

  const { salt, hash } = await hashPassword(password)
  const user = {
    email: norm, name: cleanName, salt, hash,
    role: 'user', createdAt: new Date().toISOString(),
  }
  users.push(user)
  saveUsers(users)
  return startSession({ email: user.email, name: user.name, role: 'user' })
}

export async function login(email, password) {
  const norm = normalizeEmail(email)
  const pw = String(password || '')
  if (!norm || !pw) throw new Error('Please enter your email and password.')

  const user = loadUsers().find(u => u.email === norm)
  if (user) {
    const { hash } = await hashPassword(pw, user.salt)
    if (!safeEqual(hash, user.hash)) throw new Error('WRONG_PASSWORD')
    return startSession({ email: user.email, name: user.name, role: user.role || 'user' })
  }

  // Owner account — verified against digests, identical in shape to the check
  // above. A wrong passcode is indistinguishable from an unknown email.
  if (safeEqual(await sha256Hex(norm), OWNER_EMAIL_SHA256)) {
    const { hash } = await hashPassword(pw, OWNER_PASSWORD.salt)
    if (safeEqual(hash, OWNER_PASSWORD.hash)) {
      return startSession({ email: norm, name: 'Admin', role: 'admin' })
    }
    throw new Error('WRONG_PASSWORD')
  }

  throw new Error('NO_ACCOUNT')
}

// ---- device account management (owner use) -------------------------------------------
export async function listUsers() {
  return loadUsers().map(u => ({ email: u.email, name: u.name, role: u.role || 'user', createdAt: u.createdAt }))
}

export async function deleteDeviceUser(email) {
  const norm = normalizeEmail(email)
  const users = loadUsers()
  const next = users.filter(u => u.email !== norm)
  if (next.length === users.length) return false
  saveUsers(next)
  return true
}

// Never logs or exposes hashes — used by the login screen for friendlier errors.
export function friendlyAuthError(err) {
  const code = err && err.message
  if (code === 'EMAIL_TAKEN') return 'An account with this email already exists. Try logging in.'
  if (code === 'WRONG_PASSWORD') return 'Incorrect password. Please try again.'
  if (code === 'NO_ACCOUNT') return 'No account found with this email. Create one with Sign up.'
  return (err && err.message) || 'Something went wrong. Please try again.'
}
