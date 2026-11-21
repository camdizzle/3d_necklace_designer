// Admin dashboard — password-protected with HTTP Basic Auth.
//
// Routes:
//   GET  /admin           — dashboard page (HTML)
//   GET  /admin/api/orders — orders list (JSON)
//   PUT  /admin/api/orders/:id — update order status/tracking
//   GET  /admin/api/orders/:id/stl — download the order's model file
//   GET  /admin/api/stats  — funnel counters (last 30 days)
//   GET  /admin/api/client-errors — recent errors from visitors' browsers
//   GET  /admin/api/backup — JSON backup of all orders

import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  listOrders, getOrder, updateOrder, isValidOrderId,
  getStats, buildBackup, ORDERS_DIR, orderModelName, getClientErrors
} from './orders.js';
import { sendShippingNotification } from './email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const adminRouter = express.Router();

// -----------------------------------------------------------------
// HTTP Basic Auth middleware
// -----------------------------------------------------------------
// Lock an address out for 15 minutes after 10 failed logins.
const failedLogins = new Map(); // ip -> { count, reset }
const MAX_FAILED_LOGINS = 10;
const LOCKOUT_MS = 15 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of failedLogins) if (now > e.reset) failedLogins.delete(ip);
}, LOCKOUT_MS).unref();

function noteFailedLogin(ip) {
  const now = Date.now();
  const e = failedLogins.get(ip);
  if (!e || now > e.reset) failedLogins.set(ip, { count: 1, reset: now + LOCKOUT_MS });
  else e.count++;
}

function requireAuth(req, res, next) {
  const ip = req.ip || 'unknown';
  const lock = failedLogins.get(ip);
  if (lock && lock.count >= MAX_FAILED_LOGINS && Date.now() < lock.reset) {
    return res.status(429).send('Too many failed logins. Try again in 15 minutes.');
  }

  const user = process.env.ADMIN_USERNAME || 'admin';
  const pass = process.env.ADMIN_PASSWORD;

  if (!pass) {
    // No password set — block access entirely so we don't accidentally
    // expose the dashboard with no auth.
    return res.status(503).send('Admin password not configured. Set ADMIN_PASSWORD env var.');
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Chain Studio Admin"');
    return res.status(401).send('Authentication required');
  }

  const decoded = Buffer.from(header.slice(6), 'base64').toString();
  const [u, ...pParts] = decoded.split(':');
  const p = pParts.join(':'); // password may contain colons

  const valid = u.length === user.length && p.length === pass.length &&
    crypto.timingSafeEqual(Buffer.from(u), Buffer.from(user)) &&
    crypto.timingSafeEqual(Buffer.from(p), Buffer.from(pass));

  if (valid) {
    failedLogins.delete(ip);
    return next();
  }

  noteFailedLogin(ip);
  res.setHeader('WWW-Authenticate', 'Basic realm="Chain Studio Admin"');
  return res.status(401).send('Invalid credentials');
}

adminRouter.use(requireAuth);

// Parse JSON for admin API routes
adminRouter.use(express.json());

// -----------------------------------------------------------------
// Dashboard HTML
// -----------------------------------------------------------------
adminRouter.get('/', (_req, res) => {
  const htmlPath = path.join(__dirname, '..', 'views', 'admin.html');
  res.sendFile(htmlPath);
});

// -----------------------------------------------------------------
// Admin API
// -----------------------------------------------------------------

// List all orders
adminRouter.get('/api/orders', (_req, res) => {
  res.json(listOrders());
});

// Get single order
adminRouter.get('/api/orders/:id', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// Update order (status, tracking, notes)
adminRouter.put('/api/orders/:id', async (req, res) => {
  const before = getOrder(req.params.id);
  if (!before) return res.status(404).json({ error: 'Order not found' });

  const updated = updateOrder(req.params.id, req.body);

  // If status changed to 'shipped' and tracking was just added, email customer.
  if (
    updated.status === 'shipped' &&
    updated.trackingNumber &&
    (before.status !== 'shipped' || !before.trackingNumber)
  ) {
    sendShippingNotification(updated).catch((err) =>
      console.error('Shipping email failed:', err.message)
    );
  }

  res.json(updated);
});

// Download the model file for an order (?item=N for design N of a
// multi-design order, 1-based)
adminRouter.get('/api/orders/:id/stl', (req, res) => {
  // Validate order ID format to prevent path traversal
  if (!isValidOrderId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid order ID format' });
  }
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const index = Math.max(0, (parseInt(req.query.item) || 1) - 1);
  const name = orderModelName(order, index);
  const file = path.join(ORDERS_DIR, name);
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: 'Model file not found for this order' });
  }
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  fs.createReadStream(file).pipe(res);
});

// Recent errors reported by visitors' browsers
adminRouter.get('/api/client-errors', (_req, res) => {
  res.json(getClientErrors());
});

// Funnel counters for the last 30 days
adminRouter.get('/api/stats', (_req, res) => {
  res.json(getStats(30));
});

// Download a JSON backup of every order record
adminRouter.get('/api/backup', (_req, res) => {
  const day = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="chain-studio-orders-${day}.json"`);
  res.json(buildBackup());
});
