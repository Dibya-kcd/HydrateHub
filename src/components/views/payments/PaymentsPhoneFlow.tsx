import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, Search, X } from "lucide-react";
import {
  Bill,
  BillingSettings,
  Customer,
  ExistingCustomer,
  OrganizationProfile,
  PaymentMode,
  PaymentRecord,
} from "../../../types";
import { useLanguage } from "../../../i18n/LanguageContext";
import { useBeats } from "../../../hooks/useBeats";
import { getInitials } from "../../ui/HomeKit";
import { money } from "../../../utils/billing";
import { allocateReceipt } from "../../../utils/paymentAllocation";
import { billBalance } from "../../../utils/salesReturns";
import { formatPaymentId } from "../../../utils/beatReports";
import { formatBillNumber } from "../../../utils/invoiceCommon";
import { resolveRemainingDueParts } from "../../../utils/paymentReceiptText";
import {
  sendPaymentReceiptOnWhatsApp,
  whatsAppPaymentReceiptMessage,
} from "../../../utils/whatsappPaymentReceipt";
import { notify } from "../../../utils/toast";
import { type PartyOption } from "../../common/PartySearchSelect";
import {
  formatDateLongDisplay,
  formatItemDate,
  getModeLabelText,
  toStandardIsoDate,
} from "./paymentsHelpers";

interface PaymentsPhoneRefundViewProps {
  orig: PaymentRecord;
  allPayments: PaymentRecord[];
  todayStr: string;
  refundAmount: string;
  setRefundAmount: (v: string) => void;
  refundMode: PaymentMode;
  setRefundMode: (m: PaymentMode) => void;
  refundNote: string;
  setRefundNote: (v: string) => void;
  refundError: string | null;
  setRefundError: (v: string | null) => void;
  getCustomerCreditSummary: (name: string) => { refundable: number };
  recordCustomerRefund: (
    customerName: string,
    amount: number,
    paymentDate: string,
    mode?: PaymentMode,
    note?: string,
  ) => boolean;
  onClose: () => void;
}

