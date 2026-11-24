import React, { useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, Printer, Receipt, Save, X } from "lucide-react";
import {
  Bill,
  ExistingCustomer,
  OrganizationProfile,
  PaletteTokens,
  PaymentRecord,
} from "../../../types";
import { money } from "../../../utils/billing";
import { resolveRemainingDueParts } from "../../../utils/paymentReceiptText";
import {
  sendPaymentReceiptOnWhatsApp,
  whatsAppPaymentReceiptMessage,
} from "../../../utils/whatsappPaymentReceipt";
import { notify } from "../../../utils/toast";
import { RecordPaymentModal } from "../../common/RecordPaymentModal";
import { TaxInvoiceModal } from "../../common/TaxInvoiceModal";
import { ConfirmModal } from "../../ui";

interface PaymentsModalsProps {
  receiptPayment: PaymentRecord | null;
  setReceiptPayment: (p: PaymentRecord | null) => void;
  paymentToEdit: PaymentRecord | null;
  setPaymentToEdit: (p: PaymentRecord | null) => void;
  taxInvoiceModalBill: Bill | null;
  setTaxInvoiceModalBill: (b: Bill | null) => void;
  paymentToDelete: PaymentRecord | null;
  setPaymentToDelete: (p: PaymentRecord | null) => void;
  whatsAppPromptPayment: PaymentRecord | null;
  setWhatsAppPromptPayment: (p: PaymentRecord | null) => void;
  promptPhoneInput: string;
  setPromptPhoneInput: (v: string) => void;
  selectedPaymentForDetails: PaymentRecord | null;
  setSelectedPaymentForDetails: (p: PaymentRecord | null) => void;
  existingCustomers: ExistingCustomer[];
  bills: Bill[];
  palette: PaletteTokens;
  orgProfile: OrganizationProfile;
  loggedInUserName: string;
  getCustomerRawBalance?: (p: PaymentRecord) => number;
  updatePayment: (updated: PaymentRecord, reason?: string) => void;
  deletePayment: (id: string, comment?: string) => void;
}

