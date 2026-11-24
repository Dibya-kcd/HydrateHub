# Hydrate Hub — Production Cleanup Report

Branch: `chore/production-cleanup`  
Rule: **Zero behaviour change.** Anything uncertain is kept untouched and listed under **Needs human decision**.

---

## Before vs After Metrics

| Metric | Baseline (Before) | After Cleanup |
|---|---:|---:|
| Total repo files (excl. `node_modules/`, `.git/`, `dist/`, `data/`) | 530 | 523 (incl. `CLEANUP_REPORT.md`) |
| App source files (`.ts`/`.tsx`/`.css`, excl. `tests/` & `scripts/`) | 437 | 431 (-6) |
| App source LOC (excl. `tests/` & `scripts/`) | 189,516 | 184,164 (-5,352) |
| `dependencies` / `devDependencies` | 26 / 8 | 26 / 7 (-1 `autoprefixer`) |
| `npm run lint` (`tsc --noEmit`) | 0 errors | 0 errors |
| `tsc --noEmit --noUnusedLocals --noUnusedParameters` | 112 non-dead-file hits | 0 errors |
| `npm test` (`tests/*.test.ts*`) | 275 / 275 pass | 275 / 275 pass |
| `npm run build` warnings | 0 (2,299 modules) | 0 (2,297 modules) |
| `dist/` total size (`dist/assets/` file count) | 8,304,806 B (99 assets) | 8,251,948 B (96 assets) |
| PWA precache entries (`dist/sw.js`) | 111 entries (7968.61 KiB) | 111 entries (7928.33 KiB) |
| Largest CSS chunk (`dist/assets/index-*.css`) | 376.03 kB (gzip 59.39 kB) | 337.88 kB (gzip 53.02 kB) |
| Largest JS chunks (sample) | `InventoryView` 481.76 kB · `vendor-react` 429.51 kB · `xlsx` 429.18 kB · `jspdf.es.min` 386.43 kB · `app-i18n` 365.00 kB · `BulkInwardModal` 347.65 kB · `NewSaleScreen` 343.24 kB · `SalesmanView` 340.36 kB · `SettingsView` 302.18 kB · `PaymentsView` 232.92 kB · `index` 231.78 kB · `vendor-supabase` 227.07 kB | `InventoryView` 481.07 kB · `vendor-react` 429.51 kB · `xlsx` 429.18 kB · `jspdf.es.min` 386.43 kB · `app-i18n` 364.88 kB · `BulkInwardModal` 347.64 kB · `NewSaleScreen` 342.45 kB · `SalesmanView` 340.27 kB · `SettingsView` 302.08 kB · `PaymentsView` 232.09 kB · `index` 231.75 kB · `vendor-supabase` 227.07 kB |
| `dist/manifest.webmanifest` diff vs baseline | — | 0 diff |

### Main Screens & Runtime Smoke Verification
- Landing & Sign-in (`AuthScreen`: `#auth-landing`, `#auth-signin`, owner email/phone + salesman phone/PIN)
- Guided demo links (`#/demo`, `#/demo/salesman`, `#/demo/owner` via `DemoTourPage`, `SalesmanTour`, `OwnerTour`)
- Owner workspace (`DashboardView` Home, `BillingView` / `NewSaleScreen` Sell, `BillingHistoryView` Sales History, `PaymentsView` Payments, `CustomersView` Parties, `ProductsView` Products, `InventoryView` Inventory, `CratesDepositsView` Crates, `TripsView` / `TripEditScreen` Trips, `ReportsView` Reports, `PromotionsView` Promotions, `SupplierSchemesView` Supplier Credits, `ExpensesView` Expenses, `ActivityLogView` Activity, `SettingsView` Settings, `AuditView` / `SmartReconciliationView` Stock Audit)
- Salesman workspace (`SalesmanView`, `SalesmanSaleWorkflow`, `SalesmanCustomerDueLookup`, `SalesmanTripScreens`)
- Production Express server smoke check (`NODE_ENV=production MRWATER_TEST=1 npx tsx server.ts` against `dist/`): `/api/health` (`200 ok`), `/api/auth/me` (`401 AUTH_REQUIRED`), `/` (`200`, 2,617 B), `/manifest.webmanifest` (`200`, 564 B), `/sw.js` (`200`, 11,439 B). *(Headless Chromium visual click-through was not run because browser binaries are unavailable in this container.)*

