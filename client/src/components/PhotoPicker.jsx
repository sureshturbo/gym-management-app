import { useRef, useState } from 'react';
import { Alert, Avatar } from './ui.jsx';
import Icon from './Icon.jsx';

const SIZE = 400; // stored photos are 400×400 JPEGs (~30–60 KB)

/** Centre-crop to a square and shrink, so uploads are small whatever the camera produced. */
async function toSquareJpeg(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('This file could not be read as an image'));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const out = Math.min(SIZE, side);
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // transparent PNGs get a white background
    ctx.fillRect(0, 0, out, out);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Profile photo with Change / Remove buttons.
 * `onUpload(dataUrl)` and `onRemove()` call the API; both may throw.
 */
export default function PhotoPicker({ name, photo, onUpload, onRemove, size = 84 }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file (JPEG or PNG).');
      return;
    }
    run(async () => onUpload(await toSquareJpeg(file)));
  };

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="photo-pick">
        <Avatar name={name} photo={photo} size={size} />
        <div className="row gap wrap">
          <button type="button" className="btn btn-sm" onClick={() => input.current?.click()} disabled={busy}>
            <Icon name="plus" size={15} /> {busy ? 'Uploading…' : photo ? 'Change photo' : 'Add photo'}
          </button>
          {photo && onRemove && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => run(onRemove)} disabled={busy}>
              Remove
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/*" onChange={pick} />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
