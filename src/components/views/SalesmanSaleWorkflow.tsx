import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product } from '../../types';
import { InvoiceSuccessCard } from '../billing/InvoiceSuccessCard';
import {
  startSpeechRecognition,
  parseSpokenQuantityAndProduct,
  ActiveSpeechSession,
} from '../../utils/speechRecognition';
import { useLedger } from '../../context/LedgerContext';
import { searchHaystack } from '../../utils/displayName';
import { useAutoOdiaNameMap } from '../../hooks/useAutoOdiaName';
import { useBeatFilter } from '../../hooks/useBeatFilter';
import { collectExpiryAlerts } from '../../utils/fefo';
import { todayISO } from "../../utils/dateLocal";
import { useIsMobile } from '../../hooks/useIsMobile';
import { money } from '../../utils/billing';
import { SalesmanSaleSmartHint, SalesmanSaleWorkflowProps } from './salesman/salesmanSaleShared';
import { SalesmanSalePhoneFlow } from './salesman/SalesmanSalePhoneFlow';
import { SalesmanSaleDesktopFlow } from './salesman/SalesmanSaleDesktopFlow';

export const SalesmanSaleWorkflow: React.FC<SalesmanSaleWorkflowProps> = ({
  confirmedBill,
  setConfirmedBill,
  onOpenInvoiceModal,
  cart,
  activeTrip,
  products,
  customers,
  selectedRetailer,
  setSelectedRetailer,
  retailerPhone,
  setRetailerPhone,
  setRetailerCustomerId,
  isLowVision,
  palette,
  finalCartTotal,
  getVehicleStock,
  getProductCartQty,
  onQuickProductCartChange,
  onOpenCart,
  onCancelSaleSequence,
  onCreateNextInvoice,
  onVoiceSearchCustomer,
  isVoiceSearching,
  speakAssistiveText,
  onSetSalesmanTab,
  saleDate = todayISO(),
  setSaleDate,
  availableTrips = [],
  onSelectTripId,
  onOpenNewVanModal,
}) => {
  const isPhone = useIsMobile(1023);
  const productNameMap = useAutoOdiaNameMap(products || []);
  const customerNameMap = useAutoOdiaNameMap(customers || [], 'person');

  // Read-only ledger data for smart assist (does not change sale / stock behaviour)
  const { inventoryBatches, bills, customers: ledgerCustomers, findBillingCustomer, getCustomerLedger, activePromoFor } = useLedger();

  // Local state for search & filtering
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [productAlphaFilter, setProductAlphaFilter] = useState<string>('ALL');
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false);

  // Voice Product Search state
  const [isProductVoiceActive, setIsProductVoiceActive] = useState<boolean>(false);
  const [productVoiceTranscript, setProductVoiceTranscript] = useState<string>('');
  const [voiceActionResult, setVoiceActionResult] = useState<{ text: string; type: 'success' | 'warn' } | null>(null);
  const voiceSessionRef = useRef<ActiveSpeechSession | null>(null);

  // Available product categories (only categories with available van stock or items in cart)
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const { available } = getVehicleStock(activeTrip, p.id);
      if (((Number(available) || 0) > 0 || getProductCartQty(p.id) > 0) && p.category) {
        set.add(p.category);
      }
    });
    return ['ALL', ...Array.from(set)];
  }, [products, activeTrip, getVehicleStock, getProductCartQty, cart.items]);

  useEffect(() => {
    if (selectedCategory !== 'ALL' && !categories.includes(selectedCategory)) {
      setSelectedCategory('ALL');
    }
  }, [categories, selectedCategory]);

  // Beat filter
  const beatFilter = useBeatFilter();
  const filteredCustomerSuggestions = useMemo(() => {
    const inBeat = beatFilter.apply(customers || []);
    if (!customerSearchQuery.trim()) {
      return beatFilter.active ? [...inBeat].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40) : [];
    }
    const query = customerSearchQuery.toLowerCase().trim();
    return inBeat
      .filter((c) => searchHaystack(c).includes(query) || (c.phone && c.phone.includes(query)))
      .slice(0, 12);
  }, [customers, customerSearchQuery, beatFilter.apply, beatFilter.active]);

  // Filtered products: strictly show only products with available van stock (or already in cart)
  const filteredProducts: Product[] = useMemo(() => {
    return products.filter((prod) => {
      const { available } = getVehicleStock(activeTrip, prod.id);
      if ((Number(available) || 0) <= 0 && getProductCartQty(prod.id) <= 0) {
        return false;
      }

      if (selectedCategory !== 'ALL' && prod.category !== selectedCategory) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = searchHaystack(prod).includes(query);
        const matchesCat = (prod.category || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCat) return false;
      }
      if (productAlphaFilter !== 'ALL') {
        const first = (prod.name || '').trim().toUpperCase().charAt(0);
        if (productAlphaFilter === 'A-D' && !(first >= 'A' && first <= 'D')) return false;
        if (productAlphaFilter === 'E-H' && !(first >= 'E' && first <= 'H')) return false;
        if (productAlphaFilter === 'I-L' && !(first >= 'I' && first <= 'L')) return false;
        if (productAlphaFilter === 'M-P' && !(first >= 'M' && first <= 'P')) return false;
        if (productAlphaFilter === 'Q-T' && !(first >= 'Q' && first <= 'T')) return false;
        if (productAlphaFilter === 'U-Z' && !(first >= 'U' && first <= 'Z')) return false;
      }
      return true;
    });
  }, [products, activeTrip, getVehicleStock, getProductCartQty, cart.items, selectedCategory, searchTerm, productAlphaFilter]);

  const cartItemCount = cart.items.reduce((sum, it) => sum + it.qty, 0);

  // Smart assist — informational only (Salesman mode).
  const salesmanSmartHints: SalesmanSaleSmartHint[] = useMemo(() => {
    const hints: SalesmanSaleSmartHint[] = [];
    const asOf = (saleDate || todayISO()).slice(0, 10);

    if (!activeTrip) {
      hints.push({
        id: 'no-trip',
        tone: 'amber',
        text: 'Select an active van / trip before adding stock',
      });
      return hints;
    }

    const vanProductIds = new Set<number>();
    products.forEach((p) => {
      const { loaded, available } = getVehicleStock(activeTrip, p.id);
      if ((loaded || 0) > 0 || (available || 0) > 0) vanProductIds.add(p.id);
    });

    if (vanProductIds.size > 0 && inventoryBatches?.length) {
      const alerts = collectExpiryAlerts(inventoryBatches, products, asOf).filter((a) =>
        vanProductIds.has(a.productId)
      );
      const expired = alerts.filter((a) => a.level === 'expired');
      const critical = alerts.filter((a) => a.level === 'critical');
      if (expired.length > 0) {
        hints.push({
          id: 'exp-block',
          tone: 'rose',
          text: `${expired.length} expired lot(s) linked to van products — do not sell; return or write off`,
        });
      }
      if (critical.length > 0) {
        hints.push({
          id: 'exp-soon',
          tone: 'amber',
          text: `${critical.length} lot(s) expire within 7 days — prioritise those SKUs on this route`,
        });
      }
    }

    for (const it of cart.items) {
      const { available } = getVehicleStock(activeTrip, it.productId);
      const avail = Math.max(0, available || 0);
      if (avail > 0 && it.qty >= avail) {
        hints.push({
          id: `full-${it.productId}`,
          tone: 'amber',
          text: `${it.productName}: cart has all ${avail} cases left on this van`,
        });
      }
    }

    const party = (selectedRetailer || '').trim();
    if (party && party.toLowerCase() !== 'cash sale' && party.toLowerCase() !== 'spot cash') {
      let due = 0;
      for (const b of bills || []) {
        if ((b.retailer || '').trim().toLowerCase() === party.toLowerCase()) {
          due += Math.max(0, (b.total || 0) - (b.amountPaid || 0));
        }
      }
      if (due > 1) {
        hints.push({
          id: 'party-due',
          tone: 'sky',
          text: `${party} has ₹${money(due)} open on previous bills`,
        });
      }
    }

    if (party && party.toLowerCase() !== 'cash sale' && party.toLowerCase() !== 'spot cash') {
      const cust = findBillingCustomer(party, retailerPhone);
      const limit = Number(cust?.creditLimit) || 0;
      if (limit > 0 && cust) {
        const due = Math.max(0, getCustomerLedger(cust.id).rawBalance);
        if (due > limit) {
          hints.push({
            id: 'credit-over',
            tone: 'rose',
            text: `Over credit limit (due ₹${money(due)} / limit ₹${money(limit)}) — collect before more credit`,
          });
        } else if (due > limit * 0.8) {
          hints.push({
            id: 'credit-near',
            tone: 'amber',
            text: `Near credit limit: ₹${money(due)} of ₹${money(limit)}`,
          });
        }
      }
      if (cust && (cust.route || cust.city)) {
        hints.push({
          id: 'route',
          tone: 'sky',
          text: `Beat: ${[cust.route, cust.city].filter(Boolean).join(' · ')}${cust.address ? ' — ' + cust.address : ''}`,
        });
      }
    }

    if (cart.items.length > 0 && hints.filter((h) => h.id !== 'no-trip').length === 0) {
      hints.push({
        id: 'ok',
        tone: 'emerald',
        text: `Van ready · ${cartItemCount} cs in cart · FEFO on save`,
      });
    }

    return hints.slice(0, 4);
  }, [
    saleDate,
    activeTrip,
    products,
    inventoryBatches,
    cart.items,
    getVehicleStock,
    selectedRetailer,
    bills,
    cartItemCount,
    ledgerCustomers,
  ]);

  // Handle Voice Product Search
  const handleStartProductVoiceSearch = () => {
    if (isProductVoiceActive) {
      if (voiceSessionRef.current) {
        voiceSessionRef.current.stop();
      }
      setIsProductVoiceActive(false);
      return;
    }

    setProductVoiceTranscript('');
    setIsProductVoiceActive(true);

    const session = startSpeechRecognition({
      onStart: () => {
        setIsProductVoiceActive(true);
      },
      onInterimResult: (interim) => {
        setProductVoiceTranscript(interim);
      },
      onResult: (transcript) => {
        setIsProductVoiceActive(false);
        setProductVoiceTranscript(transcript);

        const parsed = parseSpokenQuantityAndProduct(transcript);
        if (!parsed.query) {
          setVoiceActionResult({ text: 'Could not understand product name.', type: 'warn' });
          return;
        }

        const queryLower = parsed.query.toLowerCase().trim();

        const matched = products.find((p) => {
          const nameLower = p.name.toLowerCase();
          return nameLower.includes(queryLower) || queryLower.includes(nameLower);
        }) || products.find((p) => {
          const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
          const nameLower = p.name.toLowerCase();
          return queryWords.some((w) => nameLower.includes(w));
        });

        if (matched) {
          const { available } = getVehicleStock(activeTrip, matched.id);
          if (available <= 0) {
            setVoiceActionResult({
              text: `${matched.name} is currently OUT OF STOCK on this van.`,
              type: 'warn',
            });
            speakAssistiveText(`${matched.name} is out of stock on this van.`);
          } else {
            const currentInCart = getProductCartQty(matched.id);
            const canAdd = Math.max(0, available - currentInCart);
            const toAdd = Math.min(parsed.quantity, canAdd);

            if (toAdd > 0) {
              onQuickProductCartChange(matched.id, toAdd);
              const msg = `✓ Added ${toAdd} case(s) of ${matched.name} to cart.`;
              setVoiceActionResult({ text: msg, type: 'success' });
              speakAssistiveText(`Added ${toAdd} cases of ${matched.name}`);
            } else {
              setVoiceActionResult({
                text: `Van only has ${available} cases of ${matched.name}, all already in cart!`,
                type: 'warn',
              });
              speakAssistiveText(`All ${available} cases already added to cart.`);
            }
          }
        } else {
          setSearchTerm(parsed.query);
          setVoiceActionResult({
            text: `Filtered beverages by "${parsed.query}". Tap the item below to add.`,
            type: 'success',
          });
          speakAssistiveText(`Showing matches for ${parsed.query}`);
        }

        setTimeout(() => {
          setVoiceActionResult(null);
        }, 5000);
      },
      onError: (err) => {
        setIsProductVoiceActive(false);
        setVoiceActionResult({ text: err, type: 'warn' });
        setTimeout(() => setVoiceActionResult(null), 4000);
      },
      onEnd: () => {
        setIsProductVoiceActive(false);
      },
    });

    voiceSessionRef.current = session;
  };

  useEffect(() => {
    return () => {
      if (voiceSessionRef.current) {
        voiceSessionRef.current.abort();
      }
    };
  }, []);

  if (confirmedBill) {
    const handleNextInvoice = () => {
      setConfirmedBill(null);
      if (onCreateNextInvoice) {
        onCreateNextInvoice();
      } else {
        onCancelSaleSequence();
      }
    };

    return (
      <div id="confirmed-sale-screen" className="space-y-4 max-w-none mx-auto py-2 pb-52 lg:pb-4">
        <InvoiceSuccessCard
          bill={confirmedBill}
          onOpenInvoiceModal={onOpenInvoiceModal}
          onCreateNextBill={handleNextInvoice}
          onOpenHistory={() => {
            setConfirmedBill(null);
            onSetSalesmanTab('bills');
          }}
        />
      </div>
    );
  }

  const sharedFlowProps = {
    cart,
    activeTrip,
    customers,
    ledgerCustomers,
    selectedRetailer,
    setSelectedRetailer,
    retailerPhone,
    setRetailerPhone,
    setRetailerCustomerId,
    isLowVision,
    finalCartTotal,
    cartItemCount,
    getVehicleStock,
    getProductCartQty,
    onQuickProductCartChange,
    onOpenCart,
    onCancelSaleSequence,
    onVoiceSearchCustomer,
    isVoiceSearching,
    speakAssistiveText,
    onSetSalesmanTab,
    saleDate,
    setSaleDate,
    availableTrips,
    onSelectTripId,
    onOpenNewVanModal,
    productNameMap,
    customerNameMap,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    productAlphaFilter,
    setProductAlphaFilter,
    categories,
    filteredProducts,
    beatFilter,
    customerSearchQuery,
    setCustomerSearchQuery,
    showCustomerDropdown,
    setShowCustomerDropdown,
    filteredCustomerSuggestions,
    showCancelConfirm,
    setShowCancelConfirm,
    showAddCustomerModal,
    setShowAddCustomerModal,
    isProductVoiceActive,
    handleStartProductVoiceSearch,
    voiceActionResult,
    setVoiceActionResult,
    salesmanSmartHints,
  };

  if (isPhone && !isLowVision) {
    return (
      <SalesmanSalePhoneFlow
        {...sharedFlowProps}
        activePromoFor={activePromoFor}
      />
    );
  }

  return (
    <SalesmanSaleDesktopFlow
      {...sharedFlowProps}
      palette={palette}
      productVoiceTranscript={productVoiceTranscript}
    />
  );
};
