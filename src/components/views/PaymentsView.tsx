import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useLedger } from "../../context/LedgerContext";
import {
  Bill,
  CanonicalActionIntent,
  PaymentMode,
  PaymentRecord,
} from "../../types";
import { useIsMobile } from "../../hooks/useIsMobile";
import { money } from "../../utils/billing";
import { allocateReceipt, isAdvanceAdjustmentRow, isRefundRow, signedPaymentAmount } from "../../utils/paymentAllocation";
import { billBalance, billNetTotal, round2 } from "../../utils/salesReturns";
import { summarizeCollections } from "../../utils/collectionSummary";
import { todayISO, toLocalISODate } from "../../utils/dateLocal";
import { type PartyOption } from "../common/PartySearchSelect";
import { formatPaymentId } from "../../utils/beatReports";
import { HISTORY_PAGE } from "./payments/paymentsHelpers";
import {
  PaymentsPhoneRefundView,
  PaymentsPhoneStepFlow,
} from "./payments/PaymentsPhoneFlow";
import { PaymentsDetailView } from "./payments/PaymentsDetailView";
import { PaymentsMobileView } from "./payments/PaymentsMobileView";
import { PaymentsDesktopView } from "./payments/PaymentsDesktopView";
import { PaymentsModals } from "./payments/PaymentsModals";
import { CanonicalReturnBanner } from "../common/CanonicalReturnBanner";
import { preloadReceipt80 } from "../../utils/whatsappPaymentReceipt";

