import React from "react";
import { ArrowLeft, ChevronLeft, Edit2, Phone, Trash2 } from "lucide-react";
import { ConfirmModal } from "../../ui";
import type { SupplierMaster } from "./supplierStore";

export interface SupplierDetailViewProps {
  supplier: SupplierMaster;
  grnCount: number;
  isPhone: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setSelectedSupplier: React.Dispatch<React.SetStateAction<SupplierMaster | null>>;
  openEditSupplier: (s: SupplierMaster) => void;
  supplierToDelete: SupplierMaster | null;
  setSupplierToDelete: React.Dispatch<React.SetStateAction<SupplierMaster | null>>;
  deleteSupplier: (id: string) => void;
}

export const SupplierDetailView: React.FC<SupplierDetailViewProps> = ({
  supplier: s,
  grnCount: grnN,
  isPhone,
  t,
  setSelectedSupplier,
  openEditSupplier,
  supplierToDelete,
  setSupplierToDelete,
  deleteSupplier,
}) => {
  return (
    <div id="view-customers" className="hh-view min-h-[100dvh] bg-[var(--bg)] pb-24">
      {isPhone ? (
        <>
          <div className="hh-sales-top">
            <div className="hh-sales-top__row">
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setSelectedSupplier(null)}
                  className="hh-sales-top__iconbtn"
                  aria-label={t("common.back")}
                >
                  <ChevronLeft className="w-6 h-6" strokeWidth={2.2} />
                </button>
                <h1 className="hh-sales-top__title break-words min-w-0">{s.name}</h1>
              </div>
              <button
                type="button"
                onClick={() => openEditSupplier(s)}
                className="hh-sales-top__iconbtn shrink-0"
                aria-label={t("common.edit")}
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3 mt-1">
            <div className="rt-card space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
                  Inward GRNs
                </span>
                <span className="text-[22px] font-extrabold tabular-nums" style={{ color: "var(--text)" }}>
                  {grnN}
                </span>
              </div>
              {s.contactPerson && (
                <p className="text-[13px] m-0" style={{ color: "var(--text)" }}>Contact: {s.contactPerson}</p>
              )}
              {s.phone && (
                <p className="text-[13px] m-0" style={{ color: "var(--text-2)" }}>{s.phone}</p>
              )}
              {s.gstin && (
                <p className="font-mono text-[12px] m-0" style={{ color: "var(--text-2)" }}>GSTIN {s.gstin}</p>
              )}
              {s.pan && (
                <p className="font-mono text-[12px] m-0" style={{ color: "var(--text-2)" }}>PAN {s.pan}</p>
              )}
            </div>

            {(s.address || s.city || s.state) && (
              <div className="rt-card space-y-1 text-[13px]">
                {s.address && <p className="m-0" style={{ color: "var(--text)" }}>{s.address}</p>}
                {(s.city || s.state) && (
                  <p className="m-0" style={{ color: "var(--text-2)" }}>
                    {[s.city, s.state].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            )}

            {s.notes && (
              <div className="rt-card text-[13px]" style={{ color: "var(--text-2)" }}>
                {s.notes}
              </div>
            )}

            <div className="flex gap-2.5 pt-1">
              {s.phone && (
                <a href={`tel:${s.phone}`} className="rt-btn flex-1 no-underline">
                  <Phone size={16} /> Call
                </a>
              )}
              <button
                type="button"
                onClick={() => setSupplierToDelete(s)}
                className="rt-btn-outline rt-btn-outline--due flex-1"
              >
                <Trash2 size={16} /> {t("common.delete")}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
      <div className="sticky top-0 z-20 bg-[var(--bg)]/95 backdrop-blur border-b border-black/5 px-0 py-3 flex items-center gap-3 w-full">
        <button
          type="button"
          onClick={() => setSelectedSupplier(null)}
          className="p-2 -ml-1 rounded-full hover:bg-black/5 cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-slate-800" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-slate-900 min-w-0 break-words lg:truncate">{s.name}</h1>
          <p className="text-xs text-slate-500 min-w-0 break-words lg:truncate">
            {s.phone || s.email || "No contact"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openEditSupplier(s)}
          className="text-sm font-semibold text-[var(--primary)] px-3 py-1.5 rounded-lg hover:bg-[var(--primary)]/10 cursor-pointer"
        >
          Edit
        </button>
      </div>

      <div className="hh-detail-cols px-0 py-4 space-y-3 w-full">
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Inward GRNs
            </span>
            <span className="text-xl font-extrabold text-slate-900">{grnN}</span>
          </div>
          {s.contactPerson && (
            <p className="text-sm text-slate-600">Contact: {s.contactPerson}</p>
          )}
          {s.gstin && (
            <p className="font-mono text-xs text-slate-600">GSTIN {s.gstin}</p>
          )}
          {s.pan && (
            <p className="font-mono text-xs text-slate-600">PAN {s.pan}</p>
          )}
        </div>

        {(s.address || s.city || s.state) && (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 space-y-1 text-sm">
            {s.address && <p className="text-slate-700">{s.address}</p>}
            {(s.city || s.state) && (
              <p className="text-slate-500">
                {[s.city, s.state].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        )}

        {s.notes && (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 text-sm text-slate-600">
            {s.notes}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {s.phone && (
            <a
              href={`tel:${s.phone}`}
              className="flex-1 py-3 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm flex items-center justify-center gap-1.5"
            >
              <Phone className="w-4 h-4" /> Call
            </a>
          )}
          <button
            type="button"
            onClick={() => setSupplierToDelete(s)}
            className="px-3 py-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 cursor-pointer"
            aria-label="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
        </>
      )}

      {supplierToDelete && (
        <ConfirmModal
          isOpen
          title="Delete supplier?"
          subtitle={supplierToDelete.name}
          message="Remove this supplier from the directory? Past GRNs are kept."
          impactItems={[{ label: "Linked GRNs", detail: `${grnN} inward invoice(s) preserved` }]}
          confirmButtonLabel="Delete Supplier"
          variant="danger"
          rectificationPrompt="Reason for deleting supplier *"
          rectificationPlaceholder="e.g. Duplicate supplier, switched vendor, test entry"
          reasonPresets={["Duplicate supplier", "Switched vendor", "Test entry"]}
          commentMinLength={4}
          onConfirmWithComment={() => {
            deleteSupplier(supplierToDelete.id);
            setSupplierToDelete(null);
            setSelectedSupplier(null);
          }}
          onConfirm={() => {}}
          onClose={() => setSupplierToDelete(null)}
        />
      )}
    </div>
  );
};
