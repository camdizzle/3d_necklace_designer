// End-to-end tests for the upload → checkout record → webhook → order
// path, using a throwaway orders directory and locally signed events.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import express from 'express';
import Stripe from 'stripe';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chain-orders-'));
process.env.ORDERS_DIR = dir;
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.ADMIN_BYPASS_KEY = 'owner-key';
process.env.ADMIN_PASSWORD = 'admin-pass';
delete process.env.EMAIL_API_KEY;

const orders = await import('../api/orders.js');
const { webhookRouter, rawBodyMiddleware } = await import('../api/webhooks.js');
const { sharesRouter } = await import('../api/shares.js');
const { adminRouter } = await import('../api/admin.js');

let server;
let base;
before(async () => {
  const app = express();
  app.use('/api/webhooks', rawBodyMiddleware);
  app.use('/api/webhooks', webhookRouter);
  app.use(express.json());
  app.use('/api', orders.ordersRouter);
  app.use(sharesRouter);
  app.use('/admin', adminRouter);
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const stripe = new Stripe('sk_test_dummy');
function sendEvent(session) {
  const payload = JSON.stringify({
    id: 'evt_test', object: 'event', type: 'checkout.session.completed',
    data: { object: session }
  });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_test_secret' });
  return fetch(`${base}/api/webhooks/stripe`, {
    method: 'POST', headers: { 'stripe-signature': header, 'content-type': 'application/json' }, body: payload
  });
}

const MODEL = Buffer.alloc(200, 7);

test('upload-model accepts gzipped binary and stores the inflated bytes', async () => {
  const res = await fetch(`${base}/api/upload-model?format=stl`, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream', 'content-encoding': 'gzip' },
    body: zlib.gzipSync(MODEL)
  });
  assert.equal(res.status, 200);
  const { uploadId, format } = await res.json();
  assert.equal(format, 'stl');
  assert.deepEqual(fs.readFileSync(path.join(dir, `upload_${uploadId}.stl`)), MODEL);
});

test('upload-model rejects an empty body and unknown formats fall back to stl', async () => {
  const empty = await fetch(`${base}/api/upload-model`, {
    method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: Buffer.alloc(0)
  });
  assert.equal(empty.status, 400);
  assert.equal(orders.normalizeFormat('exe'), 'stl');
  assert.equal(orders.normalizeFormat('3mf'), '3mf');
});

test('a paid order is created once, with the full design record, even if the event repeats', async () => {
  const ref = 'abc123def456';
  const longShare = 'https://example.test/design/#design=' + 'A'.repeat(3000);
  fs.writeFileSync(path.join(dir, `pending_${ref}.stl`), MODEL);
  orders.savePending(ref, {
    type: 'order', designName: 'Best / Dad', designDetails: 'Line 1: "Best"', comments: 'gift',
    shareUrl: longShare, quantity: 4, modelFile: `pending_${ref}.stl`, modelFormat: 'stl'
  });
  const session = {
    id: 'cs_test_order_1', payment_status: 'paid', payment_intent: 'pi_1', amount_total: 7500, currency: 'usd',
    customer_details: { email: 'buyer@example.test', name: 'Buyer' },
    metadata: { type: 'order', ref, quantity: '4' }
  };

  assert.equal((await sendEvent(session)).status, 200);
  assert.equal((await sendEvent(session)).status, 200);

  const all = orders.listOrders().filter((o) => o.stripeSessionId === 'cs_test_order_1');
  assert.equal(all.length, 1);
  assert.equal(all[0].shareUrl, longShare);
  assert.equal(all[0].quantity, 4);
  assert.equal(all[0].designName, 'Best / Dad');
  assert.ok(fs.existsSync(path.join(dir, `${all[0].id}.stl`)));
  assert.equal(orders.loadPending(ref), null);
});

test('an unpaid session does not create an order', async () => {
  const res = await sendEvent({ id: 'cs_test_unpaid', payment_status: 'unpaid', metadata: { type: 'order' } });
  assert.equal(res.status, 200);
  assert.equal(orders.findOrderBySession('cs_test_unpaid'), null);
});

test('a bad signature is rejected', async () => {
  const res = await fetch(`${base}/api/webhooks/stripe`, {
    method: 'POST', headers: { 'stripe-signature': 't=1,v1=bad' }, body: '{}'
  });
  assert.equal(res.status, 400);
});

test('an export is downloadable only after payment, with a named file', async () => {
  const id = 'feed0123';
  fs.writeFileSync(path.join(dir, `export_${id}.3mf`), MODEL);
  fs.writeFileSync(path.join(dir, `export_${id}.json`), JSON.stringify({ designName: 'Go / Tigers', format: '3mf' }));

  assert.equal((await fetch(`${base}/api/export-download/${id}`)).status, 402);
  assert.equal((await sendEvent({ id: 'cs_test_export', payment_status: 'paid', metadata: { type: 'export', exportId: id } })).status, 200);

  const res = await fetch(`${base}/api/export-download/${id}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /go_tigers_necklace\.3mf/);
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), MODEL);
  // Still there for a retry until the temp sweep removes it.
  assert.equal((await fetch(`${base}/api/export-download/${id}`)).status, 200);
});

test('owner bypass checks the key and is rate limited', async () => {
  const post = (key) => fetch(`${base}/api/verify-bypass`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key })
  });
  assert.deepEqual(await (await post('owner-key')).json(), { valid: true });
  assert.deepEqual(await (await post('wrong')).json(), { valid: false });
  let limited = false;
  for (let i = 0; i < 6; i++) limited = (await post('wrong')).status === 429 || limited;
  assert.ok(limited);
});

test('listOrders ignores non-order JSON files in the orders directory', () => {
  fs.writeFileSync(path.join(dir, 'stats.json'), '{}');
  fs.writeFileSync(path.join(dir, 'pending_zzz.json'), '{}');
  assert.ok(orders.listOrders().every((o) => /^ORD-/.test(o.id)));
});

test('safeFileStem produces safe names', () => {
  assert.equal(orders.safeFileStem('Best / Dad!'), 'best_dad');
  assert.equal(orders.safeFileStem('../../etc'), 'etc');
  assert.equal(orders.safeFileStem(''), 'necklace');
});

test('visit counters record a clean utm_source and ignore junk', () => {
  orders.recordEvent('landing_view', 'Instagram');
  orders.recordEvent('landing_view', '<script>');
  orders.recordEvent('order_paid', 'instagram');
  const today = orders.getStats(1)[0];
  assert.equal(today['src:instagram'], 1);
  assert.ok(today.landing_view >= 2);
  assert.ok(!Object.keys(today).some((k) => k.includes('<')));
});

test('a multi-design order keeps every design, its model and its source', async () => {
  const ref = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  const A = Buffer.alloc(120, 1);
  const B = Buffer.alloc(140, 2);
  fs.writeFileSync(path.join(dir, `pending_${ref}_1.stl`), A);
  fs.writeFileSync(path.join(dir, `pending_${ref}_2.stl`), B);
  orders.savePending(ref, {
    type: 'order', comments: '', source: 'ig-gift', quantity: 4,
    items: [
      { designName: 'Maya', designDetails: 'Line 1: "Maya"', shareUrl: 'https://x.test/a', quantity: 3, modelFile: `pending_${ref}_1.stl`, modelFormat: 'stl' },
      { designName: 'Zoe', designDetails: 'Line 1: "Zoe"', shareUrl: 'https://x.test/b', quantity: 1, modelFile: `pending_${ref}_2.stl`, modelFormat: 'stl' }
    ]
  });
  const res = await sendEvent({
    id: 'cs_test_multi', payment_status: 'paid', amount_total: 7500, currency: 'usd',
    total_details: { amount_discount: 500 },
    customer_details: { email: 'g@example.test', name: 'Group' },
    metadata: { type: 'order', ref, quantity: '4', source: 'ig-gift' }
  });
  assert.equal(res.status, 200);

  const order = orders.findOrderBySession('cs_test_multi');
  assert.equal(order.items.length, 2);
  assert.equal(order.quantity, 4);
  assert.equal(order.source, 'ig-gift');
  assert.equal(order.discountTotal, 500);
  assert.equal(order.designName, 'Maya + Zoe');
  assert.deepEqual(fs.readFileSync(path.join(dir, orders.orderModelName(order, 0))), A);
  assert.deepEqual(fs.readFileSync(path.join(dir, orders.orderModelName(order, 1))), B);
  assert.equal(orders.getStats(1)[0]['paid:ig-gift'], 1);

  // The admin can download each design's model.
  const auth = { authorization: 'Basic ' + Buffer.from('admin:admin-pass').toString('base64') };
  const second = await fetch(`${base}/admin/api/orders/${order.id}/stl?item=2`, { headers: auth });
  assert.equal(second.status, 200);
  assert.deepEqual(Buffer.from(await second.arrayBuffer()), B);
});

test('share links store the design once and serve a preview page and image', async () => {
  const design = Buffer.from(JSON.stringify({ text: 'Maya', secondLineText: '' })).toString('base64');
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(100, 9)]);
  const post = () => fetch(`${base}/api/share`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ design, image: 'data:image/jpeg;base64,' + jpeg.toString('base64') })
  });
  const first = await (await post()).json();
  const again = await (await post()).json();
  assert.match(first.id, /^[a-f0-9]{10}$/);
  assert.equal(first.id, again.id);

  const page = await (await fetch(`${base}/d/${first.id}`)).text();
  assert.match(page, /og:image" content="[^"]*\/d\/[a-f0-9]{10}\.jpg"/);
  assert.match(page, /Maya Hype Chain|Maya Chain|Maya/);
  assert.ok(page.includes(`/design/#design=${design}`));
  const img = await fetch(`${base}/d/${first.id}.jpg`);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');

  const bad = await fetch(`${base}/api/share`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ design: '<x>' })
  });
  assert.equal(bad.status, 400);
  assert.equal((await fetch(`${base}/d/zzzz`)).status, 404);
});

test('browser error reports are kept, de-duplicated and counted', async () => {
  const send = () => fetch(`${base}/api/client-error`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'Chain failed to load', where: 'chainLoader', page: '/design/' })
  });
  await send(); await send();
  const list = orders.getClientErrors();
  assert.equal(list[0].message, 'Chain failed to load');
  assert.equal(list[0].count, 2);
});

test('the admin login locks out after repeated failures', async () => {
  const bad = { authorization: 'Basic ' + Buffer.from('admin:nope').toString('base64') };
  let status = 0;
  for (let i = 0; i < 11; i++) status = (await fetch(`${base}/admin/api/orders`, { headers: bad })).status;
  assert.equal(status, 429);
});
