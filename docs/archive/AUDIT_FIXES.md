# Audit fixes

Fixed
- GSTIN: forms now use the same rule as the tax engine (format + state code + check character) via `src/tax/gstin.ts`. Previously the forms only checked the shape, so a mistyped GSTIN saved and then blocked billing. Added to: Customers/Suppliers save, Add Customer modal, Sell new-customer sheet. `invoiceAiValidation.ts` no longer carries its own copy of the checksum.
- Payments: `src/utils/paymentMerge.ts` is the single merge rule for browser and server. An empty shared collection now counts as an answer on the server too (it already did in the browser), so deleted receipts are not brought back from the old mirror. A `deleted_at` row no longer removes a receipt that was re-saved after the delete.
- Document numbers: client `floor` is capped (`DOC_FLOOR_HEADROOM`, default 200) so a bad client cannot leave a hole in the series; counter/hold saves are awaited and logged instead of fire-and-forget. Invoice prefix must be 1-6 letters/digits/-// when changed (keeps `PREFIX-S12-123456` within GST's 16 characters).
- Deletion lists keep 20,000 ids instead of 5,000 (older deletions no longer fall off and come back from a stale device).
- Client `deleteBill` no longer deletes from the cloud directly; it refuses (cancel instead) unless `VITE_ALLOW_BILL_DELETE=true`.
- Dates: overdue ageing uses IST calendar days (`daysSinceISO`) on desktop and phone; report/e-invoice file names use the IST date.
- CSV: one `src/utils/csv.ts` replaces four copies; it also quotes cells with a carriage return and defuses `=`/`@` formulas.
- README: deletion/sync section corrected.

Not changed (still open)
- Document-number state is held in server memory: run a single server process, or move the counter to a database sequence.
- A 12-hour number hold that expires on an idle device can be re-issued to another device.
- Remaining duplication (report export/format helpers, parallel inward and payments flows, server/client pull code outside payments) is untouched; it is a refactor best done screen by screen.
- Files referenced by the old changelog but missing from this zip (LoginPageEditor, LandingIcon, BillingWorkflow, SHORTAGE_AND_EDIT_LOAD_CHANGES.md, cleanup-test-data.sql) were not recreated.
- `.aistudio/` copies of images, the sample receipt PDF and the GST registration PDF are left in; remove them if they hold real data.
