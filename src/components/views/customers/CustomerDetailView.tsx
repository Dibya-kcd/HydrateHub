import React from "react";
import {
  Bill,
  BillingSettings,
  ExistingCustomer,
  OrganizationProfile,
  PaymentMode,
  PaymentRecord,
  Product,
} from "../../../types";
import { money } from "../../../utils/billing";
import { normCustName } from "../../../context/ledgerHelpers";
import { nameFromMap } from "../../../hooks/useAutoOdiaName";
import { ConfirmModal } from "../../ui";
import { RecordPaymentModal } from "../../common/RecordPaymentModal";
import { RecordRefundModal } from "../../common/RecordRefundModal";
import { computeCustomerDetailLedger } from "./useCustomerDetailLedger";
import { CustomerDetailPhoneSection } from "./CustomerDetailPhoneSection";
import { CustomerDetailDesktopSection } from "./CustomerDetailDesktopSection";

export interface CustomerDetailViewProps {
  customer: ExistingCustomer;
  isPhone: boolean;
  language: "en" | "or";
  t: (key: string, vars?: Record<string, string | number>) => string;
  customerNameMap: Map<string, string>;
  customerTypeById: Map<string, string>;
  customerTypeByName: Map<string, string>;
  orgProfile?: OrganizationProfile;
  billingSettings: BillingSettings;
  products: Product[];
  existingCustomers: ExistingCustomer[];
  bills: Bill[];
  palette: any;
  phoneDetailTab: "summary" | "ledger";
  setPhoneDetailTab: React.Dispatch<React.SetStateAction<"summary" | "ledger">>;
  ledgerFilter: "all" | "bill" | "payment" | "return";
  setLedgerFilter: React.Dispatch<React.SetStateAction<"all" | "bill" | "payment" | "return">>;
  expandedLedgerEntryId: string | null;
  setExpandedLedgerEntryId: React.Dispatch<React.SetStateAction<string | null>>;
  waPhonePrompt: { text: string; input: string } | null;
  setWaPhonePrompt: React.Dispatch<React.SetStateAction<{ text: string; input: string } | null>>;
  showRecordPayment: boolean;
  setShowRecordPayment: React.Dispatch<React.SetStateAction<boolean>>;
  showRefund: boolean;
  setShowRefund: React.Dispatch<React.SetStateAction<boolean>>;
  onRouteBillAction: (bill: Bill, action: "edit" | "delete") => void;
  onRoutePaymentAction: (payment: PaymentRecord, action: "edit" | "delete") => void;
  customerToDelete: ExistingCustomer | null;
  setCustomerToDelete: React.Dispatch<React.SetStateAction<ExistingCustomer | null>>;
  setSelectedCustomer: React.Dispatch<React.SetStateAction<ExistingCustomer | null>>;
  openEditCustomer: (ec: ExistingCustomer) => void;
  startBillForCustomer: (name: string, phone?: string) => void;
  getCustomerLedger: (customerKey: string, phone?: string, altPhone?: string) => any;
  getCustomerCreditSummary: (customerName: string) => any;
  applyAdvanceToInvoices: (customerName: string) => void;
  recordCustomerRefund: (
    customerName: string,
    amount: number,
    date: string,
    mode?: PaymentMode,
    note?: string,
  ) => boolean;
  recordCustomerPayment: (
    customerName: string,
    amount: number,
    paymentDate: string,
    mode?: PaymentMode,
    referenceNote?: string,
    billId?: number,
    customerId?: string,
  ) => boolean;
  deleteCustomer: (id: string, comment?: string, opts?: { removePayments?: boolean }) => void;
}

