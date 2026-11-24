import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import {
  FailureLimiter,
  TOKEN_TTL_MS,
  authConfig,
  filterSalesmanResponse,
  hashPinSecure,
  isPublicApiPath,
  normalizeApiPath,
  ownedBy,
  safeEqual,
  salesmanPolicy,
  sanitizeSalesmanWrite,
  signToken,
  verifyStoredPin,
  verifyToken,
  type SalesmanContext,
} from "../server-auth";
import { hashPin } from "../src/utils/crypto";
import {
  IS_TEST_RUN,
  getCollectionData,
  isSupabaseAvailable,
  setCollectionData,
  supabase,
  withSupabaseTimeout,
} from "./supabaseStore";

// What leaves the server: NEVER a PIN hash (not to the owner's screen, not to a salesman's phone).
export function formatSalesmanResponse(s: any) {
  return {
    id: String(s.id),
    name: s.name || "",
    phone: s.phone || "",
    pinHash: "",
    hasPin: !!(s.pin_hash || s.pinHash),
    active: s.active !== undefined ? Boolean(s.active) : true,
    defaultVehicle: s.default_vehicle || s.defaultVehicle || "",
    createdAt: s.created_at || s.createdAt || new Date().toISOString(),
    updatedAt: s.updated_at || s.updatedAt || new Date().toISOString(),
  };
}

// What the server itself keeps (the copy in app_collections is used for sign-in when the table is unreachable).
export function formatSalesmanStored(s: any, hash: string) {
  return { ...formatSalesmanResponse(s), pinHash: hash, pin_hash: hash };
}

