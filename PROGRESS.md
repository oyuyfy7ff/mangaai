# Progress
Read SKILL.md first, then this file.

## Scope
App: Manga AI. Helps write and translate manga (translation target: Thai). Stack: Capacitor.
App id: com.example.mangaai
Platforms: Android (iOS: no)
Look: hue 285 (violet), sat 1, soft, follows the phone mode (light and dark)
Screens: Write, Story, Panels, Translate, Settings
Not in scope: fetching manga pages by title (needs copyrighted pages from unauthorized sites, and the app has no search server). The user attaches an image or takes a screenshot, and the AI translates over it.
Build order: 5, 1, 2, 3, 4 (features 1 and 2 need the key from 5).
Features and "Done when":
1. Write: pick the role Editor, send a draft, and a critique comes back. Pick the role Screenwriter, send the same text, and a storyline comes back.
2. Story: add the character "Ren", close the app and open it again, Ren is still there, and an AI answer uses the name Ren.
3. Panels: add a panel, pick an image from the device, add or generate dialogue, and the image and the dialogue show together and are still there after reopening the app.
4. Translate: pick a manga page image, tap translate, the original text is covered and Thai text is drawn over the original position.
5. Settings: paste an OpenRouter key and a model name, send a message, and a reply comes back.
Skeleton "Done when" (Phase 1 and 2, now replaced by Settings): the number goes from 0 to 1 after one tap. Confirmed by the user on 2026-10-12.

## Security
Backend: none. No accounts, no login, no Supabase. All data stays on the device.
Tables and buckets: none.
Secret: the user's own OpenRouter key and model name, typed by the user in Settings, stored on the phone only (localStorage inside the app). Never in the repo, never in the app files, never in PROGRESS.md. The key field is type=password, and the saved key is never shown again.
Network: Content Security Policy connect-src allows only 'self' and https://openrouter.ai. Never use *.
Images (Panels, Translate): stored on the device in IndexedDB, not localStorage (size limit).
Backup: android:allowBackup="false" is set by build.yml on every build.
Checks: scripts/check-security.sh, gitleaks (v8.30.1) and osv-scanner (v2.6.0) in security.yml, all non-blocking until Phase 4. The access test does not apply (no database).
Known risks: the Write draft, the characters and the Panels pictures and dialogue are kept on the phone (localStorage and IndexedDB), and the text, pictures and manga pages you use with the AI are sent to the model provider like every other text. A debug APK lets someone with the phone and a cable read the app's private data, including the saved key. Images and text are sent to the model provider (OpenRouter and the model behind it). Some free models may keep the data.

## Status
Phase: 3 (features). All five features are written. Version 1.3 (4) is pushed by features-1.3.0.sh and waits for its build and the user's phone test. APK 1.2 (3) built green on 2026-10-12 (run 38245034851); the user has not reported the result of testing Settings and Write on the phone yet.
Last run: 38245034851 - success (version 1.2 (3)). The run for 1.3 (4) is not checked yet.
Done: skeleton (confirmed). Written and tested in desktop Chromium with a mocked OpenRouter, not yet confirmed by the user: Settings, Write, Story, Panels, Translate.
Next: the user installs 1.3 (4) and tests each "Done when" line, starting with Settings (the key), then Write, Story, Panels, Translate. Then Phase 4 (fix and polish: icons, app icon, blocking checks).

