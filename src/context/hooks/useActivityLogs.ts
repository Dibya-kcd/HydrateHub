import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ActivityActionType,
  ActivityDiffItem,
  ActivityEntityType,
  ActivityLogEntry,
  AuthUser,
  Bill,
  GRN,
  PaymentAuditEntry,
  Salesman,
  TabId,
  UserRole,
} from "../../types";
import {
  pullActivityLogsFromSupabase,
  pushActivityLogsBatchToSupabase,
  pushActivityLogToSupabase,
} from "../../lib/supabase";

export const ACTIVITY_LOG_STORAGE_KEY = "hh_activity_logs_v1";
const MAX_LOCAL_LOGS = 1500;

function readCachedActivityLogs(): ActivityLogEntry[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_LOCAL_LOGS);
  } catch {
    return [];
  }
}

function writeCachedActivityLogs(list: ActivityLogEntry[]): void {
  try {
    localStorage.setItem(
      ACTIVITY_LOG_STORAGE_KEY,
      JSON.stringify(list.slice(0, MAX_LOCAL_LOGS)),
    );
  } catch {
    // Ignore storage quota errors
  }
}

function stringifyVal(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : "—";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return `${val.length} item${val.length === 1 ? "" : "s"}`;
  try {
    const s = JSON.stringify(val);
    return s.length > 90 ? `${s.slice(0, 87)}...` : s;
  } catch {
    return String(val);
  }
}

const IGNORED_DIFF_KEYS = new Set([
  "updatedAt",
  "createdAt",
  "editHistory",
  "syncStatus",
  "snapshot",
  "items",
  "loaded",
  "returned",
  "draftReturned",
  "warehouseLoads",
  "entries",
]);

export function computeActivityDiff(
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null,
): ActivityDiffItem[] {
  if (!before && !after) return [];
  const a = before || {};
  const b = after || {};
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
  const diffs: ActivityDiffItem[] = [];
  for (const key of keys) {
    if (IGNORED_DIFF_KEYS.has(key)) continue;
    const va = a[key];
    const vb = b[key];
    const sa = stringifyVal(va);
    const sb = stringifyVal(vb);
    if (sa !== sb) {
      diffs.push({ field: key, from: sa, to: sb });
    }
  }
  return diffs.slice(0, 16);
}

export interface RecordActivityInput {
  entityType: ActivityEntityType;
  entityId: string | number;
  entityLabel: string;
  action: ActivityActionType;
  reason?: string;
  summary: string;
  sourceScreen?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changes?: ActivityDiffItem[];
}

export interface UseActivityLogsParams {
  currentUser: AuthUser | null;
  currentRole: UserRole | null;
  activeSalesman: Salesman | null;
  activeTab: TabId;
  paymentAudit: PaymentAuditEntry[];
  bills: Bill[];
  grns: GRN[];
}

