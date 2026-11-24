import {
  pushBillToSupabase,
  pushTripToSupabase,
} from "../../../lib/supabase";
import {
  checkSaleForRegime,
  noOutputTax,
  resolveTaxRegime,
  stripOutputTax,
} from "../../../tax/appRegime";
import type {
  Bill,
  BillEditEntry,
  BillItem,
  PaymentMode,
  PaymentRecord,
} from "../../../types";
import { billTotals } from "../../../utils/billing";
import { todayISO } from "../../../utils/dateLocal";
import {
  isGstExcludedBill,
  makeBillClientUid,
} from "../../../utils/invoiceCommon";
import { stampChangedPayments } from "../../../utils/paymentStamp";
import { billBalance } from "../../../utils/salesReturns";
import { previewPricing, totalsMatch } from "../../../utils/schemeEngine";
import { saveOrders } from "../../../utils/storage";
import { resolveBillWarehouseId } from "../../../utils/tripLoads";
import { describeBillChanges } from "../../ledgerBillEditHelpers";
import {
  STORAGE_KEY,
  cloud,
  cloudFetch,
  emptyCart,
  getDeviceId,
  normCustName,
  reserveDocNumber,
  stampChangedBills,
} from "../../ledgerHelpers";
import type { SplitBillsResult } from "../../ledgerTypes";
import type {
  BillingDocHelpers,
  NormalizedBillingParams,
} from "./billingShared";

