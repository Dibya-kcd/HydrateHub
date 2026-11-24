import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { startupProblems } from "./server-auth";
import { createSecurityAndAuthSetup } from "./server/authMiddleware";
import { registerBillsAndDocNumbersRoutes } from "./server/routes/billsAndDocNumbersRoutes";
import { registerCollectionsRoutes } from "./server/routes/collectionsRoutes";
import { registerCustomersSchemesPaymentsRoutes } from "./server/routes/customersSchemesPaymentsRoutes";
import { registerGrnsInventoryProductsRoutes } from "./server/routes/grnsInventoryProductsRoutes";
import { registerSettingsWarehousesAuditsRoutes } from "./server/routes/settingsWarehousesAuditsRoutes";
import { registerSyncAndActivityRoutes } from "./server/routes/syncAndActivityRoutes";
import { registerSystemRoutes } from "./server/routes/systemRoutes";
import { registerTripsAndSalesmenRoutes } from "./server/routes/tripsAndSalesmenRoutes";
import {
  _appDirname,
  IS_TEST_RUN,
  isSupabaseAvailable,
  recordSupabaseFailure,
  recordSupabaseSuccess,
  reloadDiskCollections,
  supabase,
  withSupabaseTimeout,
} from "./server/supabaseStore";

dotenv.config();
if (process.env.NODE_ENV !== "production") {
  try {
    if (fs.existsSync(".env.example")) {
      dotenv.config({ path: ".env.example" });
    }
  } catch {
    // ignore
  }
}

export {
  supabase,
  isSupabaseAvailable,
  recordSupabaseSuccess,
  recordSupabaseFailure,
  withSupabaseTimeout,
  reloadDiskCollections,
};

async function startServer() {
  const problems = IS_TEST_RUN ? [] : startupProblems();
  if (problems.length > 0) {
    console.error("\n[SECURITY] The server will not start in production until this is fixed:");
    problems.forEach((p) => console.error("  - " + p));
    console.error("See security/RUNBOOK.md.\n");
    process.exit(1);
  }

  const app = express();
  const httpServer = http.createServer(app);
  const argValue = (flag: string): string | undefined => {
    const idx = process.argv.indexOf(flag);
    if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
    const eq = process.argv.find((a) => a.startsWith(`${flag}=`));
    return eq ? eq.slice(flag.length + 1) : undefined;
  };
  const envPort =
    process.env.PORT && process.env.PORT !== process.env.NGINX_PORT
      ? process.env.PORT
      : process.env.DEFAULT_APP_PORT;
  const PORT = parseInt(argValue("--port") || envPort || "3000", 10);

  const {
    authCfg,
    activeCache,
    resolveAuth,
    findSalesmanRecord,
    upgradePinHash,
    applySecurityAndAuthMiddleware,
  } = createSecurityAndAuthSetup();

  applySecurityAndAuthMiddleware(app);

  registerSystemRoutes(app, resolveAuth);
  registerSyncAndActivityRoutes(app, resolveAuth);
  registerSettingsWarehousesAuditsRoutes(app);
  registerBillsAndDocNumbersRoutes(app);
  registerTripsAndSalesmenRoutes(app, {
    authCfg,
    activeCache,
    findSalesmanRecord,
    upgradePinHash,
  });
  registerCustomersSchemesPaymentsRoutes(app);
  registerGrnsInventoryProductsRoutes(app);
  registerCollectionsRoutes(app);

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vitePromise = createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: process.env.DISABLE_HMR === "true" ? null : {},
      },
      appType: "spa",
    });
    vitePromise.catch((err) => {
      console.error("Failed to initialize Vite middleware:", err);
    });

    app.use(async (req, res, next) => {
      if (req.originalUrl.startsWith("/api")) {
        return next();
      }
      try {
        const vite = await vitePromise;
        return vite.middlewares(req, res, next);
      } catch (e) {
        return next(e);
      }
    });

    // Fallback for SPA routing to ensure transformIndexHtml is always applied
    app.use("*", async (req, res, next) => {
      // Don't intercept API routes
      if (req.originalUrl.startsWith("/api")) {
        return next();
      }
      try {
        const vite = await vitePromise;
        const indexPath = path.resolve(_appDirname, "index.html");
        let template = fs.readFileSync(indexPath, "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // The built-in dev password / session secret exist only for a developer machine. If they are in use, do not expose
  // the server to the network (set ADMIN_PASSWORD and APP_SESSION_SECRET, or ALLOW_INSECURE_DEV_HOST=true to override).
  const usingDevDefaults =
    !authCfg.production &&
    !IS_TEST_RUN &&
    (!(process.env.ADMIN_PASSWORD || process.env.VITE_LOCAL_ADMIN_PASSWORD) || !process.env.APP_SESSION_SECRET);
  const explicitHost = argValue("--host") || process.env.HOST;
  const HOST =
    explicitHost ||
    (usingDevDefaults && process.env.ALLOW_INSECURE_DEV_HOST !== "true" ? "127.0.0.1" : "0.0.0.0");
  if (HOST === "127.0.0.1") {
    console.warn("[SECURITY] Built-in dev credentials in use: listening on 127.0.0.1 only. Set ADMIN_PASSWORD and APP_SESSION_SECRET to open it up.");
  }
  httpServer.listen(PORT, HOST, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
