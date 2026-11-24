import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Download,
  FileText,
  MessageCircle,
  Paperclip,
  Printer,
  Receipt,
  Share2,
  X,
} from 'lucide-react';
import type { Bill, BillingSettings, OrganizationProfile } from '../../../types';
import { freeStockInvoiceDisplay, money, statusOf } from '../../../utils/billing';
import type { InvoicePaper } from '../../../utils/invoicePdfMeta';
import { sendBillOnWhatsApp, whatsAppResultMessage } from '../../../utils/whatsappBill';
import { notify } from '../../../utils/toast';

interface TaxInvoicePhoneViewProps {
  bill: Bill;
  invoiceNo: string;
  isGst: boolean;
  orgName: string;
  orgProfile: OrganizationProfile | null | undefined;
  billingSettings: BillingSettings;
  invoiceFormat: 'gst' | 'non_gst';
  status: ReturnType<typeof statusOf>;
  paper: InvoicePaper;
  setPaper: (paper: InvoicePaper) => void;
  downloading: boolean;
  sharing: boolean;
  showShareModal: boolean;
  shareNote: string | null;
  setShowShareModal: (v: boolean) => void;
  onClose: () => void;
  onPrint: (paper?: InvoicePaper) => void;
  onDownload: (paper?: InvoicePaper) => void;
  onSharePdf: (paper?: InvoicePaper) => void;
  onNativeShare: () => void;
  onEditBill?: (bill: Bill) => void;
  onCancelBill?: (bill: Bill) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export const TaxInvoicePhoneView: React.FC<TaxInvoicePhoneViewProps> = ({
  bill,
  invoiceNo,
  isGst,
  orgName,
  orgProfile,
  billingSettings,
  invoiceFormat,
  status,
  paper,
  setPaper,
  downloading,
  sharing,
  showShareModal,
  shareNote,
  setShowShareModal,
  onClose,
  onPrint,
  onDownload,
  onSharePdf,
  onNativeShare,
  onEditBill,
  onCancelBill,
  t,
}) => {
  const [showPdfModal, setShowPdfModal] = useState(false);
  const isPaid = status.balance <= 0.01;
  const isUnpaid = status.balance >= bill.total - 0.01;
  const sizeShortLabel = paper === '80mm' ? '80mm' : 'A4';

  const handleDownloadWithSize = (chosenPaper: InvoicePaper) => {
    setPaper(chosenPaper);
    setShowPdfModal(false);
    onDownload(chosenPaper);
  };

  const view = (
    <div
      data-esc-close
      data-invoice-phone-portal="true"
      role="dialog"
      aria-modal="true"
      aria-label={`${isGst ? 'Tax Invoice' : 'Retail Bill'} ${invoiceNo}`}
      className="rt-sale-checkout-sheet rt-sale-checkout-sheet--full print:static print:bg-white"
    >
      <header className="rt-sale-header print:hidden">
        <div className="rt-sale-header__row">
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.back')}
            className="rt-sale-header__back"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="rt-sale-header__title">
            {t('sell.invoiceNum', { no: invoiceNo })}
          </h2>
          <div className="rt-sale-header__right">
            <span
              className={`rt-tag ${
                isPaid ? 'rt-tag--paid' : isUnpaid ? 'rt-tag--due' : 'rt-tag--soon'
              }`}
            >
              {isPaid
                ? t('sell.paid')
                : isUnpaid
                  ? t('sell.unpaid')
                  : `${t('home.dueLabel')} ₹${money(status.balance)}`}
            </span>
          </div>
        </div>
      </header>

      <div className="rt-checkout-body print:p-0 print:overflow-visible">
        <div id="printable-tax-invoice" className="hh-paper space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <b className="text-[13px] text-[var(--text)] break-words">{orgName}</b>
            <span className="text-xs text-[var(--text-2)] shrink-0 tabular-nums">{bill.date}</span>
          </div>
          <div className="text-xs text-[var(--text-2)]">{t('sell.invoiceNum', { no: invoiceNo })}</div>
          <hr className="hh-paper__hr" />
          <div className="text-xs text-[var(--text-2)] font-semibold">{t('sell.billTo')}</div>
          <div className="text-[12.5px] font-bold text-[var(--text)] break-words">
            {bill.retailer || t('sell.walkInSale')}
          </div>
          {bill.phone && (
            <div className="text-xs text-[var(--text-2)] tabular-nums">{bill.phone}</div>
          )}
          <hr className="hh-paper__hr" />
          <div className="space-y-0.5">
            {bill.items.map((it, idx) => {
              const d = freeStockInvoiceDisplay(it);
              return (
                <div key={it.key || `p_it_${idx}`} className="rt-ln !text-xs !py-1">
                  <span className="min-w-0 break-words pr-2 text-[var(--text)]">
                    {it.productName} × {it.qty}
                    {it.freeQty ? ` + ${it.freeQty} free` : ''}
                  </span>
                  <b className="shrink-0 tabular-nums text-[var(--text)]">
                    {d.isFreeStock ? 'FREE' : `₹${money(d.amount)}`}
                  </b>
                </div>
              );
            })}
          </div>
          <hr className="hh-paper__hr" />
          <div className="rt-ln !text-xs !py-1">
            <span className="text-[var(--text-2)]">{t('sell.total')}</span>
            <b className="tabular-nums text-[var(--text)]">₹{money(bill.total)}</b>
          </div>
          <div className="rt-ln !text-xs !py-1">
            <span className="text-[var(--text-2)]">{t('sell.paid')}</span>
            <b className="tabular-nums text-[var(--text)]">₹{money(bill.amountPaid || 0)}</b>
          </div>
          <div className="rt-ln !text-xs !py-1">
            <span className="text-[var(--text-2)]">{t('sell.balance')}</span>
            <b className={`tabular-nums ${status.balance > 0.01 ? 'text-[var(--due)]' : 'text-[var(--paid)]'}`}>
              ₹{money(status.balance)}
            </b>
          </div>
        </div>

        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={() => onPrint(paper)}
            className="rt-btn-outline flex-1 !px-2 text-xs"
          >
            <Printer size={14} />
            <span>{t('sell.print')}</span>
          </button>
          <button
            type="button"
            id="invoice-phone-pdf-btn"
            onClick={() => setShowPdfModal(true)}
            disabled={downloading}
            className="rt-btn-outline flex-1 !px-2 text-xs"
          >
            <Download size={14} />
            <span>{t('sell.pdf')}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="rt-btn rt-btn--wa flex-1 !px-2 text-xs"
          >
            <MessageCircle size={14} />
            <span>{t('sell.share')}</span>
          </button>
        </div>

        {(onEditBill || onCancelBill) && (
          <div className="flex gap-2 print:hidden">
            {onEditBill && (
              <button
                type="button"
                onClick={() => onEditBill(bill)}
                disabled={(bill.returns || []).length > 0}
                className="rt-btn-outline flex-1 text-xs disabled:opacity-40"
              >
                {t('sell.editBill')}
              </button>
            )}
            {onCancelBill && bill.status !== 'cancelled' && (
              <button
                type="button"
                onClick={() => onCancelBill(bill)}
                className="rt-btn-outline rt-btn-outline--due flex-1 text-xs"
              >
                {t('sell.cancelBill')}
              </button>
            )}
          </div>
        )}
      </div>

      {showPdfModal && (
        <div
          data-esc-close
          role="dialog"
          aria-modal="true"
          aria-label={t('sell.choosePdfSize')}
          className="fixed inset-0 z-60 flex items-end justify-center bg-black/45 select-none print:hidden"
          onClick={() => setShowPdfModal(false)}
        >
          <div
            className="hh-sheet rt-sheet-phone w-full space-y-2.5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hh-grab" aria-hidden="true" />
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-extrabold text-[15px] text-[var(--text)]">
                {t('sell.choosePdfSize')}
              </h3>
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="size-9 rounded-full flex items-center justify-center text-[var(--text-2)] cursor-pointer"
                aria-label={t('common.close')}
              >
                <X size={16} />
              </button>
            </div>
            <button
              type="button"
              id="invoice-phone-pdf-80mm"
              onClick={() => handleDownloadWithSize('80mm')}
              disabled={downloading}
              className={`rt-btn-outline w-full !justify-between !h-auto !py-3 !px-3.5 text-left ${
                paper === '80mm' ? '!border-[var(--primary)] !bg-[var(--primary-soft)]' : ''
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Receipt size={18} className="shrink-0 text-[var(--primary)]" />
                <span className="min-w-0">
                  <span className="block font-bold text-[13.5px] text-[var(--text)]">
                    {t('sell.pdfSize80mm')}
                  </span>
                  <span className="block text-xs font-medium text-[var(--text-2)]">
                    {t('sell.pdfSize80mmSub')}
                  </span>
                </span>
              </span>
              <Download size={16} className="shrink-0 text-[var(--text-2)]" />
            </button>
            <button
              type="button"
              id="invoice-phone-pdf-a4"
              onClick={() => handleDownloadWithSize('a4')}
              disabled={downloading}
              className={`rt-btn-outline w-full !justify-between !h-auto !py-3 !px-3.5 text-left ${
                paper === 'a4' ? '!border-[var(--primary)] !bg-[var(--primary-soft)]' : ''
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <FileText size={18} className="shrink-0 text-[var(--primary)]" />
                <span className="min-w-0">
                  <span className="block font-bold text-[13.5px] text-[var(--text)]">
                    {t('sell.pdfSizeA4')}
                  </span>
                  <span className="block text-xs font-medium text-[var(--text-2)]">
                    {t('sell.pdfSizeA4Sub')}
                  </span>
                </span>
              </span>
              <Download size={16} className="shrink-0 text-[var(--text-2)]" />
            </button>
          </div>
        </div>
      )}

      {showShareModal && (
        <div
          data-esc-close
          role="dialog"
          aria-modal="true"
          aria-label={t('sell.share')}
          className="fixed inset-0 z-60 flex items-end justify-center bg-black/45 select-none print:hidden"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="hh-sheet rt-sheet-phone w-full space-y-2.5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hh-grab" aria-hidden="true" />
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-extrabold text-[15px] text-[var(--text)]">
                {t('sell.share')}
              </h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="size-9 rounded-full flex items-center justify-center text-[var(--text-2)] cursor-pointer"
                aria-label={t('common.close')}
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-2)] mb-1">
                {t('sell.pdfPaperSize')}
              </div>
              <div
                className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--bg)] border border-[var(--border)]"
                role="group"
                aria-label={t('sell.pdfPaperSize')}
              >
                {([
                  ['80mm', '80mm'],
                  ['a4', 'A4'],
                ] as [InvoicePaper, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    id={`phone-share-paper-${key}`}
                    aria-pressed={paper === key}
                    onClick={() => setPaper(key)}
                    className={`min-h-[40px] rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      paper === key
                        ? 'bg-[var(--surface)] text-[var(--text)] shadow-2xs border border-[var(--border)]'
                        : 'text-[var(--text-2)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                setShowShareModal(false);
                const msg = whatsAppResultMessage(await sendBillOnWhatsApp(bill, orgProfile, billingSettings, invoiceFormat));
                if (msg) notify(msg.text, msg.kind);
              }}
              className="rt-btn rt-btn--wa w-full"
            >
              <MessageCircle size={17} />
              <span>{t('sell.shareOnWhatsapp')}</span>
            </button>
            <button
              type="button"
              onClick={() => onSharePdf(paper)}
              disabled={sharing}
              className="rt-btn-outline w-full"
            >
              <Paperclip size={16} />
              <span>{t('sell.sharePdfFile')} ({sizeShortLabel})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onDownload(paper);
                setShowShareModal(false);
              }}
              disabled={downloading}
              className="rt-btn-outline w-full"
            >
              <Download size={16} />
              <span>{t('sell.downloadPdfSize', { size: sizeShortLabel })}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowShareModal(false);
                onNativeShare();
              }}
              className="rt-btn-outline w-full"
            >
              <Share2 size={16} />
              <span>{t('common.share')}</span>
            </button>
            {shareNote && (
              <p role="status" className="rt-notice rt-notice--soon">{shareNote}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(view, document.body) : view;
};

