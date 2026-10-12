# WEB_VERSION_TEST_REPORT — Browser Test Results

> Date: 2026-10-12 · Build under test: `web/` production build (`vite build` →
> `npm run preview`, `http://localhost:4174`, `strictPort`) · Tester: automated
> desktop-browser session driving the real UI (clicks, typing, file uploads,
> dialogs, downloads) against the **production bundle**, not the dev server.

---

## 1. SUMMARY

| Area | Result |
|---|---|
| Test cases executed | **48** (details in §3–§9; #34 code-reviewed rather than exercised with a synthetic 20 MB file) |
| Passed | **48** (47 driven in the browser, 1 code-reviewed) |
| Failed at end of testing | **0** (5 defects found *during* testing, all fixed and re-verified — §10) |
| Lighthouse (production build) | **Accessibility 100 · Best Practices 100 · SEO 100**, 0 failures |
| Console errors/warnings across all routes | **0 messages** |
| External network requests | Google Fonts CSS + font files only, plus `data:` URLs — **nothing else leaves the device** |

**Build tested** (final):

```
856 modules transformed, built in ~6 s
dist/index.html                        1.15 kB
dist/assets/index-*.css               17.67 kB  (gzip  4.37 kB)
dist/assets/index-*.js             1,165.10 kB  (gzip 366.87 kB)  ← app + react
dist/assets/index-*.js               304.33 kB  (gzip 98.54 kB)   ← jsPDF stack
dist/assets/index.es-*.js            150.83 kB  (gzip 51.60 kB)   ← mammoth (DOCX)
dist/assets/html2canvas.esm-*.js     201.42 kB  (gzip 48.03 kB)
dist/assets/purify.es-*.js            22.03 kB  (gzip  8.77 kB)
dist/assets/pdf.worker.min-*.mjs   1,264.34 kB           ← pdf.js worker, bundled locally
```

Environment: Chromium desktop, primary viewport 567×766 (mobile layout, sidebar
off-canvas) plus full-window checks; localStorage/IndexedDB inspected between
steps; `files.list`/`files.get` used to verify actual download bytes; dialogs
(`confirm`) explicitly accepted/dismissed per test case.

---

## 2. METHOD NOTES

* Every assertion reads the **real DOM or real files** — e.g. PDF page counts are
  parsed from the downloaded bytes (`/Count N`), backups are parsed with
  `JSON.parse`, import verbatim-text is compared against preview `innerText`.
* Reference-based clicks are re-snapshot before each use; route changes are also
  exercised through the visible sidebar/menu (mobile off-canvas flow: Toggle →
  wait for transition → tap).
* Downloads and uploads are performed through the browser's real download/file
  pipelines — no stubbed fetch/XHR anywhere in the app.

---

## 3. CORE FLOWS

| # | Test | Expected | Result |
|---|---|---|---|
| 1 | Cold load at `/` | Welcome page: hero, 6 feature cards, 6 template cards, no admin UI | ✅ pass |
| 2 | Hash routes `#/home #/dashboard #/cover-letter #/settings #/feedback #/developer #/welcome` | every route renders its page | ✅ pass (all 7) |
| 3 | Sidebar/nav navigation (mobile off-canvas Toggle → menu → tap) | opens editor/dashboard correctly | ✅ pass |
| 4 | Hash survives reload (`#/settings` → F5) | same route restored, no white screen | ✅ pass |
| 5 | Deep path `/dashboard` (SPA host fallback) | inline bootstrap rewrites to `#/dashboard`, Dashboard renders | ✅ pass |
| 6 | Fill editor fields | live preview updates **verbatim** (same keystrokes, no rewriting) | ✅ pass |
| 7 | Autosave | pill shows `✓ Saved [saved]` ~0.5 s after edits; pill shown only when dirty→saved | ✅ pass |
| 8 | Save button | toast/status `Saved locally.` + profile appears on dashboard | ✅ pass |
| 9 | Save → navigate away (`#/dashboard`) → return (`#/home`) | draft fully restored (name field preserved) | ✅ pass |
| 10 | Save again after navigation cycle | profile **updated in place — exactly 1 profile** (no duplicate) | ✅ pass (defect #1 fixed, §10) |
| 11 | Completeness badges | `Personal 6/6`, `Experience N`, `Sections N`, `!` when experience empty — update as fields fill | ✅ pass |
| 12 | Dashboard row actions | Edit / History / Duplicate / Delete all present and functional | ✅ pass |
| 13 | Delete profile | confirm dialog → profile removed | ✅ pass |
| 14 | `+ New Resume` | **confirm required**; OK → blank editor (`Personal 0/6`), preview shows default template | ✅ pass |
| 15 | Empty dashboard | `No saved profiles yet` + guidance text, Import/Backup still available | ✅ pass |

## 4. IMPORT (PDF / DOCX / TXT)

| # | Test | Expected | Result |
|---|---|---|---|
| 16 | **PDF import on the production build** (relative `pdf.worker` path) | parses without worker 404 | ✅ pass — review screen: Personal ✓, Summary ✓, Experience 1, Education ✓, Skills 5 |
| 17 | Import review screen | privacy notice, per-section counts, `Show extracted text (for debugging)` toggle, ✅/↩ actions | ✅ pass |
| 18 | PDF → open editor | name/headline/email/phone/summary populated; `Personal 6/6` | ✅ pass |
| 19 | PDF verbatim preservation | preview contains exact `(2020-2023)` date range, bullet text, education, skills | ✅ pass |
| 20 | **DOCX import** (mammoth, hand-built valid `.docx`) | parses; review shows counts; editor gets `Alice Johnson`, `Product Manager`, `alice@example.com`, Experience 1, Skills 4; preview `ALICE JOHNSON` + `(2018 - Present)` + `State University` + `Roadmapping` | ✅ pass |
| 21 | **TXT import** with `(2019 - Present)` date line | parsed verbatim, entry rendered under Acme Corp | ✅ pass |
| 22 | Import → profile auto-saved to dashboard | imported resumes listed (confirmed via backup export containing them) | ✅ pass |

## 5. EXPORT — PDF / PHOTO / TEMPLATES

| # | Test | Expected | Result |
|---|---|---|---|
| 23 | Download PDF | file saved, filename sanitized (`Nitin_Pratap_NitinNova_Resume.pdf`, spaces → `_`) | ✅ pass (many downloads, all valid) |
| 24 | **Multi-page pagination** (long content injected) | generated PDF has >1 page | ✅ pass — `/Count 2`, 2 page objects, 284,951 bytes |
| 25 | Photo upload (Design/Personal photo input) | data-URL image stored and rendered in preview for photo-showing templates | ✅ pass — 1 `data:image` `<img>` in `#resume-preview` (Photo Profile template) |
| 26 | Template switching | preview re-renders; ATS/creative badge flips (`ATS SAFE` → `CREATIVE` on Creative Gradient) | ✅ pass |
| 27 | Print (Ctrl+P / Print button) CSS | app chrome hidden, resume laid out flat, sections not split across pages | ✅ pass — 2 `@media print` blocks; hides `.sidebar/.form-panel/toast/modal`; `.resume-section { break-inside: avoid }` |

## 6. VERSION HISTORY · BACKUP · SETTINGS

| # | Test | Expected | Result |
|---|---|---|---|
| 28 | History modal | lists versions newest-first with `LATEST` tag, timestamps, field counts | ✅ pass — 2 versions shown |
| 29 | Restore oldest version | editor + preview revert to old content | ✅ pass (name returned to `Rahul Verma`, preview matched) |
| 30 | Export backup | download with warning status; valid JSON | ✅ pass — 11,426 B: `app=nitinnova-web-backup`, `version=1`, `exportedAt`, 3 profiles (full field sets), draft, versions map |
| 31 | Backup **REPLACE** import | delete profile → import → backup state restored (page auto-reloads) | ✅ pass — 2 → 3 profiles |
| 32 | Backup **MERGE** import | existing profiles kept + backup profiles added | ✅ pass — `[Bob]` + merge → `[Bob, Alice]` (2) |
| 33 | **Corrupt backup file** | graceful error, no data loss, no reload | ✅ pass — `Import failed: Not a valid JSON file.`, profiles untouched (2) |
| 34 | Backup size guard | files > 20 MB rejected with message | ✅ code-reviewed (not exercised with a 20 MB file) |
| 35 | Settings content | storage rows + usage in KB/MB, `Offline mode` backend status, privacy text, 5 shortcut rows, danger zone, backup buttons | ✅ pass |
| 36 | `Delete all app data` | **two confirms** required; afterwards IDB + localStorage fully empty (incl. session flag + feedback copies) | ✅ pass (defect #4 fixed, §10) — `Object.keys(localStorage) === []` |
| 37 | Usage/refresh | `Refresh usage` reports IndexedDB backend + byte estimate | ✅ pass |

## 7. EXTRAS (web-only features)

| # | Test | Expected | Result |
|---|---|---|---|
| 38 | ATS checklist modal | grade % + per-item pass/warn/info judgments **derived from actual data** (e.g. phone `warn` when absent, Education `warn` when missing) | ✅ pass — `50% low` on a deliberately partial resume; all 14 checks accurate |
| 39 | Esc closes dialogs | modal closes on Escape (as documented on Settings) | ✅ pass (defect #2 fixed, §10) |
| 40 | `Ctrl+S` save | status `Saved locally.` | ✅ pass |
| 41 | Auto-organize skills | `Skills organized into categories.`; skill groups created | ✅ pass |
| 42 | `+ Category` skill group | new group editor appears with `Category name` input | ✅ pass |
| 43 | Sections: add / reorder / remove | 2 → 3 cards; `Up` swaps order; `Remove` deletes (1 left) | ✅ pass |
| 44 | Cover Letter offline | `Offline Generate` produces real letter text (`Dear …`) with zero backend | ✅ pass; `Generate (AI)` rejects instantly and falls back offline as well |
| 45 | Feedback offline | submit stores on device: `Feedback saved on this device (no backend connected)…` | ✅ pass |
| 46 | Developer page | renders identity/GitHub links; **read-only** for non-admin (no editable inputs) | ✅ pass |
| 47 | Share | Web Share unavailable → clipboard → toast `Copy this page URL to share it.` | ✅ pass |
| 48 | Welcome page scope check | user-facing only — no admin/login surface in web build | ✅ pass |

## 8. QUALITY SWEEP

| Check | Result |
|---|---|
| Console across `#/welcome #/home #/dashboard #/cover-letter #/settings #/feedback #/developer` | **0 messages, 0 warnings, 0 errors** |
| Network requests | only `fonts.googleapis.com` + `fonts.gstatic.com` + `data:` URLs — **no API/analytics/telemetry endpoints**; app never calls a server when `VITE_API_URL` is unset |
| Resume data in URLs | never (hash carries route names only) |
| Lighthouse (prod, root URL) | **Accessibility 100 · Best Practices 100 · SEO 100**, `failures: []` |
| Print stylesheet audit | 2 print blocks; app chrome hidden; preview de-chromed; `break-inside: avoid` on resume sections |
| Repo isolation | `git status` shows only the three `WEB_VERSION_*.md` docs + `web/` + `.github/workflows/web-pages.yml` — **zero `frontend/` changes**; APK SHA-256 re-verified vs baseline (see §11); everything committed and pushed (`fab60c5`) |

## 9. SECURITY TESTS

| # | Test | Result |
|---|---|---|
| S1 | TXT import containing `<img src=x onerror=alert(1)>` | ✅ rendered as **literal text** in inputs/preview; no `<img>` element injected anywhere |
| S2 | TXT import containing `<script>alert(2)</script>` | ✅ literal text; no `<script>` element; no alert fired (console clean) |
| S3 | TXT import containing `<b>bold-skill</b>` | ✅ literal text; no bold element created |
| S4 | Import of unknown/extra content | preserved for review via `Show extracted text`; nothing dropped silently |
| S5 | Backup import validation | marker/version checked; corrupt JSON rejected (§6 #33); only whitelisted keys written |
| S6 | No API keys / secrets in client bundle | ✅ none (grep of source: keys live only in optional backend env) |

## 10. DEFECTS FOUND DURING TESTING — ALL FIXED & RE-VERIFIED

1. **Duplicate profile after navigate-away save** — `activeProfileId` lived only
   in React state; the debounced draft write raced the unmount/remount, so a
   second Save created a second profile. *Fix:* persist the id synchronously in
   `localStorage` (`nn_active_profile_id`) — sync reads can never race IndexedDB —
   and clear it on `+ New Resume` / profile delete. *Verified:* save → navigate
   away → back (draft restored) → save → **exactly 1 profile, updated name**.
2. **Esc didn't close modals** (Settings page documents the shortcut).
   *Fix:* Escape listeners in `AtsChecklist` + `VersionHistory`. *Verified:*
   open ATS → Escape → closed.
3. **Settings' backup file input was invisible to assistive tech** (`opacity: 0`
   removes it from the a11y tree; the import screen's input never had it).
   *Fix:* off-screen positioning only. *Verified:* input now exposed as
   `Choose File`; upload works via the label as well.
4. **`Delete all app data` left two keys behind** (`nn_active_profile_id`,
   `nitinnova_local_feedbacks`). *Fix:* included in `clearAllAppData`.
   *Verified:* after the two confirms, `localStorage` is completely empty.
5. **JSX unicode-escape text bugs** in new Welcome/Settings copy (escaped
   sequences rendered literally) — fixed during implementation before testing.

## 11. APK / ANDROID INTEGRITY (final re-verification)

| Artifact | Baseline SHA-256 (before work) | Final SHA-256 (after all work) | Match |
|---|---|---|---|
| `user.apk` | `5B806EC69F38A9735A8537599F85AB22C4F1FAC7B6C9816C322BCC2BD756FC2E` | `5B806EC69F38A9735A8537599F85AB22C4F1FAC7B6C9816C322BCC2BD756FC2E` | ✅ identical |
| `admin.apk` | `145C135BF44114FB9F866DEF1CE6CCCC1CE097CF6C8311460F9F0B1457E8B87D` | `145C135BF44114FB9F866DEF1CE6CCCC1CE097CF6C8311460F9F0B1457E8B87D` | ✅ identical |

Final `git status` shows only new files (`WEB_VERSION_*.md`, `web/`,
`.github/workflows/web-pages.yml`) — **zero changes under `frontend/`**
(`git status frontend/` and `git diff HEAD -- frontend/` both empty), and no
frontend/Android build command was ever executed.

## 12. KNOWN LIMITATIONS (honest scope)

* **Browser coverage:** automated runs were Chromium-only. The app uses widely
  supported APIs (IndexedDB, jsPDF, File APIs); Safari/Firefox smoke testing was
  not performed.
* **Lighthouse performance category:** this Lighthouse run audits accessibility,
  best practices and SEO only (the tool does not benchmark performance here).
  Bundle numbers are listed in §1; the 1.26 MB pdf.js worker loads only when a
  PDF is actually imported, and Google Fonts are the sole third-party request.
* **Phone parsing on odd formats:** TXT/DOCX phone extraction expects standard
  10-digit numbers (e.g. `555-0101` was not extracted). This is the shared APK
  parser behavior, not a web-specific regression; email/name/dates all parsed.
* **Backend/online features:** no backend was deployed, so online AI polish,
  cloud sync and admin endpoints were not exercised — every one of them rejects
  immediately (`NO_BACKEND`) and the tested fallbacks (local AI, offline
  feedback, offline cover letter) all work, which is the documented offline
  contract.
* **OCR:** scanned/image-only PDFs are not OCR'd (text-layer extraction only) —
  same as the APK.
* **Backup >20 MB guard** and quota-exhaustion messaging are code-verified but
  not exercised with synthetic 20 MB inputs.


---

# ROUND 2 - Accounts, Security Fixes & New Features (same browser, production build)

Round 2 followed the security review requested by the project owner:
(1) admin credentials were exposed on GitHub, (2) a resume-building account
should be required while exploration stays open, (3) only the owner can use
admin features and regular users must not even know admin exists, plus three
feature requests (Download-APK button, remove the APK-share text, free
offline AI that drafts a full resume).

## R2.1 ARCHITECTURE DECISION (chosen by owner: "everything free")

Device-local accounts (`web/src/auth.js`):
* Account required to OPEN the editor / dashboard / cover letter / settings.
  Welcome, template gallery, Feedback and Developer stay public.
* Accounts live only in this browser (localStorage `nn_users`); passwords are
  PBKDF2-SHA256, 310 000 iterations (WebCrypto). No server, no cost, offline.
* Resumes are owner-stamped (`owner` field, IndexedDB) - each account sees
  only its own resumes. Pre-account data is adopted by the first account that
  signs in on the device (claim-on-first-login, nobody loses old work).
* Owner (admin) account: the bundle ships ONLY `SHA-256(email)` +
  `PBKDF2(passcode)`, stored in the same shape as a normal user record -
  nothing in source or bundle reveals that an admin account exists. Signing
  up with the owner email is blocked with a neutral "email already exists".

## R2.2 SECURITY FIXES (all verified in the built bundle)

| # | Fix | Verification |
|---|-----|--------------|
| S1 | `frontend/src/Auth.jsx` offline-admin bypass removed (hard-coded email+password granted admin without any server) | source grep: 0 matches for `OFFLINE_ADMIN`/old password in `frontend/` and `web/` |
| S2 | Admin seed snippet with plaintext password removed from `README.md` (replaced with `create_admin.py` instructions + security notes) | README diff; git history purge performed afterwards (see R2.5) |
| S3 | Website owner login uses digests only - bundle scan for old credentials: **CLEAN**; scan for "Admin Access"/"Admin Login" strings: **0 matches** |
| S4 | Backend admin password rotated (old one was public on GitHub); new strong passcode set in `backend/resumes.db` (scrypt hash) | DB read-back shows new hash prefix |
| S5 | Phone placeholder in both Form.jsx copies changed from the real phone number (which was also the old password) to a generic example |
| S6 | Git history purge: password, admin email and seed snippet removed from ALL old commits + force-push (all commit IDs changed) | `git log -S` / `git grep` across rewritten history: 0 matches |

## R2.3 FEATURE TESTS - 15/15 PASS (production build, http://localhost:4174)

| # | Scenario | Result |
|---|----------|--------|
| 1 | Signed-out visit to `#/home` (deep link) redirects to `#/auth` | PASS - hash becomes `#/auth`, login form shown |
| 2 | Sign up (name/email/password) creates account, session set, user lands in editor; sidebar shows name chip + Log out | PASS |
| 3 | Regular user sees editor with new "AI Draft" tab; page text contains zero occurrences of "admin" | PASS |
| 4 | AI Draft: role+years+skills+highlights+education -> summary, headline, categorized skills, action-verb bullets built ONLY from input (no fabricated metrics/numbers) | PASS |
| 5 | Ctrl+S saves resume; profile is owner-stamped (`owner: testuser@example.com`) in IndexedDB | PASS |
| 6 | Log out: session cleared, private routes blocked; deep link `#/dashboard` while signed out redirects to auth | PASS |
| 7 | Log back in: redirected to pending route (dashboard); saved resume visible again | PASS |
| 8 | Owner email + WRONG password in the normal login -> neutral "Incorrect password. Please try again." (no admin hint) | PASS |
| 9 | Owner email + correct passcode in the SAME normal login -> admin session; "Admin Panel" nav appears | PASS |
| 10 | Admin Panel opens -> new **Accounts** tab lists device accounts with Delete | PASS |
| 11 | Sign up squatting the owner email -> blocked, neutral "email already exists" message | PASS |
| 12 | `/user.apk` download button target serves 200, 4 244 030 bytes | PASS |
| 13 | Second account created on the same device sees **0** profiles (first user's resume is private) | PASS |
| 14 | Session survives full page reload (chip + role restored from localStorage) | PASS |
| 15 | Owner deletes a device account: confirm dialog -> account removed from list + storage | PASS |

Additional checks: AI Draft empty-role validation shows inline error; Feedback
and Developer pages public and render for signed-out visitors; Settings shows
"Signed in as ..."; 0 application console errors across all flows (the only 2
console errors observed are Electron-harness internals, not app errors).

## R2.4 APK-SHARE TEXT + WELCOME PAGE

* `InviteFriend.jsx` (web + frontend copies): removed "Please share the parent
  .apk file..." from the share text - sharing now sends the website link only.
* Welcome page: hero button "Get the Android app" -> `./user.apk` (relative,
  works on any static host); privacy copy updated for the account model;
  feature card documents the free offline AI drafting.

## R2.5 OPERATIONS PERFORMED (owner-approved)

* Git history rewritten with `git filter-repo` (literals: old password,
  admin email, seed-snippet lines) + force-push. All commit IDs changed;
  docs that referenced old hashes were re-checked.
* Backend admin password rotated; new passcode communicated to the owner
  out-of-band (it is NOT stored anywhere in the repository).

## R2.6 LIMITATIONS (honest)

* Device-local accounts are per-browser: a different device/browser needs a
  new account (this is the "everything free, no server" trade-off chosen by
  the owner; a backend deployment can be added later - see SETUP 8).
* Deleting an account does not delete its resumes (documented in the UI) -
  they remain owner-stamped and inaccessible without that login.
* PBKDF2 at 310k iterations takes ~0.5-1 s per login on slow devices (by
  design; security over speed).
