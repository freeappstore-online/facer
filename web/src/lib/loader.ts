// Load a File into an <img>, resolving when the image has decoded.

export function loadFileIntoImage(file: File, imgEl: HTMLImageElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file provided'));
    if (!file.type || !file.type.startsWith('image/')) {
      return reject(new Error('Not an image file: ' + (file.type || 'unknown')));
    }
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);
    imgEl.onload = () => { cleanup(); resolve(imgEl); };
    imgEl.onerror = () => { cleanup(); reject(new Error('Failed to decode image')); };
    imgEl.src = url;
  });
}
