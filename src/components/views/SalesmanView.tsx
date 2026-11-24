import React, { useState, useMemo, useEffect } from 'react';
import { SalesmanTripScreens, SalesmanTripScreenMode } from "./trips/SalesmanTripScreens";
import { useCreateTrip } from "./trips/useCreateTrip";
import { useLedger } from '../../context/LedgerContext';
import { normCustName, splitSameNameShops } from '../../context/ledgerHelpers';
import { Bill, BillItem, ExistingCustomer, PriceType, Trip } from '../../types';
import { billTotals, computeLine, schemeLabel, whatsappLink, resolveProductGstRate, resolveProductHsn } from '../../utils/billing';
import { tripPrimaryWarehouseId } from '../../utils/tripLoads';
import { isSpeechRecognitionSupported, speakAssistiveText, startSpeechRecognition } from '../../utils/speechRecognition';
import { cartTaxMix, formatBillNumber } from '../../utils/invoiceCommon';
import { SalesmanSaleWorkflow } from './SalesmanSaleWorkflow';
import { SalesmanCustomerDueLookup } from './SalesmanCustomerDueLookup';
import { SalesmanHomeTab } from './salesman/SalesmanHomeTab';
import { SalesmanVanStockTab } from './salesman/SalesmanVanStockTab';
import { SalesmanBillsTab } from './salesman/SalesmanBillsTab';
import { SalesmanTripsTab } from './salesman/SalesmanTripsTab';
import { SalesmanHeader, SalesmanTabId } from './salesman/SalesmanHeader';
import { SalesmanModals } from './salesman/SalesmanModals';
import { useSalesmanPinchZoom } from './salesman/useSalesmanPinchZoom';
import { useSalesmanMetrics } from './salesman/useSalesmanMetrics';
import { useBeats } from '../../hooks/useBeats';
import { todayISO } from "../../utils/dateLocal";
import { buildBillMessage } from '../../utils/receiptText';

