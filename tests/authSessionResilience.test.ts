import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";

process.env.MRWATER_TEST = "1";
process.env.API_AUTH_REQUIRED = "true";
process.env.APP_SESSION_SECRET = "test-session-secret-key-at-least-32-chars-long";
process.env.PIN_PEPPER = "test-pin-pepper-value";
process.env.ADMIN_EMAILS = "owner@mrwater.test";
process.env.ADMIN_PHONE = "+91 98765 00001";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const memStorage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
  setItem: (k: string, v: string) => {
    memStorage.set(k, String(v));
  },
  removeItem: (k: string) => {
    memStorage.delete(k);
  },
  clear: () => memStorage.clear(),
};

const listeners = new Map<string, Set<EventListener>>();
(globalThis as any).window = {
  location: { origin: "https://localhost", hostname: "localhost" },
  fetch: globalThis.fetch,
  addEventListener: (type: string, fn: EventListener) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(fn);
  },
  removeEventListener: (type: string, fn: EventListener) => {
    listeners.get(type)?.delete(fn);
  },
  dispatchEvent: (ev: Event) => {
    for (const fn of listeners.get(ev.type) || []) fn(ev);
    return true;
  },
};

const serverAuth = await import("../server-auth");
const store = await import("../server/supabaseStore");
const { createSecurityAndAuthSetup } = await import("../server/authMiddleware");
const authFetch = await import("../src/lib/authFetch");
const storageCollections = await import("../src/utils/storage/collections");

