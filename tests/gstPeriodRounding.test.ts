import test from "node:test";
import assert from "node:assert/strict";
import { computeGstPeriodSummary } from "../src/utils/gstReports";

test("period GST totals carry no floating-point dust", () => {
  const line = (t: number, c: number) => ({ taxable: t, cgst: c, sgst: c, igst: 0, cess: 0 }) as any;
  const lines = Array.from({ length: 10 }, () => line(0.1, 0.01));
  const s = computeGstPeriodSummary(lines);
  assert.equal(s.outputTaxable, 1);
  assert.equal(s.outputCgst, 0.1);
  assert.equal(s.totalOutputGst, 0.2);
});
