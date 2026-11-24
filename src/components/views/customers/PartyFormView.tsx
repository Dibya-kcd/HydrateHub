import React from "react";
import { ChevronDown, ChevronLeft, Edit2, X } from "lucide-react";
import { BeatRoute } from "../../../constants/beats";
import { Customer, ExistingCustomer } from "../../../types";
import { ConfirmModal } from "../../ui";
import { INDIAN_STATES, type SupplierMaster } from "./supplierStore";
import {
  CRATE_INPUT_CSS,
  Field,
  Toggle,
  type CustomerFormState,
  type PartyTab,
  type SupplierFormState,
} from "./customerFormUtils";

export interface PartyFormViewProps {
  isPhone: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  partyTab: PartyTab;
  editingSupplier: SupplierMaster | null;
  editingCustomer: Customer | null;
  editingDerivedCustomer: ExistingCustomer | null;
  formError: string | null;
  supplierForm: SupplierFormState;
  customerForm: CustomerFormState;
  activeBeats: BeatRoute[];
  showMoreFormFields: boolean;
  setShowMoreFormFields: React.Dispatch<React.SetStateAction<boolean>>;
  setSField: (key: keyof SupplierFormState, value: string | boolean) => void;
  setCField: (key: keyof CustomerFormState, value: string | boolean) => void;
  saveSupplier: () => void;
  saveCustomer: () => void;
  setFormOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingCustomer: React.Dispatch<React.SetStateAction<Customer | null>>;
  setEditingDerivedCustomer: React.Dispatch<React.SetStateAction<ExistingCustomer | null>>;
  setEditingSupplier: React.Dispatch<React.SetStateAction<SupplierMaster | null>>;
  clashConfirm: { clash: Customer; commit: () => void } | null;
  setClashConfirm: React.Dispatch<React.SetStateAction<{ clash: Customer; commit: () => void } | null>>;
}

