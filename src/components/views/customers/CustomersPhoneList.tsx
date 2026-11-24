import React from "react";
import { createPortal } from "react-dom";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { getInitials } from "../../ui/HomeKit";
import { BeatRouteConfig, ExistingCustomer } from "../../../types";
import { money } from "../../../utils/billing";
import { normCustName } from "../../../context/ledgerHelpers";
import { nameFromMap } from "../../../hooks/useAutoOdiaName";
import type { SupplierMaster } from "./supplierStore";
import type { PartyTab } from "./customerFormUtils";

interface CustomersPhoneListProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  language: "en" | "or";
  partyTab: PartyTab;
  setPartyTab: (tab: PartyTab) => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  openAdd: () => void;
  phoneFilterSheetOpen: boolean;
  setPhoneFilterSheetOpen: (open: boolean) => void;
  customerFilter: "all" | "due" | "advance";
  setCustomerFilter: (val: "all" | "due" | "advance") => void;
  beatFilter: string;
  setBeatFilter: (val: string) => void;
  beats: BeatRouteConfig[];
  beatCounts: { counts: Map<string, number>; none: number };
  existingCustomers: ExistingCustomer[];
  suppliers: SupplierMaster[];
  dueCount: number;
  advanceCount: number;
  filteredSuppliers: SupplierMaster[];
  filteredCustomers: ExistingCustomer[];
  grnCountBySupplier: Map<string, number>;
  selectedBeatName: string;
  oldestDueDaysByCustomer: Map<string, number>;
  customerNameMap: Map<string, string>;
  beatIdForExisting: (ec: ExistingCustomer) => string;
  beatNameById: Map<string, string>;
  customerTypeById: Map<string, string>;
  customerTypeByName: Map<string, string>;
  setSelectedSupplier: (s: SupplierMaster | null) => void;
  setPhoneDetailTab: (tab: "summary" | "ledger") => void;
  setSelectedCustomer: (c: ExistingCustomer | null) => void;
}

