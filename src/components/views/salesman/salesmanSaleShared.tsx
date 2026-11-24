import React, { useState } from 'react';
import { Bill, BillItem, ExistingCustomer, PriceType, Product, Trip } from '../../../types';
import { PackIcon } from '../../common/PackIcon';

export const SalesmanProductMedia: React.FC<{ product: Product }> = ({ product }) => {
  const imgSrc = (product as any).imageUrl || (product as any).image;
  const [failed, setFailed] = useState(false);
  if (imgSrc && !failed) {
    return (
      <img
        src={imgSrc}
        alt={product.name}
        className="rt-prod-media__img"
        onError={() => setFailed(true)}
      />
    );
  }
  return <PackIcon pack={product.pack} name={product.name} />;
};

export interface SalesmanSaleSmartHint {
  id: string;
  tone: 'amber' | 'rose' | 'sky' | 'emerald';
  text: string;
}

export interface SalesmanSaleWorkflowProps {
  confirmedBill: Bill | null;
  setConfirmedBill: (bill: Bill | null) => void;
  /** Opens the invoice preview / print modal for a bill (shows the Print button on the confirmation screen). */
  onOpenInvoiceModal?: (bill: Bill, defaultFormat?: 'gst' | 'non_gst') => void;
  cart: {
    items: BillItem[];
    date?: string;
  };
  activeTrip: Trip | null;
  products: Product[];
  customers: ExistingCustomer[];
  selectedRetailer: string;
  setSelectedRetailer: (name: string) => void;
  retailerPhone: string;
  setRetailerPhone: (phone: string) => void;
  /** remembers which registered customer record was picked (empty for a one-off typed name) */
  setRetailerCustomerId?: (id: string) => void;
  priceType: PriceType;
  setPriceType: (pt: PriceType) => void;
  isLowVision: boolean;
  palette: any;
  scale: number;
  finalCartTotal: number;
  getVehicleStock: (trip: Trip | null, productId: number) => { loaded: number; sold: number; available: number };
  getProductCartQty: (productId: number) => number;
  onQuickProductCartChange: (productId: number, delta: number) => boolean | void;
  onOpenCart: () => void;
  onCancelSaleSequence: () => void;
  onCreateNextInvoice?: () => void;
  onOpenCustomerDirectory?: () => void;
  onVoiceSearchCustomer: () => void;
  isVoiceSearching: boolean;
  speakAssistiveText: (text: string) => void;
  onSetSalesmanTab: (tab: 'home' | 'sell' | 'vanStock' | 'bills' | 'customerDue' | 'trips') => void;
  orgProfile?: any;
  billingSettings?: any;
  saleDate?: string;
  setSaleDate?: (d: string) => void;
  availableTrips?: Trip[];
  onSelectTripId?: (id: number) => void;
  onOpenNewVanModal?: () => void;
}
