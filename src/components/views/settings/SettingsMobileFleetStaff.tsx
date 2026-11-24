import React, { useState } from 'react';
import { ChevronLeft, Plus, Trash2, Truck, Warehouse as WarehouseIcon, X } from 'lucide-react';
import { Salesman, Warehouse } from '../../../types';
import { confirmDialog } from '../../../utils/dialogs';
import { ConfirmModal } from '../../ui';
import { getInitials } from '../../ui/HomeKit';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import { SettingsPhoneToast } from './SettingsPhoneToast';
import { SettingsSection } from './settingsTypes';

interface FleetMobileProps {
  setMobileSection: React.Dispatch<React.SetStateAction<SettingsSection | null>>;
  showMobileAddFleet: boolean;
  setShowMobileAddFleet: React.Dispatch<React.SetStateAction<boolean>>;
  mobileFleetDriver: string;
  setMobileFleetDriver: React.Dispatch<React.SetStateAction<string>>;
  newWhType: 'vehicle' | 'warehouse';
  setNewWhType: React.Dispatch<React.SetStateAction<'vehicle' | 'warehouse'>>;
  newWhName: string;
  setNewWhName: React.Dispatch<React.SetStateAction<string>>;
  newWhRegNo: string;
  setNewWhRegNo: React.Dispatch<React.SetStateAction<string>>;
  handleAddWarehouseOrVehicle: (e: React.FormEvent) => void;
  warehouses: Warehouse[];
  existingVehicles: string[];
  salesmen: Salesman[];
  deleteWarehouse: (id: string, reason?: string) => void;
  setTab: (tab: any) => void;
  isSaving: boolean;
  toastMessage: string | null;
  setToastMessage: React.Dispatch<React.SetStateAction<string | null>>;
}

