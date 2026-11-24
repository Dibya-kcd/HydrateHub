# Hydrate Hub / MrWater Distribution Ledger

Beverage distribution ledger: billing, inventory & GRNs, trips, customers, payments, reports. React + Vite PWA, Express
server (`server.ts`), Supabase cloud storage.

## Run
```bash
npm ci                       # install dependencies from lockfile
npm run dev                  # development (Express server + Vite middleware)
npm run lint                 # type-check (tsc --noEmit)
npm test                     # unit & Express API tests (MRWATER_TEST=1)
npm run build && npm start   # production build + Express server
```
Copy `.env.example` to `.env` and fill in your server secrets (`APP_SESSION_SECRET`, `ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY`).

## Before deploying this version
1. In the Supabase SQL editor run `migrations/010` to `013` (all are `IF NOT EXISTS`, safe to repeat). A brand-new project
   runs `supabase-schema.sql` first, then `migrations/003` to `013` in order.
2. Make sure you can sign in as admin (Supabase admin user, or `ADMIN_PASSWORD` + `APP_SESSION_SECRET` on the server).
3. Set production secrets in your host environment (`APP_SESSION_SECRET`, `ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`) and configure `ALLOWED_ORIGINS` / `TRUST_PROXY` if behind a reverse proxy.
4. **Do not copy a `data/` folder from an old install.** `data/collections.json` is the server's own cache of your live
   data; it is created automatically and must never be shipped (a stale copy overrides the database).
5. **Android APK & iOS IPA builds**: Run the manual GitHub Actions workflow `.github/workflows/build.yml` (`Build Web (Pages), Android APK and iOS IPA`), configuring `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `API_BASE_URL` under repository variables.

## How saving works (so edits and deletes stick)
- Every bill / GRN / trip save is "newest wins": a stale tab or device can never overwrite a newer edit.
- A saved invoice is never deleted: the server refuses `DELETE /api/bills/:id` (405) and the app cancels it with a credit
  note, keeping the number (a developer can switch deletes on with `ALLOW_BILL_DELETE=true` on the server and
  `VITE_ALLOW_BILL_DELETE=true` in the build). Deleting a GRN or trip records its id in `deleted_grn_ids` /
  `deleted_trip_ids`; cancelled/removed bill numbers are still never issued again. Server routes and cloud pulls honour
  those lists (each list keeps the newest 20,000 ids).
- Payments and customers are merged (never replaced; one shared rule in `src/utils/paymentMerge.ts` is used by both the browser and the server); the deletion log (`deleted_records`) removes deleted ones everywhere.
- Saving a bill on purpose clears an old delete mark for that number.
- The cloud pull never re-uploads this device's bills/trips when the cloud looks empty. Use "Sync to cloud" deliberately.

## Tests
`npm test` runs the unit and API tests in `tests/`. They set `MRWATER_TEST=1`, so the server cannot reach Supabase and
neither reads nor writes `data/collections.json`; the browser client also refuses to connect to the live database under
jsdom. Always keep that variable set if you run your own scripts against the server.

## Security roll-out
`security/RUNBOOK.md` (server sign-in, `API_AUTH_REQUIRED`, `lock-down-rls.sql`). Open items: salesman PINs are 4-6
digits (use 6); direct browser database calls remain until the lock-down step; e-way/e-invoice files are for bulk
upload only (no IRN/QR); confirm with your CA the ITC treatment of free cases.

## Layout
`server.ts` Express API + static files · `invoiceAi.ts` Gemini invoice reader · `server-auth.ts` sessions ·
`src/context/LedgerContext.tsx` app state & sync · `src/lib/supabase.ts` cloud access · `src/utils/storage.ts` server
calls · `src/components/views` screens · `migrations/` + `supabase-schema.sql` database · `public/` PWA icons.
