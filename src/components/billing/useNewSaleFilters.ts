import { useCallback, useEffect, useMemo } from 'react';
import { CATS } from '../../constants/initialData';
import { Product, Promotion, Trip } from '../../types';
import { compareProductsInSequence, packTheme, sizeTheme } from '../../utils/sizeColor';
import { isSodaProduct, sizeOfProduct } from './newSaleHelpers';

export interface UseNewSaleFiltersParams {
  products: Product[];
  trips: Trip[];
  stockSource: string;
  selectedItems: Record<number, number>;
  customSchemes: Record<number, Promotion | null>;
  schemeMode: 'auto' | 'none' | 'manual';
  schemesEnabled?: boolean;
  autoApplyPromotions?: boolean;
  activePromoFor?: (productId: number) => Promotion | null;
  getVehicleStock?: (trip: Trip, productId: number) => { available: number };
  warehouseStock?: (warehouseId: string, productId: number) => number;
  remainingStock: (productId: number) => number;
  beverageSearch: string;
  selectedCategory: string;
  selectedPackFilter: 'all' | 'can' | 'pet' | 'glass' | 'tetra';
  selectedSize: string;
  setSelectedSize: (val: string) => void;
  schemesOnly: boolean;
  inCartOnly: boolean;
  setInCartOnly: (val: boolean) => void;
}

