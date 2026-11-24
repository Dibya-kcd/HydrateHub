import React from "react";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Edit2,
  FileText,
  Phone,
  Receipt,
  RotateCcw,
  Share2,
  Trash2,
} from "lucide-react";
import { nameFromMap } from "../../../hooks/useAutoOdiaName";
import {
  Bill,
  BillingSettings,
  ExistingCustomer,
  PaymentRecord,
  Product,
} from "../../../types";
import { money } from "../../../utils/billing";
import { formatBillNumber, isGstExcludedBill } from "../../../utils/invoiceCommon";
import {
  formatEntryDate,
  type LedgerEntryWithBalance,
} from "./useCustomerDetailLedger";

export interface CustomerDetailDesktopSectionProps {
  customer: ExistingCustomer;
  language: "en" | "or";
  customerNameMap: Map<string, string>;
  billingSettings: BillingSettings;
  products: Product[];
  ledger: any;
  creditLimit: number;
  openingBal: number;
  balanceDue: number;
  rawBalance: number;
  isOverLimit: boolean;
  creditSummary: any;
  statementWaUrl: string | null;
  entriesWithBalance: LedgerEntryWithBalance[];
  setSelectedCustomer: React.Dispatch<React.SetStateAction<ExistingCustomer | null>>;
  setShowRecordPayment: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRefund: React.Dispatch<React.SetStateAction<boolean>>;
  onRouteBillAction: (bill: Bill, action: "edit" | "delete") => void;
  onRoutePaymentAction: (payment: PaymentRecord, action: "edit" | "delete") => void;
  setCustomerToDelete: React.Dispatch<React.SetStateAction<ExistingCustomer | null>>;
  openEditCustomer: (ec: ExistingCustomer) => void;
  startBillForCustomer: (name: string, phone?: string) => void;
  applyAdvanceToInvoices: (customerName: string) => void;
}

