# WEB_VERSION_SETUP — Run, Build & Deploy the Web Version

> The web version lives entirely in **`web/`** — its own `package.json`,
> `node_modules/`, `dist/` and config. It never touches `frontend/` (Android
> source), the APKs, or any Android build output. It can be developed, built and
> deployed independently of the app.

---

## 1. REQUIREMENTS

* Node.js 18+ (20 LTS recommended)
* npm 9+ (lockfile included)
* A modern browser (Chromium, Firefox, Safari — current versions)

No backend, database, API keys or environment secrets are required. The app is
fully functional offline out of the box.

## 2. QUICK START

```powershell
cd web
npm ci            # install (or: npm install)
npm run dev       # dev server → http://localhost:5174
```

Production build + local preview (what the test report was executed against):

```powershell
npm run build     # → web/dist  (base './', works on any host/sub-path)
npm run preview   # → http://localhost:4174  (strictPort)
```

## 3. SCRIPTS

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on **:5174** (HMR) |
| `npm run build` | Production build into `web/dist` |
| `npm run preview` | Serve `web/dist` on **:4174** (strictPort) |

## 4. ENVIRONMENT VARIABLES

`web/.env` (committed — contains no secrets):

| Variable | Value | Meaning |
|---|---|---|
| `VITE_API_URL` | *(unset)* | Backend base URL. **Unset = offline mode**: `api.js` rejects instantly with `NO_BACKEND` and every caller falls back to local behavior (local AI, offline feedback, offline cover letter). |

> **Round 2 change:** `VITE_ADMIN_BUILD` no longer exists. Accounts are
> device-local (`web/src/auth.js`) — the owner signs in through the normal
> login form and the Admin Panel appears for that session only. No admin UI,
> strings or credentials exist in the bundle for anyone else.

To optionally connect a backend later, add one line — no code changes needed:

```env
VITE_API_URL=https://your-backend.example.com
```

(Any Flask/API server exposing the same routes the APK uses works; online
features then activate, everything else is unchanged.)

## 5. HOW DATA IS STORED (privacy model)

| Data | Where | Notes |
|---|---|---|
| Accounts (email, name, PBKDF2 salt+hash, role) | `localStorage` (`nn_users`) | device-local, created by Sign up; owner account verified against digests in `web/src/auth.js` |
| Session (who is signed in) | `localStorage` (`nn_session`) | cleared by Log out |
| Resume profiles, draft, version history, settings | **IndexedDB** (`nitinnova-web` DB, `kv` store) with automatic **localStorage fallback** | created/updated/debounced by `web/src/storage.js`; profiles are owner-stamped (`owner` field), drafts keyed per account (`draft:<email>`) |
| Small flags (session profile id, UI flags) | `localStorage` (tiny keys, synchronous reads) | sync-by-design so saves can't race |
| Legacy keys from older runs | migrated once into IndexedDB, then removed | |
| Feedback submissions (offline) | `localStorage` | shown on the Feedback page; cleared by *Delete all app data* |

* **Nothing is ever uploaded.** No resume content leaves the browser unless a
  backend is explicitly configured *and* the user clicks an online action.
* Autosave: draft writes are debounced 500 ms and flushed on `pagehide`
  (tab close/navigation), so content survives crashes and closes.
* Backups: Settings → *Export backup* downloads a JSON containing all local
  data (profiles + draft + versions). *Import backup* offers **Merge** (OK) or
  **Replace** (Cancel) and validates the file before writing anything.

## 6. ISOLATION GUARANTEES (Android protection)

* Everything web-related is inside `web/`; the only other new files are the
  three `WEB_VERSION_*.md` docs and `.github/workflows/web-pages.yml`.
* `web/node_modules/` and `web/dist/` are already covered by the repository's
  existing `.gitignore` patterns (`node_modules`, `dist` — pattern matches at
  any depth, verified with `git check-ignore`).
* No frontend build command (`npm run build` in `frontend/`, `cap copy`,
  `gradlew`) is ever needed for the web version; the existing
  `android-build.yml` workflow was **not modified**.
* The web build duplicates (not imports) the component sources — a deliberate
  copy so Android and web can evolve independently. Trade-off is documented in
  `WEB_VERSION_AUDIT.md` §7.

## 7. DEPLOYMENT

The app uses **hash routing** (`/#/dashboard`) + relative asset base
(`base: './'`), so it works on any static host, at the root **or** a sub-path,
with no server-side routing rules required.

### Option A — Vercel (recommended)

1. Import the Git repo → set **Root Directory = `web`**, framework preset
   **Vite** (defaults come from the committed `web/vercel.json`:
   build `npm run build`, output `dist`).
2. Deploy. `vercel.json` adds an SPA rewrite (deep paths serve `index.html`,
   which rewrites them to hash routes) and cache headers
   (immutable `/assets/*`, `no-cache` `index.html`).

