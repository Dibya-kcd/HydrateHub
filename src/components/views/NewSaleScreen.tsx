import { cartTaxMix, isLineNonGst } from '../../utils/invoiceCommon';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { notify } from "../../utils/toast";
import {
  ShoppingCart,
  X,
} from 'lucide-react';
import { useLedger } from '../../context/LedgerContext';
import { resolveTaxRegime, noOutputTax } from '../../tax/appRegime';
import { findDuplicateCustomer, normCustName } from '../../context/ledgerHelpers';
import { last10Of } from '../../context/ledgerCustomerCalculations';
import { confirmDialog } from '../../utils/dialogs';
import { Bill, PaymentMode, Product, Promotion, PriceType } from '../../types';
import { useBeats } from '../../hooks/useBeats';
import { NewTripSheet, NewTripPayload } from './trips/NewTripSheet';
import { useCreateTrip } from './trips/useCreateTrip';
import { beatOfCustomer } from '../../utils/beats';
import { useLanguage } from '../../i18n/LanguageContext';
import { applyCartSchemes, money } from '../../utils/billing';
import { RichCustomerOption } from '../billing/CustomerPredictiveSearch';
import { CustomerStep } from '../billing/CustomerStep';
import { NewCustomerSheet } from '../billing/NewCustomerSheet';
import { todayISO } from "../../utils/dateLocal";
import { OrderContextBar, formatSaleDate, SaleSource } from '../billing/OrderContextBar';
import { useIsCompactLayout, useIsMobile } from '../../hooks/useIsMobile';
import { FlowInlineHeader } from '../common/FlowKit';
import { validatePhone, validateGstin } from '../../utils/validation';
import { tripPrimaryWarehouseId } from '../../utils/tripLoads';
import {
  formatInr,
  getProductDefaultPrice,
} from '../billing/newSaleHelpers';
import { NewSaleSetupPanel } from '../billing/NewSaleSetupPanel';
import { NewSaleCatalogModal } from '../billing/NewSaleCatalogModal';
import { NewSaleReviewModal } from '../billing/NewSaleReviewModal';
import { useNewSaleFilters } from '../billing/useNewSaleFilters';
import {
  CancelSaleConfirmModal,
  NewSaleSchemeModals,
  PhoneBillSavedScreen,
} from '../billing/NewSaleSchemeModals';

interface NewSaleScreenProps {
  onBack: () => void;
  onOpenInvoiceModal: (bill: Bill, defaultFormat?: 'gst' | 'non_gst') => void;
}