export const CustomerDetailDesktopSection: React.FC<CustomerDetailDesktopSectionProps> = ({
  customer: c,
  language,
  customerNameMap,
  billingSettings,
  products,
  ledger,
  creditLimit,
  openingBal,
  balanceDue,
  rawBalance,
  isOverLimit,
  creditSummary,
  statementWaUrl,
  entriesWithBalance,
  setSelectedCustomer,
  setShowRecordPayment,
  setShowRefund,
  onRouteBillAction,
  onRoutePaymentAction,
  setCustomerToDelete,
  openEditCustomer,
  startBillForCustomer,
  applyAdvanceToInvoices,
}) => (
  <>
    {/* Sticky header — works on mobile & desktop */}
    <div className="sticky top-0 z-20 bg-[var(--bg)]/95 backdrop-blur border-b border-black/5 px-0 py-3 flex items-center gap-2 sm:gap-3 w-full">
      <button
        type="button"
        onClick={() => {
          setSelectedCustomer(null);
          setShowRecordPayment(false);
        }}
        className="p-2 -ml-1 rounded-full hover:bg-black/5 cursor-pointer shrink-0"
        aria-label="Back"
      >
        <ArrowLeft className="w-5 h-5 text-slate-800" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-base sm:text-lg font-bold text-slate-900 min-w-0 break-words lg:truncate">
          {nameFromMap(customerNameMap, c, language)}
        </h1>
        <p className="text-xs text-slate-500 min-w-0 break-words lg:truncate">
          {c.phone || "No phone"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => openEditCustomer(c)}
        className="text-sm font-semibold text-[var(--primary)] px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-[var(--primary)]/10 cursor-pointer shrink-0"
      >
        Edit
      </button>
    </div>

    <div className="hh-detail-cols px-0 py-4 space-y-3 w-full">
      {/* Summary card */}
      <div
        data-card-tone={
          rawBalance < 0 ? "received" : balanceDue > 0 ? "due" : "sales"
        }
        className="rounded-2xl border shadow-sm p-4 space-y-3 transition-colors"
      >
        <div className="flex flex-wrap justify-between items-baseline gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                rawBalance < 0
                  ? "text-emerald-800"
                  : balanceDue > 0
                    ? "text-rose-800"
                    : "text-slate-600"
              }`}
            >
              {rawBalance < 0 ? "Advance on Account" : "Balance due"}
            </span>
            {rawBalance < 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-600 text-white shadow-xs">
                ADVANCE CREDIT
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOverLimit && (
              <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                Over limit
              </span>
            )}
            <span
              className={`text-xl sm:text-2xl font-black tabular-nums ${
                rawBalance < 0
                  ? "text-emerald-700"
                  : balanceDue > 0
                    ? "text-rose-600"
                    : "text-emerald-700"
              }`}
            >
              {rawBalance < 0
                ? `₹${money(Math.abs(rawBalance))} (Advance)`
                : `₹${money(balanceDue)}`}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div className="rounded-xl bg-white/75 border border-black/5 px-2.5 py-2">
            <div className="text-xs text-slate-500">Total billed</div>
            <div className="font-bold text-slate-900 tabular-nums">
              ₹{money(ledger.totalBilled)}
            </div>
          </div>
          {(ledger.totalReturns || 0) > 0 && (
            <div className="rounded-xl bg-white/75 border border-black/5 px-2.5 py-2">
              <div className="text-xs text-slate-500">Sales returns</div>
              <div className="font-bold text-blue-700 tabular-nums">
                -₹{money(ledger.totalReturns)}
              </div>
            </div>
          )}
          {openingBal !== 0 && (
            <div className="rounded-xl bg-white/75 border border-black/5 px-2.5 py-2">
              <div className="text-xs text-slate-500">Opening bal.</div>
              <div className="font-bold text-slate-900 tabular-nums">
                ₹{money(openingBal)}
              </div>
            </div>
          )}
          <div className="rounded-xl bg-white/75 border border-black/5 px-2.5 py-2">
            <div className="text-xs text-slate-500">Total paid</div>
            <div className="font-bold text-emerald-700 tabular-nums">
              ₹{money(ledger.totalPaid)}
            </div>
          </div>
          <div className="rounded-xl bg-white/75 border border-black/5 px-2.5 py-2">
            <div className="text-xs text-slate-500">Credit limit</div>
            <div className="font-bold text-slate-900 tabular-nums">
              {creditLimit > 0 ? `₹${money(creditLimit)}` : "No limit"}
            </div>
          </div>
        </div>
      </div>

      {/* Address */}
      {(c.address || c.city || c.gstin) && (
        <div
          data-card-tone="neutral"
          className="rounded-2xl border shadow-sm p-4 space-y-1.5 text-sm"
        >
          {c.address && <p className="text-slate-700">{c.address}</p>}
          {c.city && <p className="text-slate-500">{c.city}</p>}
          {c.gstin && (
            <p className="font-mono text-xs text-slate-600">
              GSTIN {c.gstin}
            </p>
          )}
        </div>
      )}

      {/* Advance / credit: use it on unpaid invoices or pay it back */}
      {(creditSummary.advance > 0.004 || creditSummary.overpaid > 0.004 || creditSummary.refundable > 0.004) && (
        <div className="p-3 rounded-xl border border-sky-200 bg-sky-50 text-sky-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            {creditSummary.advance > 0.004 && <>Advance on account: <b>₹{money(creditSummary.advance)}</b>. </>}
            {creditSummary.overpaid > 0.004 && <>Paid above invoice value (returns): <b>₹{money(creditSummary.overpaid)}</b>. </>}
            {creditSummary.refundable > 0.004 && <>Net credit owed to customer: <b>₹{money(creditSummary.refundable)}</b>.</>}
          </span>
          <span className="flex gap-2 shrink-0">
            {creditSummary.canApply && (
              <button
                type="button"
                onClick={() => applyAdvanceToInvoices(c.name)}
                className="px-3 py-1.5 rounded-lg bg-sky-700 text-white font-bold hover:bg-sky-800 cursor-pointer"
              >
                Use on unpaid invoices
              </button>
            )}
            {creditSummary.refundable > 0.004 && (
              <button
                type="button"
                onClick={() => setShowRefund(true)}
                className="px-3 py-1.5 rounded-lg bg-white border border-sky-300 text-sky-900 font-bold hover:bg-sky-100 cursor-pointer"
              >
                Refund to customer
              </button>
            )}
          </span>
        </div>
      )}

      {/* Primary actions — stack on narrow screens, row on sm+ */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => startBillForCustomer(c.name, c.phone)}
          className="flex-1 py-3 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm cursor-pointer active:scale-[0.99] flex items-center justify-center gap-1.5"
        >
          <FileText className="w-4 h-4" />
          New bill
        </button>
        <button
          type="button"
          onClick={() => setShowRecordPayment(true)}
          className="flex-1 py-3 rounded-xl bg-white border border-[var(--primary)]/30 text-[var(--primary)] font-semibold text-sm cursor-pointer active:scale-[0.99] flex items-center justify-center gap-1.5"
        >
          <CreditCard className="w-4 h-4" />
          Record payment
        </button>
        {statementWaUrl && (
          <a
            href={statementWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-emerald-100"
          >
            <Share2 className="w-4 h-4 text-emerald-700" /> Share
          </a>
        )}
        <div className="flex gap-2">
          {c.phone && (
            <a
              href={`tel:${c.phone}`}
              className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-white border border-black/10 text-slate-800 font-semibold text-sm flex items-center justify-center gap-1.5"
            >
              <Phone className="w-4 h-4" /> Call
            </a>
          )}
          <button
            type="button"
            onClick={() => setCustomerToDelete(c)}
            className="px-3 py-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 cursor-pointer"
            aria-label="Delete customer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ledger */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Receipt className="w-4 h-4 text-[var(--primary)]" />
            Customer ledger
          </h2>
          <span className="text-xs text-slate-500">
            {entriesWithBalance.length} entr
            {entriesWithBalance.length === 1 ? "y" : "ies"}
          </span>
        </div>

        {entriesWithBalance.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No transactions yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Create a bill or record a payment to start the ledger
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-black/5">
            {entriesWithBalance.map((entry) => {
              if (entry.kind === "opening") {
                return (
                  <li
                    key={entry.id}
                    className="px-3 sm:px-4 py-3 flex gap-3 items-start"
                  >
                    <div className="mt-0.5 hh-icon-badge hh-icon-badge--sm hh-icon-badge--slate">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-slate-800">
                          Opening balance
                        </span>
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            entry.amount > 0
                              ? "text-rose-600"
                              : "text-emerald-700"
                          }`}
                        >
                          {entry.amount > 0 ? "+" : ""}₹
                          {money(Math.abs(entry.amount))}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">
                          {formatEntryDate(entry.date)}
                        </span>
                        <span className="text-xs text-slate-400 tabular-nums">
                          Bal {entry.runningBalance < 0 ? `₹${money(Math.abs(entry.runningBalance))} (Adv)` : `₹${money(entry.runningBalance)}`}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              }

              if (entry.kind === "return") {
                const ret = entry.salesReturn;
                return (
                  <li
                    key={entry.id}
                    className="px-3 sm:px-4 py-3 flex gap-3 items-start group"
                  >
                    <div className="mt-0.5 hh-icon-badge hh-icon-badge--sm hh-icon-badge--blue">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-slate-800">
                          Sales Return {ret.creditNoteNo ? `· CN #${ret.creditNoteNo}` : ""}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-blue-700">
                          −₹{money(entry.amount)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="text-xs text-slate-500">
                          {formatEntryDate(entry.date)}
                        </span>
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                          {isGstExcludedBill(entry.bill, products) ? "Memo" : "Invoice"} #{formatBillNumber(entry.bill, billingSettings)}
                        </span>
                        {ret.reason && (
                          <span className="text-xs text-slate-400 truncate max-w-[10rem] sm:max-w-xs">
                            {ret.reason}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 tabular-nums ml-auto">
                          Bal {entry.runningBalance < 0 ? `₹${money(Math.abs(entry.runningBalance))} (Adv)` : `₹${money(entry.runningBalance)}`}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              }

              if (entry.kind === "bill") {
                const b = entry.bill;
                const invNo = formatBillNumber(b, billingSettings);
                const isNg = isGstExcludedBill(b, products);
                return (
                  <li
                    key={entry.id}
                    className="px-3 sm:px-4 py-3 flex gap-3 items-start group"
                  >
                    <div className="mt-0.5 hh-icon-badge hh-icon-badge--sm hh-icon-badge--amber">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5">
                          <span>{isNg ? "Cash Memo" : "Bill"} {invNo}</span>
                          {isNg && (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 uppercase">
                              Non-GST
                            </span>
                          )}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-rose-600">
                          +₹{money(entry.amount)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="text-xs text-slate-500">
                          {formatEntryDate(entry.date)}
                        </span>
                        {entry.due > 0 && (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-rose-50 text-rose-600">
                            Due ₹{money(entry.due)}
                          </span>
                        )}
                        {entry.due <= 0 && (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                            Paid
                          </span>
                        )}
                        <span className="text-xs text-slate-400 tabular-nums ml-auto">
                          Bal {entry.runningBalance < 0 ? `₹${money(Math.abs(entry.runningBalance))} (Adv)` : `₹${money(entry.runningBalance)}`}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => onRouteBillAction(b, "edit")}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] px-2 py-1 rounded-lg hover:bg-[var(--primary)]/10 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" /> Edit in Billing
                        </button>
                        <button
                          type="button"
                          onClick={() => onRouteBillAction(b, "delete")}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Delete in Billing
                        </button>
                      </div>
                    </div>
                  </li>
                );
              }

              // payment
              const p = entry.payment;
              const modeLabel = (p.mode || "cash").toUpperCase();
              return (
                <li
                  key={entry.id}
                  className="px-3 sm:px-4 py-3 flex gap-3 items-start group"
                >
                  <div className="mt-0.5 hh-icon-badge hh-icon-badge--sm hh-icon-badge--green">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                      <span className="text-sm font-semibold text-slate-800">
                        {p.isRefund ? "Refund paid" : "Payment"}
                        {p.billId ? ` · Bill #${p.billId}` : ""}
                      </span>
                      <span className={`text-sm font-bold tabular-nums ${entry.amount < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                        {entry.amount < 0 ? "+" : "−"}₹{money(Math.abs(entry.amount))}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-slate-500">
                        {formatEntryDate(entry.date)}
                      </span>
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {modeLabel}
                      </span>
                      {p.referenceNote && (
                        <span className="text-xs text-slate-400 truncate max-w-[10rem] sm:max-w-xs">
                          {p.referenceNote}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 tabular-nums ml-auto">
                        Bal {entry.runningBalance < 0 ? `₹${money(Math.abs(entry.runningBalance))} (Adv)` : `₹${money(entry.runningBalance)}`}
                      </span>
                    </div>
                    {!entry.isLegacy && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {!p.isRefund && (
                        <button
                          type="button"
                          onClick={() => onRoutePaymentAction(p, "edit")}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] px-2 py-1 rounded-lg hover:bg-[var(--primary)]/10 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" /> Edit in Payments
                        </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRoutePaymentAction(p, "delete")}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Delete in Payments
                        </button>
                      </div>
                    )}
                    {entry.isLegacy && (
                      <p className="text-xs text-slate-400 mt-1">
                        Linked to invoice payment (edit via bill)
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  </>
);
