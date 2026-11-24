import React from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import GstRegistrationCard from '../GstRegistrationCard';
import { GstMode, OrganizationProfile, PriceType } from '../../../types';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import { SettingsPhoneToast } from './SettingsPhoneToast';
import { BillingFormState, INDIAN_STATES, ProfileFormState, SettingsSection } from './settingsTypes';

interface BusinessMobileProps {
  setMobileSection: React.Dispatch<React.SetStateAction<SettingsSection | null>>;
  profileForm: ProfileFormState;
  setProfileForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
  orgProfile: OrganizationProfile;
  isSaving: boolean;
  toastMessage: string | null;
  handleSaveAll: (e?: React.FormEvent) => Promise<void>;
}

export const SettingsBusinessMobile: React.FC<BusinessMobileProps> = ({
  setMobileSection,
  profileForm,
  setProfileForm,
  orgProfile,
  isSaving,
  toastMessage,
  handleSaveAll,
}) => {
  const gstBadgeText = orgProfile.gstRegistrationType
    ? orgProfile.gstRegistrationType === 'composition'
      ? 'Composition'
      : 'Unregistered'
    : profileForm.gstin.trim().length >= 15
      ? 'Registered'
      : 'Not registered';

  return (
    <div id="view-settings" className="rt-flow-phone">
      <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
        <div className="hh-sales-top__row">
          <button type="button" className="hh-inv-backbtn" onClick={() => setMobileSection(null)}>
            <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
            <span>Business</span>
          </button>
        </div>
      </div>

      <div className="rt-flow-phone__body space-y-2.5">
        <label className="hh-inv-field hh-inv-field--focus">
          <span className="hh-inv-field__label">BUSINESS NAME</span>
          <input
            type="text"
            value={profileForm.name}
            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
            placeholder="Shree Beverages Distributors"
          />
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="hh-inv-field">
            <span className="hh-inv-field__label">GSTIN</span>
            <input
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
              className="uppercase"
            />
          </label>
          <label className="hh-inv-field">
            <span className="hh-inv-field__label">PAN</span>
            <input
              type="text"
              maxLength={10}
              value={profileForm.pan}
              onChange={(e) => setProfileForm({ ...profileForm, pan: e.target.value.toUpperCase() })}
              placeholder="AAKCS1234F"
              className="uppercase"
            />
          </label>
        </div>

        <label className="hh-inv-field">
          <span className="hh-inv-field__label">FSSAI / LICENCE NO.</span>
          <input
            type="text"
            maxLength={14}
            value={profileForm.fssai}
            onChange={(e) => setProfileForm({ ...profileForm, fssai: e.target.value })}
            placeholder="11521034000123"
          />
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="hh-inv-field">
            <span className="hh-inv-field__label">PHONE</span>
            <input
              type="text"
              inputMode="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              placeholder="9822012345"
            />
          </label>
          <label className="hh-inv-field">
            <span className="hh-inv-field__label">EMAIL</span>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              placeholder="sales@shreebeverages.com"
            />
          </label>
        </div>

        <label className="hh-inv-field">
          <span className="hh-inv-field__label">ADDRESS</span>
          <input
            type="text"
            value={profileForm.address}
            onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
            placeholder="Plot 14, MIDC Bhosari, Pune 411026"
          />
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="hh-inv-field">
            <span className="hh-inv-field__label">CITY / STATE</span>
            <input
              type="text"
              value={profileForm.city}
              onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
              placeholder="Pune, Maharashtra"
            />
          </label>
          <label className="hh-inv-field">
            <span className="hh-inv-field__label">SIGNATORY</span>
            <input
              type="text"
              value={profileForm.ownerName}
              onChange={(e) => setProfileForm({ ...profileForm, ownerName: e.target.value })}
              placeholder="Proprietor"
            />
          </label>
        </div>

        <label className="hh-inv-field">
          <span className="hh-inv-field__label">GST STATE CODE</span>
          <select
            value={profileForm.state}
            onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
          >
            {INDIAN_STATES.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </label>

        <p className="text-xs text-slate-500 px-0.5 leading-snug">
          GST registration: <strong className="text-slate-700">{gstBadgeText}</strong> below the GSTIN.
        </p>

        <div className="pt-2">
          <div className="hh-set-section-lbl">BANK DETAILS</div>
          <div className="space-y-2.5">
            <label className="hh-inv-field">
              <span className="hh-inv-field__label">BANK NAME</span>
              <input
                type="text"
                value={profileForm.bankName}
                onChange={(e) => setProfileForm({ ...profileForm, bankName: e.target.value })}
                placeholder="HDFC Bank"
              />
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="hh-inv-field">
                <span className="hh-inv-field__label">ACCOUNT NO.</span>
                <input
                  type="text"
                  value={profileForm.accountNumber}
                  onChange={(e) => setProfileForm({ ...profileForm, accountNumber: e.target.value })}
                  placeholder="50200012345678"
                />
              </label>
              <label className="hh-inv-field">
                <span className="hh-inv-field__label">IFSC</span>
                <input
                  type="text"
                  maxLength={11}
                  value={profileForm.ifsc}
                  onChange={(e) => setProfileForm({ ...profileForm, ifsc: e.target.value.toUpperCase() })}
                  placeholder="HDFC0001234"
                  className="uppercase"
                />
              </label>
            </div>

            <label className="hh-inv-field">
              <span className="hh-inv-field__label">UPI ID</span>
              <input
                type="text"
                value={profileForm.upiId}
                onChange={(e) => setProfileForm({ ...profileForm, upiId: e.target.value })}
                placeholder="shreebev@upi"
              />
            </label>
          </div>
        </div>

        <div className="pt-1">
          <div className="hh-set-section-lbl">INVOICE TERMS</div>
          <label className="hh-inv-field">
            <textarea
              rows={3}
              value={profileForm.invoiceTerms}
              onChange={(e) => setProfileForm({ ...profileForm, invoiceTerms: e.target.value })}
              placeholder="Goods once sold will not be taken back except expiry/damage. Interest @18% after due date."
              className="!font-medium"
            />
          </label>
        </div>
      </div>

      <SettingsPhoneToast isSaving={isSaving} toastMessage={toastMessage} />

      <div className="hh-set-footer">
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSaveAll}
          className="hh-inv-btn-primary w-full"
        >
          {isSaving ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </div>
  );
};

interface BillingMobileProps {
  setMobileSection: React.Dispatch<React.SetStateAction<SettingsSection | null>>;
  billingForm: BillingFormState;
  setBillingForm: React.Dispatch<React.SetStateAction<BillingFormState>>;
  paperChoice: '80mm' | 'a5' | 'a4';
  showMoreBilling: boolean;
  setShowMoreBilling: React.Dispatch<React.SetStateAction<boolean>>;
  isSaving: boolean;
  toastMessage: string | null;
  handleSaveAll: (e?: React.FormEvent) => Promise<void>;
}

export const SettingsBillingMobile: React.FC<BillingMobileProps> = ({
  setMobileSection,
  billingForm,
  setBillingForm,
  paperChoice,
  showMoreBilling,
  setShowMoreBilling,
  isSaving,
  toastMessage,
  handleSaveAll,
}) => (
  <div id="view-settings" className="rt-flow-phone">
    <div className="hh-sales-top hh-sales-top--flush hh-inv-top hh-inv-top--flow">
      <div className="hh-sales-top__row">
        <button type="button" className="hh-inv-backbtn" onClick={() => setMobileSection(null)}>
          <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" />
          <span>Billing rules</span>
        </button>
      </div>
    </div>

    <div className="rt-flow-phone__body space-y-4">
      <div>
        <div className="hh-set-section-lbl">PAPER SIZE</div>
        <div className="space-y-2" role="radiogroup" aria-label="Paper size">
          {[
            { id: '80mm', label: 'Thermal 3-inch (80mm)', layout: 'Thermal 3-inch (80mm)', paper: '80mm' as const },
            { id: 'a5', label: 'Half Page A5', layout: 'Half Page A5', paper: 'a4' as const },
            { id: 'a4', label: 'A4 invoice (full GST layout)', layout: 'A4', paper: 'a4' as const },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={paperChoice === opt.id}
              onClick={() =>
                setBillingForm({
                  ...billingForm,
                  printLayout: opt.layout,
                  defaultInvoicePaper: opt.paper,
                })
              }
              className="hh-set-radio"
            >
              <span className="hh-set-radio__dot" aria-hidden="true" />
              <span className="text-sm font-bold">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="hh-set-section-lbl">PRICE MODE</div>
        <div className="space-y-2" role="radiogroup" aria-label="Price mode">
          {[
            { id: 'Retail' as PriceType, label: 'Retail (MRP / Direct Retail Rate)' },
            { id: 'Wholesale' as PriceType, label: 'Wholesale (Bulk Kirana Shop Rate)' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={billingForm.defaultSaleType === opt.id}
              onClick={() => setBillingForm({ ...billingForm, defaultSaleType: opt.id })}
              className="hh-set-radio"
            >
              <span className="hh-set-radio__dot" aria-hidden="true" />
              <span className="text-sm font-bold">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="hh-set-section-lbl">TAX MODE</div>
        <div className="space-y-2" role="radiogroup" aria-label="Tax mode">
          {[
            { id: 'inclusive' as GstMode, label: 'GST Inclusive (Rate includes Tax)' },
            { id: 'off' as GstMode, label: 'GST Off / Non-Tax Bill' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={billingForm.defaultGstMode === opt.id}
              onClick={() => setBillingForm({ ...billingForm, defaultGstMode: opt.id })}
              className="hh-set-radio"
            >
              <span className="hh-set-radio__dot" aria-hidden="true" />
              <span className="text-sm font-bold">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="hh-set-section-lbl">LIMIT EXCEEDED</div>
        <div className="space-y-2" role="radiogroup" aria-label="Credit limit crossed">
          {[
            { id: 'Block', label: 'Block billing' },
            { id: 'Warn', label: 'Warn before billing' },
            { id: 'Allow', label: 'Allow without warning' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={billingForm.creditLimitCrossed === opt.id}
              onClick={() => setBillingForm({ ...billingForm, creditLimitCrossed: opt.id })}
              className="hh-set-radio"
            >
              <span className="hh-set-radio__dot" aria-hidden="true" />
              <span className="text-sm font-bold">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="hh-inv-field">
        <span className="hh-inv-field__label">INVOICE PREFIX</span>
        <input
          type="text"
          value={billingForm.invoicePrefix}
          onChange={(e) => setBillingForm({ ...billingForm, invoicePrefix: e.target.value.toUpperCase() })}
          placeholder="INV"
          className="uppercase"
        />
      </label>

      <div>
        <div className="hh-set-section-lbl">INVOICE NUMBERING SERIES</div>
        <div className="space-y-2" role="radiogroup" aria-label="Invoice numbering series">
          {[
            { id: 'shared' as const, label: `Shared sequence (${billingForm.invoicePrefix || 'INV'}-101, 102...)` },
            { id: 'per_salesman_series' as const, label: `Per-salesman series (${billingForm.invoicePrefix || 'INV'}-S1-1, S2-1...)` },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={billingForm.numberingMode === opt.id}
              onClick={() => setBillingForm({ ...billingForm, numberingMode: opt.id })}
              className="hh-set-radio"
            >
              <span className="hh-set-radio__dot" aria-hidden="true" />
              <span className="text-sm font-bold">{opt.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-1.5 leading-snug">
          Per-salesman series gives each field salesman their own number series so offline billing never creates duplicate GST numbers.
        </p>
      </div>

      <div>
        <div className="hh-set-section-lbl">SHARE MESSAGE STYLE</div>
        <div className="space-y-2" role="radiogroup" aria-label="WhatsApp message style">
          {[
            { id: 'detailed' as const, label: 'Detailed message (with icons)' },
            { id: 'receipt' as const, label: '80 mm receipt text' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={billingForm.whatsappTextStyle === opt.id}
              onClick={() => setBillingForm({ ...billingForm, whatsappTextStyle: opt.id })}
              className="hh-set-radio"
            >
              <span className="hh-set-radio__dot" aria-hidden="true" />
              <span className="text-sm font-bold">{opt.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2 leading-snug">
          Receipt text is used when the style above is the 80 mm receipt text.
        </p>
      </div>

      {billingForm.whatsappTextStyle === 'receipt' && (
        <label className="hh-inv-field">
          <span className="hh-inv-field__label">RECEIPT TEXT WIDTH (CHARACTERS)</span>
          <select
            value={billingForm.receiptTextWidth}
            onChange={(e) => setBillingForm({ ...billingForm, receiptTextWidth: Number(e.target.value) as 32 | 42 | 48 })}
          >
            <option value={32}>32 - fits a phone chat (WhatsApp)</option>
            <option value={42}>42 - 80 mm printer apps</option>
            <option value={48}>48 - 80 mm printer apps, small font</option>
          </select>
        </label>
      )}

      <button
        type="button"
        onClick={() => setShowMoreBilling((v) => !v)}
        className="w-full flex items-center justify-between px-1 py-2 text-xs font-bold text-[#2864d9] cursor-pointer"
      >
        <span>GST registration, stock &amp; receipt toggles</span>
        <ChevronDown size={16} className={`transition-transform ${showMoreBilling ? 'rotate-180' : ''}`} />
      </button>

      {showMoreBilling && (
        <div className="space-y-3 pb-2">
          <GstRegistrationCard />
          <div className="grid grid-cols-2 gap-2.5">
            <label className="hh-inv-field">
              <span className="hh-inv-field__label">EXPIRY ALERT (DAYS)</span>
              <input
                type="number"
                inputMode="numeric"
                value={billingForm.expiryAlertDays}
                onChange={(e) => setBillingForm({ ...billingForm, expiryAlertDays: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="hh-inv-field">
              <span className="hh-inv-field__label">MAX DISCOUNT (%)</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={billingForm.maxSalesmanDiscountPercent}
                onChange={(e) =>
                  setBillingForm({
                    ...billingForm,
                    maxSalesmanDiscountPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                  })
                }
              />
            </label>
          </div>
          <div className="hh-inv-card space-y-3">
            {[
              {
                id: 'm-earliest',
                label: 'Sell earliest expiry first',
                checked: billingForm.sellEarliestExpiryFirst,
                onChange: (v: boolean) => setBillingForm({ ...billingForm, sellEarliestExpiryFirst: v }),
              },
              {
                id: 'm-nostock',
                label: 'Allow selling without stock',
                checked: billingForm.allowSellingWithoutStock,
                onChange: (v: boolean) => setBillingForm({ ...billingForm, allowSellingWithoutStock: v }),
              },
              {
                id: 'm-round',
                label: 'Round off bill total',
                checked: billingForm.roundOffGrandTotal,
                onChange: (v: boolean) => setBillingForm({ ...billingForm, roundOffGrandTotal: v }),
              },
              {
                id: 'm-batch',
                label: 'Print batch numbers & expiry on invoices',
                checked: billingForm.showBatchOnInvoice,
                onChange: (v: boolean) => setBillingForm({ ...billingForm, showBatchOnInvoice: v }),
              },
              {
                id: 'm-upiqr',
                label: 'Print UPI QR on 80 mm receipt',
                checked: billingForm.showUpiQrOnReceipt,
                onChange: (v: boolean) => setBillingForm({ ...billingForm, showUpiQrOnReceipt: v }),
              },
              {
                id: 'm-odia',
                label: 'Print Odia product names on 80 mm receipt',
                checked: billingForm.showOdiaNameOnReceipt,
                onChange: (v: boolean) => setBillingForm({ ...billingForm, showOdiaNameOnReceipt: v }),
              },
              {
                id: 'm-gstfree',
                label: 'Charge GST on free scheme cases',
                checked: billingForm.gstOnFreeCases,
                onChange: (v: boolean) => setBillingForm({ ...billingForm, gstOnFreeCases: v }),
              },
              {
                id: 'm-autosc',
                label: 'Auto-apply qualifying schemes in Billing',
                checked: billingForm.autoApplyPromotions,
                onChange: (v: boolean) => setBillingForm({ ...billingForm, autoApplyPromotions: v }),
              },
            ].map((sw) => (
              <div key={sw.id} className="flex items-center justify-between gap-3">
                <span
                  id={`${sw.id}-lbl`}
                  onClick={() => sw.onChange(!sw.checked)}
                  className="text-xs font-semibold text-slate-800 cursor-pointer select-none"
                >
                  {sw.label}
                </span>
                <ToggleSwitch
                  id={sw.id}
                  size="sm"
                  checked={sw.checked}
                  onChange={sw.onChange}
                  ariaLabelledBy={`${sw.id}-lbl`}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

    <SettingsPhoneToast isSaving={isSaving} toastMessage={toastMessage} />

    <div className="hh-set-footer">
      <button
        type="button"
        disabled={isSaving}
        onClick={handleSaveAll}
        className="hh-inv-btn-primary w-full"
      >
        {isSaving ? 'Saving...' : 'Save settings'}
      </button>
    </div>
  </div>
);
