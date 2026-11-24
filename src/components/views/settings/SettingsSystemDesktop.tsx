import React from 'react';
import { Cloud, Database, Download, Eye, Upload } from 'lucide-react';
import { FontSize } from '../../../types';
import { AVATAR_IDS, AvatarId, writeAvatar } from '../../../utils/avatar';
import { confirmDialog } from '../../../utils/dialogs';
import { UserAvatar } from '../../common/UserAvatar';
import { ToggleSwitch } from '../../ui/ToggleSwitch';

interface DisplayDesktopProps {
  t: (key: string, vars?: Record<string, string | number>) => string;
  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
  avatarId: AvatarId;
  orgName?: string;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  lowVisionMode: boolean;
  toggleLowVisionMode: () => void;
}

export const SettingsDisplayDesktop: React.FC<DisplayDesktopProps> = ({
  t,
  fontSize,
  setFontSize,
  avatarId,
  orgName,
  highContrast,
  setHighContrast,
  lowVisionMode,
  toggleLowVisionMode,
}) => (
  <div data-card-tone="sales" className="rounded-2xl border p-3.5 sm:p-6 shadow-xs space-y-5">
    <div className="flex items-center gap-2.5 pb-3 border-b border-black/5">
      <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--blue shrink-0">
        <Eye className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-extrabold text-neutral-900">{t('settings.display.title')}</h2>
        <p className="hidden sm:block text-xs text-neutral-600 mt-0.5">
          {t('settings.display.subtitle')}
        </p>
      </div>
    </div>

    {/* Font Scale Buttons */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {[
        { id: 'standard' as FontSize, title: t('settings.display.fontStandard'), desc: t('settings.display.fontStandardDesc') },
        { id: 'large' as FontSize, title: t('settings.display.fontLarge'), desc: t('settings.display.fontLargeDesc') },
        { id: 'xlarge' as FontSize, title: t('settings.display.fontXLarge'), desc: t('settings.display.fontXLargeDesc') },
      ].map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setFontSize(opt.id)}
          className={`p-3.5 border rounded-xl text-left transition-all cursor-pointer ${
            fontSize === opt.id
              ? 'border-[var(--primary)] bg-emerald-50/50 text-[var(--primary)] ring-1 ring-[var(--primary)]'
              : 'border-neutral-200 hover:border-neutral-300 text-neutral-700 bg-white'
          }`}
        >
          <div className="text-sm font-bold">{opt.title}</div>
          <div className="text-xs text-neutral-500 mt-0.5">{opt.desc}</div>
        </button>
      ))}
    </div>

    {/* Avatar (replaces the initial letter in the profile badge) */}
    <div className="pt-2 border-t border-neutral-100">
      <span className="text-sm font-semibold text-neutral-800 block">Profile avatar</span>
      <span className="text-xs text-neutral-500 block mb-2">Shown in the top bar and menu instead of a letter.</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Profile avatar">
        {AVATAR_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={avatarId === id}
            aria-label={id === 'initial' ? 'Use initial letter' : id === 'admin' ? 'Admin Person Avatar' : id === 'user' ? 'Person Avatar' : id}
            title={id === 'admin' ? 'Admin Person Avatar (Recommended)' : id === 'user' ? 'Person Avatar' : id}
            onClick={() => writeAvatar(id)}
            className={`size-11 rounded-xl flex items-center justify-center font-bold cursor-pointer transition-all ${
              avatarId === id
                ? 'bg-emerald-800 text-white ring-2 ring-offset-2 ring-emerald-800'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            <UserAvatar id={id} initial={(orgName || 'H').charAt(0).toUpperCase()} size={20} />
          </button>
        ))}
      </div>
    </div>

    {/* Accessibility Switches */}
    <div className="pt-2 border-t border-neutral-100 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div
          id="label-settings-high-contrast"
          onClick={() => setHighContrast(!highContrast)}
          className="cursor-pointer select-none"
        >
          <span className="text-sm font-semibold text-neutral-800 block">{t('settings.display.highContrast')}</span>
          <span className="text-xs text-neutral-500">{t('settings.display.highContrastDesc')}</span>
        </div>
        <ToggleSwitch
          id="toggle-settings-high-contrast"
          checked={highContrast}
          onChange={setHighContrast}
          ariaLabelledBy="label-settings-high-contrast"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div
          id="label-settings-easy-view"
          onClick={toggleLowVisionMode}
          className="cursor-pointer select-none"
        >
          <span className="text-sm font-semibold text-neutral-800 block">{t('settings.display.easyView')}</span>
          <span className="text-xs text-neutral-500">{t('settings.display.easyViewDesc')}</span>
        </div>
        <ToggleSwitch
          id="toggle-settings-easy-view"
          checked={lowVisionMode}
          onChange={() => toggleLowVisionMode()}
          ariaLabelledBy="label-settings-easy-view"
        />
      </div>
    </div>
  </div>
);

interface CloudDesktopProps {
  supabaseConfig: { projectRef: string };
  supabaseStatus: { isConnected: boolean; latencyMs: number };
  syncToCloud: (opts?: { full?: boolean }) => Promise<{ message: string }>;
  checkSupabaseConnection: () => Promise<any>;
  setToastMessage: React.Dispatch<React.SetStateAction<string | null>>;
}

export const SettingsCloudDesktop: React.FC<CloudDesktopProps> = ({
  supabaseConfig,
  supabaseStatus,
  syncToCloud,
  checkSupabaseConnection,
  setToastMessage,
}) => (
  <div
    data-card-tone={supabaseStatus.isConnected ? 'received' : 'warning'}
    className="rounded-2xl border p-3.5 sm:p-6 shadow-xs space-y-4"
  >
    <div className="flex items-center justify-between gap-2 pb-3 border-b border-black/5">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`hh-icon-badge hh-icon-badge--sm shrink-0 ${supabaseStatus.isConnected ? 'hh-icon-badge--green' : 'hh-icon-badge--amber'}`}>
          <Cloud className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-extrabold text-neutral-900 truncate">Database &amp; Cloud Sync</h2>
          <p className="hidden sm:block text-xs text-neutral-600 mt-0.5">
            Real-time PostgreSQL replication, offline resilience, and ledger state.
          </p>
        </div>
      </div>
      <span
        className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
          supabaseStatus.isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
        }`}
      >
        {supabaseStatus.isConnected ? 'Cloud Connected' : 'Offline Mode'}
      </span>
    </div>

    <div className="p-3.5 bg-white/85 rounded-xl border border-black/5 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-neutral-500">PostgreSQL Engine:</span>
        <span className="font-mono font-semibold text-neutral-800">Supabase Managed Database</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-neutral-500">Project Reference:</span>
        <span className="font-mono font-semibold text-neutral-800">{supabaseConfig.projectRef}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-neutral-500">Latency:</span>
        <span className="font-mono font-semibold text-neutral-800">{supabaseStatus.latencyMs}ms</span>
      </div>
    </div>

    <div className="flex flex-wrap gap-2.5 pt-1">
      <button
        type="button"
        onClick={async () => {
          setToastMessage('Sending changes to cloud...');
          const res = await syncToCloud();
          setToastMessage(res.message);
          setTimeout(() => setToastMessage(null), 3500);
        }}
        className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary)] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
      >
        <Cloud className="w-3.5 h-3.5" />
        <span>Push Changes to Cloud</span>
      </button>

      <button
        type="button"
        onClick={async () => {
          const ok = await confirmDialog({
            title: 'Re-send everything to the cloud?',
            message:
              'This rewrites every record and uses a lot of database activity. Only needed after restoring or changing the database. "Push Changes to Cloud" sends just what changed.',
            confirmLabel: 'Re-send everything',
            tone: 'warning',
          });
          if (!ok) return;
          setToastMessage('Re-sending everything to cloud...');
          const res = await syncToCloud({ full: true });
          setToastMessage(res.message);
          setTimeout(() => setToastMessage(null), 3500);
        }}
        className="px-2 py-2 text-xs font-semibold text-neutral-500 underline underline-offset-2 hover:text-neutral-800 cursor-pointer"
      >
        Re-send everything (rarely needed)
      </button>

      <button
        type="button"
        onClick={async () => {
          setToastMessage('Checking cloud connection...');
          await checkSupabaseConnection();
          setToastMessage('Connection test complete.');
          setTimeout(() => setToastMessage(null), 3000);
        }}
        className="px-4 py-2 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 transition-colors cursor-pointer shadow-xs"
      >
        Test Connection
      </button>
    </div>
  </div>
);

