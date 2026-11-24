import React from "react";
import { deleteTripFromSupabase, pushTripToSupabase } from "../../lib/supabase";
import {
  type AuthUser,
  type Bill,
  type InventoryDisposition,
  type Product,
  type Salesman,
  type Trip,
  type TripCashRecovery,
  type TripShortageInput,
  type TripShortageReason,
  type Warehouse,
  TRIP_WRITEOFF_REASONS,
} from "../../types";
import {
  attachableBillsForTrip,
  billBelongsToTrip,
  normalizeTrip,
  tripCashDue,
} from "../../utils/billing";
import { todayISO } from "../../utils/dateLocal";
import { hasUnsavedBills, saveTrips } from "../../utils/storage";
import { tripPrimaryWarehouseId } from "../../utils/tripLoads";
import { describeOverReturn, findOverReturns } from "../../utils/tripReturns";
import { cloud, cloudFetch, reserveDocNumber } from "../ledgerHelpers";
import { calcFindTripOfBill } from "../ledgerStockCalculations";

export interface UseTripActionsParams {
  trips: Trip[];
  setTrips: (u: Trip[] | ((prev: Trip[]) => Trip[])) => void;
  deadTripIdsRef: React.MutableRefObject<Set<number>>;
  bills: Bill[];
  allBillsRef: React.MutableRefObject<Bill[]>;
  setBills: (u: Bill[] | ((prev: Bill[]) => Bill[])) => void;
  products: Product[];
  warehouses: Warehouse[];
  defaultWarehouse: Warehouse | undefined;
  salesmen: Salesman[];
  currentUser: AuthUser | null;
  inventoryDispositions: InventoryDisposition[];
  addInventoryDisposition: (
    d: Omit<InventoryDisposition, "id" | "createdAt" | "costValue">,
  ) => { disposition: InventoryDisposition } | { error: string };
  updateInventoryDisposition: (
    id: string,
    updates: Partial<InventoryDisposition>,
  ) => void;
  deleteInventoryDisposition: (id: string) => void;
  notify: (message: string) => void;
}

