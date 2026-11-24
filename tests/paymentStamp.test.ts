import test from "node:test";
import assert from "node:assert/strict";
import { isNewerPayment, paymentContentKey, stampChangedPayments } from "../src/utils/paymentStamp";
import type { PaymentRecord } from "../src/types";

const base = (over: Partial<PaymentRecord> = {}): PaymentRecord => ({
  id: "pay_1",
  billId: 5,
  customerName: "Sharma Store",
  customerPhone: "9876543210",
  paymentDate: "2026-11-01",
  amount: 500,
  mode: "cash",
  referenceNote: "",
  recordedBy: "Admin",
  createdAt: "2026-11-01T10:00:00.000Z",
  ...over,
});

test("receipt turned into an advance (bill deleted) gets a newer updatedAt", () => {
  const prev = [base()];
  const next = [{ ...prev[0], billId: undefined, isAdvance: true }];
  const out = stampChangedPayments(prev, next, new Date("2026-11-20T09:00:00.000Z"));
  assert.notEqual(out, next);
  assert.equal(out[0].updatedAt, "2026-11-20T09:00:00.000Z");
  assert.equal(out[0].isAdvance, true);
});

test("unchanged list is returned as is", () => {
  const prev = [base()];
  assert.equal(stampChangedPayments(prev, prev), prev);
  const same = [{ ...prev[0] }];
  assert.equal(stampChangedPayments(prev, same), same);
});

test("key order does not count as a change", () => {
  const a = base();
  const b = JSON.parse(JSON.stringify(a, Object.keys(a).sort())) as PaymentRecord;
  assert.equal(paymentContentKey(a), paymentContentKey(b));
});

test("a record that arrives from the cloud with its own newer stamp is not re-stamped", () => {
  const prev = [base()];
  const remote = { ...prev[0], amount: 650, updatedAt: "2026-11-15T08:00:00.000Z" };
  const out = stampChangedPayments(prev, [remote], new Date("2026-11-20T09:00:00.000Z"));
  assert.equal(out[0].updatedAt, "2026-11-15T08:00:00.000Z");
});

test("new records are left alone and a clock that is behind still moves the stamp forward", () => {
  const prev = [base({ updatedAt: "2026-11-25T00:00:00.000Z" })];
  const edited = [{ ...prev[0], amount: 100 }, base({ id: "pay_2" })];
  const out = stampChangedPayments(prev, edited, new Date("2026-11-20T09:00:00.000Z"));
  assert.ok(Date.parse(out[0].updatedAt!) > Date.parse("2026-11-25T00:00:00.000Z"));
  assert.equal(out[1].updatedAt, undefined);
});

test("sync picks the strictly newer copy; equal stamps keep the local copy", () => {
  const local = base({ updatedAt: "2026-11-20T09:00:00.000Z", billId: undefined, isAdvance: true });
  const staleRemote = base({ updatedAt: "2026-11-01T10:00:00.000Z" });
  const sameStamp = { ...local, amount: 1 };
  assert.equal(isNewerPayment(staleRemote, local), false);
  assert.equal(isNewerPayment(sameStamp, local), false);
  assert.equal(isNewerPayment({ ...local, updatedAt: "2026-11-21T00:00:00.000Z" }, local), true);
  assert.equal(isNewerPayment(local, undefined), true);
});
