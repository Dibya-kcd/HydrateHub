import React from "react";
import { Calendar, Check } from "lucide-react";
import type { FilterPeriodPreset } from "../../common/PeriodFilter";

export interface DashboardPeriodPopoverProps {
  periodPreset: FilterPeriodPreset;
  showCustomPicker: boolean;
  customDays: number;
  startDate: string;
  endDate: string;
  today: string;
  getPastDateStr: (daysAgo: number) => string;
  onSelectPreset: (preset: FilterPeriodPreset) => void;
  onApplyCustomDays: (days: number) => void;
  onSetShowCustomPicker: (show: boolean) => void;
  onSetStartDate: (val: string) => void;
  onSetEndDate: (val: string) => void;
  onSetPeriodPreset: (preset: FilterPeriodPreset) => void;
  onCloseDropdown: () => void;
}

export const DashboardPeriodPopover: React.FC<DashboardPeriodPopoverProps> = ({
  periodPreset,
  showCustomPicker,
  customDays,
  startDate,
  endDate,
  today,
  getPastDateStr,
  onSelectPreset,
  onApplyCustomDays,
  onSetShowCustomPicker,
  onSetStartDate,
  onSetEndDate,
  onSetPeriodPreset,
  onCloseDropdown,
}) => (
  <div
    role="dialog"
    aria-label="Filter period"
    className="hh-period-popover absolute right-0 mt-2 z-50 w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-white text-slate-800 shadow-2xl border border-slate-200/90 p-3.5 animate-in fade-in zoom-in-95 duration-150"
    onClick={(e) => e.stopPropagation()}
  >
    {/* Header */}
    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
      <div className="flex items-center gap-1.5">
        <Calendar className="w-4 h-4 text-emerald-700" />
        <span className="text-xs font-bold text-slate-900 tracking-tight">Period Filter</span>
      </div>
      {periodPreset !== "today" && (
        <button
          type="button"
          onClick={() => {
            onSelectPreset("today");
            onCloseDropdown();
          }}
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
        >
          Reset to Today
        </button>
      )}
    </div>

    {/* Presets Grid */}
    <div className="grid grid-cols-2 gap-1.5 mb-3">
      {[
        { id: "today" as FilterPeriodPreset, label: "Today", sub: "Today only" },
        { id: "yesterday" as FilterPeriodPreset, label: "Yesterday", sub: "Previous day" },
        { id: "7days" as FilterPeriodPreset, label: "Week", sub: "Last 7 days" },
        { id: "month" as FilterPeriodPreset, label: "Month", sub: "Last 30 days" },
        { id: "lastMonth" as FilterPeriodPreset, label: "Last Month", sub: "Prior month" },
        { id: "all" as FilterPeriodPreset, label: "All Time", sub: "Complete history" },
      ].map((p) => {
        const active = periodPreset === p.id && !showCustomPicker;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              onSelectPreset(p.id);
              onCloseDropdown();
            }}
            className={`text-left px-2.5 py-2 rounded-xl text-xs transition-all cursor-pointer border ${
              active
                ? "bg-emerald-50 border-emerald-500/40 text-emerald-900 font-bold shadow-xs"
                : "bg-slate-50/70 hover:bg-slate-100 border-slate-200/60 text-slate-700 font-medium"
            }`}
          >
            <div className="flex items-center justify-between">
              <span>{p.label}</span>
              {active && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
            </div>
            <div className="text-xs text-slate-400 font-normal mt-0.5">{p.sub}</div>
          </button>
        );
      })}
    </div>

    {/* Quick Days Row */}
    <div className="mb-3 pt-2 border-t border-slate-100">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
        Quick Horizons
      </div>
      <div className="flex items-center gap-1.5">
        {[7, 15, 30, 60, 90].map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => {
              onApplyCustomDays(days);
              onCloseDropdown();
            }}
            className={`flex-1 py-1 rounded-lg text-xs font-semibold cursor-pointer border transition-colors text-center ${
              periodPreset === "custom" && customDays === days
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            {days}d
          </button>
        ))}
      </div>
    </div>

    {/* Custom Date Range */}
    <div className="pt-2 border-t border-slate-100 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Custom Range
        </span>
        {showCustomPicker ? (
          <button
            type="button"
            onClick={() => onSetShowCustomPicker(false)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              onSetShowCustomPicker(true);
              onSetPeriodPreset("custom");
            }}
            className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
          >
            Pick Dates
          </button>
        )}
      </div>

      {showCustomPicker && (
        <div className="space-y-2 bg-slate-50 rounded-xl p-2.5 border border-slate-200/80">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                From
              </label>
              <input
                type="date"
                value={startDate}
                max={endDate || today}
                onChange={(e) => {
                  onSetStartDate(e.target.value);
                  onSetPeriodPreset("custom");
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                To
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                max={today}
                onChange={(e) => {
                  onSetEndDate(e.target.value);
                  onSetPeriodPreset("custom");
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!startDate) onSetStartDate(getPastDateStr(6));
              if (!endDate) onSetEndDate(today);
              onSetPeriodPreset("custom");
              onCloseDropdown();
            }}
            className="w-full py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer shadow-xs"
          >
            Apply Range
          </button>
        </div>
      )}
    </div>
  </div>
);
