import React, { useEffect, useRef, useState } from "react";
import {
  isServerProxyMode,
  pullDeletionLogFromSupabase,
  pushDeletionRecordsToSupabase,
} from "../../lib/supabase";
import {
  loadBusinessExpenses,
  loadCachedBusinessExpenses,
  mergeExpenseLists,
  reportSyncFailure,
  saveBusinessExpenses,
  type BusinessExpenseRecord,
} from "../../utils/storage";
import type { AuthUser } from "../../types";
import { addExpenseTombstones, readExpenseTombstones } from "../ledgerHelpers";

export interface UseExpensesParams {
  currentUser?: AuthUser | null;
  currentUserRef: React.MutableRefObject<AuthUser | null>;
}

export function useExpenses({ currentUser, currentUserRef }: UseExpensesParams) {
  // Business expenses: ONE shared list used by Business reports (Profit & loss) and Reports (Net profit).
  // Cached on the device and synced to the server/cloud collection like the other ledgers.
  // Deletes are remembered (device + cloud deletion log) so a stale copy can never bring an expense back,
  // and the merge is newest-edit-wins so an old server copy never undoes a newer edit.
  const [expenses, setExpenses] = useState<BusinessExpenseRecord[]>(() => {
    const readKey = (k: string): BusinessExpenseRecord[] => {
      try {
        const raw = localStorage.getItem(k);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    };
    // also pick up entries made in earlier versions (own key / old Business-reports key)
    return mergeExpenseLists(
      readExpenseTombstones(),
      loadCachedBusinessExpenses(),
      readKey("mrwater_biz_expenses_v1"),
      readKey("mrwater_expenses_v1").map((r: any) => ({ ...r, note: r.note || "" })),
    );
  });

  const expensesReadyRef = useRef(false);
  const expensesRef = useRef<BusinessExpenseRecord[]>(expenses);
  useEffect(() => {
    expensesRef.current = expenses;
  }, [expenses]);

  /** Pull the cloud copy, apply the deletion log, merge newest-wins into state. */
  const refreshExpensesFromCloud = async () => {
    if (isServerProxyMode() && (!currentUserRef.current || currentUserRef.current.role === "salesman")) {
      return;
    }
    const log = await pullDeletionLogFromSupabase().catch(() => []);
    addExpenseTombstones(log.filter((r) => r.kind === "expense").map((r) => r.id));
    const dead = readExpenseTombstones();
    const remote = await loadBusinessExpenses().catch(() => []);
    setExpenses((local) => {
      const merged = mergeExpenseLists(dead, remote, local);
      return JSON.stringify(merged) === JSON.stringify(local) ? local : merged;
    });
  };

  useEffect(() => {
    if (isServerProxyMode() && (!currentUser || currentUser.role === "salesman")) {
      expensesReadyRef.current = false;
      return;
    }
    let alive = true;
    (async () => {
      await refreshExpensesFromCloud();
      if (!alive) return;
      expensesReadyRef.current = true;
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role]);

  // Never write before the first load finished, or an empty list could overwrite the server copy.
  // The save itself merges with the server copy first, so another device's new entries are kept.
  useEffect(() => {
    if (!expensesReadyRef.current) return;
    if (isServerProxyMode() && (!currentUserRef.current || currentUserRef.current.role === "salesman")) {
      return;
    }
    saveBusinessExpenses(expenses, readExpenseTombstones())
      .then((merged) => {
        if (
          merged.length !== expensesRef.current.length ||
          JSON.stringify(merged) !== JSON.stringify(expensesRef.current)
        ) {
          setExpenses(merged);
        }
      })
      .catch(() => {});
  }, [expenses]);

  const addExpense = (e: Omit<BusinessExpenseRecord, "id">): BusinessExpenseRecord => {
    const rec: BusinessExpenseRecord = {
      ...e,
      note: e.note || "",
      amount: Math.max(0, Number(e.amount) || 0),
      id: "exp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      updatedAt: new Date().toISOString(),
    };
    setExpenses((prev) => [rec, ...prev]);
    return rec;
  };

  const updateExpense = (id: string, patch: Partial<Omit<BusinessExpenseRecord, "id">>) =>
    setExpenses((prev) =>
      prev.map((x) =>
        x.id === id
          ? {
              ...x,
              ...patch,
              amount: patch.amount !== undefined ? Math.max(0, Number(patch.amount) || 0) : x.amount,
              updatedAt: new Date().toISOString(),
            }
          : x,
      ),
    );

  const deleteExpense = (id: string, rectificationReason?: string) => {
    const target = expensesRef.current.find((x) => x.id === id);
    addExpenseTombstones([id]);
    if (target) {
      pushDeletionRecordsToSupabase([
        {
          kind: "expense",
          id,
          name: target.paidTo || target.category,
          deletedAt: new Date().toISOString(),
          by: currentUserRef.current?.name || "Admin",
          reason: rectificationReason,
          note: `₹${target.amount} ${target.category} on ${String(target.date).slice(0, 10)}`,
        },
      ])
        .then((ok) => {
          if (!ok) reportSyncFailure("deleteExpense(log)", new Error("Could not save the delete to the cloud"));
        })
        .catch(() => {});
    }
    setExpenses((prev) => prev.filter((x) => x.id !== id));
  };

  return {
    expenses,
    setExpenses,
    expensesRef,
    refreshExpensesFromCloud,
    addExpense,
    updateExpense,
    deleteExpense,
  };
}
