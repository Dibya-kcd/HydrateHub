import React, { useEffect } from "react";
import {
  deleteInventoryDispositionFromSupabase,
  deleteSupplierCreditNoteFromSupabase,
  deleteSupplierSchemeFromSupabase,
  pushInventoryDispositionToSupabase,
  pushSupplierCreditNoteToSupabase,
  pushSupplierSchemeApplicationToSupabase,
  pushSupplierSchemeToSupabase,
} from "../../lib/supabase";
import type {
  Bill,
  InventoryBatch,
  InventoryDisposition,
  SupplierCreditNote,
  SupplierScheme,
  SupplierSchemeApplication,
} from "../../types";
import { todayISO } from "../../utils/dateLocal";
import {
  saveInventoryDispositions,
  saveSupplierCreditNotes,
  saveSupplierSchemeApplications,
  saveSupplierSchemes,
} from "../../utils/storage";
import { creditNoteStatus } from "../../utils/supplierSchemes";
import { addDispositionTombstone, cloud } from "../ledgerHelpers";

export interface UseSupplierSchemesAndDispositionsParams {
  supplierSchemes: SupplierScheme[];
  setSupplierSchemes: React.Dispatch<React.SetStateAction<SupplierScheme[]>>;
  supplierSchemeApplications: SupplierSchemeApplication[];
  setSupplierSchemeApplications: React.Dispatch<React.SetStateAction<SupplierSchemeApplication[]>>;
  supplierCreditNotes: SupplierCreditNote[];
  setSupplierCreditNotes: React.Dispatch<React.SetStateAction<SupplierCreditNote[]>>;
  inventoryDispositions: InventoryDisposition[];
  setInventoryDispositions: React.Dispatch<React.SetStateAction<InventoryDisposition[]>>;
  inventoryBatchesRef: React.MutableRefObject<InventoryBatch[]>;
  bills: Bill[];
  productWarehouseStock: (productId: number) => { warehouseId: string; warehouseName: string; crates: number }[];
  notify: (message: string) => void;
}

