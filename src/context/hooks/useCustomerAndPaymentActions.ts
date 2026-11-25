import { stampChangedPayments } from "../../utils/paymentStamp";
import { buildPaymentReversal, paymentReversalBlocker, reversedPaymentIds, validatePaymentEdit } from "../../utils/paymentReversal";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isServerProxyMode,
  pullDeletionLogFromSupabase,
  pullPaymentHistoryFromSupabase,
  pushDeletionRecordsToSupabase,
  pushPaymentAuditEntryToSupabase,
  pushPaymentsToSupabase,
  pushBillToSupabase,
  softDeletePaymentsInSupabase,
} from "../../lib/supabase";
import type {
  AuthUser,
  Bill,
  CartState,
  Customer,
  ExistingCustomer,
  PaymentAuditEntry,
  PaymentMode,
  PaymentRecord,
  TabId,
} from "../../types";
import { todayISO } from "../../utils/dateLocal";
import {
  allocateReceipt,
  buildAdvanceRestoreRow,
  buildReceiptRows,
  isAdvanceAdjustmentRow,
  isAdvanceRow,
  isRefundRow,
  signedPaymentAmount,
  splitUnlinkedPayments,
} from "../../utils/paymentAllocation";
import { billBalance, billNetTotal } from "../../utils/salesReturns";
import {
  type BusinessExpenseRecord,
  loadCachedCustomers,
  loadCachedPayments,
  loadCustomers,
  loadPayments,
  reportSyncFailure,
  saveCustomers,
  saveOrders,
  savePayments,
} from "../../utils/storage";
import {
  computeCustomerLedger,
  computeExistingCustomers,
  resolveMasterCustomerIdInList,
} from "../ledgerCustomerCalculations";
import {
  PAYMENT_AUDIT_KEY,
  addCustomerTombstones,
  addExpenseTombstones,
  addPaymentTombstones,
  cloud,
  cloudFetch,
  dedupeSameShopCustomers,
  findCustomerNameClash,
  findDuplicateCustomer,
  mergeCustomersNewestWins,
  normCustName,
  planCustomerUpdate,
  readCustomerTombstones,
  readHiddenCustomerNames,
  readPaymentAudit,
  renameCustomerCrateDeposits,
  saveCachedCustomerProductPrices,
  stampChangedBills,
  withoutDeletedCustomers,
  withoutDeletedPayments,
  writeHiddenCustomerNames,
} from "../ledgerHelpers";
import { calcAdvanceAllocationPlan, calcCustomerCreditSummary, calcReconcilePaymentsFromBills } from "../ledgerPaymentCalculations";

export interface UseCustomerAndPaymentActionsParams {
  initialBills: Bill[];
  initialPayments: PaymentRecord[] | undefined;
  allBills: Bill[];
  allBillsRef: React.MutableRefObject<Bill[]>;
  bills: Bill[];
  setBills: (u: Bill[] | ((prev: Bill[]) => Bill[])) => void;
  commitBillUpdates: (updatedById: Map<number, Bill>) => void;
  currentUser: AuthUser | null;
  customerProductPricesRef: React.MutableRefObject<Record<string, number>>;
  setCustomerProductPrices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setExpenses: React.Dispatch<React.SetStateAction<BusinessExpenseRecord[]>>;
  setCart: React.Dispatch<React.SetStateAction<CartState>>;
  setTab: React.Dispatch<React.SetStateAction<TabId>>;
  notify: (message: string) => void;
}