export function createBillCheckoutActions(
  params: NormalizedBillingParams,
  docHelpers: BillingDocHelpers,
) {
  const {
    allBillsRef,
    setBills,
    cart,
    setCart,
    editingBillId,
    setEditingBillId,
    setJustFinalizedBillId,
    setJustFinalizedSplitIds,
    products,
    warehouses,
    defaultWarehouse,
    inventoryBatches,
    promotions,
    setPromotions,
    trips,
    setTrips,
    orgProfile,
    billingSettings,
    gstMode,
    customers,
    paymentsRef,
    setPayments,
    stockShortfalls,
    allocateBatches,
    resolveMasterCustomerId,
    findBillingCustomer,
    getCustomerLedger,
    setCustomProductPrice,
    currentUser,
    setTab,
    notify,
  } = params;

  const {
    getInvoicePrefix,
    nextBillDocNumber,
    syncBillPaymentsOnEdit,
    planBillEditStock,
  } = docHelpers;

  function startEditBill(bill: Bill) {
    if ((bill.returns || []).length > 0) {
      notify(
        "This invoice has customer returns against it, so it can no longer be edited.",
      );
      return;
    }
    setEditingBillId(bill.id);
    setCart({
      retailer: bill.retailer,
      phone: bill.phone,
      date: bill.date,
      items: bill.items.map((it) => ({ ...it })),
      warehouseId: bill.warehouseId || "",
      tripId: bill.tripId,
      vehicle: bill.vehicle,
      salesman: bill.salesman,
      additionalDiscount: bill.additionalDiscount || 0,
    });
    setTab("billing");
  }

  function cancelEditBill() {
    setEditingBillId(null);
    setCart(emptyCart());
  }

  function finalizeBill(
    amountPaid?: number,
    tripId?: number,
    overallDiscount?: number,
    paymentDate?: string,
    paymentMode?: PaymentMode,
    paymentNote?: string,
    billDate?: string,
    extras?: {
      supplyType?: "B2C" | "B2B";
      customerGstin?: string;
      isRetrospective?: boolean;
      invoiceType?: "tax_invoice" | "bill_of_supply" | "retail";
      isGstInvoice?: boolean;
      docNo?: string;
      docSeries?: "gst" | "non_gst";
      gstExclude?: boolean;
      splitGroupId?: string;
      party?: {
        retailer?: string;
        phone?: string;
        salesman?: string;
        vehicle?: string;
        warehouseId?: string;
        customerId?: string;
      };
    },
  ): number | null {
    const effCart = extras?.party ? { ...cart, ...extras.party } : cart;
    const pickedCust = (() => {
      const pid = extras?.party?.customerId;
      if (!pid) return undefined;
      const c = customers.find((x) => x.id === pid);
      return c && normCustName(c.name) === normCustName(effCart.retailer)
        ? c
        : undefined;
    })();
    if (effCart.items.length === 0) return null;
    const effectiveBillDate =
      (billDate && billDate.trim()) ||
      (effCart.date && effCart.date.trim()) ||
      todayISO();
    const finalTripId = tripId !== undefined ? tripId : effCart.tripId;
    const matchedTrip = finalTripId
      ? trips.find((t) => Number(t.id) === Number(finalTripId))
      : null;
    const resolvedWarehouseId = resolveBillWarehouseId({
      trip: matchedTrip,
      cartWarehouseId: effCart.warehouseId,
      defaultWarehouseId: defaultWarehouse?.id,
      warehouses,
    });

    let fefo: { items: BillItem[]; problems: string[] };
    let cartEditStockChanged = false;
    const originalForEdit =
      editingBillId !== null
        ? allBillsRef.current.find((b) => b.id === editingBillId)
        : undefined;
    if (originalForEdit) {
      const plan = planBillEditStock(
        {
          ...originalForEdit,
          items: effCart.items,
          date: effectiveBillDate,
          warehouseId: resolvedWarehouseId || "",
          tripId: finalTripId || undefined,
        } as Bill,
        matchedTrip || null,
      );
      if (plan.problems.length > 0) {
        notify(
          "Cannot save these changes:\n" +
            plan.problems.map((m) => `• ${m}`).join("\n"),
        );
        return null;
      }
      cartEditStockChanged = plan.stockChanged;
      fefo = { items: plan.items, problems: [] };
    } else {
      const shortfalls = stockShortfalls(
        effCart.items,
        editingBillId,
        matchedTrip,
        resolvedWarehouseId,
      );
      if (shortfalls.length > 0) {
        notify(
          "Cannot save this bill — insufficient stock:\n" +
            shortfalls
              .map(
                (s) =>
                  `• ${s.productName}: need ${s.required}, only ${Math.max(0, s.available)} available` +
                  (matchedTrip ? ` on van (${matchedTrip.vehicle})` : ""),
              )
              .join("\n"),
        );
        return null;
      }

      fefo = allocateBatches(
        effCart.items,
        effectiveBillDate,
        resolvedWarehouseId,
        editingBillId,
        matchedTrip,
      );
      if (fefo.problems.length > 0) {
        notify(
          "Cannot save this bill:\n" +
            fefo.problems.map((m) => `• ${m}`).join("\n"),
        );
        return null;
      }
    }
    const batchCostById = new Map(
      inventoryBatches.map((b) => [
        b.id,
        Number(b.effectiveCostPrice) || Number(b.costPrice) || 0,
      ]),
    );
    const billItemsRaw = fefo.items.map((it) => {
      const prod = products.find((p) => p.id === it.productId);
      const fallback = Number(prod?.effectiveCost ?? prod?.cost) || 0;
      let q = 0;
      let c = 0;
      for (const a of it.batchAllocations || []) {
        const bc = batchCostById.get(a.batchId) || 0;
        const aq = Number(a.qty) || 0;
        if (aq > 0 && bc > 0) {
          q += aq;
          c += aq * bc;
        }
      }
      const cost = q > 0 ? c / q : fallback;
      return cost > 0
        ? { ...it, costExGst: Math.round(cost * 100) / 100 }
        : it;
    });
    const allNonGstItems =
      billItemsRaw.length > 0 &&
      billItemsRaw.every((it) => {
        const prod = products.find((p) => p.id === it.productId);
        return it.taxability === "non_gst" || prod?.taxability === "non_gst";
      });
    const isNonGstSeries =
      allNonGstItems ||
      extras?.docSeries === "non_gst" ||
      extras?.gstExclude === true ||
      Boolean(extras?.docNo && extras.docNo.toUpperCase().startsWith("NG-"));

    const taxRegime = resolveTaxRegime(orgProfile, effectiveBillDate);
    const saleCheck =
      !isNonGstSeries && taxRegime.active
        ? checkSaleForRegime(orgProfile, {
            date: effectiveBillDate,
            customerGstin: extras?.customerGstin,
            items: effCart.items,
          })
        : null;
    if (saleCheck && !saleCheck.ok) {
      notify(
        "Cannot save this bill - GST rules:\n" +
          saleCheck.errors.map((e) => `• ${e.message}`).join("\n"),
      );
      return null;
    }
    const outputTaxOff = noOutputTax(taxRegime);
    if (outputTaxOff) {
      extras = {
        ...(extras || {}),
        invoiceType: "bill_of_supply",
        isGstInvoice: false,
      };
    }
    const billItemsNorm = billItemsRaw.map((it) => {
      const prod = products.find((p) => p.id === it.productId);
      if (it.taxability === "non_gst" || prod?.taxability === "non_gst") {
        return {
          ...it,
          taxability: "non_gst" as const,
          gst: 0,
          cgstRate: 0,
          sgstRate: 0,
          cgst: 0,
          sgst: 0,
          taxable: Number(it.amount) || 0,
        };
      }
      return it;
    });
    if (isNonGstSeries) {
      extras = {
        ...(extras || {}),
        invoiceType: "bill_of_supply",
        isGstInvoice: false,
        supplyType: "B2C",
        customerGstin: undefined,
        docSeries: "non_gst",
        gstExclude: true,
      };
    }
    const forceOffTax =
      outputTaxOff ||
      isNonGstSeries ||
      extras?.invoiceType === "bill_of_supply" ||
      extras?.invoiceType === "retail" ||
      extras?.isGstInvoice === false;
    const billItems =
      outputTaxOff || isNonGstSeries
        ? stripOutputTax(billItemsNorm)
        : billItemsNorm;
    const discountToApply =
      overallDiscount !== undefined
        ? overallDiscount
        : effCart.additionalDiscount || 0;
    const totals = billTotals(
      billItems,
      forceOffTax ? "off" : gstMode,
      discountToApply,
    );
    const paid =
      amountPaid !== undefined
        ? Math.min(Math.max(0, amountPaid), totals.total)
        : totals.total;
    const isAnonymousParty =
      !effCart.retailer ||
      effCart.retailer.trim().toLowerCase() === "cash sale";
    if (isAnonymousParty && totals.total - paid > 0.005) {
      notify(
        'An unpaid balance cannot be booked against "Cash Sale". Select or enter a customer for credit sales, or collect the full amount.',
      );
      return null;
    }

    {
      const retailer = (effCart.retailer || "").trim();
      const isCash =
        !retailer ||
        retailer.toLowerCase() === "cash sale" ||
        retailer.toLowerCase() === "spot cash";
      if (!isCash && paid < totals.total - 0.005) {
        const cust = pickedCust ?? findBillingCustomer(retailer, effCart.phone);
        const limit = Number(cust?.creditLimit) || 0;
        if (limit > 0) {
          const led = getCustomerLedger(cust?.id || retailer, effCart.phone);
          let existingDue = led.rawBalance;
          if (editingBillId != null) {
            const eb = led.bills.find((b) => b.id === editingBillId);
            if (eb) existingDue -= billBalance(eb);
          }
          existingDue = Math.max(0, Math.round(existingDue * 100) / 100);
          const thisCredit = Math.max(0, totals.total - paid);
          if (existingDue + thisCredit > limit + 0.009) {
            notify(
              `Credit limit exceeded for ${retailer}.\n` +
                `Limit ₹${limit.toLocaleString("en-IN")} · Already due ₹${existingDue.toLocaleString("en-IN", { maximumFractionDigits: 0 })} · ` +
                `This bill credit ₹${thisCredit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}.\n` +
                `Collect more payment or reduce the bill.`,
            );
            return null;
          }
        }
      }
    }

    const resolvedSalesmanId =
      matchedTrip?.salesmanId ||
      (currentUser?.role === "salesman" ? currentUser.id : undefined) ||
      effCart.salesmanId;
    const resolvedSalesmanName =
      matchedTrip?.salesman ||
      (currentUser?.role === "salesman" ? currentUser.name : undefined) ||
      effCart.salesman;

    const activePaymentDate =
      paymentDate && paymentDate.trim()
        ? paymentDate.trim()
        : effectiveBillDate;
    const activePaymentMode = paymentMode || "cash";
    const activePaymentNote = paymentNote || undefined;

    if (editingBillId !== null) {
      const resolvedEditDocSeries: "gst" | "non_gst" = isNonGstSeries
        ? "non_gst"
        : "gst";
      const origDocNo = String(originalForEdit?.docNo || "").trim();
      const originalWasNonGst = originalForEdit
        ? originalForEdit.docSeries === "non_gst" ||
          originalForEdit.gstExclude === true ||
          origDocNo.toUpperCase().startsWith("NG-") ||
          isGstExcludedBill(originalForEdit, products)
        : false;
      const resolvedEditDocNo =
        extras?.docNo ||
        (resolvedEditDocSeries === "non_gst"
          ? originalWasNonGst
            ? origDocNo || `NG-${editingBillId}`
            : nextBillDocNumber({
                billId: editingBillId,
                isNonGst: true,
                salesmanName: resolvedSalesmanName,
                salesmanId: resolvedSalesmanId,
                currentBills: allBillsRef.current,
              })
          : !originalWasNonGst
            ? origDocNo || `${getInvoicePrefix()}-${editingBillId}`
            : nextBillDocNumber({
                billId: editingBillId,
                isNonGst: false,
                salesmanName: resolvedSalesmanName,
                salesmanId: resolvedSalesmanId,
                currentBills: allBillsRef.current,
              }));
      const updated: Bill = {
        ...totals,
        id: editingBillId,
        docNo: resolvedEditDocNo,
        docSeries: resolvedEditDocSeries,
        gstExclude: isNonGstSeries,
        splitGroupId: extras?.splitGroupId ?? originalForEdit?.splitGroupId,
        retailer: effCart.retailer || "Cash Sale",
        phone: effCart.phone,
        date: effectiveBillDate,
        items: billItems,
        amountPaid: paid,
        warehouseId: resolvedWarehouseId || "",
        tripId: finalTripId || undefined,
        vehicle: matchedTrip?.vehicle || effCart.vehicle || undefined,
        salesman: resolvedSalesmanName || undefined,
        salesmanId: resolvedSalesmanId || undefined,
        additionalDiscount: discountToApply,
        paymentDate: activePaymentDate,
        paymentMode: activePaymentMode,
        paymentNote: activePaymentNote,
        supplyType:
          !isNonGstSeries &&
          extras?.supplyType === "B2B" &&
          extras?.customerGstin
            ? "B2B"
            : "B2C",
        customerGstin:
          !isNonGstSeries && extras?.supplyType === "B2B"
            ? extras?.customerGstin || undefined
            : undefined,
        invoiceType: isNonGstSeries
          ? "bill_of_supply"
          : extras?.invoiceType ||
            (extras?.isGstInvoice === true
              ? "tax_invoice"
              : extras?.isGstInvoice === false
                ? "retail"
                : extras?.supplyType === "B2B" && extras?.customerGstin
                  ? "tax_invoice"
                  : "retail"),
        isGstInvoice: isNonGstSeries
          ? false
          : extras?.isGstInvoice !== undefined
            ? extras.isGstInvoice
            : extras?.invoiceType === "tax_invoice"
              ? true
              : extras?.invoiceType === "retail" ||
                  extras?.invoiceType === "bill_of_supply"
                ? false
                : extras?.supplyType === "B2B" && Boolean(extras?.customerGstin),
        isRetrospective: extras?.isRetrospective === true,
        ...(saleCheck?.stamp ? { taxStamp: saleCheck.stamp } : {}),
        editHistory: originalForEdit
          ? [
              ...(originalForEdit.editHistory || []),
              {
                at: new Date().toISOString(),
                by: currentUser?.name || "Admin",
                comment: "Edited from the billing screen",
                changes: describeBillChanges(originalForEdit, {
                  ...originalForEdit,
                  ...totals,
                  retailer: effCart.retailer || "Cash Sale",
                  date: effectiveBillDate,
                  items: billItems,
                  amountPaid: paid,
                } as Bill),
                stockChanged: cartEditStockChanged,
                totalBefore: Number(originalForEdit.total) || 0,
                totalAfter: Number(totals.total) || 0,
                paidBefore: Number(originalForEdit.amountPaid) || 0,
                paidAfter: Number(paid) || 0,
              } as BillEditEntry,
            ]
          : undefined,
      };
      for (const it of effCart.items) {
        if (
          it.productId &&
          it.customPriceEdited &&
          typeof it.rate === "number" &&
          it.rate >= 0
        ) {
          setCustomProductPrice(it.productId, it.rate, effCart.retailer);
        }
      }

      const nextEditBills = stampChangedBills(
        allBillsRef.current,
        allBillsRef.current.map((b) => (b.id === editingBillId ? updated : b)),
      );
      allBillsRef.current = nextEditBills;
      try {
        saveOrders(nextEditBills as any).catch(() => {});
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.bills = nextEditBills;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch {}
      setBills((bs) => bs.map((b) => (b.id === editingBillId ? updated : b)));
      const id = editingBillId;
      setEditingBillId(null);
      setCart(emptyCart());
      setJustFinalizedSplitIds([]);
      setJustFinalizedBillId(id);

      syncBillPaymentsOnEdit(
        updated,
        amountPaid !== undefined ? Math.max(0, amountPaid) : totals.total,
        {
          date: activePaymentDate,
          mode: activePaymentMode,
          note: activePaymentNote,
          recordedBy: resolvedSalesmanName || currentUser?.name || "Admin",
          salesmanId: resolvedSalesmanId,
        },
      );

      setTrips((ts) =>
        ts.map((t) => {
          if (t.id === finalTripId || !t.billIds.includes(id)) return t;
          const updatedT = { ...t, billIds: t.billIds.filter((b) => b !== id) };
          cloud("pushTripToSupabase", pushTripToSupabase(updatedT));
          return updatedT;
        }),
      );

      if (finalTripId) {
        setTrips((ts) =>
          ts.map((t) => {
            if (t.id !== finalTripId) return t;
            if (t.billIds.includes(id)) return t;
            const updatedT = { ...t, billIds: [...t.billIds, id] };
            cloud("pushTripToSupabase", pushTripToSupabase(updatedT));
            return updatedT;
          }),
        );
      }

      cloud("pushBillToSupabase", pushBillToSupabase(updated));
      cloudFetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });

      return id;
    } else {
      const nextId = reserveDocNumber(
        "bill",
        allBillsRef.current.length
          ? Math.max(...allBillsRef.current.map((b) => b.id))
          : 100,
      );
      const resolvedDocSeries: "gst" | "non_gst" = isNonGstSeries
        ? "non_gst"
        : "gst";
      const resolvedDocNo =
        extras?.docNo ||
        nextBillDocNumber({
          billId: nextId,
          isNonGst: resolvedDocSeries === "non_gst",
          salesmanName: resolvedSalesmanName,
          salesmanId: resolvedSalesmanId,
          currentBills: allBillsRef.current,
        });
      const deviceId = getDeviceId();
      const newBill: Bill = {
        ...totals,
        id: nextId,
        docNo: resolvedDocNo,
        docSeries: resolvedDocSeries,
        gstExclude: isNonGstSeries,
        splitGroupId: extras?.splitGroupId,
        clientUid: makeBillClientUid(deviceId),
        originDeviceId: deviceId,
        retailer: effCart.retailer || "Cash Sale",
        phone: effCart.phone,
        customerId:
          pickedCust?.id ??
          resolveMasterCustomerId(effCart.retailer, effCart.phone),
        date: effectiveBillDate,
        items: billItems,
        amountPaid: paid,
        warehouseId: resolvedWarehouseId || "",
        tripId: finalTripId || undefined,
        vehicle: matchedTrip?.vehicle || effCart.vehicle || undefined,
        salesman: resolvedSalesmanName || undefined,
        salesmanId: resolvedSalesmanId || undefined,
        additionalDiscount: discountToApply,
        paymentDate: activePaymentDate,
        paymentMode: activePaymentMode,
        paymentNote: activePaymentNote,
        supplyType:
          !isNonGstSeries &&
          extras?.supplyType === "B2B" &&
          extras?.customerGstin
            ? "B2B"
            : "B2C",
        customerGstin:
          !isNonGstSeries && extras?.supplyType === "B2B"
            ? extras?.customerGstin || undefined
            : undefined,
        invoiceType: isNonGstSeries
          ? "bill_of_supply"
          : extras?.invoiceType ||
            (extras?.isGstInvoice === true
              ? "tax_invoice"
              : extras?.isGstInvoice === false
                ? "retail"
                : extras?.supplyType === "B2B" && extras?.customerGstin
                  ? "tax_invoice"
                  : "retail"),
        isGstInvoice: isNonGstSeries
          ? false
          : extras?.isGstInvoice !== undefined
            ? extras.isGstInvoice
            : extras?.invoiceType === "tax_invoice"
              ? true
              : extras?.invoiceType === "retail" ||
                  extras?.invoiceType === "bill_of_supply"
                ? false
                : extras?.supplyType === "B2B" && Boolean(extras?.customerGstin),
        isRetrospective: extras?.isRetrospective === true,
        ...(saleCheck?.stamp ? { taxStamp: saleCheck.stamp } : {}),
      };

      if (billingSettings?.schemesEnabled === true) {
        const serverPreview = previewPricing(
          effCart.items,
          promotions,
          products,
          {
            customerName: effCart.retailer,
            customerPhone: effCart.phone,
            billDate: effectiveBillDate,
            schemesEnabled: true,
            autoApply: billingSettings.autoApplyPromotions !== false,
          },
        );
        const clientSchemeDisc = (effCart.items || []).reduce(
          (s, it) => s + (Number(it.discountAmount ?? it.discount) || 0),
          0,
        );
        if (
          !totalsMatch(clientSchemeDisc, serverPreview.schemeDiscountTotal, 0.05)
        ) {
          notify(
            `Scheme totals recalculated at save (₹${serverPreview.schemeDiscountTotal.toFixed(2)}).`,
          );
        }
        newBill.schemeDiscountTotal = serverPreview.schemeDiscountTotal;
        newBill.schemesApplied = serverPreview.applications;
        newBill.youSaved = serverPreview.youSaved;
        newBill.schemesEnabledAtSave = true;
        newBill.schemeVersionMap = Object.fromEntries(
          serverPreview.applications.map((a) => [
            String(a.schemeId),
            a.schemeVersion,
          ]),
        );
        for (const app of serverPreview.applications) {
          if (app.status !== "applied") continue;
          setPromotions((prev) =>
            prev.map((p) =>
              Number(p.id) === Number(app.schemeId)
                ? { ...p, usedCount: (Number(p.usedCount) || 0) + 1 }
                : p,
            ),
          );
        }
      }

      for (const it of effCart.items) {
        if (
          it.productId &&
          it.customPriceEdited &&
          typeof it.rate === "number" &&
          it.rate >= 0
        ) {
          setCustomProductPrice(it.productId, it.rate, effCart.retailer);
        }
      }

      allBillsRef.current = [newBill, ...allBillsRef.current];
      setBills((bs) => {
        const next = [newBill, ...bs];
        try {
          saveOrders(next as any).catch(() => {});
          const raw = localStorage.getItem(STORAGE_KEY);
          const parsed = raw ? JSON.parse(raw) : {};
          parsed.bills = next;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        } catch {}
        return next;
      });
      setCart(emptyCart());
      setJustFinalizedSplitIds([]);
      setJustFinalizedBillId(nextId);

      if (paid > 0) {
        const newPay: PaymentRecord = {
          id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          billId: nextId,
          customerName: newBill.retailer,
          customerPhone: newBill.phone,
          paymentDate: activePaymentDate,
          amount: paid,
          mode: activePaymentMode,
          referenceNote:
            activePaymentNote || `Initial payment on ${resolvedDocNo}`,
          recordedBy: resolvedSalesmanName || currentUser?.name || "Admin",
          salesmanId: resolvedSalesmanId,
          createdAt: new Date().toISOString(),
        };
        if (paymentsRef) {
          paymentsRef.current = stampChangedPayments(
            paymentsRef.current,
            [newPay, ...paymentsRef.current],
          );
        }
        setPayments((prev) => [newPay, ...prev]);
      }

      if (finalTripId) {
        setTrips((ts) =>
          ts.map((t) => {
            if (t.id !== finalTripId) return t;
            if (t.billIds.includes(nextId)) return t;
            const updatedT = { ...t, billIds: [...t.billIds, nextId] };
            cloud("pushTripToSupabase", pushTripToSupabase(updatedT));
            return updatedT;
          }),
        );
      }

      cloud("pushBillToSupabase", pushBillToSupabase(newBill));
      cloudFetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBill),
      });

      return nextId;
    }
  }

  function finalizeSplitBills(splitParams: {
    amountPaid?: number;
    tripId?: number;
    overallDiscount?: number;
    paymentDate?: string;
    paymentMode?: PaymentMode;
    paymentNote?: string;
    billDate?: string;
    extras?: {
      supplyType?: "B2C" | "B2B";
      customerGstin?: string;
      isRetrospective?: boolean;
      invoiceType?: "tax_invoice" | "bill_of_supply" | "retail";
      isGstInvoice?: boolean;
      party?: {
        retailer?: string;
        phone?: string;
        salesman?: string;
        vehicle?: string;
        warehouseId?: string;
        customerId?: string;
      };
    };
  }): SplitBillsResult | null {
    const {
      amountPaid,
      tripId,
      overallDiscount,
      paymentDate,
      paymentMode,
      paymentNote,
      billDate,
    } = splitParams;
    const extras = splitParams.extras;
    const effCart = extras?.party ? { ...cart, ...extras.party } : cart;
    if (effCart.items.length === 0) return null;

    const isItemNonGst = (it: BillItem) => {
      const prod = products.find((p) => p.id === it.productId);
      return it.taxability === "non_gst" || prod?.taxability === "non_gst";
    };
    const gstCartItems = effCart.items.filter((it) => !isItemNonGst(it));
    const nonGstCartItems = effCart.items.filter((it) => isItemNonGst(it));

    if (nonGstCartItems.length === 0) {
      const id = finalizeBill(
        amountPaid,
        tripId,
        overallDiscount,
        paymentDate,
        paymentMode,
        paymentNote,
        billDate,
        extras,
      );
      return id
        ? {
            gstBillId: id,
            nonGstBillId: null,
            splitGroupId: "",
            gstBill: allBillsRef.current.find((b) => b.id === id) ?? null,
            nonGstBill: null,
          }
        : null;
    }
    if (gstCartItems.length === 0) {
      const id = finalizeBill(
        amountPaid,
        tripId,
        overallDiscount,
        paymentDate,
        paymentMode,
        paymentNote,
        billDate,
        {
          ...(extras || {}),
          docSeries: "non_gst",
          gstExclude: true,
          invoiceType: "bill_of_supply",
          isGstInvoice: false,
        },
      );
      return id
        ? {
            gstBillId: null,
            nonGstBillId: id,
            splitGroupId: "",
            gstBill: null,
            nonGstBill: allBillsRef.current.find((b) => b.id === id) ?? null,
          }
        : null;
    }

    const pickedCust = (() => {
      const pid = extras?.party?.customerId;
      if (!pid) return undefined;
      const c = customers.find((x) => x.id === pid);
      return c && normCustName(c.name) === normCustName(effCart.retailer)
        ? c
        : undefined;
    })();
    const effectiveBillDate =
      (billDate && billDate.trim()) ||
      (effCart.date && effCart.date.trim()) ||
      todayISO();
    const finalTripId = tripId !== undefined ? tripId : effCart.tripId;
    const matchedTrip = finalTripId
      ? trips.find((t) => Number(t.id) === Number(finalTripId))
      : null;
    const resolvedWarehouseId = resolveBillWarehouseId({
      trip: matchedTrip,
      cartWarehouseId: effCart.warehouseId,
      defaultWarehouseId: defaultWarehouse?.id,
      warehouses,
    });

    const shortfalls = stockShortfalls(
      effCart.items,
      null,
      matchedTrip,
      resolvedWarehouseId,
    );
    if (shortfalls.length > 0) {
      notify(
        "Cannot save split bills — insufficient stock:\n" +
          shortfalls
            .map(
              (s) =>
                `• ${s.productName}: need ${s.required}, only ${Math.max(0, s.available)} available` +
                (matchedTrip ? ` on van (${matchedTrip.vehicle})` : ""),
            )
            .join("\n"),
      );
      return null;
    }

    const fefo = allocateBatches(
      effCart.items,
      effectiveBillDate,
      resolvedWarehouseId,
      null,
      matchedTrip,
    );
    if (fefo.problems.length > 0) {
      notify(
        "Cannot save split bills:\n" +
          fefo.problems.map((m) => `• ${m}`).join("\n"),
      );
      return null;
    }

    const taxRegime = resolveTaxRegime(orgProfile, effectiveBillDate);
    const saleCheck = taxRegime.active
      ? checkSaleForRegime(orgProfile, {
          date: effectiveBillDate,
          customerGstin: extras?.customerGstin,
          items: gstCartItems,
        })
      : null;
    if (saleCheck && !saleCheck.ok) {
      notify(
        "Cannot save GST bill — GST rules:\n" +
          saleCheck.errors.map((e) => `• ${e.message}`).join("\n"),
      );
      return null;
    }
    const outputTaxOff = noOutputTax(taxRegime);

    const batchCostById = new Map(
      inventoryBatches.map((b) => [
        b.id,
        Number(b.effectiveCostPrice) || Number(b.costPrice) || 0,
      ]),
    );
    const withCosts = fefo.items.map((it) => {
      const prod = products.find((p) => p.id === it.productId);
      const fallback = Number(prod?.effectiveCost ?? prod?.cost) || 0;
      let q = 0;
      let c = 0;
      for (const a of it.batchAllocations || []) {
        const bc = batchCostById.get(a.batchId) || 0;
        const aq = Number(a.qty) || 0;
        if (aq > 0 && bc > 0) {
          q += aq;
          c += aq * bc;
        }
      }
      const cost = q > 0 ? c / q : fallback;
      return cost > 0
        ? { ...it, costExGst: Math.round(cost * 100) / 100 }
        : it;
    });

    const rawGstItems = withCosts.filter((it) => !isItemNonGst(it));
    const rawNonGstItems = withCosts
      .filter((it) => isItemNonGst(it))
      .map((it) => ({
        ...it,
        taxability: "non_gst" as const,
        gst: 0,
        cgstRate: 0,
        sgstRate: 0,
        cgst: 0,
        sgst: 0,
        taxable: Number(it.amount) || 0,
      }));

    const gstItems = outputTaxOff ? stripOutputTax(rawGstItems) : rawGstItems;
    const nonGstItems = stripOutputTax(rawNonGstItems);

    const totalDiscount =
      overallDiscount !== undefined
        ? Math.max(0, Number(overallDiscount) || 0)
        : Math.max(0, Number(effCart.additionalDiscount) || 0);
    const gstAmtSum = gstItems.reduce(
      (s, it) => s + Math.max(0, Number(it.amount) || 0),
      0,
    );
    const nonGstAmtSum = nonGstItems.reduce(
      (s, it) => s + Math.max(0, Number(it.amount) || 0),
      0,
    );
    const totalAmtSum = gstAmtSum + nonGstAmtSum;
    let gstDiscount =
      totalDiscount > 0 && totalAmtSum > 0
        ? Math.round(totalDiscount * (gstAmtSum / totalAmtSum) * 100) / 100
        : 0;
    gstDiscount = Math.min(gstDiscount, gstAmtSum);
    const nonGstDiscount = Math.min(
      Math.max(0, Math.round((totalDiscount - gstDiscount) * 100) / 100),
      nonGstAmtSum,
    );

    const gstForceOff =
      outputTaxOff ||
      extras?.invoiceType === "bill_of_supply" ||
      extras?.invoiceType === "retail" ||
      extras?.isGstInvoice === false;
    const gstTotals = billTotals(
      gstItems,
      gstForceOff ? "off" : gstMode,
      gstDiscount,
    );
    const nonGstTotals = billTotals(nonGstItems, "off", nonGstDiscount);
    const combinedTotal =
      Math.round((gstTotals.total + nonGstTotals.total) * 100) / 100;

    const totalPaid =
      amountPaid !== undefined
        ? Math.min(Math.max(0, amountPaid), combinedTotal)
        : combinedTotal;

    const isAnonymousParty =
      !effCart.retailer ||
      effCart.retailer.trim().toLowerCase() === "cash sale";
    if (isAnonymousParty && combinedTotal - totalPaid > 0.005) {
      notify(
        'An unpaid balance cannot be booked against "Cash Sale". Select or enter a customer for credit sales, or collect the full amount.',
      );
      return null;
    }

    {
      const retailer = (effCart.retailer || "").trim();
      const isCash =
        !retailer ||
        retailer.toLowerCase() === "cash sale" ||
        retailer.toLowerCase() === "spot cash";
      if (!isCash && totalPaid < combinedTotal - 0.005) {
        const cust = pickedCust ?? findBillingCustomer(retailer, effCart.phone);
        const limit = Number(cust?.creditLimit) || 0;
        if (limit > 0) {
          const led = getCustomerLedger(cust?.id || retailer, effCart.phone);
          const existingDue = Math.max(
            0,
            Math.round(led.rawBalance * 100) / 100,
          );
          const thisCredit = Math.max(0, combinedTotal - totalPaid);
          if (existingDue + thisCredit > limit + 0.009) {
            notify(
              `Credit limit exceeded for ${retailer}.\n` +
                `Limit ₹${limit.toLocaleString("en-IN")} · Already due ₹${existingDue.toLocaleString("en-IN", { maximumFractionDigits: 0 })} · ` +
                `Combined credit ₹${thisCredit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}.\n` +
                `Collect more payment or reduce the bill.`,
            );
            return null;
          }
        }
      }
    }

    const gstPaid =
      Math.round(Math.min(totalPaid, gstTotals.total) * 100) / 100;
    const nonGstPaid =
      Math.round(
        Math.min(Math.max(0, totalPaid - gstPaid), nonGstTotals.total) * 100,
      ) / 100;

    const resolvedSalesmanId =
      matchedTrip?.salesmanId ||
      (currentUser?.role === "salesman" ? currentUser.id : undefined) ||
      effCart.salesmanId;
    const resolvedSalesmanName =
      matchedTrip?.salesman ||
      (currentUser?.role === "salesman" ? currentUser.name : undefined) ||
      effCart.salesman;
    const activePaymentDate =
      paymentDate && paymentDate.trim()
        ? paymentDate.trim()
        : effectiveBillDate;
    const activePaymentMode = paymentMode || "cash";
    const activePaymentNote = paymentNote || undefined;
    const resolvedCustomerId =
      pickedCust?.id ?? resolveMasterCustomerId(effCart.retailer, effCart.phone);

    const maxExistingId = allBillsRef.current.length
      ? Math.max(...allBillsRef.current.map((b) => b.id))
      : 100;
    const gstId = reserveDocNumber("bill", maxExistingId);
    const nonGstId = reserveDocNumber("bill", Math.max(maxExistingId, gstId));
    const gstDocNo = nextBillDocNumber({
      billId: gstId,
      isNonGst: false,
      salesmanName: resolvedSalesmanName,
      salesmanId: resolvedSalesmanId,
      currentBills: allBillsRef.current,
    });
    const nonGstDocNo = nextBillDocNumber({
      billId: nonGstId,
      isNonGst: true,
      salesmanName: resolvedSalesmanName,
      salesmanId: resolvedSalesmanId,
      currentBills: allBillsRef.current,
    });
    const splitGroupId = `split_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const deviceId = getDeviceId();

    const gstBill: Bill = {
      ...gstTotals,
      id: gstId,
      docNo: gstDocNo,
      docSeries: "gst",
      gstExclude: false,
      splitGroupId,
      clientUid: makeBillClientUid(deviceId),
      originDeviceId: deviceId,
      retailer: effCart.retailer || "Cash Sale",
      phone: effCart.phone,
      customerId: resolvedCustomerId,
      date: effectiveBillDate,
      items: gstItems,
      amountPaid: gstPaid,
      warehouseId: resolvedWarehouseId || "",
      tripId: finalTripId || undefined,
      vehicle: matchedTrip?.vehicle || effCart.vehicle || undefined,
      salesman: resolvedSalesmanName || undefined,
      salesmanId: resolvedSalesmanId || undefined,
      additionalDiscount: gstDiscount,
      paymentDate: activePaymentDate,
      paymentMode: activePaymentMode,
      paymentNote: activePaymentNote,
      supplyType:
        extras?.supplyType === "B2B" && extras?.customerGstin ? "B2B" : "B2C",
      customerGstin:
        extras?.supplyType === "B2B"
          ? extras?.customerGstin || undefined
          : undefined,
      invoiceType: outputTaxOff
        ? "bill_of_supply"
        : extras?.invoiceType ||
          (extras?.isGstInvoice === true
            ? "tax_invoice"
            : extras?.isGstInvoice === false
              ? "retail"
              : extras?.supplyType === "B2B" && extras?.customerGstin
                ? "tax_invoice"
                : "retail"),
      isGstInvoice: outputTaxOff
        ? false
        : extras?.isGstInvoice !== undefined
          ? extras.isGstInvoice
          : extras?.invoiceType === "tax_invoice"
            ? true
            : extras?.invoiceType === "retail" ||
                extras?.invoiceType === "bill_of_supply"
              ? false
              : extras?.supplyType === "B2B" && Boolean(extras?.customerGstin),
      isRetrospective: extras?.isRetrospective === true,
      ...(saleCheck?.stamp ? { taxStamp: saleCheck.stamp } : {}),
    };

    const nonGstBill: Bill = {
      ...nonGstTotals,
      id: nonGstId,
      docNo: nonGstDocNo,
      docSeries: "non_gst",
      gstExclude: true,
      splitGroupId,
      clientUid: makeBillClientUid(deviceId),
      originDeviceId: deviceId,
      retailer: effCart.retailer || "Cash Sale",
      phone: effCart.phone,
      customerId: resolvedCustomerId,
      date: effectiveBillDate,
      items: nonGstItems,
      amountPaid: nonGstPaid,
      warehouseId: resolvedWarehouseId || "",
      tripId: finalTripId || undefined,
      vehicle: matchedTrip?.vehicle || effCart.vehicle || undefined,
      salesman: resolvedSalesmanName || undefined,
      salesmanId: resolvedSalesmanId || undefined,
      additionalDiscount: nonGstDiscount,
      paymentDate: activePaymentDate,
      paymentMode: activePaymentMode,
      paymentNote: activePaymentNote,
      supplyType: "B2C",
      customerGstin: undefined,
      invoiceType: "bill_of_supply",
      isGstInvoice: false,
      isRetrospective: extras?.isRetrospective === true,
    };

    if (billingSettings?.schemesEnabled === true) {
      const preview = previewPricing(effCart.items, promotions, products, {
        customerName: effCart.retailer,
        customerPhone: effCart.phone,
        billDate: effectiveBillDate,
        schemesEnabled: true,
        autoApply: billingSettings.autoApplyPromotions !== false,
      });
      const lineDisc = (items: BillItem[]) =>
        items.reduce(
          (sum, it) => sum + (Number(it.discountAmount ?? it.discount) || 0),
          0,
        );
      const gstSchemeDisc = lineDisc(gstItems);
      const nonGstSchemeDisc = lineDisc(nonGstItems);
      const schemeDiscSum = gstSchemeDisc + nonGstSchemeDisc;
      const freeIds = (items: BillItem[]) =>
        new Set(items.map((i) => Number(i.productId)));
      const gstIds = freeIds(gstItems);
      const applied = preview.applications.filter(
        (a) => a.status === "applied",
      );
      const stamp = (
        bill: Bill,
        billSchemeDisc: number,
        ids: Set<number>,
      ) => {
        const share = schemeDiscSum > 0 ? billSchemeDisc / schemeDiscSum : 0;
        const apps = applied
          .map((a) => {
            const isFreeHere =
              a.freeProductId !== undefined && ids.has(Number(a.freeProductId));
            const discountAmount =
              Math.round((Number(a.discountAmount) || 0) * share * 100) / 100;
            if (discountAmount <= 0 && !isFreeHere) return null;
            return { ...a, discountAmount, freeQty: isFreeHere ? a.freeQty : 0 };
          })
          .filter(Boolean) as typeof applied;
        bill.schemeDiscountTotal = Math.round(billSchemeDisc * 100) / 100;
        bill.schemesApplied = apps;
        bill.youSaved = Math.round(billSchemeDisc * 100) / 100;
        bill.schemesEnabledAtSave = true;
        bill.schemeVersionMap = Object.fromEntries(
          apps.map((a) => [String(a.schemeId), a.schemeVersion]),
        );
      };
      stamp(gstBill, gstSchemeDisc, gstIds);
      stamp(nonGstBill, nonGstSchemeDisc, freeIds(nonGstItems));
      for (const app of applied) {
        setPromotions((prev) =>
          prev.map((p) =>
            Number(p.id) === Number(app.schemeId)
              ? { ...p, usedCount: (Number(p.usedCount) || 0) + 1 }
              : p,
          ),
        );
      }
    }

    for (const it of effCart.items) {
      if (
        it.productId &&
        it.customPriceEdited &&
        typeof it.rate === "number" &&
        it.rate >= 0
      ) {
        setCustomProductPrice(it.productId, it.rate, effCart.retailer);
      }
    }

    allBillsRef.current = [nonGstBill, gstBill, ...allBillsRef.current];
    setBills((bs) => {
      const next = [nonGstBill, gstBill, ...bs];
      try {
        saveOrders(next as any).catch(() => {});
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        parsed.bills = next;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch {}
      return next;
    });
    setCart(emptyCart());
    setJustFinalizedBillId(gstId);
    setJustFinalizedSplitIds([gstId, nonGstId]);

    const newPayments: PaymentRecord[] = [];
    if (gstPaid > 0) {
      newPayments.push({
        id: `pay_${Date.now()}_g_${Math.random().toString(36).slice(2, 5)}`,
        billId: gstId,
        customerName: gstBill.retailer,
        customerPhone: gstBill.phone,
        paymentDate: activePaymentDate,
        amount: gstPaid,
        mode: activePaymentMode,
        referenceNote: activePaymentNote || `Initial payment on ${gstDocNo}`,
        recordedBy: resolvedSalesmanName || currentUser?.name || "Admin",
        salesmanId: resolvedSalesmanId,
        createdAt: new Date().toISOString(),
      });
    }
    if (nonGstPaid > 0) {
      newPayments.push({
        id: `pay_${Date.now()}_n_${Math.random().toString(36).slice(2, 5)}`,
        billId: nonGstId,
        customerName: nonGstBill.retailer,
        customerPhone: nonGstBill.phone,
        paymentDate: activePaymentDate,
        amount: nonGstPaid,
        mode: activePaymentMode,
        referenceNote: activePaymentNote || `Initial payment on ${nonGstDocNo}`,
        recordedBy: resolvedSalesmanName || currentUser?.name || "Admin",
        salesmanId: resolvedSalesmanId,
        createdAt: new Date().toISOString(),
      });
    }
    if (newPayments.length > 0) {
      if (paymentsRef) {
        paymentsRef.current = stampChangedPayments(
          paymentsRef.current,
          [...newPayments, ...paymentsRef.current],
        );
      }
      setPayments((prev) => [...newPayments, ...prev]);
    }

    if (finalTripId) {
      setTrips((ts) =>
        ts.map((t) => {
          if (t.id !== finalTripId) return t;
          const addIds = [gstId, nonGstId].filter(
            (x) => !t.billIds.includes(x),
          );
          if (addIds.length === 0) return t;
          const updatedT = { ...t, billIds: [...t.billIds, ...addIds] };
          cloud("pushTripToSupabase", pushTripToSupabase(updatedT));
          return updatedT;
        }),
      );
    }

    cloud("pushBillToSupabase", pushBillToSupabase(gstBill));
    cloud("pushBillToSupabase", pushBillToSupabase(nonGstBill));
    cloudFetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gstBill),
    });
    cloudFetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nonGstBill),
    });

    return { gstBillId: gstId, nonGstBillId: nonGstId, splitGroupId, gstBill, nonGstBill };
  }

  return {
    startEditBill,
    cancelEditBill,
    finalizeBill,
    finalizeSplitBills,
  };
}
