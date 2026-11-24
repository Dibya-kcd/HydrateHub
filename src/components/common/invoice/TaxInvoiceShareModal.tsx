import React from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  MessageCircle,
  Paperclip,
  Printer,
  Share2,
  X,
} from 'lucide-react';
import type { Bill, BillingSettings, OrganizationProfile, PaletteTokens } from '../../../types';
import type { InvoicePaper } from '../../../utils/invoicePdfMeta';
import { buildBillMessage } from '../../../utils/receiptText';
import { sendBillOnWhatsApp, whatsAppResultMessage } from '../../../utils/whatsappBill';
import { notify } from '../../../utils/toast';

interface TaxInvoiceShareModalProps {
  bill: Bill;
  isGst: boolean;
  orgProfile: OrganizationProfile | null | undefined;
  billingSettings: BillingSettings;
  invoiceFormat: 'gst' | 'non_gst';
  palette: PaletteTokens;
  paper: InvoicePaper;
  setPaper: (paper: InvoicePaper) => void;
  sharing: boolean;
  shareNote: string | null;
  downloading: boolean;
  copiedInvoiceText: boolean;
  setCopiedInvoiceText: (v: boolean) => void;
  onClose: () => void;
  onSharePdf: () => void;
  onDownload: () => void;
  onPrint: () => void;
}

export const TaxInvoiceShareModal: React.FC<TaxInvoiceShareModalProps> = ({
  bill,
  isGst,
  orgProfile,
  billingSettings,
  invoiceFormat,
  palette,
  paper,
  setPaper,
  sharing,
  shareNote,
  downloading,
  copiedInvoiceText,
  setCopiedInvoiceText,
  onClose,
  onSharePdf,
  onDownload,
  onPrint,
}) => {
  return (
    <div
      data-esc-close
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border-2 shadow-2xl w-full max-w-sm overflow-hidden p-4 space-y-3 animate-fadeIn"
        style={{ borderColor: palette.line }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-emerald-600" />
            <h3 className="font-extrabold text-sm text-slate-900">
              Share &amp; Export Invoice
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
            aria-label="Close share sheet"
          >
            <X size={16} />
          </button>
        </div>

        {/* Paper size for the PDF buttons below */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">PDF paper size</div>
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200" role="group" aria-label="PDF paper size">
            {([['a4', 'A4 invoice'], ['80mm', '80 mm receipt']] as [InvoicePaper, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPaper(key)}
                aria-pressed={paper === key}
                id={`share-paper-${key}`}
                className={`min-h-[40px] rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  paper === key ? 'bg-white text-slate-900 shadow-xs border border-slate-200' : 'text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {/* WhatsApp Button */}
          <button
            type="button"
            onClick={async () => {
              onClose();
              const msg = whatsAppResultMessage(await sendBillOnWhatsApp(bill, orgProfile, billingSettings, invoiceFormat));
              if (msg) notify(msg.text, msg.kind);
            }}
            className="w-full py-2.5 px-3 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs sm:text-sm flex items-center justify-between cursor-pointer transition-colors shadow-2xs"
            id="share-modal-whatsapp-link"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-xs">
                <MessageCircle size={18} />
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-900">Send via WhatsApp</div>
                <div className="text-xs text-slate-500 font-normal">
                  {bill.phone ? `To ${bill.retailer} (${bill.phone})` : 'Send to contact / number'}
                  {' · 80 mm receipt PDF attached'}
                </div>
              </div>
            </div>
            <ArrowRight size={15} className="text-emerald-700" />
          </button>

          {/* Forward the PDF file itself (phone share sheet -> WhatsApp) */}
          <button
            type="button"
            onClick={onSharePdf}
            disabled={sharing}
            className="w-full py-2.5 px-3 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 font-bold text-xs sm:text-sm flex items-center justify-between cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
            id="share-modal-pdf-share-btn"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Paperclip size={18} />
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-900">Share PDF file</div>
                <div className="text-xs text-slate-500 font-normal">
                  {paper === '80mm' ? '80 mm receipt' : 'A4 invoice'} · pick WhatsApp in the share sheet
                </div>
              </div>
            </div>
            <ArrowRight size={15} className="text-emerald-700" />
          </button>
          {shareNote && (
            <p role="status" className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              {shareNote}
            </p>
          )}

          {/* Download PDF Button */}
          <button
            type="button"
            onClick={() => {
              onDownload();
              onClose();
            }}
            disabled={downloading}
            className="w-full py-2.5 px-3 rounded-xl border border-blue-200 bg-sky-50 hover:bg-sky-100 text-sky-950 font-bold text-xs sm:text-sm flex items-center justify-between cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
            id="share-modal-pdf-btn"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Download size={18} />
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-900">Download PDF</div>
                <div className="text-xs text-slate-500 font-normal">
                  {paper === '80mm' ? '80 mm receipt' : isGst ? 'Official GST Tax Invoice' : 'Retail Bill of Supply'} PDF
                </div>
              </div>
            </div>
            <ArrowRight size={15} className="text-sky-700" />
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={() => {
              onClose();
              setTimeout(() => onPrint(), 250);
            }}
            className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-between cursor-pointer transition-colors shadow-2xs"
            id="share-modal-print-btn"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Printer size={18} />
              </div>
              <div className="text-left">
                <div className="font-bold text-slate-900">Print Invoice</div>
                <div className="text-xs text-slate-500 font-normal">
                  {paper === '80mm' ? 'Print the 80 mm receipt (thermal printer)' : 'Send to printer or save thermal slip'}
                </div>
              </div>
            </div>
            <ArrowRight size={15} className="text-slate-600" />
          </button>

          {/* Copy Text / Native Share */}
          <button
            type="button"
            onClick={() => {
              const text = buildBillMessage(bill, orgProfile, billingSettings, invoiceFormat);
              navigator.clipboard.writeText(text);
              setCopiedInvoiceText(true);
              setTimeout(() => setCopiedInvoiceText(false), 2000);
            }}
            className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            id="share-modal-copy-btn"
          >
            {copiedInvoiceText ? (
              <>
                <Check size={14} className="text-emerald-600" />
                <span className="text-emerald-700">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy Invoice Summary Text</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
