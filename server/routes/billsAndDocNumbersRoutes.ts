import type { Express } from "express";
import { applyBillExtra } from "../../src/utils/billExtra";
import {
  areSameBillIdentity,
  collectCancelledRestores,
  incomingBillWins,
  mergeBillListsWithConflictResolution,
} from "../../src/utils/billMerge";
import { parseGstSeriesSeq } from "../../src/utils/invoiceCommon";
import {
  formatBillForSupabase,
  readTombstones,
  resilientUpsert,
} from "../dbHelpers";
import {
  flushDiskCollectionsNow,
  getCollectionData,
  inMemoryCollections,
  isSupabaseAvailable,
  setCollectionData,
  supabase,
  updateInventoryItemStock,
  withSupabaseTimeout,
} from "../supabaseStore";
import {
  loadServerValidationContext,
  validateBillAgainstLedger,
} from "../billValidation";
import { emitSyncEvent } from "../syncEvents";

export function registerBillsAndDocNumbersRoutes(app: Express) {
  // 1. BILLS & ORDERS ROUTES (Supabase public.bills and inventory adjustments)
  app.get(["/api/bills", "/api/orders"], async (_req, res) => {
    try {
      // 1. Check local orders collection / disk cache first (instant local-first resolution)
      const colOrdersRaw = await getCollectionData("orders");
      const deadBillIds = new Set<number>(
        Array.from(await readTombstones("deleted_bill_ids")).map(Number),
      );
      // Cancelled bills must be preserved for GST series continuity (GSTR-1 Table 13); only truly deleted active bills are filtered out
      const colOrders = Array.isArray(colOrdersRaw)
        ? colOrdersRaw
            .filter(
              (o: any) =>
                o?.status === "cancelled" || !deadBillIds.has(Number(o?.id)),
            )
            .map((o: any) =>
              o && o.amountPaid === undefined && o.amount_paid !== undefined
                ? applyBillExtra(
                    {
                      ...o,
                      amountPaid: Number(o.amount_paid) || 0,
                      warehouseId: o.warehouseId ?? o.warehouse_id ?? "",
                      salesmanId: o.salesmanId ?? o.salesman_id ?? undefined,
                    },
                    o.extra,
                  )
                : o,
            )
        : colOrdersRaw;
      if (Array.isArray(colOrders) && colOrders.length > 0) {
        return res.json({ success: true, data: colOrders });
      }

      // 2. If local cache is empty and Supabase is available, try public.bills with strict timeout
      if (isSupabaseAvailable()) {
        const { data: bills, error: billsErr } = await withSupabaseTimeout(
          supabase
            .from("bills")
            .select("*")
            .order("id", { ascending: false }),
          3000,
        );

        if (!billsErr && Array.isArray(bills) && bills.length > 0) {
          const colPayments = await getCollectionData("payments");
          const payMap = new Map<number, number>();
          if (Array.isArray(colPayments)) {
            colPayments.forEach((p: any) => {
              if (p.billId) {
                const bId = Number(p.billId);
                payMap.set(
                  bId,
                  (payMap.get(bId) || 0) + Number(p.amount || 0),
                );
              }
            });
          }

          const mappedAll = bills.map((b: any) => {
            const rawPaid = Number(
              b.amount_paid !== undefined ? b.amount_paid : b.amountPaid || 0,
            );
            const payRecorded = payMap.get(Number(b.id)) || 0;
            const totalAmt = Number(b.total || 0);
            const amountPaid = Math.min(
              totalAmt,
              Math.max(rawPaid, payRecorded),
            );

            return applyBillExtra(
              {
                id: Number(b.id),
                retailer: b.retailer,
                supplyType: b.supply_type === "B2B" ? "B2B" : "B2C",
                customerGstin: b.customer_gstin || undefined,
                isRetrospective: b.is_retrospective === true,
                cancelledReturns:
                  Array.isArray(b.cancelled_returns) &&
                  b.cancelled_returns.length > 0
                    ? b.cancelled_returns
                    : undefined,
                editHistory:
                  Array.isArray(b.edit_history) && b.edit_history.length > 0
                    ? b.edit_history
                    : undefined,
                phone: b.phone || "",
                date: b.date,
                subtotal: Number(b.subtotal || 0),
                cgst: Number(b.cgst || 0),
                sgst: Number(b.sgst || 0),
                total: totalAmt,
                discount: Number(b.discount || 0),
                amountPaid,
                status: b.cancellation ? "cancelled" : undefined,
                cancellation: b.cancellation || undefined,
                returns:
                  Array.isArray(b.returns) && b.returns.length > 0
                    ? b.returns
                    : undefined,
                warehouseId: b.warehouse_id || "",
                salesman: b.salesman || "",
                salesmanId: b.salesman_id || undefined,
                items: Array.isArray(b.items) ? b.items : [],
              },
              b.extra,
            );
          });
          const mapped = mappedAll.filter(
            (o: any) =>
              o?.status === "cancelled" ||
              Boolean(o?.cancellation) ||
              !deadBillIds.has(Number(o?.id)),
          );

          await setCollectionData("orders", mapped);
          return res.json({ success: true, data: mapped });
        }
      }

      return res.json({
        success: true,
        data: Array.isArray(colOrders) ? colOrders : [],
      });
    } catch (err: any) {
      console.error("Error in GET /api/bills:", err);
      const fallback = (await getCollectionData("orders").catch(() => [])) || [];
      return res.json({ success: true, data: fallback });
    }
  });

  app.post(
    ["/api/bills", "/api/orders", "/api/create_order_with_schemes"],
    async (req, res) => {
      try {
        const body = req.body;
        const billPayload = formatBillForSupabase(body);
        if (!Number.isFinite(billPayload.id)) {
          return res.status(400).json({ error: "Invalid bill id" });
        }

        const existing = await getCollectionData("orders");
        const list = Array.isArray(existing) ? existing : [];

        // If an invoice already exists at this numeric ID: check identity first!
        // Same logical bill -> update normally (stale guard). Different offline bill -> preserve BOTH.
        const storedBill = list.find(
          (o: any) => Number(o.id) === billPayload.id,
        );
        let workingBody = body;
        let workingPayload = billPayload;
        let reassignedFromId: number | undefined;
        let flaggedStoredBill: any | undefined;

        let sameIdentity = false;
        if (storedBill) {
          if (areSameBillIdentity(storedBill, body)) {
            sameIdentity = true;
            if (!incomingBillWins(storedBill, body)) {
              return res
                .status(200)
                .json({ success: true, data: storedBill, stale: true });
            }
          } else {
            const deadIds = Array.from(
              await readTombstones("deleted_bill_ids"),
            ).map(Number);
            let maxId = Math.max(100, billPayload.id);
            for (const o of list) {
              const n = Number(o?.id);
              if (Number.isFinite(n) && n > maxId) maxId = n;
            }
            for (const d of deadIds) {
              if (Number.isFinite(d) && d > maxId) maxId = d;
            }
            const newId = maxId + 1;
            reassignedFromId = billPayload.id;
            const preservedDocNo =
              String(body.docNo || "").trim() ||
              (body.docSeries === "non_gst" || body.gstExclude === true
                ? `NG-${billPayload.id}`
                : `INV-${billPayload.id}`);
            const storedDocNo =
              String(storedBill.docNo || storedBill?.extra?.docNo || "").trim() ||
              (storedBill.docSeries === "non_gst" || storedBill.gstExclude === true
                ? `NG-${storedBill.id}`
                : `INV-${storedBill.id}`);
            const sameDisplayDocNo =
              preservedDocNo.toLowerCase() === storedDocNo.toLowerCase();
            const conflictNote = sameDisplayDocNo
              ? `Offline collision with #${billPayload.id} (${storedBill.retailer || "another party"}). Assigned internal ID #${newId}; update invoice number to restore GST uniqueness.`
              : undefined;
            workingBody = {
              ...body,
              id: newId,
              docNo: preservedDocNo,
              collidedFromId: billPayload.id,
              duplicateNumberConflict: sameDisplayDocNo,
              ...(conflictNote ? { conflictNote } : {}),
              updatedAt: new Date().toISOString(),
            };
            workingPayload = formatBillForSupabase(workingBody);

            if (sameDisplayDocNo && !storedBill.duplicateNumberConflict) {
              flaggedStoredBill = {
                ...storedBill,
                duplicateNumberConflict: true,
                conflictNote:
                  storedBill.conflictNote ||
                  `Offline number #${billPayload.id} was also issued on another device (${body.retailer || "another party"}).`,
              };
            }
          }
        }

        // Enforce stock availability and customer credit limit on the server (parity with client checks).
        const validationCtx = await loadServerValidationContext();
        const validation = validateBillAgainstLedger(workingBody, {
          ...validationCtx,
          bills: list,
          existingBill: sameIdentity ? storedBill : null,
        });
        if (!validation.ok) {
          return res.status(validation.status).json({
            error: validation.error,
            code: validation.code,
            ...(validation.shortfalls
              ? { shortfalls: validation.shortfalls }
              : {}),
          });
        }

        // Bump doc_counters high-water marks (bill + gst_bill / non_gst_bill) after validation succeeds
        try {
          const counters =
            inMemoryCollections["doc_counters"] ||
            (await getCollectionData("doc_counters")) ||
            {};
          const baseCounters =
            typeof counters === "object" && !Array.isArray(counters)
              ? counters
              : {};
          const nextCounters: Record<string, number> = {
            ...baseCounters,
            bill: Math.max(Number(baseCounters.bill) || 0, workingPayload.id),
          };
          const billDocNo = String(workingBody.docNo || workingBody?.extra?.docNo || "").trim();
          const isNonGstDoc =
            workingBody.docSeries === "non_gst" ||
            workingBody.gstExclude === true ||
            /^NG-/i.test(billDocNo);
          if (isNonGstDoc) {
            const ngMatch = billDocNo.match(/^NG-(\d+)$/i);
            if (ngMatch) {
              nextCounters.non_gst_bill = Math.max(
                Number(baseCounters.non_gst_bill) || 0,
                Number(ngMatch[1]) || 0,
              );
            }
          } else {
            const billingSettings = await getCollectionData("billing_settings").catch(() => null);
            const gstSeq = parseGstSeriesSeq(
              { ...workingBody, id: workingPayload.id, docNo: billDocNo || undefined },
              billingSettings,
            );
            if (gstSeq > 0) {
              nextCounters.gst_bill = Math.max(
                Number(baseCounters.gst_bill) || 0,
                gstSeq,
              );
            }
          }
          inMemoryCollections["doc_counters"] = nextCounters;
          await persistDocState("doc_counters", nextCounters);
        } catch {}

        // Saving a bill on purpose clears an old "deleted" mark for that number (a reused number is a new bill).
        if (
          !reassignedFromId &&
          (await readTombstones("deleted_bill_ids")).has(
            String(workingPayload.id),
          )
        ) {
          const cur = await getCollectionData("deleted_bill_ids");
          await setCollectionData(
            "deleted_bill_ids",
            (Array.isArray(cur) ? cur : []).filter(
              (n: any) => Number(n) !== workingPayload.id,
            ),
          );
        }

        // 1. Mirror to app_collections 'orders' in the SAME shape the app uses (not the database row).
        const cachedBill = {
          ...workingBody,
          id: workingPayload.id,
          retailer: workingPayload.retailer,
          date: workingPayload.date,
          amountPaid: workingPayload.amount_paid,
        };
        const updated = [
          cachedBill,
          ...list
            .filter((o: any) => Number(o.id) !== workingPayload.id)
            .map((o: any) =>
              flaggedStoredBill && Number(o.id) === Number(flaggedStoredBill.id)
                ? flaggedStoredBill
                : o,
            ),
        ];
        await setCollectionData("orders", updated);

        // 2. Reserve / update inventory in local collection / Postgres
        const items = Array.isArray(workingBody.items) ? workingBody.items : [];
        for (const item of items) {
          const pid = item.productId || item.product_id || item.id;
          const qty =
            Number(item.qty || item.quantity || 0) +
            Number(item.freeQty || item.free_qty || 0);
          if (pid && qty > 0) {
            updateInventoryItemStock(pid, 0, qty).catch(() => {});
          }
        }

        // 3. Best-effort Supabase sync (non-blocking)
        if (isSupabaseAvailable()) {
          const toUpsert = flaggedStoredBill
            ? [workingPayload, formatBillForSupabase(flaggedStoredBill)]
            : workingPayload;
          resilientUpsert(supabase, "bills", toUpsert, {
            onConflict: "id",
          })
            .then(({ error }) => {
              if (error) {
                console.warn(
                  "Upsert to public.bills notice:",
                  error.message ? error.message.slice(0, 150) : error,
                );
              }
            })
            .catch((err) => {
              console.warn(
                "Upsert to public.bills background error:",
                err?.message || err,
              );
            });
        }

        const billSid =
          workingBody?.salesmanId ||
          workingBody?.salesman_id ||
          workingPayload.salesman_id;
        emitSyncEvent({
          topic: "bills",
          ...(billSid ? { salesmanId: String(billSid) } : {}),
        });

        return res.status(201).json({
          success: true,
          data: workingPayload,
          ...(reassignedFromId
            ? {
                reassignedId: workingPayload.id,
                collidedFromId: reassignedFromId,
                bill: cachedBill,
              }
            : {}),
        });
      } catch (err: any) {
        console.error("Error creating bill:", err);
        return res
          .status(500)
          .json({ error: err.message || "Failed to create bill" });
      }
    },
  );

  // ---- Cross-device document numbers -------------------------------------------------------
  const MAX_FLOOR_HEADROOM = Math.max(1, Number(process.env.DOC_FLOOR_HEADROOM) || 200);
  const HOLD_TTL_MS = Math.max(
    1000,
    Number(process.env.DOC_HOLD_TTL_MS) || 12 * 60 * 60 * 1000,
  );
  // Awaited (not fire-and-forget) so a failed save is logged and the caller learns of it before a number is
  // handed out; the in-memory copy is already updated, so a retry on the next call still sees the right counter.
  const persistDocState = async (key: string, value: unknown) => {
    try {
      await setCollectionData(key, value);
    } catch (err: any) {
      console.error(`[doc-numbers] could not save ${key}: ${String(err?.message || err).slice(0, 150)}`);
    }
  };
  const loadDocState = async () => {
    const counters: any = await getCollectionData("doc_counters");
    const state: any = await getCollectionData("doc_holds");
    return { counters, state };
  };
  const cleanObj = (v: any) =>
    v && typeof v === "object" && !Array.isArray(v) ? v : {};
  const seqState = (all: any, seq: string) => {
    const s = (all[seq] = cleanObj(all[seq]));
    s.holds = cleanObj(s.holds);
    s.free = Array.isArray(s.free)
      ? s.free.map(Number).filter((n: number) => n > 0)
      : [];
    return s;
  };

  app.post("/api/doc-numbers/reserve", async (req, res) => {
    try {
      const sequence = String(req.body?.sequence || "").trim();
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(sequence)) {
        return res.status(400).json({ error: "Invalid sequence name" });
      }
      const deviceId = String(req.body?.deviceId || "").trim().slice(0, 64);
      const requestedFloor = Math.max(0, Math.floor(Number(req.body?.floor) || 0));
      const loaded = await loadDocState();
      const needsOrdersScan =
        sequence === "bill" ||
        sequence === "gst_bill" ||
        sequence === "non_gst_bill" ||
        sequence.startsWith("bill_sm_") ||
        sequence.startsWith("bill_ng_sm_");
      const orders = needsOrdersScan ? await getCollectionData("orders") : [];
      const billingSettings =
        sequence === "gst_bill"
          ? await getCollectionData("billing_settings").catch(() => null)
          : null;
      const deadNumbers =
        sequence === "bill"
          ? Array.from(await readTombstones("deleted_bill_ids")).map(Number)
          : [];
      const live = inMemoryCollections["doc_counters"];
      const counters = cleanObj(
        live && typeof live === "object" && !Array.isArray(live)
          ? live
          : loaded.counters,
      );
      const liveState = inMemoryCollections["doc_holds"];
      const all = cleanObj(
        liveState && typeof liveState === "object" && !Array.isArray(liveState)
          ? liveState
          : loaded.state,
      );
      const st = seqState(all, sequence);
      const now = Date.now();
      const used = new Set<number>();
      if (Array.isArray(orders)) {
        if (sequence === "bill") {
          for (const o of orders) {
            const n = Number(o?.id) || 0;
            if (n > 0) used.add(n);
          }
        } else if (sequence === "gst_bill") {
          for (const o of orders) {
            const docNo = String(o?.docNo || o?.extra?.docNo || "").trim();
            const docSeries = o?.docSeries ?? o?.extra?.docSeries;
            const gstExclude = o?.gstExclude ?? o?.extra?.gstExclude;
            const seq = parseGstSeriesSeq(
              { id: Number(o?.id) || 0, docNo: docNo || undefined, docSeries, gstExclude },
              billingSettings,
            );
            if (seq > 0) used.add(seq);
          }
        } else if (sequence === "non_gst_bill") {
          for (const o of orders) {
            const docNo = String(o?.docNo || o?.extra?.docNo || "").trim();
            const m = docNo.match(/^NG-(\d+)$/i);
            if (m) {
              const n = Number(m[1]) || 0;
              if (n > 0) used.add(n);
            }
          }
        } else if (sequence.startsWith("bill_sm_") || sequence.startsWith("bill_ng_sm_")) {
          const isNgSeq = sequence.startsWith("bill_ng_sm_");
          const code = sequence.replace(/^bill_(?:ng_)?sm_/, "");
          const pat = new RegExp(`-${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`, "i");
          for (const o of orders) {
            const docNo = String(o?.docNo || o?.extra?.docNo || "").trim();
            const isNgOrder =
              o?.docSeries === "non_gst" ||
              o?.gstExclude === true ||
              /^NG-/i.test(docNo);
            if (isNgOrder !== isNgSeq) continue;
            const m = docNo.match(pat);
            if (m) {
              const n = Number(m[1]) || 0;
              if (n > 0) used.add(n);
            }
          }
        }
      }

      deadNumbers.forEach((n) => Number.isFinite(n) && used.add(n));

      // A client may say "my own bills already reach N" (offline numbers not yet synced), but it cannot push the
      // series far past what the server knows: an inflated floor would leave a hole in a series that must stay
      // consecutive. Allow a modest head-room for offline use only.
      let knownMax = Number(counters[sequence]) || 0;
      used.forEach((n) => (knownMax = Math.max(knownMax, n)));
      const floor = Math.min(requestedFloor, knownMax + MAX_FLOOR_HEADROOM);

      for (const [dev, h] of Object.entries<any>(st.holds)) {
        if (now - Number(h?.at || 0) > HOLD_TTL_MS) {
          st.free.push(Number(h.number));
          delete st.holds[dev];
        }
      }
      const mine = deviceId ? st.holds[deviceId] : undefined;
      if (mine) {
        if (Number(mine.number) > floor && !used.has(Number(mine.number))) {
          mine.at = now;
          inMemoryCollections["doc_holds"] = all;
          await persistDocState("doc_holds", all);
          return res.json({
            success: true,
            sequence,
            number: Number(mine.number),
          });
        }
        delete st.holds[deviceId];
      }

      let next = 0;
      st.free.sort((a: number, b: number) => a - b);
      while (st.free.length > 0) {
        const cand = st.free.shift() as number;
        const heldByOther = Object.values<any>(st.holds).some(
          (h) => Number(h.number) === cand,
        );
        if (!used.has(cand) && !heldByOther && cand > floor && cand > 0) {
          next = cand;
          break;
        }
      }
      if (!next) {
        let base = Math.max(Number(counters[sequence]) || 0, floor);
        used.forEach((n) => (base = Math.max(base, n)));
        next = base + 1;
        counters[sequence] = next;
      }
      if (deviceId) st.holds[deviceId] = { number: next, at: now };
      inMemoryCollections["doc_counters"] = counters;
      inMemoryCollections["doc_holds"] = all;
      await persistDocState("doc_counters", counters);
      await persistDocState("doc_holds", all);
      return res.json({ success: true, sequence, number: next });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err?.message || "Could not reserve a number" });
    }
  });

  app.post("/api/doc-numbers/release", async (req, res) => {
    try {
      const sequence = String(req.body?.sequence || "").trim();
      const deviceId = String(req.body?.deviceId || "").trim().slice(0, 64);
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(sequence) || !deviceId) {
        return res
          .status(400)
          .json({ error: "sequence and deviceId are required" });
      }
      const loaded = await loadDocState();
      const live = inMemoryCollections["doc_counters"];
      const counters = cleanObj(
        live && typeof live === "object" && !Array.isArray(live)
          ? live
          : loaded.counters,
      );
      const liveState = inMemoryCollections["doc_holds"];
      const all = cleanObj(
        liveState && typeof liveState === "object" && !Array.isArray(liveState)
          ? liveState
          : loaded.state,
      );
      const st = seqState(all, sequence);
      const h = st.holds[deviceId];
      if (h) {
        const n = Number(h.number);
        delete st.holds[deviceId];
        if (n === Number(counters[sequence])) counters[sequence] = n - 1;
        else st.free.push(n);
        inMemoryCollections["doc_counters"] = counters;
        inMemoryCollections["doc_holds"] = all;
        await persistDocState("doc_counters", counters);
        await persistDocState("doc_holds", all);
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res
        .status(500)
        .json({ error: err?.message || "Could not release the number" });
    }
  });

  app.put(["/api/bills", "/api/orders"], async (req, res) => {
    try {
      const rawBills = Array.isArray(req.body?.bills)
        ? req.body.bills
        : Array.isArray(req.body?.data)
          ? req.body.data
          : Array.isArray(req.body)
            ? req.body
            : [];

      if (rawBills.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const storedOrders = await getCollectionData("orders");
      const deletedIds = new Set<number>(
        Array.from(await readTombstones("deleted_bill_ids")).map(Number),
      );
      const baseOrders = Array.isArray(storedOrders) ? storedOrders : [];
      const mergeResult = mergeBillListsWithConflictResolution(
        baseOrders,
        rawBills,
        deletedIds,
      );

      if (mergeResult.accepted.size > 0) {
        const validationCtx = await loadServerValidationContext();
        let runningOrders = [...baseOrders];
        for (const acceptedBill of Array.from(mergeResult.accepted)) {
          const prevMatch = runningOrders.find(
            (o: any) =>
              Number(o?.id) === Number((acceptedBill as any)?.id) &&
              areSameBillIdentity(o, acceptedBill),
          );
          const check = validateBillAgainstLedger(acceptedBill, {
            ...validationCtx,
            bills: runningOrders,
            existingBill: prevMatch || null,
          });
          if (!check.ok) {
            return res.status(check.status).json({
              error: check.error,
              code: check.code,
              ...(check.shortfalls ? { shortfalls: check.shortfalls } : {}),
            });
          }
          runningOrders = [
            acceptedBill,
            ...runningOrders.filter(
              (o: any) => Number(o?.id) !== Number((acceptedBill as any)?.id),
            ),
          ];
        }
      }

      const restoredIds = collectCancelledRestores(rawBills, deletedIds);
      if (restoredIds.length > 0) {
        const deletedRaw = await getCollectionData("deleted_bill_ids");
        const curDeleted = Array.isArray(deletedRaw) ? deletedRaw : [];
        const restoredSet = new Set(restoredIds);
        await setCollectionData(
          "deleted_bill_ids",
          curDeleted.filter((n: any) => !restoredSet.has(Number(n))),
        );
      }
      await setCollectionData("orders", mergeResult.merged);

      const payloads = Array.from(mergeResult.accepted).map(formatBillForSupabase);
      if (isSupabaseAvailable() && payloads.length > 0) {
        resilientUpsert(supabase, "bills", payloads, {
          onConflict: "id",
        })
          .then(({ error }) => {
            if (error) {
              console.warn(
                "Bulk upsert to public.bills notice:",
                error.message ? error.message.slice(0, 150) : error,
              );
            }
          })
          .catch((err) => {
            console.warn(
              "Bulk upsert to public.bills background error:",
              err?.message || err,
            );
          });
      }

      emitSyncEvent({ topic: "bills" });
      return res.json({ success: true, count: payloads.length });
    } catch (err: any) {
      console.error("Error in PUT /api/bills:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to bulk update bills" });
    }
  });

  app.post("/api/bills/:id/payment", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const amountPaid = Number(
        req.body?.amountPaid !== undefined
          ? req.body.amountPaid
          : req.body?.amount || 0,
      );

      const colOrders = await getCollectionData("orders");
      if (Array.isArray(colOrders)) {
        const expected = req.body?.expectedAmountPaid;
        const current = colOrders.find((o: any) => Number(o.id) === id);
        if (current && expected !== undefined && expected !== null) {
          const have = Number(current.amountPaid ?? current.amount_paid ?? 0);
          if (Math.abs(have - Number(expected)) > 0.005) {
            return res.status(409).json({
              error:
                "This invoice's payments changed on another device. Refresh and record the payment again.",
              code: "STALE",
              amountPaid: have,
            });
          }
        }
        const updated = colOrders.map((o: any) =>
          Number(o.id) === id
            ? {
                ...o,
                amountPaid,
                amount_paid: amountPaid,
                updatedAt: new Date().toISOString(),
              }
            : o,
        );
        await setCollectionData("orders", updated);
      }

      if (isSupabaseAvailable()) {
        withSupabaseTimeout(
          supabase
            .from("bills")
            .update({
              amount_paid: amountPaid,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id),
          3000,
        )
          .then(({ error }) => {
            if (error) {
              console.warn(
                "Payment update to public.bills notice:",
                error.message ? error.message.slice(0, 150) : error,
              );
            }
          })
          .catch((err) => {
            console.warn(
              "Payment update to public.bills error:",
              err?.message || err,
            );
          });
      }

      emitSyncEvent({ topic: "bills" });
      emitSyncEvent({ topic: "payments" });
      return res.json({ success: true, id, amountPaid });
    } catch (err: any) {
      console.error("Error updating bill payment:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to update payment" });
    }
  });

  app.delete(["/api/bills/:id", "/api/orders/:id"], async (req, res) => {
    try {
      // A saved invoice is never deleted: it is cancelled (number kept, credit note issued). Switch on only for a
      // data repair by a developer: ALLOW_BILL_DELETE=true.
      if (process.env.ALLOW_BILL_DELETE !== "true") {
        return res
          .status(405)
          .json({ error: "A saved invoice cannot be deleted. Cancel it instead (the invoice number is kept)." });
      }
      const id = Number(req.params.id);

      const colOrders = await getCollectionData("orders");
      if (Array.isArray(colOrders)) {
        const victim = colOrders.find((o: any) => Number(o.id) === id);
        if (victim) {
          try {
            const counters =
              inMemoryCollections["doc_counters"] ||
              (await getCollectionData("doc_counters")) ||
              {};
            const nextCounters: Record<string, number> = {
              ...(typeof counters === "object" && !Array.isArray(counters)
                ? counters
                : {}),
              bill: Math.max(Number(counters?.bill) || 0, id),
            };
            const vDocNo = String(victim.docNo || victim?.extra?.docNo || "").trim();
            const vIsNg =
              victim.docSeries === "non_gst" ||
              victim.gstExclude === true ||
              /^NG-/i.test(vDocNo);
            if (vIsNg) {
              const m = vDocNo.match(/^NG-(\d+)$/i);
              if (m) {
                nextCounters.non_gst_bill = Math.max(
                  Number(counters?.non_gst_bill) || 0,
                  Number(m[1]) || 0,
                );
              }
            } else {
              const billingSettings = await getCollectionData("billing_settings").catch(() => null);
              const seq = parseGstSeriesSeq(
                { id, docNo: vDocNo || undefined, docSeries: victim.docSeries, gstExclude: victim.gstExclude },
                billingSettings,
              );
              if (seq > 0) {
                nextCounters.gst_bill = Math.max(
                  Number(counters?.gst_bill) || 0,
                  seq,
                );
              }
            }
            inMemoryCollections["doc_counters"] = nextCounters;
            await setCollectionData("doc_counters", nextCounters);
          } catch {}
        }
        const updated = colOrders.filter((o: any) => Number(o.id) !== id);
        await setCollectionData("orders", updated);
      }
      {
        const dr = await getCollectionData("deleted_bill_ids");
        const list = Array.isArray(dr) ? dr.map(Number) : [];
        if (!list.includes(id)) {
          await setCollectionData("deleted_bill_ids", [...list, id].slice(-20000));
        }
      }
      flushDiskCollectionsNow();

      if (isSupabaseAvailable()) {
        withSupabaseTimeout(
          supabase.from("bills").delete().eq("id", id),
          3000,
        )
          .then((r: any) => {
            if (r?.error) {
              console.warn(
                `[Supabase] Could not delete bill ${id}: ${String(r.error.message || r.error).slice(0, 150)}`,
              );
            }
          })
          .catch(() => {});
      }

      return res.json({ success: true, id });
    } catch (err: any) {
      console.error("Error deleting bill:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to delete bill" });
    }
  });

  app.post("/api/orders/:id/cancel", async (req, res) => {
    try {
      const { id } = req.params;
      let order: any = null;
      if (isSupabaseAvailable()) {
        const { data: ordData } = (await withSupabaseTimeout(
          supabase.from("orders").select("*").eq("id", id).maybeSingle(),
          2500,
        )) as any;
        if (ordData) {
          order = ordData;
        } else {
          const { data: bData } = (await withSupabaseTimeout(
            supabase.from("bills").select("*").eq("id", id).maybeSingle(),
            2500,
          )) as any;
          if (bData) order = bData;
        }
      }
      if (!order) {
        const colOrders = await getCollectionData("orders");
        if (Array.isArray(colOrders)) {
          order = colOrders.find((o: any) => String(o.id) === String(id));
        }
      }

      if (order && Array.isArray(order.items)) {
        for (const item of order.items) {
          const pid = item.productId || item.product_id || item.id;
          const qty =
            Number(item.qty || item.quantity || 0) +
            Number(item.freeQty || item.free_qty || 0);
          if (pid && qty > 0) {
            await updateInventoryItemStock(pid, 0, -qty);
          }
        }
      }

      if (isSupabaseAvailable()) {
        await withSupabaseTimeout(
          supabase
            .from("orders")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("id", id),
          2500,
        ).catch(() => {});
      }
      const colOrders = await getCollectionData("orders");
      if (Array.isArray(colOrders)) {
        const updated = colOrders.map((o: any) =>
          String(o.id) === String(id) ? { ...o, status: "cancelled" } : o,
        );
        await setCollectionData("orders", updated);
      }
      emitSyncEvent({ topic: "bills" });

      return res.json({
        success: true,
        message: "Order cancelled and reserved stock released",
      });
    } catch (err: any) {
      console.error("Error cancelling order:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to cancel order" });
    }
  });

  app.post("/api/orders/:id/deliver", async (req, res) => {
    try {
      const { id } = req.params;
      let order: any = null;
      if (isSupabaseAvailable()) {
        const { data: ordData } = (await withSupabaseTimeout(
          supabase.from("orders").select("*").eq("id", id).maybeSingle(),
          2500,
        )) as any;
        if (ordData) {
          order = ordData;
        } else {
          const { data: bData } = (await withSupabaseTimeout(
            supabase.from("bills").select("*").eq("id", id).maybeSingle(),
            2500,
          )) as any;
          if (bData) order = bData;
        }
      }
      if (!order) {
        const colOrders = await getCollectionData("orders");
        if (Array.isArray(colOrders)) {
          order = colOrders.find((o: any) => String(o.id) === String(id));
        }
      }

      if (order && Array.isArray(order.items)) {
        for (const item of order.items) {
          const pid = item.productId || item.product_id || item.id;
          const qty =
            Number(item.qty || item.quantity || 0) +
            Number(item.freeQty || item.free_qty || 0);
          if (pid && qty > 0) {
            await updateInventoryItemStock(pid, -qty, -qty);
          }
        }
      }

      if (isSupabaseAvailable()) {
        await withSupabaseTimeout(
          supabase
            .from("orders")
            .update({ status: "delivered", updated_at: new Date().toISOString() })
            .eq("id", id),
          2500,
        ).catch(() => {});
      }
      const colOrders = await getCollectionData("orders");
      if (Array.isArray(colOrders)) {
        const updated = colOrders.map((o: any) =>
          String(o.id) === String(id) ? { ...o, status: "delivered" } : o,
        );
        await setCollectionData("orders", updated);
      }
      emitSyncEvent({ topic: "bills" });

      return res.json({
        success: true,
        message: "Order delivered and stock deducted from inventory",
      });
    } catch (err: any) {
      console.error("Error delivering order:", err);
      return res
        .status(500)
        .json({ error: err.message || "Failed to deliver order" });
    }
  });
}
