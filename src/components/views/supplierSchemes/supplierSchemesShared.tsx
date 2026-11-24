import React from 'react';
import { InfoTip } from '../../common/InfoTip';
import { SupplierScheme, SupplierSchemeType } from '../../../types';
import { todayISO } from '../../../utils/dateLocal';

export const SCHEME_TYPE_LABEL: Record<SupplierSchemeType, string> = {
  free_goods: 'Type A — Free goods with purchase',
  pending_credit: 'Type B — Pending credit note',
  volume_incentive: 'Type C — Monthly volume incentive',
};

export const SCHEME_TYPE_SHORT: Record<SupplierSchemeType, string> = {
  free_goods: 'A · Free goods',
  pending_credit: 'B · Pending credit',
  volume_incentive: 'C · Volume incentive',
};

export const typeLabel = (t?: string) =>
  SCHEME_TYPE_LABEL[(t as SupplierSchemeType) || 'free_goods'] || String(t || '—');
export const typeShort = (t?: string) =>
  SCHEME_TYPE_SHORT[(t as SupplierSchemeType) || 'free_goods'] || String(t || '—');

// 14px everywhere; iPhones get 16px from a global rule in index.css.
export const inputCls =
  'w-full h-11 sm:h-10 border border-slate-300 rounded-lg px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400';
export const labelCls = 'flex items-center gap-1 text-xs font-medium text-slate-600 mb-1';
export const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;
export const todayIso = () => todayISO();

export type SchemeFormState = Omit<SupplierScheme, 'id' | 'createdAt' | 'updatedAt'>;

export function emptySchemeForm(schemeType: SupplierSchemeType = 'free_goods'): SchemeFormState {
  return {
    supplierName: '',
    name: '',
    schemeType,
    productIds: [],
    startDate: todayIso(),
    endDate: undefined,
    targetQuantity: undefined,
    incentiveRate: undefined,
    calculationMethod: 'all_eligible',
    active: true,
    notes: '',
  };
}

export type TabKey = 'schemes' | 'credit_notes' | 'monthly_report';
export type CnFilter = 'all' | 'scheme' | 'claims';

export const Field: React.FC<{
  label: string;
  info?: React.ReactNode;
  infoTitle?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, info, infoTitle, children, className = '' }) => (
  <div className={`min-w-0 ${className}`}>
    <span className={labelCls}>
      {label}
      {info && (
        <InfoTip size="sm" title={infoTitle || label}>
          {info}
        </InfoTip>
      )}
    </span>
    {children}
  </div>
);

/** Equal-width label/value tile used inside cards. */
export const Stat: React.FC<{ label: string; value: string; tone?: 'default' | 'good' | 'warn' }> = ({
  label,
  value,
  tone = 'default',
}) => (
  <div className="bg-white/80 border border-black/5 rounded-xl px-1.5 py-2 text-center min-w-0">
    <p className="text-xs font-semibold text-slate-500 leading-none">{label}</p>
    <p
      className={`text-xs sm:text-sm font-bold mt-1 truncate ${
        tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-800'
      }`}
    >
      {value}
    </p>
  </div>
);