export function useNewSaleFilters({
  products,
  trips,
  stockSource,
  selectedItems,
  customSchemes,
  schemeMode,
  schemesEnabled,
  autoApplyPromotions,
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
}: UseNewSaleFiltersParams) {
  const nameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const clean = p.name.trim().toLowerCase();
      counts.set(clean, (counts.get(clean) || 0) + 1);
    }
    return counts;
  }, [products]);

  const getProductStock = useCallback(
    (productId: number): number => {
      if (stockSource.startsWith('trip_')) {
        const tripId = parseInt(stockSource.replace('trip_', ''), 10);
        const trip = trips.find((t) => t.id === tripId);
        if (trip) {
          if (getVehicleStock) {
            const vs = getVehicleStock(trip, productId);
            return Math.max(0, vs.available);
          }
          const loaded = Number(trip.loaded?.[productId] || 0);
          const returned = Number(trip.returned?.[productId] || 0);
          return Math.max(0, loaded - returned);
        }
        return 0;
      }
      if (warehouseStock) {
        return warehouseStock(stockSource, productId);
      }
      return remainingStock(productId);
    },
    [stockSource, trips, getVehicleStock, warehouseStock, remainingStock],
  );

  const availableProducts = useMemo(() => {
    return products.filter((p) => getProductStock(p.id) > 0 || (selectedItems[p.id] || 0) > 0);
  }, [products, getProductStock, selectedItems]);

  const inStockCount = useMemo(() => {
    return products.filter((p) => getProductStock(p.id) > 0).length;
  }, [products, getProductStock]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    availableProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['all', ...Array.from(set)];
  }, [availableProducts]);

  const sizeOptions = useMemo(() => {
    const set = new Set<number>();
    availableProducts.forEach((p) => {
      const v = sizeOfProduct(p);
      if (v > 0) set.add(v);
    });
    return Array.from(set)
      .sort((a, b) => a - b)
      .map((v) => ({ id: String(v), label: sizeTheme(v).label }));
  }, [availableProducts]);

  useEffect(() => {
    if (selectedSize !== 'all' && selectedSize !== 'soda' && !sizeOptions.some((o) => o.id === selectedSize)) {
      setSelectedSize('all');
    }
  }, [sizeOptions, selectedSize, setSelectedSize]);

  const baseFilteredProducts = useMemo(() => {
    return availableProducts
      .filter((p) => {
        if (selectedSize === 'soda') {
          if (!isSodaProduct(p)) return false;
        } else if (selectedSize !== 'all') {
          if (String(sizeOfProduct(p)) !== selectedSize) return false;
        }
        const pTheme = packTheme(p.pack, p.name);
        if (selectedPackFilter !== 'all') {
          const pl = pTheme.label.toLowerCase();
          if (selectedPackFilter === 'can' && !pl.includes('can') && !pl.includes('tin')) return false;
          if (selectedPackFilter === 'pet' && !pl.includes('pet')) return false;
          if (selectedPackFilter === 'glass' && !pl.includes('glass') && !pl.includes('rgb')) return false;
          if (selectedPackFilter === 'tetra' && !pl.includes('tetra') && !pl.includes('pouch')) return false;
        }

        const q = beverageSearch.toLowerCase().trim();
        const sTheme = sizeTheme(p.volume, p.name);
        const matchesSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          sTheme.label.toLowerCase().includes(q) ||
          pTheme.label.toLowerCase().includes(q) ||
          (p.pack && p.pack.toLowerCase().includes(q)) ||
          (p.volume && String(p.volume).includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q));

        return matchesSearch;
      })
      .sort(compareProductsInSequence);
  }, [availableProducts, beverageSearch, selectedPackFilter, selectedSize]);

  const hasActiveSchemeForProduct = useCallback(
    (prod: Product): boolean => {
      const userChoice = customSchemes[prod.id];
      if (userChoice !== undefined) return Boolean(userChoice);
      if (schemeMode === 'none' || schemesEnabled === false || autoApplyPromotions === false) {
        return false;
      }
      return Boolean(activePromoFor ? activePromoFor(prod.id) : null);
    },
    [customSchemes, schemeMode, schemesEnabled, autoApplyPromotions, activePromoFor],
  );

  const schemeMatchCount = useMemo(
    () => baseFilteredProducts.filter((p) => hasActiveSchemeForProduct(p)).length,
    [baseFilteredProducts, hasActiveSchemeForProduct],
  );

  const cartMatchCount = useMemo(
    () => baseFilteredProducts.filter((p) => (selectedItems[p.id] || 0) > 0).length,
    [baseFilteredProducts, selectedItems],
  );

  useEffect(() => {
    if (inCartOnly && cartMatchCount === 0) setInCartOnly(false);
  }, [inCartOnly, cartMatchCount, setInCartOnly]);

  const quickFilteredProducts = useMemo(() => {
    if (!schemesOnly && !inCartOnly) return baseFilteredProducts;
    return baseFilteredProducts.filter((p) => {
      if (schemesOnly && !hasActiveSchemeForProduct(p)) return false;
      if (inCartOnly && (selectedItems[p.id] || 0) <= 0) return false;
      return true;
    });
  }, [baseFilteredProducts, schemesOnly, inCartOnly, hasActiveSchemeForProduct, selectedItems]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of quickFilteredProducts) {
      const catKey = p.category || 'other';
      counts.set(catKey, (counts.get(catKey) || 0) + 1);
    }
    return counts;
  }, [quickFilteredProducts]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') return quickFilteredProducts;
    return quickFilteredProducts.filter((p) => (p.category || 'other') === selectedCategory);
  }, [quickFilteredProducts, selectedCategory]);

  const categorySections = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of filteredProducts) {
      const catKey = p.category || 'other';
      const arr = map.get(catKey);
      if (arr) arr.push(p);
      else map.set(catKey, [p]);
    }
    const orderedKeys: string[] = [];
    for (const cat of categories) {
      if (cat !== 'all' && map.has(cat)) orderedKeys.push(cat);
    }
    for (const k of map.keys()) {
      if (!orderedKeys.includes(k)) orderedKeys.push(k);
    }
    return orderedKeys.map((k) => ({
      key: k,
      label: (CATS as Record<string, { name: string }>)[k]?.name || k || 'Beverages',
      items: map.get(k) || [],
    }));
  }, [filteredProducts, categories]);

  return {
    nameCounts,
    getProductStock,
    availableProducts,
    inStockCount,
    categories,
    sizeOptions,
    baseFilteredProducts,
    hasActiveSchemeForProduct,
    schemeMatchCount,
    cartMatchCount,
    quickFilteredProducts,
    categoryCounts,
    filteredProducts,
    categorySections,
  };
}
