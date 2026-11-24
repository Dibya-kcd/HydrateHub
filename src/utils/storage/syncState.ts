import type { SyncStatus } from "./types";

let syncStatusState: SyncStatus = {
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  consecutiveFailures: 0,
  lastSuccessfulSync: null,
  lastError: null,
  isSyncing: false,
  hasPersistentFailure: false,
  pendingCount: 0,
};

type SyncListener = (status?: SyncStatus) => void;
const syncListeners: Set<SyncListener> = new Set();

export function getSyncStatus(): SyncStatus {
  return syncStatusState;
}

export function getConsecutiveFailures(): number {
  return syncStatusState.consecutiveFailures;
}

export function subscribeToSyncStatus(listener: SyncListener): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

/**
 * Report a cloud write that failed outside the storage helpers (e.g. a Supabase push that
 * resolved `{ success: false }` or a fire-and-forget fetch). Feeds the same status the
 * app-wide "Cloud Persistence Warning" banner reads, so failures are no longer silent.
 */
export function reportSyncFailure(label: string, error?: unknown): void {
  const rawMsg =
    typeof error === "string"
      ? error
      : (error as { message?: string } | null | undefined)?.message ||
        "Unknown error";

  let msg = rawMsg;
  if (
    rawMsg.includes("520") ||
    rawMsg.includes("<!DOCTYPE") ||
    rawMsg.includes("upstream request timeout") ||
    rawMsg.includes("cloudflare")
  ) {
    msg = "Cloud provider unavailable (Cloudflare 520 / timeout). Local storage active.";
  }

  console.warn(`[Sync] ${label} notice:`, msg);
  notifySyncStatus({
    isSyncing: false,
    consecutiveFailures: Math.min(syncStatusState.consecutiveFailures + 1, 10),
    lastError: `${label}: ${msg}`,
  });
}

export function clearSyncStatus(): void {
  notifySyncStatus({
    isSyncing: false,
    consecutiveFailures: 0,
    lastError: null,
    hasPersistentFailure: false,
  });
}

export function reportSyncSuccess(): void {
  notifySyncStatus({
    isSyncing: false,
    consecutiveFailures: 0,
    lastSuccessfulSync: new Date().toISOString(),
    lastError: null,
    hasPersistentFailure: false,
  });
}

export function notifySyncStatus(updates: Partial<SyncStatus>) {
  syncStatusState = {
    ...syncStatusState,
    ...updates,
    // Any unresolved failed write is worth surfacing (it clears on the next successful sync).
    hasPersistentFailure:
      (updates.consecutiveFailures ?? syncStatusState.consecutiveFailures) >= 1 ||
      (updates.pendingCount ?? syncStatusState.pendingCount) > 0,
  };
  // Defer listener notifications to a microtask to avoid invoking setState during another component's render phase
  queueMicrotask(() => {
    syncListeners.forEach((fn) => {
      try {
        fn(syncStatusState);
      } catch {
        // ignore
      }
    });
  });
}

// Track online/offline browser state
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    notifySyncStatus({ isOnline: true });
  });
  window.addEventListener("offline", () => {
    notifySyncStatus({ isOnline: false, lastError: "Browser is offline" });
  });
}

export function readLocalCache<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[Storage] Failed to read localStorage key "${key}":`, err);
    return fallback;
  }
}

export function writeLocalCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`[Storage] Failed to write localStorage key "${key}":`, err);
    // A full device storage means the offline copy silently stops updating: make that visible.
    const name = (err as any)?.name || "";
    if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
      reportSyncFailure(
        "device storage is full (offline copy is not being updated - free up space or clear old data)",
        err,
      );
    }
  }
}

/* -------------------------------------------------------------------------
 * Network safety: every request has a time limit (a hung request used to block
 * the first sync, and with it all saving, forever), and a write that failed is
 * kept in a small outbox and retried when the device is back online.
 * ------------------------------------------------------------------------- */
export const REQUEST_TIMEOUT_MS = 15000;

export function withTimeout<T>(work: PromiseLike<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timed out")), ms);
    Promise.resolve(work).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl?.signal });
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("Request timed out");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
