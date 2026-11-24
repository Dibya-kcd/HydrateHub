import type { Product } from '../../../types';

export type Step = 'setup' | 'count' | 'review' | 'done';
export type Filter = 'all' | 'pending' | 'diff' | 'done';
export type OversoldChoice = 'fix' | 'open' | 'adjust';

export interface Row {
  key: string;
  productId: number;
  batchNumber: string;
  expiryDate: string;
  expiryStatus: string;
  systemQty: number;
  /** Batch typed in by the counter (stock found with no matching batch). Created only when the audit is saved. */
  isFound?: boolean;
  /** Product with book stock but no batch rows in this godown. */
  noBatch?: boolean;
}

export interface FoundLine {
  key: string;
  productId: number;
  batchNumber: string;
  expiryDate: string;
}

export interface OversoldState {
  choice: OversoldChoice;
  reason: string;
}

export interface Draft {
  whId: string;
  counts: Record<string, string>;
  found: FoundLine[];
  note: string;
  oversold: Record<number, OversoldState>;
  savedAt: number;
}

export interface OversoldItem {
  product: Product;
  raw: number;
  others: { name: string; qty: number }[];
}

export interface AuditStats {
  total: number;
  counted: number;
  differ: number;
  net: number;
}

export interface AuditReviewData {
  diffs: { product: Product; rows: { r: Row; c: number }[]; net: number }[];
  matches: { product: Product; r: Row; c: number }[];
  uncounted: Row[];
}

export interface SavedAuditInfo {
  id: number;
  counted: number;
  differ: number;
  net: number;
}

export interface StockAuditScreenProps {
  /** Open another Inventory tab (used by the "fix the cause" links on oversold lines). */
  onGoInventoryTab?: (tab: 'consignments' | 'transfers') => void;
  /** Phone header warehouse sync from InventoryView */
  selectedWhId?: string;
  onChangeWhId?: (id: string) => void;
}

export const DRAFT_KEY = 'mrwater_audit_draft_v1';

export function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d || typeof d.whId !== 'string' || typeof d.counts !== 'object') return null;
    return { ...d, found: d.found || [], oversold: d.oversold || {}, note: d.note || '' };
  } catch {
    return null;
  }
}

export function writeDraft(d: Draft | null) {
  try {
    if (!d) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* storage can be unavailable; the count still works, it just is not kept */
  }
}

export const fmtExp = (d?: string) =>
  d
    ? new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
    : 'No expiry';

export const expiryClass = (status: string) => {
  if (status === 'expired') return 'text-rose-700 font-bold';
  if (status === 'critical') return 'text-rose-600 font-semibold';
  if (status === 'warning') return 'text-amber-700 font-semibold';
  return 'text-slate-500';
};

export const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
