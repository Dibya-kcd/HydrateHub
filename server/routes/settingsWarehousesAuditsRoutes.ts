import type { Express } from "express";
import { todayISO } from "../../src/utils/dateLocal";
import { formatWarehouseForSupabase } from "../dbHelpers";
import {
  getCollectionData,
  isSupabaseAvailable,
  setCollectionData,
  supabase,
  withSupabaseTimeout,
} from "../supabaseStore";
import { emitSyncEvent } from "../syncEvents";

export function registerSettingsWarehousesAuditsRoutes(app: Express) {
  // SETTINGS ROUTES (billing_settings and organization_profile)
  app.get("/api/settings/billing", async (_req, res) => {
    try {
      if (isSupabaseAvailable()) {
        const { data, error } = (await withSupabaseTimeout(
          supabase
            .from("billing_settings")
            .select("*")
            .eq("id", "default")
            .maybeSingle(),
          2500,
        )) as any;
        if (!error && data && data.data) {
          return res.json({ success: true, data: data.data });
        }
      }
      const col = await getCollectionData("billing_settings");
      return res.json({
        success: true,
        data: col && !Array.isArray(col) ? col : null,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err.message || "Failed to load billing settings" });
    }
  });

  app.post("/api/settings/billing", async (req, res) => {
    try {
      const settings = req.body?.settings || req.body?.data || req.body;
      if (isSupabaseAvailable()) {
        const resSup = (await withSupabaseTimeout(
          supabase.from("billing_settings").upsert(
            {
              id: "default",
              data: settings,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          ),
          2500,
        )) as any;
        if (resSup?.error) {
          console.warn(
            "Error saving billing_settings in Supabase:",
            resSup.error.message,
          );
        }
      }
      await setCollectionData("billing_settings", settings);
      emitSyncEvent({ topic: "settings" });
      return res.json({ success: true, data: settings });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err.message || "Failed to save billing settings" });
    }
  });

  app.get("/api/settings/profile", async (_req, res) => {
    try {
      if (isSupabaseAvailable()) {
        const { data, error } = await withSupabaseTimeout(
          supabase
            .from("organization_profile")
            .select("*")
            .eq("id", "default")
            .maybeSingle(),
          3000,
        );
        if (!error && data && data.data) {
          return res.json({ success: true, data: data.data });
        }
      }
      const col = await getCollectionData("organization_profile");
      return res.json({
        success: true,
        data: col && !Array.isArray(col) ? col : null,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err.message || "Failed to load org profile" });
    }
  });

  app.post("/api/settings/profile", async (req, res) => {
    try {
      const profile = req.body?.profile || req.body?.data || req.body;
      if (isSupabaseAvailable()) {
        try {
          const resSup = await withSupabaseTimeout(
            supabase.from("organization_profile").upsert(
              {
                id: "default",
                data: profile,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" },
            ),
            4000,
          );
          if (
            resSup?.error &&
            !String(resSup.error.message || "")
              .toLowerCase()
              .includes("timeout") &&
            !String(resSup.error.message || "")
              .toLowerCase()
              .includes("unavailable")
          ) {
            console.info(
              "[Supabase] organization_profile sync notice:",
              resSup.error.message,
            );
          }
        } catch {
          // Best-effort remote sync: local storage is authoritative
        }
      }
      await setCollectionData("organization_profile", profile);
      emitSyncEvent({ topic: "settings" });
      return res.json({ success: true, data: profile });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err.message || "Failed to save org profile" });
    }
  });

  // WAREHOUSES ROUTES (Supabase public.warehouses)
  app.get("/api/warehouses", async (_req, res) => {
    try {
      if (isSupabaseAvailable()) {
        const { data: whs, error } = await withSupabaseTimeout(
          supabase
            .from("warehouses")
            .select("*")
            .order("name", { ascending: true }),
          3000,
        );
        if (!error && Array.isArray(whs) && whs.length > 0) {
          const mapped = whs.map((w: any) => ({
            id: String(w.id),
            name: w.name,
            code: w.code || "",
            location: w.location || "",
            manager: w.manager || "",
            phone: w.phone || "",
            capacityCases: Number(w.capacity_cases || 0),
            isDefault: Boolean(w.is_default),
            notes: w.notes || "",
          }));
          return res.json({ success: true, data: mapped });
        }
      }
      const col = await getCollectionData("warehouses");
      return res.json({ success: true, data: Array.isArray(col) ? col : [] });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err.message || "Failed to fetch warehouses", data: [] });
    }
  });

  app.post("/api/warehouses", async (req, res) => {
    try {
      const w = req.body;
      const payload = formatWarehouseForSupabase(w);
      if (isSupabaseAvailable()) {
        try {
          const resSup = await withSupabaseTimeout(
            supabase
              .from("warehouses")
              .upsert(payload, { onConflict: "id" }),
            4000,
          );
          if (
            resSup?.error &&
            !String(resSup.error.message || "")
              .toLowerCase()
              .includes("timeout") &&
            !String(resSup.error.message || "")
              .toLowerCase()
              .includes("unavailable")
          ) {
            console.info(
              "[Supabase] warehouse sync notice:",
              resSup.error.message,
            );
          }
        } catch {
          // Best-effort remote sync
        }
      }
      const cur = await getCollectionData("warehouses");
      const list = Array.isArray(cur) ? cur : [];
      const next = [w, ...list.filter((x: any) => String(x?.id) !== String(payload.id))];
      await setCollectionData("warehouses", next);
      emitSyncEvent({ topic: "warehouses" });
      return res.status(201).json({ success: true, data: payload });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err.message || "Failed to create warehouse" });
    }
  });

  app.put("/api/warehouses", async (req, res) => {
    try {
      const raw = Array.isArray(req.body?.warehouses)
        ? req.body.warehouses
        : Array.isArray(req.body?.data)
          ? req.body.data
          : Array.isArray(req.body)
            ? req.body
            : [];
      if (raw.length === 0) return res.json({ success: true, count: 0 });
      const payloads = raw.map(formatWarehouseForSupabase);
      if (isSupabaseAvailable()) {
        try {
          const resSup = await withSupabaseTimeout(
            supabase
              .from("warehouses")
              .upsert(payloads, { onConflict: "id" }),
            4000,
          );
          if (
            resSup?.error &&
            !String(resSup.error.message || "")
              .toLowerCase()
              .includes("timeout") &&
            !String(resSup.error.message || "")
              .toLowerCase()
              .includes("unavailable")
          ) {
            console.info(
              "[Supabase] warehouses bulk sync notice:",
              resSup.error.message,
            );
          }
        } catch {
          // Best-effort remote sync
        }
      }
      await setCollectionData("warehouses", raw);
      emitSyncEvent({ topic: "warehouses" });
      return res.json({ success: true, count: payloads.length });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err.message || "Failed to bulk save warehouses" });
    }
  });

  app.delete("/api/warehouses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (isSupabaseAvailable()) {
        await withSupabaseTimeout(
          supabase.from("warehouses").delete().eq("id", id),
          2500,
        ).catch(() => {});
      }
      const col = await getCollectionData("warehouses");
      if (Array.isArray(col)) {
        await setCollectionData(
          "warehouses",
          col.filter((w: any) => String(w.id) !== id),
        );
      }
      emitSyncEvent({ topic: "warehouses" });
      return res.json({ success: true, id });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err.message || "Failed to delete warehouse" });
    }
  });

  // STOCK AUDITS ROUTES (Supabase public.audits)
  app.get("/api/audits", async (_req, res) => {
    try {
      if (isSupabaseAvailable()) {
        const { data: audits, error } = (await withSupabaseTimeout(
          supabase
            .from("audits")
            .select("*")
            .order("date", { ascending: false }),
          2500,
        )) as any;
        if (!error && Array.isArray(audits) && audits.length > 0) {
          return res.json({ success: true, data: audits });
        }
      }
      const col = await getCollectionData("audits");
      return res.json({ success: true, data: Array.isArray(col) ? col : [] });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err.message || "Failed to fetch audits", data: [] });
    }
  });

  app.post("/api/audits", async (req, res) => {
    try {
      const a = req.body;
      const payload = {
        id: Number(a.id || Date.now()),
        date: a.date || todayISO(),
        time: a.time || null,
        referenceNote: a.referenceNote || null,
        entries: Array.isArray(a.entries) ? a.entries : [],
        adjusted: Boolean(a.adjusted),
      };
      if (isSupabaseAvailable()) {
        await withSupabaseTimeout(
          supabase.from("audits").upsert(
            {
              id: payload.id,
              date: payload.date,
              entries: payload.entries,
              adjusted: payload.adjusted,
            },
            { onConflict: "id" },
          ),
          2500,
        ).catch(() => {});
      }
      const existing = await getCollectionData("audits");
      const list = Array.isArray(existing) ? existing : [];
      await setCollectionData("audits", [
        payload,
        ...list.filter((x: any) => Number(x.id) !== payload.id),
      ]);
      emitSyncEvent({ topic: "inventory", key: "audits" });
      return res.status(201).json({ success: true, data: payload });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err.message || "Failed to save audit" });
    }
  });

  app.delete("/api/audits/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isSupabaseAvailable()) {
        await withSupabaseTimeout(
          supabase.from("audits").delete().eq("id", id),
          2500,
        ).catch(() => {});
      }
      const existing = await getCollectionData("audits");
      if (Array.isArray(existing)) {
        await setCollectionData(
          "audits",
          existing.filter((x: any) => Number(x.id) !== id),
        );
      }
      emitSyncEvent({ topic: "inventory", key: "audits" });
      return res.json({ success: true, id });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err.message || "Failed to delete audit" });
    }
  });
}
