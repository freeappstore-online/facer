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

export async function loadModels(baseUri = '/models'): Promise<void> {
  const f = window.faceapi;
  if (!f) throw new Error('face-api.js global not loaded');
  await f.nets.tinyFaceDetector.loadFromUri(baseUri);
  await f.nets.ageGenderNet.loadFromUri(baseUri);
}

export async function detect(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  { inputSize = 416, scoreThreshold = 0.5 }: { inputSize?: number; scoreThreshold?: number } = {},
): Promise<Detection[]> {
  const f = window.faceapi;
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