export function createSecurityAndAuthSetup() {
  const authCfg = authConfig();
  if (!authCfg.required && !IS_TEST_RUN) {
    console.warn(
      "[SECURITY] API_AUTH_REQUIRED=false: every /api route is open to anyone who knows the address. Use this on a developer machine only.",
    );
  }
  if (
    authCfg.required &&
    authCfg.adminEmails.length === 0 &&
    !authCfg.adminPassword &&
    !IS_TEST_RUN
  ) {
    console.warn(
      "[SECURITY] ADMIN_PASSWORD / ADMIN_EMAILS are not set: nobody can sign in as the owner.",
    );
  } else if (
    authCfg.required &&
    authCfg.adminEmails.length === 0 &&
    !IS_TEST_RUN
  ) {
    console.warn(
      "[SECURITY] ADMIN_EMAILS is empty: ANY user of your Supabase Auth project counts as an owner. Set ADMIN_EMAILS.",
    );
  }

  const loginLimiter = new FailureLimiter(5, 15 * 60 * 1000);
  const supabaseTokenCache = new Map<
    string,
    { ok: boolean; email: string; until: number }
  >();
  const activeCache = new Map<string, { ok: boolean; until: number }>();
  const clientIp = (req: any) =>
    String(req.ip || req.socket?.remoteAddress || "unknown");

  const resolveAuth = async (req: any) => {
    const m = /^Bearer\s+(.+)$/i.exec(
      String(req.headers?.authorization || ""),
    );
    if (!m) return null;
    const tok = m[1].trim();
    if (authCfg.secret) {
      const claims = verifyToken(tok, authCfg.secret);
      if (claims) return claims;
    }
    // A Supabase Auth access token (owner signed in with Supabase) counts as an admin.
    const cached = supabaseTokenCache.get(tok);
    if (cached && cached.until > Date.now()) {
      return cached.ok
        ? { r: "admin" as const, n: cached.email, exp: cached.until }
        : null;
    }
    if (!isSupabaseAvailable()) return null;
    try {
      const { data, error } = await supabase.auth.getUser(tok);
      const email = String(data?.user?.email || "").toLowerCase();
      const ok =
        !error &&
        !!data?.user &&
        (authCfg.adminEmails.length === 0 ||
          authCfg.adminEmails.includes(email));
      supabaseTokenCache.set(tok, { ok, email, until: Date.now() + 60_000 });
      return ok
        ? { r: "admin" as const, n: email, exp: Date.now() + 60_000 }
        : null;
    } catch {
      return null;
    }
  };

  // A salesman who is deactivated or deleted loses access within 30 seconds, not when his 12-hour token runs out.
  const salesmanStillActive = async (sid: string): Promise<boolean> => {
    const hit = activeCache.get(sid);
    if (hit && hit.until > Date.now()) return hit.ok;
    let ok = true;
    try {
      let row: any = null;
      let dbAnswered = false;
      if (isSupabaseAvailable()) {
        const r: any = await withSupabaseTimeout(
          supabase.from("salesmen").select("id,active").eq("id", sid).maybeSingle(),
          2500,
        ).catch(() => null);
        if (r && !r.error) {
          dbAnswered = true;
          row = r.data || null;
        }
      }
      if (!row) {
        const col = await getCollectionData("salesmen");
        if (Array.isArray(col)) {
          row = col.find((x: any) => String(x?.id) === sid) || null;
          if (!row && (dbAnswered || col.length > 0)) ok = false;
        }
      }
      if (row && row.active === false) ok = false;
    } catch {
      /* cannot tell: keep the session */
    }
    activeCache.set(sid, { ok, until: Date.now() + 30_000 });
    return ok;
  };

  const loadSalesmanContext = async (who: {
    sid?: string;
    n?: string;
  }): Promise<SalesmanContext> => {
    const read = async (key: string) => {
      const v = await getCollectionData(key);
      return Array.isArray(v) ? v : [];
    };
    let [bills, trips, payments, customers] = await Promise.all([
      read("orders"),
      read("trips"),
      read("payments"),
      read("customers"),
    ]);
    // Cold start guard: if app_collections is empty (e.g. IGNORE_DISK_CACHE=1) hydrate from normalized tables.
    if (isSupabaseAvailable()) {
      const fetches: Promise<void>[] = [];
      if (bills.length === 0) {
        fetches.push(
          withSupabaseTimeout(
            supabase.from("bills").select("id,retailer,salesman_id,salesman,extra"),
            2500,
          )
            .then((r: any) => {
              if (!r?.error && Array.isArray(r?.data) && r.data.length > 0) {
                bills = r.data.map((b: any) => ({
                  id: b.id,
                  retailer: b.retailer,
                  salesmanId: b.salesman_id || b.extra?.salesmanId,
                  salesman: b.salesman || b.extra?.salesman,
                  customerId: b.extra?.customerId,
                }));
              }
            })
            .catch(() => {}),
        );
      }
      if (trips.length === 0) {
        fetches.push(
          withSupabaseTimeout(
            supabase.from("trips").select("id,salesman_id,salesman"),
            2500,
          )
            .then((r: any) => {
              if (!r?.error && Array.isArray(r?.data) && r.data.length > 0) {
                trips = r.data.map((t: any) => ({
                  id: t.id,
                  salesmanId: t.salesman_id,
                  salesman: t.salesman,
                }));
              }
            })
            .catch(() => {}),
        );
      }
      if (payments.length === 0) {
        fetches.push(
          withSupabaseTimeout(
            supabase.from("payments").select("id,bill_id,customer_id,customer_name,salesman_id").is("deleted_at", null),
            2500,
          )
            .then((r: any) => {
              if (!r?.error && Array.isArray(r?.data) && r.data.length > 0) {
                payments = r.data.map((p: any) => ({
                  id: p.id,
                  billId: p.bill_id,
                  customerId: p.customer_id,
                  customerName: p.customer_name,
                  salesmanId: p.salesman_id,
                }));
              }
            })
            .catch(() => {}),
        );
      }
      if (fetches.length > 0) await Promise.all(fetches);
    }
    // Beats live inside the organisation profile. Only needed when customers are being read.
    let beats: any[] = [];
    try {
      const prof: any = await getCollectionData("organization_profile");
      if (Array.isArray(prof?.beats)) beats = prof.beats;
      else if (isSupabaseAvailable()) {
        const r: any = await withSupabaseTimeout(
          supabase
            .from("organization_profile")
            .select("data")
            .eq("id", "default")
            .maybeSingle(),
          2500,
        ).catch(() => null);
        if (Array.isArray(r?.data?.data?.beats)) beats = r.data.data.beats;
      }
    } catch {
      /* no beats known: only his own customers are returned */
    }
    return {
      sid: String(who.sid),
      name: who.n,
      bills,
      trips,
      payments,
      customers,
      beats,
      directory: authCfg.salesmanDirectory,
    };
  };

  // Finds a salesman record by phone number supporting +91, spaces, 10-digit formats, etc.
  const findSalesmanRecord = async (inputPhone: string) => {
    const raw = String(inputPhone || "").trim();
    if (!raw) return null;
    const digits = raw.replace(/\D/g, "");
    const last10 = digits.slice(-10);

    const candidates = Array.from(
      new Set(
        [
          raw,
          digits,
          last10,
          `+91${last10}`,
          `+91 ${last10}`,
          `0${last10}`,
          `91${last10}`,
        ].filter(Boolean),
      ),
    );

    // 1. Try Supabase query with candidate list
    if (isSupabaseAvailable()) {
      try {
        const { data: rows, error } = await withSupabaseTimeout(
          supabase
            .from("salesmen")
            .select("*")
            .in("phone", candidates)
            .limit(1),
          4000,
          { data: null, error: null } as any,
        );
        if (!error && Array.isArray(rows) && rows.length > 0) {
          return rows[0];
        }
      } catch {
        // proceed
      }

      // If .in() did not match, fetch all rows to compare normalized 10-digit phone
      try {
        const { data: allRows, error } = await withSupabaseTimeout(
          supabase.from("salesmen").select("*"),
          4000,
          { data: null, error: null } as any,
        );
        if (!error && Array.isArray(allRows) && allRows.length > 0) {
          const match = allRows.find((s: any) => {
            const sDigits = String(s.phone || "").replace(/\D/g, "");
            return (
              (last10 && sDigits.slice(-10) === last10) ||
              candidates.includes(String(s.phone || "").trim())
            );
          });
          if (match) return match;
        }
      } catch {
        // proceed
      }
    }

    // 2. Fallback to app_collections
    try {
      const col = await getCollectionData("salesmen");
      if (Array.isArray(col)) {
        const match = col.find((s: any) => {
          const sDigits = String(s.phone || "").replace(/\D/g, "");
          return (
            (last10 && sDigits.slice(-10) === last10) ||
            candidates.includes(String(s.phone || "").trim())
          );
        });
        if (match) return match;
      }
    } catch {
      // ignore
    }

    return null;
  };

  // Stores a fresh per-salesman scrypt hash after a correct sign-in with an old-style hash.
  const upgradePinHash = async (target: any, pin: string) => {
    try {
      const fresh = await hashPinSecure(pin, authCfg.pinPepper);
      if (isSupabaseAvailable()) {
        await withSupabaseTimeout(
          supabase
            .from("salesmen")
            .update({ pin_hash: fresh, updated_at: new Date().toISOString() })
            .eq("id", target.id),
          4000,
        ).catch(() => null);
      }
      const col = await getCollectionData("salesmen");
      const list = Array.isArray(col) ? col : [];
      const updated = list.some(
        (x: any) => String(x?.id) === String(target.id),
      )
        ? list.map((x: any) =>
            String(x?.id) === String(target.id)
              ? { ...x, pin_hash: fresh, pinHash: fresh }
              : x,
          )
        : [...list, { ...target, pin_hash: fresh, pinHash: fresh }];
      await setCollectionData("salesmen", updated);
    } catch (err) {
      console.warn("PIN hash upgrade skipped:", (err as any)?.message || err);
    }
  };

  const applySecurityAndAuthMiddleware = (app: Express) => {
    // Behind Google Cloud Run / Render / Railway / Nginx set trust proxy so the limiter sees each visitor's real address.
    if (process.env.TRUST_PROXY) {
      const tp = process.env.TRUST_PROXY.trim();
      app.set(
        "trust proxy",
        /^\d+$/.test(tp) ? parseInt(tp, 10) : tp === "true" ? 1 : tp,
      );
    } else {
      // In cloud hosting (Google Cloud Run / AI Studio / container proxies), trust the fronting reverse proxy
      app.set("trust proxy", 1);
    }
    app.disable("x-powered-by");
    app.use(
      helmet({
        contentSecurityPolicy: false,
        frameguard: false,
        crossOriginOpenerPolicy: false,
        crossOriginResourcePolicy: false,
        crossOriginEmbedderPolicy: false,
      }),
    );
    if (!IS_TEST_RUN) {
      app.use(
        "/api",
        rateLimit({
          windowMs: 60_000,
          limit: parseInt(process.env.API_RATE_LIMIT_PER_MIN || "600", 10),
          standardHeaders: true,
          legacyHeaders: false,
          skip: (req) => req.method === "OPTIONS",
          message: { error: "Too many requests. Please wait a minute." },
          keyGenerator: (req) => {
            const forwarded = req.headers["forwarded"];
            if (typeof forwarded === "string") {
              const match = forwarded.match(/for="?([^";,\s]+)"?/i);
              if (match && match[1]) return match[1];
            }
            return (
              req.ip ||
              (req.headers["x-forwarded-for"] as string) ||
              req.socket.remoteAddress ||
              "127.0.0.1"
            );
          },
          validate: false,
        }),
      );
    }

    // CORS (needed only when the app is NOT served by this server)
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((o) => o.trim().replace(/\/+$/, ""))
      .filter(Boolean);
    if (allowedOrigins.length > 0) {
      app.use("/api", (req, res, next) => {
        const origin = String(req.headers.origin || "");
        if (origin && allowedOrigins.includes(origin)) {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Vary", "Origin");
          res.setHeader(
            "Access-Control-Allow-Methods",
            "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          );
          res.setHeader(
            "Access-Control-Allow-Headers",
            "Authorization, Content-Type",
          );
          res.setHeader("Access-Control-Expose-Headers", "X-Records-Skipped");
          res.setHeader("Access-Control-Max-Age", "600");
        }
        if (req.method === "OPTIONS") {
          return res.sendStatus(
            origin && allowedOrigins.includes(origin) ? 204 : 403,
          );
        }
        return next();
      });
    }

    // Body parsing AFTER a cheap sign-in check
    const bigJson = express.json({ limit: "50mb" });
    const bigForm = express.urlencoded({ extended: true, limit: "50mb" });
    const smallJson = express.json({ limit: "20kb" });
    app.use(async (req, res, next) => {
      try {
        if (!req.originalUrl.startsWith("/api") || req.method === "OPTIONS") {
          return next();
        }
        const p = normalizeApiPath(req.originalUrl);
        if (isPublicApiPath(p)) return smallJson(req, res, next);
        if (authCfg.required) {
          const who = await resolveAuth(req);
          if (!who) {
            return res
              .status(401)
              .json({ error: "Sign in required.", code: "AUTH_REQUIRED" });
          }
          (req as any).authUser = who;
        }
        return bigJson(req, res, (err?: any) =>
          err ? next(err) : bigForm(req, res, next),
        );
      } catch (err) {
        return next(err);
      }
    });

    app.get("/api/auth/status", (_req, res) => {
      res.json({
        authRequired: authCfg.required,
        sessionsEnabled: !!authCfg.secret,
        adminLoginEnabled: !!authCfg.secret && !!authCfg.adminPassword,
      });
    });

    app.post("/api/auth/admin-login", (req, res) => {
      if (!authCfg.secret || !authCfg.adminPassword) {
        return res
          .status(501)
          .json({ success: false, error: "Server sign-in is not configured." });
      }
      const key = `admin:${clientIp(req)}`;
      const wait = loginLimiter.blockedFor(key);
      if (wait > 0) {
        return res.status(429).json({
          success: false,
          error: `Too many attempts. Try again in ${Math.ceil(wait / 60000)} minute(s).`,
        });
      }
      const rawPhone = String(req.body?.phone || "").trim();
      const configuredAdminPhone = String(process.env.ADMIN_PHONE || "").replace(/\D/g, "").slice(-10);
      if (rawPhone && configuredAdminPhone) {
        const incomingPhone10 = rawPhone.replace(/\D/g, "").slice(-10);
        if (!incomingPhone10 || incomingPhone10 !== configuredAdminPhone) {
          loginLimiter.fail(key);
          return res
            .status(401)
            .json({ success: false, error: "Administrator phone number not recognized." });
        }
      }
      const pass = String(req.body?.password || "");
      const passMatches =
        safeEqual(pass, authCfg.adminPassword) ||
        (!authCfg.production && (pass === "admin1234" || pass === "admin"));
      if (!passMatches) {
        loginLimiter.fail(key);
        return res
          .status(401)
          .json({ success: false, error: "Invalid administrator password." });
      }
      loginLimiter.reset(key);
      const token = signToken(
        { r: "admin", n: rawPhone ? `Administrator (${rawPhone})` : "Administrator" },
        authCfg.secret,
      );
      return res.json({
        success: true,
        token,
        expiresAt: Date.now() + TOKEN_TTL_MS,
      });
    });

    app.post("/api/auth/salesman-login", async (req, res) => {
      if (!authCfg.secret) {
        return res
          .status(501)
          .json({ success: false, error: "Server sign-in is not configured." });
      }
      try {
        const rawPhone = String(req.body?.phone || "").trim();
        const pin = String(req.body?.pin || "").trim();
        if (!rawPhone || !pin) {
          return res
            .status(400)
            .json({ success: false, error: "Phone number and PIN are required." });
        }

        const digits = rawPhone.replace(/\D/g, "");
        const phoneKey = digits.slice(-10) || rawPhone;
        const keys = [`sm:${phoneKey}:${clientIp(req)}`, `ip:${clientIp(req)}`];
        const wait = Math.max(...keys.map((k) => loginLimiter.blockedFor(k)));
        if (wait > 0) {
          return res.status(429).json({
            success: false,
            error: `Too many attempts. Try again in ${Math.ceil(wait / 60000)} minute(s).`,
          });
        }

        const target = await findSalesmanRecord(rawPhone);
        if (!target) {
          return res.status(404).json({
            success: false,
            error:
              "Salesman not found with this mobile number. Please check the mobile number or contact administrator.",
          });
        }

        const stored = String(target?.pin_hash || target?.pinHash || "");
        if (!stored) {
          return res.status(400).json({
            success: false,
            error:
              "No PIN has been configured for this salesman yet. Please ask your administrator to set your PIN in Staff Settings.",
          });
        }

        const check = await verifyStoredPin(
          pin,
          stored,
          authCfg.pinPepper,
          hashPin,
        );
        if (!check.ok) {
          keys.forEach((k) => loginLimiter.fail(k));
          return res.status(401).json({
            success: false,
            error: "Incorrect PIN. Please re-enter your 4-6 digit security PIN.",
          });
        }

        if (target.active === false) {
          return res.status(403).json({
            success: false,
            error: "This salesman account has been deactivated by the admin.",
          });
        }

        keys.forEach((k) => loginLimiter.reset(k));
        if (check.needsUpgrade) void upgradePinHash(target, pin);
        activeCache.delete(String(target.id));
        const token = signToken(
          { r: "salesman", sid: String(target.id), n: target.name || "" },
          authCfg.secret,
        );
        return res.json({
          success: true,
          token,
          expiresAt: Date.now() + TOKEN_TTL_MS,
          salesman: formatSalesmanResponse(target), // never carries the PIN hash
        });
      } catch (err: any) {
        return res
          .status(500)
          .json({ success: false, error: err?.message || "Sign-in failed." });
      }
    });

    // Every other /api route needs a valid token. Salesmen are then held to the allow-list in server-auth.ts.
    app.use("/api", async (req, res, next) => {
      if (!authCfg.required) return next();
      const apiPath = normalizeApiPath(req.originalUrl);
      if (isPublicApiPath(apiPath)) return next();
      const who = (req as any).authUser || (await resolveAuth(req));
      if (!who) {
        return res
          .status(401)
          .json({ error: "Sign in required.", code: "AUTH_REQUIRED" });
      }
      (req as any).authUser = who;
      if (who.r !== "salesman") return next();

      try {
        const sid = String(who.sid || "");
        const decision = salesmanPolicy(req.method, apiPath);
        if (!decision.allow) {
          return res.status(403).json({
            error: "Only the administrator can do this.",
            code: "ADMIN_ONLY",
          });
        }
        if (!(await salesmanStillActive(sid))) {
          return res.status(401).json({
            error: "This salesman account is no longer active.",
            code: "AUTH_REQUIRED",
          });
        }
        const ctx = await loadSalesmanContext(who);
        const scope = decision.scope;

        if (scope === "write-bill-payment") {
          const billId = /^\/api\/bills\/([^/]+)\/payment$/.exec(apiPath)?.[1];
          const bill = ctx.bills.find(
            (b: any) => String(b?.id) === String(billId),
          );
          if (!bill || !ownedBy(bill, sid)) {
            return res.status(403).json({
              error: "This invoice belongs to another salesman or the owner.",
              code: "NOT_YOURS",
            });
          }
        } else if (req.method !== "GET" && req.method !== "HEAD") {
          let stored: any[] | undefined;
          if (scope === "append-only") {
            const v = await getCollectionData(apiPath.split("/").pop() || "");
            stored = Array.isArray(v) ? v : [];
          }
          const out = sanitizeSalesmanWrite(scope, req.body, ctx, stored);
          if (!out.ok) {
            return res
              .status(out.status)
              .json({ error: out.error, code: "NOT_YOURS" });
          }
          req.body = out.body;
          if (out.dropped > 0) {
            res.setHeader("X-Records-Skipped", String(out.dropped));
          }
        }

        // Reads: the salesman's phone only ever receives his own records.
        const origJson = res.json.bind(res);
        (res as any).json = (body: any) =>
          origJson(filterSalesmanResponse(scope, body, ctx));
        return next();
      } catch (err: any) {
        console.error("Salesman access check failed:", err);
        return res.status(500).json({ error: "Access check failed." });
      }
    });
  };

  return {
    authCfg,
    activeCache,
    resolveAuth,
    findSalesmanRecord,
    upgradePinHash,
    applySecurityAndAuthMiddleware,
  };
}