---

## 1. Safe to Remove (Completed)

### Category A — Unused Files, Dead Components, Empty Directories (`chore(2a)`)
| Item | Reason |
|---|---|
| `src/components/common/OwnerDemo.tsx` | Legacy interactive demo superseded by `src/demo/OwnerTour.tsx`; zero imports in `src/`, `tests/`, config, or workflows. |
| `src/components/common/SalesmanDemo.tsx` | Legacy interactive demo superseded by `src/demo/SalesmanTour.tsx`; zero imports in `src/`, `tests/`, config, or workflows. |
| `src/components/common/demo/ownerDemoData.tsx` | Only imported by dead `OwnerDemo.tsx`; zero external references. |
| `src/components/common/demo/salesmanDemoData.tsx` | Only imported by dead `SalesmanDemo.tsx`; zero external references (`src/components/common/demo/` becomes empty). |
| `src/components/ui/StatCard.tsx` | Replaced by `HomeKit.tsx` (`HubMetricCard`); zero imports across `src/` and `tests/` (only re-exported by `src/components/ui/index.ts`). |
| `src/components/ui/Input.tsx` | Unused shadcn-style input primitive; zero imports across `src/` and `tests/` (only re-exported by `src/components/ui/index.ts`). |
| `src/data/` (empty directory) | Empty placeholder directory with zero tracked or runtime files. |

*(Note: `src/components/views/BillingWorkflow.tsx`, `LoginPageEditor.tsx`, `LandingIcon.tsx`, `SHORTAGE_AND_EDIT_LOAD_CHANGES.md`, `cleanup-test-data.sql`, `src/utils/tableCards.ts`, and `.aistudio/` are already absent from the workspace.)*

### Category B — Unused Code Inside Used Files (`chore(2b)`)
| Item | Reason |
|---|---|
| Unused imports, locals & ignored callback params flagged by `tsc --noEmit --noUnusedLocals --noUnusedParameters` (112 non-dead-file diagnostics) | Dead imports (`Check`, `ChevronUp`, `Filter`, etc.), retired quick-count form state in `AuditView.tsx`, unused destructured hooks (`addTrip`, `editingBillId`, `deleteBill`, `setGstMode`, `setSelectedDate`, `remainingStock`, etc.), and unused imports/locals in context/utils (`DO NOT TOUCH` business logic left 100% intact). |
| Unused UI kit exports (`Button.tsx`: `buttonVariants` export, `Badge.tsx`: `badgeVariants` export, `Card.tsx`: `CardHeader`/`CardFooter`/`CardTitle`/`CardDescription`, `Table.tsx`: `TableFooter`/`TableCaption`, `HomeKit.tsx`: `QtyStepper`, `ActionBar`, external `export` on `ProgressRing`/`StatusPill`) | Zero external imports across `src/` and `tests/`; `ProgressRing` and `StatusPill` stay internal to `HomeKit.tsx`. |
| Unused landing/demo exports (`demoPresets.ts`: `SAMPLE_BILLS_*`, `SAMPLE_TRIPS_*`; `landingContent.ts`: dead `writeLanding`/`resetLanding` from removed editor, external `export` on internal helpers) | Zero imports in `src/` or `tests/`; `useLandingContent` and `LandingContent` remain exported for `AuthScreen.tsx`. |

