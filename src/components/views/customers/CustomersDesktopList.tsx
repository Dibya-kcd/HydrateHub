import React from "react";
import { Building2, Check, Plus, Route, Search, X } from "lucide-react";
import { getInitials } from "../../ui/HomeKit";
import { BeatRouteConfig, ExistingCustomer } from "../../../types";
import { money } from "../../../utils/billing";
import { nameFromMap } from "../../../hooks/useAutoOdiaName";
import type { SupplierMaster } from "./supplierStore";
import { EmptyCard, type PartyTab } from "./customerFormUtils";

interface CustomersDesktopListProps {
  language: "en" | "or";
  partyTab: PartyTab;
  setPartyTab: (tab: PartyTab) => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  openAdd: () => void;
  beatMenuRef: React.RefObject<HTMLDivElement | null>;
  beatMenuOpen: boolean;
  setBeatMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  beatFilter: string;
  setBeatFilter: (val: string) => void;
  beats: BeatRouteConfig[];
  beatCounts: { counts: Map<string, number>; none: number };
  customerFilter: "all" | "due" | "advance";
  setCustomerFilter: (val: "all" | "due" | "advance") => void;
  existingCustomers: ExistingCustomer[];
  dueCount: number;
  advanceCount: number;
  filteredSuppliers: SupplierMaster[];
  filteredCustomers: ExistingCustomer[];
  grnCountBySupplier: Map<string, number>;
  customerNameMap: Map<string, string>;
  setSelectedSupplier: (s: SupplierMaster | null) => void;
  setSelectedCustomer: (c: ExistingCustomer | null) => void;
}

