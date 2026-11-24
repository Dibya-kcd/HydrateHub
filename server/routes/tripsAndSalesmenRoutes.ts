import type { Express } from "express";
import { hashPinSecure, verifyStoredPin, type AuthConfig } from "../../server-auth";
import { hashPin } from "../../src/utils/crypto";
import { todayISO } from "../../src/utils/dateLocal";
import { formatSalesmanResponse, formatSalesmanStored } from "../authMiddleware";
import {
  addTombstone,
  changedSinceBase,
  formatTripForSupabase,
  isValidUuid,
  mergeRecordLists,
  parseBillIdsSafe,
  parseDictSafe,
  readTombstones,
  resilientUpsert,
  tripReturnProblem,
  tripStaleReopen,
} from "../dbHelpers";
import {
  getCollectionData,
  isSupabaseAvailable,
  readListFresh,
  setCollectionData,
  supabase,
  withSupabaseTimeout,
} from "../supabaseStore";
import { emitSyncEvent } from "../syncEvents";

export interface TripsAndSalesmenDeps {
  authCfg: AuthConfig;
  activeCache: Map<string, { ok: boolean; until: number }>;
  findSalesmanRecord: (phone: string) => Promise<any>;
  upgradePinHash: (target: any, pin: string) => Promise<void>;
}