export const PaymentsPhoneRefundView: React.FC<PaymentsPhoneRefundViewProps> = ({
  orig,
  allPayments,
  todayStr,
  refundAmount,
  setRefundAmount,
  refundMode,
  setRefundMode,
  refundNote,
  setRefundNote,
  refundError,
  setRefundError,
  getCustomerCreditSummary,
  recordCustomerRefund,
  onClose,
}) => {
  const { t } = useLanguage();
  const modeLabelText = (mode: PaymentMode, isRefund?: boolean) =>
    getModeLabelText(t, mode, isRefund);

  const credit = getCustomerCreditSummary(orig.customerName);
  const custRefundIds = new Set(
    allPayments
      .filter(
        (x) =>
          (x.isRefund || x.entryKind === "refund") &&
          (x.customerName || "").trim().toLowerCase() === (orig.customerName || "").trim().toLowerCase(),
      )
      .map((x) => String(x.id)),
  );
  const reversedCustRefundIds = new Set(
    allPayments
      .filter((x) => x.reversalOf && custRefundIds.has(String(x.reversalOf)))
      .map((x) => String(x.reversalOf)),
  );
  const alreadyRefunded = allPayments
    .filter(
      (x) =>
        custRefundIds.has(String(x.id)) &&
        !reversedCustRefundIds.has(String(x.id)),
    )
    .reduce((s, x) => s + Math.abs(Number(x.amount) || 0), 0);
  const maxRefundable = Math.max(0, credit.refundable);

  return (
    <div id="view-payments" className="rt-flow-phone">
      <div className="hh-sales-top">
        <div className="hh-sales-top__row">
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="hh-sales-top__iconbtn"
              aria-label={t("common.back")}
            >
              <ChevronLeft size={24} strokeWidth={2.2} />
            </button>
            <h1 className="hh-sales-top__title">{t("pay.refund")}</h1>
          </div>
          <span className="hh-sales-top__pill shrink-0">{orig.customerName}</span>
        </div>
      </div>

      <div className="rt-flow-phone__body space-y-3">
        <div className="rt-card rt-card--divided">
          <div className="rt-ln">
            <span style={{ color: "var(--text-2)" }}>{t("pay.originalPayment")}</span>
            <span className="font-bold tabular-nums" style={{ color: "var(--text)" }}>
              ₹{money(Math.abs(orig.amount))} · {modeLabelText(orig.mode)}
            </span>
          </div>
          <div className="rt-ln">
            <span style={{ color: "var(--text-2)" }}>{t("pay.alreadyRefunded")}</span>
            <span className="font-bold tabular-nums" style={{ color: "var(--text)" }}>
              ₹{money(alreadyRefunded)}
            </span>
          </div>
        </div>

        <label className="rt-fld block">
          <span className="rt-fld__label">{t("pay.refundAmount")}</span>
          <div className="rt-fld__row">
            <span className="rt-fld__curr">₹</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={refundAmount}
              onChange={(e) => {
                setRefundAmount(e.target.value);
                setRefundError(null);
              }}
              placeholder="0"
              className="rt-fld__input"
            />
          </div>
        </label>

        <div>
          <div className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-2)" }}>
            {t("pay.refundMethod")}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {(["cash", "upi", "cheque", "bank", "other"] as PaymentMode[]).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={refundMode === m}
                onClick={() => setRefundMode(m)}
                className="rt-pay-pill text-xs font-bold leading-tight break-words cursor-pointer bg-white"
              >
                {modeLabelText(m)}
              </button>
            ))}
          </div>
        </div>

        <label className="rt-in">
          <span className="rt-in__label uppercase">{t("pay.note")}</span>
          <input
            type="text"
            value={refundNote}
            onChange={(e) => setRefundNote(e.target.value)}
            placeholder={t("pay.reasonForRefund")}
            className="rt-in__control"
          />
        </label>

        <div className="rt-noti">
          <span>
            {maxRefundable <= 0.004
              ? t("pay.noAdvanceRefundNotice")
              : t("pay.refundNotice")}
          </span>
        </div>

        {refundError && (
          <div className="hh-hist-card hh-hist-card--due text-[12.5px] font-semibold" style={{ color: "var(--due)" }}>
            {refundError}
          </div>
        )}
      </div>

      <div className="rt-flow-phone__footer">
        <button
          type="button"
          disabled={maxRefundable <= 0.004}
          onClick={() => {
            const num = parseFloat(refundAmount);
            if (isNaN(num) || num <= 0) {
              setRefundError("Enter a valid refund amount");
              return;
            }
            if (num > maxRefundable + 0.01) {
              setRefundError(`Cannot exceed refundable advance ₹${money(maxRefundable)}`);
              return;
            }
            const ok = recordCustomerRefund(
              orig.customerName,
              num,
              todayStr,
              refundMode,
              refundNote.trim() || undefined,
            );
            if (!ok) {
              setRefundError("Refund could not be recorded");
              return;
            }
            onClose();
            setRefundAmount("");
            setRefundNote("");
          }}
          className="rt-btn rt-btn--due w-full"
        >
          {t("pay.recordRefund")}
        </button>
      </div>
    </div>
  );
};

interface PaymentsPhoneStepFlowProps {
  phonePayStep: "account" | "details" | "receipt";
  setPhonePayStep: (step: "account" | "details" | "receipt" | null) => void;
  savedPhonePayment: PaymentRecord | null;
  setSavedPhonePayment: (p: PaymentRecord | null) => void;
  existingCustomers: ExistingCustomer[];
  customers: Customer[];
  orgProfile: OrganizationProfile;
  billingSettings: BillingSettings;
  todayStr: string;
  loggedInUserName: string;
  phoneAccountQuery: string;
  setPhoneAccountQuery: (q: string) => void;
  matchingPhoneParties: PartyOption[];
  partyOptions: PartyOption[];
  phoneRecentCustomerNames: string[];
  isCustomParty: boolean;
  setIsCustomParty: (v: boolean) => void;
  customPartyName: string;
  setCustomPartyName: (v: string) => void;
  selectedParty: string;
  setSelectedParty: (v: string) => void;
  selectedOpt?: PartyOption;
  partyBills: Bill[];
  selectedBillId: number | undefined;
  setSelectedBillId: (id: number | undefined) => void;
  amount: string;
  setAmount: (v: string) => void;
  numericAmount: number;
  paymentMode: PaymentMode;
  setPaymentMode: (m: PaymentMode) => void;
  referenceNote: string;
  setReferenceNote: (v: string) => void;
  receiptDate: string;
  setReceiptDate: (v: string) => void;
  formFeedback: { type: "success" | "error"; text: string } | null;
  handlePhoneSaveReceipt: (e: React.FormEvent) => void;
  onOpenWhatsAppPrompt: (p: PaymentRecord) => void;
  onOpenPrintReceipt: (p: PaymentRecord) => void;
  getCustomerRawBalance?: (p: PaymentRecord) => number;
}

