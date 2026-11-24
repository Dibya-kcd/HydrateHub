/**
 * Send a Payment Receipt on WhatsApp with the 80 mm receipt PDF attached,
 * including the customer's remaining total due till date.
 *
 * Uses the phone's share sheet (Web Share API with files) when supported, and falls
 * back on desktop browsers to downloading the PDF and opening WhatsApp on the customer's number.
 */
import type { OrganizationProfile, PaymentRecord } from '../types';
import { formatPaymentId } from './beatReports';
import { whatsappLink } from './billing';
import {
  buildPaymentReceiptCaption,
  paymentReceiptPdfFilename,
  type PaymentReceiptBalanceInfo,
} from './paymentReceiptText';

export { buildPaymentReceiptCaption, paymentReceiptPdfFilename, type PaymentReceiptBalanceInfo };
export type WhatsAppPaymentReceiptResult = 'shared' | 'cancelled' | 'downloaded' | 'failed';

type Receipt80Module = typeof import('./receipt80');
let loadedReceipt80: Receipt80Module | null = null;
let loadingReceipt80: Promise<Receipt80Module> | null = null;

export function preloadReceipt80(): Promise<Receipt80Module> {
  if (loadedReceipt80) return Promise.resolve(loadedReceipt80);
  if (!loadingReceipt80) {
    loadingReceipt80 = import('./receipt80')
      .then((m) => {
        loadedReceipt80 = m;
        return m;
      })
      .catch((err) => {
        loadingReceipt80 = null;
        throw err;
      });
  }
  return loadingReceipt80;
}

export async function sendPaymentReceiptOnWhatsApp(
  payment: PaymentRecord,
  org?: OrganizationProfile,
  balanceInfo?: PaymentReceiptBalanceInfo,
): Promise<WhatsAppPaymentReceiptResult> {
  try {
    const { generatePaymentReceiptPdf80, sharePdfFile } = loadedReceipt80 ?? (await preloadReceipt80());
    const doc = generatePaymentReceiptPdf80(payment, org, balanceInfo);
    const filename = paymentReceiptPdfFilename(payment);
    const caption = buildPaymentReceiptCaption(payment, org, balanceInfo);
    const isRefund = Boolean(payment.isRefund || payment.amount < 0);
    const rcpNo = formatPaymentId(payment.id);
    const title = `${isRefund ? 'Refund Receipt' : 'Payment Receipt'} ${rcpNo} - ${payment.customerName || 'Customer'}`;

    const result = await sharePdfFile(doc, filename, title, caption);
    if (result !== 'unsupported') return result;

    doc.save(filename);
    try {
      window.open(
        whatsappLink(payment.customerPhone || '', `${caption}\n(Payment Receipt PDF attached)`),
        '_blank',
      );
    } catch {
      // pop-up blocked: the PDF is downloaded anyway
    }
    return 'downloaded';
  } catch (err) {
    console.warn('[whatsapp] could not prepare the payment receipt PDF:', err);
    return 'failed';
  }
}

export function whatsAppPaymentReceiptMessage(
  result: WhatsAppPaymentReceiptResult,
): { text: string; kind: 'success' | 'info' | 'error' } | null {
  switch (result) {
    case 'downloaded':
      return { text: 'Payment receipt PDF saved. In WhatsApp, tap the paperclip and attach it.', kind: 'info' };
    case 'failed':
      return { text: 'Could not prepare the payment receipt PDF. Please try again.', kind: 'error' };
    default:
      return null;
  }
}