export const PaymentsView: React.FC = () => {
  const isPhone = useIsMobile(1023);
  const {
    payments,
    recordCustomerPayment,
    recordCustomerRefund,
    getCustomerCreditSummary,
    paymentAudit,
    updatePayment,
    deletePayment,
    customers,
    existingCustomers,
    getCustomerLedger,
    bills,
    grns,
    expenses,
    palette,
    orgProfile,
    billingSettings,
    products,
    currentUser,
    pendingCanonicalAction,
    clearPendingCanonicalAction,
    returnFromCanonicalAction,
  } = useLedger();

  const loggedInUserName = currentUser?.name || currentUser?.username || "Admin";
  const todayStr = useMemo(() => todayISO(), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalISODate(d);
  }, []);

  // Form State matching Image 1
  const [selectedParty, setSelectedParty] = useState<string>("");
  const [customPartyName, setCustomPartyName] = useState<string>("");
  const [isCustomParty, setIsCustomParty] = useState<boolean>(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [amount, setAmount] = useState<string>("");
  // Invoice the receipt is tied to (undefined = oldest dues first)
  const [selectedBillId, setSelectedBillId] = useState<number | undefined>(undefined);
  const [receiptDate, setReceiptDate] = useState<string>(todayStr);
  const [referenceNote, setReferenceNote] = useState<string>("");
  const [formFeedback, setFormFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Tabs: Recent (today), Due invoices, History (older receipts), Reports (downloadable)
  const [activeTab, setActiveTab] = useState<"recent" | "due" | "history" | "reports">("recent");
  const [historyModeFilter, setHistoryModeFilter] = useState<"all" | PaymentMode | "refund">("all");
  const [historyVisible, setHistoryVisible] = useState<number>(HISTORY_PAGE);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Phone sub-flows: Record Payment (3 steps), Detail Bottom Sheet, Refund Screen
  const [phonePayStep, setPhonePayStep] = useState<"account" | "details" | "receipt" | null>(null);
  const [phoneAccountQuery, setPhoneAccountQuery] = useState("");
  const [savedPhonePayment, setSavedPhonePayment] = useState<PaymentRecord | null>(null);
  const [phoneSheetPayment, setPhoneSheetPayment] = useState<PaymentRecord | null>(null);
  const [phoneRefundPayment, setPhoneRefundPayment] = useState<PaymentRecord | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMode, setRefundMode] = useState<PaymentMode>("cash");
  const [refundNote, setRefundNote] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);

  // Selection state for Item Detail View (user requested: clicking on the items should open the detail view)
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<PaymentRecord | null>(null);

  // Modals state - ALWAYS rendered at the root level with high z-index so they never appear behind
  const [receiptPayment, setReceiptPayment] = useState<PaymentRecord | null>(null);
  const [paymentToEdit, setPaymentToEdit] = useState<PaymentRecord | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentRecord | null>(null);
  const [taxInvoiceModalBill, setTaxInvoiceModalBill] = useState<Bill | null>(null);
  const [whatsAppPromptPayment, setWhatsAppPromptPayment] = useState<PaymentRecord | null>(null);
  const [promptPhoneInput, setPromptPhoneInput] = useState<string>("");
  const [activeReturnIntent, setActiveReturnIntent] = useState<CanonicalActionIntent | null>(null);

  useEffect(() => {
    preloadReceipt80().catch(() => {});
  }, []);

  // Real ledger payments only (never show made-up sample receipts, they would distort totals)
  const allPayments = useMemo(() => payments || [], [payments]);

  const getCustomerRawBalance = useCallback(
    (p: PaymentRecord): number => {
      try {
        const ledger = getCustomerLedger(p.customerId || p.customerName, p.customerPhone);
        if (Number.isFinite(ledger?.rawBalance)) return Number(ledger.rawBalance);
      } catch {
        // fallback below
      }
      const matched = existingCustomers.find(
        (c) =>
          (p.customerId && c.id === p.customerId) ||
          c.name.trim().toLowerCase() === (p.customerName || "").trim().toLowerCase(),
      );
      if (matched) {
        if (matched.balanceDue > 0.004) return matched.balanceDue;
        if ((matched.advance || 0) > 0.004) return -(matched.advance || 0);
      }
      return 0;
    },
    [getCustomerLedger, existingCustomers],
  );

  useEffect(() => {
    if (!pendingCanonicalAction || pendingCanonicalAction.entityType !== "payment") return;
    const targetPayment = allPayments.find(
      (p) => String(p.id) === String(pendingCanonicalAction.entityId),
    );
    const intent = pendingCanonicalAction;
    clearPendingCanonicalAction();
    if (intent.returnTab) setActiveReturnIntent(intent);
    if (!targetPayment) return;
    if (intent.action === "edit") {
      setPaymentToEdit(targetPayment);
    } else if (intent.action === "delete") {
      setPaymentToDelete(targetPayment);
    } else if (intent.action === "view") {
      setSelectedPaymentForDetails(targetPayment);
    }
  }, [pendingCanonicalAction, allPayments, clearPendingCanonicalAction]);

  // Total cash expenses paid out of drawer
  const cashExpenses = useMemo(() => {
    return (expenses || []).reduce((sum, e) => {
      const mode = String(e.mode || "cash").toLowerCase();
      return mode === "cash" ? sum + (Number(e.amount) || 0) : sum;
    }, 0);
  }, [expenses]);

  const allTimeSummary = useMemo(
    () => summarizeCollections({ bills, payments: allPayments, inPeriod: () => true }),
    [bills, allPayments],
  );

  // Realtime Cash in Box / Till Balance & Financial Overview (net of drawer cash expenses & cash refunds)
  const realtimeCashInBox = useMemo(
    () => Math.max(0, round2(allTimeSummary.cash - cashExpenses)),
    [allTimeSummary.cash, cashExpenses],
  );

  const totalCollectedAmount = allTimeSummary.total;

  // Outstanding Market Due: accurately accounts for customer returns / credit notes
  const totalMarketDue = useMemo(() => {
    return bills.reduce((sum, b) => {
      if (b.status === "cancelled" || b.cancellation) return sum;
      return sum + Math.max(0, billBalance(b));
    }, 0);
  }, [bills]);

  // Total Billed Sales: net of sales returns, exactly synchronized with Dashboard and Reports
  const totalBilledSales = useMemo(() => {
    return bills.reduce((sum, b) => {
      if (b.status === "cancelled" || b.cancellation) return sum;
      return sum + billNetTotal(b);
    }, 0);
  }, [bills]);

  const totalInwardSpend = useMemo(() => {
    return (grns || []).reduce((sum, g) => sum + (Number(g.grandTotal) || 0), 0);
  }, [grns]);

  // Compute effective balance owed on a bill accounting for both bill.amountPaid and recorded payments journal
  const getEffectiveBillBalance = useCallback(
    (b: Bill) => {
      const refundIds = new Set<string>();
      for (const p of allPayments) {
        if (p.id && isRefundRow(p)) refundIds.add(String(p.id));
      }
      const linkedPaid = allPayments
        .filter(
          (p) =>
            p.billId === b.id &&
            !isRefundRow(p) &&
            !(p.reversalOf && refundIds.has(String(p.reversalOf))),
        )
        .reduce((sum, p) => sum + signedPaymentAmount(p), 0);
      const paid = Math.max(Number(b.amountPaid) || 0, linkedPaid);
      return billBalance({ ...b, amountPaid: paid });
    },
    [allPayments],
  );

  // Parties for the searchable PARTY picker (from existingCustomers + bills)
  const partyOptions = useMemo(() => {
    const list: PartyOption[] = [];
    const seen = new Set<string>();

    existingCustomers.forEach((c) => {
      const trimmed = c.name.trim();
      if (!trimmed || seen.has(trimmed.toLowerCase())) return;
      seen.add(trimmed.toLowerCase());
      list.push({
        key: `cust_${c.id || c.name}`,
        name: trimmed,
        phone: c.phone,
        due: c.balanceDue,
        advance: c.advance || 0,
        customerId: c.id,
      });
    });

    bills.forEach((b) => {
      const trimmed = (b.retailer || "").trim();
      if (!trimmed || seen.has(trimmed.toLowerCase())) return;
      seen.add(trimmed.toLowerCase());
      list.push({
        key: `bill_${b.id}`,
        name: trimmed,
        phone: b.phone,
        due: getEffectiveBillBalance(b),
        advance: 0,
      });
    });

    return list.sort((a, b) => {
      if (a.due > 0 && b.due <= 0) return -1;
      if (b.due > 0 && a.due <= 0) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [existingCustomers, bills, getEffectiveBillBalance]);

  // The chosen customer's live invoices (same ownership rules the save uses), for the invoice chooser
  const selectedOpt = !isCustomParty ? partyOptions.find((o) => o.name === selectedParty) : undefined;
  const partyBills = useMemo(() => {
    if (!selectedOpt) return [] as Bill[];
    try {
      return getCustomerLedger(selectedOpt.customerId || selectedOpt.name, selectedOpt.phone)
        .bills.map((b) => bills.find((x) => x.id === b.id) ?? b)
        .filter((b) => b.status !== "cancelled" && !b.cancellation);
    } catch {
      return [] as Bill[];
    }
  }, [selectedOpt, getCustomerLedger, bills]);
  const numericAmount = parseFloat(amount);

  // Search across receipts (used by Recent and History)
  const matchesSearch = useCallback(
    (p: PaymentRecord) => {
      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;
      const name = (p.customerName || "").toLowerCase();
      const ref = (p.referenceNote || "").toLowerCase();
      const mode = (p.mode || "").toLowerCase();
      const pId = formatPaymentId(p.id).toLowerCase();
      const rawId = (p.id || "").toLowerCase();
      return name.includes(q) || ref.includes(q) || mode.includes(q) || pId.includes(q) || rawId.includes(q);
    },
    [searchTerm],
  );

  // Recent = receipts dated today or recorded today. Everything older is History.
  const isRecent = useCallback(
    (p: PaymentRecord) => {
      const d = String(p.paymentDate || p.createdAt || "").slice(0, 10);
      const rec = toLocalISODate(new Date(p.createdAt || Date.now()));
      return d >= todayStr || rec === todayStr;
    },
    [todayStr],
  );
  const recentAll = useMemo(() => allPayments.filter(isRecent), [allPayments, isRecent]);
  const historyAll = useMemo(
    () =>
      allPayments
        .filter((p) => !isRecent(p))
        .sort((a, b) => String(b.paymentDate || b.createdAt).localeCompare(String(a.paymentDate || a.createdAt))),
    [allPayments, isRecent],
  );
  const filteredRecent = useMemo(() => recentAll.filter(matchesSearch), [recentAll, matchesSearch]);
  const filteredHistory = useMemo(() => historyAll.filter(matchesSearch), [historyAll, matchesSearch]);
  const historyGroups = useMemo(() => {
    const groups: { date: string; rows: PaymentRecord[]; total: number }[] = [];
    for (const p of filteredHistory.slice(0, historyVisible)) {
      const d = String(p.paymentDate || p.createdAt || "").slice(0, 10);
      let g = groups[groups.length - 1];
      if (!g || g.date !== d) {
        g = { date: d, rows: [], total: 0 };
        groups.push(g);
      }
      g.rows.push(p);
      if (!isAdvanceAdjustmentRow(p)) {
        g.total = round2(g.total + signedPaymentAmount(p));
      }
    }
    return groups;
  }, [filteredHistory, historyVisible]);

  // Due / Credit Invoices
  const dueBills = useMemo(() => {
    return bills.filter((b) => {
      if (b.cancelled || b.cancellation) return false;
      return getEffectiveBillBalance(b) > 0.01;
    });
  }, [bills, getEffectiveBillBalance]);

  const filteredDueBills = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return dueBills;
    return dueBills.filter((b) => {
      const retailer = (b.retailer || "").toLowerCase();
      const phone = (b.phone || "").toLowerCase();
      const idStr = String(b.id);
      return retailer.includes(q) || phone.includes(q) || idStr.includes(q);
    });
  }, [dueBills, searchTerm]);

  const phoneRecentCustomerNames = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const p of allPayments) {
      const n = (p.customerName || "").trim();
      if (!n || seen.has(n.toLowerCase())) continue;
      seen.add(n.toLowerCase());
      out.push(n);
      if (out.length >= 4) break;
    }
    return out;
  }, [allPayments]);

  const matchingPhoneParties = useMemo(() => {
    const q = phoneAccountQuery.trim().toLowerCase();
    if (!q) return partyOptions.slice(0, 6);
    return partyOptions
      .filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          (o.phone || "").toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [partyOptions, phoneAccountQuery]);

  const phoneFilteredHistory = useMemo(() => {
    if (historyModeFilter === "all") return filteredHistory;
    if (historyModeFilter === "refund") {
      return filteredHistory.filter((p) => isRefundRow(p));
    }
    return filteredHistory.filter(
      (p) => !isRefundRow(p) && p.amount >= 0 && String(p.mode || "cash").toLowerCase() === historyModeFilter,
    );
  }, [filteredHistory, historyModeFilter]);

  const openPhoneRecordFlow = (presetParty?: string, presetBillId?: number, presetAmount?: string) => {
    setFormFeedback(null);
    if (presetParty) {
      setIsCustomParty(false);
      setCustomPartyName("");
      setSelectedParty(presetParty);
      setSelectedBillId(presetBillId);
      setAmount(presetAmount ?? "");
      setPhonePayStep("details");
    } else {
      setIsCustomParty(false);
      setCustomPartyName("");
      setSelectedBillId(undefined);
      setPhoneAccountQuery("");
      setPhonePayStep("account");
    }
  };

  const handlePhoneSaveReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback(null);

    const partyToUse = isCustomParty ? customPartyName.trim() : selectedParty.trim();
    if (!partyToUse) {
      setFormFeedback({ type: "error", text: "Please choose or enter a party name" });
      return;
    }
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setFormFeedback({ type: "error", text: "Please enter a valid payment amount" });
      return;
    }

    try {
      const billToPay = !isCustomParty ? selectedBillId : undefined;
      const saved = recordCustomerPayment(
        partyToUse,
        amtNum,
        receiptDate || todayStr,
        paymentMode,
        referenceNote.trim() || undefined,
        billToPay,
        !isCustomParty ? selectedOpt?.customerId : undefined,
      );
      if (!saved) {
        setFormFeedback({
          type: "error",
          text: "This receipt was not saved again because an identical one was just recorded.",
        });
        return;
      }

      setSavedPhonePayment({
        id: `pay_${Date.now().toString(36)}`,
        billId: billToPay,
        customerName: partyToUse,
        customerId: !isCustomParty ? selectedOpt?.customerId : undefined,
        customerPhone: !isCustomParty ? selectedOpt?.phone : undefined,
        paymentDate: receiptDate || todayStr,
        amount: amtNum,
        mode: paymentMode,
        referenceNote: referenceNote.trim() || undefined,
        recordedBy: loggedInUserName,
        salesmanId: currentUser?.role === "salesman" ? currentUser.id : undefined,
        createdAt: new Date().toISOString(),
      });
      setSelectedParty("");
      setSelectedBillId(undefined);
      setCustomPartyName("");
      setIsCustomParty(false);
      setAmount("");
      setReferenceNote("");
      setPaymentMode("cash");
      setReceiptDate(todayStr);
      setPhonePayStep("receipt");
    } catch (err: any) {
      setFormFeedback({
        type: "error",
        text: err?.message || "Failed to record payment receipt",
      });
    }
  };

  // Handle Record Receipt submission
  const handleRecordReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback(null);

    const partyToUse = isCustomParty ? customPartyName.trim() : selectedParty.trim();
    if (!partyToUse) {
      setFormFeedback({ type: "error", text: "Please choose or enter a party name" });
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setFormFeedback({ type: "error", text: "Please enter a valid payment amount" });
      return;
    }

    try {
      const billToPay = !isCustomParty ? selectedBillId : undefined;
      const split = allocateReceipt(numericAmount, partyBills, billToPay);
      const saved = recordCustomerPayment(
        partyToUse,
        numericAmount,
        receiptDate || todayStr,
        paymentMode,
        referenceNote.trim() || undefined,
        billToPay,
        !isCustomParty ? selectedOpt?.customerId : undefined
      );
      if (!saved) {
        // Same receipt sent twice within a few seconds: the first one is already saved.
        setFormFeedback({
          type: "error",
          text: "This receipt was not saved again because an identical one was just recorded.",
        });
        return;
      }

      const where = split.allocations.map((a) => `#${a.billId}`).join(", ");
      setFormFeedback({
        type: "success",
        text:
          `Receipt of ₹${money(numericAmount)} recorded for ${partyToUse}` +
          (where ? ` against invoice ${where}` : "") +
          (split.advance > 0.004 ? `${where ? "; " : " "}₹${money(split.advance)} kept as advance` : "") +
          ".",
      });

      setSelectedParty("");
      setSelectedBillId(undefined);
      setCustomPartyName("");
      setIsCustomParty(false);
      setAmount("");
      setReferenceNote("");
      setPaymentMode("cash");
      setReceiptDate(todayStr);

      setTimeout(() => setFormFeedback(null), 8000);
    } catch (err: any) {
      setFormFeedback({
        type: "error",
        text: err?.message || "Failed to record payment receipt",
      });
    }
  };

  return (
    <>
      {activeReturnIntent && (
        <div className="hh-view pb-0 pt-2">
          <CanonicalReturnBanner
            intent={activeReturnIntent}
            onReturn={() => {
              const intent = activeReturnIntent;
              setActiveReturnIntent(null);
              returnFromCanonicalAction(intent);
            }}
            onDismiss={() => setActiveReturnIntent(null)}
          />
        </div>
      )}
      {isPhone && phoneRefundPayment ? (
        <PaymentsPhoneRefundView
          orig={phoneRefundPayment}
          allPayments={allPayments}
          todayStr={todayStr}
          refundAmount={refundAmount}
          setRefundAmount={setRefundAmount}
          refundMode={refundMode}
          setRefundMode={setRefundMode}
          refundNote={refundNote}
          setRefundNote={setRefundNote}
          refundError={refundError}
          setRefundError={setRefundError}
          getCustomerCreditSummary={getCustomerCreditSummary}
          recordCustomerRefund={recordCustomerRefund}
          onClose={() => {
            setPhoneRefundPayment(null);
            setRefundError(null);
          }}
        />
      ) : isPhone && phonePayStep !== null ? (
        <PaymentsPhoneStepFlow
          phonePayStep={phonePayStep}
          setPhonePayStep={setPhonePayStep}
          savedPhonePayment={savedPhonePayment}
          setSavedPhonePayment={setSavedPhonePayment}
          existingCustomers={existingCustomers}
          customers={customers}
          orgProfile={orgProfile}
          billingSettings={billingSettings}
          todayStr={todayStr}
          loggedInUserName={loggedInUserName}
          phoneAccountQuery={phoneAccountQuery}
          setPhoneAccountQuery={setPhoneAccountQuery}
          matchingPhoneParties={matchingPhoneParties}
          partyOptions={partyOptions}
          phoneRecentCustomerNames={phoneRecentCustomerNames}
          isCustomParty={isCustomParty}
          setIsCustomParty={setIsCustomParty}
          customPartyName={customPartyName}
          setCustomPartyName={setCustomPartyName}
          selectedParty={selectedParty}
          setSelectedParty={setSelectedParty}
          selectedOpt={selectedOpt}
          partyBills={partyBills}
          selectedBillId={selectedBillId}
          setSelectedBillId={setSelectedBillId}
          amount={amount}
          setAmount={setAmount}
          numericAmount={numericAmount}
          paymentMode={paymentMode}
          setPaymentMode={setPaymentMode}
          referenceNote={referenceNote}
          setReferenceNote={setReferenceNote}
          receiptDate={receiptDate}
          setReceiptDate={setReceiptDate}
          formFeedback={formFeedback}
          handlePhoneSaveReceipt={handlePhoneSaveReceipt}
          onOpenWhatsAppPrompt={(sp) => {
            setWhatsAppPromptPayment(sp);
            setPromptPhoneInput("");
          }}
          onOpenPrintReceipt={(sp) => setReceiptPayment(sp)}
          getCustomerRawBalance={getCustomerRawBalance}
        />
      ) : selectedPaymentForDetails ? (
        <PaymentsDetailView
          payment={selectedPaymentForDetails}
          bills={bills}
          existingCustomers={existingCustomers}
          orgProfile={orgProfile}
          loggedInUserName={loggedInUserName}
          getCustomerRawBalance={getCustomerRawBalance}
          onBack={() => setSelectedPaymentForDetails(null)}
          onEdit={(p) => setPaymentToEdit(p)}
          onDelete={(p) => setPaymentToDelete(p)}
          onPrintReceipt={(p) => setReceiptPayment(p)}
          onPromptWhatsApp={(p) => {
            setWhatsAppPromptPayment(p);
            setPromptPhoneInput("");
          }}
          onOpenTaxInvoice={(bill) => setTaxInvoiceModalBill(bill)}
        />
      ) : isPhone ? (
        <PaymentsMobileView
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          historyModeFilter={historyModeFilter}
          setHistoryModeFilter={setHistoryModeFilter}
          historyVisible={historyVisible}
          setHistoryVisible={setHistoryVisible}
          recentAll={recentAll}
          dueBills={dueBills}
          historyAll={historyAll}
          filteredRecent={filteredRecent}
          filteredDueBills={filteredDueBills}
          phoneFilteredHistory={phoneFilteredHistory}
          todayStr={todayStr}
          realtimeCashInBox={realtimeCashInBox}
          totalMarketDue={totalMarketDue}
          totalInwardSpend={totalInwardSpend}
          totalBilledSales={totalBilledSales}
          getEffectiveBillBalance={getEffectiveBillBalance}
          billingSettings={billingSettings}
          paymentAudit={paymentAudit}
          showAuditLog={showAuditLog}
          setShowAuditLog={setShowAuditLog}
          phoneSheetPayment={phoneSheetPayment}
          setPhoneSheetPayment={setPhoneSheetPayment}
          existingCustomers={existingCustomers}
          orgProfile={orgProfile}
          loggedInUserName={loggedInUserName}
          openPhoneRecordFlow={openPhoneRecordFlow}
          onPrintReceipt={(p) => setReceiptPayment(p)}
          onPromptWhatsApp={(p) => {
            setWhatsAppPromptPayment(p);
            setPromptPhoneInput("");
          }}
          onStartRefund={(p) => {
            setPhoneRefundPayment(p);
            setRefundAmount("");
            setRefundMode(p.mode || "cash");
            setRefundNote("");
            setRefundError(null);
          }}
          onEditPayment={(p) => setPaymentToEdit(p)}
          onDeletePayment={(p) => setPaymentToDelete(p)}
          getCustomerRawBalance={getCustomerRawBalance}
        />
      ) : (
        <PaymentsDesktopView
          realtimeCashInBox={realtimeCashInBox}
          cashExpenses={cashExpenses}
          totalMarketDue={totalMarketDue}
          totalInwardSpend={totalInwardSpend}
          totalBilledSales={totalBilledSales}
          totalCollectedAmount={totalCollectedAmount}
          loggedInUserName={loggedInUserName}
          todayStr={todayStr}
          yesterdayStr={yesterdayStr}
          formFeedback={formFeedback}
          setFormFeedback={setFormFeedback}
          isCustomParty={isCustomParty}
          setIsCustomParty={setIsCustomParty}
          customPartyName={customPartyName}
          setCustomPartyName={setCustomPartyName}
          selectedParty={selectedParty}
          setSelectedParty={setSelectedParty}
          partyOptions={partyOptions}
          selectedOpt={selectedOpt}
          partyBills={partyBills}
          selectedBillId={selectedBillId}
          setSelectedBillId={setSelectedBillId}
          paymentMode={paymentMode}
          setPaymentMode={setPaymentMode}
          amount={amount}
          setAmount={setAmount}
          numericAmount={numericAmount}
          receiptDate={receiptDate}
          setReceiptDate={setReceiptDate}
          referenceNote={referenceNote}
          setReferenceNote={setReferenceNote}
          handleRecordReceipt={handleRecordReceipt}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          historyVisible={historyVisible}
          setHistoryVisible={setHistoryVisible}
          recentAll={recentAll}
          filteredRecent={filteredRecent}
          historyAll={historyAll}
          filteredHistory={filteredHistory}
          historyGroups={historyGroups}
          dueBills={dueBills}
          filteredDueBills={filteredDueBills}
          getEffectiveBillBalance={getEffectiveBillBalance}
          billingSettings={billingSettings}
          products={products}
          paymentAudit={paymentAudit}
          showAuditLog={showAuditLog}
          setShowAuditLog={setShowAuditLog}
          onSelectPaymentForDetails={(p) => setSelectedPaymentForDetails(p)}
        />
      )}

      <PaymentsModals
        receiptPayment={receiptPayment}
        setReceiptPayment={setReceiptPayment}
        paymentToEdit={paymentToEdit}
        setPaymentToEdit={setPaymentToEdit}
        taxInvoiceModalBill={taxInvoiceModalBill}
        setTaxInvoiceModalBill={setTaxInvoiceModalBill}
        paymentToDelete={paymentToDelete}
        setPaymentToDelete={setPaymentToDelete}
        whatsAppPromptPayment={whatsAppPromptPayment}
        setWhatsAppPromptPayment={setWhatsAppPromptPayment}
        promptPhoneInput={promptPhoneInput}
        setPromptPhoneInput={setPromptPhoneInput}
        selectedPaymentForDetails={selectedPaymentForDetails}
        setSelectedPaymentForDetails={setSelectedPaymentForDetails}
        existingCustomers={existingCustomers}
        bills={bills}
        palette={palette}
        orgProfile={orgProfile}
        loggedInUserName={loggedInUserName}
        getCustomerRawBalance={getCustomerRawBalance}
        updatePayment={updatePayment}
        deletePayment={deletePayment}
      />
    </>
  );
};
