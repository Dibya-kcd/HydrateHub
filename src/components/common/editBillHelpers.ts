import type { BillEditPreview } from '../../context/LedgerContext';
import { money } from '../../utils/billing';

export interface EditBillImpactItem {
  label: string;
  detail?: string;
  qtyChange?: string;
}

export const rupees = (n: number) => `₹${money(n)}`;

export function buildEditBillImpactItems(preview: BillEditPreview | null): EditBillImpactItem[] {
  const items: EditBillImpactItem[] = [];
  if (!preview) return items;

  items.push({
    label: preview.stockChanged ? 'Stock will be adjusted' : 'Stock is not affected',
    detail: preview.stockChanged
      ? `Only the products whose crates changed · ${preview.source.label}`
      : `Same crates, products and source · ${preview.source.label}`,
  });

  for (const c of preview.changes) {
    items.push({ label: c });
  }

  const pay = preview.payment;
  if (pay.movedToCustomer) {
    items.push({
      label: `Receipts move to ${pay.movedToCustomer}`,
      detail: `The ${rupees(pay.receivedBefore)} received on this bill follows the invoice to the new customer`,
    });
  }
  if (pay.keptAsAdvance > 0) {
    items.push({
      label: 'Received money kept as advance',
      detail: "The new total is lower than what was received, so the extra stays on the customer's account",
      qtyChange: rupees(pay.keptAsAdvance),
    });
  }
  if (pay.removedAsCorrection > 0) {
    items.push({
      label: 'Receipts removed (paid amount lowered)',
      detail: 'Treated as a correction, not a refund. Use Refund on the customer if cash goes back',
      qtyChange: rupees(pay.removedAsCorrection),
    });
  }
  if (pay.keptAsAdvance <= 0 && pay.removedAsCorrection <= 0 && !pay.movedToCustomer) {
    items.push({
      label: 'Payments',
      detail:
        pay.paidAfter > pay.receivedBefore
          ? `${rupees(pay.paidAfter - pay.receivedBefore)} more recorded as received`
          : 'No change to payments already received',
    });
  }

  return items;
}
