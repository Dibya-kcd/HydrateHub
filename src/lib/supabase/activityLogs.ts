import { getSupabaseClient, isServerProxyMode, proxyFetch } from "./client";
import type { ActivityDiffItem, ActivityLogEntry } from "../../types";

export function activityLogToDbRow(e: ActivityLogEntry) {
  return {
    id: String(e.id),
    entity_type: String(e.entityType),
    entity_id: String(e.entityId),
    entity_label: e.entityLabel || "",
    action: String(e.action),
    actor_name: e.actorName || "Admin",
    actor_role: e.actorRole || "admin",
    actor_phone: e.actorPhone || "",
    source_screen: e.sourceScreen || "",
    reason: e.reason || "",
    summary: e.summary || "",
    before_data: e.before ?? null,
    after_data: e.after ?? null,
    changes: Array.isArray(e.changes) ? e.changes : [],
    created_at: e.at || new Date().toISOString(),
  };
}

export function dbRowToActivityLog(r: any): ActivityLogEntry {
  const rawRole = String(r.actor_role || r.actorRole || "admin");
  const actorRole: ActivityLogEntry["actorRole"] =
    rawRole === "salesman" || rawRole === "system" ? rawRole : "admin";
  return {
    id: String(r.id),
    at: String(r.created_at || r.at || new Date().toISOString()),
    entityType: (r.entity_type || r.entityType || "settings") as ActivityLogEntry["entityType"],
    entityId: String(r.entity_id ?? r.entityId ?? ""),
    entityLabel: String(r.entity_label ?? r.entityLabel ?? ""),
    action: (r.action || "edit") as ActivityLogEntry["action"],
    actorName: String(r.actor_name || r.actorName || "Admin"),
    actorRole,
    ...(r.actor_phone || r.actorPhone ? { actorPhone: String(r.actor_phone || r.actorPhone) } : {}),
    sourceScreen: String(r.source_screen || r.sourceScreen || ""),
    ...(r.reason ? { reason: String(r.reason) } : {}),
    summary: String(r.summary || ""),
    ...(r.before_data !== undefined || r.before !== undefined
      ? { before: (r.before_data ?? r.before) as Record<string, unknown> | null }
      : {}),
    ...(r.after_data !== undefined || r.after !== undefined
      ? { after: (r.after_data ?? r.after) as Record<string, unknown> | null }
      : {}),
    ...(Array.isArray(r.changes) && r.changes.length > 0
      ? { changes: r.changes as ActivityDiffItem[] }
      : {}),
    syncStatus: "synced",
  };
}

/**
 * Persists a single ActivityLogEntry to Supabase (`public.activity_logs`).
 * Returns true if the cloud row was written, false if offline or migration not yet applied.
 */
export async function pushActivityLogToSupabase(entry: ActivityLogEntry): Promise<boolean> {
  if (!entry?.id) return false;
  if (isServerProxyMode()) {
    const res = await proxyFetch("/api/activity-logs", {
      method: "POST",
      body: JSON.stringify(entry),
    });
    return res.ok;
  }
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client
      .from("activity_logs")
      .upsert(activityLogToDbRow(entry), { onConflict: "id" });
    if (!error) return true;
  } catch {
    // Table may not exist yet; caller retains pending offline copy
  }
  return false;
}

/**
 * Flushes a batch of activity logs to Supabase (`public.activity_logs`) and also mirrors
 * the latest 200 entries into `public.app_collections['activity_logs']` so devices without
 * migration 018+ still stay synchronized.
 */
export async function pushActivityLogsBatchToSupabase(entries: ActivityLogEntry[]): Promise<boolean> {
  if (!Array.isArray(entries) || entries.length === 0) return false;
  if (isServerProxyMode()) {
    const res = await proxyFetch("/api/activity-logs", {
      method: "POST",
      body: JSON.stringify({ entries }),
    });
    return res.ok;
  }
  const client = getSupabaseClient();
  if (!client) return false;
  let tableOk = false;
  try {
    const rows = entries.map(activityLogToDbRow);
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await client
        .from("activity_logs")
        .upsert(rows.slice(i, i + 200), { onConflict: "id" });
      if (error) {
        tableOk = false;
        break;
      }
      tableOk = true;
    }
  } catch {
    tableOk = false;
  }

  let fallbackOk = false;
  try {
    const { data: existingRow } = await client
      .from("app_collections")
      .select("data")
      .eq("key", "activity_logs")
      .maybeSingle();
    const existingList: ActivityLogEntry[] = Array.isArray(existingRow?.data)
      ? existingRow.data.map(dbRowToActivityLog)
      : [];
    const byId = new Map<string, ActivityLogEntry>();
    for (const item of existingList) byId.set(item.id, item);
    for (const item of entries) byId.set(item.id, { ...item, syncStatus: "synced" });
    const merged = Array.from(byId.values())
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 300);
    const { error } = await client.from("app_collections").upsert(
      {
        key: "activity_logs",
        data: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (!error) fallbackOk = true;
  } catch {
    fallbackOk = false;
  }

  return tableOk || fallbackOk;
}

export async function pullActivityLogsFromSupabase(limit = 1000): Promise<ActivityLogEntry[]> {
  if (isServerProxyMode()) {
    const res = await proxyFetch<{ success?: boolean; data?: any[] }>(
      `/api/activity-logs?limit=${encodeURIComponent(String(limit))}`,
      { method: "GET" },
    );
    if (!res.ok || !Array.isArray(res.data?.data)) return [];
    return res.data.data.map(dbRowToActivityLog);
  }

  const client = getSupabaseClient();
  if (!client) return [];
  const byId = new Map<string, ActivityLogEntry>();

  try {
    const { data, error } = await client
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error && Array.isArray(data)) {
      for (const r of data) {
        const entry = dbRowToActivityLog(r);
        byId.set(entry.id, entry);
      }
    }
  } catch {
    // Table may not exist yet
  }

  try {
    const { data } = await client
      .from("app_collections")
      .select("data")
      .eq("key", "activity_logs")
      .maybeSingle();
    if (Array.isArray(data?.data)) {
      for (const item of data.data) {
        const entry = dbRowToActivityLog(item);
        if (!byId.has(entry.id)) {
          byId.set(entry.id, entry);
        }
      }
    }
  } catch {
    // Fallback collection optional
  }

  return Array.from(byId.values()).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