### Category C — Provably Identical Duplication & Unreferenced/Shadowed CSS (`chore(2c)`)
| Item | Reason |
|---|---|
| Duplicate `fmtRs` in `CustomerReceiptsReport.tsx`, `DayWiseReport.tsx`, `TotalReceiptsReport.tsx`, plus identical `MODE`, `card`, `fmtDay`, `fmtShort` in `CustomerReceiptsReport.tsx` | Byte-identical helpers consolidated in `src/components/views/payments/reportUi.tsx`. |
| Duplicate `rupees` in `EditBillModal.tsx` and `editBillHelpers.ts` | Byte-identical `(n: number) => \`₹${money(n)}\`` exported from `editBillHelpers.ts`. |
| Dead `CustomerSelectOption` and `buildCustomerOptions` in `newSaleHelpers.tsx` | Zero callers anywhere in `src/` or `tests/`; kept used helpers (`getProductDefaultPrice`, `sizeOfProduct`, `isSodaProduct`, `formatInr`, `ProductCardMedia`). |
| Dead CSS classes in `src/index.css` & `src/mobile-theme.css` (`.ui-card*`, `.ui-btn-*`, `.ui-tabs`, `.ui-tab`, `.ui-page-*`, `.ui-kpi*`, `.ui-table-wrap*`, `.ui-empty`, `.mw-sidebar*`, `.mw-nav-*`, `.mw-topbar`, `.mw-card`, `.mw-kicker`, `.mw-page-*`, `.mw-metric-*`, `.mw-chip*`, `.mw-list-*`, `.mw-status-*`, `.mw-panel-tint-*`, `.mobile-tab-bar*`, `.badge-*`, `.status-*`, `.section-title`, `.ios-card`, `.ui-stat`, `.reports-root`, `.mt-metric*`, `.mt-hero*`, `.mt-grid`, `.mt-section`, plus empty rules and `#view-*::before` lines 608–655 shadowed by `display: none !important` at 932–944) | Zero matches in `src/`, `tests/`, or `index.html` (or fully shadowed by `display: none !important`); `.mw-workspace` and cascade order / live `!important` rules preserved. |
| Dead CSS classes in `src/shell.css` & `src/auth.css` (`.hh-cartpane*`, `.hh-partycard*`, `.hh-picker__*`, `.hh-chips`, `.hh-header__greet`, `.hh-pay-dl`, `.hh-sell-pad` selector, `.hh-skeleton__row`, `.hh-stepper__input`, `.hh-actionbar*`, `.hh-tgrid-full`, `.rt-btn--paid`, `.rt-source-*`, `.hh-feat*`, `.hh-land__links`, `.hh-land__features*`, `.hh-land-phone__features`, `.hh-land-phone__links`, `.hh-land-phone__topbtn`) | Zero occurrences in any `.tsx`/`.ts`/`.html` file; live `.hh-chip`, `.hh-chip[data-active="true"]`, and dynamic `hh-tone-*` / `hh-avatar--*` / `hh-pill--*` / `hh-icon-badge--*` / `hh-attn*` classes preserved intact. |
| Unused `@utility dashboard-label`, `@utility glass-panel`, and `@utility ocean-button` in `src/styles.css` | Zero occurrences across `src/`, `tests/`, and `index.html`. |

### Category D — Unused Dependencies, `.gitignore`, Secret Scan (`chore(2d)`)
| Item | Reason |
|---|---|
| `autoprefixer` (`devDependencies` in `package.json` & `package-lock.json`) | Unused in Vite 7 (`@tailwindcss/vite` handles vendor prefixing); zero imports or config references. |
| `.gitignore` hardening | Added `.env.*` (with `!.env.example`), OS/editor files (`.DS_Store`, `Thumbs.db`, `.vscode/`, `.idea/`), Capacitor build outputs (`android/app/build/`, `ios/App/build/`, `Payload/`, `*.ipa`, `*.apk`), and generated test PDFs (`Receipt_*.pdf`). |

### Category E — Code Hygiene (`chore(2e)`)
| Item | Reason |
|---|---|
| Debug `console.log` in `src/context/hooks/useCloudSync.ts:1086` and `src/context/hooks/useDataManagementActions.ts:144` | Browser dev debug logs removed from production sync/purge paths; deliberate `console.warn`/`console.error` and server startup/operational logs kept intact. |
| Safe `as any` cleanup (6 casts in `OdiaName.tsx`, `SettingsFleetStaffDesktop.tsx`, `SettingsMobileFleetStaff.tsx`, `NewSaleSetupPanel.tsx`) | Replaced trivial `as any` casts with exact existing union/context types without altering runtime behaviour or touching complex domain/Supabase wrappers. |

