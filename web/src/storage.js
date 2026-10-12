// =============================================================================
// storage.js — WEB-VERSION-ONLY storage layer (not used by the Android APK).
//
// The Android build keeps profiles/draft in localStorage (shared code in
// frontend/src). Browsers cap localStorage at ~5 MB and photos are stored as
// dataURLs, so the web version puts ALL structured resume data in IndexedDB:
//
//   DB    : nitinnova-web
//   store : kv   —  keys: 'profiles', 'draft', 'versions', 'settings'
//
// Falls back to localStorage automatically when IndexedDB is unavailable
// (private browsing / blocked storage), and migrates any legacy localStorage
// keys into IndexedDB exactly once on first read.
//
// Never uploads anything: everything stays on this device.
// =============================================================================

const DB_NAME = 'nitinnova-web'
const DB_VERSION = 1
const STORE = 'kv'
const LS_PREFIX = 'webkv:'

// legacy keys used by the shared (APK) code — read once for migration
const LEGACY_KEYS = {
  profiles: 'nitinnova_resume_profiles',
  draft: 'resume_builder_draft',
}

let dbPromise = null
let idbAvailable = typeof indexedDB !== 'undefined'

// ---- low-level IndexedDB ----------------------------------------------------
function openDb() {
  if (!idbAvailable) return Promise.resolve(null)
  if (!dbPromise) {
    dbPromise = new Promise(resolve => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => { idbAvailable = false; resolve(null) }
        req.onblocked = () => resolve(null)
      } catch { idbAvailable = false; resolve(null) }
    })
  }
  return dbPromise
}

function idbGet(key) {
  return openDb().then(db => new Promise(resolve => {
    if (!db) return resolve(undefined)
    try {
      const rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      rq.onsuccess = () => resolve(rq.result)
      rq.onerror = () => resolve(undefined)
    } catch { resolve(undefined) }
  }))
}

function idbSet(key, value) {
  return openDb().then(db => new Promise((resolve, reject) => {
    if (!db) return reject(new Error('IndexedDB unavailable'))
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'))
      tx.onabort = () => reject(tx.error || new Error('IndexedDB write aborted'))
    } catch (e) { reject(e) }
  }))
}

function idbClear() {
  return openDb().then(db => new Promise(resolve => {
    if (!db) return resolve(false)
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    } catch { resolve(false) }
  }))
}

// ---- localStorage fallback ---------------------------------------------------
function lsGet(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    return raw === null ? undefined : JSON.parse(raw)
  } catch { return undefined }
}
function lsSet(key, value) {
  localStorage.setItem(LS_PREFIX + key, JSON.stringify(value)) // may throw QuotaExceeded
}
function lsClear() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(LS_PREFIX))
      .forEach(k => localStorage.removeItem(k))
  } catch {}
}
function legacyGet(key) {
  try {
    const raw = localStorage.getItem(LEGACY_KEYS[key] || key)
    return raw === null ? undefined : JSON.parse(raw)
  } catch { return undefined }
}

// ---- unified kv ---------------------------------------------------------------
async function kvGet(key) {
  if (idbAvailable) {
    try {
      const v = await idbGet(key)
      if (v !== undefined) return v
    } catch { /* fall through to localStorage */ }
  }
  return lsGet(key)
}

async function kvSet(key, value) {
  if (idbAvailable) {
    try {
      await idbSet(key, value)
      return 'idb'
    } catch { /* fall through to localStorage */ }
  }
  lsSet(key, value) // throws on quota — caller surfaces the error
  return 'local'
}

// ---- profiles ------------------------------------------------------------------
export async function getProfiles() {
  let v = await kvGet('profiles')
  if (v === undefined) {
    const legacy = legacyGet('profiles') // one-time migration from APK-era keys
    if (Array.isArray(legacy) && legacy.length) {
      v = legacy
      try { await kvSet('profiles', legacy) } catch {}
    }
  }
  return Array.isArray(v) ? v : []
}

export async function saveProfiles(profiles) {
  const list = (Array.isArray(profiles) ? profiles : []).slice(0, 60)
  await kvSet('profiles', list)
  return list
}