## Handoff
Last worked by: Claude, 2026-10-13
Changed: www/story.js, www/panels.js, www/translate.js, www/media.js, www/ui.js (all new), www/index.html (Story, Panels, Translate screens, confirm sheet, five navigation items), www/nav.js (five screens), www/app.js (version line only), www/style.css (.stack, .panel-img, .canvas-view appended), android/app/build.gradle (versionCode 4, versionName 1.3), LESSONS.md, PROGRESS.md. settings.js and write.js are unchanged: the new files reuse their helpers and askModel, so the load order in index.html matters (settings, write, ui, media, story, panels, translate, nav).
How the features work: Story keeps characters in localStorage and sends the list as part of the system message, so answers use the names. Panels keeps each picture (scaled to 1280 px JPEG) and its dialogue in IndexedDB, saves dialogue 0.4 s after typing, and can ask the model for dialogue from the picture. Translate scales the page to 1280 px, asks the model for JSON [{box:[left,top,right,bottom] in 0..1000, text}], covers each box with the page colour sampled just outside it and draws the Thai text fitted to the box. The result is shown on screen only (no save button): take a screenshot to keep it.
Not tested: everything on a real phone: the real call to openrouter.ai (if the send fails with "ส่งไม่ได้" while the internet works, enable CapacitorHttp in capacitor.config.json), the file picker (gallery) in the app, IndexedDB inside the app, keyboard covering fields, safe-area insets, the five-item navigation on a small screen. Translate depends on the model: it must read pictures and return reasonably accurate boxes; free models often do not, so boxes can be off. Use the same model for the first test and write down which one worked.
Tested in desktop Chromium (390 px wide, light and dark) with a mocked OpenRouter, 56 checks for the new features and 33 for Write and Settings, repeated runs all green: navigation, characters (add, duplicate, delete with confirmation, survive reload, names reach the model), panels (add, reload, generate, delete, big picture scaled, non-image refused), translate (box parsing, invalid boxes dropped, cover colour, Thai text inside the box, run twice gives the same result, bad reply and errors, original restored), no horizontal scroll, no page errors.
recipes.md was still not attached: the model call is the one from settings.js, extended only by passing a list as the user message (text plus image_url) to the same request. Attach recipes.md before Phase 4 if the user wants movable pieces or a different chat.
The user asked for all remaining features at once (Golden rule 11): the one-feature-at-a-time loop was skipped. If one screen misbehaves, test it alone: each feature has its own file and screen.

## File tree (current)
- .github/workflows/build.yml: builds the debug APK (Capacitor template, plus the allowBackup step)
- .github/workflows/security.yml: pattern checks, gitleaks, osv-scanner (non-blocking)
- scripts/check-security.sh: pattern checks from security.md
- .gitignore: node_modules, keystores, build folders
- package.json: Capacitor 8 dependencies
- capacitor.config.json: app id and name
- android/: generated by the first build and committed by the workflow
- www/index.html: five screens (Write, Story, Panels, Translate, Settings), confirm sheet, bottom navigation, Content Security Policy, error box
- www/style.css: tokens, theme generator (hue 285), components, the .bubble rule (reply keeps line breaks), the .screen[hidden] rule, and .stack, .panel-img, .canvas-view
- www/app.js: the version line (APP_VERSION)
- www/nav.js: bottom navigation, five screens (SCREEN_TITLES, showScreen)
- www/ui.js: confirmSheet (dialog for deleting)
- www/media.js: picture helpers (scale to 1280 px JPEG, data URL) and the IndexedDB store for Panels
- www/story.js: Story feature (characters in localStorage, ask the AI with the names)
- www/panels.js: Panels feature (pictures and dialogue in IndexedDB, AI dialogue from the picture)
- www/translate.js: Translate feature (model returns boxes, canvas covers and draws Thai)
- www/write.js: Write feature (role tabs, draft, Editor critique, Screenwriter storyline); needs settings.js loaded first
- www/settings.js: Settings feature (storage, save, test message to OpenRouter)
- LESSONS.md: unexpected things and their fixes
- SKILL.md: copy of apk.md
- PROGRESS.md: this file

## Known bugs
- (none confirmed by the user yet)

## Known issues (not bugs in the app)
- security.yml: the osv-scanner step prints "No package sources found" (exit 128) because the repo has no package-lock.json. It is non-blocking now. Fix before Phase 4 (for example commit a package-lock.json), or the step will block the build.
- GitHub says ubuntu-latest moves to Ubuntu 26 from 2026-10-19. Watch the first build after that date; if it fails, pin the runner version.

## Versions
- App version: 1.3 (4). It lives in www/app.js (APP_VERSION) and in android/app/build.gradle (versionCode, versionName)
- Node 22, Java 21 (Temurin), Capacitor ^8.0.0
- actions/checkout@v6, actions/setup-java@v6, actions/setup-node@v7, actions/upload-artifact@v7
- gitleaks v8.30.1, osv-scanner v2.6.0
