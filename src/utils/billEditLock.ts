/**
 * An invoice is final once its GST return period has been filed. GSTR-1 for a month is due on the 11th of the next month, so
 * from the 12th an invoice of the previous month is locked: it can only be cancelled (credit note) and re-issued as a new
 * invoice, never rewritten. Earlier in that window the owner may still correct it (the edit history keeps what changed).
 */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const ymd = (s?: string): { y: number; m: number } | null => {
  const m = /^(\d{4})-(\d{2})/.exec(String(s || ""));
  return m ? { y: Number(m[1]), m: Number(m[2]) } : null;
};

/** The date (YYYY-MM-DD) by which GSTR-1 for the month of `billDate` is due. */
export function gstr1DueDate(billDate: string): string | null {
  const p = ymd(billDate);
  if (!p) return null;
  const y = p.m === 12 ? p.y + 1 : p.y;
  const m = p.m === 12 ? 1 : p.m + 1;
  return `${y}-${String(m).padStart(2, "0")}-11`;
}

/** Plain-language reason why this invoice can no longer be edited, or null when it still can. */
export function billEditLockReason(
  bill: { date?: string; docNo?: string; id?: number },
  today: string,
  allowOverride: boolean = (import.meta as any).env?.VITE_ALLOW_LOCKED_BILL_EDIT === "true",
): string | null {
  if (allowOverride) return null;
  const due = gstr1DueDate(String(bill.date || ""));
  if (!due || today <= due) return null;
  const p = ymd(bill.date)!;
  return (
    `This invoice belongs to ${MONTHS[p.m - 1]} ${p.y}, whose GST return was due on ${due.split("-").reverse().join("-")}, so it is final. ` +
    `Cancel it (a credit note is issued) and create a new invoice instead.`
  );
}
