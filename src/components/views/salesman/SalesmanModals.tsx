import React from 'react';
import {
  FileText,
  IndianRupee,
  LayoutGrid,
  Package,
  ShoppingCart,
  Truck,
  X,
} from 'lucide-react';
import { Bill, ExistingCustomer, PriceType, Product, Trip } from '../../../types';
import { money } from '../../../utils/billing';
import { CustomerSelector } from '../../common/CustomerSelector';
import { AddCustomerModal } from '../../common/AddCustomerModal';
import { TaxInvoiceModal } from '../../common/TaxInvoiceModal';
import { SalesmanCartModal } from '../../common/SalesmanCartModal';
import { NewTripSheet } from '../trips/NewTripSheet';
import { SalesmanTabId } from './SalesmanHeader';

interface SalesmanModalsProps {
  showNewVanModal: boolean;
  setShowNewVanModal: (b: boolean) => void;
  products: Product[];
  warehouses: any[];
  salesmen: any[];
  trips: Trip[];
  activeBeats: { name: string }[];
  defaultWarehouse: any;
  warehouseStock: any;
  createTrip: any;
  userSalesmanId?: string;
  userSalesmanName?: string;
  newVehicleName: string;
  setSelectedTripId: (id: number | null) => void;
  triggerFeedback: (text: string, type?: 'success' | 'warn') => void;
  showAllRetailersModal: boolean;
  setShowAllRetailersModal: (b: boolean) => void;
  retailerSearch: string;
  setRetailerSearch: (s: string) => void;
  frequentRetailers: { name: string; phone: string }[];
  palette: any;
  scale: number;
  selectedRetailer: string;
  setSelectedRetailer: (name: string) => void;
  retailerPhone: string;
  setRetailerPhone: (phone: string) => void;
  setRetailerCustomerId: (id: string) => void;
  invoiceModalBill: Bill | null;
  setInvoiceModalBill: (b: Bill | null) => void;
  showCustomerSelectorModal: boolean;
  setShowCustomerSelectorModal: (b: boolean) => void;
  existingCustomers: ExistingCustomer[];
  isLowVision: boolean;
  speakAssistiveText: (text: string) => void;
  isCartOpen: boolean;
  setIsCartOpen: (b: boolean) => void;
  cart: any;
  activeTrip: Trip | null;
  amountPaidDraft: string;
  setAmountPaidDraft: (v: string) => void;
  invoiceDiscountDraft: string;
  settledTotalDraft: string;
  handleDiscountChange: (val: string) => void;
  handleSettledTotalChange: (val: string) => void;
  applyQuickDiscount: (amt: number, isPercent?: boolean) => void;
  autoSendWhatsApp: boolean;
  setAutoSendWhatsApp: (b: boolean) => void;
  lastFinalizedWhatsApp: { id: number; phone: string; url: string; bill: Bill } | null;
  handleUpdateCartQty: (key: string | number, newQty: number) => void;
  handleUpdateCartRate: (key: string | number, newRate: number) => void;
  handleUpdateCartDiscount: (key: string | number, newDiscount: number) => void;
  handleToggleCartPriceType: (key: string | number, newPriceType: PriceType) => void;
  handleRemoveCartItem: (key: string | number) => void;
  handleFinalizeSale: () => void;
  handleCancelSaleSequence: () => void;
  handleVoiceSearchCustomer: () => void;
  isVoiceSearching: boolean;
  getVehicleStock: (trip: Trip | null, productId: number) => { loaded: number; sold: number; available: number };
  handleQuickProductCartChange: (productId: number, delta: number) => void;
  priceType: PriceType;
  finalCartTotal: number;
  salesmanTab: SalesmanTabId;
  setSalesmanTab: (tab: SalesmanTabId) => void;
  zoomScale: number;
  setZoomScale: (z: number) => void;
  showHomeAddCustomerModal: boolean;
  setShowHomeAddCustomerModal: (b: boolean) => void;
}

