import React, { useEffect, useMemo, useState } from "react";
import {
  MoreHorizontal,
  Plus,
  Receipt,
  Save,
  Search,
  Trash2,
  Truck,
  Wallet,
  X,
} from "lucide-react";
import { useLedger } from "../../context/LedgerContext";
import { notify } from "../../utils/toast";
import { ConfirmModal } from "../ui";
import type { BusinessExpenseRecord } from "../../utils/storage";
import { EXPENSE_LABELS, PAY_CATEGORIES } from "../../utils/netProfit";
import { money } from "../../utils/billing";
import { todayISO } from "../../utils/dateLocal";
import type { CanonicalActionIntent } from "../../types";
import type { PartyOption } from "../common/PartySearchSelect";
import { CanonicalReturnBanner } from "../common/CanonicalReturnBanner";
import { useIsMobile } from "../../hooks/useIsMobile";
import {
  addDaysISO,
  CAT_ICON,
  catBadgeClass,
  catCardTone,
  catLabel,
  chipCls,
  dayLabel,
  Mode,
  Period,
  PERIODS,
} from "./expenses/expenseViewHelpers";
import { ExpensesPhoneView } from "./expenses/ExpensesPhoneView";
import { ExpensesDesktopFormModal } from "./expenses/ExpensesDesktopFormModal";