export const NewSaleScreen: React.FC<NewSaleScreenProps> = ({
  onBack,
  onOpenInvoiceModal,
}) => {
  const { t, isOdia } = useLanguage();
  // Phone + tablet (< 1024px) get the compact order screens; desktop keeps its existing layout.
  const isCompact = useIsCompactLayout();
  const isPhone = useIsMobile(1023);
  const [editSetup, setEditSetup] = useState(false); // phone/tablet: edit van + date in place on the order page
  const {
    products,
    bills,
    getBillById,
    warehouses,
    defaultWarehouse,
    trips,
    salesmen,
    getVehicleStock,
    customers,
    existingCustomers,
    getCustomerLedger,
    addCustomer,
    updateCustomer,
    finalizeBill,
    finalizeSplitBills,
    warehouseStock,
    remainingStock,
    promotions,
    activePromoFor,
    billingSettings,
    orgProfile,
    setCart,
    getPreviousCustomPrice,
    setCustomProductPrice,
    currentUser,
    payments,
  } = useLedger();

  // Active Trips Filtered by Role: strictly active trips (status === 'out').
  // Salesmen only see their assigned active trips; Owners/Admins see all active trips.
  const activeTripsForUser = useMemo(() => {
    const isSalesman = currentUser && typeof currentUser === 'object' && 'role' in currentUser && currentUser.role === 'salesman';
    const sId = (currentUser as any)?.salesman?.id || (currentUser as any)?.id;
    const sName = (currentUser as any)?.salesman?.name || (currentUser as any)?.name;

    return trips.filter((t) => {
      // Never show closed or completed trips
      if (t.status !== 'out') return false;
      if (isSalesman) {
        return (
          t.salesmanId === sId ||
          t.salesman === sName ||
          (!t.salesmanId && !t.salesman)
        );
      }
      return true; // Owner/Admin sees all active trips
    });
  }, [trips, currentUser]);

  // Form Configuration State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerGstin, setCustomerGstin] = useState<string>('');

  const [billType, setBillType] = useState<'tax_invoice' | 'bill_of_supply' | 'estimate'>('tax_invoice');

  // Stock from (Warehouse or active Trip)
  const defaultWarehouseId = defaultWarehouse?.id || warehouses[0]?.id || '';
  // Default to a trip linked from Trip Detail ("Record sale") if active, else first active trip, else warehouse.
  const [stockSource, setStockSource] = useState<string>(() => {
    try {
      const prefillId = Number(sessionStorage.getItem('mrwater_prefill_trip_id'));
      sessionStorage.removeItem('mrwater_prefill_trip_id');
      if (prefillId && activeTripsForUser.some((t) => Number(t.id) === prefillId)) {
        return `trip_${prefillId}`;
      }
    } catch {
      /* sessionStorage unavailable */
    }
    return activeTripsForUser.length > 0 ? `trip_${activeTripsForUser[0].id}` : defaultWarehouseId;
  });
  // Derived views of stockSource, so the existing warehouse-id / `trip_<id>` handling stays untouched.
  const saleSource: SaleSource = stockSource.startsWith('trip_') ? 'trip' : 'warehouse';
  const selectedTripId: number | undefined = stockSource.startsWith('trip_')
    ? parseInt(stockSource.replace('trip_', ''), 10)
    : undefined;

  // If currently selected stock source is a trip that closed, revert back to default warehouse
  useEffect(() => {
    if (stockSource.startsWith('trip_')) {
      const tid = parseInt(stockSource.replace('trip_', ''), 10);
      const isStillActive = activeTripsForUser.some((t) => t.id === tid);
      if (!isStillActive) {
        setStockSource(defaultWarehouseId);
      }
    } else if (defaultWarehouseId && (!stockSource || !warehouses.some((w) => w.id === stockSource))) {
      setStockSource(defaultWarehouseId);
    }
  }, [stockSource, activeTripsForUser, defaultWarehouseId, warehouses]);

  // Date
  const todayStr = todayISO();
  const [saleDate, setSaleDate] = useState<string>(todayStr);
  // Composition / unregistered businesses never charge GST: lock the bill type to Bill of Supply.
  const compositionLocked = useMemo(
    () => noOutputTax(resolveTaxRegime(orgProfile, saleDate)),
    [orgProfile, saleDate],
  );
  useEffect(() => {
    if (compositionLocked && billType === 'tax_invoice') setBillType('bill_of_supply');
  }, [compositionLocked, billType]);

  // Selected Cart Items: productId -> qty
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});
  // Track chronological order of additions for 'SAME_AS_LAST_ADDED' scheme rule
  const [itemOrder, setItemOrder] = useState<number[]>([]);

  const clampItemsToTrip = useCallback(
    (sourceId: string) => {
      if (!sourceId.startsWith('trip_')) return;
      const tid = parseInt(sourceId.replace('trip_', ''), 10);
      const nextTrip = trips.find((t) => Number(t.id) === tid) || null;
      if (!nextTrip) return;
      const curEntries = Object.entries(selectedItems);
      if (curEntries.length === 0) return;
      let changed = false;
      const nextItems: Record<number, number> = {};
      for (const [pidStr, qtyVal] of curEntries) {
        const pid = Number(pidStr);
        const avail = Math.max(0, getVehicleStock ? getVehicleStock(nextTrip, pid).available : 0);
        const kept = Math.min(qtyVal, avail);
        if (kept !== qtyVal) changed = true;
        if (kept > 0) nextItems[pid] = kept;
      }
      if (changed) {
        setSelectedItems(nextItems);
        setItemOrder((prev) => prev.filter((id) => (nextItems[id] || 0) > 0));
        notify(`Cart adjusted to match ${nextTrip.vehicle} van stock.`);
      }
    },
    [trips, selectedItems, getVehicleStock],
  );

  const handleSaleSourceChange = (next: SaleSource) => {
    if (next === 'warehouse') {
      if (saleSource !== 'warehouse') setStockSource(defaultWarehouseId);
    } else if (saleSource !== 'trip' && activeTripsForUser.length > 0) {
      const nextSource = `trip_${activeTripsForUser[0].id}`;
      setStockSource(nextSource);
      clampItemsToTrip(nextSource);
    }
  };

  // Custom price per case per product
  const [customRates, setCustomRates] = useState<Record<number, number>>({});

  // Active / chosen promotion overrides per product
  const [customSchemes, setCustomSchemes] = useState<Record<number, Promotion | null>>({});

  // Scheme Mode for this Bill: 'auto' | 'none' | 'manual'
  const [schemeMode, setSchemeMode] = useState<'auto' | 'none' | 'manual'>(() => {
    if (billingSettings?.schemesEnabled === false || billingSettings?.autoApplyPromotions === false) {
      return 'none';
    }
    return 'auto';
  });

  useEffect(() => {
    if (billingSettings?.schemesEnabled === false || billingSettings?.autoApplyPromotions === false) {
      setSchemeMode('none');
    }
  }, [billingSettings?.schemesEnabled, billingSettings?.autoApplyPromotions]);

  // Scheme selector modal & Quick Product Entry popup
  const [schemeModalProduct, setSchemeModalProduct] = useState<Product | null>(null);
  const [quickEntryProduct, setQuickEntryProduct] = useState<Product | null>(null);
  const [quickEntryQty, setQuickEntryQty] = useState<string>('1');
  const [quickEntryRate, setQuickEntryRate] = useState<string>('');
  const quickEntryQtyRef = useRef<HTMLInputElement | null>(null);

  // Cart Review Modal / Drawer
  const [showCartReview, setShowCartReview] = useState<boolean>(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNote, setPaymentNote] = useState<string>('');
  // UI-only: which payment card is highlighted in Order Review. It just drives paymentMode / paymentAmount.
  const [payChoice, setPayChoice] = useState<'credit' | 'cash' | 'upi' | 'partial'>('credit');

  // Modals & Panels
  const [showProductSelector, setShowProductSelector] = useState<boolean>(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustGstin, setNewCustGstin] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustBeat, setNewCustBeat] = useState('');
  const [newCustPrefilled, setNewCustPrefilled] = useState<{
    name?: boolean;
    phone?: boolean;
    gstin?: boolean;
  }>({});

  // Sale Page Beat filter (beats are configured in Settings only)
  const [selectedBeatFilter, setSelectedBeatFilter] = useState<string>('all');

  // Van Trip modal state (for starting a new delivery van dispatch)
  const [showNewTripModal, setShowNewTripModal] = useState<boolean>(false);

  // Search inside "Select Beverages & Crates" modal
  const [beverageSearch, setBeverageSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPackFilter, setSelectedPackFilter] = useState<'all' | 'can' | 'pet' | 'glass' | 'tetra'>('all');
  // Size filter (All / each size you actually stock / Soda): view-only filter, nothing is saved.
  const [selectedSize, setSelectedSize] = useState<string>('all');
  const [schemesOnly, setSchemesOnly] = useState<boolean>(false);
  const [inCartOnly, setInCartOnly] = useState<boolean>(false);
  const [catalogFilterOpen, setCatalogFilterOpen] = useState<boolean>(false);
  const catalogFilterRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!catalogFilterOpen) return;
    const onOutside = (e: MouseEvent | TouchEvent) => {
      if (catalogFilterRef.current && !catalogFilterRef.current.contains(e.target as Node)) {
        setCatalogFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [catalogFilterOpen]);
  const { beats, activeBeats } = useBeats();
  const createTrip = useCreateTrip();

  // Success message after save
  const [savedBill, setSavedBill] = useState<Bill | null>(null);
  const [phoneReviewStage, setPhoneReviewStage] = useState<'cart' | 'checkout'>('cart');

  useEffect(() => {
    const onNewBill = () => {
      setSavedBill(null);
      setPhoneReviewStage('cart');
    };
    window.addEventListener('app-new-bill', onNewBill);
    return () => window.removeEventListener('app-new-bill', onNewBill);
  }, []);

  // Cancel & Reset flow: completely clears all cart items, discounts, customer selections and closes modals
  const handleResetSale = useCallback(() => {
    setSelectedItems({});
    setItemOrder([]);
    setCustomRates({});
    setCustomSchemes({});
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerGstin('');
    setPaymentAmount('');
    setPaymentMode('cash');
    setPaymentNote('');
    setPayChoice('credit');
    const resetIsTrip = stockSource.startsWith('trip_');
    const resetTripId = resetIsTrip ? parseInt(stockSource.replace('trip_', ''), 10) : undefined;
    const resetTrip = resetTripId != null ? trips.find((t) => Number(t.id) === resetTripId) : undefined;
    setCart({
      retailer: '',
      phone: '',
      date: todayISO(),
      items: [],
      warehouseId: resetIsTrip
        ? tripPrimaryWarehouseId(resetTrip) || undefined
        : defaultWarehouseId || undefined,
      tripId: resetTripId,
    });
    setShowProductSelector(false);
    setCatalogFilterOpen(false);
    setSelectedCategory('all');
    setSchemesOnly(false);
    setInCartOnly(false);
    setShowCartReview(false);
    setPhoneReviewStage('cart');
    setShowCancelSaleConfirm(false);
  }, [defaultWarehouseId, setCart, stockSource, trips]);

  const [showCancelSaleConfirm, setShowCancelSaleConfirm] = useState<boolean>(false);

  // Load previous custom prices when customer changes
  const loadCustomPricesForCustomer = (name: string) => {
    if (!name || !getPreviousCustomPrice) return;
    const newRates: Record<number, number> = {};
    products.forEach((p) => {
      const prevPrice = getPreviousCustomPrice(p.id, name);
      if (prevPrice !== null && prevPrice !== undefined && prevPrice > 0) {
        newRates[p.id] = prevPrice;
      }
    });
    if (Object.keys(newRates).length > 0) {
      setCustomRates((prev) => ({ ...prev, ...newRates }));
    }
  };

  // Step 1 → Step 2: once a retailer is picked (or saved), go straight to the Beverage Catalog.
  // Changing stock-from / date never opens it on its own.
  const checkAndPromptProducts = (_cust: string, _stock: string) => {
    setShowProductSelector(true);
  };

  // Stock from change (Godown or Van Trip)
  const handleStockSourceChange = (val: string) => {
    if (val === '__new_van_trip__') {
      setShowNewTripModal(true);
      return;
    }
    setStockSource(val);
    clampItemsToTrip(val);
  };

  // Load a new van with the same load-sheet screen the Trips page uses, then sell from it
  const handleCreateTrip = (payload: NewTripPayload): string | null => {
    const res = createTrip.create(payload);
    if (res.ok === false) return res.error;
    setShowNewTripModal(false);
    setStockSource(`trip_${res.trip.id}`);
    notify(`${payload.vehicle} loaded with ${res.total} cs${res.godowns > 1 ? ` from ${res.godowns} godowns` : ''}.`);
    return null;
  };

  // Filter customers by selected beat if beat filter is active on sale page
  const filteredCustomersForPredictive = useMemo(() => {
    if (selectedBeatFilter === 'all') return customers;
    return (customers || []).filter((c) => {
      const bName = beatOfCustomer(c, beats)?.name || c.route || c.city || '';
      return bName.toLowerCase() === selectedBeatFilter.toLowerCase();
    });
  }, [customers, beats, selectedBeatFilter]);

  const filteredExistingCustomersForPredictive = useMemo(() => {
    if (selectedBeatFilter === 'all') return existingCustomers;
    return (existingCustomers || []).filter((c) => {
      const match = (customers || []).find((cust) => cust.name.toLowerCase() === c.name.toLowerCase());
      const bName = (match && (beatOfCustomer(match, beats)?.name || match.route || match.city)) || c.address || '';
      return bName.toLowerCase().includes(selectedBeatFilter.toLowerCase());
    });
  }, [existingCustomers, customers, beats, selectedBeatFilter]);

  // Quick save new customer with Beat
  const handleSaveNewCustomer = async () => {
    if (!newCustName.trim()) return;
    if (newCustPhone.trim()) {
      const phoneErr = validatePhone(newCustPhone, { label: 'Customer phone' });
      if (phoneErr) {
        notify(phoneErr);
        return;
      }
    }

    const gstinErr = validateGstin(newCustGstin || '', { label: 'GSTIN' });
    if (gstinErr) {
      notify(gstinErr);
      return;
    }

    const cleanName = newCustName.trim();
    const cleanPhone = newCustPhone.trim();
    const { sameShop, samePhone } = findDuplicateCustomer(customers || [], cleanName, cleanPhone);
    let useExistingOnPhoneMatch = false;
    if (!sameShop && samePhone) {
      useExistingOnPhoneMatch = await confirmDialog({
        title: 'Mobile number already registered',
        message: `Mobile ${last10Of(cleanPhone)} already belongs to "${samePhone.name}".`,
        confirmLabel: `Use "${samePhone.name}"`,
        cancelLabel: `Create "${cleanName}" separately`,
        tone: 'warning',
      });
    }

    let assignedBeatId: string | undefined = undefined;
    const cleanBeat = (newCustBeat || '').trim();

    if (cleanBeat && !useExistingOnPhoneMatch) {
      const match =
        activeBeats.find((b) => b.name.toLowerCase() === cleanBeat.toLowerCase()) ||
        beats.find((b) => b.name.toLowerCase() === cleanBeat.toLowerCase());
      if (match) {
        assignedBeatId = match.id;
      }
    }

    const created = addCustomer(
      {
        name: cleanName,
        phone: cleanPhone,
        gstin: newCustGstin.trim().toUpperCase() || undefined,
        address: newCustAddress.trim() || undefined,
        city: cleanBeat || undefined,
        route: cleanBeat || undefined,
        beatId: assignedBeatId,
      },
      { useExistingOnPhoneMatch },
    );

    setShowNewCustomerModal(false);
    setSelectedCustomerId(created.id);
    setCustomerName(created.name);
    setCustomerPhone(created.phone || '');
    setCustomerGstin(created.gstin || '');
    setNewCustName('');
    setNewCustPhone('');
    setNewCustGstin('');
    setNewCustAddress('');
    setNewCustBeat('');
    notify(`Customer "${created.name}" saved${cleanBeat ? ` in Beat "${cleanBeat}"` : ''}.`);
    checkAndPromptProducts(created.name, stockSource);
  };



  const {
    nameCounts,
    getProductStock,
    inStockCount,
    categories,
    sizeOptions,
    baseFilteredProducts,
    hasActiveSchemeForProduct,
    schemeMatchCount,
    cartMatchCount,
    categoryCounts,
    filteredProducts,
    categorySections,
  } = useNewSaleFilters({
    products,
    trips,
    stockSource,
    selectedItems,
    customSchemes,
    schemeMode,
    schemesEnabled: billingSettings?.schemesEnabled,
    autoApplyPromotions: billingSettings?.autoApplyPromotions,
    activePromoFor,
    getVehicleStock,
    warehouseStock,
    remainingStock,
    beverageSearch,
    selectedCategory,
    selectedPackFilter,
    selectedSize,
    setSelectedSize,
    schemesOnly,
    inCartOnly,
    setInCartOnly,
  });

  const openQuickEntry = useCallback(
    (prod: Product) => {
      const inCart = selectedItems[prod.id] || 0;
      const defRate = getProductDefaultPrice(prod);
      const curRate = customRates[prod.id] !== undefined ? customRates[prod.id] : defRate;
      setQuickEntryProduct(prod);
      setQuickEntryQty(inCart > 0 ? String(inCart) : '1');
      setQuickEntryRate(String(curRate));
      setTimeout(() => {
        quickEntryQtyRef.current?.focus();
        quickEntryQtyRef.current?.select();
      }, 30);
    },
    [selectedItems, customRates],
  );

  // Set custom price per case
  const handleSetProductRate = (productId: number, rate: number) => {
    setCustomRates((prev) => ({ ...prev, [productId]: rate }));
    if (customerName && setCustomProductPrice) {
      setCustomProductPrice(productId, rate, customerName);
    }
  };

  // Quantity updates
  const setItemQty = (productId: number, qty: number) => {
    let effectiveQty = Math.max(0, qty);
    if (saleSource === 'trip' && effectiveQty > 0) {
      const avail = Math.max(0, getProductStock(productId));
      if (effectiveQty > avail) {
        effectiveQty = avail;
        notify(
          avail <= 0
            ? 'Selected product is out of stock on this van.'
            : `Only ${avail} cases available on this van.`,
        );
      }
    }

    setSelectedItems((prev) => {
      const next = { ...prev };
      if (effectiveQty <= 0) {
        delete next[productId];
      } else {
        next[productId] = effectiveQty;
      }
      return next;
    });

    setItemOrder((prev) => {
      if (effectiveQty <= 0) {
        return prev.filter((id) => id !== productId);
      }
      if (prev.includes(productId)) return prev;
      return [...prev, productId];
    });
  };

  // Compute bill line items with custom rate, schemes, and tax via unified applyCartSchemes
  const { lineItems, taxableAmount, cgstAmount, sgstAmount, totalTax, grandTotal, totalFreeQty, totalDiscount } = useMemo(() => {
    const pIds = Object.keys(selectedItems)
      .map(Number)
      .filter((id) => (selectedItems[id] || 0) > 0);

    // Order product IDs according to itemOrder, with any unlisted at the end
    const orderedPids = [...pIds].sort((a, b) => {
      const idxA = itemOrder.indexOf(a);
      const idxB = itemOrder.indexOf(b);
      if (idxA >= 0 && idxB >= 0) return idxA - idxB;
      if (idxA >= 0) return -1;
      if (idxB >= 0) return 1;
      return 0;
    });

    const rawLines = orderedPids.map((pId) => {
      const prod = products.find((p) => p.id === pId);
      const defaultCatalogRate = prod ? getProductDefaultPrice(prod) : 0;
      const customRate = customRates[pId] !== undefined ? customRates[pId] : defaultCatalogRate;

      const userChoice = customSchemes[pId];
      let promo: Promotion | null = null;
      let noScheme = false;

      if (userChoice !== undefined) {
        promo = userChoice;
        if (userChoice === null) noScheme = true;
      } else if (schemeMode === 'none' || billingSettings?.schemesEnabled === false) {
        promo = null;
        noScheme = true;
      } else if (schemeMode === 'manual' || billingSettings?.autoApplyPromotions === false) {
        promo = null;
        noScheme = false;
      } else {
        promo = activePromoFor ? activePromoFor(pId) : null;
      }

      return {
        productId: pId,
        qty: selectedItems[pId] || 0,
        customRate,
        promo,
        noScheme,
        priceType: 'Retail' as PriceType,
      };
    });

    return applyCartSchemes(rawLines, promotions, products, {
      billType,
      itemOrder,
      autoAddMissingFreeLines: schemeMode !== 'none',
      disableAllSchemes: schemeMode === 'none' || billingSettings?.schemesEnabled === false,
      autoApply: schemeMode === 'auto' && billingSettings?.autoApplyPromotions !== false,
    });
  }, [
    selectedItems,
    itemOrder,
    customRates,
    customSchemes,
    schemeMode,
    billingSettings?.schemesEnabled,
    billingSettings?.autoApplyPromotions,
    products,
    billType,
    activePromoFor,
    promotions,
  ]);

  const collectedAmountPreview = useMemo(() => {
    const trimmed = paymentAmount.trim();
    if (trimmed === '') return 0;
    return Math.min(grandTotal, Math.max(0, Number(trimmed) || 0));
  }, [paymentAmount, grandTotal]);
  const balanceDuePreview = Math.max(0, grandTotal - collectedAmountPreview);

  const cartTaxStatus = useMemo(() => {
    const mix = cartTaxMix(lineItems, products);
    return {
      hasNonGst: mix.nonGst.length > 0,
      hasTaxable: mix.taxable.length > 0,
      allNonGst: mix.allNonGst,
      hasMixedTax: mix.hasMixed,
    };
  }, [lineItems, products]);

  const splitPreview = useMemo(() => {
    const gstLines = lineItems.filter((it) => !isLineNonGst(it, products));
    const nonGstLines = lineItems.filter((it) => isLineNonGst(it, products));
    const gstTotal = Math.round(gstLines.reduce((s, it) => s + (Number(it.gross) || 0), 0) * 100) / 100;
    const gstTax = Math.round(gstLines.reduce((s, it) => s + (Number(it.cgst) || 0) + (Number(it.sgst) || 0), 0) * 100) / 100;
    const nonGstTotal = Math.round(nonGstLines.reduce((s, it) => s + (Number(it.amount ?? it.gross) || 0), 0) * 100) / 100;
    const gstPaid = Math.round(Math.min(collectedAmountPreview, gstTotal) * 100) / 100;
    const nonGstPaid = Math.round(Math.min(Math.max(0, collectedAmountPreview - gstPaid), nonGstTotal) * 100) / 100;
    return { gstLines, nonGstLines, gstTotal, gstTax, nonGstTotal, gstPaid, nonGstPaid };
  }, [lineItems, products, collectedAmountPreview]);

  useEffect(() => {
    if (cartTaxStatus.allNonGst && billType === 'tax_invoice') {
      setBillType('bill_of_supply');
    }
  }, [cartTaxStatus.allNonGst, billType]);

  const customerPhoneError = useMemo(
    () => (customerPhone.trim() ? validatePhone(customerPhone, { label: 'Customer phone' }) : null),
    [customerPhone]
  );

  // Total crates in cart
  const totalCartQty = useMemo(() => {
    return lineItems.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  }, [lineItems]);

  // Keep LedgerContext cart synchronized so finalizeBill succeeds
  useEffect(() => {
    const isTrip = stockSource.startsWith('trip_');
    const tripId = isTrip ? parseInt(stockSource.replace('trip_', ''), 10) : undefined;
    const matchedTrip = tripId != null ? trips.find((t) => Number(t.id) === tripId) : undefined;
    const warehouseId = isTrip
      ? tripPrimaryWarehouseId(matchedTrip) || undefined
      : stockSource || undefined;

    setCart({
      retailer: customerName,
      phone: customerPhone,
      date: saleDate,
      items: lineItems,
      warehouseId,
      tripId,
    });
  }, [customerName, customerPhone, saleDate, lineItems, stockSource, trips, setCart]);

  // Handle Save Bill from Cart Review
  const handleSaveBill = () => {
    if (!customerName.trim()) {
      notify('Please choose or enter a customer name.');
      return;
    }
    if (customerPhoneError) {
      notify(customerPhoneError);
      return;
    }
    if (lineItems.length === 0) {
      notify('Please add at least one beverage / crate to the bill.');
      setShowCartReview(false);
      setShowProductSelector(true);
      return;
    }

    const isTrip = stockSource.startsWith('trip_');
    const tripToAssign = isTrip ? parseInt(stockSource.replace('trip_', ''), 10) : undefined;
    const matchedTrip = tripToAssign != null ? trips.find((t) => Number(t.id) === tripToAssign) : undefined;
    const warehouseId = isTrip
      ? tripPrimaryWarehouseId(matchedTrip) || undefined
      : stockSource || undefined;

    const isGst = billType === 'tax_invoice' && !cartTaxStatus.allNonGst;
    const supplyType = isGst && customerGstin.trim() ? 'B2B' : 'B2C';

    const trimmedPayment = paymentAmount.trim();
    const paidNum =
      trimmedPayment === ''
        ? 0
        : Math.min(grandTotal, Math.max(0, Number(trimmedPayment) || 0));
    const effectivePaymentMode: PaymentMode =
      paidNum <= 0 ? 'credit' : paymentMode === 'credit' ? 'cash' : paymentMode;

    const resetCheckoutUi = () => {
      if (customerPhone.trim() && selectedCustomerId && selectedCustomerId !== '__walkin__' && updateCustomer) {
        const matchedCust = (customers || []).find((c) => c.id === selectedCustomerId);
        if (matchedCust && !(matchedCust.phone || '').trim()) {
          updateCustomer({
            ...matchedCust,
            phone: customerPhone.trim(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
      setSelectedItems({});
      setItemOrder([]);
      setCustomRates({});
      setCustomSchemes({});
      setSelectedCustomerId('');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerGstin('');
      setPaymentAmount('');
      setPaymentMode('cash');
      setPaymentNote('');
      setPayChoice('credit');
      setShowCartReview(false);
      setPhoneReviewStage('cart');
    };

    if (cartTaxStatus.hasMixedTax) {
      const splitRes = finalizeSplitBills({
        amountPaid: paidNum,
        tripId: tripToAssign,
        overallDiscount: 0,
        paymentDate: saleDate,
        paymentMode: effectivePaymentMode,
        paymentNote: paymentNote || undefined,
        billDate: saleDate,
        extras: {
          supplyType,
          customerGstin: customerGstin.trim() ? customerGstin.trim().toUpperCase() : undefined,
          isRetrospective: false,
          invoiceType: billType === 'tax_invoice' ? 'tax_invoice' : 'bill_of_supply',
          isGstInvoice: isGst,
          party: {
            retailer: customerName,
            phone: customerPhone,
            customerId:
              selectedCustomerId && selectedCustomerId !== '__walkin__' ? selectedCustomerId : undefined,
          },
        },
      });
      if (splitRes) {
        // Show exactly what was saved (never a rebuilt preview): GST invoice first, else the cash memo.
        const first = splitRes.gstBill ?? splitRes.nonGstBill;
        if (first) {
          const firstIsGst = Boolean(splitRes.gstBill) && first.docSeries !== 'non_gst';
          if (splitRes.gstBill && splitRes.nonGstBill) {
            notify(
              `Split order saved: ${splitRes.gstBill.docNo || 'GST invoice'} + ${splitRes.nonGstBill.docNo || 'Non-GST cash memo'}.`,
            );
          }
          setSavedBill(first);
          resetCheckoutUi();
          if (!isPhone) {
            onOpenInvoiceModal(first, firstIsGst && first.isGstInvoice ? 'gst' : 'non_gst');
          }
        }
      }
      return;
    }

    const billId = finalizeBill(
      paidNum,
      tripToAssign,
      0, // additionalDiscount
      saleDate,
      effectivePaymentMode,
      paymentNote || undefined,
      saleDate,
      {
        supplyType,
        customerGstin: customerGstin.trim() ? customerGstin.trim().toUpperCase() : undefined,
        isRetrospective: false,
        invoiceType: billType === 'tax_invoice' ? 'tax_invoice' : 'bill_of_supply',
        isGstInvoice: isGst,
        docSeries: cartTaxStatus.allNonGst ? 'non_gst' : 'gst',
        gstExclude: cartTaxStatus.allNonGst,
        // the customer that was picked, so the bill links to exactly that record (not a name/phone guess)
        party: {
          retailer: customerName,
          phone: customerPhone,
          customerId:
            selectedCustomerId && selectedCustomerId !== '__walkin__' ? selectedCustomerId : undefined,
        },
      }
    );

    if (billId !== null) {
      const persisted = getBillById?.(billId);
      const newlyCreated: Bill = persisted || {
        id: billId,
        docSeries: cartTaxStatus.allNonGst ? 'non_gst' : 'gst',
        gstExclude: cartTaxStatus.allNonGst,
        retailer: customerName,
        phone: customerPhone,
        date: saleDate,
        items: lineItems,
        subtotal: taxableAmount,
        cgst: cgstAmount,
        sgst: sgstAmount,
        discount: totalDiscount,
        totalTaxable: taxableAmount,
        totalCgst: cgstAmount,
        totalSgst: sgstAmount,
        totalTax: totalTax,
        total: grandTotal,
        amountPaid: paidNum,
        paymentMode: effectivePaymentMode,
        warehouseId,
        tripId: tripToAssign,
        saleSource: isTrip ? 'trip' : 'warehouse',
        supplyType,
        customerGstin: customerGstin.trim() || undefined,
        invoiceType: isGst ? 'tax_invoice' : 'bill_of_supply',
        isGstInvoice: isGst,
        status: 'active',
      };

      setSavedBill(newlyCreated);
      resetCheckoutUi();
      if (!isPhone) {
        onOpenInvoiceModal(newlyCreated, isGst ? 'gst' : 'non_gst');
      }
    }
  };

  const selectedStockLabel = useMemo(() => {
    if (stockSource.startsWith('trip_')) {
      const tid = parseInt(stockSource.replace('trip_', ''), 10);
      const tr = trips.find((t) => t.id === tid);
      return tr ? `${tr.vehicle} (#${tr.id})` : 'Delivery Van';
    }
    const wh = warehouses.find((w) => w.id === stockSource);
    return wh ? `${wh.name} (${wh.code || 'Godown'})` : 'Godown';
  }, [stockSource, trips, warehouses]);

  // ---- Order context + review helpers (display only; cart math is untouched) ----
  const inr = formatInr;
  const formattedSaleDate = formatSaleDate(saleDate, todayStr);
  const lowStockLimit = Math.max(0, Number(billingSettings?.lowStockThreshold) || 5);

  const tripOptions = useMemo(
    () =>
      activeTripsForUser.map((tr) => {
        let casesLeft = 0;
        if (getVehicleStock) {
          for (const p of products) {
            casesLeft += Math.max(0, getVehicleStock(tr, p.id).available);
          }
        } else {
          for (const pid of Object.keys(tr.loaded || {})) {
            const idNum = Number(pid);
            const loaded = Number(tr.loaded?.[idNum] || 0);
            const returned = Number(tr.returned?.[idNum] || 0);
            casesLeft += Math.max(0, loaded - returned);
          }
        }
        return {
          id: tr.id,
          label: tr.vehicle ? `${tr.vehicle} · #${tr.id}` : `Trip #${tr.id}`,
          vehicle: tr.vehicle || undefined,
          salesman: tr.salesman || undefined,
          route: tr.route || undefined,
          date: tr.date || undefined,
          casesLeft,
        };
      }),
    [activeTripsForUser, getVehicleStock, products],
  );

  const warehouseOptions = useMemo(
    () =>
      (warehouses || []).map((w) => {
        let casesLeft = 0;
        for (const p of products) {
          const qty = warehouseStock ? warehouseStock(w.id, p.id) : remainingStock(p.id);
          casesLeft += Math.max(0, qty);
        }
        return {
          id: w.id,
          name: w.name,
          code: w.code || undefined,
          casesLeft,
        };
      }),
    [warehouses, warehouseStock, remainingStock, products],
  );
  // Routes / beats of the trips that are out today: drives the "Today's Route" pill in Step 1.
  const todayRoutes = useMemo(
    () => activeTripsForUser.map((tr) => (tr.route || '').trim()).filter(Boolean),
    [activeTripsForUser],
  );

  // Credit position of the picked retailer: limit, what they owe now, and what is left to use.
  const creditInfo = useMemo(() => {
    const rec =
      (customers || []).find((c) => c.id === selectedCustomerId) ||
      (customers || []).find((c) => normCustName(c.name) === normCustName(customerName));
    const limit = Math.max(0, Number(rec?.creditLimit) || 0);
    let due = 0;
    try {
      due = Math.max(0, getCustomerLedger(customerName, customerPhone).rawBalance);
    } catch {
      /* no ledger yet: treat as nothing due */
    }
    return { limit, due, available: limit > 0 ? Math.max(0, limit - due) : (null as number | null) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, selectedCustomerId, customerName, customerPhone, bills, payments]);
  const creditExceeded = creditInfo.available !== null && grandTotal > creditInfo.available + 0.005;

  // Savings shown in the summary: scheme / % / flat discounts (already worked out by applyCartSchemes)
  // plus the gap between the catalogue rate and any custom rate typed for a line.
  const customPriceSavings = useMemo(() => {
    let sum = 0;
    for (const it of lineItems) {
      if (it.isFree || it.isBundleFreeItem) continue;
      const prod = products.find((p) => p.id === it.productId);
      const base = prod ? getProductDefaultPrice(prod) : 0;
      const rate = Number(it.rate) || 0;
      if (base > 0 && rate > 0 && rate < base) sum += (base - rate) * (Number(it.qty) || 0);
    }
    return Math.round(sum * 100) / 100;
  }, [lineItems, products]);
  const totalSavings = Math.round((totalDiscount + customPriceSavings) * 100) / 100;
  // grandTotal is already after discounts, so subtotal − savings = grand total.
  const subtotalBeforeSavings = Math.round((grandTotal + totalSavings) * 100) / 100;

  // Payment cards drive the same paymentMode / paymentAmount that handleSaveBill already reads.
  const selectPayChoice = (choice: 'credit' | 'cash' | 'upi' | 'partial') => {
    setPayChoice(choice);
    if (choice === 'partial') {
      setPaymentAmount('');
      if (paymentMode === 'credit') setPaymentMode('cash');
    }
  };
  useEffect(() => {
    if (payChoice === 'credit') {
      setPaymentMode('credit');
      setPaymentAmount('0');
    } else if (payChoice === 'cash' || payChoice === 'upi') {
      setPaymentMode(payChoice);
      setPaymentAmount(String(grandTotal)); // stays "paid in full" if the cart changes
    }
  }, [payChoice, grandTotal]);

  // Step 4 "Edit": back to Step 1 with the cart kept. Picking a retailer again returns to the catalog.
  const goBackToStep1 = () => {
    setShowCartReview(false);
    setShowProductSelector(false);
    setSelectedCustomerId('');
  };

  // "New Customer / Shop" form: shown from Step 1 and from the inline customer search below.
  const newCustomerSheet = showNewCustomerModal ? (
    <NewCustomerSheet
      name={newCustName}
      onNameChange={setNewCustName}
      phone={newCustPhone}
      onPhoneChange={setNewCustPhone}
      gstin={newCustGstin}
      onGstinChange={setNewCustGstin}
      address={newCustAddress}
      onAddressChange={setNewCustAddress}
      beat={newCustBeat}
      onBeatChange={setNewCustBeat}
      activeBeats={activeBeats}
      prefilledFields={newCustPrefilled}
      onSave={handleSaveNewCustomer}
      onClose={() => {
        setNewCustPrefilled({});
        setShowNewCustomerModal(false);
      }}
    />
  ) : null;

  const requestCancelSale = () => {
    if (totalCartQty > 0) {
      setShowCancelSaleConfirm(true);
    } else {
      handleResetSale();
    }
  };

  const cancelSaleConfirmModal = (
    <CancelSaleConfirmModal
      open={showCancelSaleConfirm}
      totalCartQty={totalCartQty}
      t={t}
      onKeepCart={() => setShowCancelSaleConfirm(false)}
      onConfirmCancel={handleResetSale}
    />
  );

  // STAGE 4 (Phone): Bill saved success screen before returning to Step 1
  if (isPhone && savedBill) {
    return (
      <PhoneBillSavedScreen
        bill={savedBill}
        t={t}
        onOpenInvoiceModal={onOpenInvoiceModal}
        onCreateNextBill={() => {
          setSavedBill(null);
          setPhoneReviewStage('cart');
        }}
        onOpenHistory={() => {
          setSavedBill(null);
          setPhoneReviewStage('cart');
          onBack();
        }}
      />
    );
  }

  // STEP 1: no customer chosen yet. Picking one (or saving a new one) sets selectedCustomerId, which
  // moves on to the order form below. Reset / finishing a bill clears it and brings Step 1 back.
  if (!selectedCustomerId) {
    return (
      <div className="hh-view w-full min-w-0 overflow-x-hidden">
        <CustomerStep
          customers={filteredCustomersForPredictive}
          existingCustomers={filteredExistingCustomersForPredictive}
          beats={beats}
          activeBeats={activeBeats}
          selectedBeatFilter={selectedBeatFilter}
          onBeatFilterChange={setSelectedBeatFilter}
          bills={bills}
          payments={payments}
          onBack={onBack}
          todayRoutes={todayRoutes}
          tripLabel={saleSource === 'trip' && selectedTripId !== undefined ? `Trip: #TRP-${selectedTripId}` : undefined}
          cartItemCount={totalCartQty}
          onCancelSale={requestCancelSale}
          stockSummary={{
            source: saleSource,
            label: saleSource === 'trip' ? `Van: ${selectedStockLabel}` : selectedStockLabel,
            dateLabel: formattedSaleDate,
            isBackDated: saleDate < todayStr,
          }}
          contextBar={
            <OrderContextBar
              saleSource={saleSource}
              onSaleSourceChange={handleSaleSourceChange}
              trips={tripOptions}
              selectedTripId={selectedTripId}
              onTripChange={(id) => {
                const nextSource = `trip_${id}`;
                setStockSource(nextSource);
                clampItemsToTrip(nextSource);
              }}
              warehouses={warehouseOptions}
              selectedWarehouseId={!stockSource.startsWith('trip_') ? stockSource : defaultWarehouseId}
              onWarehouseChange={(id) => setStockSource(id)}
              saleDate={saleDate}
              onSaleDateChange={setSaleDate}
              todayIso={todayStr}
            />
          }
          // Same handlers as the inline customer search in the order form (kept identical on purpose).
          onSelectCustomer={(c: RichCustomerOption) => {
            setSavedBill(null);
            setPhoneReviewStage('cart');
            setSelectedCustomerId(c.id);
            setCustomerName(c.name);
            setCustomerPhone(c.phone || '');
            setCustomerGstin(c.gstin || '');
            loadCustomPricesForCustomer(c.name);
            checkAndPromptProducts(c.name, stockSource);
          }}
          onSelectSpotSale={() => {
            setSavedBill(null);
            setPhoneReviewStage('cart');
            setSelectedCustomerId('__walkin__');
            setCustomerName('Apt / Walk-in sale');
            setCustomerPhone('');
            setCustomerGstin('');
            loadCustomPricesForCustomer('Apt / Walk-in sale');
            checkAndPromptProducts('Apt / Walk-in sale', stockSource);
          }}
          onOpenCreateCustomer={(prefill) => {
            setNewCustName(prefill.name || '');
            setNewCustPhone(prefill.phone || '');
            setNewCustGstin(prefill.gstin || '');
            setNewCustBeat(selectedBeatFilter !== 'all' ? selectedBeatFilter : '');
            setNewCustPrefilled({
              name: Boolean(prefill.name),
              phone: Boolean(prefill.phone),
              gstin: Boolean(prefill.gstin),
            });
            setShowNewCustomerModal(true);
          }}
        />
        {newCustomerSheet}
        {cancelSaleConfirmModal}
      </div>
    );
  }

  return (
    <div
      className={`hh-view w-full min-w-0 overflow-x-hidden pb-16 ${
        isCompact ? 'space-y-3' : 'space-y-4'
      }`}
    >
      {/* Top Header Bar (tablet & desktop only; phone uses AppHeader + New Sale/History tabs) */}
      {isCompact && !isPhone ? (
        <FlowInlineHeader
          title="Order Details"
          onBack={goBackToStep1}
          backLabel="Back to retailers"
          right={
            <button
              type="button"
              id="btn-floating-cart"
              onClick={() => setShowCartReview(true)}
              aria-label="Review cart and finalize bill"
              className={`min-h-[34px] sm:min-h-[38px] px-2.5 sm:px-3 rounded-full font-bold text-xs inline-flex items-center gap-1 cursor-pointer transition-all shrink-0 shadow-xs ${
                totalCartQty > 0
                  ? 'bg-gradient-to-r from-[#19A84B] to-[#0D8A38] text-white! border border-white/20'
                  : 'bg-white/15 hover:bg-white/25 text-white! border border-white/20'
              }`}
            >
              <ShoppingCart className="w-4 h-4 shrink-0" />
              {totalCartQty > 0 ? (
                <span className="tabular-nums whitespace-nowrap">
                  {totalCartQty} · ₹{money(grandTotal)}
                </span>
              ) : (
                <span className="tabular-nums">0</span>
              )}
            </button>
          }
        />
      ) : !isCompact ? (
        <div className="flex items-center justify-between gap-3 sticky top-0 bg-[var(--canvas)] z-30 py-2.5 -my-2 border-b border-slate-200/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 leading-tight whitespace-nowrap truncate">
                Order & Invoice Details
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Select customer, godown stock, and water products to generate bill
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(selectedCustomerId || totalCartQty > 0) && (
              <button
                type="button"
                id="btn-reset-new-customer"
                onClick={requestCancelSale}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Cancel sale & clear current order"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t('salesman.cancelSale')}</span>
              </button>
            )}

            <button
              type="button"
              id="btn-floating-cart"
              onClick={() => setShowCartReview(true)}
              className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer shrink-0 ${
                totalCartQty > 0
                  ? 'bg-[var(--primary)] text-white hover:bg-[var(--primary)] shadow-emerald-950/20 active:scale-95'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
              title="Review cart and finalize bill"
            >
              <div className="relative">
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                {totalCartQty > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-xs font-black flex items-center justify-center border border-white">
                    {totalCartQty}
                  </span>
                )}
              </div>
              <span className="hidden xs:inline">Review Cart</span>
              {totalCartQty > 0 && (
                <span className="font-mono text-emerald-200 font-bold ml-0.5">
                  ₹{money(grandTotal)}
                </span>
              )}
            </button>
          </div>
        </div>
      ) : null}

      <NewSaleSetupPanel
        isPhone={isPhone}
        isCompact={isCompact}
        t={t}
        inr={inr}
        customerName={customerName}
        customerPhone={customerPhone}
        setCustomerPhone={setCustomerPhone}
        customerGstin={customerGstin}
        customerPhoneError={customerPhoneError}
        creditDue={creditInfo.due}
        goBackToStep1={goBackToStep1}
        requestCancelSale={requestCancelSale}
        saleSource={saleSource}
        selectedStockLabel={selectedStockLabel}
        formattedSaleDate={formattedSaleDate}
        saleDate={saleDate}
        setSaleDate={setSaleDate}
        todayStr={todayStr}
        editSetup={editSetup}
        setEditSetup={setEditSetup}
        handleSaleSourceChange={handleSaleSourceChange}
        tripOptions={tripOptions}
        selectedTripId={selectedTripId}
        setStockSource={setStockSource}
        warehouseOptions={warehouseOptions}
        stockSource={stockSource}
        defaultWarehouseId={defaultWarehouseId}
        billType={billType}
        setBillType={setBillType}
        compositionLocked={compositionLocked}
        cartTaxStatus={cartTaxStatus}
        invoicePrefix={billingSettings?.invoicePrefix}
        activeBeats={activeBeats}
        selectedBeatFilter={selectedBeatFilter}
        setSelectedBeatFilter={setSelectedBeatFilter}
        selectedCustomerId={selectedCustomerId}
        filteredCustomersForPredictive={filteredCustomersForPredictive}
        filteredExistingCustomersForPredictive={filteredExistingCustomersForPredictive}
        onSelectPredictiveCustomer={(c) => {
          setSelectedCustomerId(c.id);
          setCustomerName(c.name);
          setCustomerPhone(c.phone || '');
          setCustomerGstin(c.gstin || '');
          loadCustomPricesForCustomer(c.name);
          checkAndPromptProducts(c.name, stockSource);
        }}
        onSelectSpotSale={() => {
          setSelectedCustomerId('__walkin__');
          setCustomerName('Apt / Walk-in sale');
          setCustomerPhone('');
          setCustomerGstin('');
          loadCustomPricesForCustomer('Apt / Walk-in sale');
          checkAndPromptProducts('Apt / Walk-in sale', stockSource);
        }}
        onOpenCreateCustomerFromDesktop={(prefill) => {
          setNewCustName(prefill.name || '');
          setNewCustPhone(prefill.phone || '');
          setNewCustGstin(prefill.gstin || '');
          setNewCustBeat(selectedBeatFilter !== 'all' ? selectedBeatFilter : '');
          setNewCustPrefilled({});
          setShowNewCustomerModal(true);
        }}
        handleStockSourceChange={handleStockSourceChange}
        warehouses={warehouses}
        activeTripsForUser={activeTripsForUser}
        onOpenProductSelector={() => setShowProductSelector(true)}
        totalCartQty={totalCartQty}
        grandTotal={grandTotal}
        onOpenCartReview={() => setShowCartReview(true)}
      />

      {/* STEP 2 — Beverage Catalog (phone restyled sheet on <768px; 8/4 split modal on tablet+) */}
      {showProductSelector && (
        <NewSaleCatalogModal
          isPhone={isPhone}
          isOdia={isOdia}
          t={t}
          inr={inr}
          selectedCustomerId={selectedCustomerId}
          customerName={customerName}
          creditInfo={creditInfo}
          selectedStockLabel={selectedStockLabel}
          saleSource={saleSource}
          goBackToStep1={goBackToStep1}
          requestCancelSale={requestCancelSale}
          onCloseSelector={() => setShowProductSelector(false)}
          onProceedToReview={() => {
            setShowProductSelector(false);
            setShowCartReview(true);
          }}
          onProceedToPhoneCart={() => {
            setPhoneReviewStage('cart');
            setShowProductSelector(false);
            setShowCartReview(true);
          }}
          catalogFilterRef={catalogFilterRef}
          catalogFilterOpen={catalogFilterOpen}
          setCatalogFilterOpen={setCatalogFilterOpen}
          beverageSearch={beverageSearch}
          setBeverageSearch={setBeverageSearch}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedPackFilter={selectedPackFilter}
          setSelectedPackFilter={setSelectedPackFilter}
          selectedSize={selectedSize}
          setSelectedSize={setSelectedSize}
          schemesOnly={schemesOnly}
          setSchemesOnly={setSchemesOnly}
          inCartOnly={inCartOnly}
          setInCartOnly={setInCartOnly}
          sizeOptions={sizeOptions}
          categories={categories}
          categoryCounts={categoryCounts}
          baseFilteredProducts={baseFilteredProducts}
          filteredProducts={filteredProducts}
          categorySections={categorySections}
          inStockCount={inStockCount}
          schemeMatchCount={schemeMatchCount}
          cartMatchCount={cartMatchCount}
          hasActiveSchemeForProduct={hasActiveSchemeForProduct}
          getProductStock={getProductStock}
          selectedItems={selectedItems}
          customRates={customRates}
          customSchemes={customSchemes}
          schemeMode={schemeMode}
          schemesEnabled={billingSettings?.schemesEnabled}
          autoApplyPromotions={billingSettings?.autoApplyPromotions}
          activePromoFor={activePromoFor}
          products={products}
          lineItems={lineItems}
          lowStockLimit={lowStockLimit}
          nameCounts={nameCounts}
          setItemQty={setItemQty}
          openQuickEntry={openQuickEntry}
          totalCartQty={totalCartQty}
          totalFreeQty={totalFreeQty}
          totalDiscount={totalDiscount}
          grandTotal={grandTotal}
        />
      )}

      {/* STEP 3 & STEP 4 — Cart & Schemes → Review & Checkout */}
      {showCartReview && (
        <NewSaleReviewModal
          isPhone={isPhone}
          isCompact={isCompact}
          t={t}
          inr={inr}
          selectedCustomerId={selectedCustomerId}
          customerName={customerName}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          customerGstin={customerGstin}
          customerPhoneError={customerPhoneError}
          phoneReviewStage={phoneReviewStage}
          setPhoneReviewStage={setPhoneReviewStage}
          goBackToStep1={goBackToStep1}
          backToCatalog={() => {
            setShowCartReview(false);
            setShowProductSelector(true);
          }}
          requestCancelSale={requestCancelSale}
          lineItems={lineItems}
          products={products}
          totalCartQty={totalCartQty}
          totalFreeQty={totalFreeQty}
          totalDiscount={totalDiscount}
          totalSavings={totalSavings}
          subtotalBeforeSavings={subtotalBeforeSavings}
          totalTax={totalTax}
          grandTotal={grandTotal}
          creditInfo={creditInfo}
          creditExceeded={creditExceeded}
          collectedAmountPreview={collectedAmountPreview}
          balanceDuePreview={balanceDuePreview}
          payChoice={payChoice}
          setPayChoice={setPayChoice}
          selectPayChoice={selectPayChoice}
          paymentMode={paymentMode}
          setPaymentMode={setPaymentMode}
          paymentAmount={paymentAmount}
          setPaymentAmount={setPaymentAmount}
          billType={billType}
          setBillType={setBillType}
          compositionLocked={compositionLocked}
          cartTaxStatus={cartTaxStatus}
          splitPreview={splitPreview}
          saleSource={saleSource}
          selectedTripId={selectedTripId}
          formattedSaleDate={formattedSaleDate}
          setItemQty={setItemQty}
          openQuickEntry={openQuickEntry}
          handleSaveBill={handleSaveBill}
        />
      )}

      <NewSaleSchemeModals
        quickEntryProduct={quickEntryProduct}
        quickEntryQty={quickEntryQty}
        setQuickEntryQty={setQuickEntryQty}
        quickEntryRate={quickEntryRate}
        setQuickEntryRate={setQuickEntryRate}
        quickEntryQtyRef={quickEntryQtyRef}
        setQuickEntryProduct={setQuickEntryProduct}
        schemeModalProduct={schemeModalProduct}
        setSchemeModalProduct={setSchemeModalProduct}
        products={products}
        promotions={promotions}
        selectedItems={selectedItems}
        customRates={customRates}
        customSchemes={customSchemes}
        setCustomSchemes={setCustomSchemes}
        schemeMode={schemeMode}
        schemesEnabled={billingSettings?.schemesEnabled}
        autoApplyPromotions={billingSettings?.autoApplyPromotions}
        activePromoFor={activePromoFor}
        stockSource={stockSource}
        getProductStock={getProductStock}
        handleSetProductRate={handleSetProductRate}
        setItemQty={setItemQty}
      />

      {/* MODAL: Add New Customer */}
      {newCustomerSheet}
      {cancelSaleConfirmModal}

      {/* New van trip: the full load-sheet screen (products + quantities), so the van has stock to sell */}
      {showNewTripModal && (
        <NewTripSheet
          products={products}
          warehouses={warehouses}
          salesmen={salesmen}
          vehicles={Array.from(new Set(trips.map((t) => (t.vehicle || '').trim()).filter(Boolean))).sort((x, y) => x.localeCompare(y))}
          routes={activeBeats.map((b) => b.name)}
          defaultWarehouseId={defaultWarehouseId}
          warehouseStock={warehouseStock}
          attachableBills={createTrip.attachable}
          lockedSalesman={
            currentUser && typeof currentUser === 'object' && 'role' in currentUser && currentUser.role === 'salesman'
              ? { id: String((currentUser as any).id), name: String((currentUser as any).name || 'Salesman') }
              : undefined
          }
          onSubmit={handleCreateTrip}
          onClose={() => setShowNewTripModal(false)}
        />
      )}
    </div>
  );
};