export function useSupplierSchemesAndDispositions({
  supplierSchemes,
  setSupplierSchemes,
  supplierSchemeApplications,
  setSupplierSchemeApplications,
  supplierCreditNotes,
  setSupplierCreditNotes,
  inventoryDispositions,
  setInventoryDispositions,
  inventoryBatchesRef,
  bills,
  productWarehouseStock,
  notify,
}: UseSupplierSchemesAndDispositionsParams) {
  // Supplier Schemes & Incentives: local + backend sync
  useEffect(() => {
    saveSupplierSchemes(supplierSchemes).catch(() => {});
  }, [supplierSchemes]);
  useEffect(() => {
    saveSupplierSchemeApplications(supplierSchemeApplications).catch(() => {});
  }, [supplierSchemeApplications]);
  useEffect(() => {
    saveSupplierCreditNotes(supplierCreditNotes).catch(() => {});
  }, [supplierCreditNotes]);

  function addSupplierScheme(
    s: Omit<SupplierScheme, "id" | "createdAt" | "updatedAt">,
  ): SupplierScheme {
    const now = new Date().toISOString();
    const newScheme: SupplierScheme = {
      ...s,
      id:
        "sscheme_" +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 6),
      createdAt: now,
      updatedAt: now,
    };
    setSupplierSchemes((prev) => [newScheme, ...prev]);
    cloud(
      "pushSupplierSchemeToSupabase",
      pushSupplierSchemeToSupabase(newScheme),
    );
    return newScheme;
  }

  function updateSupplierScheme(id: string, updates: Partial<SupplierScheme>) {
    setSupplierSchemes((prev) => {
      const next = prev.map((s) =>
        s.id === id
          ? { ...s, ...updates, id, updatedAt: new Date().toISOString() }
          : s,
      );
      const updated = next.find((s) => s.id === id);
      if (updated)
        cloud(
          "pushSupplierSchemeToSupabase",
          pushSupplierSchemeToSupabase(updated),
        );
      return next;
    });
  }

  function deleteSupplierScheme(id: string) {
    setSupplierSchemes((prev) => prev.filter((s) => s.id !== id));
    cloud(
      "deleteSupplierSchemeFromSupabase",
      deleteSupplierSchemeFromSupabase(id),
    );
  }

  function addSupplierSchemeApplication(
    a: Omit<SupplierSchemeApplication, "id" | "createdAt">,
  ): SupplierSchemeApplication {
    const newApp: SupplierSchemeApplication = {
      ...a,
      id:
        "sapp_" +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString(),
    };
    setSupplierSchemeApplications((prev) => [newApp, ...prev]);
    cloud(
      "pushSupplierSchemeApplicationToSupabase",
      pushSupplierSchemeApplicationToSupabase(newApp),
    );
    return newApp;
  }

  function addSupplierCreditNote(
    n: Omit<SupplierCreditNote, "id" | "createdAt" | "updatedAt" | "status">,
  ): SupplierCreditNote {
    const now = new Date().toISOString();
    const newNote: SupplierCreditNote = {
      ...n,
      id:
        "scn_" +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 6),
      actualAmount: n.actualAmount || 0,
      status: creditNoteStatus(n.expectedAmount, n.actualAmount || 0),
      createdAt: now,
      updatedAt: now,
    };
    setSupplierCreditNotes((prev) => [newNote, ...prev]);
    cloud(
      "pushSupplierCreditNoteToSupabase",
      pushSupplierCreditNoteToSupabase(newNote),
    );
    return newNote;
  }

  function updateSupplierCreditNote(
    id: string,
    updates: Partial<SupplierCreditNote>,
  ) {
    setSupplierCreditNotes((prev) => {
      const next = prev.map((n) => {
        if (n.id !== id) return n;
        const merged = {
          ...n,
          ...updates,
          id,
          updatedAt: new Date().toISOString(),
        };
        if (updates.status) {
          merged.status = updates.status;
        } else {
          merged.status = creditNoteStatus(
            merged.expectedAmount,
            merged.actualAmount,
          );
        }
        return merged;
      });
      saveSupplierCreditNotes(next).catch(() => {});
      const updated = next.find((n) => n.id === id);
      if (updated) {
        cloud(
          "pushSupplierCreditNoteToSupabase",
          pushSupplierCreditNoteToSupabase(updated),
        );
        setInventoryDispositions((disps) => {
          let touched = false;
          const nextDisps = disps.map((d) => {
            if (
              (updated.creditNoteNumber &&
                d.creditNoteNumber === updated.creditNoteNumber) ||
              (updated.notes && updated.notes.includes(d.id))
            ) {
              touched = true;
              const newStatus =
                updated.actualAmount <= 0
                  ? "pending"
                  : updated.actualAmount + 0.009 >= (d.costValue || 0)
                    ? "settled"
                    : "partial";
              const updD: InventoryDisposition = {
                ...d,
                compensatedAmount: updated.actualAmount,
                compensationStatus: newStatus,
                creditNoteNumber:
                  updated.creditNoteNumber || d.creditNoteNumber,
                creditNoteDate: updated.creditNoteDate || d.creditNoteDate,
                updatedAt: new Date().toISOString(),
              };
              cloud(
                "pushInventoryDispositionToSupabase",
                pushInventoryDispositionToSupabase(updD),
              );
              return updD;
            }
            return d;
          });
          if (touched) saveInventoryDispositions(nextDisps).catch(() => {});
          return nextDisps;
        });
      }
      return next;
    });
    notify("Supplier credit note updated successfully.");
  }

  function deleteSupplierCreditNote(id: string) {
    const note = supplierCreditNotes.find((n) => n.id === id);
    try {
      const tombstones = new Set(
        JSON.parse(
          localStorage.getItem("deleted_supplier_credit_note_ids") || "[]",
        ),
      );
      tombstones.add(id);
      localStorage.setItem(
        "deleted_supplier_credit_note_ids",
        JSON.stringify(Array.from(tombstones)),
      );
    } catch {}

    if (note) {
      setInventoryDispositions((prev) => {
        let touched = false;
        const next = prev.map((d) => {
          if (
            (note.notes && note.notes.includes(d.id)) ||
            (!(note.notes || "").includes("Linked disposition") &&
              note.creditNoteNumber &&
              d.creditNoteNumber === note.creditNoteNumber)
          ) {
            touched = true;
            const updatedDisp: InventoryDisposition = {
              ...d,
              compensationStatus: "pending",
              compensatedAmount: 0,
              creditNoteNumber: undefined,
              creditNoteDate: undefined,
              updatedAt: new Date().toISOString(),
            };
            cloud(
              "pushInventoryDispositionToSupabase",
              pushInventoryDispositionToSupabase(updatedDisp),
            );
            return updatedDisp;
          }
          return d;
        });
        if (touched) saveInventoryDispositions(next).catch(() => {});
        return next;
      });
    }

    setSupplierCreditNotes((prev) => {
      const next = prev.filter((n) => n.id !== id);
      saveSupplierCreditNotes(next).catch(() => {});
      return next;
    });
    cloud(
      "deleteSupplierCreditNoteFromSupabase",
      deleteSupplierCreditNoteFromSupabase(id),
    );
    notify("Supplier credit note deleted successfully.");
  }

  function recordSupplierCreditNoteReceipt(
    id: string,
    params: {
      actualAmount: number;
      creditNoteNumber?: string;
      creditNoteDate?: string;
      attachmentRef?: string;
      notes?: string;
    },
  ) {
    updateSupplierCreditNote(id, {
      actualAmount: Math.max(0, Number(params.actualAmount) || 0),
      creditNoteNumber: params.creditNoteNumber,
      creditNoteDate: params.creditNoteDate,
      attachmentRef: params.attachmentRef,
      notes: params.notes,
    });
  }

  function addInventoryDisposition(
    d: Omit<
      InventoryDisposition,
      "id" | "createdAt" | "updatedAt" | "stockApplied" | "costValue"
    > & { costValue?: number; stockApplied?: boolean },
  ):
    | { ok: true; disposition: InventoryDisposition }
    | { ok: false; error: string } {
    const qty = Number(d.quantity) || 0;
    if (qty <= 0)
      return { ok: false, error: "Quantity must be greater than zero" };
    if (!d.productId) return { ok: false, error: "Product is required" };
    if (!d.warehouseId) return { ok: false, error: "Warehouse is required" };

    const willReduceStock = d.stockApplied !== false;
    if (willReduceStock && d.batchId) {
      const batch = inventoryBatchesRef.current.find((b) => b.id === d.batchId);
      if (!batch) return { ok: false, error: "Selected batch not found" };
      if (batch.warehouseId !== d.warehouseId)
        return { ok: false, error: "Batch does not belong to this warehouse" };
      let used = 0;
      for (const bl of bills) {
        for (const it of bl.items) {
          for (const al of it.batchAllocations || [])
            if (al.batchId === d.batchId) used += Number(al.qty) || 0;
        }
      }
      for (const dp of inventoryDispositions) {
        if (dp.stockApplied !== false && dp.batchId === d.batchId)
          used += Number(dp.quantity) || 0;
      }
      const availableInBatch = (Number(batch.quantity) || 0) - used;
      if (availableInBatch + 0.0001 < qty)
        return {
          ok: false,
          error: `Only ${Math.max(0, availableInBatch)} cases available in this batch`,
        };
    } else if (willReduceStock) {
      const row = productWarehouseStock(d.productId).find(
        (r) => r.warehouseId === d.warehouseId,
      );
      const available = row ? row.crates : 0;
      if (available + 0.0001 < qty)
        return {
          ok: false,
          error: `Only ${Math.max(0, available)} cases available in this warehouse`,
        };
    }

    const costPer = Number(d.costPerUnit) || 0;
    const costValue =
      d.costValue !== undefined ? Number(d.costValue) : costPer * qty;
    const now = new Date().toISOString();
    const newDisp: InventoryDisposition = {
      ...d,
      id:
        "disp_" +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 6),
      quantity: qty,
      costPerUnit: costPer,
      costValue,
      unit: d.unit || "case",
      compensationStatus: d.compensationStatus || "not_applicable",
      reason: d.reason || "",
      stockApplied: d.stockApplied === false ? false : true,
      createdAt: now,
      updatedAt: now,
    };

    setInventoryDispositions((prev) => {
      const next = [newDisp, ...prev];
      saveInventoryDispositions(next).catch(() => {});
      return next;
    });
    cloud(
      "pushInventoryDispositionToSupabase",
      pushInventoryDispositionToSupabase(newDisp),
    );
    return { ok: true, disposition: newDisp };
  }

  function updateInventoryDisposition(
    id: string,
    updates: Partial<InventoryDisposition>,
  ) {
    setInventoryDispositions((prev) => {
      const next = prev.map((row) => {
        if (row.id !== id) return row;
        const merged = {
          ...row,
          ...updates,
          id,
          updatedAt: new Date().toISOString(),
        };
        return merged;
      });
      const updated = next.find((r) => r.id === id);
      if (updated)
        cloud(
          "pushInventoryDispositionToSupabase",
          pushInventoryDispositionToSupabase(updated),
        );
      return next;
    });
  }

  function deleteInventoryDisposition(
    id: string,
    _opts?: { restoreStock?: boolean },
  ) {
    addDispositionTombstone(id);
    const linked = supplierCreditNotes.filter((n) =>
      (n.notes || "").includes(`Linked disposition ${id}`),
    );
    linked.forEach((n) => {
      try {
        const t = new Set(
          JSON.parse(
            localStorage.getItem("deleted_supplier_credit_note_ids") || "[]",
          ),
        );
        t.add(n.id);
        localStorage.setItem(
          "deleted_supplier_credit_note_ids",
          JSON.stringify(Array.from(t)),
        );
      } catch {}
    });
    if (linked.length > 0) {
      const ids = new Set(linked.map((n) => n.id));
      setSupplierCreditNotes((prev) => prev.filter((n) => !ids.has(n.id)));
      linked.forEach((n) =>
        cloud(
          "deleteSupplierCreditNoteFromSupabase",
          deleteSupplierCreditNoteFromSupabase(n.id),
        ),
      );
    }
    setInventoryDispositions((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveInventoryDispositions(next).catch(() => {});
      return next;
    });
    cloud(
      "deleteInventoryDispositionFromSupabase",
      deleteInventoryDispositionFromSupabase(id),
    );
  }

  function recordDispositionCompensation(
    id: string,
    params: {
      compensatedAmount: number;
      creditNoteNumber?: string;
      creditNoteDate?: string;
      cnTaxableValue?: number;
      cnCgst?: number;
      cnSgst?: number;
      cnIgst?: number;
      cnTotal?: number;
      notes?: string;
      costValue?: number;
      appendPayment?: boolean;
      paymentNote?: string;
      attachmentRef?: string;
    },
  ) {
    const row0 = inventoryDispositions.find((r) => r.id === id);
    if (!row0) return;
    const newCostValue =
      params.costValue !== undefined && Number(params.costValue) > 0
        ? Number(params.costValue)
        : undefined;
    const row =
      newCostValue !== undefined ? { ...row0, costValue: newCostValue } : row0;
    const priorPaid = Math.max(0, Number(row0.compensatedAmount) || 0);
    const incoming = Math.max(0, Number(params.compensatedAmount) || 0);
    const amt = params.appendPayment ? priorPaid + incoming : incoming;
    const comparable =
      Number(params.cnTaxableValue) > 0 ? Number(params.cnTaxableValue) : amt;
    const status =
      amt <= 0
        ? "pending"
        : comparable + 0.009 >= (row.costValue || 0)
          ? "settled"
          : "partial";
    const cnNo = params.creditNoteNumber ?? row.creditNoteNumber;
    const cnDate = params.creditNoteDate ?? row.creditNoteDate;

    const prevPayments = Array.isArray(row0.compensationPayments)
      ? row0.compensationPayments
      : [];
    let nextPayments = prevPayments;
    if (incoming > 0) {
      nextPayments = [
        ...prevPayments,
        {
          id:
            "cnpay_" +
            Date.now().toString(36) +
            Math.random().toString(36).slice(2, 5),
          date: cnDate || todayISO(),
          amount: params.appendPayment ? incoming : incoming,
          cnNumber: cnNo,
          note: params.paymentNote || params.notes,
        },
      ];
    }

    updateInventoryDisposition(id, {
      ...(newCostValue !== undefined
        ? {
            costValue: newCostValue,
            costPerUnit:
              row.quantity > 0 ? newCostValue / row.quantity : row.costPerUnit,
          }
        : {}),
      compensatedAmount: amt,
      compensationStatus: status as InventoryDisposition["compensationStatus"],
      compensatedAt: todayISO(),
      creditNoteNumber: cnNo,
      creditNoteDate: cnDate,
      cnTaxableValue: params.cnTaxableValue ?? row.cnTaxableValue,
      cnCgst: params.cnCgst ?? row.cnCgst,
      cnSgst: params.cnSgst ?? row.cnSgst,
      cnIgst: params.cnIgst ?? row.cnIgst,
      cnTotal: params.cnTotal ?? row.cnTotal,
      notes: params.notes ?? row.notes,
      compensationPayments: nextPayments,
      ...(params.attachmentRef !== undefined
        ? { attachmentRef: params.attachmentRef }
        : {}),
    });

    if (amt > 0 && (row.supplierName || cnNo)) {
      const expected = Math.max(row.costValue || 0, amt);
      const notePayload = {
        supplierName: row.supplierName || "Supplier",
        grnId: row.grnId,
        productId: row.productId,
        creditNoteNumber: cnNo,
        creditNoteDate: cnDate,
        expectedAmount: expected,
        actualAmount: amt,
        attachmentRef: params.attachmentRef || row0.attachmentRef,
        notes: `Linked disposition ${id}${row.batchNumber ? ` · batch ${row.batchNumber}` : ""}${row.reason ? ` · ${row.reason}` : ""}`,
      };
      const normalizedCnNo = (cnNo || "").trim();
      const existing =
        supplierCreditNotes.find((n) =>
          (n.notes || "").includes(`Linked disposition ${id}`),
        ) ||
        supplierCreditNotes.find(
          (n) =>
            normalizedCnNo &&
            (n.creditNoteNumber || "").trim().toLowerCase() ===
              normalizedCnNo.toLowerCase() &&
            (n.supplierName || "").trim().toLowerCase() ===
              (notePayload.supplierName || "").trim().toLowerCase(),
        );
      if (existing) {
        updateSupplierCreditNote(existing.id, {
          actualAmount: amt,
          creditNoteNumber: normalizedCnNo || undefined,
          creditNoteDate: cnDate,
          notes: notePayload.notes,
          attachmentRef: notePayload.attachmentRef,
        });
      } else {
        addSupplierCreditNote({
          ...notePayload,
          creditNoteNumber: normalizedCnNo || undefined,
        });
      }
    }
  }

  return {
    addSupplierScheme,
    updateSupplierScheme,
    deleteSupplierScheme,
    addSupplierSchemeApplication,
    addSupplierCreditNote,
    updateSupplierCreditNote,
    deleteSupplierCreditNote,
    recordSupplierCreditNoteReceipt,
    addInventoryDisposition,
    updateInventoryDisposition,
    deleteInventoryDisposition,
    recordDispositionCompensation,
  };
}