export function useCustomerAndPaymentActions({
  initialBills,
  initialPayments,
  allBills,
  allBillsRef,
  bills,
  setBills,
  commitBillUpdates,
  currentUser,
  customerProductPricesRef,
  setCustomerProductPrices,
  setExpenses,
  setCart,
  setTab,
  notify,
}: UseCustomerAndPaymentActionsParams) {
  const reconcilePaymentsFromBills = useCallback(
    (currentPayments: PaymentRecord[], billsList: Bill[]): PaymentRecord[] =>
      calcReconcilePaymentsFromBills(currentPayments, billsList),
    [],
  );

  const [payments, setPaymentsRaw] = useState<PaymentRecord[]>(() => {
    const cached = loadCachedPayments() || [];
    const base = withoutDeletedPayments(
      cached.length > 0
        ? cached
        : Array.isArray(initialPayments)
          ? initialPayments
          : [],
    );
    return reconcilePaymentsFromBills(base, initialBills);
  });
  const paymentsRef = useRef<PaymentRecord[]>(payments);
  paymentsRef.current = payments;

  // Single door for every payment change: records whose content changed get a fresh `updatedAt`, so sync can always tell
  // which copy is newest (see src/utils/paymentStamp.ts).
  const setPayments: React.Dispatch<React.SetStateAction<PaymentRecord[]>> = useCallback((action) => {
    setPaymentsRaw((prev) => {
      const next = typeof action === "function" ? (action as (p: PaymentRecord[]) => PaymentRecord[])(prev) : action;
      const stamped = stampChangedPayments(prev, next);
      paymentsRef.current = stamped;
      return stamped;
    });
  }, []);

  useEffect(() => {
    if (allBills && allBills.length > 0) {
      setPayments((prev) => {
        const reconciled = reconcilePaymentsFromBills(prev, allBills);
        if (reconciled.length !== prev.length) {
          savePayments(reconciled).catch(() => {});
          pushPaymentsToSupabase(reconciled).catch(() => {});
          return reconciled;
        }
        return prev;
      });
    }
  }, [allBills, reconcilePaymentsFromBills]);

  useEffect(() => {
    if (isServerProxyMode() && !currentUser?.id) return;
    if (payments && payments.length > 0) {
      savePayments(payments).catch(() => {});
      if (!isServerProxyMode()) {
        pushPaymentsToSupabase(payments).catch(() => {});
      }
    }
  }, [payments, currentUser?.id]);

  const [paymentAudit, setPaymentAudit] = useState<PaymentAuditEntry[]>(() =>
    readPaymentAudit(),
  );
  useEffect(() => {
    try {
      localStorage.setItem(
        PAYMENT_AUDIT_KEY,
        JSON.stringify(paymentAudit.slice(0, 1000)),
      );
    } catch {
      /* storage unavailable */
    }
  }, [paymentAudit]);
  useEffect(() => {
    if (isServerProxyMode() && !currentUser?.id) return;
    pullPaymentHistoryFromSupabase(1000)
      .then((remoteHist) => {
        if (!remoteHist || remoteHist.length === 0) return;
        setPaymentAudit((prev) => {
          const map = new Map<string, PaymentAuditEntry>();
          prev.forEach((item) => map.set(item.id, item));
          remoteHist.forEach((item) => map.set(item.id, item));
          return Array.from(map.values())
            .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
            .slice(0, 1000);
        });
      })
      .catch(() => {});
  }, [currentUser?.id]);

  function logPaymentAudit(e: Omit<PaymentAuditEntry, "id" | "at" | "by">) {
    const entry: PaymentAuditEntry = {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      by: currentUser?.name || "Admin",
      ...e,
    };
    setPaymentAudit((prev) => [entry, ...prev].slice(0, 1000));
    pushPaymentAuditEntryToSupabase(entry).catch(() => {});
    if (!isServerProxyMode() && currentUser?.role !== "salesman") {
      cloudFetch("/api/payment-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
    }
  }

  useEffect(() => {
    if (!payments || payments.length === 0) return;
    const refundIds = new Set<string>();
    for (const p of payments) {
      if (p.id && isRefundRow(p)) refundIds.add(String(p.id));
    }
    const payByBill = new Map<number, number>();
    for (const p of payments) {
      if (isRefundRow(p) || (p.reversalOf && refundIds.has(String(p.reversalOf)))) continue;
      if (p.billId) {
        const bId = Number(p.billId);
        payByBill.set(bId, (payByBill.get(bId) || 0) + signedPaymentAmount(p));
      }
    }
    setBills((prevBills) => {
      let changed = false;
      const next = prevBills.map((b) => {
        const payAmt = payByBill.get(b.id);
        if (payAmt !== undefined) {
          const newPaid = Math.min(b.total, payAmt);
          if (newPaid > (b.amountPaid || 0)) {
            changed = true;
            return { ...b, amountPaid: newPaid };
          }
        }
        return b;
      });
      return changed ? next : prevBills;
    });
  }, [payments]);

  useEffect(() => {
    if (isServerProxyMode() && !currentUser?.id) return;
    loadPayments()
      .then((remote) => {
        if (remote && Array.isArray(remote) && remote.length > 0) {
          setPayments((prev) => {
            const map = new Map<string, PaymentRecord>();
            prev.forEach((p) => map.set(p.id, p));
            withoutDeletedPayments(remote).forEach((p) => {
              const cur = map.get(p.id);
              if (!cur) {
                map.set(p.id, p);
                return;
              }
              const lt = Date.parse(cur.updatedAt || "") || 0;
              const rt = Date.parse(p.updatedAt || "") || 0;
              if (rt > lt) map.set(p.id, p);
            });
            const reconciled = reconcilePaymentsFromBills(
              Array.from(map.values()),
              allBillsRef.current,
            );
            if (reconciled.length === prev.length) {
              const prevById = new Map(prev.map((p) => [p.id, p]));
              const unchanged = reconciled.every((r) => {
                const p = prevById.get(r.id);
                return (
                  p &&
                  p.amount === r.amount &&
                  p.billId === r.billId &&
                  p.updatedAt === r.updatedAt &&
                  p.paymentDate === r.paymentDate &&
                  p.mode === r.mode &&
                  p.referenceNote === r.referenceNote &&
                  p.customerName === r.customerName
                );
              });
              if (unchanged) return prev;
            }
            return reconciled;
          });
        }
      })
      .catch(() => {});
  }, [reconcilePaymentsFromBills, currentUser?.id]);

  const customersHydratedRef = useRef(false);
  const customersFromSyntheticInitRef = useRef(false);

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const cached = loadCachedCustomers();
    if (cached && cached.length > 0) {
      const DEMO_NAMES = new Set([
        "sharma kirana",
        "gupta general store",
        "verma provision store",
        "radha krishna traders",
        "om sai refreshments",
      ]);
      const cleaned = cached.filter(
        (c) =>
          !c.id?.startsWith("cust_seed_") &&
          !DEMO_NAMES.has((c.name || "").trim().toLowerCase()),
      );
      return dedupeSameShopCustomers(withoutDeletedCustomers(cleaned)).customers;
    }
    customersFromSyntheticInitRef.current = true;
    const hidden = readHiddenCustomerNames();
    const tomb = readCustomerTombstones();
    const map = new Map<string, Customer>();
    for (const b of initialBills || []) {
      const name = b.retailer?.trim();
      if (!name || name.toLowerCase() === "cash sale") continue;
      const key = normCustName(name);
      if (!key || hidden.has(key) || tomb.has(key)) continue;
      if (!map.has(key)) {
        map.set(key, {
          id: `cust_bill_${b.id}`,
          name,
          phone: b.phone || "",
          openingBalance: 0,
          createdAt: b.date || new Date().toISOString(),
        });
      }
    }
    return withoutDeletedCustomers(Array.from(map.values()));
  });

  useEffect(() => {
    if (customers && customersHydratedRef.current) {
      saveCustomers(customers).catch(() => {});
    }
  }, [customers]);

  const [hiddenCustNames, setHiddenCustNames] = useState<Set<string>>(() =>
    readHiddenCustomerNames(),
  );

  async function syncDeletionLog(): Promise<Awaited<ReturnType<typeof pullDeletionLogFromSupabase>>> {
    const log = await pullDeletionLogFromSupabase().catch(() => []);
    if (!log.length) return log;
    const payIds = log.filter((r) => r.kind === "payment").map((r) => r.id);
    const custRecs = log.filter((r) => r.kind === "customer");
    const expIds = log.filter((r) => r.kind === "expense").map((r) => r.id);
    if (expIds.length) {
      addExpenseTombstones(expIds);
      const dead = new Set(expIds);
      setExpenses((prev) =>
        prev.some((x) => dead.has(x.id)) ? prev.filter((x) => !dead.has(x.id)) : prev,
      );
    }
    if (payIds.length) {
      const extraTombIds: string[] = [];
      for (const r of log) {
        if (r.kind === "payment") {
          const m = (r.note || "").match(/(?:invoice|bill)\s*#(\d+)/i);
          if (m && m[1]) {
            extraTombIds.push(`pay_bill_${m[1]}`);
            extraTombIds.push(`legacy_pay_${m[1]}`);
          }
        }
      }
      const allDeadIds = [...payIds, ...extraTombIds];
      addPaymentTombstones(allDeadIds);
      const dead = new Set(allDeadIds);
      setPayments((prev) =>
        prev.some((p) => dead.has(p.id)) ? prev.filter((p) => !dead.has(p.id)) : prev,
      );
    }
    if (custRecs.length) {
      addCustomerTombstones(custRecs.map((r) => r.id));
      const dead = new Set(custRecs.map((r) => r.id));
      setCustomers((prev) =>
        prev.some((c) => dead.has(c.id)) ? prev.filter((c) => !dead.has(c.id)) : prev,
      );
      const names = custRecs.map((r) => normCustName(r.name)).filter(Boolean);
      if (names.length) {
        setHiddenCustNames((prev) => {
          const next = new Set(prev);
          let changed = false;
          custRecs.forEach((r) => {
            const n = normCustName(r.name);
            if (!n || next.has(n)) return;
            const recreated = customersRef.current.some(
              (c) =>
                normCustName(c.name) === n &&
                (Date.parse(c.createdAt || "") || 0) > (Date.parse(r.deletedAt) || 0),
            );
            if (!recreated) {
              next.add(n);
              changed = true;
            }
          });
          if (changed) writeHiddenCustomerNames(next);
          return changed ? next : prev;
        });
      }
    }
    return log;
  }

  const customersRef = useRef<Customer[]>(customers);
  useEffect(() => {
    customersRef.current = customers;
  }, [customers]);

  useEffect(() => {
    if (isServerProxyMode() && !currentUser?.id) return;
    (async () => {
      await syncDeletionLog();
      const remote = await loadCustomers().catch(() => null);
      customersHydratedRef.current = true;
      if (remote && Array.isArray(remote) && remote.length > 0) {
        const skipSyntheticPrev = customersFromSyntheticInitRef.current;
        customersFromSyntheticInitRef.current = false;
        const base = skipSyntheticPrev
          ? remote
          : mergeCustomersNewestWins(customersRef.current, remote);
        const deduped = dedupeSameShopCustomers(withoutDeletedCustomers(base));
        customersRef.current = deduped.customers;
        setCustomers(deduped.customers);
        if (deduped.retiredToWinner.size > 0) {
          setPayments((ps) => {
            let changed = false;
            const next = ps.map((p) => {
              if (!p.customerId) return p;
              const mapped = deduped.retiredToWinner.get(String(p.customerId));
              if (!mapped || mapped === p.customerId) return p;
              changed = true;
              return { ...p, customerId: mapped };
            });
            if (changed) {
              savePayments(next).catch(() => {});
              if (!isServerProxyMode()) {
                pushPaymentsToSupabase(next).catch(() => {});
              }
            }
            return changed ? next : ps;
          });
        }
        if (
          deduped.customers.length < remote.length &&
          (!isServerProxyMode() || currentUser?.role !== "salesman")
        ) {
          saveCustomers(deduped.customers).catch(() => {});
        }
      }
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const recentSubmitsRef = useRef<Map<string, number>>(new Map());
  function isRapidRepeat(key: string, windowMs = 8000): boolean {
    const now = Date.now();
    const m = recentSubmitsRef.current;
    m.forEach((t, k) => {
      if (now - t > windowMs * 4) m.delete(k);
    });
    const last = m.get(key);
    if (last !== undefined && now - last < windowMs) return true;
    m.set(key, now);
    return false;
  }

  function resolveMasterCustomerId(name?: string, phone?: string): string | undefined {
    return resolveMasterCustomerIdInList(customers, name, phone);
  }

  function findBillingCustomer(name?: string, phone?: string): Customer | undefined {
    const id = resolveMasterCustomerId(name, phone);
    return id ? customers.find((c) => c.id === id) : undefined;
  }

  const existingCustomers: ExistingCustomer[] = useMemo(
    () => computeExistingCustomers({ customers, bills, payments, hiddenCustNames }),
    [customers, bills, payments, hiddenCustNames],
  );

  function getCustomerLedger(customerNameOrId: string, customerPhone?: string, customerAltPhone?: string) {
    return computeCustomerLedger({
      customerNameOrId,
      customerPhone,
      customerAltPhone,
      customers: customersRef.current,
      existingCustomers,
      bills: allBillsRef.current,
      payments: paymentsRef.current,
    });
  }

  function resolveBillPaymentModeAfterChange(
    billId: number,
    nextPayments: PaymentRecord[],
    fallbackPaid: number,
    currentMode?: PaymentMode,
  ): PaymentMode {
    const revIds = reversedPaymentIds(nextPayments);
    const modeTotals = new Map<PaymentMode, number>();
    let latestMode: PaymentMode | undefined;
    for (const p of nextPayments) {
      if (
        Number(p.billId) !== billId ||
        p.reversalOf ||
        revIds.has(String(p.id)) ||
        isRefundRow(p) ||
        isAdvanceAdjustmentRow(p)
      ) {
        continue;
      }
      const amt = signedPaymentAmount(p);
      if (amt <= 0.004 || !p.mode || p.mode === "credit") continue;
      if (!latestMode) latestMode = p.mode;
      modeTotals.set(p.mode, (modeTotals.get(p.mode) || 0) + amt);
    }
    if (modeTotals.size === 0) {
      return fallbackPaid <= 0.004 ? "credit" : currentMode || "cash";
    }
    let bestMode: PaymentMode = latestMode || currentMode || "cash";
    let bestAmt = -1;
    modeTotals.forEach((amt, m) => {
      if (amt > bestAmt + 0.004) {
        bestAmt = amt;
        bestMode = m;
      }
    });
    return bestMode;
  }

  function recordPayment(
    billId: number,
    amount: number,
    paymentDate?: string,
    mode?: PaymentMode,
    referenceNote?: string,
  ): number {
    const payDate =
      paymentDate && paymentDate.trim()
        ? paymentDate.trim()
        : todayISO();
    const payMode = mode || "cash";

    const current = allBillsRef.current.find(
      (b) => b.id === billId && b.status !== "cancelled",
    );
    if (!current || !(amount > 0)) return 0;
    if (
      isRapidRepeat(
        `rp|${billId}|${Math.round(amount * 100)}|${payDate}|${payMode}|${referenceNote || ""}`,
      )
    ) {
      notify("This payment was just recorded - the duplicate was ignored.");
      return 0;
    }
    const outstanding = billBalance(current);
    const applied = Math.round(Math.min(amount, outstanding) * 100) / 100;
    if (applied <= 0) return 0;

    const newPayRecord: PaymentRecord = {
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      billId,
      customerName: current.retailer || "Cash Sale",
      customerId: current.customerId,
      customerPhone: current.phone,
      paymentDate: payDate,
      amount: applied,
      mode: payMode,
      referenceNote: referenceNote || undefined,
      recordedBy: currentUser?.name || "Admin",
      salesmanId: currentUser?.role === "salesman" ? currentUser.id : undefined,
      createdAt: new Date().toISOString(),
    };
    const nextPayments = [newPayRecord, ...paymentsRef.current];
    const nextPaid = Math.round(((current.amountPaid || 0) + applied) * 100) / 100;
    const updatedBill: Bill = {
      ...current,
      amountPaid: nextPaid,
      paymentMode: resolveBillPaymentModeAfterChange(billId, nextPayments, nextPaid, payMode),
    };
    commitBillUpdates(new Map([[billId, updatedBill]]));

    paymentsRef.current = stampChangedPayments(paymentsRef.current, nextPayments);
    setPayments((prev) => [newPayRecord, ...prev]);
    return applied;
  }

  function recordCustomerPayment(
    customerName: string,
    amount: number,
    paymentDate: string,
    mode?: PaymentMode,
    referenceNote?: string,
    billId?: number,
    customerId?: string,
    opts?: { skipDuplicateGuard?: boolean },
  ): boolean {
    const cleanCustomer = customerName.trim();
    const billHint = billId ? allBillsRef.current.find((b) => b.id === billId) : undefined;
    const idHint =
      customerId ||
      (billHint && normCustName(billHint.retailer) === normCustName(cleanCustomer)
        ? billHint.customerId
        : undefined);
    const pickedCust = idHint
      ? customers.find((c) => c.id === idHint)
      : undefined;
    const ledgerKey = pickedCust ? pickedCust.id : cleanCustomer;
    if (!cleanCustomer || !(Number(amount) > 0)) return false;
    const payDate =
      paymentDate && paymentDate.trim()
        ? paymentDate.trim()
        : todayISO();
    const payMode = mode || "cash";
    if (
      !opts?.skipDuplicateGuard &&
      isRapidRepeat(
        `rcp|${normCustName(cleanCustomer)}|${Math.round(Number(amount) * 100)}|${payDate}|${payMode}|${referenceNote || ""}|${billId || 0}`,
      )
    ) {
      notify("This payment was just recorded - the duplicate was ignored.");
      return false;
    }

    const latest = (b: Bill) => allBillsRef.current.find((x) => x.id === b.id) ?? b;
    const isLive = (b: Bill) => b.status !== "cancelled" && !b.cancelled;
    const customerBills = getCustomerLedger(ledgerKey)
      .bills.map(latest)
      .filter(isLive);
    if (billId && !customerBills.some((b) => b.id === billId)) {
      const chosen = allBillsRef.current.find((b) => b.id === billId);
      if (chosen && isLive(chosen)) customerBills.push(chosen);
    }

    const result = allocateReceipt(Number(amount), customerBills, billId);

    let targetPhone = "";
    for (const a of result.allocations) {
      const b = customerBills.find((x) => x.id === a.billId);
      if (b?.phone) {
        targetPhone = b.phone;
        break;
      }
    }
    if (!targetPhone) {
      const matchCust =
        pickedCust ??
        customers.find(
          (c) => normCustName(c.name) === normCustName(cleanCustomer),
        );
      targetPhone = matchCust?.phone || customerBills[0]?.phone || "";
    }

    const stamp = Date.now();
    let seq = 0;
    const ledgerBefore = getCustomerLedger(ledgerKey);
    const rows = buildReceiptRows(
      {
        customerName: cleanCustomer,
        customerId: pickedCust?.id ?? resolveMasterCustomerId(cleanCustomer, targetPhone),
        customerPhone: targetPhone,
        paymentDate: payDate,
        mode: payMode,
        referenceNote: referenceNote || undefined,
        recordedBy: currentUser?.name || "Admin",
        salesmanId: currentUser?.role === "salesman" ? currentUser.id : undefined,
        createdAt: new Date(stamp + seq).toISOString(),
      },
      result,
      () => `pay_${stamp}_${seq++}_${Math.random().toString(36).slice(2, 6)}`,
    );
    const coversOpening =
      (ledgerBefore.openingBalance || 0) > 0 &&
      ledgerBefore.rawBalance - Number(amount) > -0.005;
    if (coversOpening) {
      for (const r of rows) {
        if (r.isAdvance)
          r.referenceNote = `${r.referenceNote || "Advance / on account"} · counted against opening balance`;
      }
    }

    const nextPayments = [...rows, ...paymentsRef.current];
    const updatedById = new Map<number, Bill>();
    for (const a of result.allocations) {
      const b = customerBills.find((x) => x.id === a.billId);
      if (!b) continue;
      const nextPaid = Math.round(((b.amountPaid || 0) + a.amount) * 100) / 100;
      updatedById.set(b.id, {
        ...b,
        amountPaid: nextPaid,
        paymentMode: resolveBillPaymentModeAfterChange(b.id, nextPayments, nextPaid, payMode),
      });
    }
    commitBillUpdates(updatedById);

    paymentsRef.current = stampChangedPayments(paymentsRef.current, nextPayments);
    setPayments((prev) => [...rows, ...prev]);
    for (const r of rows) {
      logPaymentAudit({
        action: "record",
        paymentId: r.id,
        billId: r.billId,
        customerName: r.customerName,
        amount: r.amount,
        note: r.billId
          ? `Received against invoice #${r.billId}`
          : "Received on account (advance)",
        after: r,
      });
    }
    return true;
  }

  function getCustomerCreditSummary(customerName: string) {
    const led = getCustomerLedger(customerName);
    return calcCustomerCreditSummary({
      ledBills: led.bills,
      ledPayments: led.payments,
      rawBalance: led.rawBalance,
      allBills: allBillsRef.current,
      allPayments: paymentsRef.current,
    });
  }

  function applyAdvanceToInvoices(customerName: string, onlyBillId?: number): number {
    const currentPayments = paymentsRef.current;
    const led = getCustomerLedger(customerName);
    const plan = calcAdvanceAllocationPlan({
      ledCustomer: led.customer,
      ledBills: led.bills,
      ledPayments: led.payments,
      allBills: allBillsRef.current,
      allPayments: currentPayments,
      onlyBillId,
      recordedBy: currentUser?.name || "Admin",
    });
    if (plan.errorMessage) {
      notify(plan.errorMessage);
      return 0;
    }
    if (plan.applied <= 0.004) return 0;

    const r2 = (n: number) => Math.round(n * 100) / 100;
    const markAdvanceApplied = (p: PaymentRecord): PaymentRecord => {
      const addApplied = plan.appliedByAdvId.get(p.id);
      if (!addApplied) return p;
      const total = Number(p.amount) || 0;
      const nextApplied = Math.min(total, r2((Number(p.appliedAmount) || 0) + addApplied));
      return {
        ...p,
        entryKind: p.entryKind || "advance",
        appliedAmount: nextApplied,
        isAdvanceApplied: nextApplied >= total - 0.004,
        updatedAt: plan.nowIso,
      };
    };

    commitBillUpdates(plan.billUpdates);
    const nextPayments = [...plan.newRows, ...currentPayments.map(markAdvanceApplied)];
    paymentsRef.current = stampChangedPayments(currentPayments, nextPayments);
    setPayments((prev) => [...plan.newRows, ...prev.map(markAdvanceApplied)]);
    plan.appliedAuditRows.forEach((r) =>
      logPaymentAudit({
        action: "apply_advance",
        paymentId: r.id,
        billId: r.billId,
        customerName: r.customerName,
        amount: r.amount,
        note: `Advance/credit of ₹${r.amount} adjusted against invoice #${r.billId}`,
        after: r,
      }),
    );
    notify(
      `₹${plan.applied.toLocaleString("en-IN", { maximumFractionDigits: 2 })} of advance/credit adjusted against ${plan.appliedAuditRows.length} unpaid invoice${plan.appliedAuditRows.length > 1 ? "s" : ""}.`,
    );
    return plan.applied;
  }

  function recordCustomerRefund(
    customerName: string,
    amount: number,
    paymentDate: string,
    mode?: PaymentMode,
    note?: string,
  ): boolean {
    const amt = Math.round((Number(amount) || 0) * 100) / 100;
    const name = (customerName || "").trim();
    if (!name || !(amt > 0)) {
      notify("Enter a refund amount greater than zero.");
      return false;
    }
    if (isRapidRepeat(`ref|${normCustName(name)}|${Math.round(amt * 100)}|${paymentDate}`)) {
      notify("This refund was just recorded - the duplicate was ignored.");
      return false;
    }
    const led = getCustomerLedger(name);
    const credit = Math.max(0, Math.round(-led.rawBalance * 100) / 100);
    if (amt > credit + 0.009) {
      notify(
        `Refund cannot be more than the customer's credit of ₹${credit.toLocaleString("en-IN", { maximumFractionDigits: 2 })}.`,
      );
      return false;
    }
    const row: PaymentRecord = {
      id: `pay_${Date.now()}_ref_${Math.random().toString(36).slice(2, 6)}`,
      customerName: led.customer?.name || name,
      customerPhone: led.customer?.phone || "",
      paymentDate: paymentDate && paymentDate.trim() ? paymentDate.trim() : todayISO(),
      amount: -amt,
      mode: mode || "cash",
      referenceNote: note ? `Refund paid to customer · ${note}` : "Refund paid to customer",
      recordedBy: currentUser?.name || "Admin",
      entryKind: "refund",
      isAdvance: true,
      isRefund: true,
      createdAt: new Date().toISOString(),
    };
    const currentPayments = paymentsRef.current;
    paymentsRef.current = stampChangedPayments(currentPayments, [row, ...currentPayments]);
    setPayments((prev) => [row, ...prev]);
    logPaymentAudit({
      action: "refund",
      paymentId: row.id,
      customerName: row.customerName,
      amount: row.amount,
      note: `Refund of ₹${amt} paid to customer`,
      after: row,
    });
    return true;
  }

  function repairPaymentLinks(): number {
    const stamp = Date.now();
    let seq = 0;
    const currentPayments = paymentsRef.current;
    const res = splitUnlinkedPayments(
      currentPayments,
      (name) =>
        getCustomerLedger(name)
          .bills.map((b) => allBillsRef.current.find((x) => x.id === b.id) ?? b)
          .filter((b) => b.status !== "cancelled" && !b.cancelled),
      () => `pay_fix_${stamp}_${seq++}_${Math.random().toString(36).slice(2, 6)}`,
    );
    if (res.changed > 0) {
      paymentsRef.current = stampChangedPayments(currentPayments, res.payments);
      setPayments(res.payments);
    }
    return res.changed;
  }

  /**
   * Cancels a recorded payment WITHOUT deleting it: a new entry of the opposite amount is added and linked to the original.
   * The invoice's paid amount drops by the same figure, so the invoice shows as owing again and the ledger shows both rows.
   */
  function reversePayment(paymentId: string, reason?: string): boolean {
    const currentPayments = paymentsRef.current;
    const target = currentPayments.find((p) => p.id === paymentId);
    if (!target) return false;
    const blocker = paymentReversalBlocker(target, currentPayments);
    if (blocker) {
      notify(blocker);
      return false;
    }
    const cleanReason = (reason || "").trim();
    const nowIso = new Date().toISOString();
    const row = buildPaymentReversal(target, {
      id: `pay_${Date.now()}_rev_${Math.random().toString(36).slice(2, 6)}`,
      nowIso,
      today: todayISO(),
      by: currentUser?.name || "Admin",
      reason: cleanReason,
    });
    const nextPayments = [row, ...currentPayments];
    if (target.billId && !isRefundRow(target)) {
      const b = allBillsRef.current.find((x) => x.id === target.billId);
      if (b) {
        const paid = Math.max(0, Math.round(((Number(b.amountPaid) || 0) - signedPaymentAmount(target)) * 100) / 100);
        const syncedMode = resolveBillPaymentModeAfterChange(b.id, nextPayments, paid, b.paymentMode);
        commitBillUpdates(new Map<number, Bill>([[b.id, { ...b, amountPaid: paid, paymentMode: syncedMode }]]));
      }
    }
    paymentsRef.current = stampChangedPayments(currentPayments, nextPayments);
    setPayments((prev) => [row, ...prev]);
    logPaymentAudit({
      action: "reverse",
      paymentId,
      billId: target.billId,
      customerName: target.customerName,
      amount: row.amount,
      note:
        `Reversed ₹${Math.abs(Number(target.amount) || 0)} ${target.mode} payment` +
        (target.billId ? ` on invoice #${target.billId}` : "") +
        (cleanReason ? ` — Reason: ${cleanReason}` : "") +
        ` (new entry ${row.id})`,
      before: target,
      after: row,
    });
    notify(
      `Payment reversed. A new entry of -₹${Math.abs(row.amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })} was added; the original stays in the history.`,
    );
    return true;
  }

  /**
   * INTERNAL: removes a row outright. Only used to undo an "advance moved onto an invoice" adjustment row (an internal
   * transfer, not money received). Real receipts and refunds go through reversePayment.
   */
  function deletePayment(paymentId: string, rectificationReason?: string): boolean {
    const currentPayments = paymentsRef.current;
    const target = currentPayments.find((p) => p.id === paymentId);
    if (!target) return false;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const delBillUpdates = new Map<number, Bill>();
    if (target.billId) {
      const b = allBillsRef.current.find((x) => x.id === target.billId);
      if (b) {
        delBillUpdates.set(b.id, {
          ...b,
          amountPaid: Math.max(0, r2(b.amountPaid - (target.amount || 0))),
        });
      }
    }

    const pairedOutRow =
      isAdvanceAdjustmentRow(target) &&
      (Number(target.amount) || 0) > 0 &&
      !target.sourcePaymentId &&
      target.sourceBillId
        ? currentPayments.find(
            (p) =>
              p.id !== target.id &&
              p.billId === target.sourceBillId &&
              p.entryKind === "advance_adjustment" &&
              Math.abs((Number(p.amount) || 0) + (Number(target.amount) || 0)) < 0.01,
          )
        : undefined;

    if (pairedOutRow && pairedOutRow.billId) {
      const sb = delBillUpdates.get(pairedOutRow.billId) ?? allBillsRef.current.find((x) => x.id === pairedOutRow.billId);
      if (sb) {
        delBillUpdates.set(sb.id, {
          ...sb,
          amountPaid: r2((sb.amountPaid || 0) + Math.abs(Number(pairedOutRow.amount) || 0)),
        });
      }
    }
    if (delBillUpdates.size > 0) {
      commitBillUpdates(delBillUpdates);
    }

    const removedIds = pairedOutRow ? [paymentId, pairedOutRow.id] : [paymentId];
    {
      const tombIds = [...removedIds];
      if (target.billId) {
        tombIds.push(`pay_bill_${target.billId}`);
        tombIds.push(`legacy_pay_${target.billId}`);
      }
      addPaymentTombstones(tombIds);
      const reason = (rectificationReason || "").trim();
      logPaymentAudit({
        action: "delete",
        paymentId,
        billId: target.billId,
        customerName: target.customerName,
        amount: target.amount,
        note:
          (target.billId
            ? `Deleted payment on invoice #${target.billId}`
            : "Deleted payment") + (reason ? ` — Reason: ${reason}` : ""),
        before: target,
      });
      if (!isServerProxyMode()) {
        softDeletePaymentsInSupabase(removedIds, currentUser?.name || "Admin", reason).catch(() => {});
        pushDeletionRecordsToSupabase(
          removedIds.map((id) => ({
            kind: "payment" as const,
            id,
            name: target.customerName,
            deletedAt: new Date().toISOString(),
            by: currentUser?.name || "Admin",
            reason,
            note: `₹${target.amount}${target.billId ? ` on invoice #${target.billId}` : ""}`,
          })),
        )
          .then((ok) => {
            if (!ok) {
              reportSyncFailure("deletePayment(log)", new Error("Could not save the delete to the cloud"));
            }
          })
          .catch(() => {});
      }
    }

    const linkedSourceAdv =
      isAdvanceAdjustmentRow(target) && target.sourcePaymentId
        ? currentPayments.find((p) => p.id === target.sourcePaymentId)
        : undefined;

    const restoreRow =
      isAdvanceAdjustmentRow(target) &&
      (Number(target.amount) || 0) > 0 &&
      !linkedSourceAdv &&
      !pairedOutRow
        ? buildAdvanceRestoreRow(
            target,
            () => `pay_${Date.now()}_rst_${Math.random().toString(36).slice(2, 6)}`,
            currentUser?.name || "Admin",
          )
        : null;

    if (linkedSourceAdv) {
      notify(
        `₹${(Number(target.amount) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })} adjustment removed; available advance on ${linkedSourceAdv.customerName}'s account updated.`,
      );
    } else if (restoreRow) {
      logPaymentAudit({
        action: "record",
        paymentId: restoreRow.id,
        customerName: restoreRow.customerName,
        amount: restoreRow.amount,
        note: `Advance of ₹${restoreRow.amount} restored on account (adjustment on invoice #${target.billId} deleted)`,
        after: restoreRow,
      });
      notify(
        `₹${restoreRow.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })} was put back on ${restoreRow.customerName}'s account as an advance.`,
      );
    }

    const removeSet = new Set(removedIds);
    const nowIso = new Date().toISOString();
    const applyRemoval = (list: PaymentRecord[]): PaymentRecord[] => [
      ...(restoreRow ? [restoreRow] : []),
      ...list
        .filter((p) => !removeSet.has(p.id))
        .map((p) => {
          if (!linkedSourceAdv || p.id !== linkedSourceAdv.id) return p;
          const total = Number(p.amount) || 0;
          const nextApplied = Math.max(0, r2((Number(p.appliedAmount) || 0) - (Number(target.amount) || 0)));
          return {
            ...p,
            appliedAmount: nextApplied,
            isAdvanceApplied: nextApplied >= total - 0.004 && nextApplied > 0.004,
            updatedAt: nowIso,
          };
        }),
    ];
    const next = applyRemoval(currentPayments);
    paymentsRef.current = stampChangedPayments(currentPayments, next);
    setPayments((prev) => applyRemoval(prev));
    const deleteReason = (rectificationReason || "").trim();
    for (const delId of removedIds) {
      cloudFetch(`/api/payments/${encodeURIComponent(delId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          by: currentUser?.name || "Admin",
          reason: deleteReason,
          note: `₹${target.amount}${target.billId ? ` on invoice #${target.billId}` : ""}`,
        }),
      });
    }
    if (next.length === 0 && currentPayments.length > 0) {
      savePayments([]).catch(() => {});
      if (!isServerProxyMode()) {
        pushPaymentsToSupabase([], true).catch(() => {});
      }
    }
    return true;
  }

  /**
   * Correcting a recorded payment. A recorded amount, date, mode, customer or invoice is never rewritten: the old entry is
   * reversed (opposite entry, original kept) and the corrected one is recorded as a NEW entry. Only the reference note (UTR,
   * cheque no., remarks) can change on the row itself.
   */
  function updatePayment(updated: PaymentRecord, reason?: string): boolean {
    const currentPayments = paymentsRef.current;
    const old = currentPayments.find((p) => p.id === updated.id);
    const check = validatePaymentEdit(updated, currentPayments);
    if (check.ok !== true) {
      if ("error" in check && check.error) notify(check.error);
      return false;
    }
    if (!old) return false;
    if (check.kind === "in_place_adjustment") {
      // Rows that move advance money onto an invoice are internal transfers: keep the in-place correction for those.
      return updatePaymentInPlace(updated);
    }

    if (check.kind === "note_only") {
      const nextPayments = currentPayments.map((p) =>
        p.id === old.id ? { ...p, referenceNote: updated.referenceNote } : p,
      );
      paymentsRef.current = stampChangedPayments(currentPayments, nextPayments);
      setPayments((prev) =>
        prev.map((p) => (p.id === old.id ? { ...p, referenceNote: updated.referenceNote } : p)),
      );
      logPaymentAudit({
        action: "edit",
        paymentId: old.id,
        billId: old.billId,
        customerName: old.customerName,
        amount: old.amount,
        note: `Reference note changed${reason ? ` — ${reason}` : ""}`,
        before: old,
        after: { ...old, referenceNote: updated.referenceNote },
      });
      return true;
    }

    const prevPaymentsSnapshot = currentPayments;
    const prevBillsSnapshot = allBillsRef.current;
    const why = `Corrected${reason ? `: ${reason}` : ""}`;
    if (!reversePayment(old.id, why)) return false;

    const replacementNote = updated.referenceNote || undefined;
    if (isAdvanceRow(old)) {
      const nowIso = new Date().toISOString();
      const row: PaymentRecord = {
        id: `pay_${Date.now()}_fix_${Math.random().toString(36).slice(2, 6)}`,
        ...(old.customerId ? { customerId: old.customerId } : {}),
        customerName: check.cleanCustomer,
        customerPhone: old.customerPhone || "",
        ...(old.salesmanId ? { salesmanId: old.salesmanId } : {}),
        paymentDate: updated.paymentDate || todayISO(),
        amount: check.newAmount,
        mode: updated.mode || old.mode,
        entryKind: "advance",
        isAdvance: true,
        referenceNote: [replacementNote, "Advance / on account"].filter(Boolean).join(" · "),
        recordedBy: currentUser?.name || "Admin",
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      paymentsRef.current = stampChangedPayments(paymentsRef.current, [row, ...paymentsRef.current]);
      setPayments((prev) => [row, ...prev]);
      logPaymentAudit({
        action: "record",
        paymentId: row.id,
        customerName: row.customerName,
        amount: row.amount,
        note: `Corrected advance (replaces ${old.id})`,
        after: row,
      });
    } else {
      const recorded = recordCustomerPayment(
        check.cleanCustomer,
        check.newAmount,
        updated.paymentDate || todayISO(),
        updated.mode || old.mode,
        replacementNote,
        updated.billId || undefined,
        old.customerId,
        { skipDuplicateGuard: true },
      );
      if (!recorded) {
        const rollbackBills = new Map<number, Bill>();
        for (const prevB of prevBillsSnapshot) {
          const curB = allBillsRef.current.find((x) => x.id === prevB.id);
          if (curB && (curB.amountPaid !== prevB.amountPaid || curB.paymentMode !== prevB.paymentMode)) {
            rollbackBills.set(prevB.id, prevB);
          }
        }
        if (rollbackBills.size > 0) commitBillUpdates(rollbackBills);
        paymentsRef.current = prevPaymentsSnapshot;
        setPayments(prevPaymentsSnapshot);
        notify("Could not record the corrected replacement payment. The original payment was left unchanged.");
        return false;
      }
    }
    notify("Payment corrected: the old entry was reversed and the corrected one recorded. Both stay in the history.");
    return true;
  }

  function updatePaymentInPlace(updated: PaymentRecord): boolean {
    const old = paymentsRef.current.find((p) => p.id === updated.id);
    const round2 = (n: number) => Math.round(n * 100) / 100;
    if (old?.isRefund) {
      notify("A refund entry cannot be edited. Reverse it and record the refund again.");
      return false;
    }
    if (!old) {
      return false;
    }
    if (
      isRapidRepeat(
        `up|${updated.id}|${Math.round((Number(updated.amount) || 0) * 100)}|${updated.billId || 0}|${updated.paymentDate || ""}|${updated.mode || ""}|${updated.referenceNote || ""}`,
        4000,
      )
    ) {
      return false;
    }
    const oldAmt = Number(old.amount) || 0;
    const newAmt = Number(updated.amount) || 0;
    const oldBillId = old.billId || 0;
    const newBillId = updated.billId || 0;
    const finalRow: PaymentRecord = { ...updated };
    let excess = 0;

    if (oldBillId !== newBillId) {
      const moved = new Map<number, Bill>();
      if (oldBillId) {
        const ob = allBillsRef.current.find((x) => x.id === oldBillId);
        if (ob)
          moved.set(ob.id, {
            ...ob,
            amountPaid: Math.max(0, (ob.amountPaid || 0) - oldAmt),
          });
      }
      if (newBillId) {
        const nb =
          moved.get(newBillId) ??
          allBillsRef.current.find((x) => x.id === newBillId);
        if (nb) {
          const applied = round2(Math.min(newAmt, billBalance(nb)));
          excess = round2(newAmt - applied);
          finalRow.amount = applied;
          finalRow.isAdvance = false;
          moved.set(nb.id, {
            ...nb,
            amountPaid: round2((nb.amountPaid || 0) + applied),
          });
        }
      } else {
        finalRow.isAdvance = true;
      }
      commitBillUpdates(moved);
    } else if (oldBillId) {
      if (Math.abs(newAmt - oldAmt) > 0.004) {
        const b = allBillsRef.current.find((x) => x.id === oldBillId);
        if (b) {
          const others = Math.max(0, (b.amountPaid || 0) - oldAmt);
          const room = Math.max(0, round2(billNetTotal(b) - others));
          const applied = round2(Math.min(newAmt, room));
          excess = round2(newAmt - applied);
          finalRow.amount = applied;
          commitBillUpdates(
            new Map([[b.id, { ...b, amountPaid: round2(others + applied) }]]),
          );
        }
      }
    } else if (isAdvanceRow(old)) {
      finalRow.isAdvance = true;
    } else if (old.customerName && Math.abs(newAmt - oldAmt) > 0.004) {
      const diff = newAmt - oldAmt;
      const targetCustomer = old.customerName.trim().toLowerCase();
      if (diff > 0) {
        let remaining = diff;
        const unpaidBills = allBillsRef.current
          .filter(
            (b) =>
              b.status !== "cancelled" &&
              !b.cancelled &&
              (b.retailer || "").trim().toLowerCase() === targetCustomer &&
              billBalance(b) > 0,
          )
          .sort((a, b) => (a.date > b.date ? 1 : -1));
        const updatedMap = new Map<number, Bill>();
        for (const b of unpaidBills) {
          if (remaining <= 0) break;
          const due = billBalance(b);
          const toPay = Math.min(remaining, due);
          updatedMap.set(b.id, { ...b, amountPaid: (b.amountPaid || 0) + toPay });
          remaining -= toPay;
        }
        if (updatedMap.size > 0) commitBillUpdates(updatedMap);
      } else {
        let remaining = Math.abs(diff);
        const paidBills = allBillsRef.current
          .filter(
            (b) =>
              b.status !== "cancelled" &&
              !b.cancelled &&
              (b.retailer || "").trim().toLowerCase() === targetCustomer &&
              (b.amountPaid || 0) > 0,
          )
          .sort((a, b) => (a.date < b.date ? 1 : -1));
        const updatedMap = new Map<number, Bill>();
        for (const b of paidBills) {
          if (remaining <= 0) break;
          const toRevert = Math.min(remaining, b.amountPaid || 0);
          updatedMap.set(b.id, {
            ...b,
            amountPaid: Math.max(0, (b.amountPaid || 0) - toRevert),
          });
          remaining -= toRevert;
        }
        if (updatedMap.size > 0) commitBillUpdates(updatedMap);
      }
    }

    const extraRows: PaymentRecord[] = [];
    const advNote = [updated.referenceNote, "Advance / on account"].filter(Boolean).join(" · ");
    const currentPaymentsSnapshot = paymentsRef.current;
    const advAlreadyThere = currentPaymentsSnapshot.some(
      (p) =>
        p.id !== updated.id &&
        !p.billId &&
        isAdvanceRow(p) &&
        normCustName(p.customerName) === normCustName(finalRow.customerName) &&
        (p.paymentDate || "") === (finalRow.paymentDate || "") &&
        Math.abs((Number(p.amount) || 0) - excess) < 0.005 &&
        (p.referenceNote || "") === advNote,
    );
    if (excess > 0.004 && !advAlreadyThere) {
      extraRows.push({
        ...finalRow,
        id: `pay_${Date.now()}_adv_${Math.random().toString(36).slice(2, 6)}`,
        billId: undefined,
        isAdvance: true,
        amount: excess,
        referenceNote:
          [updated.referenceNote, "Advance / on account"].filter(Boolean).join(" · "),
      });
    }
    const applyInPlace = (list: PaymentRecord[]): PaymentRecord[] => [
      ...extraRows,
      ...list.map((p) => (p.id === updated.id ? finalRow : p)),
    ];
    paymentsRef.current = stampChangedPayments(currentPaymentsSnapshot, applyInPlace(currentPaymentsSnapshot));
    setPayments((prev) => applyInPlace(prev));
    logPaymentAudit({
      action: "edit",
      paymentId: finalRow.id,
      billId: finalRow.billId,
      customerName: finalRow.customerName,
      amount: finalRow.amount,
      note:
        oldAmt !== finalRow.amount || oldBillId !== (finalRow.billId || 0)
          ? `Changed ₹${oldAmt} (${oldBillId ? "invoice #" + oldBillId : "no invoice"}) to ₹${finalRow.amount} (${finalRow.billId ? "invoice #" + finalRow.billId : "no invoice"})`
          : "Edited payment details",
      before: old,
      after: finalRow,
    });
    return true;
  }

  function addCustomer(
    customerData: Omit<Customer, "id" | "createdAt"> & { id?: string },
    options?: { useExistingOnPhoneMatch?: boolean },
  ): Customer {
    if (!customerData.id) {
      const { sameShop: dup, samePhone } = findDuplicateCustomer(
        customersRef.current,
        customerData.name,
        customerData.phone,
      );
      if (dup) {
        notify(
          `${dup.name} is already in the customer list - the existing customer was used and nothing was changed.`,
        );
        return dup;
      }
      if (samePhone && options?.useExistingOnPhoneMatch) {
        return samePhone;
      }
    }
    const id =
      customerData.id ||
      `cust_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newCust: Customer = {
      ...customerData,
      id,
      name: customerData.name.trim(),
      phone: (customerData.phone || "").trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    customersHydratedRef.current = true;
    customersFromSyntheticInitRef.current = false;
    customersRef.current = [newCust, ...customersRef.current.filter((c) => c.id !== id)];
    setCustomers((prev) => [newCust, ...prev.filter((c) => c.id !== id)]);
    {
      const n = normCustName(newCust.name);
      if (n && hiddenCustNames.has(n)) {
        const next = new Set(hiddenCustNames);
        next.delete(n);
        writeHiddenCustomerNames(next);
        setHiddenCustNames(next);
      }
    }
    return newCust;
  }

  function updateCustomer(
    updated: Customer,
    syncLinkedBillsAndPayments = true,
    previousIdentity?: { name: string; phone?: string },
  ): Customer {
    const plan = planCustomerUpdate({
      customers: customersRef.current,
      bills: allBillsRef.current,
      payments: paymentsRef.current,
      customerProductPrices: customerProductPricesRef.current,
      updated,
      syncLinkedBillsAndPayments,
      previousIdentity,
    });

    customersHydratedRef.current = true;
    customersFromSyntheticInitRef.current = false;
    customersRef.current = plan.customers;
    setCustomers(plan.customers);
    saveCustomers(plan.customers).catch(() => {});

    if (plan.unhideNormalizedName && hiddenCustNames.has(plan.unhideNormalizedName)) {
      const next = new Set(hiddenCustNames);
      next.delete(plan.unhideNormalizedName);
      writeHiddenCustomerNames(next);
      setHiddenCustNames(next);
    }

    if (plan.retiredDuplicateIds.length > 0) {
      addCustomerTombstones(plan.retiredDuplicateIds);
      const retiredNow = new Date().toISOString();
      pushDeletionRecordsToSupabase(
        plan.retiredDuplicateIds.map((id) => ({
          kind: "customer" as const,
          id,
          deletedAt: retiredNow,
          by: currentUser?.name || "Admin",
          reason: `Merged duplicate customer into ${plan.savedCustomer.name}`,
        })),
      ).catch(() => {});
    }

    if (plan.changedBills.length > 0) {
      const changedMap = new Map<number, Bill>(plan.changedBills.map((b) => [b.id, b]));
      const nextBills = stampChangedBills(
        allBillsRef.current,
        allBillsRef.current.map((b) => changedMap.get(b.id) ?? b),
      );
      allBillsRef.current = nextBills;
      saveOrders(nextBills as any).catch(() => {});
      setBills((bs) => bs.map((b) => changedMap.get(b.id) ?? b));
      for (const upBill of plan.changedBills) {
        cloud("pushBillToSupabase", pushBillToSupabase(upBill));
        cloudFetch("/api/bills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(upBill),
        });
      }
    }

    if (plan.paymentsChanged) {
      const changedPayMap = new Map<string, PaymentRecord>(
        plan.payments.map((p) => [p.id, p]),
      );
      const nextPays = stampChangedPayments(
        paymentsRef.current,
        paymentsRef.current.map((p) => changedPayMap.get(p.id) ?? p),
      );
      paymentsRef.current = nextPays;
      savePayments(nextPays).catch(() => {});
      pushPaymentsToSupabase(nextPays).catch(() => {});
      setPayments((ps) => ps.map((p) => changedPayMap.get(p.id) ?? p));
    }

    if (
      plan.customerProductPrices &&
      plan.customerProductPrices !== customerProductPricesRef.current
    ) {
      customerProductPricesRef.current = plan.customerProductPrices;
      setCustomerProductPrices(plan.customerProductPrices);
      saveCachedCustomerProductPrices(plan.customerProductPrices);
    }

    if (plan.canSyncCrateDeposits) {
      renameCustomerCrateDeposits(
        plan.oldName,
        plan.savedCustomer.name,
        plan.savedCustomer.phone,
      );
    }

    return plan.savedCustomer;
  }

  function customerNameClash(
    customerId: string,
    name: string,
    opts?: { oldName?: string; phone?: string },
  ): Customer | undefined {
    return findCustomerNameClash(customers, {
      customerId,
      oldName: opts?.oldName,
      newName: name,
      phone: opts?.phone,
    });
  }

  function deleteCustomer(
    customerId: string,
    rectificationReason?: string,
    _opts?: { removePayments?: boolean },
  ) {
    const currentCustomers = customersRef.current;
    const target = currentCustomers.find((c) => c.id === customerId);
    const reason = (rectificationReason || "").trim();
    const opening = Number(target?.openingBalance) || 0;
    if (target && Math.abs(opening) > 0.004 && !reason) {
      notify(
        `${target.name} has an opening balance of ₹${opening.toLocaleString("en-IN")}. Enter a rectification comment to delete anyway, so the reason is recorded.`,
      );
      return;
    }
    customersHydratedRef.current = true;
    customersFromSyntheticInitRef.current = false;
    const remainingCustomers = currentCustomers.filter((c) => c.id !== customerId);
    customersRef.current = remainingCustomers;
    setCustomers(remainingCustomers);
    if (!target) return;

    addCustomerTombstones([customerId]);
    const n = normCustName(target.name);
    const hasSurvivingSameName = n && remainingCustomers.some((c) => normCustName(c.name) === n);
    if (n && !hasSurvivingSameName) {
      const next = new Set(hiddenCustNames);
      next.add(n);
      writeHiddenCustomerNames(next);
      setHiddenCustNames(next);
    }

    cloudFetch(`/api/customers/${encodeURIComponent(customerId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: target.name,
        by: currentUser?.name || "Admin",
        reason,
      }),
    });

    pushDeletionRecordsToSupabase([
      {
        kind: "customer",
        id: customerId,
        name: target.name,
        deletedAt: new Date().toISOString(),
        by: currentUser?.name || "Admin",
        reason,
        note:
          Math.abs(opening) > 0.004
            ? `Opening balance ₹${opening.toLocaleString("en-IN")} at delete`
            : undefined,
      },
    ])
      .then((ok) => {
        if (!ok) {
          reportSyncFailure("deleteCustomer(log)", new Error("Could not save the delete to the cloud"));
        }
      })
      .catch(() => {});
  }

  function startBillForCustomer(customerName: string, customerPhone?: string) {
    const trimmed = customerName.trim();
    if (!trimmed) return;
    setCart((prev) => ({
      ...prev,
      retailer: trimmed,
      phone: customerPhone || "",
      date: todayISO(),
    }));
    setTab("billing");
    window.dispatchEvent(
      new CustomEvent("app-new-bill", {
        detail: { customerName: trimmed, customerPhone: customerPhone || "" },
      }),
    );
  }

  return {
    payments,
    setPayments,
    reversePayment,
    paymentsRef,
    paymentAudit,
    setPaymentAudit,
    reconcilePaymentsFromBills,
    logPaymentAudit,
    customers,
    setCustomers,
    customersRef,
    hiddenCustNames,
    setHiddenCustNames,
    syncDeletionLog,
    recordPayment,
    recordCustomerPayment,
    getCustomerCreditSummary,
    applyAdvanceToInvoices,
    recordCustomerRefund,
    repairPaymentLinks,
    deletePayment,
    updatePayment,
    addCustomer,
    updateCustomer,
    customerNameClash,
    deleteCustomer,
    existingCustomers,
    startBillForCustomer,
    resolveMasterCustomerId,
    findBillingCustomer,
    getCustomerLedger,
  };
}