export const PaymentsModals: React.FC<PaymentsModalsProps> = ({
  receiptPayment,
  setReceiptPayment,
  paymentToEdit,
  setPaymentToEdit,
  taxInvoiceModalBill,
  setTaxInvoiceModalBill,
  paymentToDelete,
  setPaymentToDelete,
  whatsAppPromptPayment,
  setWhatsAppPromptPayment,
  promptPhoneInput,
  setPromptPhoneInput,
  selectedPaymentForDetails,
  setSelectedPaymentForDetails,
  existingCustomers,
  bills,
  palette,
  orgProfile,
  loggedInUserName,
  getCustomerRawBalance,
  updatePayment,
  deletePayment,
}) => {
  const [pendingPaymentEdit, setPendingPaymentEdit] = useState<{
    before: PaymentRecord;
    after: PaymentRecord;
  } | null>(null);
  const [sendingReceiptWa, setSendingReceiptWa] = useState(false);

  const resolveRawBalance = (p: PaymentRecord): number => {
    if (getCustomerRawBalance) return getCustomerRawBalance(p);
    const matched = existingCustomers.find(
      (c) => c.name.trim().toLowerCase() === (p.customerName || "").trim().toLowerCase(),
    );
    if (matched) {
      if (matched.balanceDue > 0.004) return matched.balanceDue;
      if ((matched.advance || 0) > 0.004) return -(matched.advance || 0);
    }
    return 0;
  };

  const receiptRawBalance = receiptPayment ? resolveRawBalance(receiptPayment) : 0;
  const receiptDueParts = resolveRemainingDueParts(receiptRawBalance);
  const receiptCustomerPhone = receiptPayment
    ? receiptPayment.customerPhone ||
      existingCustomers.find(
        (c) => c.name.trim().toLowerCase() === (receiptPayment.customerName || "").trim().toLowerCase(),
      )?.phone ||
      ""
    : "";

  const promptRawBalance = whatsAppPromptPayment ? resolveRawBalance(whatsAppPromptPayment) : 0;
  const promptDueParts = resolveRemainingDueParts(promptRawBalance);

  return (
    <>
      {/* 1. Printable Receipt Modal */}
      {receiptPayment &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden bg-white flex flex-col text-xs my-auto"
              style={{ borderColor: palette.line }}
            >
              <div
                className="px-4 py-3 border-b flex items-center justify-between"
                style={{ backgroundColor: palette.navy, color: "#FFFFFF" }}
              >
                <div className="flex items-center gap-2">
                  <Receipt size={16} className="text-amber-400" />
                  <span className="font-bold">Official Payment Receipt</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={sendingReceiptWa}
                    onClick={async () => {
                      if (!receiptCustomerPhone) {
                        const target = receiptPayment;
                        setReceiptPayment(null);
                        setWhatsAppPromptPayment(target);
                        setPromptPhoneInput("");
                        return;
                      }
                      setSendingReceiptWa(true);
                      try {
                        const res = await sendPaymentReceiptOnWhatsApp(
                          { ...receiptPayment, customerPhone: receiptCustomerPhone },
                          orgProfile,
                          { rawBalance: receiptRawBalance },
                        );
                        const msg = whatsAppPaymentReceiptMessage(res);
                        if (msg) notify(msg.text, msg.kind);
                      } finally {
                        setSendingReceiptWa(false);
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#25D366] text-white font-bold hover:bg-[#1EBE5D] disabled:opacity-60 cursor-pointer"
                  >
                    <MessageCircle size={13} />
                    <span>{sendingReceiptWa ? "PDF..." : "WhatsApp"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-white text-slate-900 font-bold hover:bg-neutral-100 cursor-pointer"
                  >
                    <Printer size={13} />
                    <span>Print</span>
                  </button>
                  <button
                    aria-label="Close"
                    type="button"
                    onClick={() => setReceiptPayment(null)}
                    className="text-white/70 hover:text-white cursor-pointer ml-2"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-6 bg-white space-y-4" id="printable-payment-receipt">
                <div className="text-center border-b pb-4 border-slate-200">
                  <h2 className="text-lg font-black text-slate-900">
                    {orgProfile?.name || "Hydrate Hub"}
                  </h2>
                  <div className="text-slate-500 text-xs mt-0.5">
                    {orgProfile?.address || "Wholesale Beverages & Packaged Water Distribution"}
                  </div>
                  {orgProfile?.phone && (
                    <div className="text-slate-500 text-xs">Phone: {orgProfile.phone}</div>
                  )}
                  {orgProfile?.gstin && (
                    <div className="text-slate-500 font-mono text-xs">GSTIN: {orgProfile.gstin}</div>
                  )}
                  <div className="mt-2 inline-block px-3 py-1 rounded bg-slate-100 font-bold uppercase text-slate-800 text-xs tracking-wider border border-slate-200">
                    {receiptPayment.isRefund || receiptPayment.amount < 0
                      ? "PAYMENT REFUND RECEIPT"
                      : "PAYMENT ACKNOWLEDGMENT RECEIPT"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400">Customer:</span>{" "}
                    <strong className="text-slate-900 text-xs">{receiptPayment.customerName}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400">Payment Date:</span>{" "}
                    <strong className="text-slate-800">
                      {receiptPayment.paymentDate || receiptPayment.createdAt?.slice(0, 10)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Payment Mode:</span>{" "}
                    <strong className="text-slate-900 uppercase">{receiptPayment.mode}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400">Recorded By:</span>{" "}
                    <strong className="text-slate-800">{receiptPayment.recordedBy || loggedInUserName}</strong>
                  </div>
                  {receiptPayment.referenceNote && (
                    <div className="col-span-2">
                      <span className="text-slate-400">Ref Note / UTR / Cheque:</span>{" "}
                      <strong className="font-mono text-slate-800">{receiptPayment.referenceNote}</strong>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl border-2 border-dashed border-emerald-600 bg-emerald-50/60 text-center my-4">
                  <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    {receiptPayment.isRefund || receiptPayment.amount < 0
                      ? "Amount Refunded"
                      : "Amount Received with Thanks"}
                  </div>
                  <div className="text-3xl font-black text-emerald-700 font-mono tabular-nums my-1">
                    {receiptPayment.isRefund || receiptPayment.amount < 0 ? "−" : "+"}₹
                    {money(Math.abs(receiptPayment.amount))}
                  </div>
                  <div className="text-xs text-slate-500 italic">
                    Recorded by: {receiptPayment.recordedBy || loggedInUserName}
                  </div>
                </div>

                <div
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    receiptDueParts.due > 0
                      ? "bg-rose-50 border-rose-200 text-rose-900"
                      : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}
                >
                  <span className="font-bold text-xs uppercase tracking-wider">
                    Remaining Total Due (Till Date)
                  </span>
                  <span className="font-black font-mono text-sm">
                    {receiptDueParts.due > 0
                      ? `₹${money(receiptDueParts.due)}`
                      : receiptDueParts.advance > 0
                        ? `₹0.00 (Adv ₹${money(receiptDueParts.advance)})`
                        : "₹0.00 (Settled)"}
                  </span>
                </div>

                <div className="pt-8 flex justify-between items-end border-t border-slate-200 text-xs text-slate-500">
                  <div>Customer Signature</div>
                  <div className="text-right">Authorized Signatory</div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* 2. Edit Payment Modal */}
      {paymentToEdit &&
        createPortal(
          <div className="fixed inset-0 z-[9999] pointer-events-auto">
            <RecordPaymentModal
              isOpen={true}
              onClose={() => setPaymentToEdit(null)}
              paymentToEdit={paymentToEdit}
              existingCustomers={existingCustomers}
              bills={bills}
              palette={palette}
              onSavePayment={(payload) => {
                const updatedRec: PaymentRecord = {
                  ...paymentToEdit,
                  customerName: payload.customerName,
                  billId: payload.billId,
                  amount: payload.amount,
                  paymentDate: payload.paymentDate,
                  mode: payload.mode,
                  referenceNote: payload.referenceNote,
                  recordedBy: paymentToEdit.recordedBy || loggedInUserName,
                };
                setPendingPaymentEdit({ before: paymentToEdit, after: updatedRec });
                setPaymentToEdit(null);
              }}
            />
          </div>,
          document.body,
        )}

      {/* 2b. Confirm Payment Edit Modal */}
      {pendingPaymentEdit &&
        createPortal(
          <div className="fixed inset-0 z-[9999] pointer-events-auto">
            <ConfirmModal
              isOpen={true}
              onClose={() => {
                const restore = pendingPaymentEdit.before;
                setPendingPaymentEdit(null);
                setPaymentToEdit(restore);
              }}
              variant="warning"
              title="Confirm Payment Edit"
              subtitle={`${pendingPaymentEdit.after.customerName} · Receipt #${pendingPaymentEdit.after.id}`}
              message="Review the changes below and enter a reason. This change will be recorded in the global Activity Log."
              impactItems={[
                {
                  label: "Amount",
                  detail: `₹${money(pendingPaymentEdit.before.amount)} → ₹${money(pendingPaymentEdit.after.amount)}`,
                  qtyChange:
                    pendingPaymentEdit.before.amount !== pendingPaymentEdit.after.amount
                      ? `${pendingPaymentEdit.after.amount - pendingPaymentEdit.before.amount >= 0 ? "+" : ""}₹${money(
                          pendingPaymentEdit.after.amount - pendingPaymentEdit.before.amount,
                        )}`
                      : "Unchanged",
                },
                {
                  label: "Mode & Date",
                  detail: `${pendingPaymentEdit.before.mode.toUpperCase()} (${pendingPaymentEdit.before.paymentDate}) → ${pendingPaymentEdit.after.mode.toUpperCase()} (${pendingPaymentEdit.after.paymentDate})`,
                },
                ...(pendingPaymentEdit.before.billId !== pendingPaymentEdit.after.billId
                  ? [
                      {
                        label: "Invoice Link",
                        detail: `${pendingPaymentEdit.before.billId ? `Bill #${pendingPaymentEdit.before.billId}` : "Advance"} → ${
                          pendingPaymentEdit.after.billId ? `Bill #${pendingPaymentEdit.after.billId}` : "Advance"
                        }`,
                      },
                    ]
                  : []),
              ]}
              rectificationPrompt="Reason for editing payment *"
              rectificationPlaceholder="e.g. Corrected amount, changed payment mode, fixed bill allocation"
              reasonPresets={["Corrected amount", "Changed payment mode", "Fixed bill allocation", "Corrected date/ref"]}
              commentMinLength={4}
              confirmButtonLabel="Save Payment Edit"
              confirmIcon={<Save className="w-3.5 h-3.5" />}
              onConfirm={() => {}}
              onConfirmWithComment={(reason) => {
                updatePayment(pendingPaymentEdit.after, reason);
                if (selectedPaymentForDetails?.id === pendingPaymentEdit.after.id) {
                  setSelectedPaymentForDetails(pendingPaymentEdit.after);
                }
                setPendingPaymentEdit(null);
              }}
            />
          </div>,
          document.body,
        )}

      {/* 3. Tax Invoice Modal */}
      {taxInvoiceModalBill &&
        createPortal(
          <div className="fixed inset-0 z-[9999] pointer-events-auto">
            <TaxInvoiceModal
              bill={taxInvoiceModalBill}
              onClose={() => setTaxInvoiceModalBill(null)}
            />
          </div>,
          document.body,
        )}

      {/* 4. Delete Confirm Modal */}
      {paymentToDelete &&
        createPortal(
          <div className="fixed inset-0 z-[9999] pointer-events-auto">
            <ConfirmModal
              isOpen={true}
              onClose={() => setPaymentToDelete(null)}
              rectificationPrompt="Reason for reversing this payment *"
              rectificationPlaceholder="e.g. Duplicate receipt, wrong party, bounced / failed transaction"
              reasonPresets={["Duplicate receipt", "Wrong party", "Bounced / failed txn", "Entered by mistake"]}
              commentMinLength={4}
              impactItems={[
                {
                  label: paymentToDelete.customerName,
                  detail: `Mode: ${paymentToDelete.mode.toUpperCase()} · Date: ${paymentToDelete.paymentDate || paymentToDelete.createdAt?.slice(0, 10) || "—"}`,
                  qtyChange: `${paymentToDelete.amount < 0 ? "+" : "-"}₹${money(Math.abs(paymentToDelete.amount))}`,
                },
                ...(paymentToDelete.billId
                  ? [{ label: `Linked Invoice #${paymentToDelete.billId}`, detail: "Invoice will owe this amount again. A new reversing entry is added; this payment stays in the history." }]
                  : [{ label: "Unlinked Advance Receipt", detail: "Customer advance credit will reduce by a new reversing entry; this receipt stays in the history." }]),
              ]}
              onConfirmWithComment={(comment) => {
                if (paymentToDelete) {
                  deletePayment(paymentToDelete.id, comment);
                  if (selectedPaymentForDetails?.id === paymentToDelete.id) {
                    setSelectedPaymentForDetails(null);
                  }
                  setPaymentToDelete(null);
                }
              }}
              onConfirm={() => {}}
              title="Reverse Payment"
              message={`This adds a new entry of ${paymentToDelete.amount < 0 ? "+" : "-"}₹${money(Math.abs(paymentToDelete.amount))} for ${paymentToDelete.customerName} and leaves the original receipt in the records. Nothing is deleted.`}
              confirmButtonLabel="Yes, Reverse Payment"
              variant="danger"
            />
          </div>,
          document.body,
        )}

      {/* 5. WhatsApp Prompt Modal */}
      {whatsAppPromptPayment &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4 my-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Send WhatsApp Receipt</h3>
                    <p className="text-xs text-slate-500">{whatsAppPromptPayment.customerName}</p>
                  </div>
                </div>
                <button
                  aria-label="Close"
                  type="button"
                  onClick={() => setWhatsAppPromptPayment(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-semibold">Remaining Due (Till Date)</span>
                  <span className={`font-black font-mono ${promptDueParts.due > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                    {promptDueParts.due > 0
                      ? `₹${money(promptDueParts.due)}`
                      : promptDueParts.advance > 0
                        ? `₹0.00 (Adv ₹${money(promptDueParts.advance)})`
                        : "₹0.00 (Settled)"}
                  </span>
                </div>
                <label className="text-xs font-semibold text-slate-700 block">
                  Enter Customer WhatsApp Mobile Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={promptPhoneInput}
                    onChange={(e) => setPromptPhoneInput(e.target.value)}
                    placeholder="e.g. 9437012345"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    autoFocus
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setWhatsAppPromptPayment(null)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!promptPhoneInput.trim() || sendingReceiptWa}
                    onClick={async () => {
                      const target = whatsAppPromptPayment;
                      const phone = promptPhoneInput.trim();
                      if (!target || !phone) return;
                      setSendingReceiptWa(true);
                      try {
                        const res = await sendPaymentReceiptOnWhatsApp(
                          { ...target, customerPhone: phone },
                          orgProfile,
                          { rawBalance: promptRawBalance },
                        );
                        const msg = whatsAppPaymentReceiptMessage(res);
                        if (msg) notify(msg.text, msg.kind);
                        setWhatsAppPromptPayment(null);
                      } finally {
                        setSendingReceiptWa(false);
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#25D366] hover:bg-[#1EBE5D] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{sendingReceiptWa ? "Preparing PDF..." : "Send PDF"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
