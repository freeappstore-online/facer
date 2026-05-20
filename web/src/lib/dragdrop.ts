// Window-level drag-and-drop.
//
// - Always preventDefault on dragover (else drop never fires).
// - Enter/leave counter, because dragleave fires on every child boundary.
// - Try dataTransfer.items before .files (handles macOS Photos / cross-app drags).

type State = 'over' | 'idle';

interface Opts {
  onFile?: (file: File) => void;
  onStateChange?: (state: State) => void;
}

export function installDragDrop(target: Window | HTMLElement, opts: Opts = {}): () => void {
  const { onFile, onStateChange } = opts;
  let counter = 0;

  const onEnter = (e: Event) => {
    e.preventDefault();
    counter += 1;
    if (counter === 1) onStateChange?.('over');
  };
  const onOver = (e: Event) => {
    e.preventDefault();
    const dt = (e as DragEvent).dataTransfer;
    if (dt) {
      try { dt.dropEffect = 'copy'; } catch { /* read-only in some contexts */ }
    }
  };
  const onLeave = () => {
    counter = Math.max(0, counter - 1);
    if (counter === 0) onStateChange?.('idle');
  };
  const onDrop = (e: Event) => {
    e.preventDefault();
    counter = 0;
    onStateChange?.('idle');
    const file = extractFile((e as DragEvent).dataTransfer);
    if (file && onFile) onFile(file);
  };

  target.addEventListener('dragenter', onEnter);
  target.addEventListener('dragover', onOver);
  target.addEventListener('dragleave', onLeave);
  target.addEventListener('drop', onDrop);

  return () => {
    target.removeEventListener('dragenter', onEnter);
    target.removeEventListener('dragover', onOver);
    target.removeEventListener('dragleave', onLeave);
    target.removeEventListener('drop', onDrop);
  };
}

export function extractFile(dt: DataTransfer | null): File | null {
  if (!dt) return null;
  if (dt.items && dt.items.length) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i];
      if (item && item.kind === 'file') {
        const f = item.getAsFile();
        if (f) return f;
      }
    }
  }
  if (dt.files && dt.files.length) return dt.files[0];
  return null;
}
