# 📱 APK Generation Guide — Resume Builder

This guide explains every step to convert your React app into an Android APK using Capacitor.

---

## ✅ What You Have

- **App**: A fully offline-capable Resume Builder using React + Vite + Capacitor
- **APK Location**: `E:\web related projects\resume bulder\ResumeBuilder.apk` (**4.26 MB**)
- **Offline PDF**: Generated entirely client-side using `jsPDF` — no backend needed!

---

## 🛠️ Prerequisites

| Tool | Version | Location |
|------|---------|----------|
| Node.js + npm | any recent | already installed |
| JDK 21 (Temurin) | 21.0.6+7 | `android-tooling/jdk21/jdk-21.0.6+7` |
| Android SDK | any | `C:\Android\sdk` |
| Capacitor CLI | included in project | `frontend/node_modules` |

> ⚠️ **Important**: JDK 21 is required. JDK 17 causes `invalid source release: 21` error. JDK 25 (system default) causes `ZoneInfoFile` crashes in Gradle.

---

## 🚀 Step-by-Step Build Commands

Run all commands from your project root: `E:\web related projects\resume bulder`

### Step 1 — Build the Frontend
```powershell
cd "E:\web related projects\resume bulder\frontend"
npm run build
```
This creates the optimized production bundle in `frontend/dist/`.

---

### Step 2 — Sync Web Assets to Android
```powershell
npx cap sync android
```
This copies `dist/` into `frontend/android/app/src/main/assets/public/`.

---

### Step 3 — Build the APK
```powershell
cd "E:\web related projects\resume bulder\frontend\android"
$env:JAVA_HOME="E:\web related projects\resume bulder\android-tooling\jdk21\jdk-21.0.6+7"
.\gradlew assembleDebug
```

Wait for: **`BUILD SUCCESSFUL`** (~2–5 minutes on first run, faster after that).

---

### Step 4 — Find Your APK
```
frontend\android\app\build\outputs\apk\debug\app-debug.apk
```

Or copy it to the project root for convenience:
```powershell
Copy-Item "frontend\android\app\build\outputs\apk\debug\app-debug.apk" "ResumeBuilder.apk"
```

---

## 📲 Installing on Your Android Device

**Option A: USB Transfer**
1. Connect your Android phone via USB
2. Enable **File Transfer** mode on the phone
3. Copy `ResumeBuilder.apk` to your phone
4. Open it from your file manager and tap **Install**
5. Allow installation from unknown sources if prompted

**Option B: ADB (Developer Mode)**
```powershell
# Enable USB Debugging on phone first
adb install "ResumeBuilder.apk"
```

**Option C: Share via WhatsApp/Google Drive**
Just share the `.apk` file like any attachment and open it on the phone.

---

## 🔄 Rebuild When You Make Code Changes

Every time you change your React code:
```powershell
# 1. Rebuild frontend
cd "E:\web related projects\resume bulder\frontend"
npm run build

# 2. Sync to Android
npx cap sync android

# 3. Rebuild APK
cd android
$env:JAVA_HOME="E:\web related projects\resume bulder\android-tooling\jdk21\jdk-21.0.6+7"
.\gradlew assembleDebug
```

---

## 🌐 Offline Mode

The app is **100% offline capable**:
- PDF generation uses `jsPDF` (runs in browser/WebView, no server needed)
- No network calls are made for resume creation or PDF download
- Only the optional "Generate Online" AI feature requires internet

---

## ❓ Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `invalid source release: 21` | Wrong JDK version (e.g. JDK 17) | Use JDK 21 as shown above |
| `ZoneInfoFile` crash | JDK 25 or corrupt JDK extract | Use JDK 21 from `android-tooling/jdk21` |
| `SDK location not found` | Wrong `sdk.dir` in `local.properties` | Set it to `C\:\\Android\\sdk` |
| `BUILD FAILED` first time | Missing SDK components | Gradle auto-downloads them; wait and retry |
