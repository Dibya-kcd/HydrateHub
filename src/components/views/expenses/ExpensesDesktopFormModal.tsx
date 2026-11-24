import React from "react";
import { IndianRupee, MoreHorizontal, Trash2, X } from "lucide-react";
import { Bill } from "../../../types";
import type { BusinessExpenseRecord } from "../../../utils/storage";
import { EXPENSE_CATEGORY_KEYS, EXPENSE_LABELS } from "../../../utils/netProfit";
import { money } from "../../../utils/billing";
import { todayISO } from "../../../utils/dateLocal";
import { PartySearchSelect, type PartyOption } from "../../common/PartySearchSelect";
import { ConfirmModal } from "../../ui";
import {
  addDaysISO,
  CAT_ICON,
  catLabel,
  chipCls,
  fieldBoxCls,
  fieldLabelCls,
  Mode,
  MODES,
} from "./expenseViewHelpers";

interface ExpensesDesktopFormModalProps {
  showForm: boolean;
  editingId: string | null;
  closeForm: () => void;
  amount: string;
  setAmount: (val: string) => void;
  category: string;
  setCategory: (val: string) => void;
  paidTo: string;
  setPaidTo: (val: string) => void;
  setCustomerId: (val: string | undefined) => void;
  partyOptions: PartyOption[];
  mode: Mode;
  setMode: (val: Mode) => void;
  date: string;
  setDate: (val: string) => void;
  note: string;
  setNote: (val: string) => void;
  tripId: string;
  setTripId: (val: string) => void;
  billId: string;
  setBillId: (val: string) => void;
  referenceNote: string;
  setReferenceNote: (val: string) => void;
  recentTrips: any[];
  openBills: Bill[];
  amountOk: boolean;
  confirmDelete: () => void;
  submit: () => void;
  expenseToDelete: BusinessExpenseRecord | null;
  setExpenseToDelete: (val: BusinessExpenseRecord | null) => void;
  handleDeleteExpense: (exp: BusinessExpenseRecord, reason?: string) => void;
}

