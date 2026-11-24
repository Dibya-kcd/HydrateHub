import React from "react";
import {
  AlertTriangle,
  Fuel,
  Home,
  MoreHorizontal,
  Package,
  ParkingSquare,
  Percent,
  Truck,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { EXPENSE_LABELS, PAY_CATEGORIES } from "../../../utils/netProfit";

export type Mode = "cash" | "upi" | "bank" | "cheque" | "other";
export type Period = "today" | "week" | "month" | "all";

export const MODES: { id: Mode; label: string }[] = [
  { id: "cash", label: "Cash" },
  { id: "upi", label: "UPI" },
  { id: "bank", label: "Bank" },
  { id: "cheque", label: "Cheque" },
  { id: "other", label: "Other" },
];

export const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "7 days" },
  { id: "month", label: "This month" },
  { id: "all", label: "All" },
];

/** Short names for chips and tiles; the full name stays in EXPENSE_LABELS (used by reports). */
export const SHORT_LABEL: Record<string, string> = {
  fuel: "Fuel",
  salary: "Salary",
  driver: "Driver pay",
  commission: "Commission",
  rent: "Rent",
  electricity: "Electricity",
  transport: "Transport",
  toll: "Toll / parking",
  repair: "Repair",
  packaging: "Packaging",
  baddebt: "Bad debt",
  misc: "Other",
};

export const CAT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  fuel: Fuel,
  salary: Users,
  driver: Truck,
  commission: Percent,
  rent: Home,
  electricity: Zap,
  transport: Truck,
  toll: ParkingSquare,
  repair: Wrench,
  packaging: Package,
  baddebt: AlertTriangle,
  misc: MoreHorizontal,
};

export function catLabel(key: string) {
  return SHORT_LABEL[key] || EXPENSE_LABELS[key] || key;
}

export function catCardTone(key: string): "due" | "sales" | "warning" {
  if (key === "baddebt") return "due";
  if (PAY_CATEGORIES.includes(key)) return "sales";
  return "warning";
}

export function catBadgeClass(key: string) {
  if (key === "baddebt") return "hh-icon-badge--rose";
  if (PAY_CATEGORIES.includes(key)) return "hh-icon-badge--blue";
  return "hh-icon-badge--amber";
}

export function addDaysISO(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + delta);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

export function dayLabel(iso: string, today: string) {
  if (iso === today) return "Today";
  if (iso === addDaysISO(today, -1)) return "Yesterday";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: y === Number(today.slice(0, 4)) ? undefined : "numeric",
  });
}

export const chipCls = (on: boolean) =>
  `shrink-0 min-h-[38px] px-3.5 rounded-full border text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
    on
      ? "bg-slate-900 text-white border-slate-900"
      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
  }`;

export const fieldLabelCls = "block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5";
export const fieldBoxCls =
  "w-full min-h-[46px] px-3 rounded-xl border border-slate-300 bg-white text-[15px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15";
