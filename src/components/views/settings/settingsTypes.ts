import { GstMode, PriceType } from '../../../types';

export const INDIAN_STATES = [
  '27 Maharashtra',
  '24 Gujarat',
  '29 Karnataka',
  '07 Delhi',
  '36 Telangana',
  '33 Tamil Nadu',
  '09 Uttar Pradesh',
  '19 West Bengal',
  '23 Madhya Pradesh',
  '08 Rajasthan',
  '21 Odisha',
  '03 Punjab',
  '06 Haryana',
  '32 Kerala',
  '10 Bihar',
  '37 Andhra Pradesh',
];

export type SettingsSection =
  | 'business'
  | 'billing'
  | 'fleet'
  | 'beats'
  | 'staff'
  | 'display'
  | 'cloud'
  | 'backups';

export interface ProfileFormState {
  name: string;
  tagline: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  gstin: string;
  pan: string;
  fssai: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
  invoiceTerms: string;
}

export interface BillingFormState {
  printLayout: string;
  creditLimitCrossed: string;
  expiryAlertDays: number;
  sellEarliestExpiryFirst: boolean;
  allowSellingWithoutStock: boolean;
  invoicePrefix: string;
  defaultSaleType: PriceType;
  defaultGstMode: GstMode;
  lowStockThreshold: number;
  maxSalesmanDiscountPercent: number;
  roundOffGrandTotal: boolean;
  showBatchOnInvoice: boolean;
  gstOnFreeCases: boolean;
  schemesEnabled: boolean;
  autoApplyPromotions: boolean;
  showUpiQrOnReceipt: boolean;
  showOdiaNameOnReceipt: boolean;
  defaultInvoicePaper: 'a4' | '80mm';
  whatsappTextStyle: 'detailed' | 'receipt';
  receiptTextWidth: 32 | 42 | 48;
  numberingMode: 'shared' | 'per_salesman_series';
}