export function useTripActions({
  trips,
  setTrips,
  deadTripIdsRef,
  bills,
  allBillsRef,
  setBills,
  products,
  warehouses,
  defaultWarehouse,
  salesmen,
  currentUser,
  inventoryDispositions,
  addInventoryDisposition,
  updateInventoryDisposition,
  deleteInventoryDisposition,
  notify,
}: UseTripActionsParams) {
  function tripOfBill(b: Bill): Trip | null {
    return calcFindTripOfBill(b, trips);
  }

  function addTrip(
    vehicle: string,
    date: string,
    loaded: Record<number, number>,
    warehouseId?: string,
    initialBillIds?: number[],
    salesman?: string,
    route?: string,
    salesmanId?: string,
    warehouseLoads?: Record<string, Record<number, number>>,
    driver?: string,
    driverPhone?: string,
    salesmanPhone?: string,
  ): Trip {
    const highestUsed = Math.max(
      0,
      ...trips.map((t) => Number(t.id) || 0),
      ...Array.from(deadTripIdsRef.current),
    );
    const nextId = reserveDocNumber("trip", highestUsed);
    const resolvedSalesmanId =
      salesmanId ||
      (currentUser?.role === "salesman" ? currentUser.id : undefined) ||
      (salesman
        ? salesmen.find((s) => s.name === salesman || s.id === salesman)?.id
        : undefined);
    const matchedSalesmanObj = resolvedSalesmanId
      ? salesmen.find((s) => s.id === resolvedSalesmanId)
      : null;
    const resolvedSalesmanName =
      salesman ||
      matchedSalesmanObj?.name ||
      (currentUser?.role === "salesman" ? currentUser.name : undefined);
    const resolvedSalesmanPhone =
      salesmanPhone?.trim() ||
      matchedSalesmanObj?.phone ||
      undefined;

    const validWhIds = new Set(warehouses.map((w) => w.id));
    const explicitWh =
      warehouseId && (validWhIds.size === 0 || validWhIds.has(warehouseId))
        ? warehouseId
        : "";
    const resolvedWarehouseId =
      explicitWh ||
      tripPrimaryWarehouseId({ warehouseId, warehouseLoads }, validWhIds) ||
      defaultWarehouse?.id ||
      (warehouses.length > 0 ? warehouses[0].id : "");

    const resolvedWarehouseLoads =
      warehouseLoads && Object.keys(warehouseLoads).length > 0
        ? warehouseLoads
        : resolvedWarehouseId
          ? { [resolvedWarehouseId]: loaded }
          : undefined;

    const newTrip: Trip = {
      id: nextId,
      vehicle,
      salesman: resolvedSalesmanName || undefined,
      salesmanId: resolvedSalesmanId || undefined,
      salesmanPhone: resolvedSalesmanPhone,
      route: route || undefined,
      driver: driver?.trim() || undefined,
      driverPhone: driverPhone?.trim() || undefined,
      date,
      warehouseId: resolvedWarehouseId || "",
      loaded,
      warehouseLoads: resolvedWarehouseLoads,
      returned: {},
      billIds: initialBillIds || [],
      status: "out",
      updatedAt: new Date().toISOString(),
    };
    const updatedTrips = [newTrip, ...trips.filter((t) => Number(t.id) !== Number(newTrip.id))];
    setTrips(updatedTrips);
    saveTrips(updatedTrips).catch(() => {});
    cloud("pushTripToSupabase", pushTripToSupabase(newTrip));
    cloudFetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTrip),
    });
    return newTrip;
  }

  function tripAttachProblem(trip: Trip, bill: Bill): string | null {
    if (billBelongsToTrip(trip, bill)) return null;
    if (trip.status === "closed") {
      return `Trip #${trip.id} is closed, so Bill #${bill.id} cannot be added to it now (its stock count is final). Reopen the trip first.`;
    }
    const listedElsewhere = trips.find(
      (t) =>
        Number(t.id) !== Number(trip.id) &&
        (t.billIds || []).map(Number).includes(Number(bill.id)),
    );
    const ownerId =
      bill.tripId != null && Number(bill.tripId) > 0 && Number(bill.tripId) !== Number(trip.id)
        ? Number(bill.tripId)
        : listedElsewhere
          ? Number(listedElsewhere.id)
          : null;
    if (ownerId != null) {
      return `Bill #${bill.id} is already on Trip #${ownerId}. Remove it from that trip first.`;
    }
    const sold: Record<number, number> = {};
    for (const b of bills) {
      if (!billBelongsToTrip(trip, b)) continue;
      for (const it of b.items || []) {
        const pid = Number(it.productId);
        sold[pid] = (sold[pid] || 0) + (Number(it.qty) || 0);
      }
    }
    const add: Record<number, number> = {};
    for (const it of bill.items || []) {
      const pid = Number(it.productId);
      add[pid] = (add[pid] || 0) + (Number(it.qty) || 0);
    }
    for (const [pidStr, q] of Object.entries(add)) {
      const pid = Number(pidStr);
      const loaded = Number(trip.loaded?.[pid] ?? 0) || 0;
      if ((sold[pid] || 0) + q > loaded) {
        const nm = products.find((x) => x.id === pid)?.name || `Product #${pid}`;
        return `Bill #${bill.id}: ${nm} would be ${(sold[pid] || 0) + q} billed on a load of ${loaded}. Increase the trip's load first.`;
      }
    }
    return null;
  }

  function detachProblem(trip: Trip, bill: Bill | undefined): string | null {
    if (bill && bill.tripId != null && Number(bill.tripId) === Number(trip.id)) {
      return `Bill #${bill.id} was raised on this trip, so it cannot be detached. Edit or cancel the bill instead.`;
    }
    return null;
  }

  function toggleBillAssignment(tripId: number, billId: number): string | null {
    const currentTrip = trips.find((t) => t.id === tripId);
    if (!currentTrip) return null;
    const bill = bills.find((b) => Number(b.id) === Number(billId));
    const listed = currentTrip.billIds.includes(billId);
    const problem = listed
      ? detachProblem(currentTrip, bill)
      : bill
        ? tripAttachProblem(currentTrip, bill)
        : null;
    if (problem) {
      notify(problem);
      return problem;
    }
    const updatedTrip: Trip = {
      ...currentTrip,
      billIds: listed
        ? currentTrip.billIds.filter((id) => id !== billId)
        : [...currentTrip.billIds, billId],
      updatedAt: new Date().toISOString(),
    };
    setTrips((ts) => ts.map((t) => (t.id === tripId ? updatedTrip : t)));
    cloud("pushTripToSupabase", pushTripToSupabase(updatedTrip));
    cloudFetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedTrip),
    });
    return null;
  }

  function unassignBillFromTrip(tripId: number, billId: number) {
    const currentTrip = trips.find((t) => t.id === tripId);
    if (!currentTrip) return;
    const problem = detachProblem(
      currentTrip,
      bills.find((b) => Number(b.id) === Number(billId)),
    );
    if (problem) {
      notify(problem);
      return;
    }
    const updatedTrip: Trip = {
      ...currentTrip,
      billIds: currentTrip.billIds.filter((id) => id !== billId),
      updatedAt: new Date().toISOString(),
    };
    setTrips((ts) => ts.map((t) => (t.id === tripId ? updatedTrip : t)));
    cloud("pushTripToSupabase", pushTripToSupabase(updatedTrip));
    cloudFetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedTrip),
    });
  }

  function autoAssignTripBills(tripId: number): number {
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return 0;
    const matchingBills = attachableBillsForTrip(trip, bills, trips);
    let working: Trip = trip;
    const skipped: string[] = [];
    for (const b of matchingBills) {
      if (working.billIds.map(Number).includes(Number(b.id))) continue;
      const problem = tripAttachProblem(working, b);
      if (problem) {
        skipped.push(problem);
        continue;
      }
      working = { ...working, billIds: [...working.billIds, b.id] };
    }
    const addedCount = working.billIds.length - trip.billIds.length;
    if (skipped.length > 0) {
      notify(
        `${skipped.length} bill(s) were not attached:\n` +
          skipped.slice(0, 5).map((m) => `• ${m}`).join("\n"),
      );
    }
    if (addedCount > 0) {
      const updatedTrip: Trip = { ...working, updatedAt: new Date().toISOString() };
      setTrips((ts) => ts.map((t) => (t.id === tripId ? updatedTrip : t)));
      cloud("pushTripToSupabase", pushTripToSupabase(updatedTrip));
      cloudFetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTrip),
      });
    }
    return addedCount;
  }

  function applyShortageReasons(
    trip: Trip,
    returned: Record<number, number>,
    input: Record<number, TripShortageInput>,
  ): Trip["shortageReasons"] {
    const result: NonNullable<Trip["shortageReasons"]> = {};
    const prior = trip.shortageReasons || {};
    const sold: Record<number, number> = {};
    for (const b of bills) {
      if (!billBelongsToTrip(trip, b)) continue;
      for (const it of b.items || []) {
        const pid = Number(it.productId);
        sold[pid] = (sold[pid] || 0) + (Number(it.qty) || 0);
      }
    }
    const failures: string[] = [];
    const reasonText: Record<string, string> = {
      broken: "Broken crates found at trip close",
      sold_not_billed: "Crates sold on the van but not billed (found at trip close)",
      other: "Crates missing at trip close (reason in notes)",
    };
    const noteText: Record<string, string> = {
      broken: "broken crates",
      sold_not_billed: "sold but not billed",
      other: "missing crates",
    };

    const syncWriteOff = (
      pid: number,
      reason: TripShortageReason | undefined,
      qty: number,
      note: string | undefined,
      beforeId: string | undefined,
    ): string | undefined => {
      const exists = !!beforeId && inventoryDispositions.some((d) => d.id === beforeId);
      if (!reason || qty <= 0 || !TRIP_WRITEOFF_REASONS.includes(reason)) {
        if (beforeId && exists) deleteInventoryDisposition(beforeId);
        return undefined;
      }
      const product = products.find((p) => Number(p.id) === pid);
      const cost = Number((product as any)?.landedCostPerCrate) || Number(product?.cost) || 0;
      const notes = note || `Trip #${trip.id} (${trip.vehicle}): ${noteText[reason]}`;
      if (exists) {
        updateInventoryDisposition(beforeId!, {
          quantity: qty,
          costPerUnit: cost,
          costValue: cost * qty,
          reason: reasonText[reason],
          notes,
        });
        return beforeId;
      }
      let whId = trip.warehouseId || defaultWarehouse?.id || warehouses[0]?.id || "";
      let best = -1;
      for (const [wh, m] of Object.entries(trip.warehouseLoads || {})) {
        const q = Number((m as Record<number, number>)[pid]) || 0;
        if (q > best) {
          best = q;
          whId = wh;
        }
      }
      const res = addInventoryDisposition({
        dispositionType: "damage_writeoff",
        productId: pid,
        productName: product?.name,
        warehouseId: whId,
        warehouseName: warehouses.find((w) => w.id === whId)?.name,
        quantity: qty,
        unit: "case",
        costPerUnit: cost,
        compensationStatus: "not_applicable",
        reason: reasonText[reason],
        notes,
        referenceDocNo: `TRIP-${trip.id}`,
        salesmanId: trip.salesmanId,
        salesmanName: trip.salesman,
        eventDate: todayISO(),
        createdBy: currentUser?.name || "Admin",
      } as any);
      if ("disposition" in res) return res.disposition.id;
      failures.push(`${product?.name || `Product #${pid}`}: ${(res as { error: string }).error}`);
      return undefined;
    };

    const pids = new Set<number>([
      ...Object.keys(input).map(Number),
      ...Object.keys(prior).map(Number),
    ]);
    for (const pid of pids) {
      const loaded = Number(trip.loaded?.[pid] ?? 0) || 0;
      const qty = loaded - (sold[pid] || 0) - (Number(returned[pid]) || 0);
      const entry = qty > 0 ? input[pid] : undefined;
      const before = prior[pid];

      if (!entry) {
        syncWriteOff(pid, undefined, 0, undefined, before?.dispositionId);
        syncWriteOff(pid, undefined, 0, undefined, before?.missing?.dispositionId);
        continue;
      }

      const damaged = entry.reason === "broken" ? qty : Math.min(qty, Math.max(0, Math.floor(Number(entry.damaged) || 0)));
      const missingQty = qty - damaged;
      const note = entry.note?.trim() || undefined;

      if (damaged > 0) {
        const dmgNote = entry.reason === "broken" ? note : undefined;
        const dmgId = syncWriteOff(pid, "broken", damaged, dmgNote, before?.reason === "broken" ? before?.dispositionId : undefined);
        if (before && before.reason !== "broken") syncWriteOff(pid, undefined, 0, undefined, before.dispositionId);
        let missing: NonNullable<Trip["shortageReasons"]>[number]["missing"];
        if (missingQty > 0 && entry.reason !== "broken") {
          const mReason = entry.reason as Exclude<TripShortageReason, "broken">;
          const mId = syncWriteOff(pid, mReason, missingQty, note, before?.missing?.dispositionId);
          missing = { reason: mReason, qty: missingQty, note, dispositionId: mId };
        } else {
          syncWriteOff(pid, undefined, 0, undefined, before?.missing?.dispositionId);
        }
        result[pid] = {
          reason: "broken",
          qty: damaged,
          note: dmgNote,
          dispositionId: dmgId,
          ...(missing ? { missing } : {}),
        };
      } else {
        const reason = entry.reason;
        const id = syncWriteOff(pid, reason, qty, note, before?.reason === reason ? before?.dispositionId : undefined);
        if (before && before.reason !== reason) syncWriteOff(pid, undefined, 0, undefined, before.dispositionId);
        syncWriteOff(pid, undefined, 0, undefined, before?.missing?.dispositionId);
        result[pid] = { reason, qty, note, dispositionId: id };
      }
    }
    if (failures.length > 0) {
      notify(
        "These crates could not be written off in stock, record them under Dispositions:\n" +
          failures.map((m) => `• ${m}`).join("\n"),
      );
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  function saveReturn(
    tripId: number,
    returned: Record<number, number>,
    shortageReasons?: Record<number, TripShortageInput>,
    cashHandedIn?: number | null,
    cashShortBooked?: number | null,
  ): { ok: true } | { ok: false; error: string } {
    const currentTrip = trips.find((t) => Number(t.id) === Number(tripId));
    if (currentTrip) {
      const over = findOverReturns(currentTrip, allBillsRef.current || bills, returned);
      if (over.length > 0) {
        return {
          ok: false,
          error:
            over
              .map((o) => describeOverReturn(o, products.find((pr) => Number(pr.id) === o.productId)?.name))
              .join(" ") + " Correct the count, or edit the load / bills first.",
        };
      }
      const tripBillIds = (allBillsRef.current || bills)
        .filter((b) => billBelongsToTrip(currentTrip, b))
        .map((b) => Number(b.id));
      if (hasUnsavedBills(tripBillIds)) {
        return {
          ok: false,
          error:
            "Some bills of this trip are still being saved to the cloud. Wait for the \"waiting to upload\" notice to clear, then close the trip.",
        };
      }
    }
    const reasons =
      currentTrip && shortageReasons
        ? applyShortageReasons(currentTrip, returned, shortageReasons)
        : currentTrip?.shortageReasons;
    const updatedTrip: Trip | null = currentTrip
      ? normalizeTrip({
          ...currentTrip,
          returned,
          draftReturned: {},
          status: "closed",
          shortageReasons: reasons,
          ...(cashHandedIn !== undefined ? { cashHandedIn: cashHandedIn ?? undefined } : {}),
          ...(cashShortBooked !== undefined
            ? { cashShortBooked: cashShortBooked && cashShortBooked > 0 ? cashShortBooked : undefined }
            : {}),
          updatedAt: new Date().toISOString(),
        })
      : null;
    if (updatedTrip)
      setTrips((ts) =>
        ts.map((t) => (Number(t.id) === Number(tripId) ? updatedTrip : t)),
      );
    if (updatedTrip) {
      cloud("pushTripToSupabase", pushTripToSupabase(updatedTrip));
      cloudFetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedTrip),
      });
    }
    return { ok: true };
  }

  function saveReturnDraft(tripId: number, returned: Record<number, number>, cashHandedIn?: number | null) {
    const currentTrip = trips.find((t) => Number(t.id) === Number(tripId));
    if (!currentTrip || currentTrip.status === "closed") return;
    const updatedTrip = normalizeTrip({
      ...currentTrip,
      draftReturned: returned,
      ...(cashHandedIn !== undefined ? { cashHandedIn: cashHandedIn ?? undefined } : {}),
      updatedAt: new Date().toISOString(),
    });
    setTrips((ts) => ts.map((t) => (Number(t.id) === Number(tripId) ? updatedTrip : t)));
    cloud("pushTripToSupabase", pushTripToSupabase(updatedTrip));
    cloudFetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedTrip),
    });
  }

  function commitTripChange(updatedTrip: Trip) {
    const stamped = normalizeTrip({ ...updatedTrip, updatedAt: new Date().toISOString() });
    setTrips((ts) => ts.map((t) => (Number(t.id) === Number(stamped.id) ? stamped : t)));
    cloud("pushTripToSupabase", pushTripToSupabase(stamped));
    cloudFetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stamped),
    });
  }

  function recordTripCashRecovery(tripId: number, amount: number, note?: string, date?: string): boolean {
    const cur = trips.find((t) => Number(t.id) === Number(tripId));
    const amt = Math.round((Number(amount) || 0) * 100) / 100;
    if (!cur || cur.status !== "closed" || amt <= 0) return false;
    if (amt > tripCashDue(cur) + 0.005) return false;
    const entry: TripCashRecovery = {
      id: `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      date: (date || todayISO()).slice(0, 10),
      amount: amt,
      ...(note && note.trim() ? { note: note.trim() } : {}),
    };
    commitTripChange({ ...cur, cashRecoveries: [...(cur.cashRecoveries || []), entry] });
    return true;
  }

  function writeOffTripCashShort(tripId: number) {
    const cur = trips.find((t) => Number(t.id) === Number(tripId));
    if (!cur || tripCashDue(cur) <= 0) return;
    commitTripChange({ ...cur, cashShortWrittenOff: true });
  }

  function withdrawTripWriteOffs(trip: Trip): Trip["shortageReasons"] {
    if (!trip.shortageReasons) return trip.shortageReasons;
    const next: NonNullable<Trip["shortageReasons"]> = {};
    for (const [pid, entry] of Object.entries(trip.shortageReasons)) {
      if (entry.dispositionId && inventoryDispositions.some((d) => d.id === entry.dispositionId)) {
        deleteInventoryDisposition(entry.dispositionId);
      }
      const mId = entry.missing?.dispositionId;
      if (mId && inventoryDispositions.some((d) => d.id === mId)) deleteInventoryDisposition(mId);
      next[Number(pid)] = {
        ...entry,
        dispositionId: undefined,
        ...(entry.missing ? { missing: { ...entry.missing, dispositionId: undefined } } : {}),
      };
    }
    return next;
  }

  function reopenTrip(tripId: number) {
    const currentTrip = trips.find((t) => Number(t.id) === Number(tripId));
    if (!currentTrip) return;
    const updatedTrip = normalizeTrip({
      ...currentTrip,
      status: "out",
      returned: {},
      draftReturned: currentTrip.returned || {},
      shortageReasons: withdrawTripWriteOffs(currentTrip),
      updatedAt: new Date().toISOString(),
    });
    setTrips((ts) => ts.map((t) => (Number(t.id) === Number(tripId) ? updatedTrip : t)));
    cloud("pushTripToSupabase", pushTripToSupabase(updatedTrip));
    cloudFetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedTrip),
    });
  }

  function updateTrip(updated: Trip) {
    const existing = trips.find((t) => Number(t.id) === Number(updated.id));
    const reopening = existing?.status === "closed" && updated.status !== "closed";
    const base: Trip = reopening
      ? {
          ...updated,
          draftReturned:
            updated.returned && Object.keys(updated.returned).length > 0
              ? updated.returned
              : existing!.returned || {},
          shortageReasons: withdrawTripWriteOffs(existing!),
        }
      : updated;
    const normalized = normalizeTrip({ ...base, updatedAt: new Date().toISOString() });
    setTrips((ts) =>
      ts.map((t) => (Number(t.id) === Number(normalized.id) ? normalized : t)),
    );
    cloud("pushTripToSupabase", pushTripToSupabase(normalized));
    cloudFetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalized),
    });
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("mrwater_ledger_sync");
        bc.postMessage({ type: "REFRESH_DATA" });
        bc.close();
      }
    } catch {}
  }

  function deleteTrip(tripId: number) {
    const gone = trips.find((t) => Number(t.id) === Number(tripId));
    if (gone) withdrawTripWriteOffs(gone);
    setBills((prev) =>
      prev.some((b) => b.tripId != null && Number(b.tripId) === Number(tripId))
        ? prev.map((b) =>
            b.tripId != null && Number(b.tripId) === Number(tripId)
              ? { ...b, tripId: undefined, updatedAt: new Date().toISOString() }
              : b,
          )
        : prev,
    );
    deadTripIdsRef.current.add(Number(tripId));
    setTrips((ts) => ts.filter((t) => Number(t.id) !== Number(tripId)));
    cloud("deleteTripFromSupabase", deleteTripFromSupabase(tripId));
    cloudFetch(`/api/trips/${tripId}`, { method: "DELETE" });
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("mrwater_ledger_sync");
        bc.postMessage({ type: "REFRESH_DATA" });
        bc.close();
      }
    } catch {}
  }

  return {
    tripOfBill,
    addTrip,
    toggleBillAssignment,
    unassignBillFromTrip,
    autoAssignTripBills,
    saveReturn,
    saveReturnDraft,
    recordTripCashRecovery,
    writeOffTripCashShort,
    reopenTrip,
    updateTrip,
    deleteTrip,
  };
}
