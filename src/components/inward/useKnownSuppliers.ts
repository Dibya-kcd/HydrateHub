import { useMemo } from 'react';
import { GRN } from '../../types';
import { KnownSupplier } from './bulkInwardTypes';

export function useKnownSuppliers(grns: GRN[] | undefined): KnownSupplier[] {
  return useMemo(() => {
    const map = new Map<string, KnownSupplier>();
    try {
      const raw = localStorage.getItem('mrwater_cache_suppliers_master');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const s of parsed) {
            const key = String(s?.name || '').trim().toLowerCase();
            if (key) {
              map.set(key, {
                name: String(s.name).trim(),
                phone: s.phone || '',
                gstin: s.gstin || '',
                address: s.address || '',
                email: s.email || '',
              });
            }
          }
        }
      }
    } catch { /* ignore storage errors */ }
    for (const g of grns || []) {
      const key = String(g.supplierName || '').trim().toLowerCase();
      if (!key) continue;
      const existing = map.get(key);
      map.set(key, {
        name: existing?.name || g.supplierName.trim(),
        phone: existing?.phone || g.supplierPhone || '',
        gstin: existing?.gstin || g.supplierGstin || '',
        address: existing?.address || g.supplierAddress || '',
        email: existing?.email || g.supplierEmail || '',
      });
    }
    return Array.from(map.values());
  }, [grns]);
}
