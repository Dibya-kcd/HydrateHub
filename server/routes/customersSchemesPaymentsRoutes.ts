import type { Express } from "express";
import { dedupeSameShopCustomers } from "../../src/utils/customerDedupe";
import { todayISO, toLocalISODate } from "../../src/utils/dateLocal";
import {
  changedSinceBase,
  readDeletedRecordIds,
  readTombstones,
} from "../dbHelpers";
import {
  flushDiskCollectionsNow,
  getCollectionData,
  isSupabaseAvailable,
  readListFresh,
  setCollectionData,
  supabase,
  withSupabaseTimeout,
} from "../supabaseStore";
import { emitSyncEvent } from "../syncEvents";

const inferServerPaymentKind = (p: any): string => {
  if (
    p?.entryKind === "receipt" ||
    p?.entryKind === "advance" ||
    p?.entryKind === "refund" ||
    p?.entryKind === "advance_adjustment"
  ) {
    return p.entryKind;
  }
  if (p?.isRefund || (Number(p?.amount) || 0) < 0) return "refund";
  if (
    p?.billId &&
    String(p?.referenceNote || "").startsWith("Advance / credit adjusted")
  ) {
    return "advance_adjustment";
  }
  if (
    p?.isAdvance ||
    (!p?.billId &&
      String(p?.referenceNote || "").includes("Advance / on account"))
  ) {
    return "advance";
  }
  return "receipt";
};

