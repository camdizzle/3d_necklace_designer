// Order management — file-based storage.
//
// Each order is a JSON file in the orders/ directory, named by ID.
// STL files for each order are stored alongside as <orderId>.stl.
//
// This is intentionally simple. No database needed until you're
// processing dozens of orders per day. When you outgrow this, swap
// in SQLite or Postgres without changing the rest of the app.

import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Stripe from 'stripe';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ORDERS_DIR = process.env.ORDERS_DIR || path.join(__dirname, '..', 'orders');

// -----------------------------------------------------------------
// Pricing constants
// -----------------------------------------------------------------
const UNIT_PRICE_CENTS = 2500; // $25 per unit

export function computePrice(quantity) {
  // Buy 3 get 1 free: every 4th item is free
  const freeItems = Math.floor(quantity / 4);
  const paidItems = quantity - freeItems;
  return { paidItems, totalCents: paidItems * UNIT_PRICE_CENTS };
}

// -----------------------------------------------------------------
// Simple in-memory rate limiter
//
// ASSUMPTION: single-instance deployment (Plesk Node.js, one worker).
// State lives in process memory, so it resets on restart and is NOT
// shared across multiple workers/instances. If this ever runs behind
// a load balancer or with clustering, swap in a shared store (Redis).
// -----------------------------------------------------------------
const rateLimitMap = new Map(); // key: ip -> { count, resetTime }

function rateLimit(ip, maxRequests, windowMs) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return false; // not limited
  }
  entry.count++;
  if (entry.count > maxRequests) {
    return true; // limited
  }
  return false;
}

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetTime) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000).unref();

// Sweep temp model/paid/meta files. Checkout sessions expire after
// SESSION_TTL_MS, so anything older than TEMP_MAX_AGE_MS can no longer
// be paid for and is safe to delete.
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const TEMP_MAX_AGE_MS = 4 * 60 * 60 * 1000;
setInterval(() => {
  try {
    const now = Date.now();
    for (const file of fs.readdirSync(ORDERS_DIR)) {
      if (!/^(export_|pending_|upload_)/.test(file)) continue;
      const full = path.join(ORDERS_DIR, file);
      const age = now - fs.statSync(full).mtimeMs;
      if (age > TEMP_MAX_AGE_MS) {
        fs.unlinkSync(full);
        console.log(`Cleaned up stale temp file: ${file}`);
      }
    }
  } catch (err) {
    console.error('Temp file sweep error:', err.message);
  }
}, 30 * 60 * 1000).unref();

// -----------------------------------------------------------------
// Order ID validation (alphanumeric and dashes only)
// -----------------------------------------------------------------
export function isValidOrderId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9-]+$/.test(id);
}

// Export / upload ID validation (lowercase hex only — matches crypto.randomBytes hex)
export function isValidExportId(id) {
  return typeof id === 'string' && /^[a-f0-9]+$/.test(id);
}

// Model formats we accept for upload and serve for download.
export const MODEL_FORMATS = { stl: 'model/stl', '3mf': 'model/3mf' };
export function normalizeFormat(f) {
  return Object.prototype.hasOwnProperty.call(MODEL_FORMATS, f) ? f : 'stl';
}

