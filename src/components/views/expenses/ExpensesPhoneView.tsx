import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Plus, Search, X } from "lucide-react";
import { Bill } from "../../../types";
import type { BusinessExpenseRecord } from "../../../utils/storage";
import { EXPENSE_CATEGORY_KEYS, PAY_CATEGORIES } from "../../../utils/netProfit";
import { money } from "../../../utils/billing";
import { todayISO } from "../../../utils/dateLocal";
import { shortDateLabel } from "../../../utils/crateTimeline";
import type { PartyOption } from "../../common/PartySearchSelect";
import { addDaysISO, CAT_ICON, catLabel, dayLabel, Mode, MODES, Period, PERIODS } from "./expenseViewHelpers";

interface ExpensesPhoneViewProps {
  expenses?: BusinessExpenseRecord[];
  showForm: boolean;
  editingId: string | null;
  phoneLinkStep: boolean;
  setPhoneLinkStep: (val: boolean) => void;
  phoneLinkTab: "trip" | "invoice" | "reference";
  setPhoneLinkTab: (val: "trip" | "invoice" | "reference") => void;
  tripId: string;
  setTripId: (val: string) => void;
  billId: string;
  setBillId: (val: string) => void;
  referenceNote: string;
  setReferenceNote: (val: string) => void;
  recentTrips: any[];
  openBills: Bill[];
  amountOk: boolean;
  submit: () => void;
  closeForm: () => void;
  amount: string;
  setAmount: (val: string) => void;
  category: string;
  setCategory: (val: string) => void;
  paidTo: string;
  setPaidTo: (val: string) => void;
  setCustomerId: (val: string | undefined) => void;
  paidToOpen: boolean;
  setPaidToOpen: (val: boolean) => void;
  phonePartySuggestions: PartyOption[];
  mode: Mode;
  setMode: (val: Mode) => void;
  date: string;
  setDate: (val: string) => void;
  note: string;
  setNote: (val: string) => void;
  phoneLinkSummary: string;
  openCreate: () => void;
  openEdit: (e: BusinessExpenseRecord) => void;
  period: Period;
  setPeriod: (val: Period) => void;
  periodLabel: string;
  q: string;
  setQ: (val: string) => void;
  activeCat: string;
  setCatFilter: (val: string) => void;
  totals: { all: number; pay: number; ops: number; count: number };
  categoryChips: [string, number][];
  filtered: BusinessExpenseRecord[];
  today: string;
  detailExpense: BusinessExpenseRecord | null;
  setDetailExpense: (val: BusinessExpenseRecord | null) => void;
  expenseToDelete: BusinessExpenseRecord | null;
  setExpenseToDelete: (val: BusinessExpenseRecord | null) => void;
  handleDeleteExpense: (exp: BusinessExpenseRecord, reason?: string) => void;
}