export const CustomerDetailView: React.FC<CustomerDetailViewProps> = ({
  customer: c,
  isPhone,
  language,
  t,
  customerNameMap,
  customerTypeById,
  customerTypeByName,
  orgProfile,
  billingSettings,
  products,
  existingCustomers,
  bills,
  palette,
  phoneDetailTab,
  setPhoneDetailTab,
  ledgerFilter,
  setLedgerFilter,
  expandedLedgerEntryId,
  setExpandedLedgerEntryId,
  waPhonePrompt,
  setWaPhonePrompt,
  showRecordPayment,
  setShowRecordPayment,
  showRefund,
  setShowRefund,
  onRouteBillAction,
  onRoutePaymentAction,
  customerToDelete,
  setCustomerToDelete,
  setSelectedCustomer,
  openEditCustomer,
  startBillForCustomer,
  getCustomerLedger,
  getCustomerCreditSummary,
  applyAdvanceToInvoices,
  recordCustomerRefund,
  recordCustomerPayment,
  deleteCustomer,
}) => {
  const {
    ledger,
    creditLimit,
    openingBal,
    balanceDue,
    rawBalance,
    isOverLimit,
    entriesWithBalance,
    statementWaText,
    statementWaUrl,
    customerTypeLabel,
    creditSummary,
    hasAdvanceScreen,
    creditLimitPct,
    phoneLedgerEntries,
  } = computeCustomerDetailLedger({
    customer: c,
    language,
    customerNameMap,
    customerTypeById,
    customerTypeByName,
    orgProfile,
    ledgerFilter,
    getCustomerLedger,
    getCustomerCreditSummary,
  });

  return (
    <div id="view-customers" className="hh-view w-full min-w-0 pb-24">
      {isPhone ? (
        <CustomerDetailPhoneSection
          customer={c}
          language={language}
          t={t}
          customerNameMap={customerNameMap}
          billingSettings={billingSettings}
          ledger={ledger}
          creditLimit={creditLimit}
          openingBal={openingBal}
          balanceDue={balanceDue}
          rawBalance={rawBalance}
          isOverLimit={isOverLimit}
          creditSummary={creditSummary}
          hasAdvanceScreen={hasAdvanceScreen}
          creditLimitPct={creditLimitPct}
          customerTypeLabel={customerTypeLabel}
          statementWaText={statementWaText}
          statementWaUrl={statementWaUrl}
          phoneLedgerEntries={phoneLedgerEntries}
          phoneDetailTab={phoneDetailTab}
          setPhoneDetailTab={setPhoneDetailTab}
          ledgerFilter={ledgerFilter}
          setLedgerFilter={setLedgerFilter}
          expandedLedgerEntryId={expandedLedgerEntryId}
          setExpandedLedgerEntryId={setExpandedLedgerEntryId}
          waPhonePrompt={waPhonePrompt}
          setWaPhonePrompt={setWaPhonePrompt}
          setShowRecordPayment={setShowRecordPayment}
          setShowRefund={setShowRefund}
          onRouteBillAction={onRouteBillAction}
          onRoutePaymentAction={onRoutePaymentAction}
          setCustomerToDelete={setCustomerToDelete}
          setSelectedCustomer={setSelectedCustomer}
          openEditCustomer={openEditCustomer}
          startBillForCustomer={startBillForCustomer}
          applyAdvanceToInvoices={applyAdvanceToInvoices}
        />
      ) : (
        <CustomerDetailDesktopSection
          customer={c}
          language={language}
          customerNameMap={customerNameMap}
          billingSettings={billingSettings}
          products={products}
          ledger={ledger}
          creditLimit={creditLimit}
          openingBal={openingBal}
          balanceDue={balanceDue}
          rawBalance={rawBalance}
          isOverLimit={isOverLimit}
          creditSummary={creditSummary}
          statementWaUrl={statementWaUrl}
          entriesWithBalance={entriesWithBalance}
          setSelectedCustomer={setSelectedCustomer}
          setShowRecordPayment={setShowRecordPayment}
          setShowRefund={setShowRefund}
          onRouteBillAction={onRouteBillAction}
          onRoutePaymentAction={onRoutePaymentAction}
          setCustomerToDelete={setCustomerToDelete}
          openEditCustomer={openEditCustomer}
          startBillForCustomer={startBillForCustomer}
          applyAdvanceToInvoices={applyAdvanceToInvoices}
        />
      )}

      {/* Delete customer */}
      {customerToDelete && (
        <ConfirmModal
          isOpen
          title="Delete customer?"
          subtitle={`${customerToDelete.name}${customerToDelete.phone ? ` · ${customerToDelete.phone}` : ""}`}
          message="Remove this customer from the directory? Past bills and every payment stay in the records."
          impactItems={[
            { label: "Total Billed", detail: `₹${money(ledger.totalBilled)}` },
            { label: "Balance Due", detail: balanceDue > 0 ? `₹${money(balanceDue)}` : "Settled" },
          ]}
          confirmButtonLabel="Delete Customer"
          variant="danger"
          rectificationPrompt="Reason for deleting customer *"
          rectificationPlaceholder="e.g. Duplicate customer, merged account, business closed"
          reasonPresets={["Duplicate customer", "Merged account", "Business closed", "Test entry"]}
          commentMinLength={4}
          onConfirmWithOptions={({ comment, optionalChecked }) => {
            if (customerToDelete.id) {
              deleteCustomer(customerToDelete.id, comment || undefined, {
                removePayments: optionalChecked,
              });
            }
            setCustomerToDelete(null);
            setSelectedCustomer(null);
          }}
          onConfirm={() => {}}
          onClose={() => setCustomerToDelete(null)}
        />
      )}

      {/* Refund credit to customer */}
      {showRefund && (
        <RecordRefundModal
          customerName={nameFromMap(customerNameMap, c, language)}
          maxAmount={getCustomerCreditSummary(c.name).refundable}
          onClose={() => setShowRefund(false)}
          onSave={(amount, date, mode, note) =>
            recordCustomerRefund(c.name, amount, date, mode, note)
          }
        />
      )}

      {/* Record payment */}
      {showRecordPayment && (
        <RecordPaymentModal
          isOpen
          onClose={() => setShowRecordPayment(false)}
          initialCustomerName={nameFromMap(customerNameMap, c, language)}
          existingCustomers={existingCustomers}
          bills={bills}
          palette={palette}
          onSavePayment={(payload) => {
            recordCustomerPayment(
              payload.customerName,
              payload.amount,
              payload.paymentDate,
              payload.mode,
              payload.referenceNote,
              payload.billId,
              normCustName(payload.customerName) === normCustName(c.name) ? c.id : undefined,
            );
            setShowRecordPayment(false);
          }}
        />
      )}
    </div>
  );
};
