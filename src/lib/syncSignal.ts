/**
 * "Something changed" signal between devices.
 *
 * When VITE_PROXY_SUPABASE_VIA_SERVER=false (default): uses Supabase Realtime Broadcast directly.
 * When VITE_PROXY_SUPABASE_VIA_SERVER=true: uses authenticated server SSE (/api/sync/events) + POST /api/sync/signal.
 * Neither path carries any record data; receiving devices run their normal change check immediately.
 */
import { hasApiAuthSession, openSyncEventStream } from "./authFetch";
import { getSupabaseClient, isServerProxyMode, proxyFetch } from "./supabase";

const CHANNEL = "mrwater-sync-signal";
/** one message per burst of saves */
const SEND_DELAY_MS = 1500;

const deviceId = Math.random().toString(36).slice(2) + Date.now().toString(36);
let channel: any = null;
let ready = false;
let sendTimer: ReturnType<typeof setTimeout> | null = null;
/** while a download is running (or just finished) the app's own write-backs must not be announced */
let heldUntil = 0;

/** Starts listening. Returns a function that stops. `onSignal` is called when ANOTHER device announces a change. */
export function startSyncSignal(onSignal: () => void): () => void {
  try {
    if (typeof window === "undefined") return () => {};
    // The app can be shown inside a preview frame; do not open a second live connection there.
    if (window.self !== window.top) return () => {};
  } catch {
    return () => {};
  }

  if (isServerProxyMode()) {
    if (!hasApiAuthSession()) return () => {};
    const stopStream = openSyncEventStream(() => {
      onSignal();
    }, deviceId);
    return () => {
      stopStream();
      if (sendTimer) clearTimeout(sendTimer);
      sendTimer = null;
    };
  }

  const client: any = getSupabaseClient();
  if (!client) return () => {};
  try {
    channel = client
      .channel(CHANNEL, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "changed" }, (msg: any) => {
        if (msg?.payload?.from === deviceId) return;
        onSignal();
      })
      .subscribe((status: string) => {
        ready = status === "SUBSCRIBED";
      });
  } catch {
    channel = null;
    ready = false;
  }
  return () => {
    try {
      if (channel) client.removeChannel(channel);
    } catch {
      // nothing to clean up
    }
    channel = null;
    ready = false;
    if (sendTimer) clearTimeout(sendTimer);
    sendTimer = null;
  };
}

/** Do not announce anything until releaseSyncSignal() (a download is running). */
export function holdSyncSignal(): void {
  heldUntil = Number.POSITIVE_INFINITY;
}

/** Announcing is allowed again `afterMs` from now (lets the app's own write-backs land first). */
export function releaseSyncSignal(afterMs: number): void {
  heldUntil = Date.now() + afterMs;
}

/** Call after a successful save. Bursts are merged into one message. Never throws. */
export function announceCloudChange(): void {
  if (Date.now() < heldUntil) return;

  if (isServerProxyMode()) {
    if (!hasApiAuthSession()) return;
    if (sendTimer) return;
    sendTimer = setTimeout(() => {
      sendTimer = null;
      if (Date.now() < heldUntil || !hasApiAuthSession()) return;
      void proxyFetch("/api/sync/signal", {
        method: "POST",
        body: JSON.stringify({ fromDeviceId: deviceId, deviceId, at: Date.now() }),
      }).catch(() => {});
    }, SEND_DELAY_MS);
    return;
  }

  if (!channel || !ready) return;
  if (sendTimer) return;
  sendTimer = setTimeout(() => {
    sendTimer = null;
    if (!channel || !ready || Date.now() < heldUntil) return;
    try {
      channel.send({
        type: "broadcast",
        event: "changed",
        payload: { from: deviceId, at: Date.now() },
      });
    } catch {
      // the timer is the fallback
    }
  }, SEND_DELAY_MS);
}
