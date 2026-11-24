import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLedger } from "../../context/LedgerContext";
import { useLanguage } from "../../i18n/LanguageContext";
import { useAutoOdiaNameMap } from "../../hooks/useAutoOdiaName";
import { useIsMobile } from "../../hooks/useIsMobile";
import {
  Customer,
  ExistingCustomer,
} from "../../types";
import { billBalance } from "../../utils/salesReturns";
import { useBeats } from "../../hooks/useBeats";
import { ConfirmModal } from "../ui";
import { findDuplicateCustomer, normCustName } from "../../context/ledgerHelpers";
import { last10Of } from "../../context/ledgerCustomerCalculations";
import { confirmDialog } from "../../utils/dialogs";
import { realLast10Phone } from "../../utils/customerDedupe";
import { validatePhone, validateGstin } from "../../utils/validation";
import {
  type SupplierMaster,
  loadSuppliers,
  saveSuppliers,
  seedFromGrns,
} from "./customers/supplierStore";
import {
  emptyCustomerForm,
  emptySupplierForm,
  parseCustomerNotes,
  type PartyTab,
} from "./customers/customerFormUtils";
import { CustomerDetailView } from "./customers/CustomerDetailView";
import { SupplierDetailView } from "./customers/SupplierDetailView";
import { PartyFormView } from "./customers/PartyFormView";
import { CustomersPhoneList } from "./customers/CustomersPhoneList";
import { CustomersDesktopList } from "./customers/CustomersDesktopList";

export type { SupplierMaster };

