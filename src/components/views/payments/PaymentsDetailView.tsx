import React, { useState } from "react";
import {
  ArrowLeft,
  CreditCard,
  Edit2,
  FileText,
  MessageCircle,
  Phone,
  Printer,
  Trash2,
  User,
} from "lucide-react";
import { Bill, ExistingCustomer, OrganizationProfile, PaymentRecord } from "../../../types";
import { getInitials } from "../../ui/HomeKit";
import { money } from "../../../utils/billing";
import { todayISO } from "../../../utils/dateLocal";
import { resolveRemainingDueParts } from "../../../utils/paymentReceiptText";
import {
  sendPaymentReceiptOnWhatsApp,
  whatsAppPaymentReceiptMessage,
} from "../../../utils/whatsappPaymentReceipt";
import { notify } from "../../../utils/toast";
import { formatItemDate } from "./paymentsHelpers";

interface PaymentsDetailViewProps {
  payment: PaymentRecord;
  bills: Bill[];
  existingCustomers: ExistingCustomer[];
  orgProfile: OrganizationProfile;
  loggedInUserName: string;
  getCustomerRawBalance?: (p: PaymentRecord) => number;
  onBack: () => void;
  onEdit: (p: PaymentRecord) => void;
  onDelete: (p: PaymentRecord) => void;
  onPrintReceipt: (p: PaymentRecord) => void;
  onPromptWhatsApp: (p: PaymentRecord) => void;
  onOpenTaxInvoice: (b: Bill) => void;
}