export function registerTripsAndSalesmenRoutes(
  app: Express,
  { authCfg, activeCache, findSalesmanRecord, upgradePinHash }: TripsAndSalesmenDeps,
) {
  // DELIVERY TRIPS ROUTES (Supabase public.trips)
  app.get("/api/trips", async (_req, res) => {
    try {
      const mapTripRow = (t: any, cached?: any) => {
        const status = t.status || cached?.status || "out";
        const loaded = parseDictSafe(t.loaded || cached?.loaded);
        const returned =
          status === "closed"
            ? parseDictSafe(t.returned || cached?.returned)
            : {};
        const rawBillIds =
          t.billIds ?? t.bill_ids ?? cached?.billIds ?? cached?.bill_ids ?? [];
        const billIds = parseBillIdsSafe(rawBillIds);
        return {
          id: Number(t.id),
          vehicle: t.vehicle || cached?.vehicle || "",
          route: t.route || cached?.route || undefined,
          warehouseLoads:
            t.warehouseLoads ||
            t.warehouse_loads ||
            cached?.warehouseLoads ||
            undefined,
          salesman: t.salesman || cached?.salesman || "",
          salesmanId:
            t.salesman_id ||
            t.salesmanId ||
            cached?.salesmanId ||
            cached?.salesman_id ||
            undefined,
          salesmanPhone:
            String(
              t.salesmanPhone ??
                t.salesman_phone ??
                cached?.salesmanPhone ??
                cached?.salesman_phone ??
                "",
            ).trim() || undefined,
          date: t.date || cached?.date || todayISO(),
          warehouseId:
            t.warehouse_id || t.warehouseId || cached?.warehouseId || "",
          loaded,
          returned,
          draftReturned:
            status === "closed"
              ? {}
              : parseDictSafe(
                  t.draftReturned ??
                    t.draft_returned ??
                    cached?.draftReturned ??
                    cached?.draft_returned,
                ),
          billIds,
          status,
          driver: t.driver || cached?.driver || undefined,
          driverPhone:
            String(
              t.driverPhone ??
                t.driver_phone ??
                cached?.driverPhone ??
                cached?.driver_phone ??
                "",
            ).trim() || undefined,
          shortageReasons:
            t.shortageReasons ||
            t.shortage_reasons ||
            cached?.shortageReasons ||
            cached?.shortage_reasons ||
            undefined,
          updatedAt:
            t.updatedAt ||
            t.updated_at ||
            cached?.updatedAt ||
            cached?.updated_at ||
            undefined,
          cashShortBooked:
            Number(
              t.cashShortBooked ??
                t.cash_short_booked ??
                cached?.cashShortBooked ??
                cached?.cash_short_booked,
            ) || undefined,
          cashRecoveries:
            t.cashRecoveries ??
            t.cash_recoveries ??
            cached?.cashRecoveries ??
            cached?.cash_recoveries ??
            undefined,
          cashShortWrittenOff:
            (t.cashShortWrittenOff ??
              t.cash_short_written_off ??
              cached?.cashShortWrittenOff ??
              cached?.cash_short_written_off) === true || undefined,
          cashHandedIn: (() => {
            const v =
              t.cashHandedIn ??
              t.cash_handed_in ??
              cached?.cashHandedIn ??
              cached?.cash_handed_in;
            return v === null ||
              v === undefined ||
              v === "" ||
              !Number.isFinite(Number(v))
              ? undefined
              : Number(v);
          })(),
        };
      };

      const colTrips = await getCollectionData("trips");
      const localList: any[] = Array.isArray(colTrips) ? colTrips : [];

      if (isSupabaseAvailable()) {
        try {
          const PAGE = 1000;
          let remoteTrips: any[] = [];
          let error: any = null;
          for (let from = 0; from < 50000; from += PAGE) {
            const page: any = await withSupabaseTimeout(
              supabase
                .from("trips")
                .select("*")
                .order("id", { ascending: false })
                .range(from, from + PAGE - 1),
              3000,
            );
            if (page?.error) {
              error = page.error;
              break;
            }
            const rows = Array.isArray(page?.data) ? page.data : [];
            remoteTrips = remoteTrips.concat(rows);
            if (rows.length < PAGE) break;
          }

          if (!error && Array.isArray(remoteTrips)) {
            const tripMap = new Map<number, any>();
            localList.forEach((ct: any) => tripMap.set(Number(ct.id), ct));
            remoteTrips.forEach((t: any) => {
              const existing = tripMap.get(Number(t.id));
              tripMap.set(Number(t.id), mapTripRow(t, existing));
            });
            const deadTrips = await readTombstones("deleted_trip_ids");
            const merged = Array.from(tripMap.values())
              .filter((t: any) => !deadTrips.has(String(t.id)))
              .sort((a, b) => Number(b.id) - Number(a.id));
            await setCollectionData("trips", merged);
            return res.json({ success: true, data: merged });
          }
        } catch {
          // ignore remote error and fall back to local
        }
      }

      const fallbackMapped = localList.map((ct: any) => mapTripRow(ct));
      return res.json({ success: true, data: fallbackMapped });
    } catch (err: any) {
      console.error("Error in GET /api/trips:", err);
      const colTrips = (await getCollectionData("trips").catch(() => [])) || [];
      return res.json({ success: true, data: colTrips });
    }
  });

  app.post("/api/trips", async (req, res) => {
    try {
      const body = req.body;
      const tripPayload = formatTripForSupabase(body);

      const existing = await getCollectionData("trips");
      const list = Array.isArray(existing) ? existing : [];
      const storedTrip = list.find(
        (t: any) => Number(t.id) === Number(tripPayload.id),
      );
      if (tripStaleReopen(storedTrip, tripPayload)) {
        if (storedTrip?.status === "closed" && tripPayload?.status !== "closed") {
          return res
            .status(200)
            .json({ success: true, data: storedTrip, stale: true });
        }
        return res.status(409).json({
          error:
            "This trip was changed on another device. Refresh to see the latest copy.",
          code: "STALE",
          data: storedTrip,
        });
      }
      if (storedTrip && changedSinceBase(req, storedTrip)) {
        return res.status(409).json({
          error:
            "This trip was changed on another device. Refresh to see the latest copy.",
          code: "STALE",
          data: storedTrip,
        });
      }
      {
        const problem = await tripReturnProblem(storedTrip, {
          ...body,
          ...tripPayload,
          returned: body?.returned ?? tripPayload.returned,
          billIds: body?.billIds ?? tripPayload.bill_ids,
        });
        if (problem) {
          return res.status(422).json({
            error: `Trip cannot be closed: ${problem}`,
            code: "RETURN_EXCEEDS_EXPECTED",
          });
        }
      }
      if (
        (await readTombstones("deleted_trip_ids")).has(String(tripPayload.id))
      ) {
        const cur = await getCollectionData("deleted_trip_ids");
        await setCollectionData(
          "deleted_trip_ids",
          (Array.isArray(cur) ? cur : []).filter(
            (n: any) => String(n) !== String(tripPayload.id),
          ),
        );
      }
      const ownerId = body?.salesmanId ?? body?.salesman_id;
      const updated = [
        ownerId ? { ...tripPayload, salesmanId: String(ownerId) } : tripPayload,
        ...list.filter((t: any) => Number(t.id) !== Number(tripPayload.id)),
      ];
      await setCollectionData("trips", updated);

      if (isSupabaseAvailable()) {
        resilientUpsert(supabase, "trips", tripPayload, {
          onConflict: "id",
        })
          .then(({ error }) => {
            if (error) {
              console.warn(
                "Upsert to public.trips notice:",
                error.message ? error.message.slice(0, 150) : error,
              );
            }
          })
          .catch((err) => {
            console.warn(
              "Upsert to public.trips background error:",
              err?.message || err,
            );
          });
      }

      emitSyncEvent({
        topic: "trips",
        salesmanId: ownerId ? String(ownerId) : undefined,
      });

      return res.status(201).json({ success: true, data: tripPayload });
    } catch (err: any) {
      console.error("Error saving trip:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to save trip" });
    }
  });

  app.put("/api/trips", async (req, res) => {
    try {
      const rawTrips = Array.isArray(req.body?.trips)
        ? req.body.trips
        : Array.isArray(req.body?.data)
          ? req.body.data
          : Array.isArray(req.body)
            ? req.body
            : [];

      if (rawTrips.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const storedTrips = await getCollectionData("trips");
      const rejectedTrips: { id: any; error: string }[] = [];
      for (let i = rawTrips.length - 1; i >= 0; i--) {
        const t = rawTrips[i];
        const was = (Array.isArray(storedTrips) ? storedTrips : []).find(
          (x: any) => Number(x?.id) === Number(t?.id),
        );
        const problem = await tripReturnProblem(was, t);
        if (problem) {
          rejectedTrips.push({ id: t?.id, error: problem });
          rawTrips.splice(i, 1);
        }
      }
      const acceptedTrips = new Set<any>();
      await setCollectionData(
        "trips",
        mergeRecordLists(
          Array.isArray(storedTrips) ? storedTrips : [],
          rawTrips,
          await readTombstones("deleted_trip_ids"),
          tripStaleReopen,
          acceptedTrips,
        ),
      );

      const payloads = rawTrips
        .filter((t: any) => acceptedTrips.has(t))
        .map(formatTripForSupabase);
      if (isSupabaseAvailable() && payloads.length > 0) {
        resilientUpsert(supabase, "trips", payloads, {
          onConflict: "id",
        })
          .then(({ error }) => {
            if (error) {
              console.warn(
                "Bulk upsert to public.trips notice:",
                error.message ? error.message.slice(0, 150) : error,
              );
            }
          })
          .catch((err) => {
            console.warn(
              "Bulk upsert to public.trips background error:",
              err?.message || err,
            );
          });
      }

      emitSyncEvent({ topic: "trips" });
      return res.json({
        success: true,
        count: payloads.length,
        ...(rejectedTrips.length > 0 ? { rejected: rejectedTrips } : {}),
      });
    } catch (err: any) {
      console.error("Error in PUT /api/trips:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to bulk update trips" });
    }
  });

  app.delete("/api/trips/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);

      const colTrips = await getCollectionData("trips");
      if (Array.isArray(colTrips)) {
        const updated = colTrips.filter((t: any) => Number(t.id) !== id);
        await setCollectionData("trips", updated);
      }
      await addTombstone("deleted_trip_ids", String(id));

      if (isSupabaseAvailable()) {
        withSupabaseTimeout(
          supabase.from("trips").delete().eq("id", id),
          3000,
        ).catch(() => {});
      }

      emitSyncEvent({ topic: "trips" });
      emitSyncEvent({ topic: "deletions" });
      return res.json({ success: true, id });
    } catch (err: any) {
      console.error("Error deleting trip:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to delete trip" });
    }
  });

  /* =========================================================================
   * SALESMEN ROUTES (Supabase public.salesmen)
   * ========================================================================= */
  const PIN_RULE = /^\d{4,6}$/;

  const findSalesmanByPhone = async (phone: string) => {
    return findSalesmanRecord(phone);
  };

  app.get("/api/salesmen", async (_req, res) => {
    try {
      if (isSupabaseAvailable()) {
        const { data: list, error } = (await withSupabaseTimeout(
          supabase
            .from("salesmen")
            .select("*")
            .order("name", { ascending: true }),
          2500,
        )) as any;

        if (!error && Array.isArray(list) && list.length > 0) {
          void setCollectionData("salesmen", list).catch(() => {});
          return res.json({
            success: true,
            data: list.map(formatSalesmanResponse),
          });
        }
      }

      const colSalesmen = await getCollectionData("salesmen");
      const fallbackList = Array.isArray(colSalesmen) ? colSalesmen : [];
      return res.json({
        success: true,
        data: fallbackList.map(formatSalesmanResponse),
      });
    } catch (err: any) {
      console.error("Error in GET /api/salesmen:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to fetch salesmen", data: [] });
    }
  });

  app.post("/api/salesmen", async (req, res) => {
    try {
      const body = req.body || {};
      const name = String(body.name || "").trim();
      const phone = String(body.phone || "").trim();
      if (!name || !phone) {
        return res
          .status(400)
          .json({ error: "Name and phone are required fields" });
      }

      const pin = String(body.pin ?? "").trim();
      let pinHash = "";
      if (pin) {
        if (!PIN_RULE.test(pin)) {
          return res.status(400).json({ error: "PIN must be 4 to 6 digits." });
        }
        pinHash = await hashPinSecure(pin, authCfg.pinPepper);
      } else {
        const existingRow: any = await findSalesmanByPhone(phone);
        pinHash = String(existingRow?.pin_hash || existingRow?.pinHash || "");
        if (!pinHash) {
          return res.status(400).json({
            error: "A PIN (4 to 6 digits) is required for a new salesman.",
          });
        }
      }

      const salesmanPayload = {
        id: isValidUuid(body.id) ? body.id : undefined,
        name,
        phone,
        pin_hash: pinHash,
        active: body.active !== undefined ? Boolean(body.active) : true,
        default_vehicle: body.defaultVehicle || body.default_vehicle || "",
        updated_at: new Date().toISOString(),
      };

      let data: any = null;
      if (isSupabaseAvailable()) {
        const resUp = (await withSupabaseTimeout(
          supabase
            .from("salesmen")
            .upsert(salesmanPayload, { onConflict: "phone" })
            .select()
            .maybeSingle(),
          2500,
        )) as any;
        data = resUp?.data || null;
        if (resUp?.error) {
          console.warn("Supabase salesmen upsert warning:", resUp.error.message);
        }
      }

      const rowForMirror = data || {
        ...salesmanPayload,
        id: salesmanPayload.id || body.id || `salesman_${Date.now()}`,
      };
      const finalRecord = formatSalesmanResponse(rowForMirror);

      const existing = await getCollectionData("salesmen");
      const list = Array.isArray(existing) ? existing : [];
      const updated = [
        formatSalesmanStored(rowForMirror, pinHash),
        ...list.filter(
          (s: any) => s.id !== finalRecord.id && s.phone !== finalRecord.phone,
        ),
      ];
      await setCollectionData("salesmen", updated);
      emitSyncEvent({ topic: "settings", salesmanId: String(finalRecord.id) });

      return res.status(201).json({ success: true, data: finalRecord });
    } catch (err: any) {
      console.error("Error in POST /api/salesmen:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to create salesman" });
    }
  });

  app.put("/api/salesmen/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const body = req.body || {};

      const updatePayload: any = {
        updated_at: new Date().toISOString(),
      };
      if (body.name !== undefined)
        updatePayload.name = String(body.name).trim();
      if (body.phone !== undefined)
        updatePayload.phone = String(body.phone).trim();
      let newHash: string | undefined;
      const pin = String(body.pin ?? "").trim();
      if (pin) {
        if (!PIN_RULE.test(pin)) {
          return res.status(400).json({ error: "PIN must be 4 to 6 digits." });
        }
        newHash = await hashPinSecure(pin, authCfg.pinPepper);
        updatePayload.pin_hash = newHash;
      }
      if (body.active !== undefined)
        updatePayload.active = Boolean(body.active);
      if (body.defaultVehicle !== undefined)
        updatePayload.default_vehicle = body.defaultVehicle;
      if (body.default_vehicle !== undefined)
        updatePayload.default_vehicle = body.default_vehicle;

      let data: any = null;
      if (isSupabaseAvailable()) {
        const resUp = (await withSupabaseTimeout(
          supabase
            .from("salesmen")
            .update(updatePayload)
            .eq("id", id)
            .select()
            .maybeSingle(),
          2500,
        )) as any;
        data = resUp?.data || null;
        if (resUp?.error) {
          console.warn("Update salesmen in Supabase notice:", resUp.error.message);
        }
      }
      activeCache.delete(String(id));

      const existing = await getCollectionData("salesmen");
      let updatedRow: any = null;
      if (Array.isArray(existing)) {
        const updated = existing.map((s: any) => {
          if (s.id !== id) return s;
          const hash = newHash || String(s.pin_hash || s.pinHash || "");
          updatedRow = {
            ...s,
            ...(updatePayload.name !== undefined
              ? { name: updatePayload.name }
              : {}),
            ...(updatePayload.phone !== undefined
              ? { phone: updatePayload.phone }
              : {}),
            ...(updatePayload.active !== undefined
              ? { active: updatePayload.active }
              : {}),
            ...(updatePayload.default_vehicle !== undefined
              ? {
                  defaultVehicle: updatePayload.default_vehicle,
                  default_vehicle: updatePayload.default_vehicle,
                }
              : {}),
            pinHash: hash,
            pin_hash: hash,
            updatedAt: new Date().toISOString(),
          };
          return updatedRow;
        });
        await setCollectionData("salesmen", updated);
      }
      emitSyncEvent({ topic: "settings", salesmanId: String(id) });

      return res.json({
        success: true,
        data: data
          ? formatSalesmanResponse(data)
          : updatedRow
            ? formatSalesmanResponse(updatedRow)
            : null,
      });
    } catch (err: any) {
      console.error("Error updating salesman:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to update salesman" });
    }
  });

  app.delete("/api/salesmen/:id", async (req, res) => {
    try {
      const id = req.params.id;
      activeCache.delete(String(id));
      if (isSupabaseAvailable()) {
        await withSupabaseTimeout(
          supabase.from("salesmen").delete().eq("id", id),
          2500,
        ).catch(() => {});
      }

      const existing = await getCollectionData("salesmen");
      const target = Array.isArray(existing)
        ? existing.find((s: any) => String(s.id) === String(id))
        : undefined;
      if (Array.isArray(existing)) {
        const updated = existing.filter((s: any) => String(s.id) !== String(id));
        await setCollectionData("salesmen", updated);
      }

      const delEntry = {
        kind: "salesman",
        id: String(id),
        name: req.body?.name || target?.name || undefined,
        deletedAt: new Date().toISOString(),
        by: req.body?.by || "Admin",
      };
      const log = await readListFresh("deleted_records");
      if (
        !log.some(
          (r: any) => r?.kind === "salesman" && String(r.id) === String(id),
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
              key: `deleted:salesman:${id}`,
              data: delEntry,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "key" },
          ),
          2500,
        ).catch(() => {});
      }
      emitSyncEvent({ topic: "deletions" });
      emitSyncEvent({ topic: "settings" });

      return res.json({ success: true, id });
    } catch (err: any) {
      console.error("Error deleting salesman:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to delete salesman" });
    }
  });

  app.post("/api/salesmen/verify-pin", async (req, res) => {
    try {
      const body = req.body || {};
      const rawPhone = String(body.phone || "").trim();
      const pin = String(body.pin || "").trim();
      const pinHash = String(body.pinHash || "").trim();

      if (!rawPhone || (!pin && !pinHash)) {
        return res
          .status(400)
          .json({ success: false, error: "Phone number and PIN are required." });
      }

      const target = await findSalesmanRecord(rawPhone);
      if (!target) {
        return res.status(404).json({
          success: false,
          error: "Salesman not found with this mobile number.",
        });
      }

      if (target.active === false) {
        return res.status(403).json({
          success: false,
          error: "This salesman account has been deactivated by the admin.",
        });
      }

      const storedHash = String(target.pin_hash || target.pinHash || "");
      if (!storedHash) {
        return res.status(400).json({
          success: false,
          error: "No PIN has been configured for this salesman yet.",
        });
      }

      let pinValid = false;
      if (pin) {
        const check = await verifyStoredPin(
          pin,
          storedHash,
          authCfg.pinPepper,
          hashPin,
        );
        pinValid = check.ok;
        if (check.needsUpgrade) void upgradePinHash(target, pin);
      } else if (pinHash) {
        if (storedHash.toLowerCase() === pinHash.toLowerCase()) {
          pinValid = true;
        }
      }

      if (!pinValid) {
        return res
          .status(401)
          .json({ success: false, error: "Incorrect PIN. Please try again." });
      }

      return res.json({
        success: true,
        salesman: formatSalesmanResponse(target),
      });
    } catch (err: any) {
      console.error("Error verifying salesman PIN:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "PIN verification failed.",
      });
    }
  });
}
