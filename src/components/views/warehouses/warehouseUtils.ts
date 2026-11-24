import type { InventoryBatch } from '../../../types';

export interface WarehouseFormState {
  name: string;
  code: string;
  location: string;
  manager: string;
  phone: string;
  capacityCases: number;
  isDefault: boolean;
  notes: string;
}

export interface BatchFormState {
  productId: number;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  warehouseId: string;
  quantity: number;
  costPrice: number;
  mrp: number;
  notes: string;
}

export interface TransferFormState {
  date: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  productId: number;
  batchNumber: string;
  quantity: number;
  referenceNote: string;
}

export function getBatchExpiryStatus(expiryDate: string, mutedColor: string) {
  if (!expiryDate) return { label: 'No Expiry', color: mutedColor, bg: '#f1f5f9' };
  const now = new Date();
  let exp: Date;
  if (expiryDate.includes('/')) {
    const [d, m, y] = expiryDate.split('/');
    exp = new Date(Number(y), Number(m) - 1, Number(d));
  } else {
    exp = new Date(expiryDate);
  }
  if (isNaN(exp.getTime())) return { label: 'Valid', color: mutedColor, bg: '#f1f5f9' };

  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { label: 'Expired', color: '#991b1b', bg: '#fee2e2' };
  }
  if (diffDays <= 45) {
    return { label: `Expiring in ${diffDays}d`, color: '#9a3412', bg: '#ffedd5' };
  }
  return { label: `Good (${diffDays}d)`, color: '#166534', bg: '#dcfce7' };
}

export function formatExpShort(raw?: string) {
  if (!raw) return '—';
  const d = new Date(raw.includes('/') ? raw.split('/').reverse().join('-') : raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getTransferAvailable(
  inventoryBatches: InventoryBatch[],
  warehouseStock: (warehouseId: string, productId?: number) => number,
  fromWarehouseId: string,
  productId: number,
  batchNumber?: string,
): { available: number; label: string; batches: InventoryBatch[] } {
  const pid = Number(productId) || 0;
  const bn = (batchNumber || '').trim().toUpperCase();
  const batchesAtSource = inventoryBatches.filter(
    (b) =>
      b.productId === pid &&
      b.warehouseId === fromWarehouseId &&
      (Number(b.quantity) || 0) > 0,
  );
  if (bn) {
    const match = batchesAtSource.find(
      (b) => (b.batchNumber || '').toUpperCase() === bn,
    );
    const qty = match ? Number(match.quantity) || 0 : 0;
    return {
      available: Math.max(0, qty),
      label: match
        ? `Batch ${match.batchNumber}: ${qty} cases`
        : `Batch ${bn}: not found in source (0 cases)`,
      batches: match ? [match] : [],
    };
  }
  const physical = batchesAtSource.reduce(
    (s, b) => s + (Number(b.quantity) || 0),
    0,
  );
  const sellable = Math.max(0, warehouseStock(fromWarehouseId, pid));
  const finalAvail =
    batchesAtSource.length > 0
      ? Math.min(physical, sellable > 0 ? sellable : physical)
      : sellable;
  return {
    available: Math.max(0, finalAvail),
    label:
      batchesAtSource.length > 0
        ? `${finalAvail} cases in source (${batchesAtSource.length} lot${
            batchesAtSource.length === 1 ? '' : 's'
          })`
        : `${finalAvail} cases available in source`,
    batches: batchesAtSource,
  };
}
