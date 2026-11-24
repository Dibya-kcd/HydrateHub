import React from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  Edit2,
  MessageCircle,
  Phone,
  Trash2,
} from "lucide-react";
import { nameFromMap } from "../../../hooks/useAutoOdiaName";
import {
  Bill,
  BillingSettings,
  ExistingCustomer,
  PaymentRecord,
} from "../../../types";
import { money } from "../../../utils/billing";
import { formatBillNumber } from "../../../utils/invoiceCommon";
import {
  formatPhoneLedgerDate,
  type LedgerEntryWithBalance,
} from "./useCustomerDetailLedger";

export interface CustomerDetailPhoneSectionProps {
  customer: ExistingCustomer;
  language: "en" | "or";
  t: (key: string, vars?: Record<string, string | number>) => string;
  customerNameMap: Map<string, string>;
  billingSettings: BillingSettings;
  ledger: any;
  creditLimit: number;
  openingBal: number;
  balanceDue: number;
  rawBalance: number;
  isOverLimit: boolean;
  creditSummary: any;
  hasAdvanceScreen: boolean;
  creditLimitPct: number;
  customerTypeLabel: string;
  statementWaText: string;
  statementWaUrl: string | null;
  phoneLedgerEntries: LedgerEntryWithBalance[];
  phoneDetailTab: "summary" | "ledger";
  setPhoneDetailTab: React.Dispatch<React.SetStateAction<"summary" | "ledger">>;
  ledgerFilter: "all" | "bill" | "payment" | "return";
  setLedgerFilter: React.Dispatch<React.SetStateAction<"all" | "bill" | "payment" | "return">>;
  expandedLedgerEntryId: string | null;
  setExpandedLedgerEntryId: React.Dispatch<React.SetStateAction<string | null>>;
  waPhonePrompt: { text: string; input: string } | null;
  setWaPhonePrompt: React.Dispatch<React.SetStateAction<{ text: string; input: string } | null>>;
  setShowRecordPayment: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRefund: React.Dispatch<React.SetStateAction<boolean>>;
  onRouteBillAction: (bill: Bill, action: "edit" | "delete") => void;
  onRoutePaymentAction: (payment: PaymentRecord, action: "edit" | "delete") => void;
  setCustomerToDelete: React.Dispatch<React.SetStateAction<ExistingCustomer | null>>;
  setSelectedCustomer: React.Dispatch<React.SetStateAction<ExistingCustomer | null>>;
  openEditCustomer: (ec: ExistingCustomer) => void;
  startBillForCustomer: (name: string, phone?: string) => void;
  applyAdvanceToInvoices: (customerName: string) => void;
}