export const CustomersPhoneList: React.FC<CustomersPhoneListProps> = ({
  t,
  language,
  partyTab,
  setPartyTab,
  searchTerm,
  setSearchTerm,
  openAdd,
  phoneFilterSheetOpen,
  setPhoneFilterSheetOpen,
  customerFilter,
  setCustomerFilter,
  beatFilter,
  setBeatFilter,
  beats,
  beatCounts,
  existingCustomers,
  suppliers,
  dueCount,
  advanceCount,
  filteredSuppliers,
  filteredCustomers,
  grnCountBySupplier,
  selectedBeatName,
  oldestDueDaysByCustomer,
  customerNameMap,
  beatIdForExisting,
  beatNameById,
  customerTypeById,
  customerTypeByName,
  setSelectedSupplier,
  setPhoneDetailTab,
  setSelectedCustomer,
}) => (
  <div className="space-y-3">
    <div className="hh-sales-top">
      <div className="hh-sales-top__row">
        <h1 className="hh-sales-top__title">{t("parties.title")}</h1>
        <button
          type="button"
          onClick={openAdd}
          className="hh-sales-top__iconbtn"
          aria-label={partyTab === "suppliers" ? "Add supplier" : t("parties.newCustomer")}
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} />
        </button>
      </div>
    </div>

    <div className="rt-search-bar">
      <Search size={16} style={{ color: "var(--text-2)", flexShrink: 0 }} />
      <input
        enterKeyHint="search"
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder={t("parties.searchPlaceholder")}
      />
      {searchTerm && (
        <button
          type="button"
          onClick={() => setSearchTerm("")}
          aria-label="Clear search"
          className="p-1 bg-transparent border-0 cursor-pointer"
          style={{ color: "var(--text-2)" }}
        >
          <X size={15} />
        </button>
      )}
      <button
        type="button"
        onClick={() => setPhoneFilterSheetOpen(true)}
        aria-label="Filter parties"
        className="relative p-1.5 bg-transparent border-0 cursor-pointer inline-flex items-center justify-center shrink-0"
        style={{
          color: customerFilter !== "all" || partyTab === "suppliers" ? "var(--primary)" : "var(--text-2)",
          minHeight: "34px",
          minWidth: "34px",
        }}
      >
        <SlidersHorizontal size={16} />
        {(customerFilter !== "all" || partyTab === "suppliers") && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 size-2 rounded-full"
            style={{ background: "var(--primary)" }}
          />
        )}
      </button>
    </div>

    {partyTab === "customers" && (
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {[
          { id: "all", label: t("parties.allBeats", { n: existingCustomers.length }) },
          ...beats
            .filter((b) => b.active !== false)
            .map((b) => ({ id: b.id, label: `${b.name} ${beatCounts.counts.get(b.id) || 0}` })),
          { id: "none", label: `${t("parties.noBeatYet")} ${beatCounts.none}` },
        ].map((chip) => (
          <button
            key={chip.id}
            type="button"
            aria-pressed={beatFilter === chip.id}
            onClick={() => setBeatFilter(chip.id)}
            className="rt-chip shrink-0"
          >
            {chip.label}
          </button>
        ))}
      </div>
    )}

    {partyTab === "customers" && customerFilter !== "all" && (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCustomerFilter("all")}
          className="rt-tag rt-tag--mode cursor-pointer border-0"
        >
          {customerFilter === "due" ? `Due (${dueCount})` : `${t("parties.credit")} (${advanceCount})`} ×
        </button>
      </div>
    )}

    {partyTab === "suppliers" && (
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          aria-pressed={false}
          onClick={() => {
            setPartyTab("customers");
            setSearchTerm("");
          }}
          className="rt-chip shrink-0"
        >
          {t("parties.customers")} ({existingCustomers.length})
        </button>
        <button
          type="button"
          aria-pressed={true}
          onClick={() => setPartyTab("suppliers")}
          className="rt-chip shrink-0"
        >
          {t("parties.suppliers")} ({suppliers.length})
        </button>
      </div>
    )}

    {phoneFilterSheetOpen &&
      createPortal(
        <div
          className="rt-bsheet-scrim"
          onClick={() => setPhoneFilterSheetOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
            <div className="hh-grab" />
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
                {t("parties.title")}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={partyTab === "customers"}
                  onClick={() => {
                    setPartyTab("customers");
                    setPhoneFilterSheetOpen(false);
                  }}
                  className="rt-pay-pill text-[13px] font-bold cursor-pointer bg-white"
                >
                  {t("parties.customers")} ({existingCustomers.length})
                </button>
                <button
                  type="button"
                  aria-pressed={partyTab === "suppliers"}
                  onClick={() => {
                    setPartyTab("suppliers");
                    setPhoneFilterSheetOpen(false);
                  }}
                  className="rt-pay-pill text-[13px] font-bold cursor-pointer bg-white"
                >
                  {t("parties.suppliers")} ({suppliers.length})
                </button>
              </div>
            </div>
            {partyTab === "customers" && (
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
                  {t("parties.balanceDue")}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    aria-pressed={customerFilter === "all"}
                    onClick={() => {
                      setCustomerFilter("all");
                      setPhoneFilterSheetOpen(false);
                    }}
                    className="rt-pay-pill text-[12.5px] font-bold cursor-pointer bg-white"
                  >
                    {t("common.all")} ({existingCustomers.length})
                  </button>
                  <button
                    type="button"
                    aria-pressed={customerFilter === "due"}
                    onClick={() => {
                      setCustomerFilter("due");
                      setPhoneFilterSheetOpen(false);
                    }}
                    className="rt-pay-pill text-[12.5px] font-bold cursor-pointer bg-white"
                  >
                    Due ({dueCount})
                  </button>
                  <button
                    type="button"
                    aria-pressed={customerFilter === "advance"}
                    onClick={() => {
                      setCustomerFilter("advance");
                      setPhoneFilterSheetOpen(false);
                    }}
                    className="rt-pay-pill text-[12.5px] font-bold cursor-pointer bg-white"
                  >
                    {t("parties.credit")} ({advanceCount})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

    {partyTab === "suppliers" ? (
      filteredSuppliers.length === 0 ? (
        <div className="rt-card px-5 py-10 text-center text-[13px]" style={{ color: "var(--text-2)" }}>
          {t("parties.noPartiesFound")}
        </div>
      ) : (
        <div className="space-y-2.5 hh-tgrid-2">
          {filteredSuppliers.map((s) => {
            const grnN = grnCountBySupplier.get(s.name.trim().toLowerCase()) || 0;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSupplier(s)}
                className="hh-hist-card hh-hist-card--primary w-full text-left flex items-center gap-3 cursor-pointer"
              >
                <span className="rt-ico shrink-0">{getInitials(s.name, "S")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold break-words" style={{ color: "var(--text)" }}>
                    {s.name}
                  </span>
                  <span className="block text-[12px] mt-0.5 break-words" style={{ color: "var(--text-2)" }}>
                    {[s.phone || s.city || s.gstin].filter(Boolean).join(" · ") || "—"}
                  </span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-[15px] font-extrabold tabular-nums" style={{ color: "var(--text)" }}>
                    {grnN}
                  </span>
                  <span className="rt-tag mt-0.5">GRNs</span>
                </span>
              </button>
            );
          })}
        </div>
      )
    ) : filteredCustomers.length === 0 ? (
      <div className="rt-card px-5 py-10 text-center space-y-1">
        <div className="text-[14px] font-bold" style={{ color: "var(--text)" }}>
          {t("parties.noPartiesFound")}
        </div>
        <div className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
          {selectedBeatName}
        </div>
      </div>
    ) : (
      <div className="space-y-2.5 hh-tgrid-2">
        {filteredCustomers.map((c) => {
          const hasAdvance = (c.advance || 0) > 0.004 && c.balanceDue <= 0.004;
          const hasDue = c.balanceDue > 0.004;
          const dueDays = hasDue ? (oldestDueDaysByCustomer.get(normCustName(c.name)) ?? 0) : 0;
          const overdueHigh = hasDue && dueDays > 14;
          const cardEdge = hasAdvance
            ? "hh-hist-card--paid"
            : hasDue
              ? overdueHigh
                ? "hh-hist-card--due"
                : "hh-hist-card--amber"
              : "hh-hist-card--paid";
          const displayName = nameFromMap(customerNameMap, c, language);
          const bid = beatIdForExisting(c);
          const beatLabel = (bid && beatNameById.get(bid)) || c.city || "";
          const tpLabel =
            (c.id && customerTypeById.get(c.id)) ||
            customerTypeByName.get(normCustName(c.name)) ||
            "Retail";
          const subLine = [beatLabel || c.phone, tpLabel].filter(Boolean).join(" · ");

          return (
            <button
              key={c.id || c.name}
              type="button"
              onClick={() => {
                setPhoneDetailTab("summary");
                setSelectedCustomer(c);
              }}
              className={`hh-hist-card ${cardEdge} w-full text-left flex items-center gap-3 cursor-pointer`}
            >
              <span className="rt-ico shrink-0">{getInitials(displayName, "C")}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold break-words leading-snug" style={{ color: "var(--text)" }}>
                  {displayName}
                </span>
                <span className="block text-[12px] mt-0.5 break-words" style={{ color: "var(--text-2)" }}>
                  {subLine}
                </span>
              </span>
              <span className="text-right shrink-0">
                {hasAdvance ? (
                  <>
                    <span className="block text-[15px] font-extrabold tabular-nums" style={{ color: "var(--paid)" }}>
                      ₹{money(c.advance || 0)}
                    </span>
                    <span className="rt-tag rt-tag--paid mt-0.5">{t("parties.credit")}</span>
                  </>
                ) : hasDue ? (
                  <>
                    <span className="block text-[15px] font-extrabold tabular-nums" style={{ color: "var(--text)" }}>
                      ₹{money(c.balanceDue)}
                    </span>
                    <span className={`rt-tag mt-0.5 ${overdueHigh ? "rt-tag--due" : "rt-tag--soon"}`}>
                      {dueDays === 1
                        ? t("parties.dayCount")
                        : dueDays > 1
                          ? t("parties.daysCount", { n: dueDays })
                          : t("status.due")}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block text-[15px] font-extrabold tabular-nums" style={{ color: "var(--text)" }}>
                      ₹0
                    </span>
                    <span className="rt-tag rt-tag--paid mt-0.5">{t("parties.clear")}</span>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
    )}
  </div>
);
