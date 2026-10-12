# WEB_VERSION_AUDIT — Repository Audit & Web Version Implementation Plan

> Date: 2026-10-12 · Scope: create a **separate browser-based web version** of the
> existing Resume Builder **without touching the Android APK or its source**.

---

## 1. APK PROTECTION — BASELINE (recorded BEFORE any work)

| Artifact | SHA-256 (baseline, 2026-10-12) |
|---|---|
| `user.apk` | `5B806EC69F38A9735A8537599F85AB22C4F1FAC7B6C9816C322BCC2BD756FC2E` |
| `admin.apk` | `145C135BF44114FB9F866DEF1CE6CCCC1CE097CF6C8311460F9F0B1457E8B87D` |

These hashes are re-verified at the end of the task. Rules adopted:

* No file under `frontend/` (including `frontend/android/`) may be created,
  modified, deleted or renamed.
* No `frontend` build command (`npm run build*`, `cap copy`, `gradlew`) may run.
* The web version lives entirely in a new top-level directory **`web/`** with its
  own `package.json`, `node_modules/`, `dist/` and env files — no shared mutable
  build outputs.

---

## 2. REPOSITORY STRUCTURE (as found)

```
resume bulder/
├── frontend/            ← React (Vite) source shared by BOTH Android APKs
│   ├── src/             ← app source (22 files, ~160 KB)
│   ├── android/         ← Capacitor Android project (Gradle, keystore)
│   ├── dist/            ← Vite build output (copied into android assets)
│   ├── .env.user / .env.admin   ← Vite mode files (VITE_ADMIN_BUILD)
│   ├── package.json     ← includes @capacitor/* deps + build:user/build:admin
│   └── index.html
├── backend/             ← Flask API (JWT auth, resumes DB, AI stubs) — optional
├── .github/workflows/android-build.yml ← CI: builds APK artifact on push to main
├── netlify.toml         ← old static config pointing at frontend/dist
├── docker-compose.yml   ← frontend+backend+postgres
├── user.apk, admin.apk  ← signed release artifacts (gitignored)
└── WEB_VERSION_AUDIT.md ← this file (new)
```

## 3. FRAMEWORK & TECHNOLOGY (determined by inspection, not assumed)

| Layer | Finding |
|---|---|
| Frontend framework | **React 18 + Vite 5**, plain JSX (esbuild transform, no plugin-react), single-page state-based routing (no react-router) |
| Styling | One plain CSS file (`styles.css`, 11 KB) with CSS variables, responsive breakpoints at 1024/768/380 px and existing `@media print` rules |
| Android | **Capacitor 8** wrapper around the SAME frontend (`npx cap copy` → `android/app/src/main/assets/public`), Gradle release build, signed with `keystore.jks` (alias `resume_key`) |
| Build variants | `vite build --mode user|admin` → `.env.user`/`.env.admin` set `VITE_ADMIN_BUILD`; user build compiles out Admin/Login |
| PDF export | **Client-side jsPDF** (`pdfBuilder.js`) — real selectable text, multi-page, A4. Pure browser API except the native file-save branch |
| Live preview | `Preview.jsx` renders via shared `resumeLayout.js` (same layout engine used by the PDF builder → preview ≈ PDF) |
| Import | **Fully client-side**: `pdfjs-dist` (local bundled worker, offline), `mammoth` (DOCX), plain text (TXT) in `resumeImport.js` + `ImportResume.jsx` |
| Storage | `localStorage` only: `nitinnova_resume_profiles` (profiles), `resume_builder_draft` (autosaved draft), flags (`token`, `is_admin`, …) |
| Backend (optional) | Flask on `:5000` — JWT auth, `/my/resumes` cloud storage, `/generate-resume` AI polish, `/feedback`, `/developer`, `/api/admin-settings`. **Every call is wrapped in try/catch with a local fallback** (app degrades to offline mode) |
| AI | `localAI.js` — 100 % local (skills organizing, bullet polish, cover letter). Optional online AI only through the backend |
| External requests | `styles.css` line 1 imports **Google Fonts** (Inter/Outfit/Roboto) — only third-party request in the app. No analytics/trackers |

### Capacitor-only touchpoints (must be replaced for web)

