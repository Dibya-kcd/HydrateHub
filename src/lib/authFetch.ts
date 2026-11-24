/**
 * Sends the signed-in user's session with every call to this app's own /api routes, so the server can require
 * a login (API_AUTH_REQUIRED=true). Calls to other sites are never touched. When the server says the session is
 * gone (401) the app is told to sign out.
 */
import { getSupabaseClient } from "./supabase";
import { isServerProxyMode } from "./supabase/proxyMode";

const TOKEN_KEY = "mrwater_api_session_v1";

interface StoredToken {
  token: string;
  expiresAt: number;
}

export function setApiSession(token: string | null, expiresAt?: number) {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt: expiresAt || Date.now() + 12 * 3600e3 }));
  } catch {
    /* storage unavailable */
  }
}

export function readApiSession(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredToken;
    if (!t?.token || !(t.expiresAt > Date.now())) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return t;
  } catch {
    return null;
  }
}

export function hasApiAuthSession(): boolean {
  return Boolean(readApiSession()?.token);
}

async function currentToken(): Promise<string | null> {
  const own = readApiSession();
  if (own) return own.token;
  if (isServerProxyMode()) return null;
  try {
    const { data } = (await getSupabaseClient()?.auth.getSession()) || { data: null };
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

function isOwnApiCall(url: string): boolean {
  if (url.startsWith("/api/")) return true;
  if (API_BASE && url.startsWith(API_BASE + "/api/")) return true;
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin && u.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

const NO_TOKEN_NEEDED = ["/api/auth/"];

/**
 * Address of the Express server (server.ts) when the app is NOT served by that server itself, i.e. the GitHub Pages
 * build and the Android / iOS (Capacitor) builds. Set VITE_API_BASE_URL at build time, e.g. https://api.example.com
 * Leave it empty when server.ts serves the web app: relative /api calls then keep working unchanged.
 */
const API_BASE: string = ((import.meta as any).env?.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");

/** Rewrites a relative "/api/..." URL to the configured server. Anything else is returned untouched. */
function withApiBase(input: RequestInfo | URL): RequestInfo | URL {
  if (!API_BASE) return input;
  if (typeof input === "string") return input.startsWith("/api/") ? API_BASE + input : input;
  if (input instanceof URL) return input;
  try {
    const u = new URL(input.url);
    if (u.origin === window.location.origin && u.pathname.startsWith("/api/")) {
      return new Request(API_BASE + u.pathname + u.search, input);
    }
  } catch {
    /* not rewritable */
  }
  return input;
}

export function installAuthFetch() {
  if (typeof window === "undefined" || (window as any).__mrwaterAuthFetch) return;
  (window as any).__mrwaterAuthFetch = true;

  try {
    if (typeof window.fetch !== "function") return;
    const original = window.fetch.bind(window);

    const customFetch = async (rawInput: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const input = withApiBase(rawInput);
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (!isOwnApiCall(url)) return original(input, init);
        const path = new URL(url, window.location.origin).pathname;
        const token = NO_TOKEN_NEEDED.some((p) => path.startsWith(p)) ? null : await currentToken();
        let nextInit = init;
        if (token) {
          const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
          if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
          nextInit = { ...init, headers };
        }
        const res = await original(input, nextInit);
        if (res.status === 401 && !NO_TOKEN_NEEDED.some((p) => path.startsWith(p))) {
          if (token) {
            setApiSession(null);
            window.dispatchEvent(new Event("mrwater:auth-expired"));
          }
        }
        return res;
      } catch (err) {
        return original(input, init);
      }
    };

    try {
      Object.defineProperty(window, "fetch", {
        value: customFetch,
        writable: true,
        configurable: true,
      });
    } catch {
      try {
        (window as any).fetch = customFetch;
      } catch (err) {
        console.warn("Unable to intercept window.fetch (getter-only or non-configurable):", err);
      }
    }
  } catch (outerErr) {
    console.warn("installAuthFetch encountered non-fatal error:", outerErr);
  }
}

/** Signs in through the server. Returns null when the server has no sign-in configured (use the old route). */
export async function serverSignIn(
  kind: "admin" | "salesman",
  body: Record<string, string>,
): Promise<{ ok: boolean; error?: string; salesman?: any; unreachable?: boolean } | null> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  // 30 s, not 4 s: a free-tier host (Render, Railway...) needs 20-40 s to wake up after being idle. With a short
  // limit the app gave up, fell back to the on-device check and told the salesman "Incorrect PIN".
  const timeoutId = controller ? setTimeout(() => controller.abort(), 30000) : null;
  try {
    const res = await fetch(kind === "admin" ? "/api/auth/admin-login" : "/api/auth/salesman-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
    if (timeoutId) clearTimeout(timeoutId);
    if (res.status === 501 || res.status === 404) return null; // not configured on this server
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.token) {
      setApiSession(data.token, data.expiresAt);
      return { ok: true, salesman: data.salesman };
    }
    return { ok: false, error: data?.error || "Sign-in failed." };
  } catch {
    if (timeoutId) clearTimeout(timeoutId);
    // Server unreachable, blocked by CORS, or timed out. The caller may still try the offline route, but must not
    // report a wrong PIN just because the server could not be asked.
    return {
      ok: false,
      unreachable: true,
      error: "Cannot reach the server to check your sign-in. Check your internet connection and try again in a minute.",
    };
  }
}

export interface ServerSyncEvent {
  topic: string;
  key?: string;
  at?: number;
}

/**
 * Opens an authenticated Server-Sent Events (SSE) stream to /api/sync/events using fetch()
 * so Authorization: Bearer <token> is always attached. Automatically reconnects with backoff.
 */
export function openSyncEventStream(
  onEvent: (evt: ServerSyncEvent) => void,
  deviceId?: string,
): () => void {
  if (typeof window === "undefined" || typeof fetch !== "function") {
    return () => {};
  }
  let stopped = false;
  let controller: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelay = 1500;

  const connect = async () => {
    if (stopped) return;
    const token = readApiSession()?.token;
    if (!token) return;

    controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const url = deviceId
      ? `/api/sync/events?deviceId=${encodeURIComponent(deviceId)}`
      : "/api/sync/events";

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
        },
        signal: controller?.signal,
      });

      if (res.status === 401 || res.status === 403 || !res.ok || !res.body) {
        if (res.status === 401) {
          setApiSession(null);
          window.dispatchEvent(new Event("mrwater:auth-expired"));
          return;
        }
        throw new Error(`SSE status ${res.status}`);
      }

      retryDelay = 1500;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let sepIdx: number;
        while ((sepIdx = buf.indexOf("\n\n")) !== -1) {
          const rawBlock = buf.slice(0, sepIdx);
          buf = buf.slice(sepIdx + 2);
          if (!rawBlock.trim()) continue;
          let eventName = "message";
          const dataLines: string[] = [];
          for (const line of rawBlock.split("\n")) {
            if (line.startsWith(":")) continue;
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trim());
            }
          }
          if (eventName === "sync" && dataLines.length > 0) {
            try {
              const parsed = JSON.parse(dataLines.join("\n")) as ServerSyncEvent;
              if (parsed?.topic) onEvent(parsed);
            } catch {
              // ignore malformed payload
            }
          }
        }
      }
    } catch {
      // reconnect below
    }

    if (!stopped) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void connect();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30_000);
    }
  };

  void connect();

  return () => {
    stopped = true;
    try {
      controller?.abort();
    } catch {
      // ignore
    }
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };
}

