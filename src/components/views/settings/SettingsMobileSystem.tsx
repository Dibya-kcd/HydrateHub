import React from 'react';
import {
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Compass,
  Copy,
  Database,
  History,
  Palette,
  Receipt,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { COMPLETE_SQL_SCHEMA_SCRIPT } from '../../../lib/supabase';
import { FontSize } from '../../../types';
import { AVATAR_IDS, AvatarId, writeAvatar } from '../../../utils/avatar';
import { confirmDialog } from '../../../utils/dialogs';
import { UserAvatar } from '../../common/UserAvatar';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import { SettingsPhoneToast } from './SettingsPhoneToast';
import { SettingsSection } from './settingsTypes';

interface DisplayMobileProps {
  setMobileSection: React.Dispatch<React.SetStateAction<SettingsSection | null>>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
  avatarId: AvatarId;
  ownerInitial: string;
  showAvatarSheet: boolean;
  setShowAvatarSheet: React.Dispatch<React.SetStateAction<boolean>>;
  prefLang: 'en' | 'or';
  setPrefLang: React.Dispatch<React.SetStateAction<'en' | 'or'>>;
  setLanguage: (lang: 'en' | 'or') => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  lowVisionMode: boolean;
  toggleLowVisionMode: () => void;
  isSaving: boolean;
  toastMessage: string | null;
  setToastMessage: React.Dispatch<React.SetStateAction<string | null>>;
}

export const SettingsDisplayMobile: React.FC<DisplayMobileProps> = ({
  setMobileSection,
  t,
  fontSize,
  setFontSize,
  avatarId,
  ownerInitial,
  showAvatarSheet,
  setShowAvatarSheet,
  prefLang,
  setPrefLang,
  setLanguage,
  highContrast,
  setHighContrast,
  lowVisionMode,
  toggleLowVisionMode,
  isSaving,
  toastMessage,
  setToastMessage,
}) => (
  <div id="view-settings" className="rt-flow-phone">
    <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
      <div className="hh-sales-top__row">
        <button type="button" className="hh-inv-backbtn" onClick={() => setMobileSection(null)}>
          <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
          <span>Display</span>
        </button>
      </div>
    </div>

    <div className="rt-flow-phone__body space-y-4 hh-inv-pb">
      <div>
        <div className="hh-set-section-lbl">TEXT SIZE</div>
        <div className="space-y-2" role="radiogroup" aria-label="Text size">
          {[
            { id: 'standard' as FontSize, title: t('settings.display.fontStandard') },
            { id: 'large' as FontSize, title: t('settings.display.fontLarge') },
            { id: 'xlarge' as FontSize, title: t('settings.display.fontXLarge') },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={fontSize === opt.id}
              onClick={() => setFontSize(opt.id)}
              className="hh-set-radio"
            >
              <span className="hh-set-radio__dot" aria-hidden="true" />
              <span className="text-sm font-bold">{opt.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="hh-inv-card">
        <div className="text-sm font-extrabold text-slate-900">Sample text</div>
        <div className="text-xs text-slate-500 mt-0.5">Sri Balaji Stores · ₹2,400 due</div>
      </div>

      <div>
        <div className="hh-set-section-lbl">PROFILE AVATAR</div>
        <div className="hh-inv-card flex items-center gap-3">
          <span className="w-8 h-10 rounded-full bg-[#2864d9] text-white font-extrabold text-xs flex items-center justify-center shrink-0">
            <UserAvatar id={avatarId} initial={ownerInitial} size={16} />
          </span>
          <p className="text-xs text-slate-500 flex-1 min-w-0 leading-snug">
            Shown in the top bar and menu instead of a letter.
          </p>
          <button
            type="button"
            onClick={() => setShowAvatarSheet(true)}
            className="text-xs font-bold text-[#2864d9] shrink-0 cursor-pointer"
          >
            Change
          </button>
        </div>
      </div>

      <div>
        <div className="hh-set-section-lbl">LANGUAGE</div>
        <div className="hh-set-seg2">
          <button
            type="button"
            className="hh-set-seg2__btn"
            aria-pressed={prefLang === 'en'}
            onClick={() => {
              setPrefLang('en');
              setLanguage('en');
            }}
          >
            English
          </button>
          <button
            type="button"
            className="hh-set-seg2__btn"
            aria-pressed={prefLang === 'or'}
            onClick={() => {
              setPrefLang('or');
              setLanguage('or');
              setToastMessage('Odia applied to salesman views.');
              setTimeout(() => setToastMessage(null), 3000);
            }}
          >
            ଓଡ଼ିଆ
          </button>
        </div>
      </div>

      <div className="hh-inv-card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div
            id="m-disp-hc-lbl"
            onClick={() => setHighContrast(!highContrast)}
            className="cursor-pointer select-none min-w-0"
          >
            <div className="text-xs font-bold text-slate-900">{t('settings.display.highContrast')}</div>
            <div className="text-xs text-slate-500">{t('settings.display.highContrastDesc')}</div>
          </div>
          <ToggleSwitch
            id="m-toggle-hc"
            size="sm"
            checked={highContrast}
            onChange={setHighContrast}
            ariaLabelledBy="m-disp-hc-lbl"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div
            id="m-disp-ev-lbl"
            onClick={toggleLowVisionMode}
            className="cursor-pointer select-none min-w-0"
          >
            <div className="text-xs font-bold text-slate-900">{t('settings.display.easyView')}</div>
            <div className="text-xs text-slate-500">{t('settings.display.easyViewDesc')}</div>
          </div>
          <ToggleSwitch
            id="m-toggle-ev"
            size="sm"
            checked={lowVisionMode}
            onChange={() => toggleLowVisionMode()}
            ariaLabelledBy="m-disp-ev-lbl"
          />
        </div>
      </div>
    </div>

    <SettingsPhoneToast isSaving={isSaving} toastMessage={toastMessage} />

    {showAvatarSheet && (
      <div className="rt-bsheet-scrim" role="dialog" aria-modal="true" aria-label="Choose profile avatar" onClick={() => setShowAvatarSheet(false)}>
        <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
          <div className="hh-grab" aria-hidden="true" />
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900">Choose profile avatar</h3>
            <button type="button" onClick={() => setShowAvatarSheet(false)} aria-label="Close" className="p-1 text-slate-400">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-5 gap-2.5 pt-1">
            {AVATAR_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  writeAvatar(id);
                  setShowAvatarSheet(false);
                }}
                className={`h-12 rounded-xl flex items-center justify-center font-bold cursor-pointer transition-all ${
                  avatarId === id
                    ? 'bg-[#2864d9] text-white ring-2 ring-offset-2 ring-[#2864d9]'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                <UserAvatar id={id} initial={ownerInitial} size={20} />
              </button>
            ))}
          </div>
        </div>
      </div>
    )}
  </div>
);

interface CloudMobileProps {
  setMobileSection: React.Dispatch<React.SetStateAction<SettingsSection | null>>;
  supabaseConfig: { projectRef: string };
  supabaseStatus: {
    isConnected: boolean;
    latencyMs: number;
    allTablesExist?: boolean;
    missingTables?: string[];
    lastSyncedAt?: string;
  };
  isPulling: boolean;
  handlePullCloud: () => Promise<void>;
  checkSupabaseConnection: () => Promise<any>;
  syncToCloud: (opts?: { full?: boolean }) => Promise<{ message: string }>;
  isSaving: boolean;
  toastMessage: string | null;
  setToastMessage: React.Dispatch<React.SetStateAction<string | null>>;
}

export const SettingsCloudMobile: React.FC<CloudMobileProps> = ({
  setMobileSection,
  supabaseConfig,
  supabaseStatus,
  isPulling,
  handlePullCloud,
  checkSupabaseConnection,
  syncToCloud,
  isSaving,
  toastMessage,
  setToastMessage,
}) => {
  const missingTables = supabaseStatus.missingTables || [];
  const showMissingTables =
    supabaseStatus.isConnected &&
    supabaseStatus.allTablesExist === false &&
    missingTables.length > 0;

  return (
  <div id="view-settings" className="rt-flow-phone">
    <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
      <div className="hh-sales-top__row">
        <button type="button" className="hh-inv-backbtn" onClick={() => setMobileSection(null)}>
          <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
          <span>Cloud</span>
        </button>
      </div>
    </div>

    <div className="rt-flow-phone__body space-y-3">
      <div className="hh-inv-card space-y-2.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">Engine</span>
          <span className="font-bold text-slate-900">PostgreSQL</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">Managed by</span>
          <span className="font-bold text-slate-900">Supabase</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">Project reference</span>
          <span className="font-mono font-bold text-slate-900 truncate max-w-[55%]">{supabaseConfig.projectRef}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">Latency</span>
          <span className="font-bold text-emerald-700 tabular-nums">{supabaseStatus.latencyMs} ms</span>
        </div>
        {supabaseStatus.isConnected && supabaseStatus.allTablesExist !== undefined && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Schema</span>
            <span className={`font-bold ${showMissingTables ? 'text-amber-700' : 'text-emerald-700'}`}>
              {showMissingTables ? `${missingTables.length} missing` : 'All tables ready'}
            </span>
          </div>
        )}
      </div>

      {showMissingTables && (
        <div className="hh-inv-card !bg-amber-50 !border-amber-200 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 font-extrabold text-amber-900">
            <AlertTriangle size={14} className="shrink-0" />
            <span>Missing tables ({missingTables.length})</span>
          </div>
          <div className="font-mono text-[11px] text-amber-800 break-all">
            {missingTables.join(', ')}
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard?.writeText(COMPLETE_SQL_SCHEMA_SCRIPT);
                setToastMessage('SQL setup script copied. Run in Supabase SQL Editor.');
              } catch {
                setToastMessage('Copy schema from migrations/supabase-schema.sql.');
              }
              setTimeout(() => setToastMessage(null), 4000);
            }}
            className="w-full py-2 px-3 rounded-lg bg-amber-900 text-white font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Copy size={13} />
            <span>Copy SQL setup script</span>
          </button>
        </div>
      )}

      <div className="hh-inv-card flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-900">Last sync</div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">
            {supabaseStatus.lastSyncedAt ? `${supabaseStatus.lastSyncedAt} · all changes saved` : 'All changes saved'}
          </div>
        </div>
        <span className={supabaseStatus.isConnected ? 'hh-set-badge-green shrink-0' : 'hh-set-badge-slate shrink-0'}>
          {supabaseStatus.isConnected ? 'Synced' : 'Offline'}
        </span>
      </div>

      <div className="flex items-center justify-between px-1 pt-1">
        <button
          type="button"
          disabled={isPulling}
          onClick={handlePullCloud}
          className="text-xs font-bold text-[#2864d9] cursor-pointer"
        >
          {isPulling ? 'Pulling...' : 'Pull latest from cloud'}
        </button>
        <button
          type="button"
          onClick={async () => {
            setToastMessage('Checking cloud connection...');
            await checkSupabaseConnection();
            setToastMessage('Connection test complete.');
            setTimeout(() => setToastMessage(null), 3000);
          }}
          className="text-xs font-bold text-slate-600 cursor-pointer"
        >
          Test connection
        </button>
      </div>
    </div>

    <SettingsPhoneToast isSaving={isSaving} toastMessage={toastMessage} />

    <div className="hh-set-footer">
      <button
        type="button"
        onClick={async () => {
          setToastMessage('Sending changes to cloud...');
          const res = await syncToCloud();
          setToastMessage(res.message);
          setTimeout(() => setToastMessage(null), 3500);
        }}
        className="hh-inv-btn-primary w-full"
      >
        Push changes to cloud
      </button>
    </div>
  </div>
  );
};

interface BackupsMobileProps {
  setMobileSection: React.Dispatch<React.SetStateAction<SettingsSection | null>>;
  exportBackup: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isOwnerAdmin: boolean;
  showResetSheet: boolean;
  setShowResetSheet: React.Dispatch<React.SetStateAction<boolean>>;
  clearTransactions: () => void;
  resetToDefault: () => void;
  isSaving: boolean;
  toastMessage: string | null;
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

export const SettingsBackupsMobile: React.FC<BackupsMobileProps> = ({
  setMobileSection,
  exportBackup,
  fileInputRef,
  handleFileUpload,
  isOwnerAdmin,
  showResetSheet,
  setShowResetSheet,
  clearTransactions,
  resetToDefault,
  isSaving,
  toastMessage,
  setToastMessage,
  counts,
}) => (
  <div id="view-settings" className="rt-flow-phone">
    <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
      <div className="hh-sales-top__row">
        <button type="button" className="hh-inv-backbtn" onClick={() => setMobileSection(null)}>
          <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
          <span>Backups</span>
        </button>
      </div>
    </div>

    <div className="rt-flow-phone__body space-y-4 hh-inv-pb">
      <div className="space-y-2.5">
        <div className="hh-set-section-lbl">DATA AND BACKUPS</div>
        <button type="button" onClick={exportBackup} className="hh-inv-btn-primary w-full">
          Export ledger backup (.JSON)
        </button>
        <label className="hh-inv-btn-outline w-full">
          <span>Restore from backup (.JSON)</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileUpload}
            className="sr-only"
          />
        </label>
      </div>

      <div>
        <div className="hh-set-section-lbl !text-rose-600">DANGER OPERATIONS</div>
        <div className="hh-inv-card hh-inv-card--alert-red space-y-3">
          <div>
            <div className="text-sm font-extrabold text-rose-600">Reset data</div>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">
              {isOwnerAdmin
                ? 'Clearing or resetting data can only be done by the owner.'
                : 'Clearing or resetting data can only be done by the owner.'}
            </p>
          </div>
          <button
            type="button"
            disabled={!isOwnerAdmin}
            onClick={() => setShowResetSheet(true)}
            className="hh-set-btn-danger-outline w-full disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Reset...
          </button>
        </div>
      </div>
    </div>

    <SettingsPhoneToast isSaving={isSaving} toastMessage={toastMessage} />

    {showResetSheet && isOwnerAdmin && (
      <div className="rt-bsheet-scrim" role="dialog" aria-modal="true" aria-label="Reset options" onClick={() => setShowResetSheet(false)}>
        <div className="rt-bsheet" onClick={(e) => e.stopPropagation()}>
          <div className="hh-grab" aria-hidden="true" />
          <h3 className="text-base font-extrabold text-rose-600">Reset data</h3>
          <p className="text-xs text-slate-600">
            These cannot be undone. Each asks you to download a backup and type a confirmation word.
          </p>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={async () => {
                setShowResetSheet(false);
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
              className="w-full p-3.5 rounded-xl border border-amber-300 bg-amber-50 text-left cursor-pointer"
            >
              <div className="text-sm font-bold text-amber-900">Clear Bills, Payments &amp; Trips</div>
              <div className="text-xs text-amber-800/80 mt-0.5">Keeps products, customers, stock batches and company settings.</div>
            </button>

            <button
              type="button"
              onClick={async () => {
                setShowResetSheet(false);
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
              className="w-full p-3.5 rounded-xl border border-rose-300 bg-rose-50 text-left cursor-pointer"
            >
              <div className="text-sm font-bold text-rose-700">Factory Reset</div>
              <div className="text-xs text-rose-600/80 mt-0.5">Erases all records and resets company &amp; billing settings.</div>
            </button>

            <button type="button" onClick={() => setShowResetSheet(false)} className="hh-inv-btn-outline w-full">
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);

interface SettingsHomeMobileProps {
  t: (key: string, vars?: Record<string, string | number>) => string;
  isOwnerAdmin: boolean;
  ownerInitial: string;
  ownerLabel: string;
  ownerSub: string;
  setMobileSection: React.Dispatch<React.SetStateAction<SettingsSection | null>>;
  onOpenActivityLog?: () => void;
  isSaving: boolean;
  toastMessage: string | null;
}

export const SettingsHomeMobile: React.FC<SettingsHomeMobileProps> = ({
  t,
  isOwnerAdmin,
  ownerInitial,
  ownerLabel,
  ownerSub,
  setMobileSection,
  onOpenActivityLog,
  isSaving,
  toastMessage,
}) => {
  const homeItems: {
    id: SettingsSection;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    iconClass: string;
  }[] = [
    {
      id: 'business',
      title: t('settings.section.business'),
      subtitle: 'Organisation and tax profile',
      icon: <Building2 size={17} aria-hidden="true" />,
      iconClass: 'bg-blue-50 text-[#2864d9]',
    },
    {
      id: 'billing',
      title: t('settings.section.billing'),
      subtitle: 'Invoicing, taxes and limits',
      icon: <Receipt size={17} aria-hidden="true" />,
      iconClass: 'bg-slate-100 text-slate-700',
    },
    {
      id: 'fleet',
      title: t('settings.section.fleet'),
      subtitle: 'Warehouses and vehicles',
      icon: <Truck size={17} aria-hidden="true" />,
      iconClass: 'bg-amber-50 text-amber-600',
    },
    ...(isOwnerAdmin
      ? [
          {
            id: 'beats' as const,
            title: t('settings.section.beats'),
            subtitle: 'Routes (admin)',
            icon: <Compass size={17} aria-hidden="true" />,
            iconClass: 'bg-emerald-50 text-emerald-700',
          },
        ]
      : []),
    {
      id: 'staff',
      title: t('settings.section.staff'),
      subtitle: 'Logins and PINs',
      icon: <Users size={17} aria-hidden="true" />,
      iconClass: 'bg-slate-100 text-slate-700',
    },
    {
      id: 'display',
      title: t('settings.section.display'),
      subtitle: 'Text size, avatar, language',
      icon: <Palette size={17} aria-hidden="true" />,
      iconClass: 'bg-yellow-50 text-amber-600',
    },
    {
      id: 'cloud',
      title: t('settings.section.cloud'),
      subtitle: 'Database and sync',
      icon: <Cloud size={17} aria-hidden="true" />,
      iconClass: 'bg-sky-50 text-sky-600',
    },
    {
      id: 'backups',
      title: t('settings.section.backups'),
      subtitle: 'Export, restore and reset',
      icon: <Database size={17} aria-hidden="true" />,
      iconClass: 'bg-slate-100 text-slate-600',
    },
  ];

  return (
    <div id="view-settings" className="hh-view w-full min-w-0">
      <div className="hh-sales-top hh-sales-top--flush">
        <div>
          <h1 className="hh-sales-top__title">Settings</h1>
          <p className="text-xs text-white/80 mt-0.5">Business, GST, billing rules, staff</p>
        </div>
      </div>

      <div className="space-y-3 hh-inv-pb">
        <div className="hh-inv-card flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="size-11 rounded-full bg-[#2864d9] text-white font-extrabold text-base flex items-center justify-center shrink-0">
              <UserAvatar initial={ownerInitial} size={20} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-slate-900 truncate">{ownerLabel}</div>
              {ownerSub && <div className="text-xs text-slate-500 truncate">{ownerSub}</div>}
            </div>
          </div>
          <span className="hh-set-badge-green shrink-0">{isOwnerAdmin ? 'Admin' : 'Staff'}</span>
        </div>

        <div className="hh-set-list">
          {homeItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMobileSection(item.id)}
              className="hh-set-row"
            >
              <span className={`hh-set-icon ${item.iconClass}`}>{item.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-extrabold text-slate-900">{item.title}</span>
                <span className="block text-xs text-slate-500 truncate">{item.subtitle}</span>
              </span>
              <ChevronRight size={17} className="text-[#2864d9] shrink-0" aria-hidden="true" />
            </button>
          ))}
          {onOpenActivityLog && (
            <button
              type="button"
              onClick={onOpenActivityLog}
              className="hh-set-row"
            >
              <span className="hh-set-icon bg-slate-100 text-slate-700">
                <History size={17} aria-hidden="true" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-extrabold text-slate-900">Global Activity Log</span>
                <span className="block text-xs text-slate-500 truncate">Audit trail of edits, deletions &amp; reasons</span>
              </span>
              <ChevronRight size={17} className="text-[#2864d9] shrink-0" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <SettingsPhoneToast isSaving={isSaving} toastMessage={toastMessage} />
    </div>
  );
};
