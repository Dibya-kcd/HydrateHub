import { DispositionCompensationStatus, InventoryDispositionType } from '../../../types';
import { money } from '../../../utils/billing';
import { todayISO } from '../../../utils/dateLocal';

export type ClaimSchemeChoice =
  | 'none'
  | 'value_credit'
  | 'discount_pct'
  | 'free_bogo'
  | 'near_expiry_swap';

export interface DispositionLedgerStats {
  count: number;
  totalCases: number;
  openCount: number;
  openValue: number;
  settledCount: number;
  recovered: number;
  netLoss: number;
  hasCnExport: boolean;
}

export const TYPE_OPTIONS: { id: InventoryDispositionType; label: string; group: string }[] = [
  { id: 'expiry_return', label: 'Expiry return to supplier', group: 'Return' },
  { id: 'quality_return', label: 'Quality / damage return', group: 'Return' },
  { id: 'invoice_error_return', label: 'Invoice error return', group: 'Return' },
  { id: 'return_to_supplier', label: 'Send back to supplier', group: 'Return' },
  { id: 'return_to_company', label: 'Send back to company', group: 'Return' },
  { id: 'free_near_expiry', label: 'Free near-expiry distribution', group: 'Free' },
  { id: 'scheme_free_issue', label: 'Scheme free issue (non-invoice)', group: 'Free' },
  { id: 'expired_writeoff', label: 'Expired write-off', group: 'Write-off' },
  { id: 'damage_writeoff', label: 'Damage write-off', group: 'Write-off' },
];

export function needsCompensation(t: InventoryDispositionType) {
  return [
    'expiry_return',
    'quality_return',
    'invoice_error_return',
    'return_to_supplier',
    'return_to_company',
  ].includes(t);
}

export function isFreeIssue(t: InventoryDispositionType) {
  return t === 'free_near_expiry' || t === 'scheme_free_issue';
}

export const today = () => todayISO();

export const fmtPhoneRupees = (val: number) => {
  const n = Math.abs(Number(val) || 0);
  if (n >= 100000) return `₹${(n / 100000).toFixed(2).replace(/\.00$/, '')}L`;
  if (n >= 10000) return `₹${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `₹${money(n)}`;
};

export const statusBadge = (s: DispositionCompensationStatus) => {
  const map: Record<string, string> = {
    not_applicable: 'bg-slate-100 text-slate-600 border-slate-200',
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    partial: 'bg-sky-50 text-sky-800 border-sky-200',
    settled: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-800 border-rose-200',
  };
  return map[s] || map.not_applicable;
};
