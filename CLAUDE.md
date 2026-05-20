# facer

Offline face & gender recognition that runs entirely in your browser.

- Subdomain: `facer.freeappstore.online`
- Dev: `pnpm install && pnpm dev`
- Build: `pnpm build`
- Deploy: `git push origin main` (auto-deploys via Cloudflare Pages)

Free, MIT-licensed, no tracking. For platform conventions, read
https://raw.githubusercontent.com/freeappstore-online/freeappstore/main/SKILLS.md
before writing or changing anything.

---

## App-specific notes

- Inference uses face-api.js (TinyFaceDetector + age/gender net) loaded as a global script from `/vendor/face-api.min.js`. Models live under `/models/`, served by Vite from `web/public/`.
- Model shard files have no extension, so `vite.config.ts` extends `globPatterns` with `'models/*'` to keep them in the PWA precache. If you add more model files, make sure they match the precache pattern or cold-start offline will fail.
- `web/src/lib/dragdrop.ts` listens on `window` so users can drop anywhere. It always `preventDefault`s on `dragover` (required for `drop` to fire) and uses an enter/leave counter for state. `extractFile` tries `dataTransfer.items` first, then `.files`, for macOS Photos / cross-app compatibility.
- Webcam mode runs detection at `inputSize: 320` (vs. `416` for stills) on `requestAnimationFrame` for live performance.