test("authConfig parses ADMIN_PHONE alongside ADMIN_EMAILS", () => {
  const cfg = serverAuth.authConfig({
    NODE_ENV: "production",
    APP_SESSION_SECRET: "a".repeat(32),
    ADMIN_EMAILS: "Boss@Example.com",
    ADMIN_PHONE: "+91 98765-43210",
    SUPABASE_URL: "https://x.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  });
  assert.deepEqual(cfg.adminEmails, ["boss@example.com"]);
  assert.deepEqual(cfg.adminPhones, ["9876543210"]);
  assert.deepEqual(
    serverAuth.startupProblems({
      NODE_ENV: "production",
      APP_SESSION_SECRET: "a".repeat(32),
      ADMIN_PHONE: "9876543210",
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    }),
    [],
  );
});

test("resolveAuth never negative-caches transient Supabase errors and allows configured admin phone", async () => {
  const setup = createSecurityAndAuthSetup({ isSupabaseAvailable: () => true });
  const app = express();
  setup.applySecurityAndAuthMiddleware(app);
  app.get("/api/ping", (_req, res) => res.json({ ok: true }));

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const origGetUser = store.supabase.auth.getUser.bind(store.supabase.auth);
  let callCount = 0;

  try {
    // 1. Transient 502 from Supabase auth must return 401 once, NOT lock valid token out for 60s
    (store.supabase.auth as any).getUser = async (tok: string) => {
      callCount++;
      if (tok === "jwt-phone-admin" && callCount === 1) {
        return { data: { user: null }, error: { message: "upstream timeout", status: 504 } };
      }
      if (tok === "jwt-phone-admin") {
        return { data: { user: { id: "u1", email: "", phone: "919876500001" } }, error: null };
      }
      if (tok === "jwt-stranger") {
        return { data: { user: { id: "u2", email: "intruder@evil.test", phone: "" } }, error: null };
      }
      return { data: { user: null }, error: { message: "invalid JWT", status: 401 } };
    };

    const firstTransient = await fetch(`${baseUrl}/api/ping`, {
      headers: { Authorization: "Bearer jwt-phone-admin" },
    });
    assert.equal(firstTransient.status, 401);

    const recovered = await fetch(`${baseUrl}/api/ping`, {
      headers: { Authorization: "Bearer jwt-phone-admin" },
    });
    assert.equal(recovered.status, 200);

    // 2. Unauthorized email stays rejected cleanly
    const stranger = await fetch(`${baseUrl}/api/ping`, {
      headers: { Authorization: "Bearer jwt-stranger" },
    });
    assert.equal(stranger.status, 401);

    // 3. Invalid JWT stays rejected cleanly
    const invalid = await fetch(`${baseUrl}/api/ping`, {
      headers: { Authorization: "Bearer jwt-bad" },
    });
    assert.equal(invalid.status, 401);
  } finally {
    (store.supabase.auth as any).getUser = origGetUser;
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("authFetch retries once when a newer session token is available and emits auth-expired only when unrecoverable", async () => {
  let expiredEvents = 0;
  const onExpired = () => {
    expiredEvents++;
  };
  (globalThis as any).window.addEventListener("mrwater:auth-expired", onExpired);

  const origFetch = globalThis.fetch;
  let calls: string[] = [];
  (globalThis as any).window.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    const auth = new Headers(init?.headers).get("Authorization") || "";
    calls.push(auth);
    if (auth === "Bearer old-token") {
      // Simulate another tab/refresh updating stored api session before failing cleanly
      authFetch.setApiSession("fresh-token", Date.now() + 60_000);
      return new Response(JSON.stringify({ error: "expired" }), { status: 401 });
    }
    if (auth === "Bearer fresh-token") {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "expired" }), { status: 401 });
  };
  delete (globalThis as any).window.__mrwaterAuthFetch;
  authFetch.installAuthFetch();

  try {
    authFetch.setApiSession("old-token", Date.now() + 60_000);
    const res1 = await (globalThis as any).window.fetch("/api/bills", {
      method: "POST",
      body: JSON.stringify({ id: 1 }),
    });
    assert.equal(res1.status, 200);
    assert.deepEqual(calls, ["Bearer old-token", "Bearer fresh-token"]);
    assert.equal(expiredEvents, 0, "Should recover via retry without firing auth-expired");

    // Unrecoverable 401 clears session and fires auth-expired once
    calls = [];
    authFetch.setApiSession("dead-token", Date.now() + 60_000);
    const res2 = await (globalThis as any).window.fetch("/api/bills", {
      method: "POST",
      body: JSON.stringify({ id: 2 }),
    });
    assert.equal(res2.status, 401);
    assert.equal(authFetch.readApiSession(), null);
    assert.equal(expiredEvents, 1);
  } finally {
    (globalThis as any).window.removeEventListener("mrwater:auth-expired", onExpired);
    (globalThis as any).window.fetch = origFetch;
    delete (globalThis as any).window.__mrwaterAuthFetch;
    authFetch.setApiSession(null);
  }
});

test("saveOrders deduplicates rapid identical calls while saving mid-list bill edits immediately", async () => {
  let putCalls = 0;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("/api/bills") && init?.method === "PUT") {
      putCalls++;
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };

  try {
    const bills: any[] = Array.from({ length: 12 }, (_, idx) => ({
      id: idx + 1,
      total: 100,
      amountPaid: 0,
      updatedAt: "2026-11-24T10:00:00.000Z",
      editHistory: [],
    }));
    await storageCollections.saveOrders(bills);
    await storageCollections.saveOrders(bills);
    await storageCollections.saveOrders(bills);
    await new Promise((r) => setTimeout(r, 25));
    assert.equal(putCalls, 1, "Identical burst saveOrders calls must coalesce into 1 write");

    // Mid-list edit at index 6 must NOT be skipped
    const edited = bills.map((b, i) =>
      i === 6 ? { ...b, total: 250, updatedAt: "2026-11-24T10:00:05.000Z", editHistory: [{ comment: "fix" }] } : b,
    );
    await storageCollections.saveOrders(edited);
    await new Promise((r) => setTimeout(r, 25));
    assert.equal(putCalls, 2, "Mid-list bill edit must trigger write immediately");
  } finally {
    globalThis.fetch = origFetch;
  }
});
