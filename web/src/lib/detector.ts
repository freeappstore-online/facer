// Thin wrapper around face-api.js, loaded as a global from /vendor/face-api.min.js.

declare global {
  interface Window { faceapi: any; }
}

export interface Detection {
  detection: { box: { x: number; y: number; width: number; height: number } };
  age: number;
  gender: 'male' | 'female';
  genderProbability: number;
}

// Wait for window.faceapi to exist (the global is populated by /vendor/face-api.min.js).
// In production the <script> tag is sync and runs before the React bundle, but defensively
// poll for it AND inject the script if it never appears (handles extensions blocking
// the vendor path, service-worker stale state, slow networks, etc.).
async function ensureFaceApi(timeoutMs = 6000): Promise<any> {
  if (window.faceapi) return window.faceapi;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (window.faceapi) return window.faceapi;
    await new Promise((r) => setTimeout(r, 50));
  }

  // Fallback: inject the script ourselves.
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-faceapi-fallback]');
    if (existing) { existing.addEventListener('load', () => resolve()); existing.addEventListener('error', () => reject(new Error('vendor script failed to load'))); return; }
    const s = document.createElement('script');
    s.src = '/vendor/face-api.min.js';
    s.async = false;
    s.dataset.faceapiFallback = 'true';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to fetch /vendor/face-api.min.js — check that the file is reachable (an ad-blocker or extension may be blocking /vendor/ paths).'));
    document.head.appendChild(s);
  });

  if (!window.faceapi) throw new Error('face-api.js loaded but did not expose window.faceapi');
  return window.faceapi;
}

export async function loadModels(baseUri = '/models'): Promise<void> {
  const f = await ensureFaceApi();
  await f.nets.tinyFaceDetector.loadFromUri(baseUri);
  await f.nets.ageGenderNet.loadFromUri(baseUri);
}

export async function detect(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  { inputSize = 416, scoreThreshold = 0.5 }: { inputSize?: number; scoreThreshold?: number } = {},
): Promise<Detection[]> {
  const f = await ensureFaceApi();
  const opts = new f.TinyFaceDetectorOptions({ inputSize, scoreThreshold });
  return f.detectAllFaces(source, opts).withAgeAndGender();
}

export function drawBoxes(detections: Detection[], canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  detections.forEach((d) => {
    const { x, y, width, height } = d.detection.box;
    const color = d.gender === 'male' ? '#4c97b5' : '#d86f4d';
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, Math.round(canvas.width / 300));
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = color;
    const fontSize = Math.max(14, Math.round(canvas.width / 35));
    ctx.font = `600 ${fontSize}px Manrope, -apple-system, sans-serif`;
    const label = `${d.gender} ${(d.genderProbability * 100).toFixed(0)}%`;
    const tw = ctx.measureText(label).width + 12;
    const th = Math.max(18, Math.round(canvas.width / 26));
    ctx.fillRect(x, Math.max(0, y - th), tw, th);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 6, Math.max(th - 5, y - 5));
  });
}

export function sizeCanvasToSource(
  canvas: HTMLCanvasElement,
  source: HTMLImageElement | HTMLVideoElement,
): void {
  const w = (source as HTMLImageElement).naturalWidth || (source as HTMLVideoElement).videoWidth || source.clientWidth;
  const h = (source as HTMLImageElement).naturalHeight || (source as HTMLVideoElement).videoHeight || source.clientHeight;
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = source.clientWidth + 'px';
  canvas.style.height = source.clientHeight + 'px';
}
