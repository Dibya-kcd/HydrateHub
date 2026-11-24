import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileJson,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useLedger } from "../../context/LedgerContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import {
  ActivityActionType,
  ActivityDiffItem,
  ActivityEntityType,
  ActivityLogEntry,
  TabId,
} from "../../types";
import { todayISO } from "../../utils/dateLocal";

const ENTITY_META: Record<
  ActivityEntityType,
  { label: string; tab: TabId; moduleName: string }
> = {
  bill: { label: "Bill / Invoice", tab: "billing", moduleName: "Sales & Billing" },
  payment: { label: "Payment", tab: "payments", moduleName: "Payments" },
  trip: { label: "Trip", tab: "trips", moduleName: "Trips" },
  grn: { label: "GRN / Inward", tab: "inventory", moduleName: "Inventory (Inward)" },
  expense: { label: "Expense", tab: "expenses", moduleName: "Expenses" },
  customer: { label: "Customer", tab: "customers", moduleName: "Parties" },
  product: { label: "Product", tab: "products", moduleName: "Products" },
  batch: { label: "Batch", tab: "inventory", moduleName: "Inventory" },
  warehouse: { label: "Warehouse", tab: "warehouses", moduleName: "Warehouses" },
  promotion: { label: "Promotion", tab: "promotions", moduleName: "Promotions" },
  supplierScheme: { label: "Supplier Scheme", tab: "supplierSchemes", moduleName: "Supplier Credits" },
  creditNote: { label: "Credit Note", tab: "supplierSchemes", moduleName: "Supplier Credits" },
  audit: { label: "Stock Audit", tab: "audit", moduleName: "Stock Audit" },
  crate: { label: "Crate Ledger", tab: "crates", moduleName: "Crates & Deposits" },
  settings: { label: "Settings", tab: "settings", moduleName: "Settings" },
};

const ACTION_STYLE: Record<
  ActivityActionType,
  { label: string; badge: string }