// ---- draft (autosave) ------------------------------------------------------------
const draftListeners = new Set()
export function onDraftStatus(cb) {
  draftListeners.add(cb)
  return () => draftListeners.delete(cb)
}
function emitDraftStatus(status, at) {
  draftListeners.forEach(cb => { try { cb(status, at) } catch {} })
}

let draftTimer = null
let pendingDraft = undefined
let hasPendingDraft = false

export function queueDraftSave(draft) {
  pendingDraft = draft
  hasPendingDraft = true
  emitDraftStatus('saving')
  clearTimeout(draftTimer)
  draftTimer = setTimeout(flushDraftSave, 500)
}

export async function flushDraftSave() {
  if (!hasPendingDraft) return
  const d = pendingDraft
  hasPendingDraft = false
  pendingDraft = undefined
  clearTimeout(draftTimer)
  try {
    await kvSet('draft', d)
    emitDraftStatus('saved', Date.now())
  } catch (e) {
    console.warn('Draft autosave failed:', e)
    emitDraftStatus('error', Date.now())
  }
}

// Explicitly discard the current draft ("+ New Resume") — used only after a
// user confirmation so unsaved work is never wiped silently.
export async function clearDraft() {
  await flushDraftSave() // don't let a queued write resurrect the old draft
  await kvSet('draft', null)
  emitDraftStatus('cleared')
}

export async function getDraft() {
  let v = await kvGet('draft')
  if (v === undefined) {
    const legacy = legacyGet('draft')
    if (legacy && typeof legacy === 'object') {
      v = legacy
      try { await kvSet('draft', legacy) } catch {}
    }
  }
  return v && typeof v === 'object' && v.form ? v : null
}

// Flush unsaved work when the tab is hidden or the page is unloaded so an
// accidental refresh never loses the last <1 s of typing.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { flushDraftSave() })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushDraftSave()
  })
}

// ---- version history ------------------------------------------------------------
export async function getVersions(profileId) {
  const all = (await kvGet('versions')) || {}
  const list = Array.isArray(all[String(profileId)]) ? all[String(profileId)] : []
  return list
}

export async function pushVersion(profileId, snapshot) {
  const all = (await kvGet('versions')) || {}
  const key = String(profileId)
  const list = Array.isArray(all[key]) ? all[key] : []
  // Skip no-op versions (identical JSON) to keep history meaningful.
  const body = JSON.stringify(snapshot)
  if (list[0] && list[0].body === body) return list
  list.unshift({ at: new Date().toISOString(), body, snapshot })
  all[key] = list.slice(0, 10)
  await kvSet('versions', all)
  return all[key]
}

export async function deleteVersions(profileId) {
  const all = (await kvGet('versions')) || {}
  delete all[String(profileId)]
  await kvSet('versions', all)
}

// ---- settings ---------------------------------------------------------------------
export async function getSetting(key, fallback = null) {
  const s = (await kvGet('settings')) || {}
  return s[key] !== undefined ? s[key] : fallback
}
export async function setSetting(key, value) {
  const s = (await kvGet('settings')) || {}
  s[key] = value
  await kvSet('settings', s)
  return s
}

// ---- backup / restore ----------------------------------------------------------------
export async function exportAllData() {
  const [profiles, draft, versions, settings] = await Promise.all([
    kvGet('profiles'), kvGet('draft'), kvGet('versions'), kvGet('settings'),
  ])
  return {
    app: 'nitinnova-web-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles: Array.isArray(profiles) ? profiles : [],
    draft: draft || null,
    versions: versions || {},
    settings: settings || {},
  }
}

