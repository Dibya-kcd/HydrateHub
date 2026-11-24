import React, { useState } from 'react';
import { ChevronDown, Key, LogOut, Pencil, Trash2, Truck, Users, Warehouse as WarehouseIcon, X } from 'lucide-react';
import { Salesman, Warehouse } from '../../../types';
import { confirmDialog } from '../../../utils/dialogs';
import { ConfirmModal } from '../../ui';
import { getInitials } from '../../ui/HomeKit';
import { ProfileFormState } from './settingsTypes';

interface FleetDesktopProps {
  warehouses: Warehouse[];
  existingVehicles: string[];
  deleteWarehouse: (id: string, reason?: string) => void;
  setToastMessage: React.Dispatch<React.SetStateAction<string | null>>;
  newWhName: string;
  setNewWhName: React.Dispatch<React.SetStateAction<string>>;
  newWhType: 'vehicle' | 'warehouse';
  setNewWhType: React.Dispatch<React.SetStateAction<'vehicle' | 'warehouse'>>;
  newWhRegNo: string;
  setNewWhRegNo: React.Dispatch<React.SetStateAction<string>>;
  handleAddWarehouseOrVehicle: (e: React.FormEvent) => void;
}

export const SettingsFleetDesktop: React.FC<FleetDesktopProps> = ({
  warehouses,
  existingVehicles,
  deleteWarehouse,
  setToastMessage,
  newWhName,
  setNewWhName,
  newWhType,
  setNewWhType,
  newWhRegNo,
  setNewWhRegNo,
  handleAddWarehouseOrVehicle,
}) => {
  const [whToDelete, setWhToDelete] = useState<Warehouse | null>(null);
  return (
  <div data-card-tone="warning" className="rounded-2xl border p-3.5 sm:p-6 shadow-xs">
    <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-black/5">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--amber shrink-0">
          <WarehouseIcon className="w-4 h-4" />
        </span>
        <h2 className="text-base sm:text-lg font-extrabold text-neutral-900 truncate">Warehouses &amp; vehicles</h2>
      </div>
      <span className="text-xs text-amber-900 bg-white/80 border border-black/5 px-2.5 py-0.5 rounded-full font-bold font-mono shrink-0">
        {warehouses.length} loc · {existingVehicles.length} veh
      </span>
    </div>

    {/* Live List from Database */}
    <div className="space-y-2 mb-5">
      {warehouses.map((wh) => {
        const isVeh = wh.notes?.includes('Vehicle') || wh.location.includes('Van') || wh.name.toLowerCase().includes('van');
        return (
          <div
            key={wh.id}
            className="rounded-xl bg-white/85 border border-black/5 px-3 py-2.5 flex items-center justify-between gap-2 group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`hh-icon-badge hh-icon-badge--sm shrink-0 ${isVeh ? 'hh-icon-badge--amber' : 'hh-icon-badge--blue'}`}>
                {isVeh ? <Truck className="w-4 h-4" /> : <WarehouseIcon className="w-4 h-4" />}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-neutral-900 break-words">{wh.name}</span>
                  {wh.isDefault && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 font-bold">
                      Default
                    </span>
                  )}
                </div>
                <span className="text-xs text-neutral-500 font-mono">
                  {isVeh ? `vehicle ${wh.code || ''}` : 'warehouse'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {warehouses.length > 1 && !wh.isDefault && (
                <button
                  type="button"
                  onClick={() => setWhToDelete(wh)}
                  className="text-neutral-400 hover:text-rose-600 transition-colors p-2 -m-1 cursor-pointer"
                  title="Remove from database"
                  aria-label={`Delete ${wh.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Display vehicles from trips if not covered in warehouses */}
      {existingVehicles
        .filter((v) => !warehouses.some((w) => w.name.includes(v)))
        .map((vehName, idx) => (
          <div
            key={'veh-' + idx}
            className="rounded-xl bg-white/85 border border-black/5 px-3 py-2.5 flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--amber shrink-0">
                <Truck className="w-4 h-4" />
              </span>
              <span className="text-sm font-bold text-neutral-900 truncate">{vehName}</span>
            </div>
            <span className="text-xs text-neutral-500 font-mono shrink-0">vehicle</span>
          </div>
        ))}
    </div>

    {/* Add New Warehouse / Vehicle Form */}
    <form onSubmit={handleAddWarehouseOrVehicle} className="pt-2 border-t border-neutral-100">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          type="text"
          placeholder="Name"
          value={newWhName}
          onChange={(e) => setNewWhName(e.target.value)}
          className="bg-white border border-neutral-300 rounded-xl px-3.5 py-2 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-xs"
        />

        <div className="relative">
          <select
            value={newWhType}
            onChange={(e) => setNewWhType(e.target.value as 'vehicle' | 'warehouse')}
            className="w-full bg-white border border-neutral-300 rounded-xl px-3.5 py-2 text-sm text-neutral-800 appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-xs cursor-pointer"
          >
            <option value="vehicle">Vehicle</option>
            <option value="warehouse">Warehouse</option>
          </select>
          <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <input
          type="text"
          placeholder="Reg. no."
          value={newWhRegNo}
          onChange={(e) => setNewWhRegNo(e.target.value)}
          disabled={newWhType === 'warehouse'}
          className="bg-white border border-neutral-300 rounded-xl px-3.5 py-2 text-sm text-neutral-800 uppercase placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-xs disabled:bg-neutral-100 disabled:opacity-60"
        />
      </div>

      <button
        type="submit"
        disabled={!newWhName.trim()}
        className="w-full mt-3 py-2 border border-neutral-300 rounded-xl text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 transition-colors cursor-pointer shadow-xs disabled:opacity-40"
      >
        Add
      </button>
    </form>

    <ConfirmModal
      isOpen={Boolean(whToDelete)}
      onClose={() => setWhToDelete(null)}
      variant="danger"
      title={whToDelete ? `Delete ${whToDelete.name}?` : 'Delete location?'}
      message="This removes it from the registry and logs the action. Bills and stock already recorded are preserved."
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

interface StaffDesktopProps {
  salesmen: Salesman[];
  salesmanSeriesCodes?: Record<string, string>;
  currentUser: { username?: string; email?: string; role?: string } | null;
  profileForm: ProfileFormState;
  logout?: () => void;
  toggleSalesmanActive: (id: string) => void;
  handleOpenEditStaff: (staff: Salesman) => void;
  handleOpenSetPin: (staff: Salesman) => void;
  setDeletingStaff: React.Dispatch<React.SetStateAction<Salesman | null>>;
  newStaffIdentifier: string;
  setNewStaffIdentifier: React.Dispatch<React.SetStateAction<string>>;
  newStaffPin: string;
  setNewStaffPin: React.Dispatch<React.SetStateAction<string>>;
  newStaffRole: 'driver' | 'salesman' | 'manager' | 'accountant' | 'admin';
  setNewStaffRole: React.Dispatch<React.SetStateAction<'driver' | 'salesman' | 'manager' | 'accountant' | 'admin'>>;
  handleAddStaffMember: (e: React.FormEvent) => Promise<boolean>;
}

export const SettingsStaffDesktop: React.FC<StaffDesktopProps> = ({
  salesmen,
  salesmanSeriesCodes,
  currentUser,
  profileForm,
  logout,
  toggleSalesmanActive,
  handleOpenEditStaff,
  handleOpenSetPin,
  setDeletingStaff,
  newStaffIdentifier,
  setNewStaffIdentifier,
  newStaffPin,
  setNewStaffPin,
  newStaffRole,
  setNewStaffRole,
  handleAddStaffMember,
}) => (
  <div className="space-y-3">
    {/* Section Header Card */}
    <div data-card-tone="profit" className="rounded-2xl border p-4 shadow-xs flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="hh-icon-badge hh-icon-badge--purple shrink-0">
          <Users className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900">Staff &amp; roles</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Manage owner access, salesman login numbers, and PINs.
          </p>
        </div>
      </div>
      <span className="px-2.5 py-1 rounded-full bg-white/85 border border-black/5 text-xs font-bold text-purple-900 tabular-nums shrink-0">
        {salesmen.length + 1} members
      </span>
    </div>

    {/* Authenticated Owner / Admin Card */}
    {(() => {
      const ownerLabel = currentUser?.username || profileForm.ownerName || 'dibyaprakashkcd5';
      const ownerEmail =
        currentUser && 'email' in currentUser
          ? currentUser.email
          : profileForm.email || 'dibyaprakashkcd5@gmail.com';
      return (
        <div
          data-card-tone="profit"
          className="rounded-2xl border p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="hh-avatar hh-avatar--purple shrink-0">
              {getInitials(ownerLabel, 'O')}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <span className="text-[15px] font-extrabold text-slate-900 truncate">
                  {ownerLabel}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-100/90 text-purple-800 text-xs font-bold uppercase tracking-wide shrink-0">
                  Owner
                </span>
              </div>
              <span className="text-xs text-slate-600 block mt-0.5 truncate">
                {ownerEmail}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 sm:self-center">
            <button
              type="button"
              onClick={async () => {
                const ok = await confirmDialog({ title: 'Log out?', message: 'You will need to sign in again.', confirmLabel: 'Log out', tone: 'warning' });
                if (ok && typeof logout === 'function') logout();
              }}
              className="min-h-[38px] px-3.5 rounded-xl border border-rose-200 bg-white/90 hover:bg-rose-50 text-rose-700 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
              title="Sign out of account"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      );
    })()}

    {/* Database Salesmen & Staff Cards */}
    {salesmen.map((salesman) => (
      <div
        key={salesman.id}
        data-card-tone={salesman.active ? 'received' : 'neutral'}
        className="rounded-2xl border p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`hh-avatar shrink-0 ${salesman.active ? 'hh-avatar--green' : 'hh-avatar--slate'}`}>
            {getInitials(salesman.name || 'S', 'S')}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="text-[15px] font-extrabold text-slate-900 truncate">
                {salesman.name}
              </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide shrink-0 ${
                    salesman.active
                      ? 'bg-emerald-100/90 text-emerald-800'
                      : 'bg-rose-100/90 text-rose-800'
                  }`}
                >
                  {salesman.active ? 'Active' : 'Inactive'}
                </span>
                {(salesmanSeriesCodes?.[salesman.id] || salesman.seriesCode) && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold uppercase bg-sky-50 text-sky-800 border border-sky-200 shrink-0">
                    Series: {salesmanSeriesCodes?.[salesman.id] || salesman.seriesCode}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-600 mt-0.5 tabular-nums truncate font-medium">
                {salesman.phone}
                {salesman.defaultVehicle ? ` · ${salesman.defaultVehicle}` : ''}
              </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-2 sm:pt-0 border-t border-black/5 sm:border-t-0 shrink-0">
          <button
            type="button"
            onClick={() => toggleSalesmanActive(salesman.id)}
            className={`min-h-[36px] px-3 rounded-xl border text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
              salesman.active
                ? 'border-black/10 bg-white/90 text-slate-700 hover:bg-white'
                : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
            title="Toggle active status"
          >
            {salesman.active ? 'Switch off' : 'Switch on'}
          </button>

          <button
            type="button"
            onClick={() => handleOpenEditStaff(salesman)}
            className="min-h-[36px] px-3 rounded-xl border border-black/10 bg-white/90 hover:bg-white text-slate-700 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
            title="Edit staff details"
          >
            <Pencil className="w-3 h-3 text-slate-500 shrink-0" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenSetPin(salesman)}
            className="min-h-[36px] px-3 rounded-xl border border-emerald-300 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors"
            title="Set or reset this person's login PIN"
          >
            <Key className="w-3 h-3 shrink-0" />
            <span>Set PIN</span>
          </button>

          <button
            type="button"
            onClick={() => setDeletingStaff(salesman)}
            className="ml-auto sm:ml-0 size-9 rounded-xl border border-transparent text-slate-400 hover:text-rose-600 hover:bg-white/90 inline-flex items-center justify-center cursor-pointer transition-colors shrink-0"
            title="Remove staff member"
            aria-label={`Remove ${salesman.name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    ))}

    {/* Add Staff Member Form Card */}
    <div data-card-tone="sales" className="rounded-2xl border p-4 sm:p-5 shadow-xs">
      <div className="text-xs font-bold uppercase tracking-wider text-blue-900 mb-3">Add staff member</div>
      <form onSubmit={handleAddStaffMember} className="flex flex-col sm:flex-row gap-2.5">
        <input
          type="text"
          placeholder="Email or mobile number"
          value={newStaffIdentifier}
          onChange={(e) => setNewStaffIdentifier(e.target.value)}
          className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/25 shadow-2xs"
        />

        <div className="grid grid-cols-2 sm:flex gap-2.5">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            placeholder="PIN (4-6 digits)"
            value={newStaffPin}
            onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full sm:w-32 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/25 shadow-2xs"
          />

          <div className="relative w-full sm:w-32">
            <select
              value={newStaffRole}
              onChange={(e) => setNewStaffRole(e.target.value as 'driver' | 'salesman' | 'manager' | 'accountant' | 'admin')}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/25 shadow-2xs cursor-pointer capitalize"
            >
              <option value="driver">driver</option>
              <option value="salesman">salesman</option>
              <option value="manager">manager</option>
              <option value="accountant">accountant</option>
              <option value="admin">admin</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <button
          type="submit"
          disabled={!newStaffIdentifier.trim() || newStaffPin.length < 4}
          className="bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer shadow-xs disabled:opacity-40 whitespace-nowrap shrink-0"
        >
          Add staff
        </button>
      </form>
    </div>
  </div>
);