export const ExpensesPhoneView: React.FC<ExpensesPhoneViewProps> = ({
  expenses,
  showForm,
  editingId,
  phoneLinkStep,
  setPhoneLinkStep,
  phoneLinkTab,
  setPhoneLinkTab,
  tripId,
  setTripId,
  billId,
  setBillId,
  referenceNote,
  setReferenceNote,
  recentTrips,
  openBills,
  amountOk,
  submit,
  closeForm,
  amount,
  setAmount,
  category,
  setCategory,
  paidTo,
  setPaidTo,
  setCustomerId,
  paidToOpen,
  setPaidToOpen,
  phonePartySuggestions,
  mode,
  setMode,
  date,
  setDate,
  note,
  setNote,
  phoneLinkSummary,
  openCreate,
  openEdit,
  period,
  setPeriod,
  periodLabel,
  q,
  setQ,
  activeCat,
  setCatFilter,
  totals,
  categoryChips,
  filtered,
  today,
  detailExpense,
  setDetailExpense,
  expenseToDelete,
  setExpenseToDelete,
  handleDeleteExpense,
}) => {
  const [deleteReason, setDeleteReason] = useState("");
  useEffect(() => {
    setDeleteReason("");
  }, [expenseToDelete?.id]);
  const delReasonOk = deleteReason.trim().length >= 4;
  if (showForm && phoneLinkStep) {
    return (
      <div id="view-expenses" className="rt-flow-phone">
        <header className="hh-sales-top">
          <button
            type="button"
            className="rt-back-link"
            onClick={() => setPhoneLinkStep(false)}
          >
            <ChevronLeft size={20} strokeWidth={2.5} aria-hidden="true" />
            <span>{editingId ? "Edit expense" : "New expense"}</span>
          </button>
        </header>

        <div className="rt-flow-phone__body space-y-3">
          <div
            className="rt-in"
            style={{
              borderColor: "var(--primary)",
              boxShadow: "0 0 0 3px var(--primary-soft)",
            }}
          >
            <label className="rt-in__label" htmlFor="ph-exp-primary-link">
              LINK TO TRIP, INVOICE OR REFERENCE
            </label>
            {phoneLinkTab === "trip" ? (
              <div className="rt-in__select-wrap">
                <select
                  id="ph-exp-primary-link"
                  className="rt-in__control"
                  value={tripId}
                  onChange={(e) => setTripId(e.target.value)}
                >
                  <option value="">Optional — select trip</option>
                  {recentTrips.map((t: any) => (
                    <option key={t.id} value={String(t.id)}>
                      Trip #{t.id} · {shortDateLabel(String(t.date))}
                      {t.vehicle ? ` · ${t.vehicle}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} className="rt-in__select-chev" aria-hidden="true" />
              </div>
            ) : phoneLinkTab === "invoice" ? (
              <div className="rt-in__select-wrap">
                <select
                  id="ph-exp-primary-link"
                  className="rt-in__control"
                  value={billId}
                  onChange={(e) => setBillId(e.target.value)}
                >
                  <option value="">Optional — select invoice</option>
                  {openBills.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      #{b.id} · {b.retailer} · {shortDateLabel(String(b.date))}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} className="rt-in__select-chev" aria-hidden="true" />
              </div>
            ) : (
              <input
                id="ph-exp-primary-link"
                type="text"
                className="rt-in__control"
                value={referenceNote}
                onChange={(e) => setReferenceNote(e.target.value)}
                placeholder="For UPI, bank or cheque"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="hh-set-seg2__btn"
              aria-pressed={phoneLinkTab === "trip"}
              onClick={() => setPhoneLinkTab("trip")}
            >
              Trip
            </button>
            <button
              type="button"
              className="hh-set-seg2__btn"
              aria-pressed={phoneLinkTab === "invoice"}
              onClick={() => setPhoneLinkTab("invoice")}
            >
              Invoice
            </button>
            <button
              type="button"
              className="hh-set-seg2__btn"
              aria-pressed={phoneLinkTab === "reference"}
              onClick={() => setPhoneLinkTab("reference")}
            >
              Reference
            </button>
          </div>

          {phoneLinkTab !== "trip" && (
            <div className="rt-in">
              <label className="rt-in__label" htmlFor="ph-exp-trip">
                TRIP
              </label>
              <div className="rt-in__select-wrap">
                <select
                  id="ph-exp-trip"
                  className="rt-in__control"
                  value={tripId}
                  onChange={(e) => setTripId(e.target.value)}
                >
                  <option value="">Optional</option>
                  {recentTrips.map((t: any) => (
                    <option key={t.id} value={String(t.id)}>
                      Trip #{t.id} · {shortDateLabel(String(t.date))}
                      {t.vehicle ? ` · ${t.vehicle}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} className="rt-in__select-chev" aria-hidden="true" />
              </div>
            </div>
          )}

          {phoneLinkTab !== "invoice" && (
            <div className="rt-in">
              <label className="rt-in__label" htmlFor="ph-exp-invoice">
                INVOICE
              </label>
              <div className="rt-in__select-wrap">
                <select
                  id="ph-exp-invoice"
                  className="rt-in__control"
                  value={billId}
                  onChange={(e) => setBillId(e.target.value)}
                >
                  <option value="">Optional</option>
                  {openBills.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      #{b.id} · {b.retailer} · {shortDateLabel(String(b.date))}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} className="rt-in__select-chev" aria-hidden="true" />
              </div>
            </div>
          )}

          {phoneLinkTab !== "reference" && (
            <div className="rt-in">
              <label className="rt-in__label" htmlFor="ph-exp-utr">
                UTR / CHEQUE NO.
              </label>
              <input
                id="ph-exp-utr"
                type="text"
                className="rt-in__control"
                value={referenceNote}
                onChange={(e) => setReferenceNote(e.target.value)}
                placeholder="For UPI, bank or cheque"
              />
            </div>
          )}

          <div className="rt-noti">
            Linked trip expenses also appear in that trip&apos;s settlement.
          </div>
        </div>

        <div className="rt-flow-phone__footer">
          <button
            type="button"
            className="rt-btn w-full"
            disabled={!amountOk}
            onClick={submit}
          >
            {editingId ? "Save changes" : "Save expense"}
          </button>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div id="view-expenses" className="rt-flow-phone">
        <header className="hh-sales-top">
          <button type="button" className="rt-back-link" onClick={closeForm}>
            <ChevronLeft size={20} strokeWidth={2.5} aria-hidden="true" />
            <span>{editingId ? "Edit expense" : "New expense"}</span>
          </button>
        </header>

        <div className="rt-flow-phone__body space-y-3">
          <div className="rt-fld">
            <label htmlFor="ph-exp-amount" className="rt-fld__label">
              Amount
            </label>
            <div className="rt-fld__row">
              <span className="rt-fld__curr">₹</span>
              <input
                id="ph-exp-amount"
                type="number"
                inputMode="decimal"
                min={0}
                autoFocus={!editingId}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                className="rt-fld__input"
              />
            </div>
          </div>

          <div>
            <div className="text-[12px] font-bold text-slate-600 mb-1.5">
              What was it for?
            </div>
            <div
              className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
              role="radiogroup"
              aria-label="Category"
            >
              {EXPENSE_CATEGORY_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={category === k}
                  aria-pressed={category === k}
                  onClick={() => setCategory(k)}
                  className="rt-chip shrink-0"
                >
                  {catLabel(k)}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rt-in">
              <label className="rt-in__label" htmlFor="ph-exp-paidto">
                PAID TO
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="ph-exp-paidto"
                  type="text"
                  className="rt-in__control flex-1 min-w-0"
                  value={paidTo}
                  placeholder="Search party or type a name"
                  onFocus={() => setPaidToOpen(true)}
                  onBlur={() => setTimeout(() => setPaidToOpen(false), 160)}
                  onChange={(e) => {
                    setPaidTo(e.target.value);
                    setCustomerId(undefined);
                    setPaidToOpen(true);
                  }}
                />
                {paidTo && (
                  <button
                    type="button"
                    aria-label="Clear party"
                    onClick={() => {
                      setPaidTo("");
                      setCustomerId(undefined);
                      setPaidToOpen(true);
                    }}
                    className="text-slate-400 p-1 min-w-0 min-h-0 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            {paidToOpen && phonePartySuggestions.length > 0 && (
              <div
                className="absolute z-30 left-0 right-0 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100"
                role="listbox"
              >
                {phonePartySuggestions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setPaidTo(opt.name);
                      if (
                        opt.key &&
                        !String(opt.key).startsWith("name:") &&
                        !String(opt.key).startsWith("sm:")
                      ) {
                        setCustomerId(String(opt.key));
                      } else {
                        setCustomerId(undefined);
                      }
                      setPaidToOpen(false);
                    }}
                    className="w-full px-3 py-2.5 text-left text-[13px] font-semibold text-slate-900 flex items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer"
                  >
                    <span className="truncate">{opt.name}</span>
                    {opt.phone ? (
                      <span className="text-xs font-medium text-slate-400 shrink-0">
                        {opt.phone}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rt-in">
              <label className="rt-in__label" htmlFor="ph-exp-mode">
                PAID BY
              </label>
              <div className="rt-in__select-wrap">
                <select
                  id="ph-exp-mode"
                  className="rt-in__control"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as Mode)}
                >
                  {MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} className="rt-in__select-chev" aria-hidden="true" />
              </div>
            </div>

            <div className="rt-in">
              <label className="rt-in__label" htmlFor="ph-exp-date">
                DATE
              </label>
              <input
                id="ph-exp-date"
                type="date"
                className="rt-in__control"
                value={date}
                onChange={(e) => setDate(e.target.value || todayISO())}
              />
            </div>
          </div>

          <div className="rt-in">
            <label className="rt-in__label" htmlFor="ph-exp-note">
              NOTE
            </label>
            <input
              id="ph-exp-note"
              type="text"
              className="rt-in__control"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Diesel for van"
            />
          </div>

          <div className="hh-set-list">
            <button
              type="button"
              className="hh-set-row"
              onClick={() => setPhoneLinkStep(true)}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold text-slate-900">
                  Link to trip, invoice or reference
                </div>
                {phoneLinkSummary ? (
                  <div className="text-xs text-slate-500 truncate mt-0.5">
                    {phoneLinkSummary}
                  </div>
                ) : null}
              </div>
              <ChevronRight size={17} className="text-slate-400 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="rt-flow-phone__footer">
          <button
            type="button"
            className="rt-btn w-full"
            disabled={!amountOk}
            onClick={submit}
          >
            {editingId ? "Save changes" : "Save expense"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="view-expenses" className="w-full min-w-0 pb-24">
      <header className="hh-sales-top">
        <div className="hh-sales-top__row">
          <h1 className="hh-sales-top__title">Expenses</h1>
          <button
            type="button"
            onClick={openCreate}
            aria-label="Add expense"
            className="hh-sales-top__iconbtn"
          >
            <Plus size={20} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="space-y-3">
        {/* Period filter pills */}
        <div
          className="flex gap-1.5 overflow-x-auto no-scrollbar"
          role="group"
          aria-label="Period"
        >
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}
              className="rt-chip shrink-0"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="rt-search-bar">
          <Search size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, note or amount"
            aria-label="Search expenses"
          />
          {q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQ("")}
              className="p-1 text-slate-400 cursor-pointer shrink-0"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Total card */}
        <div className="rt-card">
          <div className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
            Total spent · {periodLabel}
            {activeCat !== "all" ? ` · ${catLabel(activeCat)}` : ""}
          </div>
          <div
            className="mt-1 text-[28px] font-black tabular-nums leading-tight"
            style={{ color: "var(--text)" }}
          >
            ₹{money(totals.all)}
          </div>
        </div>

        {/* Category filter bar */}
        {categoryChips.length > 0 && (
          <div
            className="flex gap-1.5 overflow-x-auto no-scrollbar"
            role="group"
            aria-label="Category"
          >
            <button
              type="button"
              aria-pressed={activeCat === "all"}
              onClick={() => setCatFilter("all")}
              className="rt-chip shrink-0"
            >
              All
            </button>
            {categoryChips.map(([k]) => (
              <button
                key={k}
                type="button"
                aria-pressed={activeCat === k}
                onClick={() => setCatFilter(activeCat === k ? "all" : k)}
                className="rt-chip shrink-0"
              >
                {catLabel(k)}
              </button>
            ))}
          </div>
        )}

        {/* Expense list */}
        {filtered.length === 0 ? (
          <div className="rt-card text-center py-8 px-4 space-y-2.5">
            <div className="text-[15px] font-extrabold text-slate-900">
              {q || activeCat !== "all" || (expenses || []).length > 0
                ? "No expenses found"
                : "No expenses yet"}
            </div>
            <div className="text-[12.5px] text-slate-500">
              {(expenses || []).length > 0 && period !== "all"
                ? "Try a longer period or clear the search."
                : "Tap + to record your first expense."}
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              {(expenses || []).length > 0 && period !== "all" && (
                <button
                  type="button"
                  onClick={() => {
                    setPeriod("all");
                    setQ("");
                    setCatFilter("all");
                  }}
                  className="rt-btn-outline rt-btn-outline--primary"
                >
                  Show all time
                </button>
              )}
              <button type="button" onClick={openCreate} className="rt-btn">
                Add expense
              </button>
            </div>
          </div>
        ) : (
          <div className="hh-set-list hh-tgrid-2">
            {filtered.map((e) => {
              const Icon = CAT_ICON[e.category] || MoreHorizontal;
              const d = String(e.date).slice(0, 10);
              const modeLabel =
                MODES.find((m) => m.id === e.mode)?.label ||
                (e.mode ? String(e.mode) : "Cash");
              const sub =
                [e.paidTo, e.note, modeLabel].filter(Boolean).join(" · ") || modeLabel;
              const dateRight =
                d === today
                  ? "Today"
                  : d === addDaysISO(today, -1)
                    ? "Yesterday"
                    : shortDateLabel(d);
              const icoCls =
                e.category === "baddebt"
                  ? "rt-ico rt-ico--due"
                  : PAY_CATEGORIES.includes(e.category)
                    ? "rt-ico"
                    : "rt-ico rt-ico--neutral";
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setDetailExpense(e)}
                  className="hh-set-row"
                >
                  <span className={icoCls}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-bold text-slate-900 truncate">
                      {catLabel(e.category)}
                    </div>
                    <div className="text-[12px] text-slate-500 truncate mt-0.5">
                      {sub}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[14px] font-extrabold tabular-nums text-slate-900">
                      ₹{money(e.amount)}
                    </div>
                    <div className="text-xs font-semibold text-slate-400 mt-0.5">
                      {dateRight}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Expense detail bottom sheet */}
      {detailExpense && (
        <div
          className="rt-bsheet-scrim"
          role="dialog"
          aria-modal="true"
          aria-label="Expense detail"
          onClick={() => setDetailExpense(null)}
        >
          <div
            className="rt-bsheet rt-bsheet--white space-y-3"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="hh-grab" />
            <div className="text-[18px] font-black text-slate-900">
              ₹{money(detailExpense.amount)} · {catLabel(detailExpense.category)}
            </div>

            <div className="rt-card rt-card--divided">
              <div className="rt-ln">
                <span className="text-[13px] font-medium text-slate-500">Paid to</span>
                <span className="text-[13.5px] font-bold text-slate-900 text-right">
                  {detailExpense.paidTo || "—"}
                </span>
              </div>
              <div className="rt-ln">
                <span className="text-[13px] font-medium text-slate-500">Paid by</span>
                <span className="text-[13.5px] font-bold text-slate-900 text-right">
                  {MODES.find((m) => m.id === detailExpense.mode)?.label ||
                    detailExpense.mode ||
                    "Cash"}
                </span>
              </div>
              {(detailExpense.tripId || detailExpense.billId || detailExpense.referenceNote) && (
                <div className="rt-ln">
                  <span className="text-[13px] font-medium text-slate-500">Linked to</span>
                  <span className="text-[13.5px] font-bold text-slate-900 text-right">
                    {[
                      detailExpense.tripId ? `Trip #${detailExpense.tripId}` : "",
                      detailExpense.billId ? `Invoice #${detailExpense.billId}` : "",
                      detailExpense.referenceNote || "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              )}
              <div className="rt-ln">
                <span className="text-[13px] font-medium text-slate-500">Date</span>
                <span className="text-[13.5px] font-bold text-slate-900 text-right">
                  {dayLabel(String(detailExpense.date).slice(0, 10), today)}
                </span>
              </div>
              {detailExpense.note && (
                <div className="rt-ln">
                  <span className="text-[13px] font-medium text-slate-500">Note</span>
                  <span className="text-[13.5px] font-bold text-slate-900 text-right">
                    {detailExpense.note}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const target = detailExpense;
                  setDetailExpense(null);
                  openEdit(target);
                }}
                className="rt-btn-outline rt-btn-outline--primary"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = detailExpense;
                  setDetailExpense(null);
                  setExpenseToDelete(target);
                }}
                className="rt-btn-outline rt-btn-outline--due"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation bottom sheet */}
      {expenseToDelete && (
        <div
          className="rt-bsheet-scrim"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ph-del-exp-title"
          onClick={() => setExpenseToDelete(null)}
        >
          <div
            className="rt-bsheet rt-bsheet--white space-y-3"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="hh-grab" />
            <div>
              <h3
                id="ph-del-exp-title"
                className="text-[17px] font-extrabold"
                style={{ color: "var(--due)" }}
              >
                Delete expense?
              </h3>
              <p className="text-[13px] text-slate-500 mt-1 leading-snug">
                ₹{money(expenseToDelete.amount)} ·{" "}
                {expenseToDelete.paidTo || catLabel(expenseToDelete.category)}
                {expenseToDelete.note ? ` · ${expenseToDelete.note}` : ""}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Reason for deleting *
                </label>
                <span className={`text-xs font-medium tabular-nums ${delReasonOk ? "text-emerald-700" : "text-amber-700"}`}>
                  {deleteReason.trim().length}/4 min chars
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {["Duplicate entry", "Wrong amount", "Cancelled expense", "Entered by mistake"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDeleteReason(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      deleteReason.trim().toLowerCase() === preset.toLowerCase()
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                value={deleteReason}
                onChange={(ev) => setDeleteReason(ev.target.value)}
                placeholder="e.g. Duplicate entry, wrong amount, cancelled expense"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none font-sans"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="rt-btn-outline rt-btn-outline--primary"
              >
                Keep
              </button>
              <button
                type="button"
                disabled={!delReasonOk}
                onClick={() => handleDeleteExpense(expenseToDelete, deleteReason.trim())}
                className="rt-btn rt-btn--due disabled:opacity-45 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
