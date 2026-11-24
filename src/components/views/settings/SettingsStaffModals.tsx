import React from 'react';
import { Key, Trash2, X } from 'lucide-react';
import { Salesman } from '../../../types';
import { ToggleSwitch } from '../../ui/ToggleSwitch';

interface SettingsStaffModalsProps {
  editingStaff: Salesman | null;
  setEditingStaff: React.Dispatch<React.SetStateAction<Salesman | null>>;
  editStaffName: string;
  setEditStaffName: React.Dispatch<React.SetStateAction<string>>;
  editStaffPhone: string;
  setEditStaffPhone: React.Dispatch<React.SetStateAction<string>>;
  editStaffVehicle: string;
  setEditStaffVehicle: React.Dispatch<React.SetStateAction<string>>;
  editStaffSeriesCode: string;
  setEditStaffSeriesCode: React.Dispatch<React.SetStateAction<string>>;
  editStaffNewPin: string;
  setEditStaffNewPin: React.Dispatch<React.SetStateAction<string>>;
  editStaffActive: boolean;
  setEditStaffActive: React.Dispatch<React.SetStateAction<boolean>>;
  editStaffError: string | null;
  isStaffSubmitting: boolean;
  handleSaveEditStaff: (e: React.FormEvent) => void;

  pinModalStaff: Salesman | null;
  setPinModalStaff: React.Dispatch<React.SetStateAction<Salesman | null>>;
  targetPin: string;
  setTargetPin: React.Dispatch<React.SetStateAction<string>>;
  pinModalError: string | null;
  isPinSubmitting: boolean;
  handleSavePin: (e: React.FormEvent) => void;

  deletingStaff: Salesman | null;
  setDeletingStaff: React.Dispatch<React.SetStateAction<Salesman | null>>;
  handleConfirmDeleteStaff: () => void;
}

export const SettingsStaffModals: React.FC<SettingsStaffModalsProps> = ({
  editingStaff,
  setEditingStaff,
  editStaffName,
  setEditStaffName,
  editStaffPhone,
  setEditStaffPhone,
  editStaffVehicle,
  setEditStaffVehicle,
  editStaffSeriesCode,
  setEditStaffSeriesCode,
  editStaffNewPin,
  setEditStaffNewPin,
  editStaffActive,
  setEditStaffActive,
  editStaffError,
  isStaffSubmitting,
  handleSaveEditStaff,
  pinModalStaff,
  setPinModalStaff,
  targetPin,
  setTargetPin,
  pinModalError,
  isPinSubmitting,
  handleSavePin,
  deletingStaff,
  setDeletingStaff,
  handleConfirmDeleteStaff,
}) => {
  return (
    <>
      {/* ========================================================================= */}
      {/* IN-APP MODAL: EDIT STAFF DETAILS                                          */}
      {/* ========================================================================= */}
      {editingStaff && (
        <div role="dialog" aria-modal="true" aria-label="Edit staff details" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Edit Staff Details</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Update staff profile, phone number, and permissions</p>
              </div>
              <button aria-label="Close"
                type="button"
                onClick={() => setEditingStaff(null)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editStaffError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {editStaffError}
              </div>
            )}

            <form onSubmit={handleSaveEditStaff} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editStaffName}
                  onChange={(e) => setEditStaffName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3.5 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Phone / Login Identifier *
                </label>
                <input
                  type="text"
                  required
                  value={editStaffPhone}
                  onChange={(e) => setEditStaffPhone(e.target.value)}
                  placeholder="10-digit mobile number or login"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3.5 py-2 text-sm text-neutral-900 font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Default Assigned Vehicle / Warehouse
                </label>
                <input
                  type="text"
                  value={editStaffVehicle}
                  onChange={(e) => setEditStaffVehicle(e.target.value)}
                  placeholder="e.g. Van 1, Mobile Delivery Unit, Depot A"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3.5 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Invoice Series Code (Optional · 2–3 chars)
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={editStaffSeriesCode}
                  onChange={(e) =>
                    setEditStaffSeriesCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3))
                  }
                  placeholder="e.g. S1 or RK (used in per-salesman mode)"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3.5 py-2 text-sm text-neutral-900 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  New Security PIN (Optional)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={editStaffNewPin}
                  onChange={(e) => setEditStaffNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Leave blank to keep existing PIN"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3.5 py-2 text-sm text-neutral-900 font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Enter 4 to 6 digits only if resetting their login password/PIN.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <span
                  id="label-staff-active-toggle"
                  onClick={() => setEditStaffActive(!editStaffActive)}
                  className="text-xs font-medium text-neutral-700 cursor-pointer select-none"
                >
                  Account is Active (can log in and create sales orders)
                </span>
                <ToggleSwitch
                  id="staffActiveToggle"
                  size="sm"
                  checked={editStaffActive}
                  onChange={setEditStaffActive}
                  ariaLabelledBy="label-staff-active-toggle"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isStaffSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary)] rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isStaffSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IN-APP MODAL: DEDICATED SET PIN MODAL                                     */}
      {/* ========================================================================= */}
      {pinModalStaff && (
        <div role="dialog" aria-modal="true" aria-label="Set security PIN" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm bg-white rounded-2xl border border-neutral-200 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Set Security PIN</h3>
                  <p className="text-xs text-neutral-500 font-medium truncate max-w-[200px]">{pinModalStaff.name}</p>
                </div>
              </div>
              <button aria-label="Close"
                type="button"
                onClick={() => setPinModalStaff(null)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pinModalError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {pinModalError}
              </div>
            )}

            <form onSubmit={handleSavePin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Enter New PIN (4 to 6 digits) *
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  required
                  value={targetPin}
                  onChange={(e) => setTargetPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="e.g. 1234 or 987654"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-xl px-3.5 py-2.5 text-base text-center text-neutral-900 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                  {pinModalStaff.name} will sign in using phone <strong>{pinModalStaff.phone}</strong> and this PIN.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setPinModalStaff(null)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPinSubmitting || targetPin.length < 4}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-40"
                >
                  {isPinSubmitting ? 'Updating...' : 'Save PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IN-APP MODAL: CONFIRM DELETE STAFF                                        */}
      {/* ========================================================================= */}
      {deletingStaff && (
        <div role="dialog" aria-modal="true" aria-label="Remove staff member" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm bg-white rounded-2xl border border-neutral-200 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Remove Staff Member?</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Are you sure you want to remove <strong>{deletingStaff.name}</strong> from staff? Their historical trip and sales records will be preserved.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setDeletingStaff(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStaff}
                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
