import { daysSinceISO } from "../../../utils/dateLocal";
import React from "react";
import {
  CheckCircle2,
  CreditCard,
  IndianRupee,
  Package,
  Receipt,
  Search,
  Wallet,
  X,
} from "lucide-react";
import {
  Bill,
  BillingSettings,
  PaymentAuditEntry,
  PaymentMode,
  PaymentRecord,
  Product,
} from "../../../types";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getInitials } from "../../ui/HomeKit";
import { money } from "../../../utils/billing";
import { InvoicePicker } from "../../common/InvoicePicker";
import { isAdvanceAdjustmentRow, signedPaymentAmount } from "../../../utils/paymentAllocation";
import { billBalance } from "../../../utils/salesReturns";
import { PaymentAuditModal } from "../../common/PaymentAuditModal";
import { PartySearchSelect, type PartyOption } from "../../common/PartySearchSelect";
import { formatPaymentId } from "../../../utils/beatReports";
import { formatBillNumber, isGstExcludedBill } from "../../../utils/invoiceCommon";
import { PaymentReportsPanel } from "./PaymentReportsPanel";
import { HISTORY_PAGE, formatItemDate, toStandardIsoDate } from "./paymentsHelpers";

interface PaymentsDesktopViewProps {
  realtimeCashInBox: number;
  cashExpenses: number;
  totalMarketDue: number;
  totalInwardSpend: number;
  totalBilledSales: number;
  totalCollectedAmount: number;
  loggedInUserName: string;
  todayStr: string;
  yesterdayStr: string;
  formFeedback: { type: "success" | "error"; text: string } | null;
  setFormFeedback: (v: { type: "success" | "error"; text: string } | null) => void;
  isCustomParty: boolean;
  setIsCustomParty: (v: boolean) => void;
  customPartyName: string;
  setCustomPartyName: (v: string) => void;
  selectedParty: string;
  setSelectedParty: (v: string) => void;
  partyOptions: PartyOption[];
  selectedOpt?: PartyOption;
  partyBills: Bill[];
  selectedBillId: number | undefined;
  setSelectedBillId: (id: number | undefined) => void;
  paymentMode: PaymentMode;
  setPaymentMode: (m: PaymentMode) => void;
  amount: string;
  setAmount: (v: string) => void;
  numericAmount: number;
  receiptDate: string;
  setReceiptDate: (v: string) => void;
  referenceNote: string;
  setReferenceNote: (v: string) => void;
  handleRecordReceipt: (e: React.FormEvent) => void;
  activeTab: "recent" | "due" | "history" | "reports";
  setActiveTab: (tab: "recent" | "due" | "history" | "reports") => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  historyVisible: number;
  setHistoryVisible: React.Dispatch<React.SetStateAction<number>>;
  recentAll: PaymentRecord[];
  filteredRecent: PaymentRecord[];
  historyAll: PaymentRecord[];
  filteredHistory: PaymentRecord[];
  historyGroups: { date: string; rows: PaymentRecord[]; total: number }[];
  dueBills: Bill[];
  filteredDueBills: Bill[];
  getEffectiveBillBalance: (b: Bill) => number;
  billingSettings: BillingSettings;
  products: Product[];
  paymentAudit: PaymentAuditEntry[];
  showAuditLog: boolean;
  setShowAuditLog: (v: boolean) => void;
  onSelectPaymentForDetails: (p: PaymentRecord) => void;
}

