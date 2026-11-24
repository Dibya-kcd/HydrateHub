import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPaymentReceiptCaption,
  buildPaymentReceiptRows,
  paymentReceiptPdfFilename,
} from "../src/utils/paymentReceiptText";
import {
  preloadReceipt80,
  sendPaymentReceiptOnWhatsApp,
  whatsAppPaymentReceiptMessage,
} from "../src/utils/whatsappPaymentReceipt";

await preloadReceipt80();

const payment: any = {
  id: "pay_1042",
  billId: 1042,
  customerName: "Sri Jagannath General Store",
  customerPhone: "9437012345",
  paymentDate: "2026-11-23",
  amount: 1000,
  mode: "upi",
  referenceNote: "UTR-884210",
  recordedBy: "Ramesh",
};

const org: any = {
  name: "Hydrate Hub",
  address: "Industrial Estate",
  city: "Sambalpur",
  phone: "9876543210",
  gstin: "21AAAAA0000A1Z5",
};

function setBrowser(nav: any, opened: string[]) {
  Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true });
  (globalThis as any).window = { open: (u: string) => { opened.push(u); return null; } };
}

test("payment receipt rows include amount received and remaining due till date", () => {
  const rows = buildPaymentReceiptRows(payment, org, { rawBalance: 1450.5, asOfDate: "2026-11-23" });
  const serialized = JSON.stringify(rows);
  assert.match(serialized, /PAYMENT RECEIPT/);
  assert.match(serialized, /1,000\.00/);
  assert.match(serialized, /Remaining Due \(Till Date\)/);
  assert.match(serialized, /1,450\.50/);
  assert.match(serialized, /Balance as of 2026-11-23/);
});

test("payment receipt rows handle settled and advance credit accounts cleanly", () => {
  const settled = JSON.stringify(buildPaymentReceiptRows(payment, org, { rawBalance: 0 }));
  assert.match(settled, /Rs 0\.00 \(Settled\)/);

  const advance = JSON.stringify(buildPaymentReceiptRows(payment, org, { rawBalance: -350 }));
  assert.match(advance, /Advance Credit/);
  assert.match(advance, /350\.00/);
});

test("payment receipt rows support refund receipts", () => {
  const refundPay = { ...payment, amount: -250, isRefund: true };
  const serialized = JSON.stringify(buildPaymentReceiptRows(refundPay, org, { rawBalance: 0 }));
  assert.match(serialized, /PAYMENT REFUND RECEIPT/);
  assert.match(serialized, /Amount Refunded/);
  assert.match(serialized, /250\.00/);
});

test("caption includes remaining total due till date and customer summary", () => {
  const caption = buildPaymentReceiptCaption(payment, org, { rawBalance: 440 });
  assert.match(caption, /Hydrate Hub/);
  assert.match(caption, /Payment Receipt/);
  assert.match(caption, /Sri Jagannath General Store/);
  assert.match(caption, /₹1,000\.00/);
  assert.match(caption, /Remaining Total Due \(Till Date\): ₹440\.00/);
});

test("filename is clean and ends in -80mm.pdf", () => {
  const name = paymentReceiptPdfFilename(payment);
  assert.match(name, /^Receipt_.*Sri_Jagannath_General_Store_80mm\.pdf$/);
});

test("mobile Web Share attaches one 80 mm PDF receipt with remaining total due in caption", async () => {
  let shared: any = null;
  setBrowser({ canShare: () => true, share: async (d: any) => { shared = d; } }, []);
  const res = await sendPaymentReceiptOnWhatsApp(payment, org, { rawBalance: 440, asOfDate: "2026-11-23" });
  assert.equal(res, "shared");
  assert.equal(shared.files.length, 1);
  assert.equal(shared.files[0].type, "application/pdf");
  assert.match(shared.files[0].name, /80mm\.pdf$/);
  assert.ok(shared.files[0].size > 500);
  assert.match(shared.text, /Remaining Total Due \(Till Date\): ₹440\.00/);
  assert.equal(whatsAppPaymentReceiptMessage(res), null);
});

test("user cancels share sheet: returns cancelled without fallback window.open", async () => {
  const opened: string[] = [];
  setBrowser(
    { canShare: () => true, share: async () => { const e: any = new Error("abort"); e.name = "AbortError"; throw e; } },
    opened,
  );
  const res = await sendPaymentReceiptOnWhatsApp(payment, org, { rawBalance: 0 });
  assert.equal(res, "cancelled");
  assert.equal(opened.length, 0);
});

test("desktop fallback opens wa.me with customer phone and remaining due caption", async () => {
  const opened: string[] = [];
  setBrowser({}, opened);
  const res = await sendPaymentReceiptOnWhatsApp(payment, org, { rawBalance: 850 });
  assert.equal(res, "downloaded");
  assert.equal(opened.length, 1);
  assert.match(opened[0], /^https:\/\/wa\.me\/919437012345\?text=/);
  const decoded = decodeURIComponent(opened[0].split("text=")[1]);
  assert.match(decoded, /Remaining Total Due \(Till Date\): ₹850\.00/);
  assert.equal(whatsAppPaymentReceiptMessage(res)?.kind, "info");
});
