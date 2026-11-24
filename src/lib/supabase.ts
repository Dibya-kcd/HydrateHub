/**
 * Barrel module for Supabase cloud sync & persistence.
 * Implementations live in focused domain modules under ./supabase/* with zero logic changes.
 */
export {
  clearSupabaseCustomConfig,
  getSupabaseClient,
  getSupabaseConfig,
  isServerProxyMode,
  isValidUuid,
  proxyFetch,
  saveSupabaseCustomConfig,
  setServerProxyModeForTest,
  testSupabaseConnection,
  type ConnectionTestResult,
  type ProxyFetchOptions,
  type SupabaseConfig,
  type SyncResult,
} from "./supabase/client";

export {
  changedOnlyClient,
  clearPushCache,
  resilientSupabaseUpsert,
} from "./supabase/pushCache";

export {
  collectionSeen,
  dropDeletedFromList,
  mergeConcurrentLists,
  noteCollectionContent,
  probeCloudChanges,
  pullDeletionLogFromSupabase,
  pullTombstonesFromSupabase,
  pushDeletionRecordsToSupabase,
  resetCloudReadCaches,
  writeCollectionMerged,
  type DeletionRecord,
} from "./supabase/tombstonesAndSync";

export {
  auditToDbRow,
  dbRowToAudit,
  dbRowToPayment,
  paymentToDbRow,
  pullPaymentHistoryFromSupabase,
  pushPaymentAuditEntryToSupabase,
  pushPaymentsToSupabase,
  softDeletePaymentsInSupabase,
} from "./supabase/payments";

export {
  deleteBillFromSupabase,
  deleteTripFromSupabase,
  pushBillToSupabase,
  pushTripToSupabase,
} from "./supabase/salesAndTrips";

export {
  deleteSalesmanFromSupabase,
  fetchSalesmenFromSupabase,
  getCurrentSupabaseSession,
  pushSalesmanToSupabase,
  signInAdminSupabase,
  signOutSupabase,
  verifySalesmanPinSupabase,
} from "./supabase/authAndStaff";

export {
  deleteAuditFromSupabase,
  deleteAuditSessionFromSupabase,
  deleteBatchFromSupabase,
  deleteGrnFromSupabase,
  deleteInventoryDispositionFromSupabase,
  deleteProductFromSupabase,
  deletePromotionFromSupabase,
  deleteSupplierCreditNoteFromSupabase,
  deleteSupplierSchemeFromSupabase,
  deleteWarehouseFromSupabase,
  fetchInventoryDispositionsFromSupabase,
  pullBillingSettingsFromSupabase,
  pullOrgProfileFromSupabase,
  pushAuditSessionToSupabase,
  pushAuditToSupabase,
  pushBatchToSupabase,
  pushBillingSettingsToSupabase,
  pushGrnEditLogToSupabase,
  pushInventoryDispositionToSupabase,
  pushOrgProfileToSupabase,
  pushProductToSupabase,
  pushPromotionToSupabase,
  pushReconciliationTransactionToSupabase,
  pushStockLedgerEntryToSupabase,
  pushSupplierCreditNoteToSupabase,
  pushSupplierSchemeApplicationToSupabase,
  pushSupplierSchemeToSupabase,
  pushWarehouseToSupabase,
} from "./supabase/inventoryAndSettings";

export {
  pullLedgerFromSupabase,
  pushInwardInvoiceToSupabase,
  pushLedgerToSupabase,
} from "./supabase/ledgerSync";

export {
  activityLogToDbRow,
  dbRowToActivityLog,
  pullActivityLogsFromSupabase,
  pushActivityLogsBatchToSupabase,
  pushActivityLogToSupabase,
} from "./supabase/activityLogs";

export { COMPLETE_SQL_SCHEMA_SCRIPT } from "./supabase/schemaSql";