### Category F & G — Documentation, `.env.example`, & Final Repo Hygiene (`chore(2f)`, `chore(2g)`)
| Item | Reason |
|---|---|
| `.env.example` sync | Documented all optional server/build env vars (`ALLOWED_ORIGINS`, `ALLOW_BILL_DELETE`, `VITE_ALLOW_BILL_DELETE`, `VITE_API_BASE_URL`, `VITE_BASE_PATH`, `ADMIN_PHONE`, `API_AUTH_REQUIRED`, `API_RATE_LIMIT_PER_MIN`, `TRUST_PROXY`, `HOST`, `IGNORE_DISK_CACHE`, `DOC_FLOOR_HEADROOM`, `DOC_HOLD_TTL_MS`, `GEMINI_MODELS`) as commented placeholders with zero secrets. |
| `README.md` cleanup | Synced scripts (`npm ci`, `npm test`), replaced stale `cleanup-test-data.sql` step with host secret/CORS configuration, and documented manual Capacitor APK/IPA CI workflow. |
| `bun.lock` (deleted & gitignored) | Repo scripts, `README.md`, and `.github/workflows/build.yml` standardize on `npm` + `package-lock.json` (added to `.gitignore` so container runtime regeneration stays untracked). |
| `public/manifest.json` (deleted) | Unreferenced duplicate manifest; `vite-plugin-pwa` generates `dist/manifest.webmanifest` from `vite.config.ts` with proper `base` ID and injects its `<link rel="manifest">`. |
| `AUDIT_FIXES.md` → `docs/archive/AUDIT_FIXES.md` (moved) | Archived historical audit note out of repository root without losing history. |

---

## 2. Needs Human Decision (Kept Untouched)

