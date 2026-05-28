// Tests for pricing math and the order/export security boundaries.
// Run with: npm test  (uses Node's built-in test runner, no deps)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePrice, isValidOrderId, isValidExportId } from '../api/orders.js';

test('computePrice: single unit is full price', () => {
  assert.deepEqual(computePrice(1), { paidItems: 1, totalCents: 2500 });
});

test('computePrice: two and three units have no discount', () => {
  assert.deepEqual(computePrice(2), { paidItems: 2, totalCents: 5000 });
  assert.deepEqual(computePrice(3), { paidItems: 3, totalCents: 7500 });
});

test('computePrice: buy 3 get 1 free at quantity 4', () => {
  assert.deepEqual(computePrice(4), { paidItems: 3, totalCents: 7500 });
});

test('computePrice: every 4th item is free', () => {
  assert.deepEqual(computePrice(7), { paidItems: 6, totalCents: 15000 });
  assert.deepEqual(computePrice(8), { paidItems: 6, totalCents: 15000 });
  assert.deepEqual(computePrice(12), { paidItems: 9, totalCents: 22500 });
});

test('isValidOrderId: accepts generated order IDs', () => {
  assert.equal(isValidOrderId('ORD-K9X2-DEADBEEF'), true);
  assert.equal(isValidOrderId('ORD-abc123'), true);
});

test('isValidOrderId: rejects path traversal and bad input', () => {
  assert.equal(isValidOrderId('../etc/passwd'), false);
  assert.equal(isValidOrderId('ORD/../../secret'), false);
  assert.equal(isValidOrderId('ORD.json'), false);
  assert.equal(isValidOrderId('has space'), false);
  assert.equal(isValidOrderId(''), false);
  assert.equal(isValidOrderId(null), false);
  assert.equal(isValidOrderId(undefined), false);
});

test('isValidExportId: accepts lowercase hex', () => {
  assert.equal(isValidExportId('deadbeef'), true);
  assert.equal(isValidExportId('0123456789abcdef'), true);
});

test('isValidExportId: rejects traversal, uppercase, and bad input', () => {
  assert.equal(isValidExportId('../foo'), false);
  assert.equal(isValidExportId('DEADBEEF'), false);
  assert.equal(isValidExportId('xyz'), false);
  assert.equal(isValidExportId('ab.cd'), false);
  assert.equal(isValidExportId(''), false);
  assert.equal(isValidExportId(null), false);
});