export const SettingsFleetMobile: React.FC<FleetMobileProps> = ({
  setMobileSection,
  showMobileAddFleet,
  setShowMobileAddFleet,
  mobileFleetDriver,
  setMobileFleetDriver,
  newWhType,
  setNewWhType,
  newWhName,
  setNewWhName,
  newWhRegNo,
  setNewWhRegNo,
  handleAddWarehouseOrVehicle,
  warehouses,
  existingVehicles,
  salesmen,
  deleteWarehouse,
  setTab,
  isSaving,
  toastMessage,
  setToastMessage,
}) => {
  const [whToDelete, setWhToDelete] = useState<Warehouse | null>(null);
  if (showMobileAddFleet) {
    return (
      <div id="view-settings" className="rt-flow-phone">
        <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
          <div className="hh-sales-top__row">
            <button type="button" className="hh-inv-backbtn" onClick={() => setShowMobileAddFleet(false)}>
              <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
              <span>Add to fleet</span>
            </button>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            handleAddWarehouseOrVehicle(e);
            setShowMobileAddFleet(false);
            setMobileFleetDriver('');
          }}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="rt-flow-phone__body space-y-3">
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1.5">Type</div>
              <div className="hh-set-seg2">
                <button
                  type="button"
                  className="hh-set-seg2__btn"
                  aria-pressed={newWhType === 'warehouse'}
                  onClick={() => setNewWhType('warehouse')}
                >
                  Warehouse
                </button>
                <button
                  type="button"
                  className="hh-set-seg2__btn"
                  aria-pressed={newWhType === 'vehicle'}
                  onClick={() => setNewWhType('vehicle')}
                >
                  Vehicle
                </button>
              </div>
            </div>

            <label className="hh-inv-field hh-inv-field--focus">
              <span className="hh-inv-field__label">NAME</span>
              <input
                type="text"
                required
                value={newWhName}
                onChange={(e) => setNewWhName(e.target.value)}
                placeholder={newWhType === 'vehicle' ? 'Van 3' : 'Central Depot'}
              />
            </label>

            {newWhType === 'vehicle' && (
              <>
                <label className="hh-inv-field">
                  <span className="hh-inv-field__label">REG. NO.</span>
                  <input
                    type="text"
                    value={newWhRegNo}
                    onChange={(e) => setNewWhRegNo(e.target.value)}
                    placeholder="OD-02-CD-7788"
                    className="uppercase"
                  />
                </label>

                <label className="hh-inv-field">
                  <span className="hh-inv-field__label">DRIVER (OPTIONAL)</span>
                  <select
                    value={mobileFleetDriver}
                    onChange={(e) => setMobileFleetDriver(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {salesmen.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>

          <div className="hh-set-footer">
            <button
              type="submit"
              disabled={!newWhName.trim()}
              className="hh-inv-btn-primary w-full"
            >
              {newWhType === 'warehouse' ? 'Add warehouse' : 'Add vehicle'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  const warehouseLocations = warehouses.filter(
    (wh) => !(wh.notes?.includes('Vehicle') || wh.location.includes('Van') || wh.name.toLowerCase().includes('van')),
  );
  const vehicleLocations = warehouses.filter(
    (wh) => wh.notes?.includes('Vehicle') || wh.location.includes('Van') || wh.name.toLowerCase().includes('van'),
  );

  return (
    <div id="view-settings" className="rt-flow-phone">
      <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
        <div className="hh-sales-top__row">
          <button type="button" className="hh-inv-backbtn" onClick={() => setMobileSection(null)}>
            <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
            <span>Fleet</span>
          </button>
          <button
            type="button"
            className="hh-sales-top__iconbtn"
            aria-label="Add to fleet"
            onClick={() => setShowMobileAddFleet(true)}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="rt-flow-phone__body space-y-4 hh-inv-pb">
        <div>
          <div className="hh-set-section-lbl">WAREHOUSES</div>
          <div className="hh-set-list">
            {warehouseLocations.length === 0 ? (
              <div className="p-4 text-xs text-slate-500 text-center">No warehouses added yet.</div>
            ) : (
              warehouseLocations.map((wh) => (
                <div
                  key={wh.id}
                  onClick={() => setTab('warehouses')}
                  className="hh-set-row"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setTab('warehouses'); }}
                >
                  <span className="hh-set-icon bg-amber-50 text-amber-700">
                    <WarehouseIcon size={17} aria-hidden="true" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-slate-900 truncate">{wh.name}</div>
                    <div className="text-xs text-slate-500 font-mono truncate">
                      {wh.code}{wh.isDefault ? ' · default' : ''}
                    </div>
                  </div>
                  <span className="hh-set-badge-green shrink-0">Active</span>
                </div>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => setTab('warehouses')}
            className="mt-2 text-xs font-bold text-[#2864d9] px-1 cursor-pointer"
          >
            Open Godowns &amp; capacity →
          </button>
        </div>

        <div>
          <div className="hh-set-section-lbl">VEHICLES</div>
          <div className="hh-set-list">
            {vehicleLocations.length === 0 && existingVehicles.filter((v) => !warehouses.some((w) => w.name.includes(v))).length === 0 ? (
              <div className="p-4 text-xs text-slate-500 text-center">No vehicles added yet. Tap + to add one.</div>
            ) : (
              <>
                {vehicleLocations.map((wh) => {
                  const driver = salesmen.find((s) => (s.defaultVehicle || s.default_vehicle || '').includes(wh.name))?.name || wh.manager;
                  return (
                    <div key={wh.id} className="hh-set-row !cursor-default">
                      <span className="hh-set-icon bg-orange-50 text-orange-600">
                        <Truck size={17} aria-hidden="true" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-extrabold text-slate-900 truncate">{wh.name}</div>
                        <div className="text-xs text-slate-500 truncate">{driver || wh.code}</div>
                      </div>
                      <span className="hh-set-badge-green shrink-0">Active</span>
                      {warehouses.length > 1 && !wh.isDefault && (
                        <button
                          type="button"
                          aria-label={`Delete ${wh.name}`}
                          onClick={() => setWhToDelete(wh)}
                          className="p-1 text-slate-400 hover:text-rose-600 shrink-0 cursor-pointer"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {existingVehicles
                  .filter((v) => !warehouses.some((w) => w.name.includes(v)))
                  .map((vehName, idx) => {
                    const driver = salesmen.find((s) => (s.defaultVehicle || s.default_vehicle) === vehName)?.name;
                    return (
                      <div key={`veh-${idx}`} className="hh-set-row !cursor-default">
                        <span className="hh-set-icon bg-orange-50 text-orange-600">
                          <Truck size={17} aria-hidden="true" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-extrabold text-slate-900 truncate">{vehName}</div>
                          {driver && <div className="text-xs text-slate-500 truncate">{driver}</div>}
                        </div>
                        <span className="hh-set-badge-green shrink-0">Active</span>
                      </div>
                    );
                  })}
              </>
            )}
          </div>
        </div>
      </div>

      <SettingsPhoneToast isSaving={isSaving} toastMessage={toastMessage} />

      <ConfirmModal
        isOpen={Boolean(whToDelete)}
        onClose={() => setWhToDelete(null)}
        variant="danger"
        title={whToDelete ? `Delete ${whToDelete.name}?` : 'Delete location?'}
        message="This removes it from the registry and logs the action. Past bills and stock history are preserved."
        rectificationPrompt="Reason for removing *"
        rectificationPlaceholder="e.g. Retired vehicle, sold van, duplicate entry"
        reasonPresets={['Retired vehicle', 'Duplicate entry', 'Closed facility', 'Test entry']}
        commentMinLength={4}
        confirmButtonLabel="Yes, Delete"
        onConfirm={() => {}}
        onConfirmWithComment={(reason) => {
          if (whToDelete) {
            const nm = whToDelete.name;
            deleteWarehouse(whToDelete.id, reason);
            setWhToDelete(null);
            setToastMessage(`Removed ${nm}`);
            setTimeout(() => setToastMessage(null), 3000);
          }
        }}
      />
    </div>
  );
};

interface StaffMobileProps {
  setMobileSection: React.Dispatch<React.SetStateAction<SettingsSection | null>>;
  salesmen: Salesman[];
  salesmanSeriesCodes?: Record<string, string>;
  ownerLabel: string;
  ownerSub: string;
  logout?: () => void;
  existingVehicles: string[];
  showMobileAddStaff: boolean;
  setShowMobileAddStaff: React.Dispatch<React.SetStateAction<boolean>>;
  mobileStaffRole: 'admin' | 'salesman';
  setMobileStaffRole: React.Dispatch<React.SetStateAction<'admin' | 'salesman'>>;
  newStaffIdentifier: string;
  setNewStaffIdentifier: React.Dispatch<React.SetStateAction<string>>;
  newStaffPin: string;
  setNewStaffPin: React.Dispatch<React.SetStateAction<string>>;
  newStaffRole: 'driver' | 'salesman' | 'manager' | 'accountant' | 'admin';
  setNewStaffRole: React.Dispatch<React.SetStateAction<'driver' | 'salesman' | 'manager' | 'accountant' | 'admin'>>;
  handleAddStaffMember: (e: React.FormEvent) => Promise<boolean>;

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
  handleOpenEditStaff: (staff: Salesman) => void;
  handleSaveEditStaff: (e: React.FormEvent) => Promise<void>;

  pinModalStaff: Salesman | null;
  setPinModalStaff: React.Dispatch<React.SetStateAction<Salesman | null>>;
  targetPin: string;
  setTargetPin: React.Dispatch<React.SetStateAction<string>>;
  pinModalError: string | null;
  isPinSubmitting: boolean;
  handleOpenSetPin: (staff: Salesman) => void;
  handleSavePin: (e: React.FormEvent) => Promise<void>;

  deletingStaff: Salesman | null;
  setDeletingStaff: React.Dispatch<React.SetStateAction<Salesman | null>>;
  handleConfirmDeleteStaff: () => Promise<void>;

  isSaving: boolean;
  toastMessage: string | null;
}

export const SettingsStaffMobile: React.FC<StaffMobileProps> = ({
  setMobileSection,
  salesmen,
  salesmanSeriesCodes,
  ownerLabel,
  ownerSub,
  logout,
  existingVehicles,
  showMobileAddStaff,
  setShowMobileAddStaff,
  mobileStaffRole,
  setMobileStaffRole,
  newStaffIdentifier,
  setNewStaffIdentifier,
  newStaffPin,
  setNewStaffPin,
  newStaffRole,
  setNewStaffRole,
  handleAddStaffMember,
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
  handleOpenEditStaff,
  handleSaveEditStaff,
  pinModalStaff,
  setPinModalStaff,
  targetPin,
  setTargetPin,
  pinModalError,
  isPinSubmitting,
  handleOpenSetPin,
  handleSavePin,
  deletingStaff,
  setDeletingStaff,
  handleConfirmDeleteStaff,
  isSaving,
  toastMessage,
}) => {
  if (pinModalStaff) {
    return (
      <div id="view-settings" className="rt-flow-phone">
        <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
          <div className="hh-sales-top__row">
            <button type="button" className="hh-inv-backbtn" onClick={() => setPinModalStaff(null)}>
              <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
              <span>Set PIN</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSavePin} className="flex flex-col flex-1 min-h-0">
          <div className="rt-flow-phone__body pt-6 text-center space-y-5">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Set security PIN</h2>
              <p className="text-xs text-slate-500 mt-0.5">for {pinModalStaff.name}</p>
            </div>

            {pinModalError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold text-left">
                {pinModalError}
              </div>
            )}

            <div className="hh-set-pin-wrap">
              {[0, 1, 2, 3, 4, 5].map((idx) => {
                const filled = idx < targetPin.length;
                const activeSlot = idx === Math.min(targetPin.length, 5);
                return (
                  <div
                    key={idx}
                    className={`hh-set-pin-box ${activeSlot ? 'hh-set-pin-box--active' : ''}`}
                    aria-hidden="true"
                  >
                    {filled ? '•' : ''}
                  </div>
                );
              })}
              <input
                type="tel"
                inputMode="numeric"
                autoFocus
                maxLength={6}
                aria-label="Enter 4 to 6 digit security PIN"
                value={targetPin}
                onChange={(e) => setTargetPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-text"
              />
            </div>

            <p className="text-xs text-slate-500">
              PIN (4–6 digits), e.g. 1234 or 987654
            </p>
          </div>

          <div className="hh-set-footer">
            <button
              type="submit"
              disabled={isPinSubmitting || targetPin.length < 4}
              className="hh-inv-btn-primary w-full"
            >
              {isPinSubmitting ? 'Saving PIN...' : 'Save PIN'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (editingStaff) {
    return (
      <div id="view-settings" className="rt-flow-phone">
        <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
          <div className="hh-sales-top__row">
            <button type="button" className="hh-inv-backbtn" onClick={() => setEditingStaff(null)}>
              <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
              <span>Edit staff details</span>
            </button>
            <button
              type="button"
              className="hh-sales-top__iconbtn"
              aria-label={`Remove ${editingStaff.name}`}
              onClick={() => setDeletingStaff(editingStaff)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveEditStaff} className="flex flex-col flex-1 min-h-0">
          <div className="rt-flow-phone__body space-y-3">
            {editStaffError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
                {editStaffError}
              </div>
            )}

            <label className="hh-inv-field hh-inv-field--focus">
              <span className="hh-inv-field__label">NAME</span>
              <input
                type="text"
                required
                value={editStaffName}
                onChange={(e) => setEditStaffName(e.target.value)}
                placeholder="e.g. Sunil Das"
              />
            </label>

            <label className="hh-inv-field">
              <span className="hh-inv-field__label">LOGIN (EMAIL OR 10-DIGIT MOBILE)</span>
              <input
                type="text"
                required
                value={editStaffPhone}
                onChange={(e) => setEditStaffPhone(e.target.value)}
                placeholder="10-digit mobile number"
              />
            </label>

            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1.5">Role</div>
              <div className="hh-set-seg2">
                <button
                  type="button"
                  className="hh-set-seg2__btn"
                  aria-pressed={mobileStaffRole === 'admin'}
                  onClick={() => setMobileStaffRole('admin')}
                >
                  Admin
                </button>
                <button
                  type="button"
                  className="hh-set-seg2__btn"
                  aria-pressed={mobileStaffRole === 'salesman'}
                  onClick={() => setMobileStaffRole('salesman')}
                >
                  Salesman
                </button>
              </div>
            </div>

            <label className="hh-inv-field">
              <span className="hh-inv-field__label">VEHICLE</span>
              <input
                type="text"
                list="mobile-staff-vehicles"
                value={editStaffVehicle}
                onChange={(e) => setEditStaffVehicle(e.target.value)}
                placeholder="e.g. Van 1"
              />
              <datalist id="mobile-staff-vehicles">
                {existingVehicles.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </label>

            <label className="hh-inv-field">
              <span className="hh-inv-field__label">SERIES CODE (2–3 CHARS, OPTIONAL)</span>
              <input
                type="text"
                maxLength={3}
                value={editStaffSeriesCode}
                onChange={(e) =>
                  setEditStaffSeriesCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3))
                }
                placeholder="e.g. S1 or RK"
                className="uppercase font-mono"
              />
            </label>

            <label className="hh-inv-field">
              <span className="hh-inv-field__label">PIN</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={editStaffNewPin}
                onChange={(e) => setEditStaffNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Leave blank to keep existing PIN"
              />
            </label>

            <div className="flex items-center justify-between gap-3 py-1 px-0.5">
              <span
                id="m-staff-active-lbl"
                onClick={() => setEditStaffActive(!editStaffActive)}
                className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
              >
                Account is Active (can sign in)
              </span>
              <ToggleSwitch
                id="m-staffActiveToggle"
                size="sm"
                checked={editStaffActive}
                onChange={setEditStaffActive}
                ariaLabelledBy="m-staff-active-lbl"
              />
            </div>
          </div>

          <div className="hh-set-footer grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleOpenSetPin(editingStaff)}
              className="hh-inv-btn-outline"
            >
              Set PIN
            </button>
            <button
              type="submit"
              disabled={isStaffSubmitting}
              className="hh-inv-btn-primary"
            >
              {isStaffSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>

        {deletingStaff && (
          <div className="rt-bsheet-scrim" role="dialog" aria-modal="true" aria-label="Remove staff member" onClick={() => setDeletingStaff(null)}>
            <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
              <div className="hh-grab" aria-hidden="true" />
              <h3 className="text-base font-extrabold text-rose-600">Remove staff member?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {deletingStaff.name} will no longer be able to sign in. Past bills stay as they are.
              </p>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button type="button" className="hh-inv-btn-outline" onClick={() => setDeletingStaff(null)}>
                  Keep
                </button>
                <button
                  type="button"
                  className="hh-inv-btn-danger"
                  onClick={async () => {
                    await handleConfirmDeleteStaff();
                    setEditingStaff(null);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (showMobileAddStaff) {
    return (
      <div id="view-settings" className="rt-flow-phone">
        <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
          <div className="hh-sales-top__row">
            <button type="button" className="hh-inv-backbtn" onClick={() => setShowMobileAddStaff(false)}>
              <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
              <span>Add staff member</span>
            </button>
          </div>
        </div>

        <form
          onSubmit={async (e) => {
            const ok = await handleAddStaffMember(e);
            if (ok) setShowMobileAddStaff(false);
          }}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="rt-flow-phone__body space-y-3">
            <label className="hh-inv-field hh-inv-field--focus">
              <span className="hh-inv-field__label">LOGIN (EMAIL OR 10-DIGIT MOBILE)</span>
              <input
                type="text"
                required
                value={newStaffIdentifier}
                onChange={(e) => setNewStaffIdentifier(e.target.value)}
                placeholder="9437012345"
              />
            </label>

            <label className="hh-inv-field">
              <span className="hh-inv-field__label">PIN (4–6 DIGITS)</span>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                value={newStaffPin}
                onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="e.g. 1234 or 987654"
              />
            </label>

            <label className="hh-inv-field">
              <span className="hh-inv-field__label">ROLE</span>
              <select
                value={newStaffRole}
                onChange={(e) => setNewStaffRole(e.target.value as 'driver' | 'salesman' | 'manager' | 'accountant' | 'admin')}
                className="capitalize"
              >
                <option value="driver">Driver</option>
                <option value="salesman">Salesman</option>
                <option value="manager">Manager</option>
                <option value="accountant">Accountant</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>

          <div className="hh-set-footer">
            <button
              type="submit"
              disabled={!newStaffIdentifier.trim() || newStaffPin.length < 4}
              className="hh-inv-btn-primary w-full"
            >
              Add staff
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div id="view-settings" className="rt-flow-phone">
      <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
        <div className="hh-sales-top__row">
          <button type="button" className="hh-inv-backbtn" onClick={() => setMobileSection(null)}>
            <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
            <span>Staff</span>
          </button>
          <button
            type="button"
            className="hh-sales-top__iconbtn"
            aria-label="Add staff member"
            onClick={() => setShowMobileAddStaff(true)}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="rt-flow-phone__body space-y-2.5 hh-inv-pb">
        <div className="hh-inv-card flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="size-10 rounded-full bg-slate-100 text-slate-700 font-extrabold text-sm flex items-center justify-center shrink-0">
              {getInitials(ownerLabel, 'O').charAt(0)}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-slate-900 truncate">{ownerLabel}</div>
              <div className="text-xs text-slate-500 truncate">{ownerSub}</div>
            </div>
          </div>
          <span className="hh-set-badge-green shrink-0">Admin</span>
        </div>

        {salesmen.map((salesman) => (
          <button
            key={salesman.id}
            type="button"
            onClick={() => {
              setMobileStaffRole('salesman');
              handleOpenEditStaff(salesman);
            }}
            className="hh-inv-card w-full flex items-center justify-between gap-3 text-left cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="size-10 rounded-full bg-slate-100 text-slate-700 font-extrabold text-sm flex items-center justify-center shrink-0">
                {getInitials(salesman.name || 'S', 'S').charAt(0)}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-extrabold text-slate-900 truncate">{salesman.name}</span>
                  {!salesman.active && <span className="hh-set-badge-slate">Off</span>}
                  {(salesmanSeriesCodes?.[salesman.id] || salesman.seriesCode) && (
                    <span className="hh-set-badge-blue font-mono">
                      {salesmanSeriesCodes?.[salesman.id] || salesman.seriesCode}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 tabular-nums truncate">
                  {salesman.phone}
                </div>
              </div>
            </div>
            <span className="hh-set-badge-blue shrink-0">Salesman</span>
          </button>
        ))}

        <div className="pt-1">
          <button
            type="button"
            onClick={async () => {
              const ok = await confirmDialog({
                title: 'Log out?',
                message: 'You will need to sign in again.',
                confirmLabel: 'Log out',
                tone: 'warning',
              });
              if (ok && typeof logout === 'function') logout();
            }}
            className="hh-set-btn-danger-outline w-full"
          >
            Sign out
          </button>
        </div>
      </div>

      <SettingsPhoneToast isSaving={isSaving} toastMessage={toastMessage} />

      {deletingStaff && (
        <div className="rt-bsheet-scrim" role="dialog" aria-modal="true" aria-label="Remove staff member" onClick={() => setDeletingStaff(null)}>
          <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
            <div className="hh-grab" aria-hidden="true" />
            <h3 className="text-base font-extrabold text-rose-600">Remove staff member?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {deletingStaff.name} will no longer be able to sign in. Past bills stay as they are.
            </p>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button type="button" className="hh-inv-btn-outline" onClick={() => setDeletingStaff(null)}>
                Keep
              </button>
              <button
                type="button"
                className="hh-inv-btn-danger"
                onClick={handleConfirmDeleteStaff}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
