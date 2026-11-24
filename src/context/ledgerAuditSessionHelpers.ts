import {
  AuditSession,
  Product,
  ReconciliationTransaction,
  StockLedgerEntry,
  VarianceClassification,
  VarianceEntry,
  Warehouse,
} from "../types";
import { classifyVariance, findSwapSuggestions } from "../utils/stockReconciliation";

export function calcClassifyVarianceEntries(
  rawEntries: VarianceEntry[],
  products: Product[],
): VarianceEntry[] {
  return rawEntries.map((entry) => {
    if (entry.variance === 0)
      return {
        ...entry,
        classification: "matched" as VarianceClassification,
      };
    const suggestions =
      entry.variance < 0
        ? findSwapSuggestions({
            shortageEntry: entry,
            allEntries: rawEntries,
            products,
          })
        : rawEntries
            .filter((e) => e.variance < 0)
            .flatMap((shortage) =>
              findSwapSuggestions({
                shortageEntry: shortage,
                allEntries: rawEntries,
                products,
              }),
            )
            .filter((sg) => sg.candidateProductId === entry.productId);
    return {
      ...entry,
      classification: classifyVariance({
        variance: entry.variance,
        hasSuggestions: suggestions.length > 0,
      }),
    };
  });
}

export function calcCreateAuditSession(args: {
  params: {
    warehouseId?: string;
    warehouseName?: string;
    date: string;
    auditorName: string;
    referenceNote?: string;
    counts: { productId: number; physicalStock: number }[];
  };
  products: Product[];
  warehouses: Warehouse[];
  defaultWarehouse: Warehouse | undefined;
  bookStock: (productId: number) => number;
}): AuditSession {
  const { params, products, warehouses, defaultWarehouse, bookStock } = args;
  // A stock adjustment only changes live stock when it is tied to a warehouse, so a session without
  // one falls back to the default godown (otherwise an approved adjustment would silently do nothing).
  const auditWarehouse =
    warehouses.find((w) => w.id === params.warehouseId) ||
    defaultWarehouse ||
    warehouses[0];
  const now = new Date().toISOString();
  // Pass 1: raw variances against live system stock (the same bookStock() the rest of
  // the app already treats as the current live count — no parallel stock system).
  const rawEntries: VarianceEntry[] = params.counts.map((c) => {
    const product = products.find((p) => p.id === c.productId);
    const systemStock = bookStock(c.productId);
    const variance = c.physicalStock - systemStock;
    return {
      id: `ve_${c.productId}`,
      productId: c.productId,
      productName: product?.name || `Product #${c.productId}`,
      systemStock,
      physicalStock: c.physicalStock,
      variance,
      classification: "matched", // placeholder, resolved in pass 2 below
      decisionStatus: "pending",
      requiresApproval: true,
    };
  });

  const entries = calcClassifyVarianceEntries(rawEntries, products);

  return {
    id:
      "asess_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 6),
    warehouseId: auditWarehouse?.id,
    warehouseName: auditWarehouse?.name || params.warehouseName,
    date: params.date,
    auditorName: params.auditorName,
    referenceNote: params.referenceNote,
    entries,
    createdAt: now,
    updatedAt: now,
  };
}

export function calcUpdatedAuditSession(args: {
  existing: AuditSession;
  updates: {
    date?: string;
    warehouseId?: string;
    warehouseName?: string;
    auditorName?: string;
    referenceNote?: string;
  };
  userName: string;
}): AuditSession {
  const { existing, updates, userName } = args;
  const changed: string[] = [];
  if (updates.date && updates.date !== existing.date)
    changed.push(`date ${existing.date} → ${updates.date}`);
  if (
    updates.auditorName !== undefined &&
    updates.auditorName !== existing.auditorName
  )
    changed.push(`auditor ${existing.auditorName} → ${updates.auditorName}`);
  if (
    updates.warehouseId !== undefined &&
    updates.warehouseId !== existing.warehouseId
  )
    changed.push(
      `godown ${existing.warehouseName || "-"} → ${updates.warehouseName || "-"}`,
    );
  if (
    updates.referenceNote !== undefined &&
    (updates.referenceNote || "") !== (existing.referenceNote || "")
  )
    changed.push("note updated");
  const now = new Date().toISOString();
  return {
    ...existing,
    ...updates,
    editLog:
      changed.length > 0
        ? [
            ...(existing.editLog || []),
            {
              at: now,
              by: userName,
              note: changed.join("; "),
            },
          ]
        : existing.editLog,
    updatedAt: now,
  };
}

