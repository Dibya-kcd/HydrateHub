import { GRN } from "../../../types";

export const SUPPLIERS_KEY = "mrwater_cache_suppliers_master";

export const INDIAN_STATES = [
  "21 · Odisha",
  "27 · Maharashtra",
  "07 · Delhi",
  "09 · Uttar Pradesh",
  "24 · Gujarat",
  "29 · Karnataka",
  "33 · Tamil Nadu",
  "36 · Telangana",
  "37 · Andhra Pradesh",
  "03 · Punjab",
  "06 · Haryana",
  "08 · Rajasthan",
  "23 · Madhya Pradesh",
  "19 · West Bengal",
  "32 · Kerala",
  "10 · Bihar",
];

export interface SupplierMaster {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  contactPerson?: string;
  pan?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export function loadSuppliers(): SupplierMaster[] {
  try {
    const raw = localStorage.getItem(SUPPLIERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSuppliers(list: SupplierMaster[]) {
  try {
    localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

export function seedFromGrns(grns: GRN[], existing: SupplierMaster[]): SupplierMaster[] {
  const byName = new Map<string, SupplierMaster>();
  existing.forEach((s) => byName.set(s.name.trim().toLowerCase(), s));
  let changed = false;
  grns.forEach((g) => {
    const name = (g.supplierName || "").trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (byName.has(key)) {
      const cur = byName.get(key)!;
      if (!cur.phone && g.supplierPhone) {
        cur.phone = g.supplierPhone;
        changed = true;
      }
      if (!cur.gstin && g.supplierGstin) {
        cur.gstin = g.supplierGstin;
        changed = true;
      }
      if (!cur.address && g.supplierAddress) {
        cur.address = g.supplierAddress;
        changed = true;
      }
      if (!cur.email && g.supplierEmail) {
        cur.email = g.supplierEmail;
        changed = true;
      }
      return;
    }
    const neu: SupplierMaster = {
      id: `sup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      phone: g.supplierPhone,
      email: g.supplierEmail,
      gstin: g.supplierGstin,
      address: g.supplierAddress,
      createdAt: new Date().toISOString(),
    };
    byName.set(key, neu);
    changed = true;
  });
  return changed ? Array.from(byName.values()) : existing;
}
