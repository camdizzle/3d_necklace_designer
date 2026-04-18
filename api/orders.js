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
const ORDERS_DIR = path.join(__dirname, '..', 'orders');

// Ensure orders directory exists
if (!fs.existsSync(ORDERS_DIR)) {
  fs.mkdirSync(ORDERS_DIR, { recursive: true });
}

export const ordersRouter = express.Router();

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

function generateId() {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `ORD-${ts}-${rand}`.toUpperCase();
}

function orderPath(id) {
  return path.join(ORDERS_DIR, `${id}.json`);
}

function stlPath(id) {
  return path.join(ORDERS_DIR, `${id}.stl`);
}

export function createOrder(data) {
  const id = generateId();
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
    trackingNumber: null,
    trackingCarrier: null,
    notes: ''
  };

  fs.writeFileSync(orderPath(id), JSON.stringify(order, null, 2));

  // If an STL filename was passed (from pre-upload), rename/link it.
  if (data.stlFile) {
    const src = path.join(ORDERS_DIR, data.stlFile);
    if (fs.existsSync(src) && src !== stlPath(id)) {
      fs.renameSync(src, stlPath(id));
    }
  }

  return order;
}

export function getOrder(id) {
  const p = orderPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function listOrders() {
  const files = fs.readdirSync(ORDERS_DIR).filter((f) => f.endsWith('.json'));
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

  fs.writeFileSync(orderPath(id), JSON.stringify(order, null, 2));
  return order;
}

// -----------------------------------------------------------------
// Routes
// -----------------------------------------------------------------

// POST /api/checkout — create a Stripe Checkout session.
// The frontend sends the STL binary + design metadata. We store the
// STL first (so we have it even if the customer abandons checkout),
// then create the Checkout session and return the URL.
ordersRouter.post('/checkout', async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

  if (!stripeKey) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const { stlBase64, designName, designDetails, priceInCents, quantity } = req.body;

  if (!stlBase64) {
    return res.status(400).json({ error: 'Missing STL data' });
  }

  // Save the STL to a temp file in orders/ — we'll rename it to the
  // order ID once the webhook fires.
  const tempName = `pending_${crypto.randomBytes(8).toString('hex')}.stl`;
  const tempPath = path.join(ORDERS_DIR, tempName);
  fs.writeFileSync(tempPath, Buffer.from(stlBase64, 'base64'));

  try {
    const stripe = new Stripe(stripeKey);

    const unitAmount = priceInCents || 2500;
    const qty = Math.max(1, parseInt(quantity) || 1);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Custom Chain: ${designName || 'My Design'} (x${qty})`,
              description: designDetails || 'Custom 3D-printed pendant necklace'
            },
            unit_amount: unitAmount
          },
          quantity: 1
        }
      ],
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU']
      },
      metadata: {
        designName: designName || 'Custom Chain',
        designDetails: designDetails || '',
        stlFile: tempName,
        quantity: String(qty)
      },
      success_url: `${baseUrl}/?order=success`,
      cancel_url: `${baseUrl}/?order=cancelled`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout creation failed:', err.message);
    // Clean up temp STL
    try { fs.unlinkSync(tempPath); } catch {}
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/upload-stl — alternative: upload STL before checkout
// (if we want to decouple the upload from the checkout creation).
ordersRouter.post('/upload-stl', (req, res) => {
  const { stlBase64 } = req.body;
  if (!stlBase64) {
    return res.status(400).json({ error: 'Missing STL data' });
  }

  const tempName = `pending_${crypto.randomBytes(8).toString('hex')}.stl`;
  const tempPath = path.join(ORDERS_DIR, tempName);
  fs.writeFileSync(tempPath, Buffer.from(stlBase64, 'base64'));

  res.json({ filename: tempName });
});

// GET /api/orders/:id/stl — download the STL for an order (admin use)
ordersRouter.get('/orders/:id/stl', (req, res) => {
  const p = stlPath(req.params.id);
  if (!fs.existsSync(p)) {
    return res.status(404).json({ error: 'STL not found' });
  }
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}.stl"`);
  fs.createReadStream(p).pipe(res);
});