// Turn a design name into a safe download filename stem.
export function safeFileStem(name) {
  const stem = String(name || '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return stem || 'necklace';
}

// Ensure orders directory exists
if (!fs.existsSync(ORDERS_DIR)) {
  fs.mkdirSync(ORDERS_DIR, { recursive: true });
}

export const ordersRouter = express.Router();

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

// Write via a temp file + rename so a crash mid-write can never leave
// a half-written order on disk.
export function writeFileAtomic(file, contents) {
  const tmp = `${file}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, file);
}

function clientIp(req) {
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function generateId() {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `ORD-${ts}-${rand}`.toUpperCase();
}

function orderPath(id) {
  return path.join(ORDERS_DIR, `${id}.json`);
}

function isOrderFile(f) {
  return /^ORD-[A-Z0-9-]+\.json$/.test(f);
}

// A pending checkout: the full design record we keep on our side so
// Stripe metadata only has to carry a short reference.
function pendingMetaPath(ref) {
  return path.join(ORDERS_DIR, `pending_${ref}.json`);
}

export function savePending(ref, data) {
  writeFileAtomic(pendingMetaPath(ref), JSON.stringify(data));
}

export function loadPending(ref) {
  if (!isValidExportId(ref)) return null;
  try {
    return JSON.parse(fs.readFileSync(pendingMetaPath(ref), 'utf-8'));
  } catch {
    return null;
  }
}

export function deletePending(ref) {
  if (!isValidExportId(ref)) return;
  try { fs.unlinkSync(pendingMetaPath(ref)); } catch {}
}

export function findOrderBySession(sessionId) {
  if (!sessionId) return null;
  return listOrders().find((o) => o.stripeSessionId === sessionId) || null;
}

export function createOrder(data) {
  const id = generateId();
  const format = normalizeFormat(data.modelFormat);
  const order = {
    id,
    status: 'new',              // new → printing → shipped → delivered
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stripeSessionId: data.stripeSessionId || null,
    stripePaymentIntent: data.stripePaymentIntent || null,
    customerEmail: data.customerEmail || '',
    customerName: data.customerName || '',
    shipping: data.shipping || null,
    amountTotal: data.amountTotal || 0,
    currency: data.currency || 'usd',
    designName: data.designName || 'Custom Chain',
    designDetails: data.designDetails || '',
    quantity: data.quantity || 1,
    comments: data.comments || '',
    shareUrl: data.shareUrl || '',
    modelFormat: format,
    trackingNumber: null,
    trackingCarrier: null,
    notes: ''
  };

  // Move the uploaded model into place first: if that fails we throw
  // before the order exists, and the webhook asks Stripe to retry.
  if (data.stlFile) {
    const src = path.join(ORDERS_DIR, path.basename(data.stlFile));
    const dest = path.join(ORDERS_DIR, `${id}.${format}`);
    if (fs.existsSync(src) && src !== dest) {
      fs.renameSync(src, dest);
    }
  }

  writeFileAtomic(orderPath(id), JSON.stringify(order, null, 2));
  return order;
}

export function getOrder(id) {
  if (!isValidOrderId(id)) return null;
  const p = orderPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function listOrders() {
  const files = fs.readdirSync(ORDERS_DIR).filter(isOrderFile);
  const orders = files.map((f) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(ORDERS_DIR, f), 'utf-8'));
    } catch {
      return null;
    }
  }).filter(Boolean);

  // Newest first
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return orders;
}

export function updateOrder(id, updates) {
  const order = getOrder(id);
  if (!order) return null;

  const allowed = ['status', 'trackingNumber', 'trackingCarrier', 'notes'];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      order[key] = updates[key];
    }
  }
  order.updatedAt = new Date().toISOString();

  writeFileAtomic(orderPath(id), JSON.stringify(order, null, 2));
  return order;
}

// -----------------------------------------------------------------
// Daily backup — one JSON snapshot of every order record, kept for
// 30 days in orders/backups/. Model files are not copied: each order
// stores its share link, which rebuilds the exact design.
// -----------------------------------------------------------------
const BACKUP_DIR = path.join(ORDERS_DIR, 'backups');
const BACKUP_KEEP = 30;

export function buildBackup() {
  return { createdAt: new Date().toISOString(), orders: listOrders() };
}

export function runBackup() {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    writeFileAtomic(path.join(BACKUP_DIR, `orders-${day}.json`), JSON.stringify(buildBackup()));
    const old = fs.readdirSync(BACKUP_DIR).filter((f) => /^orders-.*\.json$/.test(f)).sort();
    for (const f of old.slice(0, Math.max(0, old.length - BACKUP_KEEP))) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
    }
  } catch (err) {
    console.error('Order backup failed:', err.message);
  }
}
setTimeout(runBackup, 60 * 1000).unref();
setInterval(runBackup, 24 * 60 * 60 * 1000).unref();

// -----------------------------------------------------------------
// Owner bypass — lets the site owner export without paying.
// Set ADMIN_BYPASS_KEY in env; visit /design/#bypass=<key>. The key is
// sent in a POST body (never a URL) and attempts are rate limited.
// -----------------------------------------------------------------
ordersRouter.post('/verify-bypass', (req, res) => {
  if (rateLimit(`bypass:${clientIp(req)}`, 5, 10 * 60 * 1000)) {
    return res.status(429).json({ valid: false });
  }
  const expected = process.env.ADMIN_BYPASS_KEY;
  const key = req.body?.key;
  if (!expected || typeof key !== 'string') return res.json({ valid: false });
  const a = crypto.createHash('sha256').update(key).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  res.json({ valid: crypto.timingSafeEqual(a, b) });
});

// -----------------------------------------------------------------
// POST /api/upload-model?format=stl|3mf — raw binary model upload.
// The browser may gzip the body (Content-Encoding: gzip); express.raw
// inflates it. Returns an uploadId to pass to a checkout endpoint.
// -----------------------------------------------------------------
const MAX_MODEL_BYTES = 60 * 1024 * 1024;

function saveUpload(buffer, format) {
  const uploadId = crypto.randomBytes(12).toString('hex');
  fs.writeFileSync(path.join(ORDERS_DIR, `upload_${uploadId}.${format}`), buffer);
  return uploadId;
}

function uploadPath(uploadId, format) {
  return path.join(ORDERS_DIR, `upload_${uploadId}.${format}`);
}

ordersRouter.post(
  '/upload-model',
  (req, res, next) => {
    if (rateLimit(`upload:${clientIp(req)}`, 10, 60 * 1000)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
  },
  express.raw({ type: 'application/octet-stream', limit: MAX_MODEL_BYTES }),
  (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length < 84) {
      return res.status(400).json({ error: 'Missing model data' });
    }
    const format = normalizeFormat(req.query.format);
    res.json({ uploadId: saveUpload(req.body, format), format });
  }
);

// Resolve the model for a checkout request: either a prior upload
// (uploadId) or, for older cached clients, inline base64.
function resolveModel(body) {
  const format = normalizeFormat(body.format);
  if (isValidExportId(body.uploadId) && fs.existsSync(uploadPath(body.uploadId, format))) {
    return { uploadId: body.uploadId, format };
  }
  if (typeof body.stlBase64 === 'string' && body.stlBase64.length > 0) {
    return { uploadId: saveUpload(Buffer.from(body.stlBase64, 'base64'), 'stl'), format: 'stl' };
  }
  return null;
}

const clip = (v, n) => String(v ?? '').slice(0, n);

// -----------------------------------------------------------------
// POST /api/checkout — Stripe Checkout for a physical order.
// The design record stays on our side (pending_<ref>.json); Stripe
// metadata carries only the short reference.
// -----------------------------------------------------------------
ordersRouter.post('/checkout', async (req, res) => {
  if (rateLimit(clientIp(req), 5, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  if (!stripeKey) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const model = resolveModel(req.body || {});
  if (!model) {
    return res.status(400).json({ error: 'Missing model data' });
  }

  const designName = clip(req.body.designName, 120) || 'Custom Chain';
  const designDetails = clip(req.body.designDetails, 4000);
  const comments = clip(req.body.comments, 2000);
  const shareUrl = clip(req.body.shareUrl, 8000);

  // Server-side pricing: $25 per unit, buy 3 get 1 free
  const qty = Math.min(100, Math.max(1, parseInt(req.body.quantity) || 1));
  const { paidItems } = computePrice(qty);

  const ref = model.uploadId;
  const pendingFile = `pending_${ref}.${model.format}`;
  fs.renameSync(uploadPath(ref, model.format), path.join(ORDERS_DIR, pendingFile));
  savePending(ref, {
    type: 'order', designName, designDetails, comments, shareUrl,
    quantity: qty, modelFile: pendingFile, modelFormat: model.format
  });

  try {
    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Custom Chain: ${designName} (x${qty})`,
              description: clip(designDetails, 500) || 'Custom 3D-printed pendant necklace'
            },
            unit_amount: UNIT_PRICE_CENTS
          },
          quantity: paidItems
        }
      ],
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU']
      },
      metadata: { type: 'order', ref, quantity: String(qty), designName: clip(designName, 100) },
      expires_at: Math.floor((Date.now() + SESSION_TTL_MS) / 1000),
      success_url: `${baseUrl}/design/?order=success`,
      cancel_url: `${baseUrl}/design/?order=cancelled`
    });

    recordEvent('order_checkout');
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout creation failed:', err.message);
    try { fs.unlinkSync(path.join(ORDERS_DIR, pendingFile)); } catch {}
    deletePending(ref);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// -----------------------------------------------------------------
