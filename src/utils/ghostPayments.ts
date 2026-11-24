import type { PaymentRecord } from "../types";

const DUPLICATE_OR_MISTAKE_RE =
  /\b(dup(?:licate)?|mistake|wrong|error|double|extra|test(?:ing)?|bogus|fake|cancelled|cancel|remove|dummy)\b/i;

/** True when a reason text says the entry was a duplicate, mistake or test entry. */
export function looksLikeDuplicateOrMistakeReason(reason?: string): boolean {
  return DUPLICATE_OR_MISTAKE_RE.test((reason || "").trim());
}

/**
 * Prevents payments explicitly tagged with a deleted customer's ID from silently falling back
 * to name/phone matching onto a surviving customer with the same name.
 */
export function isPaymentFromDeletedCustomerId(
  p: Pick<PaymentRecord, "customerId" | "billId">,
  deletedCustomerIds: Set<string>,
  activeCustomerIds: Set<string>,
  liveCustBillIds?: Set<number>,
): boolean {
  if (!p.customerId) return false;
  if (p.billId && liveCustBillIds?.has(Number(p.billId))) return false;
  return deletedCustomerIds.has(p.customerId) && !activeCustomerIds.has(p.customerId);
}
