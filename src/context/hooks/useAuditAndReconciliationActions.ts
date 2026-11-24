import React from "react";
import {
  deleteAuditFromSupabase,
  deleteAuditSessionFromSupabase,
  pushAuditSessionToSupabase,
  pushAuditToSupabase,
  pushReconciliationTransactionToSupabase,
  pushStockLedgerEntryToSupabase,
} from "../../lib/supabase";
import type {
  Audit,
  AuditEntry,
  AuditSession,
  AuthUser,
  InvestigationReason,
  Product,
  ReconciliationTransaction,
  StockLedgerEntry,
  UserRole,
  VarianceEntry,
  Warehouse,
} from "../../types";
import { todayISO } from "../../utils/dateLocal";
import {
  reportSyncFailure,
  reportSyncSuccess,
  saveAuditSessions,
  saveReconciliationTransactions,
  saveStockLedgerEntries,
} from "../../utils/storage";
import {
  calcApproveReconciliationPlan,
  calcClassifyVarianceEntries,
  calcCreateAuditSession,
  calcSaveAuditSessionCountsPlan,
  calcUpdatedAuditSession,
} from "../ledgerAuditSessionHelpers";
import { cloud, cloudFetch, reserveDocNumber } from "../ledgerHelpers";

export interface SupabaseStatusState {
  isConnected: boolean;
  isChecking: boolean;
  latencyMs: number;
  allTablesExist: boolean;
  lastSyncedAt: string | null;
  message: string;
  error: string | undefined;
}

export interface UseAuditAndReconciliationActionsParams {
  audits: Audit[];
  setAudits: React.Dispatch<React.SetStateAction<Audit[]>>;
  auditSessions: AuditSession[];
  setAuditSessions: React.Dispatch<React.SetStateAction<AuditSession[]>>;
  reconciliationTransactions: ReconciliationTransaction[];
  setReconciliationTransactions: React.Dispatch<React.SetStateAction<ReconciliationTransaction[]>>;
  setStockLedgerEntries: React.Dispatch<React.SetStateAction<StockLedgerEntry[]>>;
  products: Product[];
  warehouses: Warehouse[];
  defaultWarehouse: Warehouse | undefined;
  bookStock: (productId: number, warehouseId?: string) => number;
  stockAsOf: (productId: number, asOfDate: string, warehouseId?: string) => number;
  fallbackWarehouseId: (product: Product) => string;
  currentUser: AuthUser | null;
  currentRole: UserRole | null;
  setSupabaseStatus: React.Dispatch<React.SetStateAction<SupabaseStatusState>>;
  logDeletion: (
    kind: "product" | "batch" | "warehouse" | "audit" | "promotion" | "salesman",
    id: string,
    name?: string,
  ) => void;
}