### Option B — GitHub Pages

1. Repo **Settings → Pages → Source: GitHub Actions**.
2. **Actions → "Deploy Web to GitHub Pages" → Run workflow** (the workflow is
   manual-trigger on purpose, so no failed runs appear before Pages is enabled;
   add a `push: paths: [web/**]` trigger later if you want auto-deploy).
3. Result: `https://<user>.github.io/<repo>/`. Deep links are handled by the
   committed `web/public/404.html` (converts `/settings` → `index.html#/settings`).

The Pages workflow is **manual-trigger only**, so it runs solely when invoked
and never overlaps with `android-build.yml` (which still builds the APK artifact
on push — pre-existing repo behavior, left untouched).

### Option C — any static host (Netlify, Cloudflare Pages, S3, nginx…)

Upload `web/dist` as-is. Deep paths are optional (hash routes always work);
for pretty paths point all 404s at `index.html` the same way Vercel does.

> **Live deployment is intentionally not performed from this machine** — no
> hosting credentials are available/authorized here. Both paths above are
> one-click once the repo is pushed; the configs are committed and verified
> locally (`npm run build` + `npm run preview` + deep-link/404 tests).

## 8. OPTIONAL BACKEND

```powershell
cd backend        # existing Flask API (untouched by this task)
pip install -r requirements.txt
python app.py     # → http://localhost:5000
```

Then set `VITE_API_URL=http://localhost:5000` in `web/.env` and restart the dev
server. The web app auto-detects the backend and shows *Online* instead of
*Offline mode* on Settings. Without it, everything remains fully functional
offline (that is the tested configuration).

## 9. PROJECT STRUCTURE (web only)

```
web/
├── .env                 VITE_API_URL optional (offline by default)
├── index.html           meta/OG tags, favicon, deep-path → hash bootstrap
├── package.json         react, jspdf, mammoth, pdfjs-dist, axios, vite (no Capacitor)
├── vite.config.js       base './', dev :5174, preview :4174 strictPort
├── vercel.json          SPA rewrite + cache headers + build settings
├── public/
│   ├── favicon.svg
│   ├── robots.txt       allow-all (Lighthouse SEO)
│   ├── user.apk         Android app served by the "Get the Android app" button
│   └── 404.html         GitHub Pages deep-link fallback
└── src/
    ├── App.jsx          hash routing, login gate, sidebar, toasts, share
    ├── auth.js          device-local accounts (PBKDF2), owner digests only
    ├── aiBuilder.js     FREE offline AI resume drafter (no API, no invented facts)
    ├── storage.js       IndexedDB + localStorage fallback, owner-scoped, autosave, versions, backup
    ├── api.js           backend client with fast NO_BACKEND rejection
    ├── pdfBuilder.js    Capacitor-free jsPDF export (doc.save())
    ├── resumeImport.js  PDF/DOCX/TXT parsing (pdfjs local worker + mammoth)
    ├── atsCheck.js      ATS checklist logic (pure analysis, never invents content)
    ├── styles.css       APK styles + web-only additions (modals, welcome, print fixes)
    └── components/
        ├── Welcome.jsx, Settings.jsx, AtsChecklist.jsx, VersionHistory.jsx   (new, web-only)
        ├── Auth.jsx     Sign up / Log in (neutral; no admin surface anywhere)
        ├── Form.jsx, Dashboard.jsx, Preview.jsx, TemplateSelector.jsx        (adapted)
        └── ImportResume.jsx, CoverLetter.jsx, Feedback.jsx, Developer.jsx     (adapted)
```

**Owner (admin) access:** sign in through the normal login form with the
owner email + passcode (PBKDF2 digest of both is embedded in the bundle —
the passcode itself is never stored in the repo; the owner keeps it
out-of-band). The *Admin Panel* nav item appears for that session only.

## 10. TROUBLESHOOTING

| Symptom | Fix |
|---|---|
| Port already in use | dev/preview ports are fixed (`5174`/`4174`); stop the other server or change the port in `vite.config.js` |
| PDF import worker error | never load `dist/index.html` via `file://` — serve it (`npm run preview` or a host); worker is bundled relatively and verified on the production build |
| Data “disappeared” | check Settings → storage usage; *Export backup* regularly; *Import backup* (Merge) restores |
| Fonts not loading offline | app works regardless — Google Fonts are the only external request and fall back to system fonts |
| "Log in required" but I have no account | accounts are free and device-local — click **Sign up** (name, email, password). A new browser/device needs its own account |
| Owner login not unlocking Admin Panel | use the owner email + the passcode given out-of-band; wrong credentials show a neutral error by design |
| "An account with this email already exists" on Sign up | that email is reserved/registered on this device — use **Log in** instead |
