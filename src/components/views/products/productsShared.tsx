import React from 'react';
import { CategoryKey, Taxability } from '../../../types';
import { ToggleSwitch } from '../../ui';

// Current GST slabs for beverages (12% and 28% no longer exist). An old product that still carries
// another rate keeps showing it until you pick a valid one.
export const GST_OPTIONS = ["0%", "5%", "18%", "40%"];

export const emptyProductForm = () => ({
  name: "",
  nameOr: "",
  sku: "",
  brand: "",
  category: "general" as CategoryKey,
  categoryText: "",
  taxability: "taxable" as Taxability,
  hsn: "",
  gstPct: "18%",
  cessPct: "0",
  unit: "pcs",
  unitsPerCase: "1",
  mrp: "0",
  purchaseRate: "0",
  labourCost: "0",
  freightCost: "0",
  retailRate: "0",
  wholesaleRate: "0",
  specialRate: "0",
  reorderLevel: "0",
  imageUrl: "",
  ratesIncludeGst: false,
  opening: "0",
  warehouseId: "",
  batchNumber: "",
  expiry: "",
  returnable: false,
  active: true,
});

export type ProductFormState = ReturnType<typeof emptyProductForm>;

export interface LandedPreview {
  isNonGst: boolean;
  exGstBase: number;
  gstAmtPerCase: number;
  labour: number;
  freight: number;
  landedPerCase: number;
  landedPerUnit: number;
  effectiveCost: number;
  unitsPerCase: number;
}

export function gstToRate(label: string): number {
  const n = parseFloat(label);
  return isNaN(n) ? 0.18 : n / 100;
}

export function rateToGstLabel(rate?: number): string {
  if (rate == null) return "18%";
  const pct = Math.round(rate * 100 * 100) / 100;
  const match = GST_OPTIONS.find((o) => parseFloat(o) === pct);
  return match || `${pct}%`;
}

export const hsnLooksValid = (h: string) => /^\d{8}$/.test(h.trim());

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

export function ToggleRow({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

export function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
        active
          ? "bg-[var(--primary)] text-white shadow-sm"
          : "bg-white text-slate-600 border border-black/8"
      }`}
    >
      {label}
    </button>
  );
}