export const SalesmanView: React.FC = () => {
  const { activeBeats } = useBeats();
  const createTrip = useCreateTrip();
  const {
    trips,
    bills,
    getBillById,
    products,
    warehouses,
    defaultWarehouse,
    warehouseStock,
    finalizeBill,
    finalizeSplitBills,
    getVehicleStock,
    cart,
    setCart,
    palette,
    lowVisionMode,
    fz,
    scale,
    orgProfile,
    billingSettings,
    gstMode,
    currentUser,
    activeSalesman,
    logout,
    recordPayment,
    activePromoFor,
    payments,
    salesmen,
    existingCustomers: ledgerCustomers,
    customers: masterCustomers,
  } = useLedger();

  const salesmanMode: 'normal' | 'lowVision' = lowVisionMode ? 'lowVision' : 'normal';
  const isLowVision = salesmanMode === 'lowVision';
  const todayStr = useMemo(() => todayISO(), []);

  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [showTripHistory, setShowTripHistory] = useState<boolean>(false);

  const metrics = useSalesmanMetrics({
    trips,
    bills,
    products,
    payments,
    salesmen,
    currentUser,
    todayStr,
    selectedTripId,
    getVehicleStock,
  });

  const {
    userSalesmanId,
    userSalesmanName,
    relevantTrips,
    todayOutTrips,
    anyOutTrips,
    olderOrClosedTrips,
    activeTrip,
    otherOutTrips,
    tripSearch,
    setTripSearch,
    setTripLimit,
    matchedHistoryTrips,
    shownHistoryTrips,
    frequentRetailers,
    vanStockSearch,
    setVanStockSearch,
    filteredVehicleProducts,
    vanStockCounts,
    tripBills,
    tripTotalCollected,
    tripTotalBilled,
    myBills,
    myBillsScope,
    setMyBillsScope,
    myBillsSearch,
    setMyBillsSearch,
    displayedMyBills,
    myBillsTotalBilled,
    myBillsTotalPaid,
    todayBills,
    todaySales,
    todayDeliveredCrates,
    totalLoadedItems,
    todayCash,
    todayUpi,
  } = metrics;

  // Keep selectedTripId pointing to an open ('out') trip
  useEffect(() => {
    if (selectedTripId !== null) {
      const stillOut = anyOutTrips.some((t) => Number(t.id) === Number(selectedTripId));
      if (!stillOut) {
        setSelectedTripId(todayOutTrips[0]?.id ?? anyOutTrips[0]?.id ?? null);
      }
    } else if (anyOutTrips.length > 0) {
      setSelectedTripId(todayOutTrips[0]?.id ?? anyOutTrips[0]?.id ?? null);
    }
  }, [selectedTripId, todayOutTrips, anyOutTrips]);

  // Quick Trip / Van Load Creator State
  const [showNewVanModal, setShowNewVanModal] = useState(false);
  const [newVehicleName, setNewVehicleName] = useState('');
  const [selectedLoadWarehouseId, setSelectedLoadWarehouseId] = useState<string>(
    () => defaultWarehouse?.id || warehouses[0]?.id || ''
  );

  useEffect(() => {
    if (!selectedLoadWarehouseId && (defaultWarehouse?.id || warehouses[0]?.id)) {
      setSelectedLoadWarehouseId(defaultWarehouse?.id || warehouses[0]?.id || '');
    }
  }, [defaultWarehouse, warehouses, selectedLoadWarehouseId]);

  const [salesmanTab, setSalesmanTab] = useState<SalesmanTabId>('home');
  const [tripScreen, setTripScreen] = useState<{ mode: SalesmanTripScreenMode; trip: Trip } | null>(null);

  // Sales form state
  const [selectedRetailer, setSelectedRetailer] = useState('');
  const [retailerPhone, setRetailerPhone] = useState('');
  const [retailerCustomerId, setRetailerCustomerId] = useState('');
  const [priceType, setPriceType] = useState<PriceType>('Retail');
  const [amountPaidDraft, setAmountPaidDraft] = useState('0');
  const [retailerSearch, setRetailerSearch] = useState('');
  const [showAllRetailersModal, setShowAllRetailersModal] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'warn' } | null>(null);

  const [invoiceDiscountDraft, setInvoiceDiscountDraft] = useState<string>('');
  const [settledTotalDraft, setSettledTotalDraft] = useState<string>('');
  const [autoSendWhatsApp, setAutoSendWhatsApp] = useState<boolean>(true);
  const [lastFinalizedWhatsApp, setLastFinalizedWhatsApp] = useState<{ id: number; phone: string; url: string; bill: Bill } | null>(null);

  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isVoiceSearching, setIsVoiceSearching] = useState<boolean>(false);
  const [showCustomerSelectorModal, setShowCustomerSelectorModal] = useState<boolean>(false);
  const [showHomeAddCustomerModal, setShowHomeAddCustomerModal] = useState<boolean>(false);
  const [invoiceModalBill, setInvoiceModalBill] = useState<Bill | null>(null);
  const [confirmedBill, setConfirmedBill] = useState<Bill | null>(null);
  const [saleDate, setSaleDate] = useState<string>(() => todayISO());

  const { zoomScale, setZoomScale, isPinching, pinchContainerRef } = useSalesmanPinchZoom();

  const triggerFeedback = (text: string, type: 'success' | 'warn' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4000);
  };

  const handleCancelSaleSequence = () => {
    setSelectedRetailer('');
    setRetailerPhone('');
    setRetailerCustomerId('');
    setSaleDate(todayISO());
    setCart({
      retailer: '',
      phone: '',
      items: [],
      date: todayISO(),
    });
    setAmountPaidDraft('0');
    setInvoiceDiscountDraft('');
    setSettledTotalDraft('');
    setIsCartOpen(false);
    setConfirmedBill(null);
    triggerFeedback('Sale sequence cancelled. Ready for new customer.', 'warn');
    if (isLowVision) speakAssistiveText('Sale cancelled. Ready for new customer.');
  };

  const handleCreateNextInvoice = () => {
    setSelectedRetailer('');
    setRetailerPhone('');
    setRetailerCustomerId('');
    setSaleDate(todayISO());
    setCart({
      retailer: '',
      phone: '',
      items: [],
      date: todayISO(),
    });
    setAmountPaidDraft('0');
    setInvoiceDiscountDraft('');
    setSettledTotalDraft('');
    setIsCartOpen(false);
    setConfirmedBill(null);
    setSalesmanTab('sell');
    triggerFeedback('Ready for next invoice! Select customer to begin.', 'success');
    if (isLowVision) speakAssistiveText('Ready for next invoice. Select customer.');
  };

  const existingCustomers: ExistingCustomer[] = useMemo(
    () =>
      splitSameNameShops(
        [...ledgerCustomers].sort((a, b) => b.totalBills - a.totalBills),
        masterCustomers,
      ),
    [ledgerCustomers, masterCustomers],
  );

  const cartTotals = useMemo(() => {
    const totals = billTotals(cart.items, gstMode, 0);
    return {
      ...totals,
      itemCount: cart.items.reduce((s, i) => s + i.qty, 0),
    };
  }, [cart.items, gstMode]);

  const openVanModal = () => {
    const me = currentUser?.role === 'salesman' ? currentUser : null;
    const myProfile = me ? salesmen.find((s) => s.id === me.id) || me.salesman : null;
    const lastMine = relevantTrips.find((t) => (t.vehicle || '').trim());
    const profileVehicle = (myProfile?.defaultVehicle || myProfile?.default_vehicle || '').trim();
    setNewVehicleName(profileVehicle || lastMine?.vehicle || '');
    setShowNewVanModal(true);
  };

  const handleRemoveCartItem = (key: string | number) => {
    setCart((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.key !== key),
    }));
  };

  const handleUpdateCartQty = (key: string | number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveCartItem(key);
      return;
    }
    setCart((prev) => {
      const items = prev.items.map((it) => {
        if (it.key !== key) return it;
        const prod = products.find((p) => p.id === it.productId);
        if (!prod) return it;
        const { available } = getVehicleStock(activeTrip, prod.id);
        const safeQty = Math.min(newQty, available);
        if (safeQty !== newQty) {
          triggerFeedback(`Limited to ${available} cases remaining on vehicle!`, 'warn');
        }
        const promo = it.appliedPromo !== undefined ? it.appliedPromo : (activePromoFor(prod.id) || null);
        const computed = computeLine(prod, it.priceType, safeQty, promo, it.rate, it.discount);
        return {
          ...it,
          qty: safeQty,
          appliedPromo: promo,
          promoLabel: it.promoLabel || (promo ? schemeLabel(promo) : null),
          gross: computed.gross,
          freeQty: computed.freeQty,
          chargeableQty: computed.chargeableQty,
          discount: computed.discount,
          amount: computed.amount,
        };
      });
      return { ...prev, items };
    });
  };

  const handleUpdateCartRate = (key: string | number, newRate: number) => {
    setCart((prev) => {
      const items = prev.items.map((it) => {
        if (it.key !== key) return it;
        const prod = products.find((p) => p.id === it.productId);
        if (!prod) return it;
        const computed = computeLine(prod, it.priceType, it.qty, null, newRate, it.discount);
        return {
          ...it,
          rate: newRate,
          gross: computed.gross,
          freeQty: computed.freeQty,
          chargeableQty: computed.chargeableQty,
          discount: computed.discount,
          amount: computed.amount,
        };
      });
      return { ...prev, items };
    });
  };

  const handleUpdateCartDiscount = (key: string | number, newDiscount: number) => {
    setCart((prev) => {
      const items = prev.items.map((it) => {
        if (it.key !== key) return it;
        const prod = products.find((p) => p.id === it.productId);
        if (!prod) return it;
        const computed = computeLine(prod, it.priceType, it.qty, null, it.rate, newDiscount);
        return {
          ...it,
          discount: newDiscount,
          gross: computed.gross,
          freeQty: computed.freeQty,
          chargeableQty: computed.chargeableQty,
          amount: computed.amount,
        };
      });
      return { ...prev, items };
    });
  };

  const handleToggleCartPriceType = (key: string | number, newPriceType: PriceType) => {
    setCart((prev) => {
      const items = prev.items.map((it) => {
        if (it.key !== key) return it;
        const prod = products.find((p) => p.id === it.productId);
        if (!prod) return it;
        const newRate = newPriceType === 'Retail' ? prod.retail : prod.wholesale;
        const computed = computeLine(prod, newPriceType, it.qty, null, newRate, it.discount);
        return {
          ...it,
          priceType: newPriceType,
          rate: newRate,
          gross: computed.gross,
          freeQty: computed.freeQty,
          chargeableQty: computed.chargeableQty,
          discount: computed.discount,
          amount: computed.amount,
        };
      });
      return { ...prev, items };
    });
  };

  const getProductCartQty = (productId: number): number => {
    return cart.items
      .filter((item) => item.productId === productId)
      .reduce((sum, item) => sum + item.qty, 0);
  };

  const handleQuickProductCartChange = (productId: number, delta: number): boolean => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return false;
    const { available } = getVehicleStock(activeTrip, prod.id);

    const existingItem = cart.items.find((it) => it.productId === productId);
    const currentQty = existingItem ? existingItem.qty : 0;
    const targetQty = currentQty + delta;

    if (delta > 0) {
      if (!activeTrip) {
        triggerFeedback('Select or load an active van trip before adding stock.', 'warn');
        if (isLowVision) speakAssistiveText('Select an active van trip first.');
        return false;
      }
      if (available <= 0) {
        triggerFeedback(`${prod.name} is out of stock on this van.`, 'warn');
        if (isLowVision) speakAssistiveText(`${prod.name} is out of stock on this van.`);
        return false;
      }
      if (targetQty > available) {
        triggerFeedback(`Vehicle only has ${available} cases of ${prod.name} remaining.`, 'warn');
        if (isLowVision) speakAssistiveText(`Vehicle limit reached. Only ${available} cases available.`);
        return false;
      }
    }

    if (targetQty <= 0) {
      if (existingItem) {
        handleRemoveCartItem(existingItem.key);
        if (isLowVision) speakAssistiveText(`Removed ${prod.name} from cart.`);
        return true;
      }
      return false;
    }

    if (existingItem) {
      handleUpdateCartQty(existingItem.key, targetQty);
      if (isLowVision) speakAssistiveText(`${prod.name} updated to ${targetQty} cases.`);
      return true;
    }

    const rate = priceType === 'Retail' ? prod.retail : prod.wholesale;
    const promo = activePromoFor(prod.id) || null;
    const computed = computeLine(prod, priceType, targetQty, promo, rate);
    const newItem: BillItem = {
      key: `${prod.id}_${Date.now()}`,
      productId: prod.id,
      productName: prod.name,
      category: prod.category,
      gst: resolveProductGstRate(prod),
      priceType,
      qty: targetQty,
      rate,
      gross: computed.gross,
      freeQty: computed.freeQty,
      chargeableQty: computed.chargeableQty,
      discount: computed.discount,
      amount: computed.amount,
      appliedPromo: promo,
      promoLabel: promo ? schemeLabel(promo) : null,
      batchNumber: prod.batchNumber,
      hsn: resolveProductHsn(prod),
    };
    setCart((prev) => ({ ...prev, items: [...prev.items, newItem] }));
    if (isLowVision) speakAssistiveText(`Added 1 case of ${prod.name} to invoice. Total ${targetQty} cases.`);
    return true;
  };

  const rawCartTotal = cartTotals.total;
  const appliedDiscount = Number(invoiceDiscountDraft) || 0;
  const finalCartTotal = Math.max(0, rawCartTotal - appliedDiscount);

  const handleDiscountChange = (val: string) => {
    setInvoiceDiscountDraft(val);
    const d = Number(val) || 0;
    const computedTotal = Math.max(0, rawCartTotal - d);
    setSettledTotalDraft(d > 0 ? String(computedTotal) : '');
  };

  const handleSettledTotalChange = (val: string) => {
    setSettledTotalDraft(val);
    if (!val.trim()) {
      setInvoiceDiscountDraft('');
      return;
    }
    const target = Number(val);
    if (!isNaN(target) && target >= 0) {
      const diff = Math.max(0, rawCartTotal - target);
      setInvoiceDiscountDraft(diff > 0 ? String(diff) : '0');
    }
  };

  const applyQuickDiscount = (amt: number, isPercent: boolean = false) => {
    const d = isPercent ? Math.round(rawCartTotal * (amt / 100)) : amt;
    handleDiscountChange(String(d));
    if (isLowVision) {
      speakAssistiveText(`Special discount of rupees ${d} applied. Settled total is rupees ${Math.max(0, rawCartTotal - d)}`);
    }
  };

  const handleVoiceSearchCustomer = () => {
    if (isVoiceSearching) {
      setIsVoiceSearching(false);
      return;
    }
    if (!isSpeechRecognitionSupported()) {
      triggerFeedback('Speech recognition is not supported in this browser.', 'warn');
      return;
    }
    setIsVoiceSearching(true);
    speakAssistiveText('Listening. Speak customer or shop name now.');
    startSpeechRecognition({
      onStart: () => setIsVoiceSearching(true),
      onResult: (transcript) => {
        setIsVoiceSearching(false);
        const spoken = normCustName(transcript);
        const pool = existingCustomers.filter((c) => normCustName(c.name));
        const exact = pool.filter((c) => normCustName(c.name) === spoken);
        const partial =
          spoken.length >= 3
            ? pool.filter((c) => {
                const n = normCustName(c.name);
                return n.includes(spoken) || spoken.includes(n);
              })
            : [];
        const candidates = exact.length > 0 ? exact : partial;
        if (candidates.length === 1) {
          const matched = candidates[0];
          setSelectedRetailer(matched.name);
          setRetailerPhone(matched.phone || '');
          setRetailerCustomerId(matched.id || '');
          speakAssistiveText(`Selected shop ${matched.name}`);
          triggerFeedback(`Voice matched: ${matched.name}`);
        } else if (candidates.length > 1) {
          setSelectedRetailer('');
          setRetailerPhone('');
          setRetailerCustomerId('');
          setShowCustomerSelectorModal(true);
          speakAssistiveText('More than one shop matches. Please choose from the list.');
          triggerFeedback(`More than one shop matches "${transcript}". Choose one from the list.`, 'warn');
        } else {
          setSelectedRetailer(transcript);
          setRetailerPhone('');
          setRetailerCustomerId('');
          speakAssistiveText(`No registered shop named ${transcript}. Customer set to ${transcript}.`);
          triggerFeedback(`No registered shop "${transcript}" - use Add Customer to register it`, 'warn');
        }
      },
      onError: () => {
        setIsVoiceSearching(false);
        speakAssistiveText('Could not detect shop name. Tap to try again.');
        triggerFeedback('Voice recognition ended. Tap to try again.', 'warn');
      },
      onEnd: () => setIsVoiceSearching(false),
    });
  };

  const handleFinalizeSale = () => {
    if (!selectedRetailer.trim()) {
      triggerFeedback('Please select or enter the Retailer / Shop Name.', 'warn');
      if (isLowVision) speakAssistiveText('Please select shop name first.');
      return;
    }
    if (cart.items.length === 0) {
      triggerFeedback('Please add at least one beverage item to the bill.', 'warn');
      if (isLowVision) speakAssistiveText('No items in bill yet.');
      return;
    }
    if (!activeTrip) {
      triggerFeedback('No active vehicle trip selected. Please assign a vehicle trip first.', 'warn');
      return;
    }

    const paid = amountPaidDraft !== '' ? Math.max(0, Number(amountPaidDraft) || 0) : 0;
    const activeDate = saleDate || todayISO();
    const activeTripWarehouseId = tripPrimaryWarehouseId(activeTrip);

    setCart((prev) => ({
      ...prev,
      retailer: selectedRetailer.trim(),
      phone: retailerPhone.trim(),
      date: activeDate,
      warehouseId: activeTripWarehouseId,
      tripId: activeTrip.id,
      vehicle: activeTrip.vehicle,
      salesman: activeTrip.salesman,
      additionalDiscount: appliedDiscount,
    }));

    const partyForBill = {
      retailer: selectedRetailer.trim(),
      phone: retailerPhone.trim(),
      salesman: activeTrip.salesman,
      vehicle: activeTrip.vehicle,
      warehouseId: activeTripWarehouseId,
      customerId: retailerCustomerId || undefined,
    };

    if (cartTaxMix(cart.items, products).hasMixed) {
      const split = finalizeSplitBills({
        amountPaid: paid,
        tripId: activeTrip.id,
        overallDiscount: appliedDiscount,
        billDate: activeDate,
        extras: { party: partyForBill },
      });
      if (!split || !split.gstBill || !split.nonGstBill) return;
      const phoneForSplit = retailerPhone.trim();
      triggerFeedback(
        `✓ Split sale saved: ${split.gstBill.docNo || 'Invoice'} + ${split.nonGstBill.docNo || 'Cash Memo'}. Van stock updated.`,
        'success',
      );
      if (isLowVision) speakAssistiveText('Sale finalized as a tax invoice and a cash memo. Vehicle stock updated.');
      if (phoneForSplit) {
        const text = buildBillMessage(split.gstBill, orgProfile, billingSettings);
        const url = whatsappLink(phoneForSplit, text);
        if (autoSendWhatsApp) setLastFinalizedWhatsApp({ id: split.gstBill.id, phone: phoneForSplit, url, bill: split.gstBill });
        else setLastFinalizedWhatsApp(null);
      }
      setConfirmedBill(split.gstBill);
      setSelectedRetailer('');
      setRetailerPhone('');
      setRetailerCustomerId('');
      setAmountPaidDraft('0');
      setInvoiceDiscountDraft('');
      setSettledTotalDraft('');
      setIsCartOpen(false);
      return;
    }

    const billId = finalizeBill(paid, activeTrip.id, appliedDiscount, undefined, undefined, undefined, activeDate, {
      party: partyForBill,
    });
    if (billId !== null) {
      const persistedBill = getBillById?.(billId);
      const savedDocLabel = persistedBill
        ? formatBillNumber(persistedBill, billingSettings)
        : `#${billId}`;
      triggerFeedback(`✓ Sale Completed! Bill ${savedDocLabel} saved. On-board vehicle stock updated.`, 'success');
      if (isLowVision) speakAssistiveText(`Sale finalized. Total rupees ${finalCartTotal}. Vehicle stock updated.`);

      const savedBill: Bill = persistedBill || {
        ...cartTotals,
        total: finalCartTotal,
        id: billId,
        retailer: selectedRetailer.trim(),
        phone: retailerPhone.trim(),
        date: activeDate,
        items: [...cart.items],
        amountPaid: paid,
        warehouseId: activeTripWarehouseId,
        tripId: activeTrip.id,
        vehicle: activeTrip.vehicle,
        salesman: activeTrip.salesman,
        additionalDiscount: appliedDiscount,
      };

      const phoneToUse = retailerPhone.trim();
      if (phoneToUse) {
        const text = buildBillMessage(savedBill, orgProfile, billingSettings);
        const url = whatsappLink(phoneToUse, text);
        if (autoSendWhatsApp) setLastFinalizedWhatsApp({ id: billId, phone: phoneToUse, url, bill: savedBill });
        else setLastFinalizedWhatsApp(null);
      }

      setConfirmedBill(savedBill);

      setSelectedRetailer('');
      setRetailerPhone('');
      setRetailerCustomerId('');
      setAmountPaidDraft('0');
      setInvoiceDiscountDraft('');
      setSettledTotalDraft('');
      setIsCartOpen(false);
    }
  };

  if (tripScreen) {
    return (
      <div id="view-salesman-trip-screen" className="mw-workspace space-y-4 p-2 sm:p-3">
        <SalesmanTripScreens
          mode={tripScreen.mode}
          trip={tripScreen.trip}
          onSwitchMode={(mode) => setTripScreen((cur) => (cur ? { ...cur, mode } : cur))}
          onClose={() => setTripScreen(null)}
        />
      </div>
    );
  }

  return (
    <div id="view-salesman" className="mw-workspace space-y-4">
      <SalesmanHeader
        salesmanTab={salesmanTab}
        setSalesmanTab={setSalesmanTab}
        palette={palette}
        currentUser={currentUser}
        userSalesmanName={userSalesmanName}
        activeSalesman={activeSalesman}
        activeTrip={activeTrip}
        logout={logout}
        cartItemCount={cart.items.length}
        selectedRetailer={selectedRetailer}
        finalCartTotal={finalCartTotal}
        isLowVision={isLowVision}
        speakAssistiveText={speakAssistiveText}
        onOpenCart={() => setIsCartOpen(true)}
        feedbackMsg={feedbackMsg}
        onDismissFeedback={() => setFeedbackMsg(null)}
      />

      <div
        ref={pinchContainerRef}
        className="w-full"
        style={{
          transform: zoomScale !== 1.0 ? `scale(${zoomScale})` : undefined,
          transformOrigin: 'top center',
          transition: isPinching ? 'none' : 'transform 0.12s ease-out',
          width: zoomScale > 1 ? `${(100 / zoomScale).toFixed(1)}%` : '100%',
          margin: zoomScale > 1 ? '0 auto' : undefined,
        }}
      >
        <main className="max-w-none lg:max-w-6xl mx-auto px-4 py-4">
          {salesmanTab === 'home' && (
            <SalesmanHomeTab
              isLowVision={isLowVision}
              todayCash={todayCash}
              todayUpi={todayUpi}
              todaySales={todaySales}
              todayBills={todayBills}
              todayDeliveredCrates={todayDeliveredCrates}
              totalLoadedItems={totalLoadedItems}
              todayStr={todayStr}
              orgProfile={orgProfile}
              setSalesmanTab={setSalesmanTab}
              onOpenAddCustomerModal={() => setShowHomeAddCustomerModal(true)}
              onViewInvoiceModal={setInvoiceModalBill}
            />
          )}

          {salesmanTab === 'vanStock' && (
            <SalesmanVanStockTab
              activeTrip={activeTrip}
              warehouses={warehouses}
              tripTotalBilled={tripTotalBilled}
              tripTotalCollected={tripTotalCollected}
              vanStockCounts={vanStockCounts}
              vanStockSearch={vanStockSearch}
              setVanStockSearch={setVanStockSearch}
              filteredVehicleProducts={filteredVehicleProducts}
              palette={palette}
              fz={fz}
              setSalesmanTab={setSalesmanTab}
              onQuickAddToSale={(productId, productName) => {
                if (handleQuickProductCartChange(productId, 1)) {
                  triggerFeedback(`Added 1 case of ${productName} to sale cart!`);
                }
              }}
            />
          )}

          {salesmanTab === 'bills' && (
            <SalesmanBillsTab
              isLowVision={isLowVision}
              displayedMyBills={displayedMyBills}
              myBillsTotalBilled={myBillsTotalBilled}
              myBillsTotalPaid={myBillsTotalPaid}
              myBillsScope={myBillsScope}
              setMyBillsScope={setMyBillsScope}
              tripBillsCount={tripBills.length}
              myBillsCount={myBills.length}
              myBillsSearch={myBillsSearch}
              setMyBillsSearch={setMyBillsSearch}
              palette={palette}
              fz={fz}
              orgProfile={orgProfile}
              onViewInvoiceModal={setInvoiceModalBill}
            />
          )}

          {salesmanTab === 'sell' && (
            <div>
              <SalesmanSaleWorkflow
                confirmedBill={confirmedBill}
                setConfirmedBill={setConfirmedBill}
                cart={cart}
                activeTrip={activeTrip}
                availableTrips={anyOutTrips}
                onSelectTripId={(id) => {
                  setSelectedTripId(id);
                  const nextTrip = anyOutTrips.find((t) => t.id === id) || null;
                  if (nextTrip && cart.items.length > 0) {
                    let adjusted = 0;
                    const nextItems: BillItem[] = [];
                    for (const it of cart.items) {
                      const { available } = getVehicleStock(nextTrip, it.productId);
                      if (available <= 0) {
                        adjusted++;
                        continue;
                      }
                      if (it.qty > available) {
                        adjusted++;
                        const prod = products.find((p) => p.id === it.productId);
                        if (prod) {
                          const promo = it.appliedPromo !== undefined ? it.appliedPromo : (activePromoFor(prod.id) || null);
                          const computed = computeLine(prod, it.priceType, available, promo, it.rate, it.discount);
                          nextItems.push({
                            ...it,
                            qty: available,
                            appliedPromo: promo,
                            promoLabel: it.promoLabel || (promo ? schemeLabel(promo) : null),
                            gross: computed.gross,
                            freeQty: computed.freeQty,
                            chargeableQty: computed.chargeableQty,
                            discount: computed.discount,
                            amount: computed.amount,
                          });
                        }
                      } else {
                        nextItems.push(it);
                      }
                    }
                    setCart((prev) => ({
                      ...prev,
                      items: nextItems,
                      tripId: nextTrip.id,
                      vehicle: nextTrip.vehicle,
                      salesman: nextTrip.salesman,
                      warehouseId: tripPrimaryWarehouseId(nextTrip),
                    }));
                    if (adjusted > 0 || nextItems.length !== cart.items.length) {
                      triggerFeedback(`Switched to ${nextTrip.vehicle}. Cart adjusted to match van stock.`, 'warn');
                    }
                  }
                  if (isLowVision) speakAssistiveText(`Switched to vehicle ${(trips.find(t => t.id === id))?.vehicle || 'van'}.`);
                }}
                onOpenNewVanModal={openVanModal}
                products={products}
                customers={existingCustomers}
                selectedRetailer={selectedRetailer}
                setSelectedRetailer={setSelectedRetailer}
                retailerPhone={retailerPhone}
                setRetailerPhone={setRetailerPhone}
                setRetailerCustomerId={setRetailerCustomerId}
                priceType={priceType}
                setPriceType={setPriceType}
                isLowVision={isLowVision}
                palette={palette}
                scale={scale}
                finalCartTotal={finalCartTotal}
                getVehicleStock={getVehicleStock}
                getProductCartQty={getProductCartQty}
                onQuickProductCartChange={handleQuickProductCartChange}
                onOpenCart={() => setIsCartOpen(true)}
                onCancelSaleSequence={handleCancelSaleSequence}
                onCreateNextInvoice={handleCreateNextInvoice}
                onOpenInvoiceModal={(b) => setInvoiceModalBill(b)}
                onOpenCustomerDirectory={() => setShowCustomerSelectorModal(true)}
                onVoiceSearchCustomer={handleVoiceSearchCustomer}
                isVoiceSearching={isVoiceSearching}
                speakAssistiveText={speakAssistiveText}
                onSetSalesmanTab={setSalesmanTab}
                orgProfile={orgProfile}
                billingSettings={billingSettings}
                saleDate={saleDate}
                setSaleDate={setSaleDate}
              />
            </div>
          )}

          {salesmanTab === 'customerDue' && (
            <SalesmanCustomerDueLookup
              bills={bills}
              onSelectForSale={(customerName, phone) => {
                setSelectedRetailer(customerName);
                setRetailerPhone(phone);
                setRetailerCustomerId('');
                setSalesmanTab('sell');
                if (isLowVision) speakAssistiveText(`Selected ${customerName} for sale.`);
              }}
              onRecordPayment={recordPayment}
              palette={palette}
              isLowVision={isLowVision}
              speakAssistiveText={speakAssistiveText}
            />
          )}

          {salesmanTab === 'trips' && (
            <SalesmanTripsTab
              anyOutTrips={anyOutTrips}
              olderOrClosedTrips={olderOrClosedTrips}
              activeTrip={activeTrip}
              otherOutTrips={otherOutTrips}
              warehouses={warehouses}
              bills={bills}
              todayStr={todayStr}
              totalLoadedItems={totalLoadedItems}
              vanStockCounts={vanStockCounts}
              tripTotalBilled={tripTotalBilled}
              tripBillsCount={tripBills.length}
              showTripHistory={showTripHistory}
              setShowTripHistory={setShowTripHistory}
              tripSearch={tripSearch}
              setTripSearch={setTripSearch}
              shownHistoryTrips={shownHistoryTrips}
              matchedHistoryTripsCount={matchedHistoryTrips.length}
              setTripLimit={setTripLimit}
              palette={palette}
              fz={fz}
              onOpenVanModal={openVanModal}
              onStartSelling={() => setSalesmanTab('sell')}
              onOpenTripScreen={(mode, trip) => setTripScreen({ mode, trip })}
              onSwitchActiveTrip={(trip) => {
                setSelectedTripId(trip.id);
                if (isLowVision) speakAssistiveText(`Switched to active vehicle ${trip.vehicle}.`);
              }}
            />
          )}
        </main>
      </div>

      <SalesmanModals
        showNewVanModal={showNewVanModal}
        setShowNewVanModal={setShowNewVanModal}
        products={products}
        warehouses={warehouses}
        salesmen={salesmen}
        trips={trips}
        activeBeats={activeBeats}
        defaultWarehouse={defaultWarehouse}
        warehouseStock={warehouseStock}
        createTrip={createTrip}
        userSalesmanId={userSalesmanId}
        userSalesmanName={userSalesmanName}
        newVehicleName={newVehicleName}
        setSelectedTripId={setSelectedTripId}
        triggerFeedback={triggerFeedback}
        showAllRetailersModal={showAllRetailersModal}
        setShowAllRetailersModal={setShowAllRetailersModal}
        retailerSearch={retailerSearch}
        setRetailerSearch={setRetailerSearch}
        frequentRetailers={frequentRetailers}
        palette={palette}
        scale={scale}
        selectedRetailer={selectedRetailer}
        setSelectedRetailer={setSelectedRetailer}
        retailerPhone={retailerPhone}
        setRetailerPhone={setRetailerPhone}
        setRetailerCustomerId={setRetailerCustomerId}
        invoiceModalBill={invoiceModalBill}
        setInvoiceModalBill={setInvoiceModalBill}
        showCustomerSelectorModal={showCustomerSelectorModal}
        setShowCustomerSelectorModal={setShowCustomerSelectorModal}
        existingCustomers={existingCustomers}
        isLowVision={isLowVision}
        speakAssistiveText={speakAssistiveText}
        isCartOpen={isCartOpen}
        setIsCartOpen={setIsCartOpen}
        cart={cart}
        activeTrip={activeTrip}
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
        handleUpdateCartQty={handleUpdateCartQty}
        handleUpdateCartRate={handleUpdateCartRate}
        handleUpdateCartDiscount={handleUpdateCartDiscount}
        handleToggleCartPriceType={handleToggleCartPriceType}
        handleRemoveCartItem={handleRemoveCartItem}
        handleFinalizeSale={handleFinalizeSale}
        handleCancelSaleSequence={handleCancelSaleSequence}
        handleVoiceSearchCustomer={handleVoiceSearchCustomer}
        isVoiceSearching={isVoiceSearching}
        getVehicleStock={getVehicleStock}
        handleQuickProductCartChange={handleQuickProductCartChange}
        priceType={priceType}
        finalCartTotal={finalCartTotal}
        salesmanTab={salesmanTab}
        setSalesmanTab={setSalesmanTab}
        zoomScale={zoomScale}
        setZoomScale={setZoomScale}
        showHomeAddCustomerModal={showHomeAddCustomerModal}
        setShowHomeAddCustomerModal={setShowHomeAddCustomerModal}
      />
    </div>
  );
};