export const SalesmanModals: React.FC<SalesmanModalsProps> = ({
  showNewVanModal,
  setShowNewVanModal,
  products,
  warehouses,
  salesmen,
  trips,
  activeBeats,
  defaultWarehouse,
  warehouseStock,
  createTrip,
  userSalesmanId,
  userSalesmanName,
  newVehicleName,
  setSelectedTripId,
  triggerFeedback,
  showAllRetailersModal,
  setShowAllRetailersModal,
  retailerSearch,
  setRetailerSearch,
  frequentRetailers,
  palette,
  scale,
  selectedRetailer,
  setSelectedRetailer,
  retailerPhone,
  setRetailerPhone,
  setRetailerCustomerId,
  invoiceModalBill,
  setInvoiceModalBill,
  showCustomerSelectorModal,
  setShowCustomerSelectorModal,
  existingCustomers,
  isLowVision,
  speakAssistiveText,
  isCartOpen,
  setIsCartOpen,
  cart,
  activeTrip,
  amountPaidDraft,
  setAmountPaidDraft,
  invoiceDiscountDraft,
  settledTotalDraft,
  handleDiscountChange,
  handleSettledTotalChange,
  applyQuickDiscount,
  autoSendWhatsApp,
  setAutoSendWhatsApp,
  lastFinalizedWhatsApp,
  handleUpdateCartQty,
  handleUpdateCartRate,
  handleUpdateCartDiscount,
  handleToggleCartPriceType,
  handleRemoveCartItem,
  handleFinalizeSale,
  handleCancelSaleSequence,
  handleVoiceSearchCustomer,
  isVoiceSearching,
  getVehicleStock,
  handleQuickProductCartChange,
  priceType,
  finalCartTotal,
  salesmanTab,
  setSalesmanTab,
  zoomScale,
  setZoomScale,
  showHomeAddCustomerModal,
  setShowHomeAddCustomerModal,
}) => {
  return (
    <>
      {showNewVanModal && (
        <NewTripSheet
          products={products}
          warehouses={warehouses}
          salesmen={salesmen}
          vehicles={Array.from(new Set(trips.map((t) => (t.vehicle || '').trim()).filter(Boolean))).sort((x, y) => x.localeCompare(y))}
          routes={activeBeats.map((b) => b.name)}
          defaultWarehouseId={defaultWarehouse?.id || warehouses[0]?.id || ''}
          warehouseStock={warehouseStock}
          attachableBills={createTrip.attachable}
          lockedSalesman={userSalesmanId ? { id: userSalesmanId, name: userSalesmanName || 'Salesman' } : undefined}
          initialVehicle={newVehicleName}
          onSubmit={(payload) => {
            const res = createTrip.create(payload);
            if (res.ok === false) return res.error;
            setSelectedTripId(res.trip.id);
            setShowNewVanModal(false);
            triggerFeedback(
              `Vehicle ${payload.vehicle} loaded with ${res.total} cases${res.godowns > 1 ? ` from ${res.godowns} godowns` : ''}!`,
              'success',
            );
            return null;
          }}
          onClose={() => setShowNewVanModal(false)}
        />
      )}

      {showAllRetailersModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            className="w-full max-w-md rounded-xl border-2 shadow-2xl p-5"
            style={{
              backgroundColor: palette.panel,
              borderColor: palette.line,
              color: palette.ink,
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b-2" style={{ borderColor: palette.line }}>
              <h3 className="font-black text-base">Select or Add Retailer Shop</h3>
              <button
                aria-label="Close"
                type="button"
                onClick={() => setShowAllRetailersModal(false)}
                className="p-1 rounded hover:bg-black/10 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <input
                type="text"
                autoFocus
                value={retailerSearch}
                onChange={(e) => setRetailerSearch(e.target.value)}
                placeholder="Type shop name..."
                className="w-full p-2.5 text-sm font-bold border-2 rounded"
                style={{ borderColor: palette.line }}
              />

              <div className="max-h-56 overflow-y-auto space-y-1.5">
                {frequentRetailers
                  .filter((r) => r.name.toLowerCase().includes(retailerSearch.toLowerCase()))
                  .map((r) => (
                    <button
                      key={r.name}
                      type="button"
                      onClick={() => {
                        setSelectedRetailer(r.name);
                        setRetailerPhone(r.phone);
                        setRetailerCustomerId('');
                        setShowAllRetailersModal(false);
                      }}
                      className="w-full p-2.5 text-left text-xs font-bold rounded border hover:bg-black/5 cursor-pointer flex justify-between items-center"
                    >
                      <span>{r.name}</span>
                      {r.phone && <span className="opacity-60">{r.phone}</span>}
                    </button>
                  ))}
              </div>

              {retailerSearch.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRetailer(retailerSearch.trim());
                    setShowAllRetailersModal(false);
                  }}
                  className="w-full py-2.5 text-xs font-black rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                >
                  Use "{retailerSearch.trim()}" as New Customer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {invoiceModalBill && (
        <TaxInvoiceModal
          bill={invoiceModalBill}
          onClose={() => setInvoiceModalBill(null)}
        />
      )}

      {showCustomerSelectorModal && (
        <CustomerSelector
          customers={existingCustomers}
          currentRetailer={selectedRetailer}
          palette={palette}
          scale={scale}
          onSelect={(c) => {
            setSelectedRetailer(c.name);
            setRetailerPhone(c.phone || '');
            setRetailerCustomerId(c.id || '');
            setShowCustomerSelectorModal(false);
            if (isLowVision) speakAssistiveText(`Selected customer ${c.name}`);
          }}
          onClose={() => setShowCustomerSelectorModal(false)}
        />
      )}

      <SalesmanCartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        isLowVision={isLowVision}
        palette={palette}
        scale={scale}
        activeTrip={activeTrip}
        products={products}
        selectedRetailer={selectedRetailer}
        setSelectedRetailer={setSelectedRetailer}
        retailerPhone={retailerPhone}
        setRetailerPhone={setRetailerPhone}
        customers={existingCustomers}
        amountPaidDraft={amountPaidDraft}
        setAmountPaidDraft={setAmountPaidDraft}
        invoiceDiscountDraft={invoiceDiscountDraft}
        settledTotalDraft={settledTotalDraft}
        handleDiscountChange={handleDiscountChange}
        handleSettledTotalChange={handleSettledTotalChange}
        applyQuickDiscount={applyQuickDiscount}
        autoSendWhatsApp={autoSendWhatsApp}
        setAutoSendWhatsApp={setAutoSendWhatsApp}
        lastFinalizedWhatsApp={lastFinalizedWhatsApp}
        onUpdateQty={handleUpdateCartQty}
        onUpdateRate={handleUpdateCartRate}
        onUpdateDiscount={handleUpdateCartDiscount}
        onTogglePriceType={handleToggleCartPriceType}
        onRemoveItem={handleRemoveCartItem}
        onFinalize={handleFinalizeSale}
        onCancelSale={handleCancelSaleSequence}
        onOpenCustomerDirectory={() => setShowCustomerSelectorModal(true)}
        onVoiceSearchCustomer={handleVoiceSearchCustomer}
        isVoiceSearching={isVoiceSearching}
        getVehicleStock={getVehicleStock}
        onAddProduct={handleQuickProductCartChange}
        priceType={priceType}
      />

      {isLowVision && cart.items.length > 0 && (
        <div className="fixed bottom-20 right-4 z-40">
          <button
            type="button"
            id="btn-floating-cart"
            onClick={() => {
              setIsCartOpen(true);
              speakAssistiveText(`Cart opened. ${cart.items.length} items.`);
            }}
            className="px-4 py-3 rounded-full border-3 shadow-2xl flex items-center gap-2.5 cursor-pointer font-black transition-transform hover:scale-105 active:scale-95 bg-yellow-400 text-black border-black text-base ring-4 ring-yellow-300/60"
          >
            <div className="relative">
              <ShoppingCart size={22} />
              <span className="absolute -top-2.5 -right-2.5 px-1.5 py-0.2 rounded-full font-black text-xs bg-black text-yellow-300">
                {cart.items.length}
              </span>
            </div>
            <span>Cart ({cart.items.length}) • ₹{money(finalCartTotal)}</span>
          </button>
        </div>
      )}

      <nav
        id="salesman-bottom-nav"
        aria-label="Salesman navigation"
        className="fixed bottom-0 inset-x-0 z-40 w-full max-w-[100vw] bg-slate-900 border-t-2 border-slate-800 shadow-2xl select-none"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          backgroundColor: '#0F172A',
        }}
      >
        <div className="w-full grid grid-cols-6 items-stretch px-0.5">
          {[
            { id: 'home', label: 'Home', icon: LayoutGrid },
            { id: 'sell', label: 'Sales', icon: ShoppingCart },
            { id: 'customerDue', label: 'Payment', icon: IndianRupee },
            { id: 'trips', label: 'Trips', icon: Truck },
            { id: 'vanStock', label: 'Stock', icon: Package },
            { id: 'bills', label: 'My Bills', icon: FileText },
          ].map(({ id, label, icon: Icon }) => {
            const active = salesmanTab === id;
            return (
              <button
                key={id}
                id={`salesman-nav-${id}`}
                type="button"
                onClick={() => {
                  setSalesmanTab(id as SalesmanTabId);
                  if (isLowVision) speakAssistiveText(`${label} screen active.`);
                }}
                aria-current={active ? 'page' : undefined}
                className={`min-h-[56px] w-full py-1.5 px-0.5 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                  active ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-white font-semibold'
                }`}
              >
                <div className={`p-1 rounded-lg ${active ? 'bg-amber-400/20 text-amber-400' : ''}`}>
                  <Icon size={19} />
                </div>
                <span className="text-xs sm:text-xs leading-none text-center whitespace-nowrap">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {zoomScale !== 1.0 && (
        <button
          type="button"
          id="btn-reset-zoom"
          onClick={() => setZoomScale(1.0)}
          className="fixed top-16 right-4 z-40 px-3 py-1.5 rounded-full bg-slate-900/90 text-white text-xs font-black shadow-lg border border-slate-700 flex items-center gap-1.5 backdrop-blur-sm cursor-pointer hover:bg-black"
          title="Reset zoom to 1.0x"
        >
          <span>{zoomScale.toFixed(2)}x</span>
          <span className="text-amber-400 ml-1">Reset</span>
        </button>
      )}

      <AddCustomerModal
        isOpen={showHomeAddCustomerModal}
        onClose={() => setShowHomeAddCustomerModal(false)}
        defaultRoute={activeTrip?.route || ''}
        isLowVision={isLowVision}
        onCustomerCreated={(newCust) => {
          setSelectedRetailer(newCust.name);
          setRetailerPhone(newCust.phone || '');
          setRetailerCustomerId(newCust.id);
          setSalesmanTab('sell');
          triggerFeedback(`New customer "${newCust.name}" added to route. Ready for billing!`, 'success');
          speakAssistiveText(`Customer ${newCust.name} added. Ready for sale.`);
        }}
      />
    </>
  );
};