export const CustomerDetailPhoneSection: React.FC<CustomerDetailPhoneSectionProps> = ({
  customer: c,
  language,
  t,
  customerNameMap,
  billingSettings,
  ledger,
  creditLimit,
  openingBal,
  balanceDue,
  rawBalance,
  isOverLimit,
  creditSummary,
  hasAdvanceScreen,
  creditLimitPct,
  customerTypeLabel,
  statementWaText,
  statementWaUrl,
  phoneLedgerEntries,
  phoneDetailTab,
  setPhoneDetailTab,
  ledgerFilter,
  setLedgerFilter,
  expandedLedgerEntryId,
  setExpandedLedgerEntryId,
  waPhonePrompt,
  setWaPhonePrompt,
  setShowRecordPayment,
  setShowRefund,
  onRouteBillAction,
  onRoutePaymentAction,
  setCustomerToDelete,
  setSelectedCustomer,
  openEditCustomer,
  startBillForCustomer,
  applyAdvanceToInvoices,
}) => (
  <>
    <div className="hh-sales-top">
      <div className="hh-sales-top__row">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => {
              if (phoneDetailTab === "ledger") {
                setPhoneDetailTab("summary");
                setExpandedLedgerEntryId(null);
                return;
              }
              setSelectedCustomer(null);
              setPhoneDetailTab("summary");
              setExpandedLedgerEntryId(null);
              setShowRecordPayment(false);
            }}
            className="hh-sales-top__iconbtn"
            aria-label={t("common.back")}
          >
            <ChevronLeft className="w-6 h-6" strokeWidth={2.2} />
          </button>
          <h1 className="hh-sales-top__title break-words min-w-0">
            {nameFromMap(customerNameMap, c, language)}
          </h1>
        </div>
        <span className="hh-sales-top__pill shrink-0">
          {phoneDetailTab === "ledger"
            ? t("parties.ledger")
            : hasAdvanceScreen
              ? t("parties.credit")
              : customerTypeLabel}
        </span>
      </div>
    </div>

    {phoneDetailTab === "ledger" ? (
      <div className="space-y-3 mt-1">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {([
            { id: "all", label: t("common.all") },
            { id: "bill", label: t("parties.bills") },
            { id: "payment", label: t("parties.payments") },
            { id: "return", label: t("parties.returns") },
          ] as const).map((chip) => (
            <button
              key={chip.id}
              type="button"
              aria-pressed={ledgerFilter === chip.id}
              onClick={() => setLedgerFilter(chip.id)}
              className="rt-chip shrink-0"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {phoneLedgerEntries.length === 0 ? (
          <div className="rt-card px-5 py-10 text-center text-[13px]" style={{ color: "var(--text-2)" }}>
            {t("parties.noLedgerItems")}
          </div>
        ) : (
          <div className="hh-timeline pt-1">
            {phoneLedgerEntries.map((entry) => {
              if (entry.kind === "opening") {
                return (
                  <div key={entry.id} className="hh-timeline__item">
                    <span className="hh-timeline__dot" />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-bold" style={{ color: "var(--text)" }}>
                          {t("parties.openingBalance")}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-2)" }}>
                          {formatPhoneLedgerDate(entry.date)}
                        </div>
                      </div>
                      <div
                        className="text-[13.5px] font-extrabold tabular-nums shrink-0"
                        style={{ color: entry.amount > 0 ? "var(--due)" : "var(--paid)" }}
                      >
                        {entry.amount > 0 ? "+" : "−"}₹{money(Math.abs(entry.amount))}
                      </div>
                    </div>
                  </div>
                );
              }

              if (entry.kind === "return") {
                const ret = entry.salesReturn;
                return (
                  <div key={entry.id} className="hh-timeline__item">
                    <span className="hh-timeline__dot" />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-bold break-words" style={{ color: "var(--text)" }}>
                          {t("parties.salesReturn")}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-2)" }}>
                          {formatPhoneLedgerDate(entry.date)}
                          {ret.creditNoteNo ? ` · CN-${ret.creditNoteNo}` : ""}
                        </div>
                      </div>
                      <div className="text-[13.5px] font-extrabold tabular-nums shrink-0" style={{ color: "var(--paid)" }}>
                        −₹{money(entry.amount)}
                      </div>
                    </div>
                  </div>
                );
              }

              if (entry.kind === "bill") {
                const b = entry.bill;
                const invNo = formatBillNumber(b, billingSettings);
                const qtyCases = (b.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0);
                const isExpanded = expandedLedgerEntryId === entry.id;
                return (
                  <div key={entry.id} className="hh-timeline__item">
                    <span className="hh-timeline__dot" />
                    <button
                      type="button"
                      onClick={() => setExpandedLedgerEntryId(isExpanded ? null : entry.id)}
                      className="w-full text-left flex items-start justify-between gap-2 bg-transparent border-0 p-0 cursor-pointer"
                      style={{ minHeight: "36px" }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-bold break-words" style={{ color: "var(--text)" }}>
                          {t("parties.billPrefix")} {invNo}
                        </span>
                        <span className="block text-xs mt-0.5" style={{ color: "var(--text-2)" }}>
                          {formatPhoneLedgerDate(entry.date)} · {t("trips.casesCount", { n: qtyCases })}
                        </span>
                      </span>
                      <span className="text-[13.5px] font-extrabold tabular-nums shrink-0" style={{ color: "var(--due)" }}>
                        +₹{money(entry.amount)}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="flex items-center gap-3 mt-1.5 pb-1">
                        <button
                          type="button"
                          onClick={() => onRouteBillAction(b, "edit")}
                          className="text-xs font-bold bg-transparent border-0 p-0 cursor-pointer"
                          style={{ color: "var(--primary)", minHeight: "28px" }}
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRouteBillAction(b, "delete")}
                          className="text-xs font-bold bg-transparent border-0 p-0 cursor-pointer"
                          style={{ color: "var(--due)", minHeight: "28px" }}
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              const p = entry.payment;
              const isExpanded = expandedLedgerEntryId === entry.id;
              const modeText =
                String(p.mode || "cash").toLowerCase() === "upi"
                  ? "UPI"
                  : String(p.mode || "cash").toLowerCase() === "bank"
                    ? "Bank"
                    : String(p.mode || "cash").toLowerCase() === "cheque"
                      ? "Cheque"
                      : String(p.mode || "cash").toLowerCase() === "other"
                        ? "Other"
                        : "Cash";
              return (
                <div key={entry.id} className="hh-timeline__item">
                  <span className={`hh-timeline__dot ${entry.amount < 0 ? "hh-timeline__dot--due" : "hh-timeline__dot--paid"}`} />
                  <button
                    type="button"
                    onClick={() => !entry.isLegacy && setExpandedLedgerEntryId(isExpanded ? null : entry.id)}
                    className="w-full text-left flex items-start justify-between gap-2 bg-transparent border-0 p-0 cursor-pointer"
                    style={{ minHeight: "36px" }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-bold break-words" style={{ color: "var(--text)" }}>
                        {p.isRefund ? t("pay.refundTag") : t("parties.paymentPrefix")} · {modeText}
                      </span>
                      <span className="block text-xs mt-0.5" style={{ color: "var(--text-2)" }}>
                        {formatPhoneLedgerDate(entry.date)}
                        {p.referenceNote ? ` · ${p.referenceNote}` : p.billId ? ` · INV-${p.billId}` : ` · RCT-${String(p.id).slice(-4).toUpperCase()}`}
                      </span>
                    </span>
                    <span
                      className="text-[13.5px] font-extrabold tabular-nums shrink-0"
                      style={{ color: entry.amount < 0 ? "var(--due)" : "var(--paid)" }}
                    >
                      {entry.amount < 0 ? "+" : "−"}₹{money(Math.abs(entry.amount))}
                    </span>
                  </button>
                  {!entry.isLegacy && isExpanded && (
                    <div className="flex items-center gap-3 mt-1.5 pb-1">
                      {!p.isRefund && (
                        <button
                          type="button"
                          onClick={() => onRoutePaymentAction(p, "edit")}
                          className="text-xs font-bold bg-transparent border-0 p-0 cursor-pointer"
                          style={{ color: "var(--primary)", minHeight: "28px" }}
                        >
                          {t("common.edit")}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRoutePaymentAction(p, "delete")}
                        className="text-xs font-bold bg-transparent border-0 p-0 cursor-pointer"
                        style={{ color: "var(--due)", minHeight: "28px" }}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    ) : hasAdvanceScreen ? (
      <div className="space-y-3 mt-1">
        <div className="hh-hist-card hh-hist-card--paid space-y-1.5">
          <div className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
            {t("parties.netCreditOwed")}
          </div>
          <div className="text-[30px] font-extrabold tracking-tight tabular-nums leading-none" style={{ color: "var(--paid)" }}>
            ₹{money(Math.abs(rawBalance) || creditSummary.refundable)}
          </div>
          <div className="text-[12px] pt-1" style={{ color: "var(--text-2)" }}>
            {t("parties.advanceOnAccount", {
              amt: `₹${money(creditSummary.advance || Math.abs(rawBalance))}`,
            })}
          </div>
        </div>

        <div className="rt-noti">
          <span>{t("parties.advanceNotice")}</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => startBillForCustomer(c.name, c.phone)}
            className="rt-btn"
          >
            {t("parties.newSale")}
          </button>
          <button
            type="button"
            onClick={() => setShowRefund(true)}
            disabled={creditSummary.refundable <= 0.004}
            className="rt-btn-outline rt-btn-outline--primary"
          >
            {t("parties.refundAmt", {
              amt: `₹${money(creditSummary.refundable || Math.abs(rawBalance))}`,
            })}
          </button>
        </div>

        {creditSummary.canApply && (
          <button
            type="button"
            onClick={() => applyAdvanceToInvoices(c.name)}
            className="rt-btn-outline w-full"
          >
            {t("parties.applyToUnpaid")}
          </button>
        )}

        <button
          type="button"
          onClick={() => setPhoneDetailTab("ledger")}
          className="rt-btn-outline w-full"
        >
          {t("parties.customerLedger")}
        </button>

        {statementWaUrl ? (
          <a
            href={statementWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rt-btn-outline w-full flex items-center justify-center gap-2 no-underline"
            style={{ borderColor: "var(--paid)", color: "var(--paid)" }}
          >
            <MessageCircle size={16} />
            {t("parties.whatsappReminder")}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setWaPhonePrompt({ text: statementWaText, input: "" })}
            className="rt-btn-outline w-full flex items-center justify-center gap-2"
            style={{ borderColor: "var(--paid)", color: "var(--paid)" }}
          >
            <MessageCircle size={16} />
            {t("parties.whatsappReminder")}
          </button>
        )}

        <div className="flex items-center justify-center gap-5 pt-1">
          {c.phone && (
            <a
              href={`tel:${c.phone}`}
              className="inline-flex items-center gap-1.5 text-[13px] font-bold no-underline"
              style={{ color: "var(--primary)", minHeight: "44px" }}
            >
              <Phone size={14} /> {c.phone}
            </a>
          )}
          <button
            type="button"
            onClick={() => openEditCustomer(c)}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold bg-transparent border-0 cursor-pointer"
            style={{ color: "var(--primary)", minHeight: "44px" }}
          >
            <Edit2 size={14} /> {t("common.edit")}
          </button>
          <button
            type="button"
            onClick={() => setCustomerToDelete(c)}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold bg-transparent border-0 cursor-pointer"
            style={{ color: "var(--due)", minHeight: "44px" }}
          >
            <Trash2 size={14} /> {t("common.delete")}
          </button>
        </div>
      </div>
    ) : (
      <div className="space-y-3 mt-1">
        <div className="rt-kv-grid">
          <div className="rt-kv">
            <div className="rt-kv__label">{t("parties.totalBilled")}</div>
            <div className="rt-kv__val">₹{money(ledger.totalBilled)}</div>
          </div>
          <div className="rt-kv">
            <div className="rt-kv__label">{t("parties.totalPaid")}</div>
            <div className="rt-kv__val" style={{ color: "var(--paid)" }}>₹{money(ledger.totalPaid)}</div>
          </div>
          <div className="rt-kv">
            <div className="rt-kv__label">{t("parties.openingBal")}</div>
            <div className="rt-kv__val">₹{money(openingBal)}</div>
          </div>
          <div className="rt-kv">
            <div className="rt-kv__label">{t("parties.salesReturns")}</div>
            <div className="rt-kv__val">₹{money(ledger.totalReturns || 0)}</div>
          </div>
        </div>

        <div className="rt-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
                {t("parties.balanceDue")}
              </div>
              <div
                className="text-[28px] font-extrabold tracking-tight tabular-nums leading-tight mt-0.5"
                style={{ color: balanceDue > 0.004 ? "var(--due)" : "var(--paid)" }}
              >
                ₹{money(balanceDue)}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
                {t("parties.creditLimit")}
              </div>
              <div className="text-[15px] font-extrabold tabular-nums mt-0.5" style={{ color: "var(--text)" }}>
                {creditLimit > 0 ? `₹${money(creditLimit)}` : "—"}
              </div>
              {creditLimit > 0 && (
                <div className="rt-meter mt-2 ml-auto w-24" aria-hidden="true">
                  <div
                    className="rt-meter__fill"
                    style={{
                      width: `${creditLimitPct}%`,
                      background: isOverLimit ? "var(--due)" : "var(--primary)",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {(creditSummary.canApply || creditSummary.advance > 0.004) && (
          <div className="rt-noti flex-col items-stretch gap-2">
            <span>
              {t("parties.advanceOnAccount", {
                amt: `₹${money(creditSummary.advance)}`,
              })}
            </span>
            <div className="flex gap-2">
              {creditSummary.canApply && (
                <button
                  type="button"
                  onClick={() => applyAdvanceToInvoices(c.name)}
                  className="rt-btn flex-1"
                  style={{ minHeight: "38px", fontSize: "12px" }}
                >
                  {t("parties.applyToUnpaid")}
                </button>
              )}
              {creditSummary.refundable > 0.004 && (
                <button
                  type="button"
                  onClick={() => setShowRefund(true)}
                  className="rt-btn-outline flex-1"
                  style={{ minHeight: "38px", fontSize: "12px" }}
                >
                  {t("parties.refundAmt", { amt: `₹${money(creditSummary.refundable)}` })}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setShowRecordPayment(true)}
            className="rt-btn"
          >
            {t("parties.recordPayment")}
          </button>
          <button
            type="button"
            onClick={() => startBillForCustomer(c.name, c.phone)}
            className="rt-btn-outline rt-btn-outline--primary"
          >
            {t("parties.newSale")}
          </button>
        </div>

        {statementWaUrl ? (
          <a
            href={statementWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rt-btn-outline w-full flex items-center justify-center gap-2 no-underline"
            style={{ borderColor: "var(--paid)", color: "var(--paid)" }}
          >
            {t("parties.whatsappReminder")}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setWaPhonePrompt({ text: statementWaText, input: "" })}
            className="rt-btn-outline w-full flex items-center justify-center gap-2"
            style={{ borderColor: "var(--paid)", color: "var(--paid)" }}
          >
            {t("parties.whatsappReminder")}
          </button>
        )}

        <button
          type="button"
          onClick={() => setPhoneDetailTab("ledger")}
          className="rt-btn-outline w-full"
        >
          {t("parties.customerLedger")}
        </button>

        <div className="flex items-center justify-center gap-5 pt-1">
          {c.phone && (
            <a
              href={`tel:${c.phone}`}
              className="inline-flex items-center gap-1.5 text-[13px] font-bold no-underline"
              style={{ color: "var(--primary)", minHeight: "44px" }}
            >
              <Phone size={14} /> {c.phone}
            </a>
          )}
          <button
            type="button"
            onClick={() => openEditCustomer(c)}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold bg-transparent border-0 cursor-pointer"
            style={{ color: "var(--primary)", minHeight: "44px" }}
          >
            <Edit2 size={14} /> {t("common.edit")}
          </button>
          <button
            type="button"
            onClick={() => setCustomerToDelete(c)}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold bg-transparent border-0 cursor-pointer"
            style={{ color: "var(--due)", minHeight: "44px" }}
          >
            <Trash2 size={14} /> {t("common.delete")}
          </button>
        </div>
      </div>
    )}

    {waPhonePrompt &&
      createPortal(
        <div
          className="rt-bsheet-scrim"
          onClick={() => setWaPhonePrompt(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
            <div className="hh-grab" />
            <div className="text-[16px] font-extrabold" style={{ color: "var(--text)" }}>
              {t("parties.whatsappReminder")}
            </div>
            <label className="rt-in">
              <span className="rt-in__label uppercase">{t("parties.phoneLabel")}</span>
              <input
                className="rt-in__control"
                type="tel"
                inputMode="tel"
                placeholder="98765 43210"
                value={waPhonePrompt.input}
                onChange={(e) => setWaPhonePrompt((prev) => (prev ? { ...prev, input: e.target.value } : null))}
                autoFocus
              />
            </label>
            <button
              type="button"
              disabled={waPhonePrompt.input.replace(/\D/g, "").length < 10}
              onClick={() => {
                const digits = waPhonePrompt.input.replace(/\D/g, "");
                const dest = digits.length === 10 ? `91${digits}` : digits;
                const url = `https://wa.me/${dest}?text=${encodeURIComponent(waPhonePrompt.text)}`;
                window.location.assign(url);
                setWaPhonePrompt(null);
              }}
              className="rt-btn rt-btn--wa w-full"
            >
              <MessageCircle size={16} /> {t("parties.whatsappReminder")}
            </button>
          </div>
        </div>,
        document.body,
      )}
  </>
);