export const CustomersDesktopList: React.FC<CustomersDesktopListProps> = ({
  language,
  partyTab,
  setPartyTab,
  searchTerm,
  setSearchTerm,
  openAdd,
  beatMenuRef,
  beatMenuOpen,
  setBeatMenuOpen,
  beatFilter,
  setBeatFilter,
  beats,
  beatCounts,
  customerFilter,
  setCustomerFilter,
  existingCustomers,
  dueCount,
  advanceCount,
  filteredSuppliers,
  filteredCustomers,
  grnCountBySupplier,
  customerNameMap,
  setSelectedSupplier,
  setSelectedCustomer,
}) => (
  <div className="w-full min-w-0">
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
        Parties
      </h1>
      <button
        type="button"
        onClick={openAdd}
        className="size-10 sm:size-11 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-md cursor-pointer active:scale-95"
        aria-label={partyTab === "suppliers" ? "Add supplier" : "Add customer"}
      >
        <Plus className="w-5 h-5" strokeWidth={2.5} />
      </button>
    </div>

    <div className="flex bg-[#ebe8e1] rounded-full p-1 mb-4">
      <button
        type="button"
        onClick={() => {
          setPartyTab("customers");
          setSearchTerm("");
          setBeatMenuOpen(false);
        }}
        className={`flex-1 py-2.5 text-sm font-semibold rounded-full transition-colors cursor-pointer ${
          partyTab === "customers"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500"
        }`}
      >
        Customers
      </button>
      <button
        type="button"
        onClick={() => {
          setPartyTab("suppliers");
          setSearchTerm("");
          setBeatMenuOpen(false);
        }}
        className={`flex-1 py-2.5 text-sm font-semibold rounded-full transition-colors cursor-pointer ${
          partyTab === "suppliers"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500"
        }`}
      >
        Suppliers
      </button>
    </div>

    <div ref={beatMenuRef} className="relative mb-3">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        enterKeyHint="search"
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search name, phone, GSTIN"
        className={`w-full pl-10 py-2.5 rounded-full bg-white border border-black/8 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]/40 ${
          partyTab === "customers" && beats.length > 0
            ? searchTerm
              ? "pr-20 md:pr-10"
              : "pr-12 md:pr-4"
            : searchTerm
              ? "pr-10"
              : "pr-4"
        }`}
      />
      {searchTerm && (
        <button
          type="button"
          onClick={() => setSearchTerm("")}
          aria-label="Clear search"
          className={`absolute top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-slate-700 cursor-pointer ${
            partyTab === "customers" && beats.length > 0 ? "right-11 md:right-2" : "right-2"
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Mobile Beat Filter Icon on right side of search bar */}
      {partyTab === "customers" && beats.length > 0 && (
        <button
          type="button"
          onClick={() => setBeatMenuOpen((v) => !v)}
          aria-label="Filter by beat"
          aria-expanded={beatMenuOpen}
          className={`md:hidden absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] px-2 rounded-full inline-flex items-center justify-center gap-1 text-xs font-bold transition-colors cursor-pointer ${
            beatFilter !== "all"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
          title="Filter by beat"
        >
          <Route className="w-4 h-4 shrink-0" />
        </button>
      )}

      {/* Beat Selector Dropdown inside Search (mobile) */}
      {beatMenuOpen && partyTab === "customers" && beats.length > 0 && (
        <div
          role="listbox"
          aria-label="Choose beat"
          className="md:hidden absolute left-0 right-0 top-full mt-1.5 z-40 rounded-2xl border border-[#DCE5F2] bg-white shadow-xl p-2 space-y-1 max-h-72 overflow-y-auto"
        >
          <div className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            Filter by beat
          </div>
          {[
            { id: "all", label: "All beats", n: existingCustomers.length },
            ...beats
              .filter((b) => b.active !== false)
              .map((b) => ({ id: b.id, label: b.name, n: beatCounts.counts.get(b.id) || 0 })),
            { id: "none", label: "No beat yet", n: beatCounts.none },
          ].map((opt) => {
            const selected = beatFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setBeatFilter(opt.id);
                  setBeatMenuOpen(false);
                }}
                className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-left text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  selected
                    ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Route className={`w-3.5 h-3.5 shrink-0 ${selected ? "text-emerald-700" : "text-slate-400"}`} />
                  <span className="truncate">{opt.label}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold tabular-nums">
                    {opt.n}
                  </span>
                  {selected && <Check className="w-4 h-4 text-emerald-700" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>

    {partyTab === "customers" && (
      <div className="flex items-center gap-1.5 mb-3.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setCustomerFilter("all")}
          className={`px-3 py-1.5 rounded-full font-semibold transition-colors cursor-pointer shrink-0 ${
            customerFilter === "all"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 border border-black/5 hover:bg-slate-50"
          }`}
        >
          All ({existingCustomers.length})
        </button>
        <button
          type="button"
          onClick={() => setCustomerFilter("due")}
          className={`px-3 py-1.5 rounded-full font-semibold transition-colors cursor-pointer shrink-0 ${
            customerFilter === "due"
              ? "bg-rose-600 text-white shadow-xs"
              : "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50"
          }`}
        >
          With Due ({dueCount})
        </button>
        <button
          type="button"
          onClick={() => setCustomerFilter("advance")}
          className={`px-3 py-1.5 rounded-full font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
            customerFilter === "advance"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              customerFilter === "advance" ? "bg-white" : "bg-emerald-500"
            }`}
          />
          With Advance ({advanceCount})
        </button>
      </div>
    )}

    {partyTab === "customers" && beats.length > 0 && beatFilter !== "all" && (
      <div className="md:hidden flex items-center gap-1.5 mb-3 text-xs">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
          <Route className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
          <span>
            Beat:{" "}
            {beatFilter === "none"
              ? "No beat yet"
              : beats.find((b) => b.id === beatFilter)?.name || beatFilter}
          </span>
          <button
            type="button"
            onClick={() => setBeatFilter("all")}
            aria-label="Clear beat filter"
            className="ml-0.5 text-emerald-600 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      </div>
    )}

    {partyTab === "customers" && beats.length > 0 && (
      <div className="hidden md:flex items-center gap-1.5 mb-3.5 overflow-x-auto pb-1 text-xs" aria-label="Filter by beat">
        {[
          { id: "all", label: "All beats", n: existingCustomers.length },
          ...beats.filter((b) => b.active !== false).map((b) => ({ id: b.id, label: b.name, n: beatCounts.counts.get(b.id) || 0 })),
          { id: "none", label: "No beat yet", n: beatCounts.none },
        ].map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setBeatFilter(chip.id)}
            className={`px-3 py-1.5 rounded-full font-semibold transition-colors cursor-pointer shrink-0 ${
              beatFilter === chip.id
                ? "bg-emerald-700 text-white shadow-xs"
                : "bg-white text-slate-600 border border-black/5 hover:bg-slate-50"
            }`}
          >
            {chip.label} ({chip.n})
          </button>
        ))}
      </div>
    )}

    {partyTab === "suppliers" ? (
      filteredSuppliers.length === 0 ? (
        <EmptyCard
          title="No suppliers yet"
          hint="Tap + to add one. Names from GRNs are imported automatically."
        />
      ) : (
        <ul className="hh-list-grid">
          {filteredSuppliers.map((s) => {
            const grnN = grnCountBySupplier.get(s.name.trim().toLowerCase()) || 0;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelectedSupplier(s)}
                  data-card-tone="profit"
                  className="w-full text-left rounded-2xl border shadow-sm px-4 py-3.5 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition"
                >
                  <div className="hh-icon-badge hh-icon-badge--purple">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 break-words leading-snug">
                      {s.name}
                    </div>
                    <div className="text-xs text-slate-600 min-w-0 break-words lg:truncate">
                      {s.phone || s.city || s.gstin || "—"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-extrabold text-violet-900 tabular-nums">
                      {grnN}
                    </div>
                    <div className="text-xs font-bold text-violet-600 uppercase tracking-wide">
                      GRNs
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )
    ) : filteredCustomers.length === 0 ? (
      <EmptyCard title="No customers yet" hint="Tap + to add one." />
    ) : (
      <ul className="hh-list-grid">
        {filteredCustomers.map((c) => {
          const hasAdvance = (c.advance || 0) > 0.004 && c.balanceDue <= 0.004;
          const hasDue = c.balanceDue > 0.004;
          const cardTone = hasAdvance ? "received" : hasDue ? "due" : "sales";
          const avatarTone = hasAdvance ? "green" : hasDue ? "rose" : "blue";
          const displayName = nameFromMap(customerNameMap, c, language);
          return (
            <li key={c.id || c.name}>
              <button
                type="button"
                onClick={() => setSelectedCustomer(c)}
                data-card-tone={cardTone}
                className="w-full text-left rounded-2xl border shadow-sm px-4 py-3.5 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition"
              >
                <div className={`hh-avatar hh-avatar--${avatarTone}`}>
                  {getInitials(displayName, "C")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 break-words leading-snug">
                      {displayName}
                    </span>
                    {hasAdvance && (
                      <span className="px-1.5 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                        Advance
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 min-w-0 break-words lg:truncate">
                    {c.phone || c.city || "—"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {hasAdvance ? (
                    <>
                      <div className="text-sm font-black text-emerald-700 tabular-nums">
                        ₹{money(c.advance || 0)}
                      </div>
                      <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                        advance
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        className={`text-sm font-extrabold tabular-nums ${
                          hasDue ? "text-rose-600" : "text-slate-800"
                        }`}
                      >
                        ₹{money(c.balanceDue)}
                      </div>
                      <div
                        className={`text-xs font-bold uppercase tracking-wide ${
                          hasDue ? "text-rose-500" : "text-slate-500"
                        }`}
                      >
                        {hasDue ? "due" : "settled"}
                      </div>
                    </>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);