export function useAuditAndReconciliationActions({
  audits,
  setAudits,
  auditSessions,
  setAuditSessions,
  reconciliationTransactions,
  setReconciliationTransactions,
  setStockLedgerEntries,
  products,
  warehouses,
  defaultWarehouse,
  bookStock,
  stockAsOf,
  fallbackWarehouseId,
  currentUser,
  currentRole,
  setSupabaseStatus,
  logDeletion,
}: UseAuditAndReconciliationActionsParams) {
  function syncAuditSession(session: AuditSession) {
    pushAuditSessionToSupabase(session)
      .then((res) => {
        if (res && !res.success) {
          reportSyncFailure("Audit session", res.error);
          setSupabaseStatus((prev) => ({
            ...prev,
            message: `Audit session saved on this device but NOT to the cloud: ${res.error}. Run the audit SQL (sql/audit-sessions-and-grn-history.sql) in Supabase.`,
          }));
        } else {
          reportSyncSuccess();
        }
      })
      .catch((err) => reportSyncFailure("Audit session", err));
  }

  function classifyEntries(rawEntries: VarianceEntry[]): VarianceEntry[] {
    return calcClassifyVarianceEntries(rawEntries, products);
  }

  function createAuditSession(params: {
    warehouseId?: string;
    warehouseName?: string;
    date: string;
    auditorName: string;
    referenceNote?: string;
    counts: { productId: number; physicalStock: number }[];
  }): AuditSession {
    const session = calcCreateAuditSession({
      params,
      products,
      warehouses,
      defaultWarehouse,
      bookStock,
    });
    setAuditSessions((prev) => {
      const next = [session, ...prev];
      saveAuditSessions(next).catch(() => {});
      return next;
    });
    syncAuditSession(session);
    return session;
  }

  function deleteAuditSession(id: string) {
    const remaining = auditSessions.filter((s) => s.id !== id);
    setAuditSessions(remaining);
    cloud("deleteAuditSessionFromSupabase", deleteAuditSessionFromSupabase(id));
    saveAuditSessions(remaining).catch(() => {});
  }

  function updateAuditSession(
    id: string,
    updates: {
      date?: string;
      warehouseId?: string;
      warehouseName?: string;
      auditorName?: string;
      referenceNote?: string;
    },
  ) {
    const existing = auditSessions.find((s) => s.id === id);
    if (!existing) return;
    const updated = calcUpdatedAuditSession({
      existing,
      updates,
      userName: currentUser?.name || "Admin",
    });
    setAuditSessions((prev) => {
      const next = prev.map((s) => (s.id === id ? updated : s));
      saveAuditSessions(next).catch(() => {});
      return next;
    });
    syncAuditSession(updated);
  }

  function saveAuditSessionCounts(
    sessionId: string,
    counts: { productId: number; physicalStock: number }[],
    removeProductIds: number[] = [],
  ) {
    const session = auditSessions.find((s) => s.id === sessionId);
    if (!session) return { updated: 0, added: 0, removed: 0, locked: 0 };
    const { result, updatedSession } = calcSaveAuditSessionCountsPlan({
      session,
      counts,
      removeProductIds,
      products,
      bookStock,
      userName: currentUser?.name || "Admin",
    });
    if (!updatedSession) return result;
    setAuditSessions((prev) => {
      const next = prev.map((s) => (s.id === sessionId ? updatedSession : s));
      saveAuditSessions(next).catch(() => {});
      return next;
    });
    syncAuditSession(updatedSession);
    return result;
  }

  function updateVarianceEntry(
    sessionId: string,
    varianceEntryId: string,
    updates: Partial<VarianceEntry>,
  ) {
    setAuditSessions((prev) => {
      const next = prev.map((s) =>
        s.id !== sessionId
          ? s
          : {
              ...s,
              updatedAt: new Date().toISOString(),
              entries: s.entries.map((e) =>
                e.id === varianceEntryId ? { ...e, ...updates } : e,
              ),
            },
      );
      const updatedSession = next.find((s) => s.id === sessionId);
      if (updatedSession) syncAuditSession(updatedSession);
      saveAuditSessions(next).catch(() => {});
      return next;
    });
  }

  function confirmSwap(
    sessionId: string,
    varianceEntryId: string,
    params: {
      candidateProductId: number;
      quantity: number;
      matchScore?: number;
      notes?: string;
    },
  ) {
    const session = auditSessions.find((s) => s.id === sessionId);
    const entry = session?.entries.find((e) => e.id === varianceEntryId);
    if (!session || !entry) return;
    const candidate = products.find((p) => p.id === params.candidateProductId);
    const quantity = Math.max(0, Number(params.quantity) || 0);
    if (quantity <= 0) return;

    const txn: ReconciliationTransaction = {
      id:
        "rtxn_" +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 6),
      auditSessionId: sessionId,
      varianceEntryId,
      type: "swap",
      fromProductId: entry.productId,
      toProductId: params.candidateProductId,
      quantity,
      matchScore: params.matchScore,
      notes: params.notes,
      identifiedBy: currentUser?.name || "Admin",
      createdAt: new Date().toISOString(),
    };
    setReconciliationTransactions((prev) => {
      const next = [txn, ...prev];
      saveReconciliationTransactions(next).catch(() => {});
      return next;
    });
    cloud(
      "pushReconciliationTransactionToSupabase",
      pushReconciliationTransactionToSupabase(txn),
    );

    const priorConfirmed = Number(entry.confirmedSwapQuantity) || 0;
    updateVarianceEntry(sessionId, varianceEntryId, {
      classification: "reconciled",
      decisionStatus: "awaiting_approval",
      confirmedSwapWithProductId: params.candidateProductId,
      confirmedSwapQuantity: priorConfirmed + quantity,
    });

    const candidateEntry = session.entries.find(
      (e) => e.productId === params.candidateProductId,
    );
    if (candidateEntry && candidateEntry.decisionStatus === "pending") {
      updateVarianceEntry(sessionId, candidateEntry.id, {
        classification: "reconciled",
        decisionStatus: "awaiting_approval",
      });
    }
    void candidate;
  }

  function rejectSuggestion(sessionId: string, varianceEntryId: string) {
    updateVarianceEntry(sessionId, varianceEntryId, {
      decisionStatus: "suggestion_rejected",
    });
  }

  function keepAsSeparateVariance(sessionId: string, varianceEntryId: string) {
    const session = auditSessions.find((s) => s.id === sessionId);
    const entry = session?.entries.find((e) => e.id === varianceEntryId);
    if (!entry) return;
    updateVarianceEntry(sessionId, varianceEntryId, {
      decisionStatus: "kept_separate",
      classification: entry.variance < 0 ? "shortage" : "excess",
    });
  }

  function markUnderInvestigation(
    sessionId: string,
    varianceEntryId: string,
    notes?: string,
  ) {
    updateVarianceEntry(sessionId, varianceEntryId, {
      classification: "under_investigation",
      decisionStatus: "investigating",
      notes,
    });
  }

  function selectInvestigationReason(
    sessionId: string,
    varianceEntryId: string,
    params: {
      reason: InvestigationReason;
      notes?: string;
      attachmentRef?: string;
    },
  ) {
    const session = auditSessions.find((s) => s.id === sessionId);
    const entry = session?.entries.find((e) => e.id === varianceEntryId);
    if (!session || !entry) return;

    if (params.reason === "unknown_variance") {
      updateVarianceEntry(sessionId, varianceEntryId, {
        classification: "unexplained",
        decisionStatus: "investigating",
        investigationReason: params.reason,
        notes: params.notes,
        attachmentRef: params.attachmentRef,
      });
      return;
    }

    const txn: ReconciliationTransaction = {
      id:
        "rtxn_" +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 6),
      auditSessionId: sessionId,
      varianceEntryId,
      type: "investigation_reason",
      fromProductId: entry.productId,
      quantity: entry.variance,
      reasonCode: params.reason,
      notes: params.notes,
      identifiedBy: currentUser?.name || "Admin",
      createdAt: new Date().toISOString(),
    };
    setReconciliationTransactions((prev) => {
      const next = [txn, ...prev];
      saveReconciliationTransactions(next).catch(() => {});
      return next;
    });
    cloud(
      "pushReconciliationTransactionToSupabase",
      pushReconciliationTransactionToSupabase(txn),
    );

    updateVarianceEntry(sessionId, varianceEntryId, {
      classification: "reconciled",
      decisionStatus: "awaiting_approval",
      investigationReason: params.reason,
      notes: params.notes,
      attachmentRef: params.attachmentRef,
    });
  }

  function approveReconciliation(
    sessionId: string,
    varianceEntryId: string,
    approverName: string,
  ) {
    if (currentRole !== "admin") return;
    const session = auditSessions.find((s) => s.id === sessionId);
    const entry = session?.entries.find((e) => e.id === varianceEntryId);
    if (!session || !entry || entry.decisionStatus !== "awaiting_approval")
      return;

    const { now, pendingTxns, newLedgerEntries, candidateEntryIdsToApply } =
      calcApproveReconciliationPlan({
        sessionId,
        session,
        varianceEntryId,
        reconciliationTransactions,
        products,
        warehouses,
        defaultWarehouse,
        currentUserId: currentUser?.id,
        approverName,
      });

    if (newLedgerEntries.length === 0) return;

    setStockLedgerEntries((prev) => {
      const next = [...newLedgerEntries, ...prev];
      saveStockLedgerEntries(next).catch(() => {});
      return next;
    });
    newLedgerEntries.forEach((le) =>
      cloud(
        "pushStockLedgerEntryToSupabase",
        pushStockLedgerEntryToSupabase(le),
      ),
    );

    setReconciliationTransactions((prev) => {
      const next = prev.map((t) =>
        pendingTxns.some((pt) => pt.id === t.id)
          ? { ...t, approvedBy: approverName, approvedAt: now }
          : t,
      );
      saveReconciliationTransactions(next).catch(() => {});
      return next;
    });
    pendingTxns.forEach((t) => {
      const updated = { ...t, approvedBy: approverName, approvedAt: now };
      cloud(
        "pushReconciliationTransactionToSupabase",
        pushReconciliationTransactionToSupabase(updated),
      );
    });

    updateVarianceEntry(sessionId, varianceEntryId, {
      classification: "approved_adjustment",
      decisionStatus: "applied",
      approvedBy: approverName,
      approvedAt: now,
      appliedLedgerEntryId: newLedgerEntries[0]?.id,
    });

    for (const ceId of candidateEntryIdsToApply) {
      updateVarianceEntry(sessionId, ceId, {
        classification: "approved_adjustment",
        decisionStatus: "applied",
        approvedBy: approverName,
        approvedAt: now,
      });
    }
  }

  // Stock Audit
  function saveAudit(
    counts: Record<number, number | string>,
    adjustStock: boolean,
    auditDate?: string,
    referenceNote?: string,
    warehouseId?: string,
  ) {
    const targetDate =
      auditDate && auditDate.trim()
        ? auditDate.trim()
        : todayISO();
    const entries: AuditEntry[] = Object.entries(counts)
      .map(([k, v]) => [Number(k), v] as [number, number | string])
      .filter(([, val]) => val !== "" && val !== undefined)
      // A count must be a real number, zero or more: "abc" or -5 would turn the product's stock into NaN / negative.
      .filter(([, val]) => Number.isFinite(Number(val)) && Number(val) >= 0)
      .map(([pid, val]) => {
        const product = products.find((p) => p.id === pid);
        const system = stockAsOf(pid, targetDate, warehouseId);
        const counted = Number(val);
        const adjWh =
          warehouseId || (product ? fallbackWarehouseId(product) : "") || undefined;
        const entry: AuditEntry = {
          productId: pid,
          name: product ? product.name : `Product #${pid}`,
          system,
          counted,
          diff: counted - system,
        };
        if (adjustStock && adjWh) entry.warehouseId = adjWh;
        return entry;
      });

    if (entries.length === 0) return;

    const nextId = reserveDocNumber("audit", audits.length ? Math.max(...audits.map((x) => x.id)) : 0);
    const nowTime = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const newAudit: Audit = {
      id: nextId,
      date: targetDate,
      time: nowTime,
      referenceNote: referenceNote?.trim() || undefined,
      entries,
      adjusted: adjustStock,
    };
    setAudits((as) => [newAudit, ...as]);
    cloud("pushAuditToSupabase", pushAuditToSupabase(newAudit));
    cloudFetch("/api/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAudit),
    });
  }

  function saveBatchAudit(input: {
    date?: string;
    warehouseId: string;
    referenceNote?: string;
    lines: {
      productId: number;
      batchKey?: string;
      batchNumber?: string;
      expiryDate?: string;
      system: number;
      counted: number;
      kind?: AuditEntry["kind"];
      reason?: string;
    }[];
  }): number | null {
    const targetDate = input.date && input.date.trim() ? input.date.trim() : todayISO();
    const entries: AuditEntry[] = input.lines
      .filter((l) => Number.isFinite(l.counted) && Number.isFinite(l.system) && l.counted >= 0)
      .map((l) => {
        const product = products.find((p) => p.id === l.productId);
        const entry: AuditEntry = {
          productId: l.productId,
          name: product ? product.name : `Product #${l.productId}`,
          system: l.system,
          counted: l.counted,
          diff: l.kind === "oversold_open" ? 0 : l.counted - l.system,
          warehouseId: input.warehouseId || undefined,
        };
        if (l.batchKey) entry.batchKey = l.batchKey;
        if (l.batchNumber) entry.batchNumber = l.batchNumber;
        if (l.expiryDate) entry.expiryDate = l.expiryDate;
        if (l.kind) entry.kind = l.kind;
        else if (l.batchKey) entry.kind = "batch";
        if (l.reason) entry.reason = l.reason;
        return entry;
      });
    if (entries.length === 0) return null;

    const nextId = reserveDocNumber("audit", audits.length ? Math.max(...audits.map((x) => x.id)) : 0);
    const nowTime = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const newAudit: Audit = {
      id: nextId,
      date: targetDate,
      time: nowTime,
      referenceNote: input.referenceNote?.trim() || undefined,
      entries,
      adjusted: true,
    };
    setAudits((as) => [newAudit, ...as]);
    cloud("pushAuditToSupabase", pushAuditToSupabase(newAudit));
    cloudFetch("/api/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAudit),
    });
    return nextId;
  }

  function deleteAudit(id: number) {
    logDeletion("audit", String(id));
    setAudits((as) => as.filter((a) => a.id !== id));
    cloud("deleteAuditFromSupabase", deleteAuditFromSupabase(id));
    cloudFetch(`/api/audits/${id}`, { method: "DELETE" });
  }

  return {
    classifyEntries,
    createAuditSession,
    deleteAuditSession,
    updateAuditSession,
    saveAuditSessionCounts,
    updateVarianceEntry,
    confirmSwap,
    rejectSuggestion,
    keepAsSeparateVariance,
    markUnderInvestigation,
    selectInvestigationReason,
    approveReconciliation,
    saveAudit,
    saveBatchAudit,
    deleteAudit,
  };
}