export const PartyFormView: React.FC<PartyFormViewProps> = ({
  isPhone,
  t,
  partyTab,
  editingSupplier,
  editingCustomer,
  editingDerivedCustomer,
  formError,
  supplierForm,
  customerForm,
  activeBeats,
  showMoreFormFields,
  setShowMoreFormFields,
  setSField,
  setCField,
  saveSupplier,
  saveCustomer,
  setFormOpen,
  setEditingCustomer,
  setEditingDerivedCustomer,
  setEditingSupplier,
  clashConfirm,
  setClashConfirm,
}) => {
  const isSupplier = partyTab === "suppliers" || !!editingSupplier;
  const closePartyForm = () => {
    setFormOpen(false);
    setEditingCustomer(null);
    setEditingDerivedCustomer(null);
    setEditingSupplier(null);
    setClashConfirm(null);
    setShowMoreFormFields(false);
  };

  if (isPhone) {
    return (
      <div className="rt-flow-phone">
        <div className="hh-sales-top">
          <div className="hh-sales-top__row">
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                onClick={closePartyForm}
                className="hh-sales-top__iconbtn"
                aria-label={t("common.back")}
              >
                <ChevronLeft className="w-6 h-6" strokeWidth={2.2} />
              </button>
              <h1 className="hh-sales-top__title">
                {isSupplier
                  ? editingSupplier
                    ? "Edit supplier"
                    : "New supplier"
                  : editingCustomer || editingDerivedCustomer
                    ? t("parties.editCustomer")
                    : t("parties.newCustomer")}
              </h1>
            </div>
          </div>
        </div>

        <div className="rt-flow-phone__body space-y-2.5">
          {formError && (
            <div className="hh-hist-card hh-hist-card--due text-[12.5px] font-semibold" style={{ color: "var(--due)" }}>
              {formError}
            </div>
          )}

          {isSupplier ? (
            <>
              <label className="rt-in">
                <span className="rt-in__label uppercase">Company / Supplier name *</span>
                <input
                  className="rt-in__control"
                  value={supplierForm.name}
                  onChange={(e) => setSField("name", e.target.value)}
                  autoFocus
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="rt-in">
                  <span className="rt-in__label uppercase">{t("parties.phoneLabel")}</span>
                  <input
                    className="rt-in__control"
                    type="tel"
                    inputMode="tel"
                    placeholder="10-digit phone"
                    value={supplierForm.phone}
                    onChange={(e) => setSField("phone", e.target.value)}
                  />
                </label>
                <label className="rt-in">
                  <span className="rt-in__label uppercase">{t("parties.gstinLabel")}</span>
                  <input
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="rt-in__control uppercase"
                    value={supplierForm.gstin}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase();
                      setSField("gstin", v);
                      setSField("gstRegistered", Boolean(v.trim()));
                    }}
                    placeholder="22AAAAA0000A1Z5"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="rt-in">
                  <span className="rt-in__label uppercase">Contact person</span>
                  <input
                    className="rt-in__control"
                    value={supplierForm.contactPerson}
                    onChange={(e) => setSField("contactPerson", e.target.value)}
                  />
                </label>
                <label className="rt-in">
                  <span className="rt-in__label uppercase">City</span>
                  <input
                    className="rt-in__control"
                    value={supplierForm.city}
                    onChange={(e) => setSField("city", e.target.value)}
                  />
                </label>
              </div>
              <label className="rt-in">
                <span className="rt-in__label uppercase">{t("parties.addressLabel")}</span>
                <input
                  className="rt-in__control"
                  value={supplierForm.address}
                  onChange={(e) => setSField("address", e.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="rt-in">
                  <span className="rt-in__label uppercase">Email</span>
                  <input
                    className="rt-in__control"
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSField("email", e.target.value)}
                  />
                </label>
                <label className="rt-in">
                  <span className="rt-in__label uppercase">PAN</span>
                  <input
                    className="rt-in__control uppercase"
                    value={supplierForm.pan}
                    onChange={(e) => setSField("pan", e.target.value.toUpperCase())}
                  />
                </label>
              </div>
              <label className="rt-in">
                <span className="rt-in__label uppercase">Notes</span>
                <input
                  className="rt-in__control"
                  value={supplierForm.notes}
                  onChange={(e) => setSField("notes", e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <label className="rt-in">
                <span className="rt-in__label uppercase">{t("parties.shopPartyName")}</span>
                <input
                  className="rt-in__control"
                  value={customerForm.name}
                  onChange={(e) => setCField("name", e.target.value)}
                  autoFocus
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="rt-in">
                  <span className="rt-in__label uppercase">{t("parties.phoneLabel")}</span>
                  <input
                    className="rt-in__control"
                    type="tel"
                    inputMode="tel"
                    placeholder="98765 43210"
                    value={customerForm.phone}
                    onChange={(e) => setCField("phone", e.target.value)}
                  />
                </label>
                <label className="rt-in">
                  <span className="rt-in__label uppercase">{t("parties.gstinLabel")}</span>
                  <input
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="rt-in__control uppercase"
                    value={customerForm.gstin}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setCField("gstin", val);
                      if (val.trim()) setCField("gstRegistered", true);
                    }}
                    placeholder="22AAAAA0000A1Z5"
                  />
                </label>
              </div>

              <div>
                <div className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--text-2)" }}>
                  {t("parties.customerType")}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {["Retail", "Wholesale", "Distributor", "Institution", "Special"].map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      aria-pressed={customerForm.customerType === tp}
                      onClick={() => setCField("customerType", tp)}
                      className="rt-chip shrink-0"
                    >
                      {tp}
                    </button>
                  ))}
                </div>
              </div>

              <label className="rt-in">
                <span className="rt-in__label uppercase">{t("parties.routeBeatLabel")}</span>
                <div className="rt-in__select-wrap">
                  <select
                    className="rt-in__control"
                    value={customerForm.beat}
                    onChange={(e) => setCField("beat", e.target.value)}
                  >
                    <option value="">—</option>
                    {activeBeats.map((b) => (
                      <option key={b.id || b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                    {customerForm.beat && !activeBeats.some((b) => b.name === customerForm.beat) && (
                      <option value={customerForm.beat}>{customerForm.beat}</option>
                    )}
                  </select>
                  <ChevronDown size={15} className="rt-in__select-chev" />
                </div>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="rt-in">
                  <span className="rt-in__label uppercase">{t("parties.creditLimitLabel")}</span>
                  <input
                    className="rt-in__control tabular-nums"
                    inputMode="decimal"
                    value={customerForm.creditLimit}
                    onChange={(e) => setCField("creditLimit", e.target.value)}
                  />
                </label>
                <label className="rt-in">
                  <span className="rt-in__label uppercase">{t("parties.openingBalanceLabel")}</span>
                  <input
                    className="rt-in__control tabular-nums"
                    inputMode="decimal"
                    value={customerForm.openingBalance}
                    onChange={(e) => setCField("openingBalance", e.target.value)}
                  />
                </label>
              </div>

              <label className="rt-in">
                <span className="rt-in__label uppercase">{t("parties.addressLabel")}</span>
                <input
                  className="rt-in__control"
                  placeholder={t("parties.addressPlaceholder")}
                  value={customerForm.address}
                  onChange={(e) => setCField("address", e.target.value)}
                />
              </label>

              <button
                type="button"
                onClick={() => setShowMoreFormFields((v) => !v)}
                className="rt-card w-full flex items-center justify-between gap-2 text-left cursor-pointer"
                style={{ minHeight: "44px" }}
              >
                <span className="text-[12.5px] font-bold" style={{ color: "var(--primary)" }}>
                  {t("parties.moreDetails")}
                </span>
                <ChevronDown
                  size={16}
                  style={{
                    color: "var(--primary)",
                    transform: showMoreFormFields ? "rotate(180deg)" : "none",
                    transition: "transform 0.15s",
                  }}
                />
              </button>

              {showMoreFormFields && (
                <div className="space-y-2.5">
                  <label className="rt-in">
                    <span className="rt-in__label uppercase">Name in Odia (ଓଡ଼ିଆ)</span>
                    <input
                      className="rt-in__control"
                      value={customerForm.nameOr || ""}
                      onChange={(e) => setCField("nameOr", e.target.value)}
                      placeholder="ଉଦାହରଣ: ମାଆ ଦୁର୍ଗା ଷ୍ଟୋର୍"
                      dir="auto"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="rt-in">
                      <span className="rt-in__label uppercase">Contact person</span>
                      <input
                        className="rt-in__control"
                        value={customerForm.contactPerson}
                        onChange={(e) => setCField("contactPerson", e.target.value)}
                      />
                    </label>
                    <label className="rt-in">
                      <span className="rt-in__label uppercase">Price list</span>
                      <div className="rt-in__select-wrap">
                        <select
                          className="rt-in__control"
                          value={customerForm.priceList}
                          onChange={(e) => setCField("priceList", e.target.value)}
                        >
                          <option>Retail</option>
                          <option>Wholesale</option>
                          <option>Special</option>
                        </select>
                        <ChevronDown size={15} className="rt-in__select-chev" aria-hidden="true" />
                      </div>
                    </label>
                  </div>
                  <div className="rt-card flex items-center justify-between gap-3">
                    <span className="text-[13px] font-bold" style={{ color: "var(--text)" }}>
                      GST registered (B2B)
                    </span>
                    <Toggle
                      on={customerForm.gstRegistered}
                      onChange={(v) => setCField("gstRegistered", v)}
                    />
                  </div>
                  <label className="rt-in">
                    <span className="rt-in__label uppercase">State</span>
                    <div className="rt-in__select-wrap">
                      <select
                        className="rt-in__control"
                        value={customerForm.state}
                        onChange={(e) => setCField("state", e.target.value)}
                      >
                        {INDIAN_STATES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={15} className="rt-in__select-chev" aria-hidden="true" />
                    </div>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="rt-in">
                      <span className="rt-in__label uppercase">PAN</span>
                      <input
                        className="rt-in__control uppercase"
                        value={customerForm.pan}
                        onChange={(e) => setCField("pan", e.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="rt-in">
                      <span className="rt-in__label uppercase">FSSAI</span>
                      <input
                        className="rt-in__control"
                        value={customerForm.fssai}
                        onChange={(e) => setCField("fssai", e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="rt-in">
                      <span className="rt-in__label uppercase">Visit order</span>
                      <input
                        className="rt-in__control"
                        inputMode="numeric"
                        value={customerForm.visitOrder}
                        onChange={(e) => setCField("visitOrder", e.target.value)}
                      />
                    </label>
                    <label className="rt-in">
                      <span className="rt-in__label uppercase">Credit days</span>
                      <input
                        className="rt-in__control"
                        inputMode="numeric"
                        value={customerForm.creditDays}
                        onChange={(e) => setCField("creditDays", e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="rt-flow-phone__footer">
          <button
            type="button"
            onClick={isSupplier ? saveSupplier : saveCustomer}
            className="rt-btn w-full"
          >
            {isSupplier ? t("common.save") : t("parties.saveCustomer")}
          </button>
        </div>

        {clashConfirm && (
          <ConfirmModal
            isOpen
            title="Duplicate customer name"
            message={`Another customer is already named "${clashConfirm.clash.name}"${clashConfirm.clash.phone ? ` (phone ${clashConfirm.clash.phone})` : ""}. Their bills stay with them and are NOT merged, but the two will look the same in lists. Save this name anyway?`}
            confirmButtonLabel="Save anyway"
            cancelButtonLabel="Go back"
            variant="warning"
            confirmIcon={<Edit2 className="w-3.5 h-3.5" />}
            onConfirm={clashConfirm.commit}
            onClose={() => setClashConfirm(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg)] flex flex-col">
      <div className="sticky top-0 z-10 bg-[var(--bg)] border-b border-black/5 px-4 sm:px-6 py-3 flex items-center justify-between max-w-none lg:max-w-3xl mx-auto w-full">
        <h1 className="text-lg font-bold text-slate-900">
          {isSupplier
            ? editingSupplier
              ? "Edit supplier"
              : "New supplier"
            : editingCustomer || editingDerivedCustomer
              ? "Edit customer"
              : "New customer"}
        </h1>
        <button
          type="button"
          onClick={() => {
            setFormOpen(false);
            setEditingCustomer(null);
            setEditingDerivedCustomer(null);
            setEditingSupplier(null);
            setClashConfirm(null);
          }}
          className="p-2 rounded-full hover:bg-black/5 cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 pb-28 max-w-none lg:max-w-3xl mx-auto w-full space-y-4">
        {formError && (
          <div className="text-sm font-medium text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
            {formError}
          </div>
        )}

        {isSupplier ? (
          <>
            <Field label="Company / Supplier name">
              <input
                className="crate-input"
                value={supplierForm.name}
                onChange={(e) => setSField("name", e.target.value)}
                autoFocus
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Contact person">
                <input
                  className="crate-input"
                  value={supplierForm.contactPerson}
                  onChange={(e) => setSField("contactPerson", e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  className="crate-input"
                  type="tel"
                  inputMode="tel"
                  placeholder="10-digit mobile / phone"
                  value={supplierForm.phone}
                  onChange={(e) => setSField("phone", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Email">
              <input
                className="crate-input"
                type="email"
                value={supplierForm.email}
                onChange={(e) => setSField("email", e.target.value)}
              />
            </Field>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm font-medium text-slate-700">
                GST registered
              </span>
              <Toggle
                on={supplierForm.gstRegistered}
                onChange={(v) => setSField("gstRegistered", v)}
              />
            </div>
            {supplierForm.gstRegistered && (
              <Field label="GSTIN">
                <input autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}
                  className="crate-input uppercase"
                  value={supplierForm.gstin}
                  onChange={(e) =>
                    setSField("gstin", e.target.value.toUpperCase())
                  }
                  placeholder="22AAAAA0000A1Z5"
                />
              </Field>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="State">
                <select
                  className="crate-input"
                  value={supplierForm.state}
                  onChange={(e) => setSField("state", e.target.value)}
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="City">
                <input
                  className="crate-input"
                  value={supplierForm.city}
                  onChange={(e) => setSField("city", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Address">
              <textarea
                className="crate-input min-h-[72px] resize-y"
                value={supplierForm.address}
                onChange={(e) => setSField("address", e.target.value)}
              />
            </Field>
            <Field label="PAN">
              <input
                className="crate-input uppercase"
                value={supplierForm.pan}
                onChange={(e) =>
                  setSField("pan", e.target.value.toUpperCase())
                }
              />
            </Field>
            <Field label="Notes">
              <textarea
                className="crate-input min-h-[64px] resize-y"
                value={supplierForm.notes}
                onChange={(e) => setSField("notes", e.target.value)}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Shop / Business name (English)">
              <input
                className="crate-input"
                value={customerForm.name}
                onChange={(e) => setCField("name", e.target.value)}
                autoFocus
              />
              {(editingCustomer || editingDerivedCustomer) && (
                <p className="text-xs text-slate-500 mt-1.5">
                  Renaming updates this customer in-place along with all their past bills, payments, and ledger.
                </p>
              )}
            </Field>
            <Field label="Name in Odia (ଓଡ଼ିଆ) — optional">
              <input
                className="crate-input"
                value={customerForm.nameOr || ""}
                onChange={(e) => setCField("nameOr", e.target.value)}
                placeholder="ଉଦାହରଣ: ମାଆ ଦୁର୍ଗା ଷ୍ଟୋର୍"
                dir="auto"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Contact person">
                <input
                  className="crate-input"
                  value={customerForm.contactPerson}
                  onChange={(e) => setCField("contactPerson", e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  className="crate-input"
                  type="tel"
                  inputMode="tel"
                  placeholder="10-digit mobile / phone"
                  value={customerForm.phone}
                  onChange={(e) => setCField("phone", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Customer type">
                <select
                  className="crate-input"
                  value={customerForm.customerType}
                  onChange={(e) => setCField("customerType", e.target.value)}
                >
                  <option>Retail</option>
                  <option>Wholesale</option>
                  <option>Distributor</option>
                  <option>Institution</option>
                  <option>Special</option>
                </select>
              </Field>
              <Field label="Price list">
                <select
                  className="crate-input"
                  value={customerForm.priceList}
                  onChange={(e) => setCField("priceList", e.target.value)}
                >
                  <option>Retail</option>
                  <option>Wholesale</option>
                  <option>Special</option>
                </select>
              </Field>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm font-medium text-slate-700">
                GST registered (B2B)
              </span>
              <Toggle
                on={customerForm.gstRegistered}
                onChange={(v) => setCField("gstRegistered", v)}
              />
            </div>
            {customerForm.gstRegistered && (
              <Field label="GSTIN">
                <input autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}
                  className="crate-input uppercase"
                  value={customerForm.gstin}
                  onChange={(e) =>
                    setCField("gstin", e.target.value.toUpperCase())
                  }
                  placeholder="22AAAAA0000A1Z5"
                />
              </Field>
            )}
            <Field label="State">
              <select
                className="crate-input"
                value={customerForm.state}
                onChange={(e) => setCField("state", e.target.value)}
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Address">
              <textarea
                className="crate-input min-h-[72px] resize-y"
                value={customerForm.address}
                onChange={(e) => setCField("address", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="PAN">
                <input
                  className="crate-input uppercase"
                  value={customerForm.pan}
                  onChange={(e) =>
                    setCField("pan", e.target.value.toUpperCase())
                  }
                />
              </Field>
              <Field label="FSSAI">
                <input
                  className="crate-input"
                  value={customerForm.fssai}
                  onChange={(e) => setCField("fssai", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Beat">
                <select
                  className="crate-input"
                  value={customerForm.beat}
                  onChange={(e) => setCField("beat", e.target.value)}
                >
                  <option value="">—</option>
                  {activeBeats.map((b) => (
                    <option key={b.id || b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                  {customerForm.beat && !activeBeats.some((b) => b.name === customerForm.beat) && (
                    <option value={customerForm.beat}>{customerForm.beat}</option>
                  )}
                </select>
              </Field>
              <Field label="Visit order">
                <input
                  className="crate-input"
                  inputMode="numeric"
                  value={customerForm.visitOrder}
                  onChange={(e) => setCField("visitOrder", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Credit limit ₹">
                <input
                  className="crate-input"
                  inputMode="decimal"
                  value={customerForm.creditLimit}
                  onChange={(e) => setCField("creditLimit", e.target.value)}
                />
              </Field>
              <Field label="Credit days">
                <input
                  className="crate-input"
                  inputMode="numeric"
                  value={customerForm.creditDays}
                  onChange={(e) => setCField("creditDays", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Opening balance ₹">
              <input
                className="crate-input"
                inputMode="decimal"
                value={customerForm.openingBalance}
                onChange={(e) => setCField("openingBalance", e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Positive = they owe you. Negative = you owe them.
              </p>
            </Field>
          </>
        )}
      </div>

      <div className="sticky bottom-0 z-10 bg-[var(--bg)] border-t border-black/5 px-4 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={isSupplier ? saveSupplier : saveCustomer}
          className="w-full max-w-none lg:max-w-3xl mx-auto block py-3.5 rounded-2xl bg-[var(--primary)] text-white font-semibold text-base shadow-sm cursor-pointer active:scale-[0.99]"
        >
          Save
        </button>
      </div>

      <style>{CRATE_INPUT_CSS}</style>

      {clashConfirm && (
        <ConfirmModal
          isOpen
          title="Duplicate customer name"
          message={`Another customer is already named "${clashConfirm.clash.name}"${clashConfirm.clash.phone ? ` (phone ${clashConfirm.clash.phone})` : ""}. Their bills stay with them and are NOT merged, but the two will look the same in lists. Save this name anyway?`}
          confirmButtonLabel="Save anyway"
          cancelButtonLabel="Go back"
          variant="warning"
          confirmIcon={<Edit2 className="w-3.5 h-3.5" />}
          onConfirm={clashConfirm.commit}
          onClose={() => setClashConfirm(null)}
        />
      )}
    </div>
  );
};
