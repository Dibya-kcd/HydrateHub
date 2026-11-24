import { nameFromMap } from "../../../hooks/useAutoOdiaName";
import { ExistingCustomer, OrganizationProfile } from "../../../types";
import { money } from "../../../utils/billing";
import { isAdvanceAdjustmentRow, signedPaymentAmount } from "../../../utils/paymentAllocation";
import { billBalance } from "../../../utils/salesReturns";
import { normCustName } from "../../../context/ledgerHelpers";
import type { LedgerEntry } from "./customerFormUtils";

export type LedgerEntryWithBalance = LedgerEntry & { runningBalance: number };

export function formatEntryDate(dateStr: string) {
  if (!dateStr) return "—";
  const d = new Date(
    dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr,
  );
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export function formatPhoneLedgerDate(dateStr: string) {
  if (!dateStr) return "—";
  const d = new Date(
    dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr,
  );
  if (isNaN(d.getTime())) return dateStr;
  const nowY = new Date().getFullYear();
  if (d.getFullYear() === nowY) {
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

export function computeCustomerDetailLedger(args: {
  customer: ExistingCustomer;
  language: "en" | "or";
  customerNameMap: Map<string, string>;
  customerTypeById: Map<string, string>;
  customerTypeByName: Map<string, string>;
  orgProfile?: OrganizationProfile;
  ledgerFilter: "all" | "bill" | "payment" | "return";
  getCustomerLedger: (customerKey: string, phone?: string, altPhone?: string) => any;
  getCustomerCreditSummary: (customerName: string) => any;
}) {
  const {
    customer: c,
    language,
    customerNameMap,
    customerTypeById,
    customerTypeByName,
    orgProfile,
    ledgerFilter,
    getCustomerLedger,
    getCustomerCreditSummary,
  } = args;

  const ledgerKey = c.id || c.name;
  const ledger = getCustomerLedger(ledgerKey, c.phone, c.altPhone);
  const creditLimit = ledger.customer?.creditLimit ?? c.creditLimit ?? 0;
  const openingBal = ledger.openingBalance || 0;
  const balanceDue = ledger.balanceDue;
  const rawBalance =
    ledger.rawBalance ??
    openingBal + ledger.totalBilled - (ledger.totalReturns || 0) - ledger.totalPaid;
  const isOverLimit = ledger.isOverLimit;

  const ledgerEntries: LedgerEntry[] = [];
  if (openingBal !== 0) {
    ledgerEntries.push({
      kind: "opening",
      id: "opening",
      date: ledger.customer?.createdAt?.slice(0, 10) || "1970-01-01",
      amount: openingBal,
    });
  }
  for (const b of ledger.bills) {
    if (b.status === "cancelled" || b.cancelled) continue;
    ledgerEntries.push({
      kind: "bill",
      id: `bill_${b.id}`,
      date: b.date || "",
      bill: b,
      amount: b.total || 0,
      due: billBalance(b),
    });

    for (const ret of b.returns || []) {
      ledgerEntries.push({
        kind: "return",
        id: `ret_${ret.id || b.id}_${ret.creditNoteNo || ""}`,
        date: ret.date || b.date || "",
        bill: b,
        salesReturn: ret,
        amount: ret.totalCredit || 0,
      });
    }
  }
  const presentPayIds = new Set(ledger.payments.map((p: any) => p.id));
  for (const p of ledger.payments) {
    const isLegacy = String(p.id || "").startsWith("legacy_pay_");
    ledgerEntries.push({
      kind: "payment",
      id: p.id,
      date: p.paymentDate || p.createdAt?.slice(0, 10) || "",
      payment: p,
      amount: signedPaymentAmount(p),
      isLegacy,
    });
  }
  ledgerEntries.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const rank: Record<string, number> = { opening: 0, bill: 1, return: 2, payment: 3 };
    return (rank[a.kind] || 0) - (rank[b.kind] || 0);
  });

  let running = 0;
  const entriesWithBalance: LedgerEntryWithBalance[] = ledgerEntries.map((e) => {
    if (e.kind === "opening") running += e.amount;
    else if (e.kind === "bill") running += e.amount;
    else if (e.kind === "return") running -= e.amount;
    else {
      const p = e.payment;
      const isDoubleCountedAdj = Boolean(
        p &&
          p.sourcePaymentId &&
          isAdvanceAdjustmentRow(p) &&
          e.amount > 0 &&
          presentPayIds.has(p.sourcePaymentId),
      );
      if (!isDoubleCountedAdj) running -= e.amount;
    }
    return { ...e, runningBalance: Math.round(running * 100) / 100 };
  });

  const orgName = orgProfile?.name || "MrWater Distribution";
  const statementWaText = [
    `*Customer Ledger Statement - ${nameFromMap(customerNameMap, c, language)}*`,
    orgName,
    `Date: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
    `--------------------------------`,
    `*Total Invoiced:* ₹${money(ledger.totalBilled)}`,
    (ledger.totalReturns || 0) > 0 ? `*Returns / Credit Notes:* -₹${money(ledger.totalReturns)}` : null,
    `*Total Paid:* ₹${money(ledger.totalPaid)}`,
    openingBal !== 0 ? `*Opening Balance:* ₹${money(openingBal)}` : null,
    `--------------------------------`,
    rawBalance < 0
      ? `*Account Balance:* ₹${money(Math.abs(rawBalance))} (Advance / Credit)`
      : `*Current Balance Due:* ₹${money(balanceDue)}`,
    ``,
    `Please verify your ledger records. Thank you!`,
  ]
    .filter(Boolean)
    .join("\n");

  const cleanPhone = (c.phone || "").replace(/\D/g, "");
  const destPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const statementWaUrl = destPhone
    ? `https://wa.me/${destPhone}?text=${encodeURIComponent(statementWaText)}`
    : null;

  const customerTypeLabel =
    (c.id && customerTypeById.get(c.id)) ||
    customerTypeByName.get(normCustName(c.name)) ||
    "Retail";
  const creditSummary = getCustomerCreditSummary(c.name);
  const hasAdvanceScreen =
    rawBalance < -0.004 ||
    (creditSummary.refundable > 0.004 && balanceDue <= 0.004);
  const creditLimitPct =
    creditLimit > 0
      ? Math.min(100, Math.max(0, Math.round((balanceDue / creditLimit) * 100)))
      : 0;
  const filteredLedgerEntries = entriesWithBalance.filter((e) => {
    if (ledgerFilter === "all") return true;
    return e.kind === ledgerFilter;
  });
  const phoneLedgerEntries = [...filteredLedgerEntries].reverse();

  return {
    ledger,
    creditLimit,
    openingBal,
    balanceDue,
    rawBalance,
    isOverLimit,
    entriesWithBalance,
    statementWaText,
    statementWaUrl,
    customerTypeLabel,
    creditSummary,
    hasAdvanceScreen,
    creditLimitPct,
    phoneLedgerEntries,
  };
}
