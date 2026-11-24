import { daysSinceISO } from "../../../utils/dateLocal";
import React from "react";
import { ArrowLeftRight, Banknote, History, Search, X } from "lucide-react";
import {
  Bill,
  BillingSettings,
  ExistingCustomer,
  OrganizationProfile,
  PaymentAuditEntry,
  PaymentMode,
  PaymentRecord,
} from "../../../types";
import { useLanguage } from "../../../i18n/LanguageContext";
import { getInitials } from "../../ui/HomeKit";
import { money } from "../../../utils/billing";
import { PaymentAuditModal } from "../../common/PaymentAuditModal";
import { formatPaymentId } from "../../../utils/beatReports";
import { formatBillNumber } from "../../../utils/invoiceCommon";
import { PaymentReportsPanel } from "./PaymentReportsPanel";
import { PaymentsPhoneBottomSheet } from "./PaymentsPhoneFlow";
import {
  HISTORY_PAGE,
  formatItemDate,
  formatRecentDateMeta,
  getModeLabelText,
} from "./paymentsHelpers";

interface PaymentsMobileViewProps {
  activeTab: "recent" | "due" | "history" | "reports";
  setActiveTab: (tab: "recent" | "due" | "history" | "reports") => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  historyModeFilter: "all" | PaymentMode | "refund";
  setHistoryModeFilter: (m: "all" | PaymentMode | "refund") => void;
  historyVisible: number;
  setHistoryVisible: React.Dispatch<React.SetStateAction<number>>;
  recentAll: PaymentRecord[];
  dueBills: Bill[];
  historyAll: PaymentRecord[];
  filteredRecent: PaymentRecord[];
  filteredDueBills: Bill[];
  phoneFilteredHistory: PaymentRecord[];
  todayStr: string;
  realtimeCashInBox: number;
  totalMarketDue: number;
  totalInwardSpend: number;
  totalBilledSales: number;
  getEffectiveBillBalance: (b: Bill) => number;
  billingSettings: BillingSettings;
  paymentAudit: PaymentAuditEntry[];
  showAuditLog: boolean;
  setShowAuditLog: (v: boolean) => void;
  phoneSheetPayment: PaymentRecord | null;
  setPhoneSheetPayment: (p: PaymentRecord | null) => void;
  existingCustomers: ExistingCustomer[];
  orgProfile: OrganizationProfile;
  loggedInUserName: string;
  openPhoneRecordFlow: (presetParty?: string, presetBillId?: number, presetAmount?: string) => void;
  onPrintReceipt: (p: PaymentRecord) => void;
  onPromptWhatsApp: (p: PaymentRecord) => void;
  onStartRefund: (p: PaymentRecord) => void;
  onEditPayment: (p: PaymentRecord) => void;
  onDeletePayment: (p: PaymentRecord) => void;
  getCustomerRawBalance?: (p: PaymentRecord) => number;
}