export const CustomersView: React.FC = () => {
  const { activeBeats, beats, customerBeat } = useBeats();
  const {
    customers,
    existingCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    startBillForCustomer,
    grns,
    getCustomerLedger,
    recordCustomerPayment,
    getCustomerCreditSummary,
    applyAdvanceToInvoices,
    recordCustomerRefund,
    products,
    palette,
    billingSettings,
    bills,
    orgProfile,
    customerNameClash,
    openCanonicalAction,
    pendingCanonicalAction,
    clearPendingCanonicalAction,
  } = useLedger();
  const { language, t } = useLanguage();
  const isPhone = useIsMobile(1023);
  const customerNameMap = useAutoOdiaNameMap(customers || []);

  const [partyTab, setPartyTab] = useState<PartyTab>("customers");
  const [searchTerm, setSearchTerm] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [phoneDetailTab, setPhoneDetailTab] = useState<"summary" | "ledger">("summary");
  const [ledgerFilter, setLedgerFilter] = useState<"all" | "bill" | "payment" | "return">("all");
  const [expandedLedgerEntryId, setExpandedLedgerEntryId] = useState<string | null>(null);
  const [phoneFilterSheetOpen, setPhoneFilterSheetOpen] = useState(false);
  const [waPhonePrompt, setWaPhonePrompt] = useState<{ text: string; input: string } | null>(null);
  const [showMoreFormFields, setShowMoreFormFields] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingDerivedCustomer, setEditingDerivedCustomer] =
    useState<ExistingCustomer | null>(null);
  const [clashConfirm, setClashConfirm] = useState<{
    clash: Customer;
    commit: () => void;
  } | null>(null);
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm());
  const [selectedCustomer, setSelectedCustomer] =
    useState<ExistingCustomer | null>(null);
  const [customerToDelete, setCustomerToDelete] =
    useState<ExistingCustomer | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Customer ledger actions
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showRefund, setShowRefund] = useState(false);

  // Suppliers master
  const [suppliers, setSuppliers] = useState<SupplierMaster[]>([]);
  const [editingSupplier, setEditingSupplier] = useState<SupplierMaster | null>(
    null,
  );
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm());
  const [selectedSupplier, setSelectedSupplier] =
    useState<SupplierMaster | null>(null);
  const [supplierToDelete, setSupplierToDelete] =
    useState<SupplierMaster | null>(null);
  const [customerFilter, setCustomerFilter] = useState<"all" | "due" | "advance">("all");
  // Beat filter: "all", a beat id, or "none" (customers not in any beat yet).
  const [beatFilter, setBeatFilter] = useState<string>("all");
  const [beatMenuOpen, setBeatMenuOpen] = useState(false);
  const beatMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!beatMenuOpen) return;
    const onDocDown = (e: MouseEvent | TouchEvent) => {
      if (beatMenuRef.current && !beatMenuRef.current.contains(e.target as Node)) {
        setBeatMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
    };
  }, [beatMenuOpen]);

  useEffect(() => {
    const loaded = loadSuppliers();
    const seeded = seedFromGrns(grns || [], loaded);
    if (seeded !== loaded) saveSuppliers(seeded);
    setSuppliers(seeded);
  }, [grns]);

  useEffect(() => {
    try {
      const returnCustId = window.sessionStorage.getItem("hh_return_customer_id");
      if (returnCustId) {
        window.sessionStorage.removeItem("hh_return_customer_id");
        const matched =
          existingCustomers.find((ec) => ec.id === returnCustId) ||
          existingCustomers.find((ec) => normCustName(ec.name) === normCustName(returnCustId));
        if (matched) {
          setSelectedCustomer(matched);
        }
      }
    } catch {
      /* ignore */
    }
  }, [existingCustomers]);

  useEffect(() => {
    if (!pendingCanonicalAction || pendingCanonicalAction.entityType !== "customer") return;
    const targetId = String(pendingCanonicalAction.entityId);
    const matched =
      existingCustomers.find((ec) => ec.id === targetId) ||
      existingCustomers.find((ec) => normCustName(ec.name) === normCustName(targetId));
    const action = pendingCanonicalAction.action;
    clearPendingCanonicalAction();
    if (!matched) return;
    setSelectedCustomer(matched);
    if (action === "edit") {
      openEditCustomer(matched);
    } else if (action === "delete") {
      setCustomerToDelete(matched);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCanonicalAction, existingCustomers]);

  const advanceCount = useMemo(() => {
    return existingCustomers.filter(
      (c) => (c.advance || 0) > 0.004
    ).length;
  }, [existingCustomers]);

  const dueCount = useMemo(() => {
    return existingCustomers.filter((c) => (c.balanceDue || 0) > 0.004).length;
  }, [existingCustomers]);

  // beat id of each customer by master id (with unambiguous same-name fallback) and how many customers each beat has
  const { beatIdByCustomer, beatIdByName } = useMemo(() => {
    const byId = new Map<string, string>();
    const phonesByName = new Map<string, Set<string>>();
    const candidateByName = new Map<string, string>();
    for (const c of customers || []) {
      const bid = customerBeat(c)?.id || "";
      byId.set(c.id, bid);
      const k = normCustName(c.name);
      if (!k) continue;
      const p10 = realLast10Phone(c.phone);
      if (p10) {
        let s = phonesByName.get(k);
        if (!s) {
          s = new Set<string>();
          phonesByName.set(k, s);
        }
        s.add(p10);
      }
      if (bid && !candidateByName.has(k)) candidateByName.set(k, bid);
    }
    const byName = new Map<string, string>();
    for (const [k, bid] of candidateByName) {
      if ((phonesByName.get(k)?.size || 0) <= 1) byName.set(k, bid);
    }
    return { beatIdByCustomer: byId, beatIdByName: byName };
  }, [customers, customerBeat]);
  const beatIdForExisting = useCallback(
    (ec: ExistingCustomer): string =>
      (ec.id && beatIdByCustomer.get(ec.id)) ||
      beatIdByName.get(normCustName(ec.name)) ||
      "",
    [beatIdByCustomer, beatIdByName],
  );
  const beatCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let none = 0;
    for (const ec of existingCustomers) {
      const b = beatIdForExisting(ec);
      if (b) counts.set(b, (counts.get(b) || 0) + 1);
      else none++;
    }
    return { counts, none };
  }, [existingCustomers, beatIdForExisting]);

  const filteredCustomers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = existingCustomers;
    if (beatFilter !== "all") {
      list = list.filter((c) => {
        const b = beatIdForExisting(c);
        return beatFilter === "none" ? !b : b === beatFilter;
      });
    }
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          ((c as any).nameOr || "").toLowerCase().includes(q) ||
          (c.phone || "").includes(q) ||
          (c.gstin || "").toLowerCase().includes(q) ||
          (c.city || "").toLowerCase().includes(q) ||
          (c.address || "").toLowerCase().includes(q),
      );
    }
    if (customerFilter === "due") {
      list = list.filter((c) => (c.balanceDue || 0) > 0.004);
    } else if (customerFilter === "advance") {
      list = list.filter(
        (c) => (c.advance || 0) > 0.004
      );
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [existingCustomers, searchTerm, customerFilter, beatFilter, beatIdForExisting]);

  const filteredSuppliers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = suppliers;
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.phone || "").includes(q) ||
          (s.gstin || "").toLowerCase().includes(q) ||
          (s.email || "").toLowerCase().includes(q) ||
          (s.city || "").toLowerCase().includes(q) ||
          (s.address || "").toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers, searchTerm]);

  const grnCountBySupplier = useMemo(() => {
    const map = new Map<string, number>();
    (grns || []).forEach((g) => {
      const k = (g.supplierName || "").trim().toLowerCase();
      if (!k) return;
      map.set(k, (map.get(k) || 0) + 1);
    });
    return map;
  }, [grns]);

  const { customerTypeById, customerTypeByName, beatNameById } = useMemo(() => {
    const byId = new Map<string, string>();
    const byName = new Map<string, string>();
    const beatNames = new Map<string, string>();
    for (const b of beats) beatNames.set(b.id, b.name);
    for (const c of customers || []) {
      const tp = parseCustomerNotes(c.notes).customerType || "Retail";
      byId.set(c.id, tp);
      const k = normCustName(c.name);
      if (k && !byName.has(k)) byName.set(k, tp);
    }
    return { customerTypeById: byId, customerTypeByName: byName, beatNameById: beatNames };
  }, [customers, beats]);

  const oldestDueDaysByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    const now = Date.now();
    for (const b of bills || []) {
      if (b.status === "cancelled" || b.cancelled) continue;
      if (billBalance(b) <= 0.004) continue;
      const k = normCustName(b.retailer || "");
      if (!k || !b.date) continue;
      const dt = new Date(b.date.length === 10 ? `${b.date}T12:00:00` : b.date);
      if (isNaN(dt.getTime())) continue;
      const days = Math.max(0, Math.floor((now - dt.getTime()) / 86400000));
      const prev = map.get(k);
      if (prev === undefined || days > prev) map.set(k, days);
    }
    return map;
  }, [bills]);

  /* ─── Customer form handlers ─── */
  const openAddCustomer = () => {
    setEditingCustomer(null);
    setEditingDerivedCustomer(null);
    setClashConfirm(null);
    setCustomerForm(emptyCustomerForm());
    setFormError(null);
    setFormOpen(true);
  };

  const openEditCustomer = (ec: ExistingCustomer) => {
    const targetNorm = normCustName(ec.name);
    const exactById = ec.id ? customers.find((c) => c.id === ec.id) : undefined;
    const sameNameList = customers.filter((c) => normCustName(c.name) === targetNorm);
    const full =
      (exactById && customerBeat(exactById) ? exactById : undefined) ||
      sameNameList.find((c) => Boolean(customerBeat(c))) ||
      exactById ||
      sameNameList[0];
    const parsedNotes = parseCustomerNotes(full?.notes);
    setEditingCustomer(full || null);
    setEditingDerivedCustomer(full ? null : ec);
    setClashConfirm(null);
    setCustomerForm({
      name: full?.name || ec.name || "",
      nameOr: full?.nameOr || (ec as any).nameOr || "",
      contactPerson: parsedNotes.contactPerson,
      phone: full?.phone || ec.phone || "",
      customerType: parsedNotes.customerType,
      priceList: parsedNotes.priceList,
      gstRegistered: !!(full?.gstin || ec.gstin),
      state: parsedNotes.state,
      address: full?.address || ec.address || "",
      pan: parsedNotes.pan,
      fssai: parsedNotes.fssai,
      beat: customerBeat(full)?.name || full?.route || full?.city || ec.city || "",
      visitOrder: parsedNotes.visitOrder,
      creditLimit: String(full?.creditLimit ?? ec.creditLimit ?? 0),
      creditDays: parsedNotes.creditDays,
      openingBalance: String(full?.openingBalance ?? ec.openingBalance ?? 0),
      gstin: full?.gstin || ec.gstin || "",
    });
    setFormError(null);
    setFormOpen(true);
  };

  const saveCustomer = async () => {
    const name = customerForm.name.trim();
    if (!name) {
      setFormError("Shop / business name is required");
      return;
    }
    const phoneErr = customerForm.phone.trim()
      ? validatePhone(customerForm.phone, { label: "Phone" })
      : null;
    if (phoneErr) {
      setFormError(phoneErr);
      return;
    }
    const gstinErr = validateGstin(customerForm.gstin || "", { label: "GSTIN" });
    if (gstinErr) {
      setFormError(gstinErr);
      return;
    }
    const beatMatch =
      activeBeats.find((b) => b.name === customerForm.beat.trim()) ||
      beats.find((b) => b.name === customerForm.beat.trim());
    const payload = {
      name,
      nameOr: customerForm.nameOr.trim() || undefined,
      phone: customerForm.phone.trim(),
      address: customerForm.address.trim() || undefined,
      city: customerForm.beat.trim() || undefined,
      route: customerForm.beat.trim() || undefined,
      // linked by id so renaming the beat never loses this customer
      beatId: beatMatch?.id,
      gstin: customerForm.gstRegistered
        ? customerForm.gstin.trim() || undefined
        : undefined,
      creditLimit: Number(customerForm.creditLimit) || 0,
      openingBalance: Number(customerForm.openingBalance) || 0,
      notes: [
        customerForm.contactPerson && `Contact: ${customerForm.contactPerson}`,
        customerForm.pan && `PAN: ${customerForm.pan}`,
        customerForm.fssai && `FSSAI: ${customerForm.fssai}`,
        customerForm.customerType && `Type: ${customerForm.customerType}`,
        customerForm.priceList && `Price list: ${customerForm.priceList}`,
        customerForm.state && `State: ${customerForm.state}`,
        customerForm.creditDays && `Credit days: ${customerForm.creditDays}`,
        customerForm.visitOrder && `Visit order: ${customerForm.visitOrder}`,
      ]
        .filter(Boolean)
        .join(" · "),
    };

    const syncSelectedDetail = (saved: Customer) => {
      setSelectedCustomer((prev) =>
        prev
          ? {
              ...prev,
              id: saved.id,
              name: saved.name,
              nameOr: saved.nameOr,
              phone: saved.phone,
              address: saved.address,
              city: saved.city,
              gstin: saved.gstin,
              creditLimit: saved.creditLimit,
              openingBalance: saved.openingBalance,
            }
          : null,
      );
    };

    if (editingCustomer) {
      const commit = () => {
        const saved = updateCustomer({
          ...editingCustomer,
          ...payload,
          updatedAt: new Date().toISOString(),
        });
        syncSelectedDetail(saved);
        setClashConfirm(null);
        setFormOpen(false);
        setEditingCustomer(null);
        setEditingDerivedCustomer(null);
      };
      const clash = customerNameClash(editingCustomer.id, name, {
        oldName: editingCustomer.name,
        phone: payload.phone,
      });
      if (clash) {
        setClashConfirm({ clash, commit });
        return;
      }
      commit();
      return;
    }

    if (editingDerivedCustomer) {
      const derivedId =
        editingDerivedCustomer.id ||
        `cust_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const commit = () => {
        const saved = updateCustomer(
          {
            id: derivedId,
            ...payload,
            altPhone: editingDerivedCustomer.altPhone,
            createdAt:
              editingDerivedCustomer.lastBillDate || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          true,
          {
            name: editingDerivedCustomer.name,
            phone: editingDerivedCustomer.phone,
          },
        );
        syncSelectedDetail(saved);
        setClashConfirm(null);
        setFormOpen(false);
        setEditingCustomer(null);
        setEditingDerivedCustomer(null);
      };
      const clash = customerNameClash(derivedId, name, {
        oldName: editingDerivedCustomer.name,
        phone: payload.phone,
      });
      if (clash) {
        setClashConfirm({ clash, commit });
        return;
      }
      commit();
      return;
    }

    const { sameShop, samePhone } = findDuplicateCustomer(
      customers || [],
      payload.name,
      payload.phone,
    );
    let useExistingOnPhoneMatch = false;
    if (!sameShop && samePhone) {
      useExistingOnPhoneMatch = await confirmDialog({
        title: "Mobile number already registered",
        message: `Mobile ${last10Of(payload.phone)} already belongs to "${samePhone.name}".`,
        confirmLabel: `Use "${samePhone.name}"`,
        cancelLabel: `Create "${payload.name}" separately`,
        tone: "warning",
      });
    }
    addCustomer(payload, { useExistingOnPhoneMatch });
    setFormOpen(false);
    setEditingCustomer(null);
    setEditingDerivedCustomer(null);
  };

  /* ─── Supplier form handlers ─── */
  const openAddSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm(emptySupplierForm());
    setFormError(null);
    setFormOpen(true);
  };

  const openEditSupplier = (s: SupplierMaster) => {
    setEditingSupplier(s);
    setSupplierForm({
      name: s.name || "",
      contactPerson: s.contactPerson || "",
      phone: s.phone || "",
      email: s.email || "",
      gstRegistered: !!s.gstin,
      gstin: s.gstin || "",
      state: s.state || "21 · Odisha",
      address: s.address || "",
      city: s.city || "",
      pan: s.pan || "",
      notes: s.notes || "",
    });
    setFormError(null);
    setFormOpen(true);
    setSelectedSupplier(null);
  };

  const saveSupplier = () => {
    const name = supplierForm.name.trim();
    if (!name) {
      setFormError("Supplier / company name is required");
      return;
    }
    const phoneErr = supplierForm.phone.trim()
      ? validatePhone(supplierForm.phone, { label: "Supplier phone" })
      : null;
    if (phoneErr) {
      setFormError(phoneErr);
      return;
    }
    const gstinErr = validateGstin(supplierForm.gstin || "", { label: "Supplier GSTIN" });
    if (gstinErr) {
      setFormError(gstinErr);
      return;
    }
    const next: SupplierMaster = {
      id:
        editingSupplier?.id ||
        `sup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      contactPerson: supplierForm.contactPerson.trim() || undefined,
      phone: supplierForm.phone.trim() || undefined,
      email: supplierForm.email.trim() || undefined,
      gstin: supplierForm.gstRegistered
        ? supplierForm.gstin.trim() || undefined
        : undefined,
      state: supplierForm.state || undefined,
      address: supplierForm.address.trim() || undefined,
      city: supplierForm.city.trim() || undefined,
      pan: supplierForm.pan.trim() || undefined,
      notes: supplierForm.notes.trim() || undefined,
      createdAt: editingSupplier?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSuppliers((prev) => {
      const without = prev.filter(
        (x) =>
          x.id !== next.id &&
          x.name.trim().toLowerCase() !== name.toLowerCase(),
      );
      const list = [...without, next].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      saveSuppliers(list);
      return list;
    });
    setFormOpen(false);
    setEditingSupplier(null);
  };

  const deleteSupplier = (id: string) => {
    setSuppliers((prev) => {
      const list = prev.filter((s) => s.id !== id);
      saveSuppliers(list);
      return list;
    });
  };

  const openAdd = () => {
    if (partyTab === "suppliers") openAddSupplier();
    else openAddCustomer();
  };

  const setCField = (
    key: keyof ReturnType<typeof emptyCustomerForm>,
    value: string | boolean,
  ) => setCustomerForm((f) => ({ ...f, [key]: value }));

  const setSField = (
    key: keyof ReturnType<typeof emptySupplierForm>,
    value: string | boolean,
  ) => setSupplierForm((f) => ({ ...f, [key]: value }));

  /* ═══════════ Customer detail + ledger ═══════════ */
  if (selectedCustomer && !formOpen) {
    const custKey = selectedCustomer.id || selectedCustomer.name;
    return (
      <CustomerDetailView
        customer={selectedCustomer}
        isPhone={isPhone}
        language={language}
        t={t}
        customerNameMap={customerNameMap}
        customerTypeById={customerTypeById}
        customerTypeByName={customerTypeByName}
        orgProfile={orgProfile}
        billingSettings={billingSettings}
        products={products}
        existingCustomers={existingCustomers}
        bills={bills}
        palette={palette}
        phoneDetailTab={phoneDetailTab}
        setPhoneDetailTab={setPhoneDetailTab}
        ledgerFilter={ledgerFilter}
        setLedgerFilter={setLedgerFilter}
        expandedLedgerEntryId={expandedLedgerEntryId}
        setExpandedLedgerEntryId={setExpandedLedgerEntryId}
        waPhonePrompt={waPhonePrompt}
        setWaPhonePrompt={setWaPhonePrompt}
        showRecordPayment={showRecordPayment}
        setShowRecordPayment={setShowRecordPayment}
        showRefund={showRefund}
        setShowRefund={setShowRefund}
        onRouteBillAction={(b, action) =>
          openCanonicalAction({
            targetTab: "billing",
            entityType: "bill",
            entityId: b.id,
            action,
            returnTab: "customers",
            returnLabel: `Back to ${selectedCustomer.name}`,
            returnContextId: custKey,
          })
        }
        onRoutePaymentAction={(p, action) =>
          openCanonicalAction({
            targetTab: "payments",
            entityType: "payment",
            entityId: p.id,
            action,
            returnTab: "customers",
            returnLabel: `Back to ${selectedCustomer.name}`,
            returnContextId: custKey,
          })
        }
        customerToDelete={customerToDelete}
        setCustomerToDelete={setCustomerToDelete}
        setSelectedCustomer={setSelectedCustomer}
        openEditCustomer={openEditCustomer}
        startBillForCustomer={startBillForCustomer}
        getCustomerLedger={getCustomerLedger}
        getCustomerCreditSummary={getCustomerCreditSummary}
        applyAdvanceToInvoices={applyAdvanceToInvoices}
        recordCustomerRefund={recordCustomerRefund}
        recordCustomerPayment={recordCustomerPayment}
        deleteCustomer={deleteCustomer}
      />
    );
  }

  /* ═══════════ Supplier detail ═══════════ */
  if (selectedSupplier && !formOpen) {
    return (
      <SupplierDetailView
        supplier={selectedSupplier}
        grnCount={grnCountBySupplier.get(selectedSupplier.name.trim().toLowerCase()) || 0}
        isPhone={isPhone}
        t={t}
        setSelectedSupplier={setSelectedSupplier}
        openEditSupplier={openEditSupplier}
        supplierToDelete={supplierToDelete}
        setSupplierToDelete={setSupplierToDelete}
        deleteSupplier={deleteSupplier}
      />
    );
  }

  /* ═══════════ Forms ═══════════ */
  if (formOpen) {
    return (
      <PartyFormView
        isPhone={isPhone}
        t={t}
        partyTab={partyTab}
        editingSupplier={editingSupplier}
        editingCustomer={editingCustomer}
        editingDerivedCustomer={editingDerivedCustomer}
        formError={formError}
        supplierForm={supplierForm}
        customerForm={customerForm}
        activeBeats={activeBeats}
        showMoreFormFields={showMoreFormFields}
        setShowMoreFormFields={setShowMoreFormFields}
        setSField={setSField}
        setCField={setCField}
        saveSupplier={saveSupplier}
        saveCustomer={saveCustomer}
        setFormOpen={setFormOpen}
        setEditingCustomer={setEditingCustomer}
        setEditingDerivedCustomer={setEditingDerivedCustomer}
        setEditingSupplier={setEditingSupplier}
        clashConfirm={clashConfirm}
        setClashConfirm={setClashConfirm}
      />
    );
  }

  /* ═══════════ Main Parties list ═══════════ */
  const selectedBeatName =
    beatFilter === "all"
      ? t("parties.allBeats", { n: existingCustomers.length })
      : beatFilter === "none"
        ? t("parties.noBeatYet")
        : beatNameById.get(beatFilter) || beatFilter;

  return (
    <div id="view-customers" className="hh-view w-full min-w-0 pb-24">
      {isPhone ? (
        <CustomersPhoneList
          t={t}
          language={language}
          partyTab={partyTab}
          setPartyTab={setPartyTab}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          openAdd={openAdd}
          phoneFilterSheetOpen={phoneFilterSheetOpen}
          setPhoneFilterSheetOpen={setPhoneFilterSheetOpen}
          customerFilter={customerFilter}
          setCustomerFilter={setCustomerFilter}
          beatFilter={beatFilter}
          setBeatFilter={setBeatFilter}
          beats={beats}
          beatCounts={beatCounts}
          existingCustomers={existingCustomers}
          suppliers={suppliers}
          dueCount={dueCount}
          advanceCount={advanceCount}
          filteredSuppliers={filteredSuppliers}
          filteredCustomers={filteredCustomers}
          grnCountBySupplier={grnCountBySupplier}
          selectedBeatName={selectedBeatName}
          oldestDueDaysByCustomer={oldestDueDaysByCustomer}
          customerNameMap={customerNameMap}
          beatIdForExisting={beatIdForExisting}
          beatNameById={beatNameById}
          customerTypeById={customerTypeById}
          customerTypeByName={customerTypeByName}
          setSelectedSupplier={setSelectedSupplier}
          setPhoneDetailTab={setPhoneDetailTab}
          setSelectedCustomer={setSelectedCustomer}
        />
      ) : (
        <CustomersDesktopList
          language={language}
          partyTab={partyTab}
          setPartyTab={setPartyTab}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          openAdd={openAdd}
          beatMenuRef={beatMenuRef}
          beatMenuOpen={beatMenuOpen}
          setBeatMenuOpen={setBeatMenuOpen}
          beatFilter={beatFilter}
          setBeatFilter={setBeatFilter}
          beats={beats}
          beatCounts={beatCounts}
          customerFilter={customerFilter}
          setCustomerFilter={setCustomerFilter}
          existingCustomers={existingCustomers}
          dueCount={dueCount}
          advanceCount={advanceCount}
          filteredSuppliers={filteredSuppliers}
          filteredCustomers={filteredCustomers}
          grnCountBySupplier={grnCountBySupplier}
          customerNameMap={customerNameMap}
          setSelectedSupplier={setSelectedSupplier}
          setSelectedCustomer={setSelectedCustomer}
        />
      )}

      {customerToDelete && (
        <ConfirmModal
          isOpen
          title="Delete customer?"
          subtitle={`${customerToDelete.name}${customerToDelete.phone ? ` · ${customerToDelete.phone}` : ""}`}
          message="Remove this customer from the directory? Past bills and every payment stay in the records."
          impactItems={[
            { label: "Total Bills", detail: `${customerToDelete.totalBills || 0} invoice(s)` },
            { label: "Balance Due", detail: (customerToDelete.balanceDue || 0) > 0 ? `₹${Math.round(customerToDelete.balanceDue)}` : "Settled" },
          ]}
          confirmButtonLabel="Delete Customer"
          variant="danger"
          rectificationPrompt="Reason for deleting customer *"
          rectificationPlaceholder="e.g. Duplicate customer, merged account, business closed"
          reasonPresets={["Duplicate customer", "Merged account", "Business closed", "Test entry"]}
          commentMinLength={4}
          onConfirmWithOptions={({ comment, optionalChecked }) => {
            if (customerToDelete.id) {
              deleteCustomer(customerToDelete.id, comment || undefined, {
                removePayments: optionalChecked,
              });
            }
            setCustomerToDelete(null);
          }}
          onConfirm={() => {}}
          onClose={() => setCustomerToDelete(null)}
        />
      )}

      {supplierToDelete && (
        <ConfirmModal
          isOpen
          title="Delete supplier?"
          subtitle={supplierToDelete.name}
          message="Remove this supplier from the directory? Past GRNs are kept."
          confirmButtonLabel="Delete Supplier"
          variant="danger"
          rectificationPrompt="Reason for deleting supplier *"
          rectificationPlaceholder="e.g. Duplicate supplier, switched vendor, test entry"
          reasonPresets={["Duplicate supplier", "Switched vendor", "Test entry"]}
          commentMinLength={4}
          onConfirmWithComment={() => {
            deleteSupplier(supplierToDelete.id);
            setSupplierToDelete(null);
          }}
          onConfirm={() => {}}
          onClose={() => setSupplierToDelete(null)}
        />
      )}
    </div>
  );
};

export default CustomersView;
