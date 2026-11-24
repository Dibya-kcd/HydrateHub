import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Receipt,
  Package,
  ShoppingCart,
  Truck,
  Wallet,
} from "lucide-react";
import { useLedger } from "../../context/LedgerContext";
import { money } from "../../utils/billing";
import { trackedStage } from "./ExpiryReturnsTracker";
import { billBalance, billNetTotal } from "../../utils/salesReturns";
import { summarizeCollections } from "../../utils/collectionSummary";
import { createPortal } from "react-dom";
import { useBeats } from "../../hooks/useBeats";
import { useNeedsAttention } from "../../hooks/useNeedsAttention";
import { useLanguage } from "../../i18n/LanguageContext";
import { buildBeatSummary, invoiceNo } from "../../utils/beatReports";
import { beatOfCustomer } from "../../utils/beats";
import { computeNetProfit } from "../../utils/netProfit";
import { useSalesMarginPnl } from "./reports/SalesMarginPnLReport";
import {
  AlertStrip,
  BillsList,
  BillsTable,
  DueByBeatCard,
  HeroCollectionCard,
  HubMetricCard,
  NeedsAttentionCard,
  PhoneNeedsAttentionCard,
  SalesBarsCard,
  SegmentedPeriod,
  ShortcutTile,
  type AttentionRow,
  type BillRowData,
  type PillStatus,
} from "../ui/HomeKit";
import { Bill } from "../../types";
import { TaxInvoiceModal } from "../common/TaxInvoiceModal";
import { NotificationPanel } from "../common/NotificationPanel";

import type { FilterPeriodPreset } from "../common/PeriodFilter";
import { toLocalISODate } from "../../utils/dateLocal";
import { DashboardPeriodPopover } from "./dashboard/DashboardPeriodPopover";
export type { FilterPeriodPreset };

export type CyclePeriod =
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "all"
  | "custom";

interface CycleItem {
  id: CyclePeriod;
  label: string;
  metricHeader: string;
}

const CYCLE_SEQUENCE: CycleItem[] = [
  { id: "today", label: "Today", metricHeader: "SALES (TODAY)" },
  { id: "yesterday", label: "Yesterday", metricHeader: "SALES (YESTERDAY)" },
  { id: "week", label: "Week", metricHeader: "SALES (LAST 7 DAYS)" },
  { id: "month", label: "Month", metricHeader: "SALES (LAST 30 DAYS)" },
  { id: "all", label: "All time", metricHeader: "SALES (ALL TIME)" },
  { id: "custom", label: "Custom", metricHeader: "SALES (CUSTOM)" },
];

