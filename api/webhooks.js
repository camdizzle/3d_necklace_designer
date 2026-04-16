// Stripe webhook handler.
//
// Listens for checkout.session.completed events, creates an order
// record, and sends email notifications.

import express from 'express';
import Stripe from 'stripe';
import { createOrder } from './orders.js';
import { sendOrderConfirmation, sendAdminNotification } from './email.js';

export const webhookRouter = express.Router();

// Stripe needs the raw (unparsed) body to verify the webhook signature.
// We attach it as req.rawBody via this middleware, which must be mounted
// BEFORE express.json() in server.js.
export function rawBodyMiddleware(req, _res, next) {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks);
    next();
  });
}

webhookRouter.post('/stripe', async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!secret || !stripeKey) {
    console.error('Stripe env vars not configured');
    return res.status(500).send('Server misconfigured');
  }

  const stripe = new Stripe(stripeKey);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, secret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // We only care about completed checkout sessions.
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      const order = createOrder({
        stripeSessionId: session.id,
        stripePaymentIntent: session.payment_intent,
        customerEmail: session.customer_details?.email || '',
        customerName: session.customer_details?.name || '',
        shipping: session.shipping_details || session.collected_information?.shipping_details || null,
        amountTotal: session.amount_total,   // in cents
        currency: session.currency || 'usd',
        designName: session.metadata?.designName || 'Custom Chain',
        designDetails: session.metadata?.designDetails || '',
        stlFile: session.metadata?.stlFile || null  // filename in orders/ dir
      });

      console.log(`Order created: ${order.id} for ${order.customerEmail}`);

      // Fire-and-forget emails — don't fail the webhook if email breaks.
      sendOrderConfirmation(order).catch((err) =>
        console.error('Customer email failed:', err.message)
      );
      sendAdminNotification(order).catch((err) =>
        console.error('Admin email failed:', err.message)
      );
    } catch (err) {
      console.error('Failed to create order from webhook:', err);
      // Still return 200 so Stripe doesn't retry — we logged the error.
    }
  }

  res.json({ received: true });
});