| File | Usage | Web replacement |
|---|---|---|
| `App.jsx` | `@capacitor/app` backButton, `@capacitor/toast` Toast, `@capacitor/share` Share | hash-router back/forward, in-app toast (existing `status-msg` style), Web Share API + clipboard fallback |
| `pdfBuilder.js` | `Capacitor.isNativePlatform()`, `Filesystem`, `Toast` | browser-only: `doc.save(filename)` (jsPDF blob + anchor download) |

Everything else (`Form`, `Preview`, `Dashboard`, `ImportResume`, `TemplateSelector`,
`CoverLetter`, `Feedback`, `Developer`, layout/normalize/import/localAI modules)
is already browser-compatible JavaScript.

## 4. RESUME DATA MODEL (shared with APK, re-used conceptually)

```js
profile = {
  id, name, headline, location, email, phone,
  summary, education, skills, projects,          // textarea fields
  skillGroups: [{ id, category, items: [..] }],  // categorized skills
  sections:    [{ id, title, content }],         // custom sections
  photo (dataURL), photoShape, bgColor,
  socialGithub, socialLinkedin, socialPortfolio,
  template, templateMode ('online'|'offline'),
  fontFamily, fontSizePreset, margins,
  savedAt
}
draft = { form, template, templateMode, fontFamily, fontSizePreset, margins }
```

Rendered sections: header (name/headline/contact) → Professional Summary →
Technical Skills → Projects/Experience → Education → custom sections
(Certifications, Achievements, Languages, … from import).

## 5. FEATURE PARITY MATRIX

| Feature (APK) | Web status | Notes |
|---|---|---|
| Editor (all sections, add/delete/reorder) | ✅ re-used | personal, skills groups, projects, custom sections w/ up-down reorder |
| Live preview | ✅ re-used | same `resumeLayout` engine as PDF |
| Templates (online/offline, fonts, size, margins, accent, photo) | ✅ re-used | `TemplateSelector` |
| PDF download | ✅ adapted | browser `doc.save()` + safe filename; **no Android filesystem APIs** |
| Import PDF/DOCX/TXT | ✅ re-used | native browser file picker, local pdf worker (offline), Android-specific fallbacks kept (harmless) |
| Local profiles (multi-resume) | ✅ **moved to IndexedDB** | web-specific `storage.js` (see §7) |
| Autosave draft | ✅ **moved to IndexedDB** + visible autosave status | was silent localStorage |
| Cover letter (offline + optional online) | ✅ re-used | offline fallback built in |
| Feedback / Developer pages | ✅ re-used | need backend to *send*; graceful offline message added |
| Cloud resumes, Admin panel, Admin login, invites | ⛔ **excluded from default web build** | gated by `VITE_ADMIN_BUILD` exactly like the user APK; backend is optional and admin is an operator tool, not a public web feature. A self-hosted admin web build remains possible via `.env` (`VITE_ADMIN_BUILD=true`) without any code change |
| Share button | ✅ adapted | Web Share API → clipboard fallback |

## 6. WHAT CAN RUN IN A BROWSER (answer)

Everything except: native silent-file-write (replaced by browser download),
Android back button (replaced by browser history), and backend-dependent
actions (cloud sync, server AI polish, feedback delivery) — those degrade to
offline fallbacks exactly as the APK already does when offline.

## 7. IMPLEMENTATION PLAN (web/ — isolated copy + web-specific additions)

**Reuse strategy:** `frontend/src` is **copied** to `web/src`, then adapted.
The Android source is never edited. Duplication is deliberate and documented:

| File | Relation to `frontend/src` | Why |
|---|---|---|
| `resumeImport.js`, `resumeNormalize.js`, `resumeLayout.js`, `localAI.js`, `templateData.js` | **verbatim copy** | pure logic, no native code |
| `TemplateSelector.jsx`, `Preview.jsx`, `ImportResume.jsx` | **verbatim copy** | browser-only already |
| `pdfBuilder.js` | copy **minus Capacitor import** | native save branch removed |
| `App.jsx` | copy + web routing/share/toast/settings page | Capacitor listeners removed |
| `Form.jsx`, `Dashboard.jsx` | copy + **IndexedDB storage layer**, autosave status, completeness badges | web storage requirement |
| `api.js` | copy + offline stub when no `VITE_API_URL` | avoid pointless/failed calls on static hosting |
| `storage.js`, `backup.js`, `atsCheck.js` | **new (web-only)** | IndexedDB, backup/restore, ATS checklist |
| `Welcome.jsx`, `Settings.jsx`, `AtsChecklist.jsx`, `VersionHistory.jsx` | **new (web-only)** | home screen, settings & privacy, extras |
| `Auth.jsx`, `AdminPanel.jsx` | verbatim copy (dead code unless admin env) | keeps env-gated parity |

