import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergePaymentSources } from '../src/utils/paymentMerge';
import { isValidGstin, validateGstin } from '../src/utils/validation';
import { gstinCheckChar } from '../src/tax/gstin';
import { csvEscape } from '../src/utils/csv';
import { daysSinceISO } from '../src/utils/dateLocal';

const withCheck = (first14: string) => first14 + gstinCheckChar(first14);
const GOOD = withCheck('21ABCDE1234F1Z');

test('form GSTIN check matches the tax engine (checksum + state code)', () => {
  assert.equal(isValidGstin(GOOD), true);
  assert.equal(validateGstin(GOOD), null);
  const typo = GOOD.slice(0, 5) + (GOOD[5] === 'X' ? 'Y' : 'X') + GOOD.slice(6);
  assert.equal(isValidGstin(typo), false);
  assert.match(String(validateGstin(typo)), /GSTIN/);
  assert.equal(isValidGstin(withCheck('00ABCDE1234F1Z')), false, 'unknown state code');
  assert.equal(isValidGstin(''), true, 'optional when empty');
  assert.match(String(validateGstin('', { required: true })), /required/);
});

const mapRow = (r: any) => ({ id: r.id, amount: r.amount, updatedAt: r.updated_at });

test('payments: empty shared collection is an answer, so the old mirror is NOT resurrected', () => {
  const out = mergePaymentSources({ legacy: [{ id: 'p1', amount: 5, updatedAt: '2026-01-01' }], collection: [], tableRows: [], mapRow });
  assert.deepEqual(out, []);
  const out2 = mergePaymentSources({ legacy: [{ id: 'p1', amount: 5, updatedAt: '2026-01-01' }], collection: { payments: [] }, tableRows: [], mapRow });
  assert.deepEqual(out2, []);
});

test('payments: old mirror is used only when nothing else answered', () => {
  const legacy = [{ id: 'p1', amount: 5, updatedAt: '2026-01-01' }];
  assert.equal(mergePaymentSources({ legacy, collection: null, tableRows: [], mapRow }).length, 1);
  assert.equal(mergePaymentSources({ legacy, collection: undefined, tableRows: null, mapRow }).length, 1);
});

test('payments: newest wins, ties go to the later source', () => {
  const out = mergePaymentSources<any>({
    collection: [{ id: 'p1', amount: 10, updatedAt: '2026-02-01T00:00:00Z' }],
    tableRows: [{ id: 'p1', amount: 20, updated_at: '2026-01-01T00:00:00Z' }],
    mapRow,
  });
  assert.equal(out[0].amount, 10);
  const tie = mergePaymentSources<any>({
    collection: [{ id: 'p1', amount: 10, updatedAt: '2026-02-01T00:00:00Z' }],
    tableRows: [{ id: 'p1', amount: 30, updated_at: '2026-02-01T00:00:00Z' }],
    mapRow,
  });
  assert.equal(tie[0].amount, 30);
});

test('payments: soft delete removes older copy but not one re-saved afterwards', () => {
  const del = { id: 'p1', deleted_at: '2026-03-01T00:00:00Z' };
  const gone = mergePaymentSources<any>({ collection: [{ id: 'p1', amount: 10, updatedAt: '2026-02-01T00:00:00Z' }], tableRows: [del], mapRow });
  assert.equal(gone.length, 0);
  const kept = mergePaymentSources<any>({ collection: [{ id: 'p1', amount: 10, updatedAt: '2026-04-01T00:00:00Z' }], tableRows: [del], mapRow });
  assert.equal(kept.length, 1);
});

test('csvEscape quotes CR/LF/comma/quote and defuses formulas, leaves numbers alone', () => {
  assert.equal(csvEscape('a,b'), '"a,b"');
  assert.equal(csvEscape('a\rb'), '"a\rb"');
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(csvEscape('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(csvEscape(-5), '-5');
  assert.equal(csvEscape(null), '');
});

test('daysSinceISO counts IST calendar days', () => {
  assert.equal(daysSinceISO('2026-11-24', '2026-11-24'), 0);
  assert.equal(daysSinceISO('2026-11-17', '2026-11-24'), 7);
  assert.equal(daysSinceISO('2026-12-01', '2026-11-24'), 0, 'never negative');
  assert.equal(daysSinceISO('', '2026-11-24'), 0);
});
