import React from 'react';
import { Building2, ChevronDown, Receipt } from 'lucide-react';
import GstRegistrationCard from '../GstRegistrationCard';
import { GstMode, PriceType } from '../../../types';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import { BillingFormState, INDIAN_STATES, ProfileFormState } from './settingsTypes';

interface BusinessDesktopProps {
  profileForm: ProfileFormState;
  setProfileForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
}

export const SettingsBusinessDesktop: React.FC<BusinessDesktopProps> = ({
  profileForm,
  setProfileForm,
}) => (
  <div data-card-tone="sales" className="rounded-2xl border p-3.5 sm:p-6 shadow-xs">
    <div className="flex items-center justify-between gap-3 mb-3.5 sm:mb-5 pb-3 border-b border-black/5">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--blue shrink-0">
          <Building2 className="w-4 h-4" />
        </span>
        <h2 className="text-base sm:text-lg font-extrabold text-neutral-900 truncate">Business</h2>
      </div>
      <span className="hidden sm:inline text-xs font-medium text-blue-900/70">Organisation & Tax Profile</span>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-3 sm:gap-y-4">
      {/* BUSINESS NAME */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
          BUSINESS NAME
        </label>
        <input
          type="text"
          value={profileForm.name}
          onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
          placeholder="Shree Beverages Distributors"
          className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs"
        />
      </div>

      {/* GSTIN */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
          GSTIN
        </label>
        <input autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}
          type="text"
          maxLength={15}
          value={profileForm.gstin}
          onChange={(e) => {
            const val = e.target.value.toUpperCase();
            setProfileForm({
              ...profileForm,
              gstin: val,
              pan: val.length >= 12 ? val.slice(2, 12) : profileForm.pan,
            });
          }}
          placeholder="27AAKCS1234F1Z5"
          className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 uppercase placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs"
        />
      </div>

      {/* PAN */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
          PAN
        </label>
        <input
          type="text"
          maxLength={10}
          value={profileForm.pan}
          onChange={(e) => setProfileForm({ ...profileForm, pan: e.target.value.toUpperCase() })}
          placeholder="AAKCS1234F"
          className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 uppercase placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs"
        />
      </div>

      {/* FSSAI LICENCE */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
          FSSAI LICENCE
        </label>
        <input
          type="text"
          maxLength={14}
          value={profileForm.fssai}
          onChange={(e) => setProfileForm({ ...profileForm, fssai: e.target.value })}
          placeholder="11521034000123"
          className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs"
        />
      </div>

      {/* PHONE */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
          PHONE
        </label>
        <input inputMode="tel" autoComplete="tel"
          type="text"
          value={profileForm.phone}
          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
          placeholder="9822012345"
          className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs"
        />
      </div>

      {/* EMAIL */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
          EMAIL
        </label>
        <input
          type="email"
          value={profileForm.email}
          onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
          placeholder="sales@shreebeverages.com"
          className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs"
        />
      </div>

      {/* STATE */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
          STATE
        </label>
        <div className="relative">
          <select
            value={profileForm.state}
            onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
            className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 appearance-none pr-9 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs cursor-pointer"
          >
            {INDIAN_STATES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* ADDRESS */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
          ADDRESS
        </label>
        <input
          type="text"
          value={profileForm.address}
          onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
          placeholder="Plot 14, MIDC Bhosari, Pune 411026"
          className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs"
        />
      </div>

      {/* CITY & PROPRIETOR (FULL CAPABILITY) */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
          CITY & REGION
        </label>
        <input
          type="text"
          value={profileForm.city}
          onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
          placeholder="Pune, Maharashtra"
          className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
          PROPRIETOR / AUTHORIZED SIGNATORY
        </label>
        <input
          type="text"
          value={profileForm.ownerName}
          onChange={(e) => setProfileForm({ ...profileForm, ownerName: e.target.value })}
          placeholder="Proprietor / Signatory Name"
          className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs"
        />
      </div>

      {/* BANK */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
          BANK
        </label>
        <input
          type="text"
          value={profileForm.bankName}
          onChange={(e) => setProfileForm({ ...profileForm, bankName: e.target.value })}
          placeholder="HDFC Bank"
          className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs"
        />
      </div>

      {/* ACCOUNT NO. */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
          ACCOUNT NO.
        </label>
        <input
          type="text"
          value={profileForm.accountNumber}
          onChange={(e) => setProfileForm({ ...profileForm, accountNumber: e.target.value })}
          placeholder="50200012345678"
          className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs"
        />
      </div>

      {/* IFSC */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
          IFSC
        </label>
        <input
          type="text"
          maxLength={11}
          value={profileForm.ifsc}
          onChange={(e) => setProfileForm({ ...profileForm, ifsc: e.target.value.toUpperCase() })}
          placeholder="HDFC0001234"
          className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 uppercase placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs"
        />
      </div>

      {/* UPI ID */}
      <div>
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
          UPI ID
        </label>
        <input
          type="text"
          value={profileForm.upiId}
          onChange={(e) => setProfileForm({ ...profileForm, upiId: e.target.value })}
          placeholder="shreebev@upi"
          className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs"
        />
      </div>

      {/* INVOICE TERMS */}
      <div className="md:col-span-2">
        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
          INVOICE TERMS
        </label>
        <input
          type="text"
          value={profileForm.invoiceTerms}
          onChange={(e) => setProfileForm({ ...profileForm, invoiceTerms: e.target.value })}
          placeholder="Goods once sold will not be taken back except expiry/damage. Interest @18% after due date."
          className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs"
        />
      </div>
    </div>
  </div>
);

interface BillingDesktopProps {
  billingForm: BillingFormState;
  setBillingForm: React.Dispatch<React.SetStateAction<BillingFormState>>;
}

export const SettingsBillingDesktop: React.FC<BillingDesktopProps> = ({
  billingForm,
  setBillingForm,
}) => (
  <div data-card-tone="profit" className="rounded-2xl border p-3.5 sm:p-6 shadow-xs">
    <div className="flex items-center justify-between gap-3 mb-3.5 sm:mb-5 pb-3 border-b border-black/5">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="hh-icon-badge hh-icon-badge--sm hh-icon-badge--purple shrink-0">
          <Receipt className="w-4 h-4" />
        </span>
        <h2 className="text-base sm:text-lg font-extrabold text-neutral-900 truncate">Billing rules</h2>
      </div>
      <span className="hidden sm:inline text-xs font-medium text-purple-900/70">Invoicing, Taxes & Limits</span>
    </div>

    <div className="space-y-4">
      {/* ROW 1: PRINT LAYOUT & CREDIT LIMIT CROSSED */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-3 sm:gap-y-4">
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
            PRINT LAYOUT
          </label>
          <div className="relative">
            <select
              value={billingForm.printLayout}
              onChange={(e) => setBillingForm({ ...billingForm, printLayout: e.target.value })}
              className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 appearance-none pr-9 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs cursor-pointer"
            >
              <option value="A4">A4</option>
              <option value="Thermal 3-inch (80mm)">Thermal 3-inch (80mm)</option>
              <option value="Half Page A5">Half Page A5</option>
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
            CREDIT LIMIT CROSSED
          </label>
          <div className="relative">
            <select
              value={billingForm.creditLimitCrossed}
              onChange={(e) => setBillingForm({ ...billingForm, creditLimitCrossed: e.target.value })}
              className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 appearance-none pr-9 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs cursor-pointer"
            >
              <option value="Warn">Warn</option>
              <option value="Block">Block billing</option>
              <option value="Allow">Allow without warning</option>
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ROW 2: EXPIRY ALERT (DAYS) & SELL EARLIEST EXPIRY FIRST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3 sm:gap-y-4 items-center">
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
            EXPIRY ALERT (DAYS)
          </label>
          <input
            type="number" inputMode="decimal"
            value={billingForm.expiryAlertDays}
            onChange={(e) =>
              setBillingForm({ ...billingForm, expiryAlertDays: Number(e.target.value) || 0 })
            }
            className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all shadow-xs"
          />
        </div>

        <div className="flex items-center gap-3 pt-4 md:pt-5">
          <ToggleSwitch
            id="toggle-sell-earliest-expiry"
            checked={billingForm.sellEarliestExpiryFirst}
            onChange={(v) =>
              setBillingForm({
                ...billingForm,
                sellEarliestExpiryFirst: v,
              })
            }
            ariaLabelledBy="label-sell-earliest-expiry"
          />
          <span
            id="label-sell-earliest-expiry"
            onClick={() =>
              setBillingForm({
                ...billingForm,
                sellEarliestExpiryFirst: !billingForm.sellEarliestExpiryFirst,
              })
            }
            className="text-sm font-medium text-neutral-800 cursor-pointer select-none"
          >
            Sell earliest expiry first
          </span>
        </div>
      </div>

      {/* ROW 3: ALLOW SELLING WITHOUT STOCK & ROUND OFF BILL TOTAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3 sm:gap-y-4 items-center pt-2">
        <div className="flex items-center gap-3">
          <ToggleSwitch
            id="toggle-allow-no-stock"
            checked={billingForm.allowSellingWithoutStock}
            onChange={(v) =>
              setBillingForm({
                ...billingForm,
                allowSellingWithoutStock: v,
              })
            }
            ariaLabelledBy="label-allow-no-stock"
          />
          <span
            id="label-allow-no-stock"
            onClick={() =>
              setBillingForm({
                ...billingForm,
                allowSellingWithoutStock: !billingForm.allowSellingWithoutStock,
              })
            }
            className="text-sm font-medium text-neutral-800 cursor-pointer select-none"
          >
            Allow selling without stock
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ToggleSwitch
            id="toggle-round-off-total"
            checked={billingForm.roundOffGrandTotal}
            onChange={(v) =>
              setBillingForm({
                ...billingForm,
                roundOffGrandTotal: v,
              })
            }
            ariaLabelledBy="label-round-off-total"
          />
          <span
            id="label-round-off-total"
            onClick={() =>
              setBillingForm({
                ...billingForm,
                roundOffGrandTotal: !billingForm.roundOffGrandTotal,
              })
            }
            className="text-sm font-medium text-neutral-800 cursor-pointer select-none"
          >
            Round off bill total
          </span>
        </div>
      </div>

      {/* ADDITIONAL INVOICING PARAMETERS FROM DATABASE */}
      <div className="pt-4 border-t border-neutral-100 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-3 sm:gap-y-4">
        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
            INVOICE PREFIX CODE
          </label>
          <input
            type="text"
            value={billingForm.invoicePrefix}
            onChange={(e) => setBillingForm({ ...billingForm, invoicePrefix: e.target.value.toUpperCase() })}
            placeholder="INV"
            className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 uppercase focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-xs"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
            INVOICE NUMBERING SERIES
          </label>
          <div className="relative">
            <select
              value={billingForm.numberingMode}
              onChange={(e) =>
                setBillingForm({
                  ...billingForm,
                  numberingMode: e.target.value as 'shared' | 'per_salesman_series',
                })
              }
              className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 appearance-none pr-9 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-xs cursor-pointer"
            >
              <option value="shared">Shared sequential ({billingForm.invoicePrefix || 'INV'}-101, 102...)</option>
              <option value="per_salesman_series">Per-salesman series ({billingForm.invoicePrefix || 'INV'}-S1-1, S2-1...)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Per-salesman series avoids duplicate GST invoice numbers when two salesmen bill offline.
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
            DEFAULT SALE RATE TYPE
          </label>
          <div className="relative">
            <select
              value={billingForm.defaultSaleType}
              onChange={(e) => setBillingForm({ ...billingForm, defaultSaleType: e.target.value as PriceType })}
              className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 appearance-none pr-9 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-xs cursor-pointer"
            >
              <option value="Retail">Retail (MRP / Direct Retail Rate)</option>
              <option value="Wholesale">Wholesale (Bulk Kirana Shop Rate)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <GstRegistrationCard />

        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
            DEFAULT GST MODE
          </label>
          <div className="relative">
            <select
              value={billingForm.defaultGstMode}
              onChange={(e) => setBillingForm({ ...billingForm, defaultGstMode: e.target.value as GstMode })}
              className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 appearance-none pr-9 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-xs cursor-pointer"
            >
              <option value="inclusive">GST Inclusive (Rate includes Tax)</option>
              <option value="off">GST Off / Non-Tax Bill</option>
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
            MAX SALESMAN DISCOUNT CAP (%)
          </label>
          <input
            type="number" inputMode="numeric"
            min={0}
            max={100}
            value={billingForm.maxSalesmanDiscountPercent}
            onChange={(e) =>
              setBillingForm({
                ...billingForm,
                maxSalesmanDiscountPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
              })
            }
            className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-xs"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
            INVOICE PDF PAPER (DOWNLOAD / PRINT / SHARE)
          </label>
          <div className="relative">
            <select
              value={billingForm.defaultInvoicePaper}
              onChange={(e) => setBillingForm({ ...billingForm, defaultInvoicePaper: e.target.value as 'a4' | '80mm' })}
              className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 appearance-none pr-9 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-xs cursor-pointer"
            >
              <option value="a4">A4 invoice (full GST layout)</option>
              <option value="80mm">80 mm receipt (thermal slip)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <p className="text-xs text-neutral-500 mt-1">You can still switch A4 / 80 mm on each invoice's Share screen.</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
            WHATSAPP BILL MESSAGE STYLE
          </label>
          <div className="relative">
            <select
              value={billingForm.whatsappTextStyle}
              onChange={(e) => setBillingForm({ ...billingForm, whatsappTextStyle: e.target.value as 'detailed' | 'receipt' })}
              className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 appearance-none pr-9 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-xs cursor-pointer"
            >
              <option value="detailed">Detailed message (with icons)</option>
              <option value="receipt">80 mm receipt text (fixed-width slip)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">
            RECEIPT TEXT WIDTH (CHARACTERS PER LINE)
          </label>
          <div className="relative">
            <select
              value={billingForm.receiptTextWidth}
              onChange={(e) => setBillingForm({ ...billingForm, receiptTextWidth: Number(e.target.value) as 32 | 42 | 48 })}
              className="w-full bg-white border border-neutral-300 rounded-xl px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm text-neutral-800 appearance-none pr-9 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-xs cursor-pointer"
            >
              <option value={32}>32 - fits a phone chat (WhatsApp)</option>
              <option value={42}>42 - 80 mm printer apps</option>
              <option value={48}>48 - 80 mm printer apps, small font</option>
            </select>
            <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <p className="text-xs text-neutral-500 mt-1">Used when the message style above is the 80 mm receipt text.</p>
        </div>
      </div>

      {/* STATUTORY & SCHEME SWITCHES */}
      <div className="pt-2 border-t border-neutral-100 space-y-3.5 text-sm">
        <div className="flex items-center gap-3">
          <ToggleSwitch
            id="toggle-show-batch-invoice"
            checked={billingForm.showBatchOnInvoice}
            onChange={(v) =>
              setBillingForm({
                ...billingForm,
                showBatchOnInvoice: v,
              })
            }
            ariaLabelledBy="label-show-batch-invoice"
          />
          <span
            id="label-show-batch-invoice"
            onClick={() =>
              setBillingForm({
                ...billingForm,
                showBatchOnInvoice: !billingForm.showBatchOnInvoice,
              })
            }
            className="text-sm font-medium text-neutral-800 cursor-pointer select-none"
          >
            Print Lot / Batch numbers & expiry dates on invoices
          </span>
        </div>

        <div className="flex items-start gap-3">
          <ToggleSwitch
            id="toggle-show-upi-qr"
            checked={billingForm.showUpiQrOnReceipt}
            onChange={(v) =>
              setBillingForm({
                ...billingForm,
                showUpiQrOnReceipt: v,
              })
            }
            ariaLabelledBy="label-show-upi-qr"
            className="mt-0.5"
          />
          <span
            id="label-show-upi-qr"
            onClick={() =>
              setBillingForm({
                ...billingForm,
                showUpiQrOnReceipt: !billingForm.showUpiQrOnReceipt,
              })
            }
            className="text-sm font-medium text-neutral-800 cursor-pointer select-none"
          >
            Print a UPI QR on the 80 mm receipt when money is still due
            <span className="block text-xs font-normal text-neutral-500 mt-0.5">Needs your UPI ID in the organization profile. The QR opens a payment screen with the balance filled in.</span>
          </span>
        </div>

        <div className="flex items-start gap-3">
          <ToggleSwitch
            id="toggle-show-odia-receipt"
            checked={billingForm.showOdiaNameOnReceipt}
            onChange={(v) =>
              setBillingForm({
                ...billingForm,
                showOdiaNameOnReceipt: v,
              })
            }
            ariaLabelledBy="label-show-odia-receipt"
            className="mt-0.5"
          />
          <span
            id="label-show-odia-receipt"
            onClick={() =>
              setBillingForm({
                ...billingForm,
                showOdiaNameOnReceipt: !billingForm.showOdiaNameOnReceipt,
              })
            }
            className="text-sm font-medium text-neutral-800 cursor-pointer select-none"
          >
            Print Odia product names on the 80 mm receipt and WhatsApp receipt text
            <span className="block text-xs font-normal text-neutral-500 mt-0.5">Uses the Odia name saved on each product. Products without one show the English name only.</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ToggleSwitch
            id="toggle-gst-free-cases"
            checked={billingForm.gstOnFreeCases}
            onChange={(v) =>
              setBillingForm({
                ...billingForm,
                gstOnFreeCases: v,
              })
            }
            ariaLabelledBy="label-gst-free-cases"
          />
          <span
            id="label-gst-free-cases"
            onClick={() =>
              setBillingForm({
                ...billingForm,
                gstOnFreeCases: !billingForm.gstOnFreeCases,
              })
            }
            className="text-sm font-medium text-neutral-800 cursor-pointer select-none"
          >
            Charge GST on free scheme cases too (supplier invoice method)
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ToggleSwitch
            id="toggle-auto-apply-schemes"
            checked={billingForm.autoApplyPromotions}
            onChange={(v) =>
              setBillingForm({
                ...billingForm,
                autoApplyPromotions: v,
              })
            }
            ariaLabelledBy="label-auto-apply-schemes"
          />
          <span
            id="label-auto-apply-schemes"
            onClick={() =>
              setBillingForm({
                ...billingForm,
                autoApplyPromotions: !billingForm.autoApplyPromotions,
              })
            }
            className="text-sm font-medium text-neutral-800 cursor-pointer select-none"
          >
            Auto-apply qualifying schemes by default in Billing
          </span>
        </div>
      </div>
    </div>
  </div>
);
