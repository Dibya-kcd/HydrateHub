import React from "react";
import { Bill, PaymentRecord, SalesReturn } from "../../../types";
import { ToggleSwitch } from "../../ui";

export type PartyTab = "customers" | "suppliers";

export const emptyCustomerForm = () => ({
  name: "",
  nameOr: "",
  contactPerson: "",
  phone: "",
  customerType: "Retail",
  priceList: "Retail",
  gstRegistered: false,
  state: "21 · Odisha",
  address: "",
  pan: "",
  fssai: "",
  beat: "",
  visitOrder: "0",
  creditLimit: "0",
  creditDays: "0",
  openingBalance: "0",
  gstin: "",
});

export type CustomerFormState = ReturnType<typeof emptyCustomerForm>;

export function parseCustomerNotes(notes?: string) {
  const out = {
    contactPerson: "",
    pan: "",
    fssai: "",
    customerType: "Retail",
    priceList: "Retail",
    state: "21 · Odisha",
    creditDays: "0",
    visitOrder: "0",
  };
  if (!notes) return out;
  for (const part of notes.split("·").map((s) => s.trim())) {
    if (part.startsWith("Contact:")) out.contactPerson = part.slice("Contact:".length).trim();
    else if (part.startsWith("PAN:")) out.pan = part.slice("PAN:".length).trim();
    else if (part.startsWith("FSSAI:")) out.fssai = part.slice("FSSAI:".length).trim();
    else if (part.startsWith("Type:")) out.customerType = part.slice("Type:".length).trim() || "Retail";
    else if (part.startsWith("Price list:")) out.priceList = part.slice("Price list:".length).trim() || "Retail";
    else if (part.startsWith("State:")) out.state = part.slice("State:".length).trim() || "21 · Odisha";
    else if (part.startsWith("Credit days:")) out.creditDays = part.slice("Credit days:".length).trim() || "0";
    else if (part.startsWith("Visit order:")) out.visitOrder = part.slice("Visit order:".length).trim() || "0";
  }
  return out;
}

export const emptySupplierForm = () => ({
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  gstRegistered: false,
  gstin: "",
  state: "21 · Odisha",
  address: "",
  city: "",
  pan: "",
  notes: "",
});

export type SupplierFormState = ReturnType<typeof emptySupplierForm>;

export type LedgerEntry =
  | {
      kind: "opening";
      id: string;
      date: string;
      amount: number;
    }
  | {
      kind: "bill";
      id: string;
      date: string;
      bill: Bill;
      amount: number;
      due: number;
    }
  | {
      kind: "return";
      id: string;
      date: string;
      bill: Bill;
      salesReturn: SalesReturn;
      amount: number;
    }
  | {
      kind: "payment";
      id: string;
      date: string;
      payment: PaymentRecord;
      amount: number;
      isLegacy: boolean;
    };

export const CRATE_INPUT_CSS = `
  .crate-input {
    width: 100%;
    padding: 0.65rem 0.9rem;
    border-radius: 0.85rem;
    border: 1px solid rgba(0,0,0,0.08);
    background: #fff;
    font-size: 0.9rem;
    color: #1e293b;
    outline: none;
  }
  .crate-input:focus {
    border-color: rgba(13, 74, 58, 0.45);
    box-shadow: 0 0 0 3px rgba(13, 74, 58, 0.12);
  }
`;

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return <ToggleSwitch checked={on} onChange={onChange} />;
}

export function EmptyCard({ title, hint }: { title: string; hint: string }) {
  return (
    <div
      data-card-tone="neutral"
      className="rounded-2xl border shadow-sm px-6 py-12 text-center"
    >
      <p className="text-base font-bold text-slate-900">{title}</p>
      <p className="text-sm text-slate-500 mt-1.5">{hint}</p>
    </div>
  );
}
