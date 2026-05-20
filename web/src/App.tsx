import { useCallback, useEffect, useRef, useState } from 'react'
import { Shell } from './components/Shell.tsx'
import { installDragDrop } from './lib/dragdrop.ts'
import { loadFileIntoImage } from './lib/loader.ts'
import { loadModels, detect, drawBoxes, sizeCanvasToSource, type Detection } from './lib/detector.ts'

type Status =
  | { kind: 'loading-models' }
  | { kind: 'ready' }
  | { kind: 'loading-image'; name: string }
  | { kind: 'detecting' }
  | { kind: 'done'; count: number }
  | { kind: 'error'; message: string }

export default function App() {
  const [status, setStatus] = useState<Status>({ kind: 'loading-models' })
  const [detections, setDetections] = useState<Detection[]>([])
  const [hasMedia, setHasMedia] = useState(false)
  const [isWebcam, setIsWebcam] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const imgRef = useRef<HTMLImageElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const modelsReadyRef = useRef(false)
  const webcamStreamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadModels('/models')
        if (cancelled) return
        modelsReadyRef.current = true
        setStatus({ kind: 'ready' })
      } catch (e) {
        setStatus({ kind: 'error', message: (e as Error).message || 'Failed to load models' })
      }
    })()
    return () => { cancelled = true }
  }, [])

  const runDetection = useCallback(
    async (source: HTMLImageElement | HTMLVideoElement, inputSize = 416) => {
      if (!modelsReadyRef.current || !canvasRef.current) return
      setStatus({ kind: 'detecting' })
      try {
        sizeCanvasToSource(canvasRef.current, source)
        const results = await detect(source, { inputSize })
        if (!canvasRef.current) return
        drawBoxes(results, canvasRef.current)
        setDetections(results)
        setStatus({ kind: 'done', count: results.length })
      } catch (e) {
        setStatus({ kind: 'error', message: 'Detection failed: ' + ((e as Error).message || 'unknown') })
      }
    },
    [],
  )

  const stopWebcam = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((t) => t.stop())
      webcamStreamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setIsWebcam(false)
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      stopWebcam()
      setStatus({ kind: 'loading-image', name: file.name || 'image' })
      setDetections([])
      if (!imgRef.current) return
      try {
        await loadFileIntoImage(file, imgRef.current)
      } catch (e) {
        setStatus({ kind: 'error', message: (e as Error).message })
        return
      }
      setHasMedia(true)
      requestAnimationFrame(() => {
        if (imgRef.current) void runDetection(imgRef.current, 416)
      })
    },
    [runDetection, stopWebcam],
  )

  const videoLoop = useCallback(async () => {
    const v = videoRef.current
    const c = canvasRef.current
    if (!v || !c || !modelsReadyRef.current || v.paused || v.ended) return
    if (!v.videoWidth) {
      rafRef.current = requestAnimationFrame(videoLoop)
      return
    }
    sizeCanvasToSource(c, v)
    try {
      const results = await detect(v, { inputSize: 320 })
      drawBoxes(results, c)
      setDetections(results)
    } catch {
      /* skip frame on transient errors */
    }
    rafRef.current = requestAnimationFrame(videoLoop)
  }, [])

  const startWebcam = useCallback(async () => {
    if (!modelsReadyRef.current) return
    try {
      stopWebcam()
      setStatus({ kind: 'detecting' })
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      webcamStreamRef.current = stream
      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      setIsWebcam(true)
      setHasMedia(true)
      videoRef.current.onplaying = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(videoLoop)
      }
    } catch (e) {
      setStatus({ kind: 'error', message: 'Webcam unavailable: ' + ((e as Error).message || 'permission denied') })
    }
  }, [stopWebcam, videoLoop])

  useEffect(() => {
    const teardown = installDragDrop(window, {
      onFile: (f) => void handleFile(f),
      onStateChange: (s) => setDragOver(s === 'over'),
    })
    return teardown
  }, [handleFile])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type?.startsWith('image/')) {
          const f = item.getAsFile()
          if (f) void handleFile(f)
          return
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleFile])

  useEffect(() => () => stopWebcam(), [stopWebcam])

  return (
    <Shell>
      <div className="flex min-h-0 flex-1 flex-col gap-3 pb-2 pt-2 sm:gap-4 sm:pt-4">
        <header className="text-center sm:text-left">
          <h1 className="display-font text-2xl font-bold leading-tight text-[var(--ink)] sm:text-3xl">Facer</h1>
          <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">
            Offline face &amp; gender recognition — every pixel stays on your device.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full border border-[var(--line-strong)] bg-[var(--glass)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--glass-hover)]"
          >
            Upload photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleFile(f)
              e.target.value = ''
            }}
          />
          {!isWebcam ? (
            <button
              type="button"
              onClick={() => void startWebcam()}
              className="rounded-full border border-[var(--line-strong)] bg-[var(--glass)] px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--glass-hover)]"
            >
              Use webcam
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { stopWebcam(); setStatus({ kind: 'ready' }) }}
              className="rounded-full border border-[var(--line-strong)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent-deep)] hover:bg-[var(--accent)] hover:text-white"
            >
              Stop webcam
            </button>
          )}
        </div>

        <div
          className={[
            'relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border-2 transition',
            dragOver
              ? 'border-[var(--accent)] bg-[var(--accent-soft)]/60'
              : 'border-dashed border-[var(--line-strong)] bg-[var(--panel-quiet)]',
          ].join(' ')}
        >
          {!hasMedia && (
            <div className="px-6 text-center text-[var(--muted)]">
              <p className="text-sm font-medium text-[var(--ink)]">Drop an image here</p>
              <p className="mt-1 text-xs">…or paste from clipboard, click <b>Upload photo</b>, or hit <b>Use webcam</b>.</p>
            </div>
          )}
          <div className={['relative max-h-full max-w-full', hasMedia ? 'block' : 'hidden'].join(' ')}>
            <img
              ref={imgRef}
              alt=""
              className={['block max-h-full max-w-full rounded-xl object-contain', isWebcam ? 'hidden' : ''].join(' ')}
            />
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={['block max-h-full max-w-full rounded-xl object-contain', isWebcam ? '' : 'hidden'].join(' ')}
            />
            <canvas ref={canvasRef} className="pointer-events-none absolute left-0 top-0" />
          </div>
        </div>

        <StatusBanner status={status} />

        {detections.length > 0 && (
          <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto">
            {detections.map((d, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs"
              >
                <span className="text-[var(--ink)]">Face {i + 1} · age ~{Math.round(d.age)}</span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.12em]"
                  style={
                    d.gender === 'male'
                      ? { background: 'var(--sky-soft)', color: 'var(--sky-deep)' }
                      : { background: 'var(--accent-soft)', color: 'var(--accent-deep)' }
                  }
                >
                  {d.gender} · {(d.genderProbability * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        )}

        <footer className="text-center text-[0.65rem] leading-snug text-[var(--muted)] sm:text-left">
          Built on <a className="underline hover:text-[var(--ink)]" href="https://github.com/justadudewhohacks/face-api.js" target="_blank" rel="noopener noreferrer">face-api.js</a> · Part of <a className="underline hover:text-[var(--ink)]" href="https://freeappstore.online" target="_blank" rel="noopener noreferrer">freeappstore.online</a>
        </footer>
      </div>
    </Shell>
  )
}

function StatusBanner({ status }: { status: Status }) {
  let label = ''
  let tone: 'info' | 'busy' | 'success' | 'error' = 'info'
  switch (status.kind) {
    case 'loading-models':
      label = 'Loading models (~625 KB)…'
      tone = 'busy'
      break
    case 'ready':
      label = 'Ready. Drop an image, paste, upload, or start your webcam.'
      tone = 'info'
      break
    case 'loading-image':
      label = `Loading ${status.name}…`
      tone = 'busy'
      break
    case 'detecting':
      label = 'Detecting…'
      tone = 'busy'
      break
    case 'done':
      label = `Done — ${status.count} face${status.count === 1 ? '' : 's'} found.`
      tone = 'success'
      break
    case 'error':
      label = status.message
      tone = 'error'
      break
  }
  const toneStyle =
    tone === 'error'
      ? { background: 'color-mix(in srgb, var(--error) 14%, transparent)', color: 'var(--error)', borderColor: 'color-mix(in srgb, var(--error) 28%, transparent)' }
      : tone === 'success'
      ? { background: 'color-mix(in srgb, var(--success) 14%, transparent)', color: 'var(--success)', borderColor: 'color-mix(in srgb, var(--success) 28%, transparent)' }
      : tone === 'busy'
      ? { background: 'var(--accent-soft)', color: 'var(--accent-deep)', borderColor: 'color-mix(in srgb, var(--accent) 28%, transparent)' }
      : { background: 'var(--panel)', color: 'var(--muted)', borderColor: 'var(--line)' }
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium"
      style={toneStyle}
    >
      {tone === 'busy' && (
        <span
          aria-hidden
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      <span>{label}</span>
    </div>
  )
}