export function calcSaveAuditSessionCountsPlan(args: {
  session: AuditSession;
  counts: { productId: number; physicalStock: number }[];
  removeProductIds: number[];
  products: Product[];
  bookStock: (productId: number) => number;
  userName: string;
}): {
  result: { updated: number; added: number; removed: number; locked: number };
  updatedSession: AuditSession | null;
} {
  const { session, counts, removeProductIds, products, bookStock, userName } = args;
  const result = { updated: 0, added: 0, removed: 0, locked: 0 };

  // Entries that already have an approval trail must never be silently rewritten.
  const isLocked = (e: VarianceEntry) =>
    e.decisionStatus === "awaiting_approval" ||
    e.decisionStatus === "applied";
  const countMap = new Map(counts.map((c) => [c.productId, c.physicalStock]));
  const removeSet = new Set(removeProductIds);
  const log: string[] = [];

  let entries: VarianceEntry[] = [];
  for (const e of session.entries) {
    if (removeSet.has(e.productId)) {
      if (isLocked(e)) {
        result.locked++;
        entries.push(e);
      } else {
        result.removed++;
        log.push(`removed ${e.productName}`);
      }
      continue;
    }
    if (
      countMap.has(e.productId) &&
      countMap.get(e.productId) !== e.physicalStock
    ) {
      if (isLocked(e)) {
        result.locked++;
        entries.push(e);
        continue;
      }
      const physical = countMap.get(e.productId)!;
      // Keep the original system-stock snapshot so a backdated audit stays consistent.
      entries.push({
        ...e,
        physicalStock: physical,
        variance: physical - e.systemStock,
        decisionStatus: "pending",
        confirmedSwapWithProductId: undefined,
        confirmedSwapQuantity: undefined,
        investigationReason: undefined,
      });
      result.updated++;
      log.push(`${e.productName} count ${e.physicalStock} → ${physical}`);
      continue;
    }
    entries.push(e);
  }
  // Products that were missing from the session
  const existingIds = new Set(session.entries.map((e) => e.productId));
  for (const c of counts) {
    if (existingIds.has(c.productId)) continue;
    const product = products.find((p) => p.id === c.productId);
    const systemStock = bookStock(c.productId);
    entries.push({
      id: `ve_${c.productId}`,
      productId: c.productId,
      productName: product?.name || `Product #${c.productId}`,
      systemStock,
      physicalStock: c.physicalStock,
      variance: c.physicalStock - systemStock,
      classification: "matched",
      decisionStatus: "pending",
      requiresApproval: true,
    });
    result.added++;
    log.push(
      `added ${product?.name || c.productId} (count ${c.physicalStock})`,
    );
  }

  if (result.updated + result.added + result.removed === 0) {
    return { result, updatedSession: null };
  }

  // Re-run matching over the whole session, but keep already-actioned entries as they were.
  const reclassified = calcClassifyVarianceEntries(entries, products);
  entries = entries.map((e, i) =>
    e.decisionStatus === "pending" ? reclassified[i] : e,
  );

  const now = new Date().toISOString();
  const updatedSession: AuditSession = {
    ...session,
    entries,
    editLog: [
      ...(session.editLog || []),
      { at: now, by: userName, note: log.join("; ") },
    ],
    updatedAt: now,
  };
  return { result, updatedSession };
}

export function calcApproveReconciliationPlan(args: {
  sessionId: string;
  session: AuditSession;
  varianceEntryId: string;
  reconciliationTransactions: ReconciliationTransaction[];
  products: Product[];
  warehouses: Warehouse[];
  defaultWarehouse: Warehouse | undefined;
  currentUserId: string | undefined;
  approverName: string;
}): {
  now: string;
  pendingTxns: ReconciliationTransaction[];
  newLedgerEntries: StockLedgerEntry[];
  candidateEntryIdsToApply: string[];
} {
  const {
    sessionId,
    session,
    varianceEntryId,
    reconciliationTransactions,
    products,
    warehouses,
    defaultWarehouse,
    currentUserId,
    approverName,
  } = args;
  const now = new Date().toISOString();
  const pendingTxns = reconciliationTransactions.filter(
    (t) => t.varianceEntryId === varianceEntryId && !t.approvedAt,
  );

  const newLedgerEntries: StockLedgerEntry[] = [];
  const productDeltas = new Map<number, number>();

  for (const txn of pendingTxns) {
    const isSwap = txn.type === "swap";
    const fromDelta = isSwap ? -txn.quantity : txn.quantity; // reason-code entries correct straight to physical
    productDeltas.set(
      txn.fromProductId,
      (productDeltas.get(txn.fromProductId) || 0) + fromDelta,
    );
    const fromProductName =
      products.find((p) => p.id === txn.fromProductId)?.name ||
      `Product #${txn.fromProductId}`;
    const toProductName = txn.toProductId
      ? products.find((p) => p.id === txn.toProductId)?.name
      : undefined;

    newLedgerEntries.push({
      id:
        "sle_" +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 6),
      productId: txn.fromProductId,
      warehouseId: session.warehouseId || defaultWarehouse?.id || warehouses[0]?.id,
      quantity: fromDelta,
      transactionType: "audit_reconciliation",
      referenceAuditSessionId: sessionId,
      referenceReconciliationId: txn.id,
      reason: isSwap
        ? `Confirmed product swap with ${toProductName || "another SKU"} — ${fromProductName}`
        : `${txn.reasonCode} — ${fromProductName}`,
      userId: currentUserId,
      userName: approverName,
      timestamp: now,
    });

    if (isSwap && txn.toProductId) {
      productDeltas.set(
        txn.toProductId,
        (productDeltas.get(txn.toProductId) || 0) + txn.quantity,
      );
      newLedgerEntries.push({
        id:
          "sle_" +
          Date.now().toString(36) +
          Math.random().toString(36).slice(2, 6) +
          "_b",
        productId: txn.toProductId,
        warehouseId: session.warehouseId || defaultWarehouse?.id || warehouses[0]?.id,
        quantity: txn.quantity,
        transactionType: "audit_reconciliation",
        referenceAuditSessionId: sessionId,
        referenceReconciliationId: txn.id,
        reason: `Confirmed product swap with ${fromProductName} — ${toProductName || "another SKU"}`,
        userId: currentUserId,
        userName: approverName,
        timestamp: now,
      });
    }
  }

  const candidateEntryIdsToApply = session.entries
    .filter(
      (e) =>
        e.id !== varianceEntryId &&
        e.decisionStatus === "awaiting_approval" &&
        pendingTxns.some((t) => t.toProductId === e.productId),
    )
    .map((e) => e.id);

  return {
    now,
    pendingTxns,
    newLedgerEntries,
    candidateEntryIdsToApply,
  };
}