export function useActivityLogs({
  currentUser,
  currentRole,
  activeSalesman,
  activeTab,
  paymentAudit,
  bills,
  grns,
}: UseActivityLogsParams) {
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>(() =>
    readCachedActivityLogs(),
  );
  const logsRef = useRef<ActivityLogEntry[]>(activityLogs);
  logsRef.current = activityLogs;

  const actorMeta = useMemo(() => {
    const role: ActivityLogEntry["actorRole"] =
      currentRole === "salesman" ? "salesman" : currentUser ? "admin" : "system";
    const name =
      (activeSalesman?.name ||
        currentUser?.name ||
        (currentUser && "email" in currentUser ? currentUser.email : undefined) ||
        currentUser?.phone ||
        (role === "admin" ? "Admin" : "System")) + "";
    const phone =
      activeSalesman?.phone ||
      (currentUser && "phone" in currentUser ? currentUser.phone : undefined);
    return { name: name.trim() || "Admin", role, phone };
  }, [currentUser, currentRole, activeSalesman]);

  const recordActivity = useCallback(
    (input: RecordActivityInput): ActivityLogEntry => {
      const diffs =
        input.changes && input.changes.length > 0
          ? input.changes
          : input.before && input.after
            ? computeActivityDiff(input.before, input.after)
            : [];

      const entry: ActivityLogEntry = {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
        entityType: input.entityType,
        entityId: String(input.entityId),
        entityLabel: input.entityLabel || String(input.entityId),
        action: input.action,
        actorName: actorMeta.name,
        actorRole: actorMeta.role,
        ...(actorMeta.phone ? { actorPhone: actorMeta.phone } : {}),
        sourceScreen: input.sourceScreen || activeTab,
        ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
        summary: input.summary,
        ...(input.before !== undefined ? { before: input.before } : {}),
        ...(input.after !== undefined ? { after: input.after } : {}),
        ...(diffs.length > 0 ? { changes: diffs } : {}),
        syncStatus: "pending",
      };

      const next = [entry, ...logsRef.current].slice(0, MAX_LOCAL_LOGS);
      logsRef.current = next;
      setActivityLogs(next);
      writeCachedActivityLogs(next);

      // Push asynchronously to Supabase (`public.activity_logs` + `app_collections` fallback)
      void (async () => {
        const directOk = await pushActivityLogToSupabase(entry);
        const ok = directOk || (await pushActivityLogsBatchToSupabase([entry]));
        if (ok) {
          setActivityLogs((prev) => {
            const updated = prev.map((x) =>
              x.id === entry.id ? { ...x, syncStatus: "synced" as const } : x,
            );
            writeCachedActivityLogs(updated);
            return updated;
          });
        }
      })();

      return entry;
    },
    [actorMeta, activeTab],
  );

  const flushActivityLogs = useCallback(async (): Promise<boolean> => {
    const pending = logsRef.current.filter((x) => x.syncStatus !== "synced");
    if (pending.length === 0) return true;
    const ok = await pushActivityLogsBatchToSupabase(pending);
    if (ok) {
      const pendingIds = new Set(pending.map((x) => x.id));
      setActivityLogs((prev) => {
        const updated = prev.map((x) =>
          pendingIds.has(x.id) ? { ...x, syncStatus: "synced" as const } : x,
        );
        writeCachedActivityLogs(updated);
        return updated;
      });
    }
    return ok;
  }, []);

  const pullActivityLogs = useCallback(async (): Promise<ActivityLogEntry[]> => {
    const remote = await pullActivityLogsFromSupabase(1000);
    if (remote.length === 0) return logsRef.current;
    const byId = new Map<string, ActivityLogEntry>();
    for (const r of remote) byId.set(r.id, { ...r, syncStatus: "synced" });
    for (const l of logsRef.current) {
      if (!byId.has(l.id)) byId.set(l.id, l);
    }
    const merged = Array.from(byId.values())
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, MAX_LOCAL_LOGS);
    logsRef.current = merged;
    setActivityLogs(merged);
    writeCachedActivityLogs(merged);
    return merged;
  }, []);

  // Automatically flush pending logs when the browser regains connectivity
  useEffect(() => {
    const onOnline = () => {
      void flushActivityLogs();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushActivityLogs]);

  // Merge live Global Activity Logs with legacy module histories (paymentAudit, bill.editHistory, grn.editHistory)
  const mergedActivityLogs = useMemo<ActivityLogEntry[]>(() => {
    const byId = new Map<string, ActivityLogEntry>();
    for (const log of activityLogs) {
      byId.set(log.id, log);
    }

    // Track timestamps+entity already captured in native activityLogs to avoid visual duplicates
    const nativeKeys = new Set(
      activityLogs.map(
        (l) => `${l.entityType}:${l.entityId}:${l.action}:${String(l.at).slice(0, 16)}`,
      ),
    );

    for (const pa of paymentAudit || []) {
      const legacyId = `legacy_pay_${pa.id}`;
      const entityId = String(pa.paymentId || pa.billId || pa.id);
      const dedupeKey = `payment:${entityId}:${pa.action}:${String(pa.at).slice(0, 16)}`;
      if (byId.has(legacyId) || nativeKeys.has(dedupeKey)) continue;
      byId.set(legacyId, {
        id: legacyId,
        at: pa.at,
        entityType: "payment",
        entityId,
        entityLabel: pa.customerName
          ? `${pa.customerName}${pa.amount !== undefined ? ` · ₹${pa.amount}` : ""}`
          : `Payment ${entityId}`,
        action:
          pa.action === "delete" || pa.action === "invoice_deleted"
            ? "delete"
            : pa.action === "record"
              ? "create"
              : pa.action === "invoice_cancelled"
                ? "cancel"
                : "edit",
        actorName: pa.by || "Admin",
        actorRole: "admin",
        sourceScreen: "payments",
        reason: pa.note || undefined,
        summary: pa.note || `Payment ${pa.action}`,
        before: (pa.before as unknown as Record<string, unknown>) ?? null,
        after: (pa.after as unknown as Record<string, unknown>) ?? null,
        syncStatus: "synced",
      });
    }

    for (const b of bills || []) {
      const history = b.editHistory || [];
      for (let idx = 0; idx < history.length; idx++) {
        const h = history[idx];
        const legacyId = `legacy_bill_${b.id}_${h.at}_${idx}`;
        const dedupeKey = `bill:${b.id}:edit:${String(h.at).slice(0, 16)}`;
        if (byId.has(legacyId) || nativeKeys.has(dedupeKey)) continue;
        byId.set(legacyId, {
          id: legacyId,
          at: h.at,
          entityType: "bill",
          entityId: String(b.id),
          entityLabel: `${b.docNo || `#${b.id}`} · ${b.retailer}`,
          action: "edit",
          actorName: h.by || "Admin",
          actorRole: "admin",
          sourceScreen: "billing",
          reason: h.comment || undefined,
          summary:
            (h.changes && h.changes.length > 0 ? h.changes.slice(0, 3).join("; ") : h.comment) ||
            `Edited invoice ${b.docNo || `#${b.id}`}`,
          before: { total: h.totalBefore, amountPaid: h.paidBefore },
          after: { total: h.totalAfter, amountPaid: h.paidAfter },
          syncStatus: "synced",
        });
      }
    }

    for (const g of grns || []) {
      for (const h of g.editHistory || []) {
        const legacyId = `legacy_grn_${g.id}_${h.id}`;
        const dedupeKey = `grn:${g.id}:edit:${String(h.at).slice(0, 16)}`;
        if (byId.has(legacyId) || nativeKeys.has(dedupeKey)) continue;
        byId.set(legacyId, {
          id: legacyId,
          at: h.at,
          entityType: "grn",
          entityId: String(g.id),
          entityLabel: `${g.grnNumber} · ${g.supplierName}`,
          action: "edit",
          actorName: h.by || "Admin",
          actorRole: "admin",
          sourceScreen: "inventory",
          reason: h.reason || undefined,
          summary:
            h.changes && h.changes.length > 0
              ? h.changes.map((c) => `${c.field}: ${c.from} → ${c.to}`).slice(0, 3).join("; ")
              : `Edited GRN ${g.grnNumber}`,
          changes: (h.changes || []).map((c) => ({
            field: c.lineLabel ? `${c.lineLabel} · ${c.field}` : c.field,
            from: c.from,
            to: c.to,
          })),
          syncStatus: "synced",
        });
      }
    }

    return Array.from(byId.values()).sort((a, b) =>
      String(b.at).localeCompare(String(a.at)),
    );
  }, [activityLogs, paymentAudit, bills, grns]);

  return {
    activityLogs,
    mergedActivityLogs,
    recordActivity,
    flushActivityLogs,
    pullActivityLogs,
  };
}