interface BackupsDesktopProps {
  currentUserRole?: string;
  exportBackup: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearTransactions: () => void;
  resetToDefault: () => void;
  setToastMessage: React.Dispatch<React.SetStateAction<string | null>>;
  counts: {
    bills: number;
    payments: number;
    trips: number;
    audits: number;
    stockTransfers: number;
    customers: number;
    products: number;
    grns: number;
    warehouses: number;
  };
}

export const SettingsBackupsDesktop: React.FC<BackupsDesktopProps> = ({
  currentUserRole,
  exportBackup,
  fileInputRef,
  handleFileUpload,
  clearTransactions,
  resetToDefault,
  setToastMessage,
  counts,
}) => (
  <div data-card-tone="neutral" className="rounded-2xl border p-3.5 sm:p-6 shadow-xs space-y-4">
    <div className="flex items-center gap-2.5 pb-3 border-b border-black/5">
      <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--slate shrink-0">
        <Database className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-extrabold text-neutral-900">Data &amp; Backups</h2>
        <p className="hidden sm:block text-xs text-neutral-600 mt-0.5">
          Download snapshots of your business ledger or import a JSON backup.
        </p>
      </div>
    </div>

    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={exportBackup}
        className="px-4 py-2.5 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
      >
        <Download className="w-3.5 h-3.5 text-neutral-500" />
        <span>Export Ledger Backup (.JSON)</span>
      </button>

      <label className="px-4 py-2.5 border border-neutral-300 rounded-xl text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs">
        <Upload className="w-3.5 h-3.5 text-neutral-500" />
        <span>Restore from Backup (.JSON)</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileUpload}
          className="sr-only"
        />
      </label>
    </div>

    {/* Danger Operations (owner only; each one shows exactly what goes, offers a backup and asks for a typed word) */}
    {currentUserRole === 'admin' ? (
      <div className="pt-4 border-t border-neutral-100">
        <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">Danger Operations</h3>
        <p className="text-xs text-neutral-500 mb-2.5">
          These cannot be undone. Each one asks you to download a backup and type a word first.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={async () => {
              const ok = await confirmDialog({
                title: 'Clear all bills, payments and trips?',
                message:
                  'This deletes every transaction record on this device and in the cloud. Your products, customers, GRNs, stock batches and company settings are kept.',
                details: [
                  `${counts.bills} bills`,
                  `${counts.payments} payments / receipts`,
                  `${counts.trips} vehicle trips`,
                  `${counts.audits} stock audits`,
                  `${counts.stockTransfers} stock transfers`,
                ],
                confirmLabel: 'Clear records',
                tone: 'danger',
                typeToConfirm: 'CLEAR',
                extraAction: { label: 'Download a backup file first', onClick: () => exportBackup() },
              });
              if (!ok) return;
              clearTransactions();
              setToastMessage('Bills, payments and trips cleared.');
              setTimeout(() => setToastMessage(null), 3000);
            }}
            className="px-3.5 py-2.5 min-h-[44px] border border-amber-300 rounded-xl text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
          >
            Clear Bills, Payments & Trips
          </button>

          <button
            type="button"
            onClick={async () => {
              const ok = await confirmDialog({
                title: 'Factory reset: erase everything?',
                message:
                  'This deletes all business data and puts the company profile and billing / GST settings back to defaults.',
                details: [
                  `${counts.bills} bills and ${counts.payments} payments`,
                  `${counts.customers} customers`,
                  `${counts.products} products`,
                  `${counts.grns} GRNs (purchases)`,
                  `${counts.warehouses} warehouses / vehicles (reset to the default one)`,
                  'Company profile and billing / GST settings',
                ],
                confirmLabel: 'Erase everything',
                tone: 'danger',
                typeToConfirm: 'RESET',
                extraAction: { label: 'Download a backup file first', onClick: () => exportBackup() },
              });
              if (!ok) return;
              resetToDefault();
              setToastMessage('Ledger reset to defaults.');
              setTimeout(() => setToastMessage(null), 3000);
            }}
            className="px-3.5 py-2.5 min-h-[44px] border border-rose-300 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
          >
            Factory Reset
          </button>
        </div>
      </div>
    ) : (
      <div className="pt-4 border-t border-neutral-100">
        <p className="text-xs text-neutral-500">Clearing or resetting data can only be done by the owner.</p>
      </div>
    )}
  </div>
);
