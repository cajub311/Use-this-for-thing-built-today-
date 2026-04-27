# Stillness — botanical journal

Single-page PWA: open `index.html` or deploy the repo root to Vercel. The app stores journal data in **this browser** (`localStorage`); use **Memory → Download backup** to keep a JSON file.

## Do not roll back the HTML

**Older “3-tab” snippets** (only Today / Garden / Library, no `view-log` or `view-memory`) will **remove** evening check-in, session sheet, log search, retention, and backup tools. The live `index.html` in this repo is the full app—merge new CSS/markup in small pieces instead of pasting a full file replace.

## Files

- `index.html` — app (styles + markup + script inline)
- `manifest.json` — install / PWA
- `icon.svg` — favicon and manifest icon
- `sw.js` — light offline shell
- `vercel.json` — security headers, SW cache control

## Deploy

Connect the repo to Vercel, production branch `main`, output **static** (no build command).