// Validate an untrusted backup file before touching storage.
// Returns { ok, data?, error? }. NEVER executes or trusts structure blindly.
function validateBackup(raw) {
  let data = raw
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw) } catch { return { ok: false, error: 'Not a valid JSON file.' } }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'Unrecognized backup file.' }
  }
  if (data.app !== 'nitinnova-web-backup') {
    return { ok: false, error: 'This file was not created by the web backup button.' }
  }
  if (!Array.isArray(data.profiles)) {
    return { ok: false, error: 'Backup is missing the profiles list.' }
  }
  const profiles = data.profiles
    .filter(p => p && typeof p === 'object' && !Array.isArray(p))
    .map(p => {
      // Keep only known scalar/array/object fields — strip functions/prototypes.
      const out = {}
      for (const k of ['id', 'name', 'headline', 'location', 'summary', 'email', 'phone',
        'education', 'skills', 'projects', 'photo', 'photoShape', 'bgColor',
        'socialGithub', 'socialLinkedin', 'socialPortfolio', 'template', 'templateMode',
        'fontFamily', 'fontSizePreset', 'margins', 'savedAt']) {
        if (typeof p[k] === 'string' || typeof p[k] === 'number') out[k] = p[k]
      }
      if (Array.isArray(p.skillGroups)) {
        out.skillGroups = p.skillGroups
          .filter(g => g && typeof g === 'object')
          .map(g => ({
            id: typeof g.id === 'number' || typeof g.id === 'string' ? g.id : Date.now() + Math.random(),
            category: typeof g.category === 'string' ? g.category : '',
            items: Array.isArray(g.items) ? g.items.filter(x => typeof x === 'string').slice(0, 500) : [],
          }))
      }
      if (Array.isArray(p.sections)) {
        out.sections = p.sections
          .filter(s => s && typeof s === 'object')
          .map(s => ({
            id: typeof s.id === 'number' || typeof s.id === 'string' ? s.id : Date.now() + Math.random(),
            title: typeof s.title === 'string' ? s.title : '',
            content: typeof s.content === 'string' ? s.content : '',
          }))
      }
      return out
    })
  return {
    ok: true,
    data: {
      profiles,
      draft: data.draft && typeof data.draft === 'object' && data.draft.form ? data.draft : null,
      versions: data.versions && typeof data.versions === 'object' ? data.versions : {},
      settings: data.settings && typeof data.settings === 'object' ? data.settings : {},
    },
  }
}

export async function importAllData(raw, mode /* 'merge' | 'replace' */) {
  const v = validateBackup(raw)
  if (!v.ok) return v
  const { profiles, draft, versions, settings } = v.data

  if (mode === 'replace') {
    await saveProfiles(profiles)
    if (draft) await kvSet('draft', draft)
    await kvSet('versions', versions)
    await kvSet('settings', settings)
  } else {
    const existing = await getProfiles()
    const byId = new Map(existing.map(p => [String(p.id), p]))
    profiles.forEach((p, i) => {
      const id = p.id !== undefined && !byId.has(String(p.id))
        ? p.id
        : Date.now() + i
      byId.set(String(id), { ...p, id })
    })
    await saveProfiles([...byId.values()])
    if (draft && !(await getDraft())) await kvSet('draft', draft)
    const existingVersions = (await kvGet('versions')) || {}
    for (const [k, list] of Object.entries(versions)) {
      if (Array.isArray(list)) existingVersions[k] = list.slice(0, 10)
    }
    await kvSet('versions', existingVersions)
  }
  return { ok: true, imported: profiles.length }
}

// ---- usage & maintenance ------------------------------------------------------------
export async function estimateUsage() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate()
      return { usage: e.usage || 0, quota: e.quota || 0, backend: idbAvailable ? 'IndexedDB' : 'localStorage' }
    }
  } catch {}
  return { usage: 0, quota: 0, backend: idbAvailable ? 'IndexedDB' : 'localStorage' }
}

export async function clearAllAppData() {
  await flushDraftSave()
  await idbClear()
  lsClear()
  // Web-only session flag + on-device feedback copies are app data too.
  try {
    localStorage.removeItem('nn_active_profile_id')
    localStorage.removeItem('nitinnova_local_feedbacks')
  } catch {}
  // Leave auth flags alone; only app/resume data is removed.
  draftListeners.forEach(cb => { try { cb('cleared') } catch {} })
}

export const STORAGE_BACKEND_LABEL = () => (idbAvailable ? 'IndexedDB' : 'localStorage fallback')
