import crypto from 'node:crypto';
import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../utils/http.js';
import { parse, z } from '../utils/validate.js';

// Photos are resized to a small square JPEG in the browser before upload, so they stay well under this.
const MAX_BYTES = 512 * 1024;

export const photoBody = z.object({ image: z.string().min(20).max(800_000) });

/** Decode a data: URL and check it really is a JPEG / PNG / WebP image (by its first bytes, not the label). */
export function decodeImage(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new HttpError(400, 'Upload a JPEG, PNG or WebP image');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_BYTES) throw new HttpError(413, 'Image is too large (max 512 KB after resizing)');
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng = buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const isWebp = buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
  const mime = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : isWebp ? 'image/webp' : null;
  if (!mime) throw new HttpError(400, 'This file is not a valid image');
  return { mime, buf };
}

/** Store a new photo and return its key. */
export async function savePhoto(gymId, body, conn) {
  const { image } = parse(photoBody, body);
  const { mime, buf } = decodeImage(image);
  const key = crypto.randomBytes(16).toString('hex');
  await query('INSERT INTO photos (photo_key, gym_id, mime, data) VALUES (:key, :gymId, :mime, :data)', { key, gymId, mime, data: buf }, conn);
  return key;
}

export async function deletePhoto(key, conn) {
  if (key) await query('DELETE FROM photos WHERE photo_key = :key', { key }, conn);
}

export const photoUrl = (key) => (key ? `/api/photos/${key}` : null);

/**
 * Public, so <img src> works without an auth header. The key is 128 random bits and
 * changes on every upload, so it can't be guessed and can be cached forever.
 */
export const photosRouter = Router();
photosRouter.get('/:key', async (req, res) => {
  if (!/^[a-f0-9]{32}$/.test(req.params.key)) throw new HttpError(404, 'Not found');
  const [p] = await query('SELECT mime, data FROM photos WHERE photo_key = :key', { key: req.params.key });
  if (!p) throw new HttpError(404, 'Not found');
  res.set({ 'Content-Type': p.mime, 'Cache-Control': 'public, max-age=31536000, immutable' }).send(p.data);
});
