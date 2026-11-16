import { HttpError } from '../utils/http.js';

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Endpoint not found' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This record already exists' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
}
