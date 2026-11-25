import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";

process.env.MRWATER_TEST = "1";
process.env.API_AUTH_REQUIRED = "true";
process.env.APP_SESSION_SECRET = "test-session-secret-key-at-least-32-chars-long";
process.env.ADMIN_PASSWORD = "correct-horse-battery";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const serverAuth = await import("../server-auth");
const { createSecurityAndAuthSetup } = await import("../server/authMiddleware");

test("login returns a long sliding session and /api/auth/refresh renews it", async () => {
  const setup = createSecurityAndAuthSetup({ isSupabaseAvailable: () => false });
  const app = express();
  setup.applySecurityAndAuthMiddleware(app);
  app.get("/api/ping", (_req, res) => res.json({ ok: true }));
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const login = await fetch(`${base}/api/auth/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "correct-horse-battery" }),
    });
    const a = await login.json();
    assert.equal(login.status, 200);
    const days = (a.expiresAt - Date.now()) / 86_400_000;
    assert.ok(days > 13.9 && days <= 14.01, `admin token should live ~14 days, got ${days}`);
    assert.ok(a.refreshAt > Date.now() && a.refreshAt < a.expiresAt);

    const claims = serverAuth.verifyToken(a.token, process.env.APP_SESSION_SECRET!)!;
    assert.ok(claims.iat0 && claims.iat0 <= Date.now());

    await new Promise((r) => setTimeout(r, 15));
    const ref = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${a.token}` },
    });
    const b = await ref.json();
    assert.equal(ref.status, 200);
    assert.notEqual(b.token, a.token);
    assert.ok(b.expiresAt > a.expiresAt);
    assert.equal(serverAuth.verifyToken(b.token, process.env.APP_SESSION_SECRET!)!.iat0, claims.iat0);

    const ping = await fetch(`${base}/api/ping`, { headers: { Authorization: `Bearer ${b.token}` } });
    assert.equal(ping.status, 200);

    const bad = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: { Authorization: "Bearer not-a-real-token" },
    });
    assert.equal(bad.status, 401);
    const none = await fetch(`${base}/api/auth/refresh`, { method: "POST" });
    assert.equal(none.status, 401);
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
