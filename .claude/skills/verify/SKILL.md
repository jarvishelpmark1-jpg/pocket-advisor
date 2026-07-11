---
name: verify
description: How to launch and drive Pocket Advisor end-to-end to verify a change works in the real app (headless Chrome + Playwright against the Vite dev server).
---

# Verifying Pocket Advisor changes

Local-first React PWA (Vite + Dexie/IndexedDB). No backend needed for core flows.

## Launch

```bash
npm run dev   # serves http://localhost:5173/pocket-advisor/  (note the base path)
```

## Drive (headless Chrome via Playwright)

Playwright is NOT a project dependency — install it in the session scratchpad
(`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright`) and launch with
`chromium.launch({ headless: true, channel: 'chrome' })` (system Google Chrome;
the ms-playwright browser cache is usually version-mismatched).

Use a phone viewport — this app is used on a phone: `{ width: 390, height: 844 }`.

## Gotchas

- **First-run onboarding gates the router.** Skip it before the app boots:
  ```js
  await page.addInitScript(() => {
    localStorage.setItem('pocket-advisor-settings', JSON.stringify({ hasCompletedOnboarding: true }))
  })
  ```
- Routes: `/upload`, `/review`, `/analytics`, `/transactions`, `/settings` (all under the `/pocket-advisor` base).
- Upload flow: `input[type="file"]` inside the DropZone accepts multiple files via `setInputFiles([...])`. Test statements live in `test-data/`.
- **Always check IndexedDB, not just the UI** — read the `PocketAdvisor` DB in `page.evaluate` and compare row counts to what the UI reported. StrictMode double-effects have previously double-imported rows while the UI looked correct.
- Data is per-origin; a fresh browser context = fresh app. To reset within a session use the "Start Fresh" button on /upload.
