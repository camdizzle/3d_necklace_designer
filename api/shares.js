// Short share links with a picture of the design.
//
//   POST /api/share { design, image }  → { id, url }
//     design: the encoded design (the part after "#design=" in a long
//             share link); image: a JPEG data URL of the 3D view.
//   GET  /d/:id       → a page whose link preview shows the design, then
//                       opens it in the designer
//   GET  /d/:id.jpg   → the preview image
//
// The id is derived from the design, so sharing the same design twice
// gives the same link. Stored under <ORDERS_DIR>/shares/.

import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ORDERS_DIR, writeFileAtomic } from './orders.js';

export const sharesRouter = express.Router();

const SHARE_DIR = path.join(ORDERS_DIR, 'shares');
const MAX_SHARES = 20000;
const MAX_IMAGE_BYTES = 400 * 1024;
const MAX_DESIGN_CHARS = 12000;

const rate = new Map();
function limited(ip) {
  const now = Date.now();
  const e = rate.get(ip);
  if (!e || now > e.reset) { rate.set(ip, { n: 1, reset: now + 10 * 60 * 1000 }); return false; }
  return ++e.n > 30;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, e] of rate) if (now > e.reset) rate.delete(k);
}, 10 * 60 * 1000).unref();

const isId = (id) => typeof id === 'string' && /^[a-f0-9]{10}$/.test(id);
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function baseUrl(req) {
  return (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

// Decode the design the same way the designer does, to read its text.
export function decodeDesign(design) {
  try {
    const json = Buffer.from(design, 'base64').toString('utf-8');
    const obj = JSON.parse(json);
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}

function designTitle(state) {
  const lines = [state.text ?? 'Your', state.secondLineText ?? 'Hype', state.thirdLineText ?? 'Chain']
    .map((t) => String(t || '').trim()).filter(Boolean);
  return lines.join(' ').slice(0, 60) || 'Custom chain';
}

function pruneShares() {
  try {
    const files = fs.readdirSync(SHARE_DIR).filter((f) => f.endsWith('.json'));
    if (files.length <= MAX_SHARES) return;
    const byAge = files
      .map((f) => ({ f, t: fs.statSync(path.join(SHARE_DIR, f)).mtimeMs }))
      .sort((a, b) => a.t - b.t);
    for (const { f } of byAge.slice(0, files.length - MAX_SHARES)) {
      const id = f.slice(0, -5);
      for (const ext of ['json', 'jpg']) {
        try { fs.unlinkSync(path.join(SHARE_DIR, `${id}.${ext}`)); } catch {}
      }
    }
  } catch {}
}

export function saveShare(design, imageBuffer) {
  const id = crypto.createHash('sha256').update(design).digest('hex').slice(0, 10);
  fs.mkdirSync(SHARE_DIR, { recursive: true });
  const meta = path.join(SHARE_DIR, `${id}.json`);
  if (!fs.existsSync(meta)) {
    if (imageBuffer) writeFileAtomic(path.join(SHARE_DIR, `${id}.jpg`), imageBuffer);
    writeFileAtomic(meta, JSON.stringify({ design, createdAt: new Date().toISOString() }));
    pruneShares();
  }
  return id;
}

export function loadShare(id) {
  if (!isId(id)) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(SHARE_DIR, `${id}.json`), 'utf-8'));
  } catch {
    return null;
  }
}

sharesRouter.post('/api/share', (req, res) => {
  const ip = req.ip || 'unknown';
  if (limited(ip)) return res.status(429).json({ error: 'Too many requests' });

  const design = req.body?.design;
  if (typeof design !== 'string' || design.length > MAX_DESIGN_CHARS ||
      !/^[A-Za-z0-9+/=]+$/.test(design) || !decodeDesign(design)) {
    return res.status(400).json({ error: 'Invalid design' });
  }

  let image = null;
  const m = typeof req.body?.image === 'string' && req.body.image.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (m) {
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length <= MAX_IMAGE_BYTES && buf[0] === 0xff && buf[1] === 0xd8) image = buf;
  }

  const id = saveShare(design, image);
  res.json({ id, url: `${baseUrl(req)}/d/${id}` });
});

sharesRouter.get('/d/:file', (req, res, next) => {
  const file = req.params.file;

  if (file.endsWith('.jpg')) {
    const id = file.slice(0, -4);
    const img = path.join(SHARE_DIR, `${id}.jpg`);
    if (!isId(id) || !fs.existsSync(img)) return next();
    res.setHeader('Cache-Control', 'public, max-age=604800');
    return res.sendFile(img, { headers: { 'Content-Type': 'image/jpeg' } });
  }

  const share = loadShare(file);
  if (!share) return next();
  const state = decodeDesign(share.design) || {};
  const base = baseUrl(req);
  const target = `/design/#design=${share.design}`;
  const title = `${designTitle(state)} — custom chain`;
  const hasImage = fs.existsSync(path.join(SHARE_DIR, `${file}.jpg`));
  const image = hasImage ? `${base}/d/${file}.jpg` : `${base}/img/og.jpg`;
  const description = 'Made in Chain Studio. Open it in the 3D designer, change the name, and order it printed for $25.';

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="robots" content="noindex">
<meta name="description" content="${esc(description)}">
<meta property="og:site_name" content="Chain Studio">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(`${base}/d/${file}`)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body style="font-family:system-ui;background:#1a1a2e;color:#eee;text-align:center;padding:15vh 16px">
<p>Opening the design…</p>
<p><a style="color:#FFD700" href="${esc(target)}">Open it in the designer</a></p>
</body>
</html>`);
});
