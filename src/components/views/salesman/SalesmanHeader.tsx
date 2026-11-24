import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  LayoutGrid,
  LogOut,
  ShoppingBag,
  Truck,
  User,
  X,
} from 'lucide-react';
import { Trip } from '../../../types';
import { money } from '../../../utils/billing';
import { LanguageToggle } from '../../common/LanguageToggle';
import { OdiaName } from '../../common/OdiaName';
import { useLanguage } from '../../../i18n/LanguageContext';

export type SalesmanTabId = 'home' | 'sell' | 'vanStock' | 'bills' | 'customerDue' | 'trips';

interface SalesmanHeaderProps {
  salesmanTab: SalesmanTabId;
  setSalesmanTab: (tab: SalesmanTabId) => void;
  palette: any;
  currentUser: any;
  userSalesmanName?: string;
  activeSalesman: any;
  activeTrip: Trip | null;
  logout: () => void;
  cartItemCount: number;
  selectedRetailer: string;
  finalCartTotal: number;
  isLowVision: boolean;
  speakAssistiveText: (text: string) => void;
  onOpenCart: () => void;
  feedbackMsg: { text: string; type: 'success' | 'warn' } | null;
  onDismissFeedback: () => void;
}

export const SalesmanHeader: React.FC<SalesmanHeaderProps> = ({
  salesmanTab,
  setSalesmanTab,
  palette,
  currentUser,
  userSalesmanName,
  activeSalesman,
  activeTrip,
  logout,
  cartItemCount,
  selectedRetailer,
  finalCartTotal,
  isLowVision,
  speakAssistiveText,
  onOpenCart,
  feedbackMsg,
  onDismissFeedback,
}) => {
  const { t } = useLanguage();

  return (
    <>
      <header
        id="salesman-header"
        className="sticky top-0 z-30 border-b-2 shadow-md px-3 sm:px-4 py-2.5 sm:py-3 space-y-3"
        style={{
          backgroundColor: palette.panel,
          borderColor: palette.line,
        }}
      >
        <div className="max-w-none lg:max-w-6xl mx-auto space-y-3">
          {salesmanTab === 'home' ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-sm">
                  <User size={24} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase tracking-wider text-amber-500">
                    {t('salesman.routeDashboard')}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 min-w-0 break-words lg:truncate leading-tight">
                    {currentUser?.name || userSalesmanName || activeSalesman?.name || 'Sales Staff'}
                  </h1>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-0.5 min-w-0 break-words lg:truncate">
                    <Truck size={14} className="text-slate-400 shrink-0" />
                    <span className="min-w-0 break-words lg:truncate">
                      {activeTrip?.vehicle
                        ? `${activeTrip.vehicle}${activeTrip.route ? ' • ' + activeTrip.route : ''}`
                        : t('salesman.noActiveVehicle')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <LanguageToggle />
                <button
                  type="button"
                  id="salesman-home-btn-logout"
                  onClick={() => logout()}
                  className="size-11 rounded-2xl border-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 flex items-center justify-center cursor-pointer transition-colors shadow-xs"
                  title={t('salesman.signOut')}
                  aria-label={t('salesman.signOut')}
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setSalesmanTab('home')}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer flex items-center gap-1.5 text-xs font-black shrink-0"
                  title="Back to Dashboard Home"
                >
                  <LayoutGrid size={16} className="text-amber-500" />
                  <span>{t('salesman.tab.home')}</span>
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="truncate text-base sm:text-lg font-black tracking-tight"
                      style={{ color: palette.ink }}
                    >
                      {salesmanTab === 'sell' && t('salesman.newSale')}
                      {salesmanTab === 'vanStock' && t('salesman.tab.vanStock')}
                      {salesmanTab === 'bills' && t('salesman.myBills')}
                      {salesmanTab === 'customerDue' && t('salesman.payments')}
                      {salesmanTab === 'trips' && t('salesman.tab.trips')}
                    </span>
                    {activeTrip && (
                      <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-emerald-600 text-white shrink-0 flex items-center gap-1">
                        <Truck size={12} />
                        <span>{activeTrip.vehicle}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <LanguageToggle />
                <button
                  type="button"
                  id="salesman-header-btn-logout"
                  onClick={() => logout()}
                  className="size-9 rounded-xl border-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 flex items-center justify-center cursor-pointer transition-colors shadow-xs"
                  title={t('salesman.signOut')}
                  aria-label={t('salesman.signOut')}
                >
                  <LogOut size={17} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Review Cart Bar when items exist */}
        {cartItemCount > 0 && (
          <div className="max-w-none lg:max-w-6xl mx-auto mt-2">
            <button
              type="button"
              id="btn-quick-review-cart-bar"
              onClick={() => {
                onOpenCart();
                if (isLowVision) speakAssistiveText(`Reviewing invoice cart. ${cartItemCount} items.`);
              }}
              className="w-full py-2.5 px-4 rounded-xl border-2 border-amber-500 bg-amber-50 hover:bg-amber-100 text-amber-950 font-black text-xs sm:text-sm flex items-center justify-between cursor-pointer shadow-sm transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-amber-700" />
                <span>Invoice Cart: {cartItemCount} beverage item(s)</span>
                {selectedRetailer && (
                  <span className="text-xs text-amber-800 font-bold hidden sm:inline">
                    for <OdiaName name={selectedRetailer} kind="person" className="inline" odiaClassName="ml-1 font-odia" />
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm sm:text-base text-amber-900 font-black">
                  ₹{money(finalCartTotal)}
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-xs font-black">
                  Review & Bill →
                </span>
              </div>
            </button>
          </div>
        )}
      </header>

      {/* Floating / Top Alert Feedback Banner */}
      {feedbackMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="max-w-none lg:max-w-6xl mx-auto mt-3 px-4 py-2.5 rounded-md font-black text-sm flex items-center justify-between border-2 shadow-sm transition-all"
          style={{
            backgroundColor: feedbackMsg.type === 'success' ? '#ECFDF5' : '#FFFBEB',
            borderColor: feedbackMsg.type === 'success' ? '#059669' : '#D97706',
            color: feedbackMsg.type === 'success' ? '#065F46' : '#92400E',
          }}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={onDismissFeedback}
            className="p-1 cursor-pointer"
            aria-label="Close notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
};
