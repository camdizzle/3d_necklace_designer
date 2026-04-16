// Chain Studio — Express backend
//
// Serves the Vite-built frontend as static files and handles:
//   /api/checkout    — create Stripe Checkout session
//   /api/webhooks    — Stripe webhook (order confirmation)
//   /api/orders      — order CRUD for admin
//   /admin           — password-protected dashboard
//
// Environment variables (set in Plesk Node.js panel):
//   STRIPE_SECRET_KEY        sk_live_... or sk_test_...
//   STRIPE_WEBHOOK_SECRET    whsec_...
//   STRIPE_PUBLISHABLE_KEY   pk_live_... or pk_test_...
//   ADMIN_USERNAME           admin dashboard username
//   ADMIN_PASSWORD           admin dashboard password
//   EMAIL_API_KEY            Resend API key
//   EMAIL_FROM               sender address (e.g. orders@yourdomain.com)
//   BASE_URL                 https://yourdomain.com
//   PORT                     (optional, defaults to 3000)

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { webhookRouter, rawBodyMiddleware } from './api/webhooks.js';
import { ordersRouter } from './api/orders.js';
import { adminRouter } from './api/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------------------------------------------------
// Stripe webhooks need the raw body for signature verification.
// Mount BEFORE express.json() so it gets the unparsed body.
// -------------------------------------------------------------------
app.use('/api/webhooks', rawBodyMiddleware);
app.use('/api/webhooks', webhookRouter);

// -------------------------------------------------------------------
// Parse JSON for all other routes
// -------------------------------------------------------------------
app.use(express.json({ limit: '50mb' }));

// -------------------------------------------------------------------
// API routes
// -------------------------------------------------------------------
app.use('/api', ordersRouter);

// -------------------------------------------------------------------
// Admin dashboard
// -------------------------------------------------------------------
app.use('/admin', adminRouter);

// -------------------------------------------------------------------
// Static files — serve the Vite build output from dist/
// -------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'dist')));

// Also serve the chain STL from root (matches vite.config.js behavior)
app.use('/ChainMakerChain.stl', express.static(path.join(__dirname, 'ChainMakerChain.stl')));

// SPA fallback — any non-API, non-admin route serves index.html
app.get('*', (req, res) => {
  // Don't intercept API or admin routes that fell through
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Chain Studio server running on port ${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
});
