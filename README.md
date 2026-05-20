# facer

Offline face & gender recognition that runs entirely in your browser. Drop a photo (or start your webcam), faces get boxed, gender + approximate age are estimated locally via [face-api.js](https://github.com/justadudewhohacks/face-api.js). No upload, no tracking, no backend.

- Subdomain: `facer.freeappstore.online`
- Dev: `pnpm install && pnpm dev`
- Build: `pnpm build`

## How it works

- TinyFaceDetector + age/gender net from face-api.js, loaded from `/models/` at startup (~625 KB).
- Inference runs via TensorFlow.js in the browser. Images and webcam frames never leave the device.
- PWA: model shard files are precached by the service worker so the app works fully offline after first load.

## Layout

```
web/
├── index.html                 — loads face-api.js (global), Manrope/Fraunces, manifest
├── public/
│   ├── models/                — TinyFaceDetector + age/gender weights
│   └── vendor/face-api.min.js — MIT-licensed lib
├── src/
│   ├── App.tsx                — UI: upload / drop / paste / webcam, live status, results
│   ├── components/Shell.tsx   — FAS sidebar + mobile dock layout
│   ├── lib/
│   │   ├── dragdrop.ts        — window-level drop handling (counter-based, items API fallback)
│   │   ├── loader.ts          — File → <img> promise
│   │   └── detector.ts        — face-api wrapper + canvas drawing
│   └── index.css              — brand tokens (--paper, --ink, --accent, …)
└── vite.config.ts             — PWA with model shards included in precache
```

## License

MIT — see [LICENSE](./LICENSE). face-api.js weights are MIT-licensed; see upstream.