export const PaymentsMobileView: React.FC<PaymentsMobileViewProps> = ({
  activeTab,
  setActiveTab,
  searchTerm,
  setSearchTerm,
  historyModeFilter,
  setHistoryModeFilter,
  historyVisible,
  setHistoryVisible,
  recentAll,
  dueBills,
  historyAll,
  filteredRecent,
  filteredDueBills,
  phoneFilteredHistory,
  todayStr,
  realtimeCashInBox,
  totalMarketDue,
  totalInwardSpend,
  totalBilledSales,
  getEffectiveBillBalance,
  billingSettings,
  paymentAudit,
  showAuditLog,
  setShowAuditLog,
  phoneSheetPayment,
  setPhoneSheetPayment,
  existingCustomers,
  orgProfile,
  loggedInUserName,
  openPhoneRecordFlow,
  onPrintReceipt,
  onPromptWhatsApp,
  onStartRefund,
  onEditPayment,
  onDeletePayment,
  getCustomerRawBalance,
}) => {
  const { t } = useLanguage();
  const modeLabelText = (mode: PaymentMode, isRefund?: boolean) =>
    getModeLabelText(t, mode, isRefund);

  return (
    <div id="view-payments" className="hh-view mw-workspace w-full space-y-3 pb-28">
      <div className="hh-sales-top hh-sales-top--flush">
        <div className="hh-sales-top__row">
          <h1 className="hh-sales-top__title">{t("pay.title")}</h1>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowAuditLog(true)}
              className="hh-sales-top__iconbtn"
              style={{ color: "rgba(255, 255, 255, 0.85)" }}
              aria-label="Audit log"
            >
              <History size={18} />
            </button>
          </div>
        </div>
        <div className="rt-utabs" role="tablist" aria-label="Payment views">
          {([
            { id: "recent" as const, label: t("pay.recentN", { n: recentAll.length }) },
            { id: "due" as const, label: t("pay.dueN", { n: dueBills.length }) },
            { id: "history" as const, label: t("pay.historyN", { n: historyAll.length }) },
            { id: "reports" as const, label: t("pay.reports") },
          ]).map((tb) => (
            <button
              key={tb.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tb.id}
              onClick={() => setActiveTab(tb.id)}
              className="rt-utab"
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {showAuditLog && (
        <PaymentAuditModal entries={paymentAudit} onClose={() => setShowAuditLog(false)} />
      )}

      {activeTab !== "reports" && (
        <>
          {activeTab === "recent" && (
            <div className="rt-kv-grid">
              <div className="rt-kv">
                <div className="rt-kv__label">{t("pay.cashInBox")}</div>
                <div className="rt-kv__val">₹{money(realtimeCashInBox)}</div>
              </div>
              <div className="rt-kv">
                <div className="rt-kv__label">{t("pay.marketCreditDue")}</div>
                <div className="rt-kv__val" style={{ color: "var(--due)" }}>₹{money(totalMarketDue)}</div>
              </div>
              <div className="rt-kv">
                <div className="rt-kv__label">{t("pay.totalInwardSpend")}</div>
                <div className="rt-kv__val">₹{money(totalInwardSpend)}</div>
              </div>
              <div className="rt-kv">
                <div className="rt-kv__label">{t("pay.totalBilledSales")}</div>
                <div className="rt-kv__val">₹{money(totalBilledSales)}</div>
              </div>
            </div>
          )}

          <div className="rt-search-bar">
            <Search size={16} style={{ color: "var(--text-2)", flexShrink: 0 }} />
            <input
              enterKeyHint="search"
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setHistoryVisible(HISTORY_PAGE);
              }}
              placeholder={activeTab === "due" ? t("pay.searchCustomerOrInv") : t("pay.searchPayments")}
            />
            {searchTerm && (
              <button
                aria-label="Clear search"
                type="button"
                onClick={() => setSearchTerm("")}
                className="p-1 bg-transparent border-0 cursor-pointer"
                style={{ color: "var(--text-2)" }}
              >
                <X size={15} />
              </button>
            )}
          </div>
        </>
      )}

      {activeTab === "recent" && (
        <>
          {filteredRecent.length === 0 ? (
            <div className="rt-card px-5 py-10 text-center text-[13px]" style={{ color: "var(--text-2)" }}>
              {recentAll.length === 0 ? "No receipts today yet. Older ones are in History." : "No payment receipts match your search"}
            </div>
          ) : (
            <div className="space-y-2.5 hh-tgrid-2">
              {filteredRecent.map((p, idx) => {
                const isRefund = Boolean(p.isRefund || p.entryKind === "refund");
                const isReversal = Boolean(p.reversalOf);
                const isNeg = isRefund || p.amount < 0;
                return (
                  <button
                    key={p.id || idx}
                    type="button"
                    onClick={() => setPhoneSheetPayment(p)}
                    className={`hh-hist-card ${isNeg ? "hh-hist-card--due" : "hh-hist-card--paid"} w-full text-left flex items-center gap-3 cursor-pointer`}
                  >
                    <span className={`rt-ico shrink-0 ${isNeg ? "rt-ico--neutral" : "rt-ico--paid"}`}>
                      {isNeg ? <ArrowLeftRight size={16} /> : <Banknote size={17} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold break-words" style={{ color: "var(--text)" }}>
                        {p.customerName}
                      </span>
                      <span className="block text-xs mt-0.5" style={{ color: "var(--text-2)" }}>
                        {formatRecentDateMeta(p, todayStr)} · {isRefund ? "refund" : isReversal ? "reversed" : p.billId ? `INV-${p.billId}` : formatPaymentId(p.id, idx)}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span
                        className="block text-[15px] font-extrabold tabular-nums"
                        style={{ color: "var(--text)" }}
                      >
                        {isNeg ? "−" : ""}₹{money(Math.abs(p.amount))}
                      </span>
                      <span className="rt-tag rt-tag--mode mt-0.5">
                        {isReversal && !isRefund ? `Rev · ${modeLabelText(p.mode)}` : modeLabelText(p.mode, isRefund)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="rt-fab-cta">
            <button
              type="button"
              onClick={() => openPhoneRecordFlow()}
              className="rt-btn"
            >
              + {t("pay.recordPayment")}
            </button>
          </div>
        </>
      )}

      {activeTab === "due" && (
        <div className="space-y-2.5">
          {filteredDueBills.length === 0 ? (
            <div className="rt-card px-5 py-10 text-center text-[13px] font-semibold" style={{ color: "var(--paid)" }}>
              All customer invoices are settled!
            </div>
          ) : (
            <div className="rt-card">
              {filteredDueBills.map((b) => {
                const due = getEffectiveBillBalance(b);
                const daysOld = b.date
                  ? daysSinceISO(b.date)
                  : 0;
                const urgent = daysOld > 10;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() =>
                      openPhoneRecordFlow(
                        b.retailer || "",
                        b.id,
                        String(Math.round(due * 100) / 100),
                      )
                    }
                    className="rt-rowi"
                  >
                    <span className="rt-ico shrink-0">{getInitials(b.retailer || "C", "C")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-bold break-words" style={{ color: "var(--text)" }}>
                        {b.retailer || "Cash Sale"}
                      </span>
                      <span className="block text-xs mt-0.5" style={{ color: "var(--text-2)" }}>
                        {formatBillNumber(b, billingSettings)}
                        {daysOld > 0 ? ` · ${t("pay.daysLate", { n: daysOld })}` : ""}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-[14px] font-extrabold tabular-nums" style={{ color: "var(--text)" }}>
                        ₹{money(due)}
                      </span>
                      <span className={`rt-tag mt-0.5 ${urgent ? "rt-tag--due" : "rt-tag--soon"}`}>
                        {t("pay.collect")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="rt-stp rt-stp--muted px-1">{t("pay.tapDueHint")}</p>
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {([
              { id: "all" as const, label: t("common.all") },
              { id: "cash" as const, label: t("pay.modeCash") },
              { id: "upi" as const, label: t("pay.modeUpi") },
              { id: "cheque" as const, label: t("pay.modeCheque") },
              { id: "bank" as const, label: t("pay.modeBank") },
              { id: "other" as const, label: t("pay.modeOther") },
              { id: "refund" as const, label: t("pay.refundTag") },
            ]).map((chip) => (
              <button
                key={chip.id}
                type="button"
                aria-pressed={historyModeFilter === chip.id}
                onClick={() => {
                  setHistoryModeFilter(chip.id);
                  setHistoryVisible(HISTORY_PAGE);
                }}
                className="rt-chip shrink-0"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {phoneFilteredHistory.length === 0 ? (
            <div className="rt-card px-5 py-10 text-center text-[13px]" style={{ color: "var(--text-2)" }}>
              {historyAll.length === 0 ? "No older receipts yet." : "No payment receipts match your search"}
            </div>
          ) : (
            <div className="space-y-2.5 hh-tgrid-2">
              {phoneFilteredHistory.slice(0, historyVisible).map((p, idx) => {
                const isRefund = Boolean(p.isRefund || p.entryKind === "refund");
                const isReversal = Boolean(p.reversalOf);
                const isNeg = isRefund || p.amount < 0;
                return (
                  <button
                    key={p.id || idx}
                    type="button"
                    onClick={() => setPhoneSheetPayment(p)}
                    className={`hh-hist-card ${isNeg ? "hh-hist-card--due" : "hh-hist-card--paid"} w-full text-left flex items-center gap-3 cursor-pointer`}
                  >
                    <span className={`rt-ico shrink-0 ${isNeg ? "rt-ico--neutral" : "rt-ico--paid"}`}>
                      {isNeg ? <ArrowLeftRight size={16} /> : <Banknote size={17} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold break-words" style={{ color: "var(--text)" }}>
                        {p.customerName}
                      </span>
                      <span className="block text-xs mt-0.5" style={{ color: "var(--text-2)" }}>
                        {formatItemDate(p.paymentDate || p.createdAt)} · {isRefund ? "refund" : isReversal ? "reversed" : p.billId ? `INV-${p.billId}` : formatPaymentId(p.id, idx)}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span
                        className="block text-[15px] font-extrabold tabular-nums"
                        style={{ color: "var(--text)" }}
                      >
                        {isNeg ? "−" : ""}₹{money(Math.abs(p.amount))}
                      </span>
                      <span className="rt-tag rt-tag--mode mt-0.5">
                        {isReversal && !isRefund ? `Rev · ${modeLabelText(p.mode)}` : modeLabelText(p.mode, isRefund)}
                      </span>
                    </span>
                  </button>
                );
              })}
              {phoneFilteredHistory.length > historyVisible && (
                <button
                  type="button"
                  onClick={() => setHistoryVisible((v) => v + HISTORY_PAGE)}
                  className="rt-btn-outline w-full"
                >
                  Show more ({phoneFilteredHistory.length - historyVisible} left)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "reports" && <PaymentReportsPanel />}

      {phoneSheetPayment && (
        <PaymentsPhoneBottomSheet
          phoneSheetPayment={phoneSheetPayment}
          existingCustomers={existingCustomers}
          orgProfile={orgProfile}
          loggedInUserName={loggedInUserName}
          getCustomerRawBalance={getCustomerRawBalance}
          onClose={() => setPhoneSheetPayment(null)}
          onPrint={(p) => {
            onPrintReceipt(p);
            setPhoneSheetPayment(null);
          }}
          onPromptWhatsApp={(p) => {
            onPromptWhatsApp(p);
            setPhoneSheetPayment(null);
          }}
          onStartRefund={(p) => {
            onStartRefund(p);
            setPhoneSheetPayment(null);
          }}
          onEdit={(p) => {
            onEditPayment(p);
            setPhoneSheetPayment(null);
          }}
          onDelete={(p) => {
            onDeletePayment(p);
            setPhoneSheetPayment(null);
          }}
        />
      )}
    </div>
  );
};