export const ExpensesView: React.FC = () => {
  const isPhone = useIsMobile(1023);
  const {
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    customers,
    trips,
    salesmen,
    bills,
    pendingCanonicalAction,
    clearPendingCanonicalAction,
    returnFromCanonicalAction,
  } = useLedger();

  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [period, setPeriod] = useState<Period>("month");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingExpenseEdit, setPendingExpenseEdit] = useState<{
    id: string;
    before: BusinessExpenseRecord;
    payload: Omit<BusinessExpenseRecord, "id">;
  } | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<BusinessExpenseRecord | null>(null);
  const [detailExpense, setDetailExpense] = useState<BusinessExpenseRecord | null>(null);
  const [phoneLinkStep, setPhoneLinkStep] = useState(false);
  const [phoneLinkTab, setPhoneLinkTab] = useState<"trip" | "invoice" | "reference">("trip");
  const [paidToOpen, setPaidToOpen] = useState(false);
  const [activeReturnIntent, setActiveReturnIntent] = useState<CanonicalActionIntent | null>(null);

  useEffect(() => {
    if (!pendingCanonicalAction || pendingCanonicalAction.entityType !== "expense") return;
    const targetExp = (expenses || []).find((x) => String(x.id) === String(pendingCanonicalAction.entityId));
    const intent = pendingCanonicalAction;
    clearPendingCanonicalAction();
    if (intent.returnTab) setActiveReturnIntent(intent);
    if (!targetExp) return;
    if (intent.action === "delete") {
      setExpenseToDelete(targetExp);
    } else if (intent.action === "edit" || intent.action === "view") {
      openEdit(targetExp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCanonicalAction, expenses]);

  // Form state
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState<string>("fuel");
  const [amount, setAmount] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<Mode>("cash");
  const [referenceNote, setReferenceNote] = useState("");
  const [tripId, setTripId] = useState("");
  const [billId, setBillId] = useState("");

  const partyOptions: PartyOption[] = useMemo(() => {
    const list: PartyOption[] = (customers || []).map((c) => ({
      key: c.id,
      name: c.name,
      phone: c.phone || "",
      due: 0,
      advance: 0,
    }));
    const names = new Set(list.map((c) => c.name.trim().toLowerCase()));
    (expenses || []).forEach((e) => {
      const n = (e.paidTo || "").trim();
      if (n && !names.has(n.toLowerCase())) {
        names.add(n.toLowerCase());
        list.push({ key: `name:${n}`, name: n, phone: "", due: 0, advance: 0 });
      }
    });
    (salesmen || []).forEach((s: any) => {
      const n = String(s?.name || "").trim();
      if (n && !names.has(n.toLowerCase())) {
        names.add(n.toLowerCase());
        list.push({ key: `sm:${s.id || n}`, name: n, phone: "", due: 0, advance: 0 });
      }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, expenses, salesmen]);

  const recentTrips = useMemo(
    () =>
      [...(trips || [])]
        .sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 80),
    [trips],
  );

  const openBills = useMemo(() => {
    return (bills || [])
      .filter((b) => !b.cancelled && b.status !== 'cancelled')
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 100);
  }, [bills]);

  const resetForm = () => {
    setDate(todayISO());
    setCategory("fuel");
    setAmount("");
    setPaidTo("");
    setCustomerId(undefined);
    setNote("");
    setMode("cash");
    setReferenceNote("");
    setTripId("");
    setBillId("");
    setEditingId(null);
    setPhoneLinkStep(false);
    setPhoneLinkTab("trip");
    setPaidToOpen(false);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (e: BusinessExpenseRecord) => {
    setEditingId(e.id);
    setDate(String(e.date).slice(0, 10));
    setCategory(e.category || "misc");
    setAmount(String(e.amount ?? ""));
    setPaidTo(e.paidTo || "");
    setCustomerId(e.customerId);
    setNote(e.note || "");
    setMode(((e.mode as Mode) || "cash") as Mode);
    setReferenceNote(e.referenceNote || "");
    setTripId(e.tripId != null ? String(e.tripId) : "");
    setBillId(e.billId != null ? String(e.billId) : "");
    setPhoneLinkStep(false);
    setPhoneLinkTab(e.tripId ? "trip" : e.billId ? "invoice" : e.referenceNote ? "reference" : "trip");
    setPaidToOpen(false);
    setShowForm(true);
  };

  const submit = () => {
    const amt = Math.max(0, Number(amount) || 0);
    if (amt <= 0) return;
    const trip = recentTrips.find((t: any) => String(t.id) === String(tripId));
    // An older expense can point at a trip outside the recent list: keep that link instead of dropping it.
    const existing = editingId ? (expenses || []).find((x) => x.id === editingId) : undefined;
    const keepOldTrip = !trip && tripId && existing?.tripId != null && String(existing.tripId) === String(tripId);
    const payload: Omit<BusinessExpenseRecord, "id"> = {
      date: date.slice(0, 10),
      category,
      amount: amt,
      note: note.trim(),
      paidTo: paidTo.trim() || undefined,
      customerId: customerId && !customerId.startsWith("name:") && !customerId.startsWith("sm:")
        ? customerId
        : undefined,
      tripId: trip ? Number(trip.id) : keepOldTrip ? Number(existing!.tripId) : undefined,
      tripLabel: trip
        ? `Trip #${trip.id} · ${String(trip.date).slice(0, 10)} · ${trip.vehicle || "vehicle"}`
        : keepOldTrip
          ? existing!.tripLabel
          : undefined,
      billId: billId ? Number(billId) : undefined,
      mode,
      referenceNote: referenceNote.trim() || undefined,
    };
    if (editingId) {
      if (existing) {
        setPendingExpenseEdit({ id: editingId, before: existing, payload });
        setShowForm(false);
        return;
      }
      updateExpense(editingId, payload);
    } else {
      addExpense(payload);
    }
    setShowForm(false);
    resetForm();
  };

  const today = todayISO();

  // 1) period + search first, so the category chips show what is really in range
  const inPeriod = useMemo(() => {
    const query = q.trim().toLowerCase();
    const weekStart = addDaysISO(today, -6);
    return (expenses || [])
      .filter((e) => {
        const d = String(e.date).slice(0, 10);
        if (period === "today" && d !== today) return false;
        if (period === "week" && (d < weekStart || d > today)) return false;
        if (period === "month" && d.slice(0, 7) !== today.slice(0, 7)) return false;
        if (!query) return true;
        const blob = [
          e.paidTo,
          e.note,
          e.category,
          catLabel(e.category),
          EXPENSE_LABELS[e.category],
          e.referenceNote,
          e.tripLabel,
          String(e.amount),
          d,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(query);
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [expenses, q, period, today]);

  const categoryChips = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of inPeriod) m.set(e.category, (m.get(e.category) || 0) + Math.max(0, Number(e.amount) || 0));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [inPeriod]);

  // a chip that vanished (e.g. period changed) must not leave the list stuck on an empty filter
  const activeCat = catFilter !== "all" && !categoryChips.some(([k]) => k === catFilter) ? "all" : catFilter;

  const filtered = useMemo(
    () => (activeCat === "all" ? inPeriod : inPeriod.filter((e) => e.category === activeCat)),
    [inPeriod, activeCat],
  );

  const totals = useMemo(() => {
    let all = 0;
    let pay = 0;
    let ops = 0;
    for (const e of filtered) {
      const a = Math.max(0, Number(e.amount) || 0);
      all += a;
      if (PAY_CATEGORIES.includes(e.category)) pay += a;
      else ops += a;
    }
    return { all, pay, ops, count: filtered.length };
  }, [filtered]);

  const groups = useMemo(() => {
    const m = new Map<string, { date: string; total: number; rows: BusinessExpenseRecord[] }>();
    for (const e of filtered) {
      const d = String(e.date).slice(0, 10);
      const g = m.get(d) || { date: d, total: 0, rows: [] };
      g.total += Math.max(0, Number(e.amount) || 0);
      g.rows.push(e);
      m.set(d, g);
    }
    return Array.from(m.values());
  }, [filtered]);

  const periodLabel = PERIODS.find((p) => p.id === period)?.label || "";
  const opsPct = totals.all > 0 ? Math.round((totals.ops / totals.all) * 100) : 0;

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const confirmDelete = () => {
    if (!editingId) return;
    const exp = (expenses || []).find((x) => x.id === editingId);
    if (exp) {
      setExpenseToDelete(exp);
    }
  };

  const handleDeleteExpense = (exp: BusinessExpenseRecord, reason?: string) => {
    deleteExpense(exp.id, reason);
    notify(`Expense of ₹${money(exp.amount)} deleted`, "success");
    setExpenseToDelete(null);
    if (editingId === exp.id) {
      closeForm();
    }
  };

  const amountOk = Number(amount) > 0;

  const phonePartySuggestions = useMemo(() => {
    const query = paidTo.trim().toLowerCase();
    if (!query) return partyOptions.slice(0, 8);
    return partyOptions
      .filter((o) => o.name.toLowerCase().includes(query) || (o.phone && o.phone.includes(query)))
      .slice(0, 8);
  }, [partyOptions, paidTo]);

  const phoneLinkSummary = useMemo(() => {
    return [
      tripId ? `Trip #${tripId}` : "",
      billId ? `Invoice #${billId}` : "",
      referenceNote.trim() || "",
    ]
      .filter(Boolean)
      .join(" · ");
  }, [tripId, billId, referenceNote]);

  const editConfirmModal = pendingExpenseEdit && (
    <ConfirmModal
      isOpen={true}
      onClose={() => {
        setPendingExpenseEdit(null);
        setShowForm(true);
      }}
      variant="warning"
      title="Confirm Expense Edit"
      subtitle={`${pendingExpenseEdit.payload.paidTo || catLabel(pendingExpenseEdit.payload.category)} · ${pendingExpenseEdit.payload.date}`}
      message="Review the changes below and enter a reason. This change will be saved in the global Activity Log."
      impactItems={[
        {
          label: "Amount",
          detail: `₹${money(pendingExpenseEdit.before.amount)} → ₹${money(pendingExpenseEdit.payload.amount)}`,
          qtyChange:
            pendingExpenseEdit.before.amount !== pendingExpenseEdit.payload.amount
              ? `${pendingExpenseEdit.payload.amount - pendingExpenseEdit.before.amount >= 0 ? "+" : ""}₹${money(
                  pendingExpenseEdit.payload.amount - pendingExpenseEdit.before.amount,
                )}`
              : "Unchanged",
        },
        {
          label: "Category & Mode",
          detail: `${catLabel(pendingExpenseEdit.before.category)} (${(pendingExpenseEdit.before.mode || "cash").toUpperCase()}) → ${catLabel(
            pendingExpenseEdit.payload.category,
          )} (${(pendingExpenseEdit.payload.mode || "cash").toUpperCase()})`,
        },
        {
          label: "Date & Party",
          detail: `${pendingExpenseEdit.before.date} · ${pendingExpenseEdit.before.paidTo || "—"} → ${pendingExpenseEdit.payload.date} · ${
            pendingExpenseEdit.payload.paidTo || "—"
          }`,
        },
      ]}
      rectificationPrompt="Reason for editing expense *"
      rectificationPlaceholder="e.g. Corrected amount, changed category, updated party/date"
      reasonPresets={["Corrected amount", "Changed category", "Updated party/date", "Added reference"]}
      commentMinLength={4}
      confirmButtonLabel="Save Expense Edit"
      confirmIcon={<Save className="w-3.5 h-3.5" />}
      onConfirm={() => {}}
      onConfirmWithComment={(reason) => {
        updateExpense(pendingExpenseEdit.id, pendingExpenseEdit.payload, reason);
        notify(`Expense updated`, "success");
        setPendingExpenseEdit(null);
        resetForm();
      }}
    />
  );

  if (isPhone) {
    return (
      <>
        {activeReturnIntent && (
          <div className="hh-view pb-0 pt-2">
            <CanonicalReturnBanner
              intent={activeReturnIntent}
              onReturn={() => {
                const intent = activeReturnIntent;
                setActiveReturnIntent(null);
                returnFromCanonicalAction(intent);
              }}
              onDismiss={() => setActiveReturnIntent(null)}
            />
          </div>
        )}
        <ExpensesPhoneView
          expenses={expenses}
          showForm={showForm}
          editingId={editingId}
          phoneLinkStep={phoneLinkStep}
          setPhoneLinkStep={setPhoneLinkStep}
          phoneLinkTab={phoneLinkTab}
          setPhoneLinkTab={setPhoneLinkTab}
          tripId={tripId}
          setTripId={setTripId}
          billId={billId}
          setBillId={setBillId}
          referenceNote={referenceNote}
          setReferenceNote={setReferenceNote}
          recentTrips={recentTrips}
          openBills={openBills}
          amountOk={amountOk}
          submit={submit}
          closeForm={closeForm}
          amount={amount}
          setAmount={setAmount}
          category={category}
          setCategory={setCategory}
          paidTo={paidTo}
          setPaidTo={setPaidTo}
          setCustomerId={setCustomerId}
          paidToOpen={paidToOpen}
          setPaidToOpen={setPaidToOpen}
          phonePartySuggestions={phonePartySuggestions}
          mode={mode}
          setMode={setMode}
          date={date}
          setDate={setDate}
          note={note}
          setNote={setNote}
          phoneLinkSummary={phoneLinkSummary}
          openCreate={openCreate}
          openEdit={openEdit}
          period={period}
          setPeriod={setPeriod}
          periodLabel={periodLabel}
          q={q}
          setQ={setQ}
          activeCat={activeCat}
          setCatFilter={setCatFilter}
          totals={totals}
          categoryChips={categoryChips}
          filtered={filtered}
          today={today}
          detailExpense={detailExpense}
          setDetailExpense={setDetailExpense}
          expenseToDelete={expenseToDelete}
          setExpenseToDelete={setExpenseToDelete}
          handleDeleteExpense={handleDeleteExpense}
        />
        {editConfirmModal}
      </>
    );
  }

  return (
    <div className="w-full min-w-0 text-slate-900 pb-24">
      <div className="hh-view w-full min-w-0 max-w-4xl mx-auto space-y-4">
        {activeReturnIntent && (
          <CanonicalReturnBanner
            intent={activeReturnIntent}
            onReturn={() => {
              const intent = activeReturnIntent;
              setActiveReturnIntent(null);
              returnFromCanonicalAction(intent);
            }}
            onDismiss={() => setActiveReturnIntent(null)}
          />
        )}
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-amber-600 shrink-0" />
            <span className="truncate">Expenses</span>
          </h1>
          <button
            type="button"
            onClick={openCreate}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-slate-900 text-white text-sm font-bold shadow-sm hover:bg-slate-800 active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {/* Period */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={chipCls(period === p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Summary */}
        <section data-card-tone="warning" className="rounded-3xl border shadow-xs p-4 sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-900/80 truncate">
                Spent · {periodLabel}
                {activeCat !== "all" ? ` · ${catLabel(activeCat)}` : ""}
              </div>
              <div className="mt-1 text-[clamp(1.6rem,8vw,2.4rem)] leading-none font-black tabular-nums text-slate-900 whitespace-nowrap">
                ₹{money(totals.all)}
              </div>
            </div>
            <div className="shrink-0 text-xs font-bold text-amber-900 bg-white/80 border border-black/5 px-2.5 py-1 rounded-full">
              {totals.count} {totals.count === 1 ? "entry" : "entries"}
            </div>
          </div>

          {totals.all > 0 && (
            <>
              <div
                className="mt-4 h-2.5 rounded-full bg-white/80 border border-black/5 overflow-hidden"
                role="img"
                aria-label={`Operating ${opsPct}%, pay ${100 - opsPct}%`}
              >
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${opsPct}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="min-w-0 rounded-xl bg-white/80 border border-black/5 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <span className="size-2 rounded-full bg-amber-500 shrink-0" /> Running costs
                  </div>
                  <div className="text-[15px] font-black tabular-nums text-slate-900 truncate mt-0.5">₹{money(totals.ops)}</div>
                </div>
                <div className="min-w-0 rounded-xl bg-white/80 border border-black/5 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <span className="size-2 rounded-full bg-blue-500 shrink-0" /> Staff pay
                  </div>
                  <div className="text-[15px] font-black tabular-nums text-slate-900 truncate mt-0.5">₹{money(totals.pay)}</div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Search + category chips */}
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, note or amount"
              className="w-full min-h-[46px] pl-10 pr-10 rounded-xl border border-slate-200 bg-white text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/15"
            />
            {q && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQ("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 size-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {categoryChips.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" role="group" aria-label="Category">
              <button type="button" onClick={() => setCatFilter("all")} className={chipCls(activeCat === "all")}>
                All
              </button>
              {categoryChips.map(([k, amt]) => (
                <button
                  key={k}
                  type="button"
                  title={EXPENSE_LABELS[k] || k}
                  onClick={() => setCatFilter(activeCat === k ? "all" : k)}
                  className={chipCls(activeCat === k)}
                >
                  {catLabel(k)} <span className="opacity-70 font-semibold">₹{money(amt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List, grouped by day */}
        {groups.length === 0 ? (
          <div data-card-tone="neutral" className="rounded-3xl border border-dashed px-4 py-12 text-center shadow-xs">
            <div className="hh-icon-badge hh-icon-badge--amber mx-auto mb-3">
              <Wallet className="w-5 h-5" />
            </div>
            <p className="text-[15px] font-bold text-slate-800">
              {q || activeCat !== "all" || (expenses || []).length > 0 ? "No expenses found" : "No expenses yet"}
            </p>
            <p className="text-[13px] text-slate-500 mt-0.5">
              {(expenses || []).length > 0 && period !== "all"
                ? "Try a longer period or clear the search."
                : "Tap Add to record your first one."}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {(expenses || []).length > 0 && period !== "all" && (
                <button type="button" onClick={() => { setPeriod("all"); setQ(""); setCatFilter("all"); }} className={chipCls(false)}>
                  Show all time
                </button>
              )}
              <button type="button" onClick={openCreate} className="min-h-[38px] px-4 rounded-full bg-slate-900 text-white text-[13px] font-bold cursor-pointer">
                Add expense
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <section key={g.date} aria-label={dayLabel(g.date, today)}>
                <div className="flex items-baseline justify-between gap-3 px-1 mb-1.5">
                  <h2 className="text-[13px] font-black text-slate-700">{dayLabel(g.date, today)}</h2>
                  <span className="text-[13px] font-bold tabular-nums text-slate-500">₹{money(g.total)}</span>
                </div>
                <div className="space-y-2">
                  {g.rows.map((e) => {
                    const Icon = CAT_ICON[e.category] || MoreHorizontal;
                    const sub = [catLabel(e.category), e.mode && e.mode !== "cash" ? String(e.mode).toUpperCase() : "", e.note]
                      .filter(Boolean)
                      .join(" · ");
                    const links = [e.tripId ? `Trip #${e.tripId}` : "", e.billId ? `Invoice #${e.billId}` : ""]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <div
                        key={e.id}
                        data-card-tone={catCardTone(e.category)}
                        className="w-full rounded-2xl border shadow-xs flex items-center justify-between gap-3 px-3.5 py-3 transition-all group"
                      >
                        <button
                          type="button"
                          onClick={() => openEdit(e)}
                          aria-label={`Edit ${e.paidTo || catLabel(e.category)} ₹${money(e.amount)}`}
                          className="min-w-0 flex-1 flex items-center gap-3 text-left cursor-pointer"
                        >
                          <span className={`hh-icon-badge shrink-0 ${catBadgeClass(e.category)}`}>
                            <Icon className="w-5 h-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-extrabold text-slate-900 min-w-0 break-words lg:truncate">
                              {e.paidTo || catLabel(e.category)}
                            </span>
                            <span className="block text-[12.5px] text-slate-600 truncate font-medium">{sub}</span>
                            {links && (
                              <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-slate-500 truncate">
                                {e.billId ? <Receipt className="w-3 h-3 shrink-0" /> : <Truck className="w-3 h-3 shrink-0" />}
                                <span className="truncate">{links}</span>
                              </span>
                            )}
                          </span>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[16px] font-black tabular-nums text-slate-900">
                            ₹{money(e.amount)}
                          </span>
                          <button
                            type="button"
                            title="Delete expense"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setExpenseToDelete(e);
                            }}
                            className="size-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-white/80 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <ExpensesDesktopFormModal
        showForm={showForm}
        editingId={editingId}
        closeForm={closeForm}
        amount={amount}
        setAmount={setAmount}
        category={category}
        setCategory={setCategory}
        paidTo={paidTo}
        setPaidTo={setPaidTo}
        setCustomerId={setCustomerId}
        partyOptions={partyOptions}
        mode={mode}
        setMode={setMode}
        date={date}
        setDate={setDate}
        note={note}
        setNote={setNote}
        tripId={tripId}
        setTripId={setTripId}
        billId={billId}
        setBillId={setBillId}
        referenceNote={referenceNote}
        setReferenceNote={setReferenceNote}
        recentTrips={recentTrips}
        openBills={openBills}
        amountOk={amountOk}
        confirmDelete={confirmDelete}
        submit={submit}
        expenseToDelete={expenseToDelete}
        setExpenseToDelete={setExpenseToDelete}
        handleDeleteExpense={handleDeleteExpense}
      />
      {editConfirmModal}
    </div>
  );
};

export default ExpensesView;