// POST /api/export-checkout — $2 per-export Stripe Checkout.
// -----------------------------------------------------------------
const EXPORT_PRICE_CENTS = 200; // $2

function exportFilePath(exportId, format) {
  return path.join(ORDERS_DIR, `export_${exportId}.${format}`);
}

ordersRouter.post('/export-checkout', async (req, res) => {
  if (rateLimit(clientIp(req), 5, 60 * 1000)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  if (!stripeKey) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const model = resolveModel(req.body || {});
  if (!model) {
    return res.status(400).json({ error: 'Missing model data' });
  }

  const designName = clip(req.body.designName, 120) || 'necklace';
  const exportId = model.uploadId;
  fs.renameSync(uploadPath(exportId, model.format), exportFilePath(exportId, model.format));
  writeFileAtomic(
    path.join(ORDERS_DIR, `export_${exportId}.json`),
    JSON.stringify({ designName, format: model.format })
  );

  try {
    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `3D Model Export: ${designName}`,
              description: `${model.format.toUpperCase()} file for 3D printing`
            },
            unit_amount: EXPORT_PRICE_CENTS
          },
          quantity: 1
        }
      ],
      metadata: { type: 'export', exportId },
      expires_at: Math.floor((Date.now() + SESSION_TTL_MS) / 1000),
      success_url: `${baseUrl}/design/?export=success&eid=${exportId}`,
      cancel_url: `${baseUrl}/design/?export=cancelled`
    });

    recordEvent('export_checkout');
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe export checkout failed:', err.message);
    for (const ext of [model.format, 'json']) {
      try { fs.unlinkSync(path.join(ORDERS_DIR, `export_${exportId}.${ext}`)); } catch {}
    }
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Called by the webhook when an export payment completes.
export function markExportPaid(exportId) {
  if (!isValidExportId(exportId)) return;
  fs.writeFileSync(path.join(ORDERS_DIR, `export_${exportId}.paid`), '');
}

