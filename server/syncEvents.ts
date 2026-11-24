import type { Response } from "express";

export type SyncTopic =
  | "bills"
  | "trips"
  | "payments"
  | "customers"
  | "schemes"
  | "products"
  | "batches"
  | "warehouses"
  | "inventory"
  | "expenses"
  | "deletions"
  | "activity"
  | "settings"
  | "signal";

export interface SyncEventPayload {
  topic: SyncTopic;
  key?: string;
  /** Optional salesman ID(s) owning the changed records; salesmen outside this set will not receive it. */
  salesmanId?: string;
  salesmanIds?: string[];
  fromDeviceId?: string;
}

interface SseClient {
  id: string;
  res: Response;
  role: "admin" | "salesman";
  sid?: string;
  deviceId?: string;
}

const clients = new Map<string, SseClient>();
let clientSeq = 0;

// Keepalive ping every 25s so reverse proxies do not drop idle SSE streams.
const keepaliveTimer = setInterval(() => {
  if (clients.size === 0) return;
  for (const [id, c] of clients.entries()) {
    try {
      c.res.write(": ping\n\n");
    } catch {
      clients.delete(id);
    }
  }
}, 25_000);
(keepaliveTimer as any)?.unref?.();

export function addSyncClient(opts: {
  res: Response;
  role: "admin" | "salesman";
  sid?: string;
  deviceId?: string;
}): () => void {
  const id = `sse_${Date.now()}_${++clientSeq}`;
  clients.set(id, { id, ...opts });
  try {
    opts.res.write(
      `event: ready\ndata: ${JSON.stringify({ ok: true, at: Date.now() })}\n\n`,
    );
  } catch {
    clients.delete(id);
  }
  return () => {
    clients.delete(id);
  };
}

function shouldDeliverToClient(c: SseClient, evt: SyncEventPayload): boolean {
  if (evt.fromDeviceId && c.deviceId && evt.fromDeviceId === c.deviceId) {
    return false;
  }
  if (c.role === "admin") return true;

  // Salesman never receives owner-only expenses or audit/GRN signals
  if (evt.topic === "expenses") return false;

  if (evt.salesmanId || (evt.salesmanIds && evt.salesmanIds.length > 0)) {
    const allowed = new Set<string>(
      [
        ...(evt.salesmanId ? [String(evt.salesmanId).trim()] : []),
        ...(evt.salesmanIds || []).map((x) => String(x || "").trim()),
      ].filter(Boolean),
    );
    if (allowed.size > 0 && (!c.sid || !allowed.has(String(c.sid).trim()))) {
      return false;
    }
  }
  return true;
}

/** Broadcasts a data-free invalidation signal to connected clients (respecting role & salesman ownership). */
export function emitSyncEvent(evt: SyncEventPayload): void {
  if (clients.size === 0) return;
  // Never emit any record data over SSE — topic + key + timestamp only.
  const wire = JSON.stringify({
    topic: evt.topic,
    ...(evt.key ? { key: evt.key } : {}),
    at: Date.now(),
  });
  const frame = `event: sync\ndata: ${wire}\n\n`;
  for (const [id, c] of clients.entries()) {
    if (!shouldDeliverToClient(c, evt)) continue;
    try {
      c.res.write(frame);
    } catch {
      clients.delete(id);
    }
  }
}

export function activeSyncClientCount(): number {
  return clients.size;
}
