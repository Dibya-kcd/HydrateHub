import React from "react";
import { DEMO_PRESETS } from "../../constants/demoPresets";
import {
  DEFAULT_BILLING_SETTINGS,
  DEFAULT_ORG_PROFILE,
  INIT_WAREHOUSES,
} from "../../constants/initialData";
import { pushPaymentsToSupabase } from "../../lib/supabase";
import type {
  Audit,
  Bill,
  BillingSettings,
  CartState,
  Customer,
  DemoPresetId,
  FontSize,
  GRN,
  GstMode,
  InventoryBatch,
  InventoryDisposition,
  OrganizationProfile,
  PaymentRecord,
  Product,
  Promotion,
  StockTransfer,
  SupplierCreditNote,
  SupplierScheme,
  SupplierSchemeApplication,
  Trip,
  Warehouse,
} from "../../types";
import { todayISO } from "../../utils/dateLocal";
import {
  type BusinessExpenseRecord,
  saveBillingSettings,
  savePayments,
} from "../../utils/storage";
import {
  STORAGE_KEY,
  addPaymentTombstones,
  emptyCart,
  purgeLegacyLocalStorageKeys,
} from "../ledgerHelpers";
import type { PullFromCloudOptions } from "../ledgerTypes";

export interface UseDataManagementActionsParams {
  orgProfile: OrganizationProfile;
  setOrgProfile: React.Dispatch<React.SetStateAction<OrganizationProfile>>;
  billingSettings: BillingSettings;
  billingSettingsRef: React.MutableRefObject<BillingSettings | null>;
  setBillingSettings: React.Dispatch<React.SetStateAction<BillingSettings>>;
  grns: GRN[];
  setGrns: React.Dispatch<React.SetStateAction<GRN[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  warehouses: Warehouse[];
  setWarehouses: React.Dispatch<React.SetStateAction<Warehouse[]>>;
  inventoryBatches: InventoryBatch[];
  setInventoryBatches: React.Dispatch<React.SetStateAction<InventoryBatch[]>>;
  stockTransfers: StockTransfer[];
  setStockTransfers: React.Dispatch<React.SetStateAction<StockTransfer[]>>;
  promotions: Promotion[];
  setPromotions: React.Dispatch<React.SetStateAction<Promotion[]>>;
  supplierSchemes: SupplierScheme[];
  setSupplierSchemes: React.Dispatch<React.SetStateAction<SupplierScheme[]>>;
  supplierSchemeApplications: SupplierSchemeApplication[];
  setSupplierSchemeApplications: React.Dispatch<React.SetStateAction<SupplierSchemeApplication[]>>;
  supplierCreditNotes: SupplierCreditNote[];
  setSupplierCreditNotes: React.Dispatch<React.SetStateAction<SupplierCreditNote[]>>;
  expenses: BusinessExpenseRecord[];
  setExpenses: React.Dispatch<React.SetStateAction<BusinessExpenseRecord[]>>;
  allBills: Bill[];
  setBills: (u: Bill[] | ((prev: Bill[]) => Bill[])) => void;
  trips: Trip[];
  setTrips: (u: Trip[] | ((prev: Trip[]) => Trip[])) => void;
  audits: Audit[];
  setAudits: React.Dispatch<React.SetStateAction<Audit[]>>;
  gstMode: GstMode;
  setGstMode: React.Dispatch<React.SetStateAction<GstMode>>;
  payments: PaymentRecord[];
  setPayments: React.Dispatch<React.SetStateAction<PaymentRecord[]>>;
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  setInventoryDispositions: React.Dispatch<React.SetStateAction<InventoryDisposition[]>>;
  setCart: React.Dispatch<React.SetStateAction<CartState>>;
  setEditingBillId: React.Dispatch<React.SetStateAction<number | null>>;
  setJustFinalizedBillId: React.Dispatch<React.SetStateAction<number | null>>;
  setActiveGrnToEdit: React.Dispatch<React.SetStateAction<GRN | null>>;
  setFontSize: React.Dispatch<React.SetStateAction<FontSize>>;
  setHighContrast: React.Dispatch<React.SetStateAction<boolean>>;
  pullFromCloud: (
    opts?: PullFromCloudOptions,
  ) => Promise<{ success: boolean; message: string }>;
}

export function useDataManagementActions({
  orgProfile,
  setOrgProfile,
  billingSettings,
  billingSettingsRef,
  setBillingSettings,
  grns,
  setGrns,
  products,
  setProducts,
  warehouses,
  setWarehouses,
  inventoryBatches,
  setInventoryBatches,
  stockTransfers,
  setStockTransfers,
  promotions,
  setPromotions,
  supplierSchemes,
  setSupplierSchemes,
  supplierSchemeApplications,
  setSupplierSchemeApplications,
  supplierCreditNotes,
  setSupplierCreditNotes,
  expenses,
  setExpenses,
  allBills,
  setBills,
  trips,
  setTrips,
  audits,
  setAudits,
  gstMode,
  setGstMode,
  payments,
  setPayments,
  setCustomers,
  setInventoryDispositions,
  setCart,
  setEditingBillId,
  setJustFinalizedBillId,
  setActiveGrnToEdit,
  setFontSize,
  setHighContrast,
  pullFromCloud,
}: UseDataManagementActionsParams) {
  const deleteLocalDatabase = () => {
    try {
      purgeLegacyLocalStorageKeys();
    } catch (e) {
      console.warn("Error purging local storage:", e);
    }
    pullFromCloud();
  };

  const loadSampleGrn = () => {
    // Deprecated: sample data removed to maintain a clean database
  };

  const resetPaymentsWithInvoices = () => {
    const hadPayments = payments.length > 0;
    addPaymentTombstones(payments.map((p) => p.id));
    setPayments([]);
    if (hadPayments) {
      savePayments([]).catch(() => {});
      pushPaymentsToSupabase([], true).catch(() => {});
    }
  };

  const loadDemoPreset = (presetId: DemoPresetId) => {
    const preset = DEMO_PRESETS[presetId];
    if (!preset) return;
    setProducts(preset.products);
    setPromotions(preset.promotions);
    setBills(preset.bills);
    resetPaymentsWithInvoices();
    setTrips(preset.trips);
    setOrgProfile(preset.orgProfile);
    setCart(emptyCart());
    setEditingBillId(null);
    setJustFinalizedBillId(null);
  };

  const clearTransactions = () => {
    setBills([]);
    resetPaymentsWithInvoices();
    setTrips([]);
    setAudits([]);
    setStockTransfers([]);
    setCart(emptyCart());
    setEditingBillId(null);
    setJustFinalizedBillId(null);
  };

  const clearAllData = () => {
    setGrns([]);
    setProducts([]);
    setWarehouses(INIT_WAREHOUSES);
    setInventoryBatches([]);
    setStockTransfers([]);
    setPromotions([]);
    setBills([]);
    setTrips([]);
    setAudits([]);
    setCustomers([]);
    setPayments([]);
    setSupplierSchemes([]);
    setSupplierCreditNotes([]);
    setInventoryDispositions([]);
    setCart(emptyCart());
    setEditingBillId(null);
    setJustFinalizedBillId(null);
    setActiveGrnToEdit(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("mrwater_customers");
      localStorage.removeItem("mrwater_payments");
      localStorage.removeItem("mrwater_supplier_schemes");
      localStorage.removeItem("mrwater_supplier_credit_notes");
      localStorage.removeItem("mrwater_inventory_dispositions");
      localStorage.removeItem("mrwater_expenses_v1");
      localStorage.removeItem("mrwater_biz_expenses_v1");
      setExpenses([]);
    } catch {
      // ignore
    }
  };

  const cleanDatabase = clearAllData;

  const exportBackup = () => {
    try {
      const backupData = {
        app: "Hydrate Hub",
        version: "4.0",
        exportDate: new Date().toISOString(),
        orgProfile,
        billingSettings,
        grns,
        products,
        warehouses,
        inventoryBatches,
        stockTransfers,
        promotions,
        supplierSchemes,
        supplierSchemeApplications,
        supplierCreditNotes,
        expenses,
        bills: allBills,
        trips,
        audits,
        gstMode,
      };
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], {
        type: "application/json;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeName = (orgProfile.name || "hydrate_hub")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .slice(0, 20);
      link.download = `${safeName}_backup_${todayISO()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export backup:", err);
    }
  };

  const importBackup = (
    jsonString: string,
  ): { success: boolean; error?: string } => {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== "object") {
        return {
          success: false,
          error: "Invalid file: JSON root must be an object",
        };
      }
      if (Array.isArray(data.grns)) setGrns(data.grns);
      if (Array.isArray(data.products)) setProducts(data.products);
      if (Array.isArray(data.warehouses)) setWarehouses(data.warehouses);
      if (Array.isArray(data.inventoryBatches))
        setInventoryBatches(data.inventoryBatches);
      if (Array.isArray(data.stockTransfers))
        setStockTransfers(data.stockTransfers);
      if (Array.isArray(data.promotions)) setPromotions(data.promotions);
      if (Array.isArray(data.supplierSchemes))
        setSupplierSchemes(data.supplierSchemes);
      if (Array.isArray(data.supplierSchemeApplications))
        setSupplierSchemeApplications(data.supplierSchemeApplications);
      if (Array.isArray(data.supplierCreditNotes))
        setSupplierCreditNotes(data.supplierCreditNotes);
      if (Array.isArray(data.expenses)) setExpenses(data.expenses);
      if (Array.isArray(data.bills)) setBills(data.bills);
      if (Array.isArray(data.trips)) setTrips(data.trips);
      if (Array.isArray(data.audits)) setAudits(data.audits);
      if (data.orgProfile && typeof data.orgProfile === "object") {
        setOrgProfile((prev) => ({ ...prev, ...data.orgProfile }));
      }
      if (data.billingSettings && typeof data.billingSettings === "object") {
        const importedBilling = {
          ...(billingSettingsRef.current || DEFAULT_BILLING_SETTINGS),
          ...data.billingSettings,
          updatedAt: new Date().toISOString(),
        } as BillingSettings;
        setBillingSettings(importedBilling);
        saveBillingSettings(importedBilling).catch(() => {});
      }
      if (data.gstMode) setGstMode(data.gstMode === "off" ? "off" : "inclusive");
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Failed to parse JSON backup file",
      };
    }
  };

  function resetToDefault() {
    cleanDatabase();
    setGstMode("inclusive");
    setFontSize("large");
    setHighContrast(false);
    setOrgProfile(DEFAULT_ORG_PROFILE);
    setBillingSettings(DEFAULT_BILLING_SETTINGS);
    saveBillingSettings(DEFAULT_BILLING_SETTINGS).catch(() => {});
  }

  return {
    deleteLocalDatabase,
    loadSampleGrn,
    loadDemoPreset,
    clearTransactions,
    clearAllData,
    cleanDatabase,
    exportBackup,
    importBackup,
    resetToDefault,
  };
}