| Item | Reason |
|---|---|
| Pre-filled `VITE_SUPABASE_URL` & publishable `VITE_SUPABASE_ANON_KEY` in `.env.example` | Publishable/anon key is public by design and used by `server.ts` as local dev fallback when `.env` is absent; confirm if you prefer generic placeholders instead. |
| Large unused `knip` exports in `src/tax/`, `src/utils/`, `src/lib/`, `src/context/`, `src/components/views/*` | Many are library/module APIs (`fefo.ts`, `validation.ts`, `beats.ts`, `LedgerContext.tsx` re-exports) or helpers reserved for upcoming features; kept under `DO NOT TOUCH` / "when in doubt, keep". |
| 112 i18n keys in `src/i18n/translations.ts` without exact literal string matches | Kept per zero-change rule on `src/i18n/*` translations and potential indirect key construction. |
| Structural clones in `src/context/`, `src/lib/supabase/`, `src/utils/mixedBillSplit.ts`, and desktop/mobile sibling JSX (`PurchasesReport`/`TripsReport`, `SalesmanSaleDesktopFlow`/`SalesmanSalePhoneFlow`, `SalesMarginSubTables`) | Per `DO NOT TOUCH` on business/Supabase logic and zero-UX-risk policy on divergent phone/desktop JSX; left untouched. |
| `invoiceAi.ts` `console.log` (`:236, :438, :440`) and `server/supabaseStore.ts:167`, `server.ts:161` | Operational server diagnostics for Gemini invoice reading, disk-cache fallback, and server port listening; kept unless you prefer structured/debug-only logging. |
| `AuthScreen.tsx` dormant `voiceAssist` state (`const [voiceAssist] = useState(false)`) | `setVoiceAssist` had no UI caller; removed only the unused setter so runtime logic stays identical until voice-assist UI is either wired or formally retired. |
| `package.json` `dependencies` vs `devDependencies` placement (`vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `tsx`, `tw-animate-css`) | Note `vite` and `tsx` are imported/executed at runtime by `server.ts` (`vite.middlewares` in dev) and `"start": "NODE_ENV=production tsx server.ts"`; left in `dependencies` so `npm install --omit=dev` works in production. |

---

## 3. Keep (Looks Unused, Actually Used / Required)

| Item | Reason |
|---|---|
| `public/service-worker.js` | Deliberate retired-SW killer referenced by `src/registerServiceWorker.ts` (`'/service-worker.js'`) to unregister legacy caches on existing devices. |
| `scripts/generate-icons.ts` | Developer CLI script that regenerates `public/` PWA icons and `assets/` Capacitor icons from `public/icon.svg`. |
| `security/check-rls.mjs`, `security/lock-down-rls.sql`, `security/undo-lock-down-rls.sql`, `security/RUNBOOK.md` | Security verification scripts and SQL hardening runbook referenced in `README.md`. |
| `invoiceAi.ts` (repo root) | Actively imported by `server/routes/systemRoutes.ts` (`from "../../invoiceAi"`); NOT an orphan root file. |
| `assets/*.png` (`icon-*.png`, `splash*.png`) | Used by `@capacitor/assets generate` in `.github/workflows/build.yml` for Android/iOS builds. |
| `@capacitor/core`, `@capacitor/android`, `@capacitor/ios`, `@capacitor/cli` | Required by `capacitor.config.ts` and `.github/workflows/build.yml` native APK/IPA pipelines (`knip` flags them because native projects are generated in CI). |
| `tw-animate-css`, `class-variance-authority`, `@radix-ui/react-slot`, `clsx`, `tailwind-merge` | Imported by `src/styles.css` (`tw-animate-css`), `Button.tsx`, `Badge.tsx`, and `src/lib/utils.ts`. |
| `src/styles.css` | Imported via `@import "./styles.css"` on line 1 of `src/index.css`. |
| `src/components/ui/Table.tsx` | Imported by `SupplierSchemesTabsSection.tsx` (`Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`). |
| `.hh-chip`, `.hh-chip[data-active="true"]`, and dynamic `hh-tone-*`, `hh-avatar--*`, `hh-pill--*`, `hh-icon-badge--*`, `hh-attn*`, `hh-land-phone__*`, `rt-tag--*` CSS rules | Used in `RecordPaymentModal.tsx` and constructed dynamically via template literals in `HomeKit.tsx`, `DashboardView.tsx`, `AuthScreen.tsx`, etc. |
| `Receipt_PAY-1042_Sri_Jagannath_General_Store_80mm.pdf` (when generated) | Transient runtime output of `tests/whatsappPaymentReceipt.test.ts` under `npm test` (now gitignored via `Receipt_*.pdf`). |
| Secret scan (`grep` for `service_role`, `sk-`, `AIza`, `eyJ...`) | 0 real secrets found in tracked files (`.env*` files are gitignored). |

---

## 4. Production Deployment Checklist

1. **Secrets & Environment**: Set strong server-only secrets (`APP_SESSION_SECRET` ≥ 32 chars, `ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`) in the host environment. Never prefix secrets with `VITE_`.
2. **Proxy & CORS**: Set `TRUST_PROXY=1` behind Reverse Proxy / Load Balancer, set `ALLOWED_ORIGINS` if web/Capacitor builds hit a separate API host, and ensure `API_AUTH_REQUIRED` is not `false`.
3. **Database Migrations & RLS**: Confirm Supabase `migrations/010`–`013` are applied, verify RLS via `security/check-rls.mjs` + `security/RUNBOOK.md`, and do **not** ship a local `data/collections.json` folder.
4. **Build & Verify**: Run `npm ci && npm run lint && npm test && npm run build` and verify `/api/health` returns `200 {"status":"ok"}` after deploy.
5. **Visual Spot Check**: In a desktop + mobile browser, click through Landing/Sign-in, `#/demo`, `#/demo/owner`, `#/demo/salesman`, Home, Sell, Payments, Trips, Reports, Settings, and Salesman View.