> = {
  create: { label: "Created", badge: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  edit: { label: "Edited", badge: "bg-amber-50 text-amber-800 border-amber-200" },
  delete: { label: "Deleted", badge: "bg-rose-50 text-rose-800 border-rose-200" },
  cancel: { label: "Cancelled", badge: "bg-rose-50 text-rose-800 border-rose-200" },
  reopen: { label: "Reopened", badge: "bg-sky-50 text-sky-800 border-sky-200" },
  void: { label: "Voided", badge: "bg-slate-100 text-slate-700 border-slate-300" },
};

/** Neutralize spreadsheet formula prefixes (=, +, -, @, tab, CR) before CSV quoting. */
function sanitizeCsvCell(val: unknown): string {
  const s = val == null ? "" : String(val);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function formatDateTime(iso: string): string {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildInspectorDiffs(entry: ActivityLogEntry): ActivityDiffItem[] {
  if (entry.changes && entry.changes.length > 0) return entry.changes;
  const before = entry.before || null;
  const after = entry.after || null;
  if (!before && !after) return [];
  const keys = Array.from(
    new Set([...Object.keys(before || {}), ...Object.keys(after || {})]),
  );
  const diffs: ActivityDiffItem[] = [];
  for (const k of keys) {
    const bVal = before ? before[k] : undefined;
    const aVal = after ? after[k] : undefined;
    const bStr = bVal === undefined || bVal === null ? "—" : typeof bVal === "object" ? JSON.stringify(bVal) : String(bVal);
    const aStr = aVal === undefined || aVal === null ? "—" : typeof aVal === "object" ? JSON.stringify(aVal) : String(aVal);
    if (bStr !== aStr) {
      diffs.push({ field: k, from: bStr, to: aStr });
    }
  }
  return diffs;
}

export const ActivityLogView: React.FC = () => {
  const isPhone = useIsMobile(1023);
  const {
    mergedActivityLogs,
    flushActivityLogs,
    pullActivityLogs,
    openCanonicalAction,
    supabaseStatus,
  } = useLedger();

  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<"all" | ActivityEntityType>("all");
  const [actionFilter, setActionFilter] = useState<"all" | ActivityActionType>("all");
  const [dateRange, setDateRange] = useState<"today" | "7d" | "30d" | "all">("30d");
  const [inspectingEntry, setInspectingEntry] = useState<ActivityLogEntry | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const today = todayISO();

  const cutoffDate = useMemo(() => {
    if (dateRange === "today") return today;
    if (dateRange === "all") return "";
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - (dateRange === "7d" ? 6 : 29));
    return d.toISOString().slice(0, 10);
  }, [dateRange, today]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (mergedActivityLogs || []).filter((entry) => {
      if (entityFilter !== "all" && entry.entityType !== entityFilter) return false;
      if (actionFilter !== "all" && entry.action !== actionFilter) return false;
      const day = String(entry.at || "").slice(0, 10);
      if (dateRange === "today" && day !== today) return false;
      if ((dateRange === "7d" || dateRange === "30d") && cutoffDate && day < cutoffDate) return false;
      if (!q) return true;
      const blob = [
        entry.entityLabel,
        entry.entityId,
        entry.reason,
        entry.summary,
        entry.actorName,
        entry.sourceScreen,
        ENTITY_META[entry.entityType]?.label || entry.entityType,
        ACTION_STYLE[entry.action]?.label || entry.action,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [mergedActivityLogs, searchQuery, entityFilter, actionFilter, dateRange, today, cutoffDate]);

  const stats = useMemo(() => {
    const all = mergedActivityLogs || [];
    let todayCount = 0;
    let editCount = 0;
    let deleteCount = 0;
    let pendingCount = 0;
    for (const e of all) {
      if (String(e.at || "").slice(0, 10) === today) todayCount++;
      if (e.action === "edit" || e.action === "reopen") editCount++;
      if (e.action === "delete" || e.action === "cancel" || e.action === "void") deleteCount++;
      if (e.syncStatus === "pending") pendingCount++;
    }
    return { total: all.length, todayCount, editCount, deleteCount, pendingCount };
  }, [mergedActivityLogs, today]);

  const handleSyncLogs = async () => {
    setIsSyncing(true);
    setSyncMsg(null);
    try {
      const pushed = await flushActivityLogs();
      await pullActivityLogs();
      setSyncMsg(pushed ? "Logs synced with cloud." : "Local logs refreshed; cloud not connected.");
    } catch {
      setSyncMsg("Unable to reach cloud; local logs preserved.");
    } finally {
      setIsSyncing(false);
    }
  };

  const exportCsv = () => {
    const headers = [
      "Timestamp",
      "Action",
      "Module",
      "Entity ID",
      "Record",
      "Reason",
      "Summary",
      "Actor",
      "Role",
      "Source Screen",
      "Sync Status",
    ];
    const rows = filteredLogs.map((e) => [
      e.at,
      ACTION_STYLE[e.action]?.label || e.action,
      ENTITY_META[e.entityType]?.label || e.entityType,
      e.entityId,
      e.entityLabel,
      e.reason || "",
      e.summary,
      e.actorName,
      e.actorRole,
      e.sourceScreen,
      e.syncStatus || "synced",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map(sanitizeCsvCell).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-log-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-log-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inspectedDiffs = inspectingEntry ? buildInspectorDiffs(inspectingEntry) : [];

  return (
    <div id="view-activity-log" className="hh-view mw-workspace w-full space-y-4 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <History className="w-6 h-6 text-[var(--primary)] shrink-0" aria-hidden="true" />
            <span>Global Activity Log</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Immutable audit trail of every edit, deletion, cancellation, and stock change with reasons
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSyncLogs}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>{isSyncing ? "Syncing..." : "Sync Logs"}</span>
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={exportJson}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer disabled:opacity-40"
          >
            <FileJson className="w-3.5 h-3.5" aria-hidden="true" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {syncMsg && (
        <div
          role="status"
          className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-semibold text-sky-900 flex items-center justify-between gap-2"
        >
          <span>{syncMsg}</span>
          <button
            type="button"
            onClick={() => setSyncMsg(null)}
            className="p-1 text-sky-700 hover:text-sky-950 cursor-pointer"
            aria-label="Dismiss message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Total Events
          </div>
          <div className="text-2xl font-black text-slate-900 tabular-nums mt-1">
            {stats.total}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {stats.todayCount} logged today
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-3.5 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
            Edits &amp; Reopens
          </div>
          <div className="text-2xl font-black text-amber-900 tabular-nums mt-1">
            {stats.editCount}
          </div>
          <div className="text-xs text-amber-800/80 mt-0.5">
            Before → after snapshots saved
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-3.5 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-rose-800">
            Deletions &amp; Cancels
          </div>
          <div className="text-2xl font-black text-rose-900 tabular-nums mt-1">
            {stats.deleteCount}
          </div>
          <div className="text-xs text-rose-800/80 mt-0.5">
            Reason-verified actions
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Supabase Sync
          </div>
          <div className="text-lg font-black text-slate-900 mt-1 flex items-center gap-1.5">
            {stats.pendingCount > 0 ? (
              <>
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="tabular-nums text-amber-800">
                  {stats.pendingCount} Pending
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-emerald-800">Up to date</span>
              </>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {supabaseStatus.isConnected ? "Cloud table linked" : "Offline local ledger"}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
          <div className="relative md:col-span-2">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search record, reason, actor, screen..."
              className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </div>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value as "all" | ActivityEntityType)}
            aria-label="Filter by module"
            className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 bg-white"
          >
            <option value="all">All Modules</option>
            {(Object.keys(ENTITY_META) as ActivityEntityType[]).map((k) => (
              <option key={k} value={k}>
                {ENTITY_META[k].label}
              </option>
            ))}
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as "all" | ActivityActionType)}
            aria-label="Filter by action"
            className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 bg-white"
          >
            <option value="all">All Actions</option>
            {(Object.keys(ACTION_STYLE) as ActivityActionType[]).map((k) => (
              <option key={k} value={k}>
                {ACTION_STYLE[k].label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Date range">
            {(
              [
                { id: "today", label: "Today" },
                { id: "7d", label: "Last 7 Days" },
                { id: "30d", label: "Last 30 Days" },
                { id: "all", label: "All Time" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={dateRange === opt.id}
                onClick={() => setDateRange(opt.id)}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  dateRange === opt.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <span className="text-xs font-semibold text-slate-500 tabular-nums">
            Showing {filteredLogs.length} of {mergedActivityLogs.length} events
          </span>
        </div>
      </div>

      {/* Empty state */}
      {filteredLogs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-2">
          <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-700">No matching activity events</p>
          <p className="text-xs text-slate-500">
            Edits, deletions, cancellations, and creations appear here automatically with their reasons.
          </p>
        </div>
      ) : isPhone ? (
        /* Mobile Cards */
        <div className="space-y-2.5 hh-tgrid-2">
          {filteredLogs.slice(0, 200).map((entry) => {
            const act = ACTION_STYLE[entry.action] || {
              label: entry.action,
              badge: "bg-slate-100 text-slate-700 border-slate-300",
            };
            const mod = ENTITY_META[entry.entityType];
            const diffs = buildInspectorDiffs(entry);
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setInspectingEntry(entry)}
                className="w-full min-h-[44px] text-left rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2 active:bg-slate-50 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className={`px-2 py-0.5 rounded-md border text-xs font-bold ${act.badge}`}>
                      {act.label}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {mod?.label || entry.entityType}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-slate-400 tabular-nums shrink-0">
                    {formatDateTime(entry.at)}
                  </span>
                </div>

                <div className="text-sm font-bold text-slate-900 break-words">
                  {entry.entityLabel}
                </div>

                <div className="text-xs text-slate-600 break-words">{entry.summary}</div>

                {entry.reason && (
                  <div className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 break-words">
                    Reason: {entry.reason}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-0.5 text-xs text-slate-500">
                  <span>
                    {entry.actorName} ({entry.actorRole})
                  </span>
                  <span className="font-semibold text-[var(--primary)]">
                    {diffs.length > 0 ? `${diffs.length} change(s) · Inspect` : "Inspect"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* Desktop Table */
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Record</th>
                <th className="py-3 px-3">Summary &amp; Reason</th>
                <th className="py-3 px-3">Actor &amp; Source</th>
                <th className="py-3 px-3">Sync</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredLogs.slice(0, 300).map((entry) => {
                const act = ACTION_STYLE[entry.action] || {
                  label: entry.action,
                  badge: "bg-slate-100 text-slate-700 border-slate-300",
                };
                const mod = ENTITY_META[entry.entityType];
                const diffs = buildInspectorDiffs(entry);
                return (
                  <tr
                    key={entry.id}
                    onClick={() => setInspectingEntry(entry)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap tabular-nums align-top">
                      {formatDateTime(entry.at)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap align-top">
                      <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-bold ${act.badge}`}>
                        {act.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 align-top max-w-[220px]">
                      <div className="font-bold text-slate-900 break-words">{entry.entityLabel}</div>
                      <div className="text-xs text-slate-500">{mod?.label || entry.entityType}</div>
                    </td>
                    <td className="py-3 px-3 align-top max-w-[320px]">
                      <div className="text-slate-700 break-words">{entry.summary}</div>
                      {entry.reason && (
                        <div className="mt-1 text-xs font-semibold text-slate-800 bg-slate-100/80 rounded px-2 py-0.5 inline-block break-words">
                          Reason: {entry.reason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{entry.actorName}</div>
                      <div className="text-xs text-slate-500">{entry.sourceScreen}</div>
                    </td>
                    <td className="py-3 px-3 align-top whitespace-nowrap">
                      {entry.syncStatus === "pending" ? (
                        <span className="text-xs font-bold text-amber-700">Pending</span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-700">Synced</span>
                      )}
                    </td>
                    <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setInspectingEntry(entry);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        {diffs.length > 0 ? `Diff (${diffs.length})` : "View"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Diff Inspector Modal */}
      {inspectingEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Activity event inspector"
          className="fixed inset-0 z-[1000] bg-black/55 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setInspectingEntry(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[88vh] flex flex-col"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md border text-xs font-bold ${
                      ACTION_STYLE[inspectingEntry.action]?.badge || "bg-slate-100 text-slate-700 border-slate-300"
                    }`}
                  >
                    {ACTION_STYLE[inspectingEntry.action]?.label || inspectingEntry.action}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {ENTITY_META[inspectingEntry.entityType]?.label || inspectingEntry.entityType}
                  </span>
                </div>
                <h2 className="text-base font-extrabold text-slate-900 mt-1 break-words">
                  {inspectingEntry.entityLabel}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {formatDateTime(inspectingEntry.at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingEntry(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 cursor-pointer shrink-0"
                aria-label="Close inspector"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                  <div className="text-xs font-bold uppercase text-slate-400">Actor</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {inspectingEntry.actorName} ({inspectingEntry.actorRole})
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                  <div className="text-xs font-bold uppercase text-slate-400">Source Screen</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {inspectingEntry.sourceScreen}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 col-span-2">
                  <div className="text-xs font-bold uppercase text-slate-400">Reason</div>
                  <div className="font-semibold text-slate-900 mt-0.5 break-words">
                    {inspectingEntry.reason || "No comment recorded"}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 bg-white">
                <div className="text-xs font-bold uppercase text-slate-400 mb-1">Summary</div>
                <div className="text-slate-800 font-medium break-words">{inspectingEntry.summary}</div>
              </div>

              {inspectedDiffs.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                    Field-by-Field Changes (Before → After)
                  </div>
                  <div className="divide-y divide-slate-100">
                    {inspectedDiffs.map((d, idx) => (
                      <div key={`${d.field}-${idx}`} className="px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <span className="font-bold text-slate-700">{d.field}</span>
                        <span className="flex items-center gap-1.5 font-mono text-xs break-all">
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800">{d.from}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800">{d.to}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              {inspectingEntry.action !== "delete" && ENTITY_META[inspectingEntry.entityType] && (
                <button
                  type="button"
                  onClick={() => {
                    const meta = ENTITY_META[inspectingEntry.entityType];
                    const targetId = inspectingEntry.entityId;
                    const entityType = inspectingEntry.entityType;
                    setInspectingEntry(null);
                    openCanonicalAction({
                      targetTab: meta.tab,
                      entityType,
                      entityId: targetId,
                      action: "view",
                      returnTab: "activityLog",
                      returnLabel: "Back to Activity Log",
                    });
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold cursor-pointer hover:opacity-95"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Open in {ENTITY_META[inspectingEntry.entityType].moduleName}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setInspectingEntry(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLogView;
