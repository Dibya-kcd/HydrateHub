import { PaymentMode, PaymentRecord } from "../../../types";
import { todayISO, toLocalISODate } from "../../../utils/dateLocal";

export const HISTORY_PAGE = 50;

/** Formats a date string into "14 May" or "02 Oct" format */
export function formatItemDate(dateStr: string): string {
  if (!dateStr) return "14 May";
  if (/^\d{1,2}\s+[A-Za-z]{3}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${day} ${month}`;
}

/** Formats a date string into standard YYYY-MM-DD format for date inputs */
export function toStandardIsoDate(input?: string): string {
  if (!input) return todayISO();
  const trimmed = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (trimmed.length > 10 && trimmed[10] === "T") return trimmed.slice(0, 10);
  const parts = trimmed.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    } else if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return toLocalISODate(d);
  }
  return todayISO();
}

/** Formats YYYY-MM-DD into "02-Oct-2026" for the input field */
export function formatInputDateDisplay(dateStr: string): string {
  if (!dateStr) return "02-Oct-2026";
  const [y, m, d] = dateStr.slice(0, 10).split("-");
  if (!y || !m || !d) return dateStr;
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const mIdx = parseInt(m, 10) - 1;
  const monthStr = monthNames[mIdx] || m;
  return `${d.padStart(2, "0")}-${monthStr}-${y}`;
}

/** Formats ISO date/timestamp for "20 Nov 2026" display */
export function formatDateLongDisplay(dateStr?: string): string {
  const iso = toStandardIsoDate(dateStr);
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()}`;
}

/** Formats Today's time for Recent receipts (e.g. "Today 11:20 am" or "20 Nov") */
export function formatRecentDateMeta(p: PaymentRecord, todayStr: string): string {
  const datePart = String(p.paymentDate || p.createdAt || "").slice(0, 10);
  if (datePart === todayStr && p.createdAt) {
    const dt = new Date(p.createdAt);
    if (!isNaN(dt.getTime())) {
      const timeStr = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
      return `Today ${timeStr}`;
    }
    return "Today";
  }
  return formatItemDate(p.paymentDate || p.createdAt);
}

export function getModeLabelText(
  t: (k: any, p?: any) => string,
  mode: PaymentMode,
  isRefund?: boolean,
): string {
  if (isRefund) return t("pay.refundTag");
  switch (mode) {
    case "upi":
      return t("pay.modeUpi");
    case "cheque":
      return t("pay.modeCheque");
    case "bank":
      return t("pay.modeBank");
    case "other":
      return t("pay.modeOther");
    default:
      return t("pay.modeCash");
  }
}