const istDateFrom = (val: unknown): string => {
  const s = String(val || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return !isNaN(d.getTime()) ? toLocalISODate(d) : todayISO();
};

const mapPaymentToDb = (p: any) => {
  const createdAt = p?.createdAt || new Date().toISOString();
  return {
    id: String(p.id),
    bill_id: p.billId ? Number(p.billId) : null,
    customer_id: p.customerId || null,
    customer_name: p.customerName || "",
    customer_phone: p.customerPhone || "",
    salesman_id: p.salesmanId || null,
    payment_date: p.paymentDate || istDateFrom(createdAt),
    amount: Number(p.amount) || 0,
    mode: p.mode || "cash",
    entry_kind: inferServerPaymentKind(p),
    is_advance: Boolean(p.isAdvance),
    is_refund: Boolean(p.isRefund),
    is_advance_applied: Boolean(p.isAdvanceApplied),
    applied_amount: Number(p.appliedAmount) || 0,
    source_payment_id: p.sourcePaymentId || null,
    source_bill_id: p.sourceBillId ? Number(p.sourceBillId) : null,
    reference_note: p.referenceNote || "",
    recorded_by: p.recordedBy || "",
    deleted_at: null,
    created_at: createdAt,
    updated_at: p.updatedAt || createdAt,
  };
};

const mapDbToPayment = (r: any) => {
  const createdAt = r.created_at || new Date().toISOString();
  return {
    id: String(r.id),
    ...(r.bill_id !== null && r.bill_id !== undefined
      ? { billId: Number(r.bill_id) }
      : {}),
    ...(r.customer_id ? { customerId: String(r.customer_id) } : {}),
    customerName: r.customer_name || "",
    customerPhone: r.customer_phone || "",
    ...(r.salesman_id ? { salesmanId: String(r.salesman_id) } : {}),
    paymentDate: r.payment_date || istDateFrom(createdAt),
    amount: Number(r.amount) || 0,
    mode: r.mode || "cash",
    ...(r.entry_kind ? { entryKind: r.entry_kind } : {}),
    referenceNote: r.reference_note || "",
    recordedBy: r.recorded_by || "",
    isAdvance: Boolean(r.is_advance),
    ...(r.is_advance_applied ? { isAdvanceApplied: true } : {}),
    ...(Number(r.applied_amount) > 0
      ? { appliedAmount: Number(r.applied_amount) }
      : {}),
    ...(r.source_payment_id
      ? { sourcePaymentId: String(r.source_payment_id) }
      : {}),
    ...(r.source_bill_id !== null && r.source_bill_id !== undefined
      ? { sourceBillId: Number(r.source_bill_id) }
      : {}),
    ...(r.is_refund ? { isRefund: true } : {}),
    createdAt,
    ...(r.updated_at ? { updatedAt: r.updated_at } : {}),
  };
};

const syncPaymentsTableBestEffort = (rows: any[]) => {
  if (!isSupabaseAvailable() || !Array.isArray(rows) || rows.length === 0) {
    return;
  }
  const mapped = rows.filter((r) => r?.id).map(mapPaymentToDb);
  for (let i = 0; i < mapped.length; i += 500) {
    withSupabaseTimeout(
      supabase
        .from("payments")
        .upsert(mapped.slice(i, i + 500), { onConflict: "id" }),
      2500,
    ).catch(() => {});
  }
};

export function registerCustomersSchemesPaymentsRoutes(app: Express) {
  // 2. PROMOTIONAL SCHEMES ROUTES
  app.get("/api/schemes", async (_req, res) => {
    try {
      const colSchemes = await getCollectionData("schemes");
      if (Array.isArray(colSchemes) && colSchemes.length > 0) {
        return res.json({ success: true, data: colSchemes });
      }

      if (isSupabaseAvailable()) {
        const { data: schemes, error } = (await withSupabaseTimeout(
          supabase.from("promotional_schemes").select("*"),
          2500,
        )) as any;
        if (!error && Array.isArray(schemes) && schemes.length > 0) {
          return res.json({ success: true, data: schemes });
        }

        const { data: promos, error: promoErr } = (await withSupabaseTimeout(
          supabase
            .from("promotions")
            .select("*")
            .order("id", { ascending: true }),
          2500,
        )) as any;
        if (!promoErr && Array.isArray(promos) && promos.length > 0) {
        const mapped = promos.map((p: any) => {
          const rawIds =
            p.product_ids ?? p.productIds ?? p.product_id ?? p.productId;
          let cleanIds: number[] = [];
          if (Array.isArray(rawIds)) {
            cleanIds = rawIds.map(Number).filter((n: number) => !isNaN(n));
          } else if (typeof rawIds === "string") {
            try {
              const parsed = JSON.parse(rawIds);
              if (Array.isArray(parsed)) {
                cleanIds = parsed.map(Number).filter((n: number) => !isNaN(n));
              } else {
                cleanIds = rawIds
                  .split(",")
                  .map((s: string) => Number(s.trim()))
                  .filter((n: number) => !isNaN(n));
              }
            } catch {
              cleanIds = rawIds
                .split(",")
                .map((s: string) => Number(s.trim()))
                .filter((n: number) => !isNaN(n));
            }
          } else if (typeof rawIds === "number" && !isNaN(rawIds)) {
            cleanIds = [rawIds];
          }

          return {
            id: Number(p.id),
            name: p.name,
            type: p.type,
            buyQty: Number(p.buy_qty ?? p.buyQty ?? 0),
            freeQty: Number(p.free_qty ?? p.freeQty ?? 0),
            percent: Number(p.percent ?? 0),
            flatPerCase: Number(p.flat_per_case ?? p.flatPerCase ?? 0),
            productIds: cleanIds,
            isActive:
              p.is_active !== undefined
                ? Boolean(p.is_active)
                : p.isActive !== undefined
                  ? Boolean(p.isActive)
                  : true,
            bundleBuyType: p.bundle_buy_type ?? p.bundleBuyType ?? "any",
            requiredDistinctTypes: Number(
              p.required_distinct_types ?? p.requiredDistinctTypes ?? 2,
            ),
            minQtyPerType: Number(p.min_qty_per_type ?? p.minQtyPerType ?? 1),
            freeRewardChoice:
              p.free_reward_choice ?? p.freeRewardChoice ?? "all_eligible",
            freeProductId: p.free_product_id
              ? Number(p.free_product_id)
              : p.freeProductId
                ? Number(p.freeProductId)
                : undefined,
            freeProductQty: Number(p.free_product_qty ?? p.freeProductQty ?? 1),
          };
        });
          return res.json({ success: true, data: mapped });
        }
      }

      return res.json({ success: true, data: [] });
    } catch (err: any) {
      console.error("Error in GET /api/schemes:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to fetch schemes", data: [] });
    }
  });

  app.post("/api/schemes", async (req, res) => {
    try {
      const schemeData = req.body;
      const id = Number(schemeData.id) || Date.now();
      const fullScheme = { ...schemeData, id };

      const colSchemes = await getCollectionData("schemes");
      const list = Array.isArray(colSchemes) ? colSchemes : [];
      const updated = [
        ...list.filter((s: any) => Number(s.id) !== id),
        fullScheme,
      ];
      await setCollectionData("schemes", updated);

      const safeType =
        schemeData.type === "bundle"
          ? "bogo"
          : ["bogo", "percent", "flat"].includes(schemeData.type)
            ? schemeData.type
            : "bogo";
      const dbRow = {
        id,
        name: schemeData.name,
        type: safeType,
        buy_qty: Number(schemeData.buyQty ?? schemeData.buy_qty ?? 0),
        free_qty: Number(schemeData.freeQty ?? schemeData.free_qty ?? 0),
        percent: Number(schemeData.percent ?? 0),
        flat_per_case: Number(
          schemeData.flatPerCase ?? schemeData.flat_per_case ?? 0,
        ),
        product_ids: schemeData.productIds || schemeData.product_ids || [],
      };

      if (isSupabaseAvailable()) {
        try {
          await withSupabaseTimeout(
            supabase.from("promotions").upsert(dbRow, { onConflict: "id" }),
            2500,
          );
        } catch (pErr: any) {
          console.warn("Note on mirroring to public.promotions:", pErr?.message);
        }

        try {
          await withSupabaseTimeout(
            supabase
              .from("promotional_schemes")
              .upsert(fullScheme, { onConflict: "id" }),
            2500,
          );
        } catch {
          // ignore
        }
      }

      emitSyncEvent({ topic: "schemes" });
      return res.status(201).json({ success: true, data: fullScheme });
    } catch (err: any) {
      console.error("Error saving scheme:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to save scheme" });
    }
  });

  app.put("/api/schemes", async (req, res) => {
    try {
      const rawSchemes = req.body?.schemes || req.body?.data || req.body;
      const list: any[] = Array.isArray(rawSchemes) ? rawSchemes : [];

      await setCollectionData("schemes", list);

      if (isSupabaseAvailable() && list.length > 0) {
        const rows = list.map((schemeData: any) => {
          const safeType =
            schemeData.type === "bundle"
              ? "bogo"
              : ["bogo", "percent", "flat"].includes(schemeData.type)
                ? schemeData.type
                : "bogo";
          return {
            id: Number(schemeData.id),
            name: schemeData.name,
            type: safeType,
            buy_qty: Number(schemeData.buyQty ?? schemeData.buy_qty ?? 0),
            free_qty: Number(schemeData.freeQty ?? schemeData.free_qty ?? 0),
            percent: Number(schemeData.percent ?? 0),
            flat_per_case: Number(
              schemeData.flatPerCase ?? schemeData.flat_per_case ?? 0,
            ),
            product_ids: schemeData.productIds || schemeData.product_ids || [],
          };
        });

        try {
          const { error: pErr } = (await withSupabaseTimeout(
            supabase.from("promotions").upsert(rows, { onConflict: "id" }),
            2500,
          )) as any;
          if (pErr) {
            console.warn("Mirroring to promotions table noted:", pErr.message);
          }
        } catch (pEx: any) {
          console.warn(
            "Mirroring to promotions table exception:",
            pEx?.message,
          );
        }
      }

      emitSyncEvent({ topic: "schemes" });
      return res.json({ success: true, count: list.length });
    } catch (err: any) {
      console.error("Error in PUT /api/schemes:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to update schemes" });
    }
  });

  app.delete("/api/schemes/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isSupabaseAvailable()) {
        await withSupabaseTimeout(
          supabase.from("promotions").delete().eq("id", id),
          2500,
        ).catch(() => {});
        await withSupabaseTimeout(
          supabase.from("promotional_schemes").delete().eq("id", id),
          2500,
        ).catch(() => {});
      }
      const colSchemes = await getCollectionData("schemes");
      if (Array.isArray(colSchemes)) {
        await setCollectionData(
          "schemes",
          colSchemes.filter((s: any) => Number(s.id) !== id),
        );
      }
      emitSyncEvent({ topic: "schemes" });
      return res.json({ success: true, id });
    } catch (err: any) {
      console.error("Error in DELETE /api/schemes:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to delete scheme" });
    }
  });

  // 2B. CUSTOMER MASTER ROUTES
  app.get("/api/customers", async (_req, res) => {
    try {
      const data = await getCollectionData("customers");
      const dead = await readDeletedRecordIds("customer");
      const list = Array.isArray(data)
        ? dedupeSameShopCustomers(
            data.filter(
              (c: any) => c?.id === undefined || !dead.has(String(c.id)),
            ),
          ).customers
        : [];
      return res.json({ success: true, data: list });
    } catch (err: any) {
      console.error("Error in GET /api/customers:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to fetch customers", data: [] });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const customer = req.body;
      const id =
        customer.id ||
        `cust_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newCustomer = {
        ...customer,
        id,
        createdAt: customer.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const existing = await getCollectionData("customers");
      const list = Array.isArray(existing) ? existing : [];
      const storedCust = list.find((c: any) => c.id === id);
      const stampOf = (c: any) =>
        Date.parse(c?.updatedAt || c?.createdAt || "") || 0;
      if (
        storedCust &&
        ((customer.updatedAt && stampOf(storedCust) > stampOf(customer)) ||
          changedSinceBase(req, storedCust))
      ) {
        return res.status(409).json({
          error:
            "This customer was changed on another device. Refresh to see the latest copy.",
          code: "STALE",
          data: storedCust,
        });
      }
      const keepOwner =
        storedCust?.createdBySalesmanId && !newCustomer.createdBySalesmanId
          ? { createdBySalesmanId: storedCust.createdBySalesmanId }
          : {};
      const updated = [
        ...list.filter((c: any) => c.id !== id),
        { ...newCustomer, ...keepOwner },
      ];
      await setCollectionData("customers", updated);
      emitSyncEvent({ topic: "customers" });

      return res.status(201).json({ success: true, data: newCustomer });
    } catch (err: any) {
      console.error("Error in POST /api/customers:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to save customer" });
    }
  });

  app.put("/api/customers", async (req, res) => {
    try {
      const payload = req.body?.customers || req.body?.data || req.body;
      if (Array.isArray(payload)) {
        const stored = await getCollectionData("customers");
        const dead = await readDeletedRecordIds("customer");
        const when = (c: any) =>
          Date.parse(c?.updatedAt || c?.createdAt || "") || 0;
        const byId = new Map<string, any>();
        for (const c of Array.isArray(stored) ? stored : []) {
          if (c?.id !== undefined && !dead.has(String(c.id))) {
            byId.set(String(c.id), c);
          }
        }
        for (const c of payload) {
          if (c?.id === undefined || dead.has(String(c.id))) continue;
          const cur = byId.get(String(c.id));
          if (cur && when(cur) > when(c)) continue;
          byId.set(
            String(c.id),
            cur?.createdBySalesmanId && !c.createdBySalesmanId
              ? { ...c, createdBySalesmanId: cur.createdBySalesmanId }
              : c,
          );
        }
        const merged = dedupeSameShopCustomers(
          Array.from(byId.values()),
        ).customers;
        await setCollectionData("customers", merged);
        emitSyncEvent({ topic: "customers" });
        return res.json({ success: true, count: merged.length });
      }

      if (payload && payload.id) {
        const existing = await getCollectionData("customers");
        const list = Array.isArray(existing) ? existing : [];
        const updated = list.map((c: any) =>
          c.id === payload.id
            ? { ...payload, updatedAt: new Date().toISOString() }
            : c,
        );
        if (!list.some((c: any) => c.id === payload.id)) {
          updated.push({ ...payload, updatedAt: new Date().toISOString() });
        }
        await setCollectionData("customers", updated);
        emitSyncEvent({ topic: "customers" });
        return res.json({ success: true, data: payload });
      }

      return res.status(400).json({ error: "Invalid payload for customers" });
    } catch (err: any) {
      console.error("Error in PUT /api/customers:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to update customers" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await getCollectionData("customers");
      const target = Array.isArray(existing)
        ? existing.find((c: any) => c.id === id)
        : undefined;
      if (Array.isArray(existing)) {
        const filtered = existing.filter((c: any) => c.id !== id);
        await setCollectionData("customers", filtered);
      }
      const delEntry = {
        kind: "customer",
        id: String(id),
        name: req.body?.name || target?.name || undefined,
        deletedAt: new Date().toISOString(),
        by: req.body?.by || "Admin",
        reason: req.body?.reason || undefined,
      };
      const log = await readListFresh("deleted_records");
      if (
        !log.some(
          (r: any) => r?.kind === "customer" && String(r.id) === String(id),
        )
      ) {
        await setCollectionData(
          "deleted_records",
          [...log, delEntry].slice(-20000),
        );
      }
      if (isSupabaseAvailable()) {
        withSupabaseTimeout(
          supabase.from("app_collections").upsert(
            {
              key: `deleted:customer:${id}`,
              data: delEntry,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "key" },
          ),
          2500,
        ).catch(() => {});
      }
      flushDiskCollectionsNow();
      emitSyncEvent({ topic: "customers" });
      emitSyncEvent({ topic: "deletions" });
      return res.json({ success: true, id });
    } catch (err: any) {
      console.error("Error in DELETE /api/customers:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to delete customer" });
    }
  });

  // 2C. PAYMENTS & COLLECTIONS ROUTES
  app.get("/api/payments", async (_req, res) => {
    try {
      const data = await getCollectionData("payments");
      const deadPay = await readDeletedRecordIds("payment");
      const deadBills = await readTombstones("deleted_bill_ids");
      const byId = new Map<string, any>();
      const payStamp = (p: any) =>
        Date.parse(p?.updatedAt || p?.createdAt || "") || 0;
      if (Array.isArray(data)) {
        for (const p of data) {
          if (p?.id === undefined) continue;
          byId.set(String(p.id), p);
        }
      }
      if (isSupabaseAvailable()) {
        try {
          const { data: tableRows, error } = await withSupabaseTimeout(
            supabase
              .from("payments")
              .select("*")
              .order("payment_date", { ascending: false })
              .limit(5000),
            2500,
          );
          if (!error && Array.isArray(tableRows)) {
            for (const r of tableRows) {
              if (!r?.id) continue;
              const id = String(r.id);
              if (r.deleted_at) {
                deadPay.add(id);
                byId.delete(id);
                continue;
              }
              const mapped = mapDbToPayment(r);
              const cur = byId.get(id);
              if (!cur || payStamp(mapped) >= payStamp(cur)) {
                byId.set(id, mapped);
              }
            }
          }
        } catch {
          // public.payments table may not be migrated yet
        }
      }
      const list = Array.from(byId.values()).filter(
        (p: any) =>
          p?.id !== undefined &&
          !deadPay.has(String(p.id)) &&
          !(
            p.billId !== undefined &&
            p.billId !== null &&
            deadBills.has(String(p.billId))
          ),
      );
      return res.json({ success: true, data: list });
    } catch (err: any) {
      console.error("Error in GET /api/payments:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to fetch payments", data: [] });
    }
  });

  app.post("/api/payments", async (req, res) => {
    try {
      const payment = req.body;
      const id =
        payment.id ||
        `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newPayment = {
        ...payment,
        id,
        createdAt: payment.createdAt || new Date().toISOString(),
      };

      const existing = await getCollectionData("payments");
      const list = Array.isArray(existing) ? existing : [];
      const storedPay = list.find((p: any) => p.id === id);
      const payStamp = (p: any) =>
        Date.parse(p?.updatedAt || p?.createdAt || "") || 0;
      if (
        storedPay &&
        (payStamp(storedPay) > payStamp(newPayment) ||
          changedSinceBase(req, storedPay))
      ) {
        return res.status(409).json({
          error:
            "This receipt was changed on another device. Refresh to see the latest copy.",
          code: "STALE",
          data: storedPay,
        });
      }
      const updated = [newPayment, ...list.filter((p: any) => p.id !== id)];
      await setCollectionData("payments", updated);
      syncPaymentsTableBestEffort([newPayment]);
      emitSyncEvent({
        topic: "payments",
        salesmanId: newPayment?.salesmanId
          ? String(newPayment.salesmanId)
          : undefined,
      });

      return res.status(201).json({ success: true, data: newPayment });
    } catch (err: any) {
      console.error("Error in POST /api/payments:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to save payment" });
    }
  });

  app.put("/api/payments", async (req, res) => {
    try {
      const payload = req.body?.payments || req.body?.data || req.body;
      if (Array.isArray(payload)) {
        const stored = await getCollectionData("payments");
        const dead = await readDeletedRecordIds("payment");
        const deadBills = await readTombstones("deleted_bill_ids");
        const when = (p: any) =>
          Date.parse(p?.updatedAt || p?.createdAt || "") || 0;
        const gone = (p: any) =>
          p?.id === undefined ||
          dead.has(String(p.id)) ||
          (p.billId !== undefined &&
            p.billId !== null &&
            deadBills.has(String(p.billId)));
        const byId = new Map<string, any>();
        for (const p of Array.isArray(stored) ? stored : []) {
          if (!gone(p)) byId.set(String(p.id), p);
        }
        for (const p of payload) {
          if (gone(p)) continue;
          const cur = byId.get(String(p.id));
          if (cur && when(cur) > when(p)) continue;
          byId.set(String(p.id), p);
        }
        const merged = Array.from(byId.values());
        await setCollectionData("payments", merged);
        syncPaymentsTableBestEffort(merged);
        emitSyncEvent({ topic: "payments" });
        return res.json({ success: true, count: merged.length });
      }

      if (payload && payload.id) {
        const existing = await getCollectionData("payments");
        const list = Array.isArray(existing) ? existing : [];
        const updated = list.map((p: any) =>
          p.id === payload.id ? { ...payload } : p,
        );
        if (!list.some((p: any) => p.id === payload.id)) {
          updated.unshift(payload);
        }
        await setCollectionData("payments", updated);
        syncPaymentsTableBestEffort([payload]);
        emitSyncEvent({
          topic: "payments",
          salesmanId: payload?.salesmanId
            ? String(payload.salesmanId)
            : undefined,
        });
        return res.json({ success: true, data: payload });
      }

      return res.status(400).json({ error: "Invalid payload for payments" });
    } catch (err: any) {
      console.error("Error in PUT /api/payments:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to update payments" });
    }
  });

  app.delete("/api/payments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const by = String(req.body?.by || "Admin").trim() || "Admin";
      const reason = String(req.body?.reason || req.body?.note || "").trim();
      const existing = await getCollectionData("payments");
      const target = Array.isArray(existing)
        ? existing.find((p: any) => String(p.id) === String(id))
        : undefined;
      if (Array.isArray(existing)) {
        const filtered = existing.filter((p: any) => String(p.id) !== String(id));
        await setCollectionData("payments", filtered);
      }
      if (isSupabaseAvailable()) {
        const now = new Date().toISOString();
        withSupabaseTimeout(
          supabase
            .from("payments")
            .update({
              deleted_at: now,
              deleted_by: by,
              ...(reason ? { delete_reason: reason } : {}),
              updated_at: now,
            })
            .eq("id", String(id)),
          2500,
        ).catch(() => {});
      }
      {
        const log = await readListFresh("deleted_records");
        const delEntry = {
          kind: "payment",
          id: String(id),
          name: target?.customerName || undefined,
          deletedAt: new Date().toISOString(),
          by,
          ...(reason ? { reason } : {}),
        };
        if (
          !log.some(
            (r: any) => r?.kind === "payment" && String(r.id) === String(id),
          )
        ) {
          await setCollectionData(
            "deleted_records",
            [...log, delEntry].slice(-20000),
          );
        }
        if (isSupabaseAvailable()) {
          withSupabaseTimeout(
            supabase.from("app_collections").upsert(
              {
                key: `deleted:payment:${id}`,
                data: delEntry,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "key" },
            ),
            2500,
          ).catch(() => {});
        }
      }
      flushDiskCollectionsNow();
      emitSyncEvent({ topic: "payments" });
      emitSyncEvent({ topic: "deletions" });
      return res.json({ success: true, id });
    } catch (err: any) {
      console.error("Error in DELETE /api/payments:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to delete payment" });
    }
  });

  // Payment Change History (audit trail)
  app.get("/api/payment-history", async (_req, res) => {
    try {
      const byId = new Map<string, any>();
      const localList = await getCollectionData("payment_history");
      if (Array.isArray(localList)) {
        for (const item of localList) {
          if (item?.id) byId.set(String(item.id), item);
        }
      }
      if (isSupabaseAvailable()) {
        try {
          const { data, error } = await withSupabaseTimeout(
            supabase
              .from("payment_history")
              .select("*")
              .order("changed_at", { ascending: false })
              .limit(1000),
            2500,
          );
          if (!error && Array.isArray(data)) {
            for (const r of data) {
              if (!r?.id) continue;
              byId.set(String(r.id), {
                id: String(r.id),
                at: r.changed_at,
                by: r.changed_by || "Admin",
                action: r.action,
                ...(r.payment_id ? { paymentId: String(r.payment_id) } : {}),
                ...(r.bill_id !== null && r.bill_id !== undefined
                  ? { billId: Number(r.bill_id) }
                  : {}),
                ...(r.customer_name ? { customerName: r.customer_name } : {}),
                ...(r.amount !== null && r.amount !== undefined
                  ? { amount: Number(r.amount) }
                  : {}),
                ...(r.note ? { note: r.note } : {}),
                ...(r.before_data ? { before: r.before_data } : {}),
                ...(r.after_data ? { after: r.after_data } : {}),
              });
            }
          }
        } catch {
          // payment_history table may not be migrated yet
        }
      }
      const list = Array.from(byId.values())
        .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
        .slice(0, 1000);
      return res.json({ success: true, data: list });
    } catch (err: any) {
      return res.status(500).json({
        error: err.message || "Failed to fetch payment history",
        data: [],
      });
    }
  });

  app.post("/api/payment-history", async (req, res) => {
    try {
      const entry = req.body;
      if (!entry || !entry.id || !entry.action) {
        return res
          .status(400)
          .json({ error: "Invalid payment history entry" });
      }
      const existing = await getCollectionData("payment_history");
      const list = Array.isArray(existing) ? existing : [];
      const next = [
        entry,
        ...list.filter((e: any) => e?.id !== entry.id),
      ].slice(0, 1000);
      await setCollectionData("payment_history", next);
      if (isSupabaseAvailable()) {
        withSupabaseTimeout(
          supabase.from("payment_history").upsert(
            {
              id: String(entry.id),
              payment_id: entry.paymentId || null,
              bill_id: entry.billId ? Number(entry.billId) : null,
              customer_name: entry.customerName || "",
              action: entry.action,
              amount:
                entry.amount !== undefined && entry.amount !== null
                  ? Number(entry.amount)
                  : null,
              note: entry.note || "",
              changed_by: entry.by || "Admin",
              before_data: entry.before ?? null,
              after_data: entry.after ?? null,
              changed_at: entry.at || new Date().toISOString(),
            },
            { onConflict: "id" },
          ),
          2500,
        ).catch(() => {});
      }
      return res.status(201).json({ success: true, data: entry });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err.message || "Failed to save payment history" });
    }
  });
}