export const PaymentsDesktopView: React.FC<PaymentsDesktopViewProps> = ({
  realtimeCashInBox,
  cashExpenses,
  totalMarketDue,
  totalInwardSpend,
  totalBilledSales,
  totalCollectedAmount,
  loggedInUserName,
  todayStr,
  yesterdayStr,
  formFeedback,
  setFormFeedback,
  isCustomParty,
  setIsCustomParty,
  customPartyName,
  setCustomPartyName,
  selectedParty,
  setSelectedParty,
  partyOptions,
  selectedOpt,
  partyBills,
  selectedBillId,
  setSelectedBillId,
  paymentMode,
  setPaymentMode,
  amount,
  setAmount,
  numericAmount,
  receiptDate,
  setReceiptDate,
  referenceNote,
  setReferenceNote,
  handleRecordReceipt,
  activeTab,
  setActiveTab,
  searchTerm,
  setSearchTerm,
  historyVisible,
  setHistoryVisible,
  recentAll,
  filteredRecent,
  historyAll,
  filteredHistory,
  historyGroups,
  dueBills,
  filteredDueBills,
  getEffectiveBillBalance,
  billingSettings,
  products,
  paymentAudit,
  showAuditLog,
  setShowAuditLog,
  onSelectPaymentForDetails,
}) => {
  const { t } = useLanguage();

  // One list of receipts, shared by Recent and History: table on desktop, compact rows on mobile
  const renderPaymentList = (rows: PaymentRecord[], emptyText: string) => {
    if (rows.length === 0) {
      return emptyText ? (
        <div
          data-card-tone="neutral"
          className="rounded-2xl border shadow-xs py-8 text-center text-xs text-slate-500 font-medium"
        >
          {emptyText}
        </div>
      ) : null;
    }
    return (
      <>
        <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
          <table className="w-full min-w-[560px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/90 bg-slate-50/70">
                {["ITEM", "DETAILS", "VALUE", "STATUS"].map((h) => (
                  <th key={h} className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p, idx) => {
                const isReversal = Boolean(p.reversalOf);
                const isRefund = !isReversal && Boolean(p.isRefund || p.amount < 0);
                return (
                  <tr
                    key={p.id || idx}
                    onClick={() => onSelectPaymentForDetails(p)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    title="Click to view payment details"
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-800 text-sm whitespace-nowrap">{formatPaymentId(p.id, idx)}</td>
                    <td className="py-3.5 px-4 text-slate-500 text-sm">
                      {p.customerName} · {formatItemDate(p.paymentDate || p.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800 text-sm whitespace-nowrap">
                      {p.amount < 0 ? "−" : ""}₹{money(Math.abs(p.amount))}
                    </td>
                    <td
                      className={`py-3.5 px-4 font-medium text-sm whitespace-nowrap ${
                        isReversal ? "text-amber-700" : isRefund ? "text-rose-600" : "text-teal-600"
                      }`}
                    >
                      {isReversal ? "Reversed" : isRefund ? "Refunded" : "Received"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="block md:hidden space-y-2.5">
          {rows.map((p, idx) => {
            const isReversal = Boolean(p.reversalOf);
            const isRefund = Boolean(p.isRefund || p.amount < 0);
            return (
              <div
                key={p.id || idx}
                data-card-tone={isRefund ? "due" : "received"}
                onClick={() => onSelectPaymentForDetails(p)}
                className="rounded-2xl border px-3.5 py-3 shadow-xs flex items-center justify-between gap-3 active:scale-[0.99] cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className={`hh-avatar hh-avatar--sm shrink-0 ${isRefund ? "hh-avatar--rose" : "hh-avatar--green"}`}>
                    {getInitials(p.customerName || "C", "C")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-slate-900 text-sm min-w-0 break-words lg:truncate">{p.customerName}</div>
                    <div className="text-slate-600 text-xs mt-0.5 min-w-0 break-words lg:truncate font-medium">
                      {formatPaymentId(p.id, idx)} · {formatItemDate(p.paymentDate || p.createdAt)} · {String(p.mode || "").toUpperCase()}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`font-black text-[15px] tabular-nums ${isRefund ? "text-rose-700" : "text-emerald-800"}`}>
                    {p.amount < 0 ? "−" : "+"}₹{money(Math.abs(p.amount))}
                  </div>
                  <span
                    className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                      isReversal
                        ? "bg-amber-100/90 text-amber-800"
                        : isRefund
                          ? "bg-rose-100/90 text-rose-800"
                          : "bg-emerald-100/90 text-emerald-800"
                    }`}
                  >
                    {isReversal ? "Reversed" : isRefund ? "Refunded" : "Received"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div id="view-payments" className="hh-view mw-workspace w-full space-y-5">
      {/* 1. Header with History Log Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Payments
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowAuditLog(true)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            Audit log
          </button>
        </div>
      </div>
      {showAuditLog && (
        <PaymentAuditModal entries={paymentAudit} onClose={() => setShowAuditLog(false)} />
      )}

      {/* Realtime Cash in Box & Financial Summary Cards (Option A Soft-Tinted Fintech Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div data-card-tone="received" className="border rounded-2xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider leading-tight">Cash in Box (Till)</span>
            <div className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--green shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-emerald-950 mt-1">
            ₹{money(realtimeCashInBox)}
          </div>
          <p className="text-xs text-emerald-800/80 font-medium mt-1">
            {cashExpenses > 0 ? `Net drawer cash (less ₹${money(cashExpenses)} paid)` : "Realtime drawer cash"}
          </p>
        </div>

        <div data-card-tone="due" className="border rounded-2xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-bold text-rose-900 uppercase tracking-wider leading-tight">Market Credit Due</span>
            <div className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--rose shrink-0">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-rose-700 mt-1">
            ₹{money(totalMarketDue)}
          </div>
          <p className="text-xs text-rose-800/80 font-medium mt-1">
            Pending customer dues (after returns)
          </p>
        </div>

        <div data-card-tone="sales" className="border rounded-2xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wider leading-tight">Total Inward Spend</span>
            <div className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--blue shrink-0">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900 mt-1">
            ₹{money(totalInwardSpend)}
          </div>
          <p className="text-xs text-blue-900/75 font-medium mt-1">
            Total purchase spend (GRNs)
          </p>
        </div>

        <div data-card-tone="profit" className="border rounded-2xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-bold text-purple-900 uppercase tracking-wider leading-tight">Total Billed Sales</span>
            <div className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--purple shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-slate-900 mt-1">
            ₹{money(totalBilledSales)}
          </div>
          <p className="text-xs text-purple-900/75 font-medium mt-1">
            Collected: ₹{money(totalCollectedAmount)}
          </p>
        </div>
      </div>

      {/* Feedback Alert if any */}
      {formFeedback && (
        <div
          className={`p-3.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 border ${
            formFeedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {formFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <X className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{formFeedback.text}</span>
          </div>
          <button
            aria-label="Close"
            type="button"
            onClick={() => setFormFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Record Receipt Form Card (Clean, Symmetrical 2-Column Grid) */}
      <div data-card-tone="received" className="rounded-2xl border shadow-xs p-4 sm:p-6">
        <div className="pb-4 mb-5 border-b border-black/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="hh-icon-badge hh-icon-badge--green shrink-0">
              <Receipt className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900">Record Payment Receipt</h2>
              <p className="text-xs text-slate-600">Collect dues, allocate against invoices, and record payments</p>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-600 bg-white/80 border border-black/5 px-2.5 py-1 rounded-full shrink-0">
            Staff: <strong className="text-slate-900">{loggedInUserName}</strong>
          </span>
        </div>

        <form onSubmit={handleRecordReceipt} className="grid gap-6 lg:grid-cols-2">
          {/* LEFT BOX: Party Selection & Due Status */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold tracking-wider text-slate-600 uppercase block">
                  PARTY / CUSTOMER
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomParty(!isCustomParty);
                    setCustomPartyName("");
                    setSelectedParty("");
                    setSelectedBillId(undefined);
                  }}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                >
                  {isCustomParty ? "← Select from list" : "+ Enter custom name"}
                </button>
              </div>

              {isCustomParty ? (
                <input
                  type="text"
                  value={customPartyName}
                  onChange={(e) => setCustomPartyName(e.target.value)}
                  placeholder="Enter customer or supplier name..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                />
              ) : (
                <PartySearchSelect
                  options={partyOptions}
                  value={selectedParty}
                  onSelect={(name, opt) => {
                    setSelectedParty(name);
                    setSelectedBillId(undefined);
                    setAmount(opt && opt.due > 0 ? String(opt.due) : "");
                  }}
                />
              )}
            </div>

            {/* Selected Party Due Highlight Card */}
            {selectedOpt && (
              <div className="p-3.5 rounded-xl bg-white/85 border border-black/5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-medium block">Selected Account</span>
                  <p className="text-sm font-bold text-slate-900 min-w-0 break-words lg:truncate">{selectedParty}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold font-mono tabular-nums text-rose-600">
                    ₹{money(Math.max(0, selectedOpt.due))}
                  </p>
                  <span className="text-xs font-semibold text-rose-700 uppercase">
                    {t("collect.totalDue")}
                  </span>
                </div>
              </div>
            )}

            {/* Invoice Picker */}
            {selectedOpt && (
              <div className="pt-1">
                <label className="text-xs font-semibold tracking-wider text-slate-600 uppercase block mb-1.5">
                  ALLOCATE TO INVOICE
                </label>
                <InvoicePicker
                  bills={partyBills}
                  selectedId={selectedBillId}
                  amount={isNaN(numericAmount) ? 0 : numericAmount}
                  onSelect={(id, due) => {
                    setSelectedBillId(id);
                    if (due > 0) setAmount(String(Math.round(due * 100) / 100));
                  }}
                />
              </div>
            )}

            {selectedOpt && partyBills.every((b) => billBalance(b) <= 0.004) && (
              <p className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-800 font-medium">
                No unpaid invoice for this party. Payment will be credited as an advance for the next bill.
              </p>
            )}
          </div>

          {/* RIGHT BOX: Payment Mode, Amount, Date & UTR */}
          <div className="space-y-4">
            {/* Mode Selector */}
            <div>
              <label className="text-xs font-semibold tracking-wider text-slate-600 uppercase block mb-1.5">
                PAYMENT MODE
              </label>
              <div
                role="group"
                aria-label={t("collect.mode")}
                className="grid grid-cols-3 sm:grid-cols-5 gap-2"
              >
                {(
                  [
                    { id: "cash", label: "Cash" },
                    { id: "upi", label: "UPI" },
                    { id: "cheque", label: "Cheque" },
                    { id: "bank", label: "Bank" },
                    { id: "other", label: "Other" },
                  ] as const
                ).map((opt) => {
                  const active = paymentMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPaymentMode(opt.id as PaymentMode)}
                      className={`min-h-[44px] px-2.5 py-2 rounded-xl border text-xs sm:text-sm font-bold leading-tight text-center cursor-pointer transition-colors ${
                        active
                          ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:border-emerald-600/50 hover:text-slate-900"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount Field with ₹ Prefix & Quick Full-Pay */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="payment-receipt-amount" className="text-xs font-semibold tracking-wider text-slate-600 uppercase block">
                  RECEIPT AMOUNT (₹)
                </label>
                {selectedOpt && selectedOpt.due > 0 && (
                  <button
                    type="button"
                    onClick={() => { setSelectedBillId(undefined); setAmount(String(selectedOpt.due)); }}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer flex items-center gap-1"
                  >
                    <span>{t("collect.payFull")}:</span>
                    <span className="font-mono tabular-nums font-bold">₹{money(selectedOpt.due)}</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">₹</span>
                <input
                  id="payment-receipt-amount"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-200 bg-white font-mono tabular-nums font-bold text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                />
              </div>
            </div>

            {/* Date and Reference Side-by-Side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="payment-receipt-date-input"
                    className="text-xs font-semibold tracking-wider text-slate-600 uppercase"
                  >
                    RECEIPT DATE
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setReceiptDate(todayStr)}
                      className={`px-1.5 py-0.5 text-xs font-bold rounded transition-colors cursor-pointer ${
                        receiptDate === todayStr
                          ? "bg-emerald-700 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptDate(yesterdayStr)}
                      className={`px-1.5 py-0.5 text-xs font-bold rounded transition-colors cursor-pointer ${
                        receiptDate === yesterdayStr
                          ? "bg-emerald-700 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Yesterday
                    </button>
                  </div>
                </div>
                <input
                  id="payment-receipt-date-input"
                  type="date"
                  required
                  value={toStandardIsoDate(receiptDate)}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                />
              </div>

              <div>
                <label htmlFor="payment-receipt-ref" className="text-xs font-semibold tracking-wider text-slate-600 uppercase block mb-1.5">
                  REFERENCE / UTR
                </label>
                <input
                  id="payment-receipt-ref"
                  type="text"
                  value={referenceNote}
                  onChange={(e) => setReferenceNote(e.target.value)}
                  placeholder="UPI ref, cheque no., note"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                />
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="pt-2 space-y-1.5">
              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-bold text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{t("collect.saveReceipt")}</span>
              </button>
              <p className="text-center text-xs text-slate-500">{t("collect.whatsappNote")}</p>
            </div>
          </div>
        </form>
      </div>

      {/* 3. Tabs: Recent (today) · Due invoices · History · Reports */}
      <div
        role="tablist"
        aria-label="Payment views"
        className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold overflow-x-auto no-scrollbar max-w-full"
      >
        {(
          [
            { id: "recent", label: `Recent (${recentAll.length})`, tone: "text-slate-900" },
            { id: "due", label: `Due (${dueBills.length})`, tone: "text-rose-700" },
            { id: "history", label: `History (${historyAll.length})`, tone: "text-slate-900" },
            { id: "reports", label: "Reports", tone: "text-emerald-800" },
          ] as const
        ).map((tb) => (
          <button
            key={tb.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tb.id}
            onClick={() => setActiveTab(tb.id)}
            className={`flex-1 px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tb.id ? `bg-white ${tb.tone} shadow-xs font-bold` : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Search (Recent, Due and History) */}
      {activeTab !== "reports" && (
        <div className="relative md:max-w-xs md:ml-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            enterKeyHint="search"
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setHistoryVisible(HISTORY_PAGE);
            }}
            placeholder={activeTab === "due" ? "Search customer or invoice" : "Search payments"}
            className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700 placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              aria-label="Clear search"
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Recent: today's receipts */}
      {activeTab === "recent" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Today · {formatItemDate(todayStr)}</span>
            <span>
              {(() => {
                const recentNet = recentAll.reduce(
                  (sum, p) => (isAdvanceAdjustmentRow(p) ? sum : sum + signedPaymentAmount(p)),
                  0,
                );
                return `${recentAll.length} receipt${recentAll.length === 1 ? "" : "s"} · ${recentNet < -0.004 ? "−" : ""}₹${money(Math.abs(recentNet))}`;
              })()}
            </span>
          </div>
          {renderPaymentList(filteredRecent, recentAll.length === 0 ? "No receipts today yet. Older ones are in History." : "No payment receipts match your search")}
        </div>
      )}

      {/* History: everything before today */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {historyGroups.length === 0 ? (
            renderPaymentList([], historyAll.length === 0 ? "No older receipts yet." : "No payment receipts match your search")
          ) : (
            historyGroups.map((g) => (
              <div key={g.date} className="space-y-1.5">
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="font-bold text-slate-800">{formatItemDate(g.date)} · {g.date}</span>
                  <span className="text-slate-500">
                    {g.rows.length} · ₹{money(g.total)}
                  </span>
                </div>
                {renderPaymentList(g.rows, "")}
              </div>
            ))
          )}
          {filteredHistory.length > historyVisible && (
            <button
              type="button"
              onClick={() => setHistoryVisible((v) => v + HISTORY_PAGE)}
              className="w-full py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Show more ({filteredHistory.length - historyVisible} left)
            </button>
          )}
        </div>
      )}

      {/* 5. Tab 2: Due / Credit Invoices View */}
      {activeTab === "due" && (
        <div className="space-y-3">
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto">
            <table className="w-full min-w-[560px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/90 bg-slate-50/70">
                  <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    ITEM
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    DETAILS
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    BALANCE DUE
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    STATUS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDueBills.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-slate-400 italic">
                      All customer invoices are settled! No outstanding dues.
                    </td>
                  </tr>
                ) : (
                  filteredDueBills.map((b) => {
                    const due = getEffectiveBillBalance(b);
                    const daysOld = b.date
                      ? daysSinceISO(b.date)
                      : 0;
                    return (
                      <tr
                        key={b.id}
                        onClick={() => {
                          setSelectedParty(b.retailer || "");
                          setAmount(String(due));
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        title="Click to populate Record Receipt form above"
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-800 text-sm whitespace-nowrap">
                          <span>{formatBillNumber(b, billingSettings)}</span>
                          {isGstExcludedBill(b, products) && (
                            <span className="ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 uppercase">
                              Non-GST
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-sm">
                          {b.retailer || "Cash Sale"} · {formatItemDate(b.date || "")}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-rose-700 text-sm whitespace-nowrap">
                          ₹{money(due)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`text-xs font-bold ${daysOld > 7 ? "text-rose-600" : "text-amber-700"}`}>
                            {daysOld > 7 ? `Overdue (${daysOld}d)` : "Due"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="block md:hidden space-y-2.5">
            {filteredDueBills.length === 0 ? (
              <div
                data-card-tone="received"
                className="rounded-2xl border py-8 text-center text-xs text-emerald-800 font-semibold shadow-xs"
              >
                All customer invoices are settled!
              </div>
            ) : (
              filteredDueBills.map((b) => {
                const due = getEffectiveBillBalance(b);
                const daysOld = b.date
                  ? daysSinceISO(b.date)
                  : 0;
                const overdue = daysOld > 7;
                return (
                  <div
                    key={b.id}
                    data-card-tone={overdue ? "due" : "warning"}
                    onClick={() => {
                      setSelectedParty(b.retailer || "");
                      setAmount(String(due));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="rounded-2xl border px-3.5 py-3 shadow-xs flex items-center justify-between gap-3 active:scale-[0.99] cursor-pointer transition-all"
                    title="Click to populate Record Receipt form"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className={`hh-avatar hh-avatar--sm shrink-0 ${overdue ? "hh-avatar--rose" : "hh-avatar--amber"}`}>
                        {getInitials(b.retailer || "Cash Sale", "C")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-slate-900 text-sm break-words leading-snug">
                          {b.retailer || "Cash Sale"}
                        </div>
                        <div className="text-slate-600 text-xs mt-0.5 flex items-center gap-1.5 flex-wrap font-medium">
                          <span>{formatBillNumber(b, billingSettings)}</span>
                          <span>·</span>
                          <span>{formatItemDate(b.date || "")}</span>
                          {isGstExcludedBill(b, products) && (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 uppercase">
                              Non-GST
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-black text-[15px] tabular-nums ${overdue ? "text-rose-700" : "text-amber-900"}`}>
                        ₹{money(due)}
                      </div>
                      <span
                        className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                          overdue ? "bg-rose-100/90 text-rose-800" : "bg-amber-100/90 text-amber-800"
                        }`}
                      >
                        {overdue ? `Overdue ${daysOld}d` : "Due"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Reports: total, day-wise, beat-wise, customer-wise (each downloadable) */}
      {activeTab === "reports" && <PaymentReportsPanel />}
    </div>
  );
};