export const DashboardView: React.FC = () => {
  const {
    products,
    bills,
    inventoryDispositions,
    customers,
    setTab,
    payments,
    existingCustomers,
    expenses,
  } = useLedger();
  const { t } = useLanguage();
  const { beats } = useBeats();
  const attention = useNeedsAttention();

  // Helper date strings
  const today = useMemo(() => {
    const d = new Date();
    return toLocalISODate(d);
  }, []);

  const getPastDateStr = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return toLocalISODate(d);
  };

  // Filter state defaulting to "today" with cycler support
  const [cycleIndex, setCycleIndex] = useState<number>(0);
  const currentCycle = CYCLE_SEQUENCE[cycleIndex];

  const [periodPreset, setPeriodPreset] = useState<FilterPeriodPreset>("today");
  const [customDays, setCustomDays] = useState<number>(15);
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [showCustomPicker, setShowCustomPicker] = useState<boolean>(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);
  const filterDropdownRef = useRef<HTMLDivElement | null>(null);

  // Modal to view bill/tax invoice when clicking any recent bill
  const [selectedBillForModal, setSelectedBillForModal] = useState<Bill | null>(null);
  const [selectedBillFormat, setSelectedBillFormat] = useState<'gst' | 'non_gst'>('gst');

  const handleOpenBill = useCallback((billId: string | number) => {
    const found = (bills || []).find((b) => String(b.id) === String(billId));
    if (found) {
      setSelectedBillForModal(found);
      setSelectedBillFormat(found.supplyType === 'B2B' || found.isGstInvoice ? 'gst' : 'non_gst');
    }
  }, [bills]);

  const handleSeeAllBills = useCallback(() => {
    setTab("billing");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('app-sales-history'));
    }, 50);
  }, [setTab]);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(e.target as Node)
      ) {
        setShowFilterDropdown(false);
      }
    };
    if (showFilterDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showFilterDropdown]);

  // Quick helper to apply a preset
  const handleSelectPreset = (preset: FilterPeriodPreset) => {
    setPeriodPreset(preset);
    if (preset === "today") {
      setCycleIndex(0);
      setStartDate(today);
      setEndDate(today);
      setShowCustomPicker(false);
    } else if (preset === "yesterday") {
      setCycleIndex(1);
      const y = getPastDateStr(1);
      setStartDate(y);
      setEndDate(y);
      setShowCustomPicker(false);
    } else if (preset === "7days") {
      setCycleIndex(2);
      setStartDate(getPastDateStr(6));
      setEndDate(today);
      setShowCustomPicker(false);
    } else if (preset === "15days") {
      setCycleIndex(2);
      setStartDate(getPastDateStr(14));
      setEndDate(today);
      setShowCustomPicker(false);
    } else if (preset === "30days" || preset === "month") {
      setCycleIndex(3);
      setStartDate(getPastDateStr(29));
      setEndDate(today);
      setShowCustomPicker(false);
    } else if (preset === "lastMonth") {
      setCycleIndex(3);
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const lastDayOfPrevMonth = new Date(y, d.getMonth() + 1, 0).getDate();
      setStartDate(`${y}-${m}-01`);
      setEndDate(`${y}-${m}-${String(lastDayOfPrevMonth).padStart(2, "0")}`);
      setShowCustomPicker(false);
    } else if (preset === "all") {
      setCycleIndex(4);
      setStartDate("");
      setEndDate("");
      setShowCustomPicker(false);
    } else if (preset === "custom") {
      setCycleIndex(5);
      setShowCustomPicker(true);
    }
  };

  const handleApplyCustomDays = (days: number) => {
    setCustomDays(days);
    setPeriodPreset("custom");
    setCycleIndex(5);
    setStartDate(getPastDateStr(days - 1));
    setEndDate(today);
  };

  const dateInPeriod = useCallback(
    (date: string) => {
      if (currentCycle.id === "all" || periodPreset === "all" || (!startDate && !endDate)) return true;
      const d = String(date || "").slice(0, 10);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    },
    [currentCycle.id, periodPreset, startDate, endDate],
  );

  // Filter live (non-cancelled) bills by selected period
  const activeBills = useMemo(() => {
    const live = bills.filter(
      (b) => b.status !== "cancelled" && !(b as { cancelled?: boolean }).cancelled && !b.cancellation,
    );
    if (currentCycle.id === "all" || periodPreset === "all" || (!startDate && !endDate)) {
      return live;
    }
    return live.filter((b) => dateInPeriod((b.date || "").slice(0, 10)));
  }, [bills, currentCycle.id, periodPreset, startDate, endDate, dateInPeriod]);

  // Computed metrics for active period (same collection engine as Reports)
  const periodRevenue = useMemo(
    () => activeBills.reduce((s, b) => s + billNetTotal(b), 0),
    [activeBills],
  );
  const collectionSummary = useMemo(
    () => summarizeCollections({ bills, payments, inPeriod: dateInPeriod }),
    [bills, payments, dateInPeriod],
  );
  const periodPaid = collectionSummary.total;
  const periodCash = collectionSummary.cash;
  const periodUpi = collectionSummary.nonCash;
  const periodOutstanding = useMemo(
    () => activeBills.reduce((s, b) => s + billBalance(b), 0),
    [activeBills],
  );

  const shortFilterLabel = useMemo(() => {
    if (periodPreset === "all") return "All Time";
    if (periodPreset === "today") return "Today";
    if (periodPreset === "yesterday") return "Yesterday";
    if (periodPreset === "7days") return "7 Days";
    if (periodPreset === "15days") return "15 Days";
    if (periodPreset === "30days") return "30 Days";
    if (periodPreset === "month") return "30 Days";
    if (periodPreset === "lastMonth") return "Last Month";
    if (periodPreset === "custom") {
      if (startDate && endDate && startDate !== endDate) {
        return `${startDate.slice(5)} to ${endDate.slice(5)}`;
      }
      return `${customDays}d`;
    }
    return "All Time";
  }, [periodPreset, customDays, startDate, endDate]);

  const openClaims = useMemo(
    () =>
      (inventoryDispositions || []).filter(
        (d) =>
          d.compensationStatus === "pending" ||
          d.compensationStatus === "partial",
      ),
    [inventoryDispositions],
  );
  // Customer expired/damaged returns: waiting for a decision / handover, or with the company for a credit note.
  const expiryReturnCounts = useMemo(() => {
    let toAct = 0;
    let withCompany = 0;
    for (const d of inventoryDispositions || []) {
      if (!d.returnTracking) continue;
      const st = trackedStage(d);
      if (st === "held") toAct += 1;
      else if (st === "sent") withCompany += 1;
    }
    return { toAct, withCompany };
  }, [inventoryDispositions]);
  const openExpiryReturns = () => {
    try {
      sessionStorage.setItem("mrwater_open_dispositions", "claims");
    } catch {
      /* ignore */
    }
    setTab("inventory");
  };
  const openClaimValue = useMemo(
    () =>
      openClaims.reduce(
        (s, d) =>
          s + Math.max(0, (d.costValue || 0) - (d.compensatedAmount || 0)),
        0,
      ),
    [openClaims],
  );

  // Comparison with prior equivalent period for truthful trend calculation
  const prevDateInPeriod = useCallback(
    (date: string): boolean => {
      const d = String(date || "").slice(0, 10);
      if (!d) return false;
      if (currentCycle.id === "today") return d === getPastDateStr(1);
      if (currentCycle.id === "yesterday") return d === getPastDateStr(2);
      if (currentCycle.id === "week") {
        const s = getPastDateStr(13);
        const e = getPastDateStr(7);
        return d >= s && d <= e;
      }
      if (currentCycle.id === "month") {
        const s = getPastDateStr(59);
        const e = getPastDateStr(30);
        return d >= s && d <= e;
      }
      return false;
    },
    [currentCycle.id],
  );


  /* ---------------- Presentation-only derivations for the redesigned Home ---------------- */

  // Same engine as Reports > Profit, so Home and Reports agree.
  const { pnl } = useSalesMarginPnl({ filteredBills: activeBills, products, dateInPeriod, viewBasis: "exGst" });
  const periodExpenseRows = useMemo(
    () => (expenses || []).filter((e) => dateInPeriod(String(e.date).slice(0, 10))),
    [expenses, dateInPeriod],
  );
  const periodExpenseTotal = useMemo(
    () => periodExpenseRows.reduce((sum, e) => sum + Math.max(0, Number(e.amount) || 0), 0),
    [periodExpenseRows],
  );
  const netProfit = useMemo(
    () => computeNetProfit({ grossProfitAfterLosses: pnl.operatingGrossProfit, expenses: periodExpenseRows }).netProfit,
    [pnl.operatingGrossProfit, periodExpenseRows],
  );

  const customersWithDue = useMemo(() => {
    const names = new Set<string>();
    activeBills.forEach((b) => {
      if (billBalance(b) > 0) names.add(String(b.customerId || b.retailer || "").toLowerCase());
    });
    return names.size;
  }, [activeBills]);

  const collectedPct = periodRevenue > 0 ? Math.min(100, (periodPaid / periodRevenue) * 100) : periodPaid > 0 ? 100 : 0;

  const beatRows = useMemo(() => {
    const summary = buildBeatSummary({
      bills: bills || [],
      payments: payments || [],
      customers: customers || [],
      existingCustomers: existingCustomers || [],
      beats,
      inPeriod: dateInPeriod,
      today,
    });
    return summary.rows
      .filter((r) => r.due > 0)
      .sort((a, b) => b.due - a.due)
      .slice(0, 5)
      .map((r) => ({ name: r.beatName, amount: r.due, display: `₹${money(r.due)}` }));
  }, [bills, payments, customers, existingCustomers, beats, dateInPeriod, today]);

  const recentBills: BillRowData[] = useMemo(() => {
    const sorted = [...activeBills]
      .filter((b) => b.status !== "cancelled" && !(b as { cancelled?: boolean }).cancelled)
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || Number(b.id) - Number(a.id))
      .slice(0, 5);
    return sorted.map((b) => {
      const total = billNetTotal(b);
      const paid = Number(b.amountPaid) || 0;
      const status: PillStatus = total - paid <= 0 ? "paid" : paid <= 0 ? "due" : "part";
      const cust = (customers || []).find((c) => (b.customerId ? c.id === b.customerId : c.name === b.retailer));
      return {
        id: b.id,
        party: b.retailer,
        billNo: invoiceNo(b),
        beat: beatOfCustomer(cust, beats)?.name || "-",
        amount: `₹${money(total)}`,
        status,
      };
    });
  }, [activeBills, customers, beats]);

  // Sales for the last 7 days (always the last 7 days, whatever period is picked above)
  const salesBars = useMemo(() => {
    const days: { key: string; label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const key = getPastDateStr(i);
      const dt = new Date(`${key}T12:00:00`);
      days.push({ key, label: dt.toLocaleDateString(undefined, { weekday: "narrow" }), value: 0 });
    }
    (bills || []).forEach((b) => {
      if (b.status === "cancelled" || (b as { cancelled?: boolean }).cancelled) return;
      const hit = days.find((d) => d.key === (b.date || "").slice(0, 10));
      if (hit) hit.value += billNetTotal(b);
    });
    return days.map((d) => ({ label: d.label, value: d.value, display: `₹${money(d.value)}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, today]);

  const attentionRows: AttentionRow[] = useMemo(() => {
    const rows: AttentionRow[] = attention.items.map((it) => ({
      id: it.id,
      tone: it.tone,
      title: t(it.titleKey, { n: it.count }),
      sub: t(it.subKey),
      onClick: () => {
        if (it.session) {
          try { sessionStorage.setItem(it.session[0], it.session[1]); } catch { /* ignore */ }
        }
        setTab(it.tab);
      },
    }));
    if (expiryReturnCounts.toAct > 0)
      rows.push({ id: "exp-ret", tone: "due", title: t("attn.expiredReturns", { n: expiryReturnCounts.toAct }), sub: t("attn.expiredReturnsSub"), onClick: openExpiryReturns });
    if (expiryReturnCounts.withCompany > 0)
      rows.push({ id: "exp-co", tone: "info", title: t("attn.expiredReturnsCompany", { n: expiryReturnCounts.withCompany }), sub: t("attn.expiredReturnsCompanySub"), onClick: openExpiryReturns });
    if (openClaims.length > 0)
      rows.push({ id: "claims", tone: "warning", title: t("attn.openClaims", { n: openClaims.length }), sub: `₹${money(openClaimValue)}`, onClick: () => setTab("inventory") });
    return rows;
  }, [attention.items, expiryReturnCounts, openClaims.length, openClaimValue, t, setTab]);

  // Phone-only presentation derivations (read-only)
  const [showAllAttention, setShowAllAttention] = useState(false);

  const previousPaid = useMemo(
    () =>
      currentCycle.id === "all" || currentCycle.id === "custom"
        ? 0
        : summarizeCollections({ bills, payments, inPeriod: prevDateInPeriod }).total,
    [bills, payments, currentCycle.id, prevDateInPeriod],
  );
  const collectionTrend = useMemo(() => {
    if (previousPaid <= 0) return undefined;
    const pct = Math.round(((periodPaid - previousPaid) / previousPaid) * 100);
    return {
      label: pct >= 0 ? t("home.trendUp", { pct: Math.abs(pct) }) : t("home.trendDown", { pct: Math.abs(pct) }),
      tone: (pct >= 0 ? "paid" : "due") as "paid" | "due",
    };
  }, [previousPaid, periodPaid, t]);

  const phoneAttentionRows: AttentionRow[] = useMemo(
    () =>
      attention.items.slice(0, 3).map((it) => ({
        id: it.id,
        tone: it.tone,
        title: t(it.titleKey, { n: it.count }),
        sub: t(it.subKey),
        onClick: () => {
          if (it.session) {
            try { sessionStorage.setItem(it.session[0], it.session[1]); } catch { /* ignore */ }
          }
          setTab(it.tab);
        },
      })),
    [attention.items, t, setTab],
  );

  const last7Total = useMemo(() => salesBars.reduce((s, b) => s + b.value, 0), [salesBars]);

  // Desktop: the period switch lives in the top bar (portal), everywhere else it sits in the page.
  const [isDesktop, setIsDesktop] = useState<boolean>(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(isDesktop ? document.getElementById("topbar-period-slot") : null);
  }, [isDesktop]);

  const periodOptions = [
    { id: "today", label: t("period.today") },
    { id: "7days", label: t("period.week") },
    { id: "month", label: t("period.month") },
    { id: "all", label: t("period.all") },
  ];
  const periodValue = showCustomPicker ? "" : periodPreset === "30days" ? "month" : periodPreset;

  const periodSwitch = (
    <SegmentedPeriod
      ariaLabel={t("home.periodLabel")}
      options={periodOptions}
      value={periodValue}
      onChange={(id) => handleSelectPreset(id as FilterPeriodPreset)}
      trailing={
        <div className="relative" ref={filterDropdownRef}>
          <button
            type="button"
            id="btn-cycle-period"
            className="hh-segmented__btn"
            data-active={!periodOptions.some((o) => o.id === periodValue) ? "true" : "false"}
            aria-haspopup="dialog"
            aria-expanded={showFilterDropdown}
            onClick={() => setShowFilterDropdown((prev) => !prev)}
          >
            {periodOptions.some((o) => o.id === periodValue) ? t("home.morePeriods") : shortFilterLabel}
            <ChevronDown className="inline-block ml-1 size-4" aria-hidden="true" />
          </button>
            {showFilterDropdown && (
              <DashboardPeriodPopover
                periodPreset={periodPreset}
                showCustomPicker={showCustomPicker}
                customDays={customDays}
                startDate={startDate}
                endDate={endDate}
                today={today}
                getPastDateStr={getPastDateStr}
                onSelectPreset={handleSelectPreset}
                onApplyCustomDays={handleApplyCustomDays}
                onSetShowCustomPicker={setShowCustomPicker}
                onSetStartDate={setStartDate}
                onSetEndDate={setEndDate}
                onSetPeriodPreset={setPeriodPreset}
                onCloseDropdown={() => setShowFilterDropdown(false)}
              />
            )}
        </div>
      }
    />
  );

  const collectionLabel = periodPreset === "today" ? t("home.collectionToday") : t("home.collectionPeriod", { period: shortFilterLabel });
  const duePill = periodOutstanding > 0 ? t("home.stillDue", { amount: money(periodOutstanding) }) : t("home.allCollected");
  const topAlert = attentionRows[0];

  return (
    <div id="view-dashboard" className="hh-home min-w-0 max-w-full">
      <div className="hh-home__title">
        <h1>{t("nav.home")}</h1>
        <div className="hh-home__title-actions">
          {!(isDesktop && slot) && periodSwitch}
          <button type="button" className="hh-btn hh-btn--primary hh-only-tablet" onClick={() => setTab("billing")}>
            + {t("top.newBill")}
          </button>
        </div>
      </div>
      {isDesktop && slot && createPortal(periodSwitch, slot)}

      <div className="hh-home__top">
        <div className="hh-area-hero">
          <HeroCollectionCard
            label={collectionLabel}
            phoneLabel={periodPreset === "today" ? t("home.collectedToday") : collectionLabel}
            amount={`₹${money(periodPaid)}`}
            sub={t("home.ofSales", { sales: money(periodRevenue), bills: activeBills.length })}
            phoneSub={t("home.ofBilled", { sales: money(periodRevenue) })}
            duePill={duePill}
            pillTone={periodOutstanding > 0 ? "due" : "received"}
            pct={collectedPct}
            ringLabel={t("home.collectedPct", { pct: Math.round(collectedPct) })}
            trendLabel={collectionTrend?.label}
            trendTone={collectionTrend?.tone}
            cashLabel={t("home.cash")}
            cashDisplay={`₹${money(periodCash)}`}
            upiLabel={t("home.upi")}
            upiDisplay={`₹${money(periodUpi)}`}
            dueLabel={t("home.dueLabel")}
            dueDisplay={`₹${money(periodOutstanding)}`}
          />
        </div>

        <div className="hh-area-shortcuts hh-hide-desktop" aria-label={t("home.quickActions")}>
          <ShortcutTile tone="blue" icon={<Receipt size={24} />} phoneIcon={<ShoppingCart size={22} />} label={t("shortcut.newBill")} phoneLabel={t("shortcut.newSale")} onClick={() => setTab("billing")} />
          <ShortcutTile tone="green" icon={<Wallet size={24} />} label={t("shortcut.collect")} phoneLabel={t("shortcut.receive")} onClick={() => setTab("payments")} />
          <ShortcutTile tone="orange" icon={<Truck size={24} />} label={t("shortcut.trip")} phoneLabel={t("shortcut.trips")} onClick={() => setTab("trips")} />
          <ShortcutTile tone="purple" icon={<Package size={24} />} label={t("shortcut.stock")} onClick={() => setTab("inventory")} />
        </div>

        {phoneAttentionRows.length > 0 && (
          <div className="hh-area-attn-phone hh-only-phone">
            <PhoneNeedsAttentionCard
              title={t("attn.title")}
              seeAllLabel={t("bills.seeAll")}
              onSeeAll={() => setShowAllAttention(true)}
              rows={phoneAttentionRows}
            />
          </div>
        )}

        <div className="hh-area-metrics">
          <div className="hh-show-phone-desktop hh-metric-slot--sales"><HubMetricCard tone="sales" label={t("metric.sales")} value={`₹${money(periodRevenue)}`} sub={t("metric.billsCount", { n: activeBills.length })} /></div>
          <div className="hh-metric-slot--profit"><HubMetricCard tone="profit" label={t("metric.profit")} value={`₹${money(netProfit)}`} sub={t("metric.afterExpenses")} /></div>
          <div className="hh-show-phone-desktop hh-metric-slot--received"><HubMetricCard tone="received" label={t("metric.received")} value={`₹${money(periodPaid)}`} sub={t("metric.collectedSub")} /></div>
          <div className="hh-metric-slot--due"><HubMetricCard tone="due" label={t("metric.due")} value={`₹${money(periodOutstanding)}`} sub={customersWithDue === 1 ? t("metric.customerOne") : t("metric.customersDue", { n: customersWithDue })} /></div>
          <div className="hh-only-tablet hh-metric-slot--expenses"><HubMetricCard tone="warning" label={t("metric.expenses")} value={`₹${money(periodExpenseTotal)}`} sub={t("metric.inPeriod")} /></div>
        </div>
      </div>

      <div className="hh-home__lower">
        {topAlert && (
          <div className="hh-area-alert hh-only-phone">
            <AlertStrip text={topAlert.title} onClick={topAlert.onClick} />
          </div>
        )}
        <div className="hh-area-chart hh-show-phone-desktop">
          <SalesBarsCard
            title={t("chart.sales7")}
            phoneTitle={t("chart.sales7Short")}
            totalDisplay={`₹${money(last7Total)}`}
            bars={salesBars}
          />
        </div>
        <div className="hh-area-beats hh-hide-phone"><DueByBeatCard title={t("beat.title")} rows={beatRows} empty={t("beat.empty")} /></div>
        <div className="hh-area-attn hh-show-desktop"><NeedsAttentionCard id="needs-attention" title={t("attn.title")} rows={attentionRows} empty={t("attn.allClear")} /></div>
        <section className="hh-card hh-area-bills" aria-label={t("bills.recent")}>
          <div className="hh-card__head">
            <h2 className="hh-card__title">{t("bills.recent")}</h2>
            <button type="button" className="hh-linkbtn hh-linkbtn--primary" onClick={handleSeeAllBills}>{t("bills.seeAll")}</button>
          </div>
          {recentBills.length === 0 ? (
            <p className="hh-empty">{t("bills.empty")}</p>
          ) : (
            <>
              <div className="hh-hide-desktop"><BillsList rows={recentBills} onOpen={handleOpenBill} /></div>
              <div className="hh-show-desktop"><BillsTable rows={recentBills} onOpen={handleOpenBill} /></div>
            </>
          )}
        </section>
      </div>

      {/* Tax Invoice / Cash Bill Modal on clicking any Recent Bill */}
      {selectedBillForModal && (
        <TaxInvoiceModal
          bill={selectedBillForModal}
          defaultFormat={selectedBillFormat}
          onClose={() => setSelectedBillForModal(null)}
          onEditBill={() => {
            setSelectedBillForModal(null);
            setTab("billing");
          }}
        />
      )}

      <NotificationPanel
        isOpen={showAllAttention}
        onClose={() => setShowAllAttention(false)}
      />

      {(products.length === 0 || customers.length === 0 || bills.length === 0) && (
        <section className="hh-card hh-getstarted">
          <h2 className="hh-card__title">{t("home.getStarted")}</h2>
          <ol className="hh-getstarted__list">
            <li><button type="button" onClick={() => setTab("settings")} className="hh-linkbtn hh-linkbtn--primary">{t("home.gs1")}</button></li>
            <li><button type="button" onClick={() => setTab("products")} className="hh-linkbtn hh-linkbtn--primary">{t("home.gs2")}</button></li>
            <li><button type="button" onClick={() => setTab("customers")} className="hh-linkbtn hh-linkbtn--primary">{t("home.gs3")}</button></li>
          </ol>
        </section>
      )}
    </div>
  );
};

export default DashboardView;
