import React, { Suspense, lazy, useState } from 'react';
import { useLedger } from './context/LedgerContext';
import { DesktopSidebar, Nav, TabletRail } from './components/common/Nav';
import { TopBar } from './components/common/TopBar';
import { AppHeader } from './components/common/AppHeader';
import { MobileNav } from './components/common/MobileNav';
import { ToastHost } from './components/common/ToastHost';
import { DialogHost } from './components/common/DialogHost';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { UpdatePrompt } from './components/common/UpdatePrompt';

const AuthScreen = lazy(() =>
  import('./components/common/AuthScreen').then((m) => ({ default: m.AuthScreen })),
);
const DashboardView = lazy(() =>
  import('./components/views/DashboardView').then((m) => ({ default: m.DashboardView })),
);
const BillingView = lazy(() =>
  import('./components/views/BillingView').then((m) => ({ default: m.BillingView })),
);
const CustomersView = lazy(() =>
  import('./components/views/CustomersView').then((m) => ({ default: m.CustomersView })),
);
const ProductsView = lazy(() =>
  import('./components/views/ProductsView').then((m) => ({ default: m.ProductsView })),
);
const InventoryView = lazy(() =>
  import('./components/views/InventoryView').then((m) => ({ default: m.InventoryView })),
);
const WarehousesView = lazy(() =>
  import('./components/views/WarehousesView').then((m) => ({ default: m.WarehousesView })),
);
const SupplierSchemesView = lazy(() =>
  import('./components/views/SupplierSchemesView').then((m) => ({ default: m.SupplierSchemesView })),
);
const PaymentsView = lazy(() =>
  import('./components/views/PaymentsView').then((m) => ({ default: m.PaymentsView })),
);
const ExpensesView = lazy(() =>
  import('./components/views/ExpensesView').then((m) => ({ default: m.ExpensesView })),
);
const CratesDepositsView = lazy(() =>
  import('./components/views/CratesDepositsView').then((m) => ({ default: m.CratesDepositsView })),
);
const PromotionsView = lazy(() =>
  import('./components/views/PromotionsView').then((m) => ({ default: m.PromotionsView })),
);
const TripsView = lazy(() =>
  import('./components/views/TripsView').then((m) => ({ default: m.TripsView })),
);
const ReportsView = lazy(() =>
  import('./components/views/ReportsView').then((m) => ({ default: m.ReportsView })),
);
const SettingsView = lazy(() =>
  import('./components/views/SettingsView').then((m) => ({ default: m.SettingsView })),
);
const SalesmanView = lazy(() =>
  import('./components/views/SalesmanView').then((m) => ({ default: m.SalesmanView })),
);
const ActivityLogView = lazy(() =>
  import('./components/views/ActivityLogView').then((m) => ({ default: m.ActivityLogView })),
);

const ViewFallback: React.FC = () => (
  <div
    role="status"
    aria-live="polite"
    className="flex items-center justify-center min-h-[240px] p-6 text-sm font-semibold text-slate-500"
  >
    Loading…
  </div>
);

export function App() {
  const { tab, currentUser, currentRole, highContrast } = useLedger();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!currentUser) {
    return (
      <>
        <Suspense fallback={<ViewFallback />}>
          <AuthScreen />
        </Suspense>
        <OfflineIndicator />
        <UpdatePrompt />
        <ToastHost />
        <DialogHost />
      </>
    );
  }

  if (currentRole === 'salesman') {
    return (
      <div id="app-root" className={highContrast ? 'high-contrast' : undefined}>
        <Suspense fallback={<ViewFallback />}>
          <SalesmanView />
        </Suspense>
        <OfflineIndicator />
        <UpdatePrompt />
        <ToastHost />
        <DialogHost />
      </div>
    );
  }

  const renderTab = () => {
    switch (tab) {
      case 'dashboard':
        return <DashboardView />;
      case 'billing':
        return <BillingView />;
      case 'customers':
        return <CustomersView />;
      case 'products':
        return <ProductsView />;
      case 'inventory':
        return <InventoryView initialSubTab="realtime" />;
      case 'grn':
        return <InventoryView initialSubTab="consignments" />;
      case 'audit':
        return <InventoryView initialSubTab="audit" />;
      case 'warehouses':
        return <WarehousesView />;
      case 'promotions':
        return <PromotionsView />;
      case 'supplierSchemes':
        return <SupplierSchemesView />;
      case 'payments':
        return <PaymentsView />;
      case 'expenses':
        return <ExpensesView />;
      case 'crates':
        return <CratesDepositsView />;
      case 'trips':
        return <TripsView />;
      case 'reports':
        return <ReportsView />;
      case 'salesmen':
        return <SettingsView initialSection="staff" />;
      case 'salesman':
        return <SalesmanView />;
      case 'activityLog':
        return <ActivityLogView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div id="app-root" className={`app-shell md:flex-row${highContrast ? ' high-contrast' : ''}`}>
      <DesktopSidebar />
      <TabletRail onOpenMenu={() => setMenuOpen(true)} />

      <div className="app-main">
        <AppHeader onMenuClick={() => setMenuOpen(true)} />
        <TopBar />

        <main className="app-content hh-main">
          <div className="flex-1 hh-page">
            <Suspense fallback={<ViewFallback />}>{renderTab()}</Suspense>
          </div>
        </main>
      </div>

      <MobileNav onOpenMenu={() => setMenuOpen(true)} />
      <Nav open={menuOpen} onClose={() => setMenuOpen(false)} />
      <OfflineIndicator />
      <UpdatePrompt />
      <ToastHost />
      <DialogHost />
    </div>
  );
}

export default App;
