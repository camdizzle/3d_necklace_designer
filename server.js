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
//   CONTACT_EMAIL            shown on the legal pages (defaults to EMAIL_FROM)
//   LEGACY_HOSTS             comma-separated old hostnames to 301 to BASE_URL
//   ADMIN_BYPASS_KEY         owner export bypass key
//   PORT                     (optional, defaults to 3000)

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { webhookRouter, rawBodyMiddleware } from './api/webhooks.js';
import { ordersRouter } from './api/orders.js';
import { adminRouter } from './api/admin.js';
import { pagesRouter } from './api/pages.js';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REQUIRED_ENV = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.warn(`WARNING: ${key} is not set. Orders will not work.`);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// -------------------------------------------------------------------
// Old domain → permanent redirect to the canonical address, so search
// engines index one site and old links keep working.
// -------------------------------------------------------------------
const LEGACY_HOSTS = (process.env.LEGACY_HOSTS || 'designer.camwow.tv')
  .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
app.use((req, res, next) => {
  const base = process.env.BASE_URL;
  if (base && LEGACY_HOSTS.includes((req.hostname || '').toLowerCase()) &&
      !req.path.startsWith('/api/webhooks')) {
    return res.redirect(301, base.replace(/\/$/, '') + req.originalUrl);
  }
  next();
});

// -------------------------------------------------------------------
// Security headers
// -------------------------------------------------------------------
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// -------------------------------------------------------------------
// Stripe webhooks need the raw body for signature verification.
// Mount BEFORE express.json() so it gets the unparsed body.
// -------------------------------------------------------------------
app.use('/api/webhooks', rawBodyMiddleware);
app.use('/api/webhooks', webhookRouter);

// -------------------------------------------------------------------
// Parse JSON for all other routes
// -------------------------------------------------------------------
// Legacy clients post base64 models as JSON; current ones upload binary
// to /api/upload-model, so JSON bodies are small.
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
// Landing, gallery, search and legal pages, robots.txt, sitemap.xml
// -------------------------------------------------------------------
app.use(pagesRouter);

// -------------------------------------------------------------------
// Static files — the Vite build output in dist/. `npm run build` also
// writes a .gz next to each large text/mesh file; serve that when the
// browser accepts gzip (the chain meshes shrink by more than half).
// -------------------------------------------------------------------
const DIST = path.join(__dirname, 'dist');
const GZIP_TYPES = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.stl': 'model/stl',
  '.html': 'text/html; charset=utf-8'
};

function cacheControl(urlPath) {
  if (urlPath.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  if (/\.(stl|json|jpg|jpeg|png|webp|svg|css)$/i.test(urlPath)) return 'public, max-age=86400';
  return 'no-cache';
}

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  let rel;
  try { rel = decodeURIComponent(req.path); } catch { return next(); }
  if (rel.endsWith('/')) rel += 'index.html';
  const type = GZIP_TYPES[path.extname(rel).toLowerCase()];
  if (!type || !/\bgzip\b/.test(req.headers['accept-encoding'] || '')) return next();
  const file = path.join(DIST, rel);
  if (!file.startsWith(DIST + path.sep)) return next();
  fs.stat(file + '.gz', (err, stat) => {
    if (err || !stat.isFile()) return next();
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('Cache-Control', cacheControl(rel));
    res.sendFile(file + '.gz', { headers: { 'Content-Type': type } });
  });
});

app.use(express.static(DIST, {
  setHeaders(res, filePath) {
    res.setHeader('Cache-Control', cacheControl('/' + path.relative(DIST, filePath).split(path.sep).join('/')));
  }
}));

// Fallback: serve public/ directly. The landing pages' stylesheet, images
// and favicon live there, so they keep working even when dist/ is missing
// or stale because `npm run build` did not run on the host.
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    res.setHeader('Cache-Control', cacheControl('/' + path.basename(filePath)));
  }
}));

// Build status, for checking a deploy: open /api/health in a browser.
function buildStatus() {
  const has = (rel) => fs.existsSync(path.join(DIST, rel));
  return { designerBuilt: has('design/index.html'), siteAssetsBuilt: has('site.css') };
}
app.get('/api/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, ...buildStatus() });
});

// The designer only exists after a build. Say so instead of a bare 404.
app.get(['/design', '/design/'], (_req, res) => {
  res.status(503).type('html').send(
    '<!doctype html><meta charset="utf-8"><title>Designer unavailable — Chain Studio</title>' +
    '<body style="font-family:system-ui;background:#1a1a2e;color:#eee;text-align:center;padding:15vh 16px">' +
    '<h1>The designer is being updated</h1><p>Please try again in a few minutes.</p>' +
    '<p><a style="color:#FFD700" href="/">Back to Chain Studio</a></p>'
  );
});

// Anything else is a real 404 (search engines must not see a 200 here).
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404).type('html').send(
    '<!doctype html><meta charset="utf-8"><title>Page not found — Chain Studio</title>' +
    '<body style="font-family:system-ui;background:#1a1a2e;color:#eee;text-align:center;padding:15vh 16px">' +
    '<h1>Page not found</h1><p><a style="color:#FFD700" href="/">Back to Chain Studio</a></p>'
  );
});

app.listen(PORT, () => {
  const status = buildStatus();
  if (!status.designerBuilt || !status.siteAssetsBuilt) {
    console.warn('WARNING: dist/ is missing or out of date. Run `npm install` (with dev dependencies) and `npm run build`.');
  }
  console.log(`Chain Studio server running on port ${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
});
