// Admin dashboard — password-protected with HTTP Basic Auth.
//
// Routes:
//   GET  /admin           — dashboard page (HTML)
//   GET  /admin/api/orders — orders list (JSON)
//   PUT  /admin/api/orders/:id — update order status/tracking
//   GET  /admin/api/orders/:id/stl — download STL

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listOrders, getOrder, updateOrder } from './orders.js';
import { sendShippingNotification } from './email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const adminRouter = express.Router();

// -----------------------------------------------------------------
// HTTP Basic Auth middleware
// -----------------------------------------------------------------
function requireAuth(req, res, next) {
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
  const [u, p] = decoded.split(':');

  if (u === user && p === pass) {
    return next();
  }

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

// Download STL for an order
adminRouter.get('/api/orders/:id/stl', (req, res) => {
  const ordersDir = path.join(__dirname, '..', 'orders');
  const stl = path.join(ordersDir, `${req.params.id}.stl`);
  if (!fs.existsSync(stl)) {
    return res.status(404).json({ error: 'STL not found for this order' });
  }
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.stl"`);
  fs.createReadStream(stl).pipe(res);
});
