import { useMemo, useState } from 'react';
import { Bill, PaymentRecord, Product, Trip } from '../../../types';
import { makeSalesmanMatcher } from '../../../utils/salesmanMatch';

interface UseSalesmanMetricsArgs {
  trips: Trip[];
  bills: Bill[];
  products: Product[];
  payments: PaymentRecord[];
  salesmen: any[];
  currentUser: any;
  todayStr: string;
  selectedTripId: number | null;
  getVehicleStock: (trip: Trip | null, productId: number) => { loaded: number; sold: number; available: number };
}

export function useSalesmanMetrics({
  trips,
  bills,
  products,
  payments,
  salesmen,
  currentUser,
  todayStr,
  selectedTripId,
  getVehicleStock,
}: UseSalesmanMetricsArgs) {
  const userSalesmanId = currentUser?.role === 'salesman' ? currentUser.id : undefined;
  const userSalesmanName = currentUser?.role === 'salesman' ? currentUser.name : undefined;

  const matchesMe = useMemo(
    () =>
      makeSalesmanMatcher(
        {
          id: userSalesmanId,
          name: userSalesmanName,
          phone: currentUser?.role === 'salesman' ? currentUser.phone : undefined,
        },
        salesmen,
      ),
    [userSalesmanId, userSalesmanName, currentUser, salesmen],
  );

  const relevantTrips = useMemo(() => {
    let list = trips;
    if (currentUser?.role === 'salesman') {
      const matched = trips.filter((t) => matchesMe(t));
      if (matched.length > 0) {
        list = matched;
      } else {
        const unassigned = trips.filter((t) => !t.salesmanId && !t.salesman);
        list = unassigned.length > 0 ? unassigned : trips;
      }
    }
    return [...list].sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      if (db !== da) return db.localeCompare(da);
      return Number(b.id) - Number(a.id);
    });
  }, [trips, currentUser, matchesMe]);

  const todayOutTrips = useMemo(() => {
    return relevantTrips.filter((t) => t.status === 'out' && (!t.date || t.date === todayStr));
  }, [relevantTrips, todayStr]);

  const anyOutTrips = useMemo(() => {
    return relevantTrips.filter((t) => t.status === 'out');
  }, [relevantTrips]);

  const olderOrClosedTrips = useMemo(() => {
    return relevantTrips.filter((t) => t.status === 'closed');
  }, [relevantTrips]);

  const activeTrip: Trip | null = useMemo(() => {
    if (selectedTripId !== null) {
      const found = anyOutTrips.find((t) => Number(t.id) === Number(selectedTripId));
      if (found) return found;
    }
    return todayOutTrips[0] ?? anyOutTrips[0] ?? null;
  }, [selectedTripId, todayOutTrips, anyOutTrips]);

  const otherOutTrips = useMemo(() => {
    if (!activeTrip) return anyOutTrips;
    return anyOutTrips.filter((t) => Number(t.id) !== Number(activeTrip.id));
  }, [anyOutTrips, activeTrip]);

  const [tripSearch, setTripSearch] = useState('');
  const [tripLimit, setTripLimit] = useState(30);
  const matchedHistoryTrips = useMemo(() => {
    const q = tripSearch.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    if (!q) return olderOrClosedTrips;
    return olderOrClosedTrips.filter((t) => {
      const phones = `${t.driverPhone || ''} ${t.salesmanPhone || ''}`;
      return (
        (t.vehicle || '').toLowerCase().includes(q) ||
        (t.route || '').toLowerCase().includes(q) ||
        (t.driver || '').toLowerCase().includes(q) ||
        (t.date || '').includes(q) ||
        String(t.id).includes(q) ||
        phones.toLowerCase().includes(q) ||
        (qDigits.length >= 3 && phones.replace(/\D/g, '').includes(qDigits))
      );
    });
  }, [olderOrClosedTrips, tripSearch]);
  const shownHistoryTrips = matchedHistoryTrips.slice(0, tripLimit);

  const frequentRetailers = useMemo(() => {
    const counts: Record<string, { count: number; phone: string }> = {};
    for (const b of bills) {
      const name = (b.retailer || '').trim();
      if (!name) continue;
      if (!counts[name]) counts[name] = { count: 0, phone: b.phone || '' };
      counts[name].count += 1;
      if (b.phone) counts[name].phone = b.phone;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([name, data]) => ({ name, phone: data.phone }));
  }, [bills]);

  const vehicleProducts = useMemo(() => {
    return products.map((prod) => {
      const { loaded, sold, available } = getVehicleStock(activeTrip, prod.id);
      return {
        ...prod,
        vanLoaded: loaded,
        vanSold: sold,
        vanAvailable: available,
        isLoadedOnVan: loaded > 0,
      };
    });
  }, [products, activeTrip, getVehicleStock]);

  const [vanStockSearch, setVanStockSearch] = useState<string>('');
  const filteredVehicleProducts = useMemo(() => {
    return vehicleProducts.filter((p) => {
      if (p.vanLoaded <= 0 && p.vanAvailable <= 0) return false;
      if (vanStockSearch.trim()) {
        const q = vanStockSearch.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku?.toLowerCase().includes(q);
        if (!matchName && !matchSku) return false;
      }
      return true;
    });
  }, [vehicleProducts, vanStockSearch]);

  const vanStockCounts = useMemo(() => {
    const loadedProds = vehicleProducts.filter((p) => p.vanLoaded > 0 || p.vanAvailable > 0);
    const total = loadedProds.length;
    const loaded = loadedProds.filter((p) => p.vanLoaded > 0).length;
    const available = loadedProds.filter((p) => p.vanAvailable > 0).length;
    const empty = loadedProds.filter((p) => p.vanLoaded > 0 && p.vanAvailable <= 0).length;
    const totalLoadedCases = vehicleProducts.reduce((sum, p) => sum + p.vanLoaded, 0);
    const totalSoldCases = vehicleProducts.reduce((sum, p) => sum + p.vanSold, 0);
    const totalAvailableCases = vehicleProducts.reduce((sum, p) => sum + p.vanAvailable, 0);
    return { total, loaded, available, empty, totalLoadedCases, totalSoldCases, totalAvailableCases };
  }, [vehicleProducts]);

  const tripBills = useMemo(() => {
    if (!activeTrip) return [];
    return bills.filter((b) => (b.tripId === activeTrip.id) || activeTrip.billIds.includes(b.id));
  }, [bills, activeTrip]);

  const tripTotalCollected = useMemo(() => {
    return tripBills.reduce((sum, b) => sum + (Number(b.amountPaid) || 0), 0);
  }, [tripBills]);

  const tripTotalBilled = useMemo(() => {
    return tripBills.reduce((sum, b) => sum + (Number(b.total) || 0), 0);
  }, [tripBills]);

  const myBills = useMemo(() => {
    if (currentUser?.role === 'salesman') {
      const myTripIds = new Set(relevantTrips.map((t) => t.id));
      return bills.filter((b) => {
        if (b.tripId && myTripIds.has(b.tripId)) return true;
        return matchesMe(b);
      });
    }
    return bills;
  }, [bills, currentUser, relevantTrips, matchesMe]);

  const [myBillsScope, setMyBillsScope] = useState<'currentTrip' | 'allMyBills'>('currentTrip');
  const [myBillsSearch, setMyBillsSearch] = useState<string>('');

  const displayedMyBills = useMemo(() => {
    const base = (myBillsScope === 'currentTrip' && activeTrip) ? tripBills : myBills;
    const q = myBillsSearch.toLowerCase().trim();
    if (!q) return base;
    return base.filter((b) => {
      const idStr = String(b.id);
      const retailer = (b.retailer || '').toLowerCase();
      const phone = (b.phone || '').toLowerCase();
      return idStr.includes(q) || retailer.includes(q) || phone.includes(q);
    });
  }, [myBillsScope, tripBills, myBills, myBillsSearch]);

  const myBillsTotalBilled = useMemo(() => {
    return myBills.reduce((sum, b) => sum + (Number(b.total) || 0), 0);
  }, [myBills]);

  const myBillsTotalPaid = useMemo(() => {
    return myBills.reduce((sum, b) => sum + (Number(b.amountPaid) || 0), 0);
  }, [myBills]);

  const todayBills = useMemo(() => {
    return myBills.filter((b) => {
      const d = (b.date || (b as any).createdAt || '').slice(0, 10);
      return d === todayStr;
    });
  }, [myBills, todayStr]);

  const todaySales = useMemo(() => {
    return todayBills.reduce((sum, b) => sum + (Number(b.total) || 0), 0);
  }, [todayBills]);

  const todayDeliveredCrates = useMemo(() => {
    return todayBills.reduce((sum, b) => {
      return sum + (b.items || []).reduce((itemSum, item) => itemSum + (Number(item.qty) || 0), 0);
    }, 0);
  }, [todayBills]);

  const totalLoadedItems = useMemo(() => {
    if (!activeTrip || !activeTrip.loaded) return 0;
    return Object.values(activeTrip.loaded).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
  }, [activeTrip]);

  const myPayments = useMemo(() => {
    if (currentUser?.role === 'salesman') {
      return (payments || []).filter((p) => {
        if (matchesMe({ salesmanId: p.salesmanId, salesman: p.recordedBy })) return true;
        if (p.billId && myBills.some((b) => b.id === p.billId)) return true;
        return false;
      });
    }
    return payments || [];
  }, [payments, currentUser, userSalesmanId, userSalesmanName, myBills]);

  const todayPayments = useMemo(() => {
    return myPayments.filter((p) => (p.paymentDate || p.createdAt || '').slice(0, 10) === todayStr);
  }, [myPayments, todayStr]);

  const { todayCash, todayUpi } = useMemo(() => {
    let cash = 0;
    let upi = 0;
    const coveredBillIds = new Set<number>();

    todayPayments.forEach((p) => {
      if (p.billId) coveredBillIds.add(p.billId);
      const amt = Number(p.amount) || 0;
      if (p.mode === 'cash') cash += amt;
      else if (p.mode === 'upi') upi += amt;
      else cash += amt;
    });

    todayBills.forEach((b) => {
      if (b.amountPaid > 0 && !coveredBillIds.has(b.id)) {
        const mode = b.paymentMode || 'cash';
        const amt = Number(b.amountPaid) || 0;
        if (mode === 'upi') upi += amt;
        else cash += amt;
      }
    });

    return { todayCash: Math.max(0, cash), todayUpi: Math.max(0, upi) };
  }, [todayPayments, todayBills]);

  return {
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
    vehicleProducts,
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
  };
}