export const PaymentsDetailView: React.FC<PaymentsDetailViewProps> = ({
  payment: p,
  bills,
  existingCustomers,
  orgProfile,
  loggedInUserName,
  getCustomerRawBalance,
  onBack,
  onEdit,
  onDelete,
  onPrintReceipt,
  onPromptWhatsApp,
  onOpenTaxInvoice,
}) => {
  const [sendingWa, setSendingWa] = useState(false);
  const linkedBill = p.billId ? bills.find((b) => b.id === p.billId) : null;
  const matchedCustomer = existingCustomers.find(
    (c) => c.name.trim().toLowerCase() === (p.customerName || "").trim().toLowerCase(),
  );
  const customerPhone = p.customerPhone || matchedCustomer?.phone || "";
  const rawBalance = getCustomerRawBalance
    ? getCustomerRawBalance(p)
    : matchedCustomer
      ? matchedCustomer.balanceDue > 0.004
        ? matchedCustomer.balanceDue
        : -(matchedCustomer.advance || 0)
      : 0;
  const { due: remainingDue, advance: advanceCredit } = resolveRemainingDueParts(rawBalance);

  const handleShareWhatsAppPdf = async () => {
    if (!customerPhone) {
      onPromptWhatsApp(p);
      return;
    }
    setSendingWa(true);
    try {
      const res = await sendPaymentReceiptOnWhatsApp(
        { ...p, customerPhone },
        orgProfile,
        { rawBalance },
      );
      const msg = whatsAppPaymentReceiptMessage(res);
      if (msg) notify(msg.text, msg.kind);
    } finally {
      setSendingWa(false);
    }
  };

  // Build a safe bill representation for the Tax Invoice modal
  const activeBillForInvoice: Bill = linkedBill || {
    id: typeof p.billId === "number" ? p.billId : 0,
    retailer: p.customerName || "Cash Sale",
    phone: p.customerPhone || matchedCustomer?.phone || "",
    date: p.paymentDate || p.createdAt?.slice(0, 10) || todayISO(),
    items: [
      {
        key: "item-1",
        productId: 0,
        productName: "Beverage & Packaged Water Supply",
        category: "water",
        gst: 18,
        priceType: "Wholesale",
        qty: 1,
        rate: p.amount,
        gross: p.amount,
        freeQty: 0,
        chargeableQty: 1,
        discount: 0,
        amount: p.amount,
      },
    ],
    amountPaid: p.amount,
    subtotal: Math.round((p.amount / 1.18) * 100) / 100,
    cgst: Math.round(((p.amount - Math.round((p.amount / 1.18) * 100) / 100) / 2) * 100) / 100,
    sgst: Math.round(((p.amount - Math.round((p.amount / 1.18) * 100) / 100) / 2) * 100) / 100,
    total: p.amount,
    discount: 0,
    paymentMode: p.mode,
    paymentDate: p.paymentDate || p.createdAt?.slice(0, 10),
    paymentNote: p.referenceNote,
  };

  return (
    <div id="view-payment-details" className="hh-view mw-workspace w-full space-y-4 sm:space-y-5">
      {/* Top Navigation - Back only, system ID removed */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-emerald-700 transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Payments</span>
        </button>
      </div>

      {/* Payment Amount Card with Billing Items Inline */}
      <div
        data-card-tone={p.amount < 0 ? "due" : "received"}
        className="rounded-2xl border p-4 sm:p-6 shadow-xs space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 pb-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className={`text-3xl sm:text-4xl font-black tracking-tight font-mono tabular-nums ${p.amount < 0 ? "text-rose-700" : "text-emerald-800"}`}>
              {p.amount < 0 ? "−" : "+"}₹{money(Math.abs(p.amount))}
            </h1>
            {/* Billing items inline with payment +/- sign */}
            {linkedBill && linkedBill.items && linkedBill.items.length > 0 ? (
              <div className="inline-flex items-center gap-1.5 flex-wrap text-xs sm:text-sm font-medium text-slate-700 bg-white/80 px-3 py-1.5 rounded-xl border border-black/5">
                <span className="font-bold text-slate-900">Invoice #{linkedBill.id}:</span>
                <div className="inline-flex items-center gap-1.5 flex-wrap">
                  {linkedBill.items.map((it, idx) => (
                    <span
                      key={it.key || idx}
                      className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs"
                    >
                      {it.productName} × {it.qty}
                    </span>
                  ))}
                </div>
              </div>
            ) : p.billId ? (
              <span className="text-xs sm:text-sm font-semibold text-slate-700 bg-white/80 px-2.5 py-1 rounded-lg border border-black/5">
                Invoice #{p.billId}
              </span>
            ) : null}
          </div>
        </div>

        {/* Cash line with Edit icon inline only */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 flex-wrap pt-0.5">
          <span>
            Received on <strong className="text-slate-900 font-semibold">{formatItemDate(p.paymentDate || p.createdAt)} ({p.paymentDate || p.createdAt?.slice(0, 10)})</strong>
            {" "}via <strong className="text-slate-900 font-bold uppercase">{p.mode}</strong>
          </span>
          {!p.isRefund && p.amount >= 0 && !p.reversalOf && (
            <button
              type="button"
              onClick={() => onEdit(p)}
              className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer ml-1 inline-flex items-center"
              title="Edit payment"
              aria-label="Edit payment"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2-Column Info Grid - No collection or credit stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Party Card */}
        <div data-card-tone="sales" className="rounded-2xl border p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-black/5">
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-blue-600" />
              Customer Party
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hh-avatar hh-avatar--sm hh-avatar--blue shrink-0">
              {getInitials(p.customerName || "C", "C")}
            </span>
            <div className="space-y-0.5 min-w-0">
              <h3 className="text-base font-extrabold text-slate-900 break-words">
                {p.customerName}
              </h3>
              {p.customerPhone || matchedCustomer?.phone ? (
                <div className="flex items-center gap-3">
                  <a
                    href={`tel:${p.customerPhone || matchedCustomer?.phone}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-700"
                  >
                    <Phone className="w-3.5 h-3.5 text-blue-500" />
                    <span>{p.customerPhone || matchedCustomer?.phone}</span>
                  </a>
                </div>
              ) : (
                <span className="text-xs text-slate-500 italic">No phone registered</span>
              )}
            </div>
          </div>
        </div>

        {/* Payment Details Card - System ID removed */}
        <div data-card-tone="neutral" className="rounded-2xl border p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-black/5">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-slate-600" />
              Payment Details
            </span>
            <span className="text-xs font-mono text-slate-500">{p.paymentDate || p.createdAt?.slice(0, 10)}</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/80 border border-black/5 px-2.5 py-2">
                <span className="text-slate-500 text-xs block font-semibold uppercase">Payment Method</span>
                <span className="font-bold text-slate-900 uppercase">{p.mode}</span>
              </div>
              <div className="rounded-xl bg-white/80 border border-black/5 px-2.5 py-2">
                <span className="text-slate-500 text-xs block font-semibold uppercase">Recorded By</span>
                <span className="font-bold text-slate-900">{p.recordedBy || loggedInUserName}</span>
              </div>
            </div>

            <div
              className={`rounded-xl border px-2.5 py-2 flex items-center justify-between ${
                remainingDue > 0
                  ? "bg-rose-50 border-rose-200"
                  : "bg-emerald-50 border-emerald-200"
              }`}
            >
              <span className="text-xs font-bold uppercase text-slate-600">
                Remaining Due (Till Date)
              </span>
              <span
                className={`font-black font-mono text-xs ${
                  remainingDue > 0 ? "text-rose-700" : "text-emerald-700"
                }`}
              >
                {remainingDue > 0
                  ? `₹${money(remainingDue)}`
                  : advanceCredit > 0
                    ? `₹0.00 (Adv ₹${money(advanceCredit)})`
                    : "₹0.00 (Settled)"}
              </span>
            </div>

            {p.referenceNote && (
              <div className="p-2.5 rounded-xl bg-white/80 border border-black/5">
                <span className="text-slate-500 text-xs block uppercase font-bold">Reference / UTR</span>
                <span className="font-mono text-slate-800 font-semibold text-xs mt-0.5 block">
                  {p.referenceNote}
                </span>
              </div>
            )}

            {(p.billId || linkedBill) && (
              <div className="p-2.5 rounded-xl bg-white/80 border border-black/5 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 text-xs block uppercase font-bold">Allocated Invoice</span>
                  <span className="font-mono text-slate-800 font-bold text-xs mt-0.5 block">
                    Invoice #{p.billId || linkedBill?.id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenTaxInvoice(activeBillForInvoice)}
                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="View Invoice"
                  aria-label="View Invoice"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar: Icon-only buttons (Delete, WhatsApp, Print Receipt, Invoice) */}
      <div data-card-tone="neutral" className="rounded-2xl border p-3 sm:p-4 shadow-xs flex items-center justify-between gap-3">
        {/* Delete button (icon only) */}
        <button
          type="button"
          onClick={() => onDelete(p)}
          className="p-3 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer shadow-xs inline-flex items-center justify-center shrink-0"
          title="Reverse payment (the original stays in the history)"
          aria-label="Reverse payment"
        >
          <Trash2 className="w-5 h-5" />
        </button>

        {/* WhatsApp, Print Receipt, and Invoice buttons */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* WhatsApp PDF Option */}
          <button
            type="button"
            onClick={handleShareWhatsAppPdf}
            disabled={sendingWa}
            className="p-3 rounded-xl text-white bg-[#25D366] hover:bg-[#1EBE5D] disabled:opacity-60 shadow-xs transition-colors cursor-pointer inline-flex items-center justify-center shrink-0"
            title="Share Payment Receipt PDF on WhatsApp"
            aria-label="Share Payment Receipt PDF on WhatsApp"
          >
            <MessageCircle className="w-5 h-5" />
          </button>

          {/* Print Receipt (icon only) */}
          <button
            type="button"
            onClick={() => onPrintReceipt(p)}
            className="p-3 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer shadow-xs inline-flex items-center justify-center shrink-0"
            title="Print Receipt"
            aria-label="Print Receipt"
          >
            <Printer className="w-5 h-5" />
          </button>

          {/* View / Print Tax Invoice (icon only) */}
          <button
            type="button"
            onClick={() => onOpenTaxInvoice(activeBillForInvoice)}
            className="p-3 rounded-xl text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer shadow-xs inline-flex items-center justify-center shrink-0"
            title="View Tax Invoice"
            aria-label="View Tax Invoice"
          >
            <FileText className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