export const ExpensesDesktopFormModal: React.FC<ExpensesDesktopFormModalProps> = ({
  showForm,
  editingId,
  closeForm,
  amount,
  setAmount,
  category,
  setCategory,
  paidTo,
  setPaidTo,
  setCustomerId,
  partyOptions,
  mode,
  setMode,
  date,
  setDate,
  note,
  setNote,
  tripId,
  setTripId,
  billId,
  setBillId,
  referenceNote,
  setReferenceNote,
  recentTrips,
  openBills,
  amountOk,
  confirmDelete,
  submit,
  expenseToDelete,
  setExpenseToDelete,
  handleDeleteExpense,
}) => (
  <>
    {/* Add / edit sheet */}
    {showForm && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={editingId ? "Edit expense" : "Add expense"}>
        <button type="button" className="absolute inset-0 bg-slate-900/45 cursor-pointer" aria-label="Close" onClick={closeForm} />
        <div className="relative w-full sm:max-w-lg max-h-[92dvh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 pt-4 pb-2">
            <h2 className="text-lg font-black text-slate-900">{editingId ? "Edit expense" : "Add expense"}</h2>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close"
              className="size-10 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 space-y-4">
            {/* Amount */}
            <div>
              <label htmlFor="exp-amount" className={fieldLabelCls}>Amount</label>
              <div className="flex items-center gap-3 h-16 rounded-2xl border-2 border-slate-300 focus-within:border-slate-900 px-4 bg-white transition-colors shadow-2xs">
                <div className="size-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-700">
                  <IndianRupee className="w-5 h-5" />
                </div>
                <input
                  id="exp-amount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  autoFocus={!editingId}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  style={{
                    border: 'none',
                    outline: 'none',
                    boxShadow: 'none',
                    background: 'transparent',
                    padding: 0,
                    margin: 0,
                    minHeight: 'auto',
                  }}
                  className="flex-1 min-w-0 h-full !border-0 !outline-none !shadow-none !bg-transparent !p-0 text-3xl font-black tabular-nums text-slate-900 placeholder:text-slate-300 focus:!ring-0 focus:!border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <span className={fieldLabelCls}>What was it for?</span>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Category">
                {EXPENSE_CATEGORY_KEYS.map((k) => {
                  const Icon = CAT_ICON[k] || MoreHorizontal;
                  const on = category === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      title={EXPENSE_LABELS[k] || k}
                      onClick={() => setCategory(k)}
                      className={`min-h-[64px] rounded-xl border-2 px-1.5 py-2 flex flex-col items-center justify-center gap-1 text-[12px] font-bold leading-tight text-center cursor-pointer transition-colors ${
                        on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="w-[18px] h-[18px] shrink-0" />
                      <span className="max-w-full break-words">{catLabel(k)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Paid to */}
            <div>
              <span className={fieldLabelCls}>Paid to <span className="normal-case font-medium text-slate-400">(optional)</span></span>
              <PartySearchSelect
                value={paidTo}
                options={partyOptions}
                placeholder="Search party or type a name"
                onSelect={(name, opt) => {
                  setPaidTo(name);
                  if (opt?.key && !String(opt.key).startsWith("name:") && !String(opt.key).startsWith("sm:")) {
                    setCustomerId(String(opt.key));
                  } else {
                    setCustomerId(undefined);
                  }
                }}
              />
            </div>

            {/* How paid */}
            <div>
              <span className={fieldLabelCls}>Paid by</span>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Paid by">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={mode === m.id}
                    onClick={() => setMode(m.id)}
                    className={chipCls(mode === m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div>
              <label htmlFor="exp-date" className={fieldLabelCls}>Date</label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="exp-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value || todayISO())}
                  className={`${fieldBoxCls} flex-1 min-w-[150px]`}
                />
                <button type="button" onClick={() => setDate(todayISO())} className={chipCls(date === todayISO())}>
                  Today
                </button>
                <button type="button" onClick={() => setDate(addDaysISO(todayISO(), -1))} className={chipCls(date === addDaysISO(todayISO(), -1))}>
                  Yesterday
                </button>
              </div>
            </div>

            {/* Note */}
            <div>
              <label htmlFor="exp-note" className={fieldLabelCls}>Note <span className="normal-case font-medium text-slate-400">(optional)</span></label>
              <input
                id="exp-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Diesel for van"
                className={fieldBoxCls}
              />
            </div>

            {/* Rarely used */}
            <details className="group rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" open={Boolean(tripId || billId || referenceNote)}>
              <summary className="flex items-center justify-between gap-2 cursor-pointer select-none list-none text-[13px] font-bold text-slate-700">
                <span>Link to trip, invoice or reference</span>
                <span className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="mt-3 space-y-3">
                <div>
                  <label htmlFor="exp-trip" className={fieldLabelCls}>Trip</label>
                  <select id="exp-trip" value={tripId} onChange={(e) => setTripId(e.target.value)} className={fieldBoxCls}>
                    <option value="">None</option>
                    {recentTrips.map((t: any) => (
                      <option key={t.id} value={String(t.id)}>
                        #{t.id} · {String(t.date).slice(0, 10)} · {t.vehicle || "vehicle"}
                        {t.driver ? ` · ${t.driver}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="exp-bill" className={fieldLabelCls}>Invoice</label>
                  <select id="exp-bill" value={billId} onChange={(e) => setBillId(e.target.value)} className={fieldBoxCls}>
                    <option value="">None</option>
                    {openBills.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        #{b.id} · {b.retailer} · {String(b.date).slice(0, 10)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="exp-ref" className={fieldLabelCls}>UTR / cheque no.</label>
                  <input id="exp-ref" value={referenceNote} onChange={(e) => setReferenceNote(e.target.value)} className={fieldBoxCls} />
                </div>
              </div>
            </details>
          </div>

          <div className="shrink-0 flex gap-2 border-t border-slate-100 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {editingId && (
              <button
                type="button"
                onClick={confirmDelete}
                aria-label="Delete expense"
                className="size-[52px] shrink-0 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 flex items-center justify-center cursor-pointer active:scale-95"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={!amountOk}
              className="flex-1 min-w-0 min-h-[52px] rounded-xl bg-slate-900 text-white text-[15px] font-black disabled:opacity-40 cursor-pointer active:scale-[0.99]"
            >
              {editingId ? "Save changes" : amountOk ? `Save ₹${money(Number(amount))}` : "Save expense"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Delete Confirmation Dialog */}
    <ConfirmModal
      isOpen={Boolean(expenseToDelete)}
      onClose={() => setExpenseToDelete(null)}
      variant="danger"
      title="Delete Expense?"
      subtitle={
        expenseToDelete
          ? `${expenseToDelete.paidTo || catLabel(expenseToDelete.category)} · ${String(expenseToDelete.date).slice(0, 10)}`
          : undefined
      }
      message={
        expenseToDelete
          ? `Deleting this ₹${money(expenseToDelete.amount)} expense removes it from profit & cash-flow calculations and records it in the Activity Log.`
          : undefined
      }
      impactItems={
        expenseToDelete
          ? [
              {
                label: expenseToDelete.paidTo || catLabel(expenseToDelete.category),
                detail: `${catLabel(expenseToDelete.category)} · ${(expenseToDelete.mode || "cash").toUpperCase()}${
                  expenseToDelete.note ? ` · "${expenseToDelete.note}"` : ""
                }`,
                qtyChange: `-₹${money(expenseToDelete.amount)}`,
              },
            ]
          : []
      }
      rectificationPrompt="Reason for deleting expense *"
      rectificationPlaceholder="e.g. Duplicate entry, wrong amount, cancelled expense"
      reasonPresets={["Duplicate entry", "Wrong amount", "Cancelled expense", "Entered by mistake"]}
      commentMinLength={4}
      confirmButtonLabel="Yes, Delete Expense"
      onConfirm={() => {}}
      onConfirmWithComment={(reason) => {
        if (expenseToDelete) handleDeleteExpense(expenseToDelete, reason);
      }}
    />
  </>
);
