import test from "node:test";
import assert from "node:assert/strict";
import {
  renewClaims,
  refreshAtFor,
  sessionMaxMs,
  sessionTtlMs,
  signToken,
  verifyToken,
} from "../server-auth";

const SECRET = "x".repeat(40);
const DAY = 24 * 60 * 60 * 1000;

test("default lifetimes: salesman 30 days, admin 14 days, cap 180 days", () => {
  assert.equal(sessionTtlMs("salesman", {}), 30 * DAY);
  assert.equal(sessionTtlMs("admin", {}), 14 * DAY);
  assert.equal(sessionMaxMs({}), 180 * DAY);
  assert.equal(sessionTtlMs("salesman", { SESSION_TTL_DAYS: "7" }), 7 * DAY);
  assert.equal(sessionMaxMs({ SESSION_MAX_DAYS: "0" }), 0);
});

test("renewClaims issues a fresh valid token and keeps the original sign-in time", () => {
  const t0 = Date.now();
  const first = signToken({ r: "salesman", sid: "s1", n: "Ravi", iat0: t0, exp: t0 + 30 * DAY }, SECRET);
  const claims = verifyToken(first, SECRET)!;
  const later = t0 + 20 * DAY;
  const renewed = renewClaims(claims, SECRET, {}, later)!;
  assert.ok(renewed);
  const c2 = verifyToken(renewed.token, SECRET, later)!;
  assert.equal(c2.sid, "s1");
  assert.equal(c2.iat0, t0);
  assert.equal(renewed.expiresAt, later + 30 * DAY);
  assert.equal(renewed.refreshAt, refreshAtFor(later, renewed.expiresAt));
});

test("renewClaims refuses once the absolute cap since sign-in is exceeded", () => {
  const t0 = Date.now();
  const claims = verifyToken(
    signToken({ r: "admin", n: "Owner", iat0: t0, exp: t0 + 14 * DAY }, SECRET),
    SECRET,
  )!;
  assert.equal(renewClaims(claims, SECRET, {}, t0 + 181 * DAY), null);
  // near the cap the new expiry is clipped to it
  const near = renewClaims(claims, SECRET, {}, t0 + 175 * DAY)!;
  assert.equal(near.expiresAt, t0 + 180 * DAY);
});

test("an expired token cannot be verified (so it cannot be refreshed)", () => {
  const t0 = Date.now();
  const tok = signToken({ r: "admin", n: "Owner", iat0: t0, exp: t0 + 1000 }, SECRET);
  assert.equal(verifyToken(tok, SECRET, t0 + 5000), null);
});
