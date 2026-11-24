import test from "node:test";
import assert from "node:assert/strict";
import { billEditLockReason, gstr1DueDate } from "../src/utils/billEditLock";

test("GSTR-1 is due on the 11th of the next month (December rolls into January)", () => {
  assert.equal(gstr1DueDate("2026-10-15"), "2026-11-11");
  assert.equal(gstr1DueDate("2026-12-31T10:00:00Z"), "2027-01-11");
  assert.equal(gstr1DueDate(""), null);
});

test("an invoice stays editable until the 11th of the next month, then is final", () => {
  const bill = { date: "2026-10-20" };
  assert.equal(billEditLockReason(bill, "2026-10-31", false), null);
  assert.equal(billEditLockReason(bill, "2026-11-11", false), null);
  assert.match(billEditLockReason(bill, "2026-11-12", false)!, /October 2026.*11-11-2026.*Cancel it/);
});

test("the developer override and a missing date never lock", () => {
  assert.equal(billEditLockReason({ date: "2026-01-02" }, "2026-11-23", true), null);
  assert.equal(billEditLockReason({}, "2026-11-23", false), null);
});