// GET /api/export-download/:id — download the paid export.
ordersRouter.get('/export-download/:id', (req, res) => {
  const exportId = req.params.id;
  if (!isValidExportId(exportId)) {
    return res.status(400).json({ error: 'Invalid export ID' });
  }

  const paidMarker = path.join(ORDERS_DIR, `export_${exportId}.paid`);
  if (!fs.existsSync(paidMarker)) {
    return res.status(402).json({ error: 'Payment not yet confirmed. Please wait a moment and try again.' });
  }

  const metaPath = path.join(ORDERS_DIR, `export_${exportId}.json`);
  let meta = {};
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); } catch {}
  const format = normalizeFormat(meta.format);
  const filePath = exportFilePath(exportId, format);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Export not found or expired' });
  }

  // The file stays available until the temp sweep removes it, so a
  // dropped connection or a refresh doesn't cost the customer their file.
  res.setHeader('Content-Type', MODEL_FORMATS[format]);
  res.download(filePath, `${safeFileStem(meta.designName)}_necklace.${format}`);
});

// -----------------------------------------------------------------
// First-party funnel counters (no cookies, no personal data).
// POST /api/event { name } increments today's count for that event.
// -----------------------------------------------------------------
const STATS_PATH = path.join(ORDERS_DIR, 'stats.json');
const EVENT_NAMES = new Set([
  'landing_view', 'designer_view', 'share', 'screenshot',
  'export_click', 'export_checkout', 'export_paid',
  'order_click', 'order_checkout', 'order_paid'
]);
let statsCache = null;

function loadStats() {
  if (statsCache) return statsCache;
  try { statsCache = JSON.parse(fs.readFileSync(STATS_PATH, 'utf-8')); } catch { statsCache = {}; }
  return statsCache;
}

let statsDirty = false;
export function recordEvent(name) {
  if (!EVENT_NAMES.has(name)) return;
  const stats = loadStats();
  const day = new Date().toISOString().slice(0, 10);
  stats[day] = stats[day] || {};
  stats[day][name] = (stats[day][name] || 0) + 1;
  statsDirty = true;
}

export function flushStats() {
  if (!statsDirty) return;
  statsDirty = false;
  try {
    const stats = loadStats();
    const days = Object.keys(stats).sort();
    for (const d of days.slice(0, Math.max(0, days.length - 400))) delete stats[d];
    writeFileAtomic(STATS_PATH, JSON.stringify(stats));
  } catch (err) {
    console.error('Stats write failed:', err.message);
  }
}
setInterval(flushStats, 30 * 1000).unref();

export function getStats(days = 30) {
  const stats = loadStats();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    out.push({ day, ...(stats[day] || {}) });
  }
  return out;
}

ordersRouter.post('/event', (req, res) => {
  if (!rateLimit(`event:${clientIp(req)}`, 60, 60 * 1000)) {
    recordEvent(req.body?.name);
  }
  res.status(204).end();
});