export const PaymentsPhoneStepFlow: React.FC<PaymentsPhoneStepFlowProps> = ({
  phonePayStep,
  setPhonePayStep,
  savedPhonePayment,
  setSavedPhonePayment,
  existingCustomers,
  customers,
  orgProfile,
  billingSettings,
  todayStr,
  loggedInUserName,
  phoneAccountQuery,
  setPhoneAccountQuery,
  matchingPhoneParties,
  partyOptions,
  phoneRecentCustomerNames,
  isCustomParty,
  setIsCustomParty,
  customPartyName,
  setCustomPartyName,
  selectedParty,
  setSelectedParty,
  selectedOpt,
  partyBills,
  selectedBillId,
  setSelectedBillId,
  amount,
  setAmount,
  numericAmount,
  paymentMode,
  setPaymentMode,
  referenceNote,
  setReferenceNote,
  receiptDate,
  setReceiptDate,
  formFeedback,
  handlePhoneSaveReceipt,
  onOpenWhatsAppPrompt,
  onOpenPrintReceipt,
  getCustomerRawBalance,
}) => {
  const { t } = useLanguage();
  const { customerBeat } = useBeats();
  const [sendingWa, setSendingWa] = useState(false);
  const modeLabelText = (mode: PaymentMode, isRefund?: boolean) =>
    getModeLabelText(t, mode, isRefund);

  if (phonePayStep === "receipt" && savedPhonePayment) {
    const sp = savedPhonePayment;
    const matchedCust = existingCustomers.find(
      (c) => c.name.trim().toLowerCase() === (sp.customerName || "").trim().toLowerCase(),
    );
    const phone = sp.customerPhone || matchedCust?.phone || "";
    const rawBalance = getCustomerRawBalance
      ? getCustomerRawBalance(sp)
      : matchedCust
        ? matchedCust.balanceDue > 0.004
          ? matchedCust.balanceDue
          : -(matchedCust.advance || 0)
        : 0;
    const { due: remainingDue, advance: advanceCredit } = resolveRemainingDueParts(rawBalance);

    const handleShareReceiptPdf = async () => {
      if (!phone) {
        onOpenWhatsAppPrompt(sp);
        return;
      }
      setSendingWa(true);
      try {
        const res = await sendPaymentReceiptOnWhatsApp(
          { ...sp, customerPhone: phone },
          orgProfile,
          { rawBalance },
        );
        const msg = whatsAppPaymentReceiptMessage(res);
        if (msg) notify(msg.text, msg.kind);
      } finally {
        setSendingWa(false);
      }
    };

    return (
      <div id="view-payments" className="rt-flow-phone">
        <div className="hh-sales-top">
          <div className="hh-sales-top__row">
            <h1 className="hh-sales-top__title">{t("pay.paymentSaved")}</h1>
            <span
              className="size-8 rounded-full inline-flex items-center justify-center shrink-0"
              style={{ background: "var(--paid-bg)", color: "var(--paid)" }}
            >
              <Check size={17} strokeWidth={2.8} />
            </span>
          </div>
        </div>

        <div className="rt-flow-phone__body space-y-3">
          <div className="hh-paper space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold" style={{ color: "var(--text)" }}>
                {t("pay.officialReceipt")}
              </span>
              <span className="font-mono text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                #{formatPaymentId(sp.id)}
              </span>
            </div>
            <hr className="hh-paper__hr" />
            <div className="rt-ln">
              <span style={{ color: "var(--text-2)" }}>Customer</span>
              <span className="font-bold text-right break-words" style={{ color: "var(--text)" }}>
                {sp.customerName}
              </span>
            </div>
            <div className="rt-ln">
              <span style={{ color: "var(--text-2)" }}>{t("pay.paymentDate")}</span>
              <span className="font-bold" style={{ color: "var(--text)" }}>
                {formatItemDate(sp.paymentDate || sp.createdAt)} {String(sp.paymentDate || todayStr).slice(0, 4)}
              </span>
            </div>
            <div className="rt-ln">
              <span style={{ color: "var(--text-2)" }}>{t("pay.paymentMode")}</span>
              <span className="font-bold" style={{ color: "var(--text)" }}>
                {modeLabelText(sp.mode)}
              </span>
            </div>
            <div className="rt-ln">
              <span style={{ color: "var(--text-2)" }}>{t("pay.recordedBy")}</span>
              <span className="font-bold" style={{ color: "var(--text)" }}>
                {sp.recordedBy || loggedInUserName}
              </span>
            </div>
            <div className="rt-ln">
              <span style={{ color: "var(--text-2)" }}>{t("pay.refNoteLabel")}</span>
              <span className="font-bold" style={{ color: "var(--text)" }}>
                {sp.referenceNote || "—"}
              </span>
            </div>
            <hr className="hh-paper__hr" />
            <div className="flex items-baseline justify-between gap-2 py-1">
              <span className="text-[15px] font-extrabold" style={{ color: "var(--text)" }}>
                {t("pay.amount")}
              </span>
              <span className="text-[18px] font-extrabold tabular-nums" style={{ color: "var(--text)" }}>
                ₹{money(sp.amount)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 py-1 text-[13px]">
              <span className="font-bold" style={{ color: "var(--text-2)" }}>
                {t("pay.remainingDueTillDate")}
              </span>
              <span
                className="font-extrabold tabular-nums"
                style={{ color: remainingDue > 0 ? "var(--due)" : "var(--paid)" }}
              >
                {remainingDue > 0
                  ? `₹${money(remainingDue)}`
                  : advanceCredit > 0
                    ? `₹0.00 (Adv ₹${money(advanceCredit)})`
                    : "₹0.00 (Settled)"}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 text-xs" style={{ color: "var(--text-2)" }}>
              <span>{t("pay.customerSignature")}</span>
              <span>{t("pay.authorizedSignatory")}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleShareReceiptPdf}
            disabled={sendingWa}
            className="rt-btn rt-btn--wa w-full disabled:opacity-70"
          >
            {sendingWa ? "Preparing PDF..." : `${t("pay.sendWaReceipt")} (PDF)`}
          </button>

          <button
            type="button"
            onClick={() => onOpenPrintReceipt(sp)}
            className="rt-btn-outline rt-btn-outline--primary w-full"
          >
            {t("common.print")}
          </button>

          <button
            type="button"
            onClick={() => {
              setPhonePayStep(null);
              setSavedPhonePayment(null);
            }}
            className="rt-link-btn w-full"
          >
            {t("pay.backToPayments")}
          </button>
        </div>
      </div>
    );
  }

  if (phonePayStep === "account") {
    const activePartyName = isCustomParty ? customPartyName.trim() : selectedParty.trim();
    const custRow = selectedOpt
      ? existingCustomers.find((c) => c.id === selectedOpt.customerId || c.name.trim().toLowerCase() === selectedOpt.name.trim().toLowerCase())
      : undefined;
    const fullCustRow = selectedOpt
      ? (selectedOpt.customerId ? (customers || []).find((c) => c.id === selectedOpt.customerId) : undefined) ||
        (customers || []).find((c) => c.name.trim().toLowerCase() === selectedOpt.name.trim().toLowerCase())
      : undefined;
    const beatSubtitle = (fullCustRow && customerBeat(fullCustRow)?.name) || fullCustRow?.route || custRow?.city || "";
    const acctBillsCount = selectedOpt
      ? partyBills.filter((b) => billBalance(b) > 0.004).length
      : 0;
    const qTrim = phoneAccountQuery.trim();
    const exactFound = partyOptions.some((o) => o.name.toLowerCase() === qTrim.toLowerCase());

    return (
      <div id="view-payments" className="rt-flow-phone">
        <div className="hh-sales-top">
          <div className="hh-sales-top__row">
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                onClick={() => setPhonePayStep(null)}
                className="hh-sales-top__iconbtn"
                aria-label={t("common.back")}
              >
                <ChevronLeft size={24} strokeWidth={2.2} />
              </button>
              <h1 className="hh-sales-top__title">{t("pay.recordPayment")}</h1>
            </div>
          </div>
        </div>

        <div className="rt-flow-phone__body space-y-3">
          <div className="rt-search-bar">
            <Search size={16} style={{ color: "var(--text-2)", flexShrink: 0 }} />
            <input
              type="text"
              value={phoneAccountQuery}
              onChange={(e) => setPhoneAccountQuery(e.target.value)}
              placeholder={t("pay.enterPartyPlaceholder")}
            />
            {phoneAccountQuery && (
              <button
                type="button"
                onClick={() => setPhoneAccountQuery("")}
                aria-label="Clear"
                className="p-1 bg-transparent border-0 cursor-pointer"
                style={{ color: "var(--text-2)" }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {activePartyName && (
            <div className="hh-hist-card hh-hist-card--primary space-y-2.5">
              <div>
                <div className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                  {t("pay.selectedAccount")}
                </div>
                <div className="text-[16px] font-extrabold break-words mt-0.5" style={{ color: "var(--text)" }}>
                  {activePartyName}
                </div>
                {(beatSubtitle || selectedOpt?.phone) && (
                  <div className="text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>
                    {[beatSubtitle, selectedOpt?.phone].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <div className="rt-three">
                <div className="rt-three__col">
                  <span className="rt-three__label">{t("pay.totalDue")}</span>
                  <span className="rt-three__val" style={{ color: (selectedOpt?.due || 0) > 0.004 ? "var(--due)" : "var(--text)" }}>
                    ₹{money(Math.max(0, selectedOpt?.due || 0))}
                  </span>
                </div>
                <div className="rt-three__col">
                  <span className="rt-three__label">{t("pay.openInvoices")}</span>
                  <span className="rt-three__val">{acctBillsCount}</span>
                </div>
                <div className="rt-three__col">
                  <span className="rt-three__label">{t("pay.advance")}</span>
                  <span className="rt-three__val" style={{ color: (selectedOpt?.advance || 0) > 0.004 ? "var(--paid)" : "var(--text)" }}>
                    ₹{money(selectedOpt?.advance || 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {phoneRecentCustomerNames.length > 0 && !qTrim && (
            <div className="text-[12px] leading-relaxed px-0.5" style={{ color: "var(--text-2)" }}>
              <span>{t("pay.recentPrefix")} </span>
              {phoneRecentCustomerNames.map((n, i) => (
                <React.Fragment key={n}>
                  {i > 0 && ", "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomParty(false);
                      setCustomPartyName("");
                      setSelectedParty(n);
                      setSelectedBillId(undefined);
                    }}
                    className="bg-transparent border-0 p-0 font-semibold cursor-pointer underline-offset-2 hover:underline"
                    style={{ color: "var(--text-2)", minHeight: "24px" }}
                  >
                    {n}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          {(qTrim || !activePartyName) && (
            <div className="rt-card">
              {matchingPhoneParties.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setIsCustomParty(false);
                    setCustomPartyName("");
                    setSelectedParty(opt.name);
                    setSelectedBillId(undefined);
                    setPhoneAccountQuery("");
                  }}
                  className="rt-rowi"
                >
                  <span className="rt-ico shrink-0">{getInitials(opt.name, "C")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-bold break-words" style={{ color: "var(--text)" }}>
                      {opt.name}
                    </span>
                    {opt.phone && (
                      <span className="block text-xs" style={{ color: "var(--text-2)" }}>
                        {opt.phone}
                      </span>
                    )}
                  </span>
                  <span className="rt-amt text-[13px]" style={{ color: opt.due > 0.004 ? "var(--due)" : "var(--paid)" }}>
                    ₹{money(Math.max(0, opt.due))}
                  </span>
                </button>
              ))}
              {qTrim && !exactFound && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomParty(true);
                    setCustomPartyName(qTrim);
                    setSelectedParty("");
                    setSelectedBillId(undefined);
                    setPhoneAccountQuery("");
                  }}
                  className="rt-rowi"
                >
                  <span className="rt-ico rt-ico--primary shrink-0">+</span>
                  <span className="text-[13px] font-bold" style={{ color: "var(--primary)" }}>
                    {qTrim}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="rt-flow-phone__footer">
          <button
            type="button"
            disabled={!activePartyName}
            onClick={() => {
              if (selectedOpt && selectedOpt.due > 0 && !amount) {
                setAmount(String(Math.round(selectedOpt.due * 100) / 100));
              }
              setPhonePayStep("details");
            }}
            className="rt-btn w-full"
          >
            {t("common.next")}
          </button>
        </div>
      </div>
    );
  }

  // phonePayStep === 'details'
  const activePartyName = isCustomParty ? customPartyName.trim() : selectedParty.trim();
  const unpaidBills = partyBills
    .filter((b) => billBalance(b) > 0.004)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || Number(a.id) - Number(b.id));
  const amtVal = isNaN(numericAmount) ? 0 : Math.max(0, numericAmount);
  const allocSplit = allocateReceipt(amtVal, partyBills, !isCustomParty ? selectedBillId : undefined);
  const allocMap = new Map<number, number>();
  allocSplit.allocations.forEach((a) => allocMap.set(a.billId, a.amount));
  const totalPartyDue = selectedOpt ? Math.max(0, selectedOpt.due) : 0;
  const remainingAfter = Math.max(0, totalPartyDue - amtVal);

  return (
    <form id="view-payments" onSubmit={handlePhoneSaveReceipt} className="rt-flow-phone">
      <div className="hh-sales-top">
        <div className="hh-sales-top__row">
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => setPhonePayStep("account")}
              className="hh-sales-top__iconbtn"
              aria-label={t("common.back")}
            >
              <ChevronLeft size={24} strokeWidth={2.2} />
            </button>
            <h1 className="hh-sales-top__title">{t("pay.recordPayment")}</h1>
          </div>
          <span className="hh-sales-top__pill shrink-0">{activePartyName}</span>
        </div>
      </div>

      <div className="rt-flow-phone__body space-y-3">
        {formFeedback && formFeedback.type === "error" && (
          <div className="hh-hist-card hh-hist-card--due text-[12.5px] font-semibold" style={{ color: "var(--due)" }}>
            {formFeedback.text}
          </div>
        )}

        <div>
          <div className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-2)" }}>
            {t("pay.paymentMethod")}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {(["cash", "upi", "cheque", "bank", "other"] as PaymentMode[]).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={paymentMode === m}
                onClick={() => setPaymentMode(m)}
                className="rt-pay-pill text-xs font-bold leading-tight break-words cursor-pointer bg-white"
              >
                {modeLabelText(m)}
              </button>
            ))}
          </div>
        </div>

        <label className="rt-fld block">
          <div className="flex items-center justify-between gap-2">
            <span className="rt-fld__label">{t("pay.amount")}</span>
            {totalPartyDue > 0.004 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedBillId(undefined);
                  setAmount(String(totalPartyDue));
                }}
                className="text-xs font-bold bg-transparent border-0 p-0 cursor-pointer"
                style={{ color: "var(--primary)", minHeight: "22px" }}
              >
                {t("collect.payFull")} ₹{money(totalPartyDue)}
              </button>
            )}
          </div>
          <div className="rt-fld__row">
            <span className="rt-fld__curr">₹</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="rt-fld__input"
            />
          </div>
        </label>

        <label className="rt-in">
          <span className="rt-in__label uppercase">{t("pay.refUtr")}</span>
          <input
            type="text"
            value={referenceNote}
            onChange={(e) => setReferenceNote(e.target.value)}
            placeholder={t("pay.refPlaceholder")}
            className="rt-in__control"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="rt-in cursor-pointer">
            <span className="rt-in__label uppercase">{t("pay.date")}</span>
            <div className="rt-in__control flex items-center">
              {formatDateLongDisplay(receiptDate)}
            </div>
            <input
              type="date"
              required
              aria-label={t("pay.date")}
              value={toStandardIsoDate(receiptDate)}
              onChange={(e) => setReceiptDate(e.target.value)}
              className="rt-trip-field__date-overlay"
            />
          </label>
          <div className="rt-in">
            <span className="rt-in__label uppercase">{t("pay.recordedBy")}</span>
            <div className="rt-in__control flex items-center">{loggedInUserName}</div>
          </div>
        </div>

        <div className="rt-card space-y-1.5">
          <div className="flex items-center justify-between gap-2 pb-1">
            <span className="text-[13.5px] font-bold" style={{ color: "var(--text)" }}>
              {t("pay.allocateInvoices")}
            </span>
            <button
              type="button"
              onClick={() => setSelectedBillId(undefined)}
              className="text-[12px] font-bold bg-transparent border-0 p-0 cursor-pointer"
              style={{ color: "var(--primary)", minHeight: "32px" }}
            >
              {t("pay.oldestFirst")}
            </button>
          </div>

          {unpaidBills.length === 0 ? (
            <p className="text-[12px] m-0 py-1" style={{ color: "var(--text-2)" }}>
              No unpaid invoice for this party. Payment will be credited as an advance.
            </p>
          ) : (
            <div>
              {unpaidBills.map((b) => {
                const due = billBalance(b);
                const allocated = allocMap.get(b.id) || 0;
                const active = selectedBillId === b.id || allocated > 0.004;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      if (selectedBillId === b.id) {
                        setSelectedBillId(undefined);
                      } else {
                        setSelectedBillId(b.id);
                        setAmount(String(Math.round(due * 100) / 100));
                      }
                    }}
                    className="rt-rowi"
                  >
                    <span
                      className="size-5 rounded-md border flex items-center justify-center shrink-0"
                      style={{
                        background: active ? "var(--primary)" : "var(--surface)",
                        borderColor: active ? "var(--primary)" : "var(--border)",
                        color: "var(--surface)",
                      }}
                    >
                      {active && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold" style={{ color: "var(--text)" }}>
                        {formatBillNumber(b, billingSettings)}
                      </span>
                      <span className="block text-xs" style={{ color: "var(--text-2)" }}>
                        {t("status.due")} ₹{money(due)}
                      </span>
                    </span>
                    <span className="text-[13px] font-extrabold tabular-nums shrink-0" style={{ color: "var(--text)" }}>
                      ₹{money(allocated)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rt-flow-phone__footer space-y-2">
        {totalPartyDue > 0.004 && (
          <div className="flex items-center justify-between gap-2 px-1 text-[13px]">
            <span className="font-semibold" style={{ color: "var(--text-2)" }}>
              {t("pay.remainingDueAfter")}
            </span>
            <span className="font-extrabold tabular-nums" style={{ color: remainingAfter > 0.004 ? "var(--due)" : "var(--paid)" }}>
              ₹{money(remainingAfter)}
            </span>
          </div>
        )}
        <button type="submit" className="rt-btn w-full">
          {t("pay.savePayment")}
        </button>
      </div>
    </form>
  );
};

interface PaymentsPhoneBottomSheetProps {
  phoneSheetPayment: PaymentRecord;
  existingCustomers: ExistingCustomer[];
  orgProfile: OrganizationProfile;
  loggedInUserName: string;
  getCustomerRawBalance?: (p: PaymentRecord) => number;
  onClose: () => void;
  onPrint: (p: PaymentRecord) => void;
  onPromptWhatsApp: (p: PaymentRecord) => void;
  onStartRefund: (p: PaymentRecord) => void;
  onEdit?: (p: PaymentRecord) => void;
  onDelete: (p: PaymentRecord) => void;
}

export const PaymentsPhoneBottomSheet: React.FC<PaymentsPhoneBottomSheetProps> = ({
  phoneSheetPayment: p,
  existingCustomers,
  orgProfile,
  loggedInUserName,
  getCustomerRawBalance,
  onClose,
  onPrint,
  onPromptWhatsApp,
  onStartRefund,
  onEdit,
  onDelete,
}) => {
  const { t } = useLanguage();
  const [sendingWa, setSendingWa] = useState(false);
  const modeLabelText = (mode: PaymentMode, isRefund?: boolean) =>
    getModeLabelText(t, mode, isRefund);

  const isRefund = Boolean(p.isRefund || p.entryKind === "refund");
  const isReversal = Boolean(p.reversalOf);
  const isNegative = isRefund || p.amount < 0;
  const matchedCustomer = existingCustomers.find(
    (c) => c.name.trim().toLowerCase() === (p.customerName || "").trim().toLowerCase(),
  );
  const phone = p.customerPhone || matchedCustomer?.phone || "";
  const rawBalance = getCustomerRawBalance
    ? getCustomerRawBalance(p)
    : matchedCustomer
      ? matchedCustomer.balanceDue > 0.004
        ? matchedCustomer.balanceDue
        : -(matchedCustomer.advance || 0)
      : 0;
  const { due: remainingDue, advance: advanceCredit } = resolveRemainingDueParts(rawBalance);

  const handleShareWhatsAppPdf = async () => {
    if (!phone) {
      onPromptWhatsApp(p);
      return;
    }
    setSendingWa(true);
    try {
      const res = await sendPaymentReceiptOnWhatsApp(
        { ...p, customerPhone: phone },
        orgProfile,
        { rawBalance },
      );
      const msg = whatsAppPaymentReceiptMessage(res);
      if (msg) notify(msg.text, msg.kind);
      if (res === "shared" || res === "downloaded") onClose();
    } finally {
      setSendingWa(false);
    }
  };

  return createPortal(
    <div
      className="rt-bsheet-scrim"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
        <div className="hh-grab" />
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[17px] font-extrabold m-0 break-words" style={{ color: "var(--text)" }}>
            {isNegative ? "−" : ""}₹{money(Math.abs(p.amount))} · {p.customerName}
          </h2>
          <span className={`rt-tag shrink-0 ${isNegative ? "rt-tag--due" : "rt-tag--paid"}`}>
            {isReversal && !isRefund ? `Reversed · ${modeLabelText(p.mode)}` : modeLabelText(p.mode, isRefund)}
          </span>
        </div>

        <div className="rt-card rt-card--divided">
          <div className="rt-ln">
            <span style={{ color: "var(--text-2)" }}>{t("pay.paymentMethod")}</span>
            <span className="font-bold" style={{ color: "var(--text)" }}>
              {p.mode === "upi" ? "UPI / QR" : p.mode === "bank" ? "Bank / NEFT" : modeLabelText(p.mode)}
            </span>
          </div>
          <div className="rt-ln">
            <span style={{ color: "var(--text-2)" }}>{t("pay.refUtr")}</span>
            <span className="font-bold font-mono" style={{ color: "var(--text)" }}>
              {p.referenceNote || "—"}
            </span>
          </div>
          <div className="rt-ln">
            <span style={{ color: "var(--text-2)" }}>{t("pay.allocatedInvoice")}</span>
            <span className="font-bold" style={{ color: "var(--text)" }}>
              {p.billId ? `INV-${p.billId}` : "On account"}
            </span>
          </div>
          <div className="rt-ln">
            <span style={{ color: "var(--text-2)" }}>{t("pay.recordedBy")}</span>
            <span className="font-bold" style={{ color: "var(--text)" }}>
              {p.recordedBy || loggedInUserName}
            </span>
          </div>
          <div className="rt-ln">
            <span style={{ color: "var(--text-2)" }}>{t("pay.remainingDueTillDate")}</span>
            <span
              className="font-extrabold tabular-nums"
              style={{ color: remainingDue > 0 ? "var(--due)" : "var(--paid)" }}
            >
              {remainingDue > 0
                ? `₹${money(remainingDue)}`
                : advanceCredit > 0
                  ? `₹0.00 (Adv ₹${money(advanceCredit)})`
                  : "₹0.00 (Settled)"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onPrint(p)}
            className="rt-btn-outline rt-btn-outline--primary"
          >
            {t("common.print")}
          </button>

          <button
            type="button"
            onClick={handleShareWhatsAppPdf}
            disabled={sendingWa}
            className="rt-btn-outline rt-btn-outline--primary disabled:opacity-60"
          >
            {sendingWa ? "Preparing..." : "WhatsApp PDF"}
          </button>

          {onEdit && !isRefund && p.amount >= 0 && !p.reversalOf && (
            <button
              type="button"
              onClick={() => onEdit(p)}
              className="rt-btn-outline rt-btn-outline--primary"
            >
              {t("common.edit")}
            </button>
          )}

          <button
            type="button"
            onClick={() => onStartRefund(p)}
            className="rt-btn-outline rt-btn-outline--primary"
          >
            {t("pay.refund")}
          </button>

          {!p.reversalOf && (
            <button
              type="button"
              onClick={() => onDelete(p)}
              className={`rt-btn-outline rt-btn-outline--due ${onEdit && !isRefund && p.amount >= 0 ? "col-span-2" : ""}`}
            >
              {t("pay.reverse")}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
