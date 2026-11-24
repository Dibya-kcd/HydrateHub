import React, { useEffect, useRef, useState } from 'react';
import { notify } from '../../utils/toast';
import { useLedger } from '../../context/LedgerContext';
import { Promotion, PromotionType } from '../../types';
import { schemeLabel } from '../../utils/billing';
import { useIsMobile } from '../../hooks/useIsMobile';
import { PromotionsPhoneView } from './promotions/PromotionsPhoneView';
import { PromotionsDesktopView } from './promotions/PromotionsDesktopView';

export const PromotionsView: React.FC = () => {
  const {
    promotions,
    products,
    addPromotion,
    updatePromotion,
    deletePromotion,
    syncToCloud,
  } = useLedger();

  const [showAddPromo, setShowAddPromo] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<number | null>(null);
  const [promoToDelete, setPromoToDelete] = useState<Promotion | null>(null);
  const [isSyncingSchemes, setIsSyncingSchemes] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [draftPromo, setDraftPromo] = useState<Omit<Promotion, 'id'>>({
    name: '',
    type: 'bogo',
    buyQty: 2,
    freeQty: 1,
    percent: 10,
    flatPerCase: 15,
    productIds: [],
    isActive: true,
    bundleBuyType: 'any',
    requiredDistinctTypes: 2,
    minQtyPerType: 1,
    freeRewardChoice: 'all_eligible',
    freeProductId: undefined,
    freeProductQty: 1,
    productGroup: [],
    groupCategory: '',
    groupBrand: '',
    freeItemRule: 'CHEAPEST_IN_GROUP',
    customerChoiceProductId: undefined,
  });

  // Smart Filter Bar State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter] = useState<'all' | PromotionType>('all');
  const [productFilter] = useState<string>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement | null>(null);

  // Phone UI navigation state
  const isPhone = useIsMobile(1023);
  const [mobileStep, setMobileStep] = useState<1 | 2 | 3>(1);
  const [mobileScopeMode, setMobileScopeMode] = useState<'products' | 'category' | 'brand'>('products');
  const [mobileProdQuery, setMobileProdQuery] = useState('');

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
  const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    if (showFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterDropdown]);

  const filteredPromotions = promotions.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (schemeLabel(p, products) || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.productIds || []).some((id) =>
        products.find((prod) => prod.id === id)?.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) ||
      (p.productGroup || []).some((id) =>
        products.find((prod) => prod.id === id)?.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesType = typeFilter === 'all' || p.type === typeFilter;
    const matchesProduct =
      productFilter === 'all' ||
      (p.productIds && p.productIds.length === 0) ||
      (p.productIds && p.productIds.includes(Number(productFilter))) ||
      (p.productGroup && p.productGroup.includes(Number(productFilter)));

    return matchesSearch && matchesType && matchesProduct;
  });

  const startEdit = (promo: Promotion) => {
    setEditingPromoId(promo.id);
    setDraftPromo({
      name: promo.name,
      type: promo.type,
      buyQty: promo.buyQty,
      freeQty: promo.freeQty,
      percent: promo.percent,
      flatPerCase: promo.flatPerCase,
      productIds: [...(promo.productIds || (promo as any).product_ids || []).map(Number)],
      bundleBuyType: promo.bundleBuyType || 'any',
      requiredDistinctTypes: promo.requiredDistinctTypes || 2,
      minQtyPerType: promo.minQtyPerType || 1,
      freeRewardChoice: promo.freeRewardChoice || 'all_eligible',
      freeProductId: promo.freeProductId,
      isActive: promo.isActive !== false,
      freeProductQty: promo.freeProductQty || 1,
      productGroup: promo.productGroup ? [...promo.productGroup.map(Number)] : [],
      groupCategory: promo.groupCategory || '',
      groupBrand: promo.groupBrand || '',
      freeItemRule: promo.freeItemRule || 'CHEAPEST_IN_GROUP',
      customerChoiceProductId: promo.customerChoiceProductId,
    });
    setMobileStep(1);
    setMobileScopeMode(promo.groupCategory ? 'category' : promo.groupBrand ? 'brand' : 'products');
    setMobileProdQuery('');
    setShowAddPromo(true);
  };

  const cancelEdit = () => {
    setEditingPromoId(null);
    setShowAddPromo(false);
    setMobileStep(1);
    setMobileScopeMode('products');
    setMobileProdQuery('');
    setDraftPromo({
      name: '',
      type: 'bogo',
      buyQty: 2,
      freeQty: 1,
      percent: 10,
      flatPerCase: 15,
      productIds: [],
      bundleBuyType: 'any',
      requiredDistinctTypes: 2,
      minQtyPerType: 1,
      freeRewardChoice: 'all_eligible',
      freeProductId: undefined,
      isActive: true,
      freeProductQty: 1,
      productGroup: [],
      groupCategory: '',
      groupBrand: '',
      freeItemRule: 'CHEAPEST_IN_GROUP',
      customerChoiceProductId: undefined,
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftPromo.name.trim()) return;

    if (
      draftPromo.type === 'bundle' &&
      draftPromo.freeRewardChoice === 'specific' &&
      !draftPromo.freeProductId
    ) {
      notify('Please choose the Designated Free Reward Product.');
      return;
    }

    if (draftPromo.type === 'buy_x_get_different_free') {
      if (!draftPromo.freeProductId) {
        notify('Please choose the Free Product (Product B) that customers receive for free.');
        return;
      }
      if (draftPromo.productIds.length === 0) {
        notify('Please select at least one trigger product (Product A) that customers must buy.');
        return;
      }
    }

    if (draftPromo.type === 'group_buy_n_get_m_free') {
      const hasProducts = (draftPromo.productGroup && draftPromo.productGroup.length > 0) || (draftPromo.productIds && draftPromo.productIds.length > 0);
      const hasTag = !!draftPromo.groupCategory || !!draftPromo.groupBrand;
      if (!hasProducts && !hasTag) {
        notify('Please select the products or category/brand tag belonging to this group.');
        return;
      }
      if (draftPromo.freeItemRule === 'SPECIFIC_PRODUCT' && !draftPromo.freeProductId) {
        notify('Please select the specific free product to award for this group scheme.');
        return;
      }
    }

    const schemeName = draftPromo.name;
    const cleanIds = (draftPromo.productIds || []).map(Number).filter((n) => !isNaN(n));
    const cleanGroup = (draftPromo.productGroup || []).map(Number).filter((n) => !isNaN(n));
    const cleanDistinct = draftPromo.type === 'bundle'
      ? (cleanIds.length === 1 ? 1 : Math.max(1, draftPromo.requiredDistinctTypes || 2))
      : draftPromo.requiredDistinctTypes;

    const cleanDraft: Omit<Promotion, 'id'> = {
      ...draftPromo,
      productIds: cleanIds,
      productGroup: cleanGroup.length > 0 ? cleanGroup : cleanIds,
      requiredDistinctTypes: cleanDistinct,
      isActive: draftPromo.isActive !== false,
      freeItemRule: draftPromo.freeItemRule || draftPromo.freeItem || 'CHEAPEST_IN_GROUP',
      freeItem: draftPromo.freeItemRule || draftPromo.freeItem || 'CHEAPEST_IN_GROUP',
    };
    if (editingPromoId) {
      updatePromotion(editingPromoId, cleanDraft);
      setStatusMsg(`Scheme "${schemeName}" updated and synced — now active for billing.`);
    } else {
      addPromotion(cleanDraft);
      setStatusMsg(`Scheme "${schemeName}" created and synced — now active for billing.`);
    }
    cancelEdit();
    setTimeout(() => setStatusMsg(null), 5000);
  };

  const handleSyncDatabase = async () => {
    setIsSyncingSchemes(true);
    setStatusMsg(null);
    try {
      const res = await syncToCloud();
      setStatusMsg(res.message || 'Schemes successfully synchronized to Supabase.');
    } catch (e: any) {
      setStatusMsg(`Database sync failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setIsSyncingSchemes(false);
      setTimeout(() => setStatusMsg(null), 6000);
    }
  };

  const toggleSchemeActive = (promo: Promotion) => {
    const nextActive = promo.isActive === false;
    updatePromotion(promo.id, {
      ...promo,
      isActive: nextActive,
    });
    setStatusMsg(
      nextActive
        ? `Scheme "${promo.name}" activated — will apply at billing.`
        : `Scheme "${promo.name}" deactivated — will not apply at billing.`
    );
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const toggleProduct = (productId: number) => {
    const numId = Number(productId);
    setDraftPromo((prev) => {
      const cleanIds = (prev.productIds || []).map(Number);
      const exists = cleanIds.some((id) => id === numId);
      return {
        ...prev,
        productIds: exists ? cleanIds.filter((id) => id !== numId) : [...cleanIds, numId],
      };
    });
  };

  const openMobileCreate = () => {
    setEditingPromoId(null);
    setDraftPromo({
      name: '',
      type: 'bogo',
      buyQty: 2,
      freeQty: 1,
      percent: 10,
      flatPerCase: 15,
      productIds: [],
      isActive: true,
      bundleBuyType: 'any',
      requiredDistinctTypes: 2,
      minQtyPerType: 1,
      freeRewardChoice: 'all_eligible',
      freeProductId: undefined,
      freeProductQty: 1,
      productGroup: [],
      groupCategory: '',
      groupBrand: '',
      freeItemRule: 'CHEAPEST_IN_GROUP',
      freeItem: 'CHEAPEST_IN_GROUP',
      customerChoiceProductId: undefined,
    });
    setMobileStep(1);
    setMobileScopeMode('products');
    setMobileProdQuery('');
    setShowAddPromo(true);
  };

  if (isPhone) {
    return (
      <PromotionsPhoneView
        promotions={promotions}
        filteredPromotions={filteredPromotions}
        products={products}
        categories={categories}
        brands={brands}
        statusMsg={statusMsg}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showAddPromo={showAddPromo}
        editingPromoId={editingPromoId}
        draftPromo={draftPromo}
        setDraftPromo={setDraftPromo}
        promoToDelete={promoToDelete}
        setPromoToDelete={setPromoToDelete}
        isSyncingSchemes={isSyncingSchemes}
        mobileStep={mobileStep}
        setMobileStep={setMobileStep}
        mobileScopeMode={mobileScopeMode}
        setMobileScopeMode={setMobileScopeMode}
        mobileProdQuery={mobileProdQuery}
        setMobileProdQuery={setMobileProdQuery}
        openMobileCreate={openMobileCreate}
        startEdit={startEdit}
        cancelEdit={cancelEdit}
        handleSave={handleSave}
        handleSyncDatabase={handleSyncDatabase}
        toggleSchemeActive={toggleSchemeActive}
        toggleProduct={toggleProduct}
        deletePromotion={deletePromotion}
      />
    );
  }

  return (
    <PromotionsDesktopView
      promotions={promotions}
      filteredPromotions={filteredPromotions}
      products={products}
      categories={categories}
      brands={brands}
      statusMsg={statusMsg}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      showAddPromo={showAddPromo}
      setShowAddPromo={setShowAddPromo}
      editingPromoId={editingPromoId}
      setEditingPromoId={setEditingPromoId}
      draftPromo={draftPromo}
      setDraftPromo={setDraftPromo}
      promoToDelete={promoToDelete}
      setPromoToDelete={setPromoToDelete}
      isSyncingSchemes={isSyncingSchemes}
      startEdit={startEdit}
      cancelEdit={cancelEdit}
      handleSave={handleSave}
      handleSyncDatabase={handleSyncDatabase}
      toggleSchemeActive={toggleSchemeActive}
      toggleProduct={toggleProduct}
      deletePromotion={deletePromotion}
    />
  );
};