**Known duplication limitation:** bug fixes made in `frontend/src` must be
mirrored into `web/src` manually (and vice-versa). This is the price of a hard
isolation guarantee; tracked here per file (§ above).

### Web extras (priority order, after core works)
1. Autosave + recovery status (IndexedDB)
2. Resume version history (last 10 saves per profile, restore)
3. Backup / restore (JSON export-import of all local data)
4. ATS readiness checklist (pure analysis, never invents content)
5. Home/Welcome screen with quick actions + template gallery
6. Settings & privacy page (storage usage, clear data, shortcuts, backend status)
7. Section completeness indicators (form tab badges)
8. Print-friendly view (existing print CSS + Print button)
9. Keyboard shortcuts (Ctrl+S save, Ctrl+D PDF, Ctrl+P print, Esc close)
10. Online AI assistance — **only when a backend is configured** (`VITE_API_URL`); local polish always available

### Storage & privacy decisions (web)
* **IndexedDB** (`nitinnova-web` DB, `kv` store) for structured data: profiles,
  draft, versions, settings — avoids the 5 MB localStorage ceiling (photos are
  dataURLs and can be large). Small boolean flags stay in localStorage.
* One-time migration copies any legacy localStorage keys into IndexedDB on first run.
* Autosave: debounced 500 ms + flush on `pagehide` (refresh recovery).
* No automatic upload of any resume; all data stays on device unless the user
  explicitly clicks an online-AI/feedback action **and** a backend is configured.
* Backup file contains personal data → user downloads it explicitly; import
  requires file picker + confirmation.

### Security review findings
* No `dangerouslySetInnerHTML` / `innerHTML` / `eval` anywhere → XSS surface is
  React-escaped text only.
* Imported links: `extractLinks` validates scheme (`http(s)`), rendered `href`
  values are protocol-checked by existing code (audit before ship: re-verify).
* No resume data is placed in URLs (state-based routing only; hash contains
  route names exclusively).
* No API keys in client code (AI key lives in backend env only).
* No third-party analytics; only Google Fonts CSS (documented in Settings page).
* New: HTTPS-only assumption documented for deployment (cookies/API), CSP meta
  evaluated during implementation.

## 8. DEPLOYMENT TARGETS EVALUATED

| Target | Fit | Why |
|---|---|---|
| **Vercel** | ✅ recommended | static, free tier, SPA rewrites, `base: './'` works as-is |
| **GitHub Pages** | ✅ also works | fully static, relative base + `404.html` SPA fallback; CI workflow provided |
| Netlify | possible | existing `netlify.toml` points at `frontend/` → **left untouched**; web version gets its own config inside `web/` |
| Backend hosting | optional | separate (Render/Railway/any WSGI). Web works fully without it |

## 9. RISKS & MITIGATIONS

| Risk | Mitigation |
|---|---|
| Accidentally touching `frontend/` | all commands scoped to `web/`; final `git status` + hash verification |
| IndexedDB migration breaks draft/profiles | fallback chain IDB → localStorage; migration tested in browser |
| Relative `base: './'` breaks `?url` pdf worker | production-build PDF import tested explicitly |
| SPA deep-link 404 on static hosts | `404.html` (Pages) + `vercel.json` rewrite |
| CI workflow rebuilds APK on push | pre-existing repo behavior (artifact upload only); local APKs and sources untouched — documented, workflow NOT modified |

## 10. PLAN STATUS

- [x] Inspect repository, framework, features, storage, backend
- [x] Record APK baseline hashes
- [x] Scaffold isolated `web/`
- [x] Copy + adapt source (Capacitor → web APIs, IndexedDB storage)
- [x] New web pages (Welcome, Settings, ATS, Version history)
- [x] Production build + iterative browser testing until green (48/48 cases, Lighthouse 100/100/100 — see `WEB_VERSION_TEST_REPORT.md`)
- [x] Docs: SETUP + TEST_REPORT
- [x] Deployment prep (`vercel.json`, `404.html`, `web-pages.yml` committed; live deploy needs hosting credentials — not available from this machine)
- [x] Final APK hash re-verification + Android-untouched confirmation (both hashes identical to baseline; `frontend/` diff empty)
