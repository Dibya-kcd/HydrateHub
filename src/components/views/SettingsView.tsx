import React, { useState, useEffect, useRef } from 'react';
import { Check, History } from 'lucide-react';
import { useLedger } from '../../context/LedgerContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { BeatsSettings } from './BeatsSettings';
import { useAvatarId } from '../common/UserAvatar';
import { GstMode, PriceType, Salesman } from '../../types';
import { validateOrgProfile, summarizeErrors, normalizeGstin } from '../../utils/validation';
import { SettingsBusinessMobile, SettingsBillingMobile } from './settings/SettingsMobileBusinessBilling';
import { SettingsFleetMobile, SettingsStaffMobile } from './settings/SettingsMobileFleetStaff';
import {
  SettingsDisplayMobile,
  SettingsCloudMobile,
  SettingsBackupsMobile,
  SettingsHomeMobile,
} from './settings/SettingsMobileSystem';
import { SettingsBusinessDesktop, SettingsBillingDesktop } from './settings/SettingsBusinessBillingDesktop';
import { SettingsFleetDesktop, SettingsStaffDesktop } from './settings/SettingsFleetStaffDesktop';
import { SettingsDisplayDesktop, SettingsCloudDesktop, SettingsBackupsDesktop } from './settings/SettingsSystemDesktop';
import { SettingsStaffModals } from './settings/SettingsStaffModals';
import type { BillingFormState, ProfileFormState, SettingsSection } from './settings/settingsTypes';

export const SettingsView: React.FC<{ initialSection?: SettingsSection | 'warehouses' }> = ({ initialSection }) => {
  const {
    orgProfile,
    updateOrgProfile,
    pullOrgProfileFromCloud,
    billingSettings,
    updateBillingSettings,
    pullBillingSettingsFromCloud,
    warehouses,
    addWarehouse,
    deleteWarehouse,
    salesmen,
    addSalesman,
    updateSalesman,
    deleteSalesman,
    toggleSalesmanActive,
    currentUser,
    trips,
    bills,
    payments,
    customers,
    products,
    grns,
    audits,
    stockTransfers,
    fontSize,
    setFontSize,
    highContrast,
    setHighContrast,
    lowVisionMode,
    toggleLowVisionMode,
    supabaseConfig,
    supabaseStatus,
    checkSupabaseConnection,
    syncToCloud,
    exportBackup,
    importBackup,
    clearTransactions,
    resetToDefault,
    logout,
    setTab,
  } = useLedger();
  const avatarId = useAvatarId();
  const isPhone = useIsMobile(1023);

  const { t, language, setLanguage } = useLanguage();

  // Active section filter for navigation (default: business on desktop, home list on phone)
  const [activeSection, setActiveSection] = useState<SettingsSection>(
    // Godowns are managed under the 'fleet' section (Warehouses & Vehicles).
    initialSection === 'warehouses' ? 'fleet' : initialSection || 'business',
  );
  const [mobileSection, setMobileSection] = useState<SettingsSection | null>(
    initialSection ? (initialSection === 'warehouses' ? 'fleet' : initialSection) : null,
  );
  useEffect(() => {
    if (initialSection) {
      const target = initialSection === 'warehouses' ? 'fleet' : initialSection;
      setActiveSection(target);
      setMobileSection(target);
    } else {
      setMobileSection(null);
    }
  }, [initialSection]);

  const [showMobileAddFleet, setShowMobileAddFleet] = useState(false);
  const [mobileFleetDriver, setMobileFleetDriver] = useState('');
  const [showMobileAddStaff, setShowMobileAddStaff] = useState(false);
  const [mobileStaffRole, setMobileStaffRole] = useState<'admin' | 'salesman'>('salesman');
  const [showAvatarSheet, setShowAvatarSheet] = useState(false);
  const [showResetSheet, setShowResetSheet] = useState(false);
  const [showMoreBilling, setShowMoreBilling] = useState(false);
  const [prefLang, setPrefLang] = useState<'en' | 'or'>(() => {
    try {
      return localStorage.getItem('mrwater_app_language') === 'or' ? 'or' : language;
    } catch {
      return language;
    }
  });

  // Edit Staff Modal State
  const [editingStaff, setEditingStaff] = useState<Salesman | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffPhone, setEditStaffPhone] = useState('');
  const [editStaffVehicle, setEditStaffVehicle] = useState('');
  const [editStaffSeriesCode, setEditStaffSeriesCode] = useState('');
  const [editStaffActive, setEditStaffActive] = useState(true);
  const [editStaffNewPin, setEditStaffNewPin] = useState('');
  const [editStaffError, setEditStaffError] = useState<string | null>(null);
  const [isStaffSubmitting, setIsStaffSubmitting] = useState(false);

  // Dedicated In-App Set PIN Modal State
  const [pinModalStaff, setPinModalStaff] = useState<Salesman | null>(null);
  const [targetPin, setTargetPin] = useState('');
  const [pinModalError, setPinModalError] = useState<string | null>(null);
  const [isPinSubmitting, setIsPinSubmitting] = useState(false);

  // Delete Staff Modal State
  const [deletingStaff, setDeletingStaff] = useState<Salesman | null>(null);

  // Real Database Business Profile Form State (synced from orgProfile)
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    name: orgProfile.name || '',
    tagline: orgProfile.tagline || '',
    ownerName: orgProfile.ownerName || '',
    phone: orgProfile.phone || '',
    email: orgProfile.email || '',
    address: orgProfile.address || '',
    city: orgProfile.city || '',
    state: orgProfile.state || '27 Maharashtra',
    stateCode: orgProfile.stateCode || '27',
    gstin: orgProfile.gstin || '',
    pan: orgProfile.gstin && orgProfile.gstin.length >= 12 ? orgProfile.gstin.slice(2, 12) : '',
    fssai: orgProfile.fssai || '',
    bankName: orgProfile.bankName || '',
    accountNumber: orgProfile.accountNumber || '',
    ifsc: orgProfile.ifsc || '',
    upiId: orgProfile.upiId || '',
    invoiceTerms: orgProfile.invoiceTerms || '',
  });

  // Real Database Billing Settings Form State (synced from billingSettings)
  const [billingForm, setBillingForm] = useState<BillingFormState>({
    printLayout: 'A4',
    creditLimitCrossed: 'Warn',
    expiryAlertDays: 60,
    sellEarliestExpiryFirst: true,
    allowSellingWithoutStock: false,
    invoicePrefix: billingSettings.invoicePrefix || 'INV',
    defaultSaleType: billingSettings.defaultSaleType || ('Retail' as PriceType),
    defaultGstMode: billingSettings.defaultGstMode || ('inclusive' as GstMode),
    lowStockThreshold: billingSettings.lowStockThreshold || 5,
    maxSalesmanDiscountPercent: billingSettings.maxSalesmanDiscountPercent ?? 10,
    roundOffGrandTotal: billingSettings.roundOffGrandTotal ?? true,
    showBatchOnInvoice: billingSettings.showBatchOnInvoice ?? false,
    gstOnFreeCases: billingSettings.gstOnFreeCases !== false,
    schemesEnabled: billingSettings.schemesEnabled !== false,
    autoApplyPromotions: billingSettings.autoApplyPromotions ?? true,
    showUpiQrOnReceipt: billingSettings.showUpiQrOnReceipt ?? true,
    showOdiaNameOnReceipt: billingSettings.showOdiaNameOnReceipt ?? false,
    defaultInvoicePaper: (billingSettings.defaultInvoicePaper === '80mm' ? '80mm' : 'a4') as 'a4' | '80mm',
    whatsappTextStyle: (billingSettings.whatsappTextStyle === 'receipt' ? 'receipt' : 'detailed') as 'detailed' | 'receipt',
    receiptTextWidth: (billingSettings.receiptTextWidth === 42 || billingSettings.receiptTextWidth === 48
      ? billingSettings.receiptTextWidth
      : 32) as 32 | 42 | 48,
    numberingMode: (billingSettings.numberingMode === 'per_salesman_series' ? 'per_salesman_series' : 'shared') as 'shared' | 'per_salesman_series',
  });

  // Keep forms in sync whenever database record changes
  useEffect(() => {
    setProfileForm({
      name: orgProfile.name || '',
      tagline: orgProfile.tagline || '',
      ownerName: orgProfile.ownerName || '',
      phone: orgProfile.phone || '',
      email: orgProfile.email || '',
      address: orgProfile.address || '',
      city: orgProfile.city || '',
      state: orgProfile.state || '27 Maharashtra',
      stateCode: orgProfile.stateCode || '27',
      gstin: orgProfile.gstin || '',
      pan: orgProfile.gstin && orgProfile.gstin.length >= 12 ? orgProfile.gstin.slice(2, 12) : '',
      fssai: orgProfile.fssai || '',
      bankName: orgProfile.bankName || '',
      accountNumber: orgProfile.accountNumber || '',
      ifsc: orgProfile.ifsc || '',
      upiId: orgProfile.upiId || '',
      invoiceTerms: orgProfile.invoiceTerms || '',
    });
  }, [orgProfile]);

  useEffect(() => {
    setBillingForm((prev) => ({
      ...prev,
      invoicePrefix: billingSettings.invoicePrefix || 'INV',
      defaultSaleType: billingSettings.defaultSaleType || 'Retail',
      defaultGstMode: billingSettings.defaultGstMode || 'inclusive',
      lowStockThreshold: billingSettings.lowStockThreshold || 5,
      maxSalesmanDiscountPercent: billingSettings.maxSalesmanDiscountPercent ?? 10,
      roundOffGrandTotal: billingSettings.roundOffGrandTotal ?? true,
      showBatchOnInvoice: billingSettings.showBatchOnInvoice ?? false,
      gstOnFreeCases: billingSettings.gstOnFreeCases !== false,
      schemesEnabled: billingSettings.schemesEnabled !== false,
      autoApplyPromotions: billingSettings.autoApplyPromotions ?? true,
      showUpiQrOnReceipt: billingSettings.showUpiQrOnReceipt ?? true,
      showOdiaNameOnReceipt: billingSettings.showOdiaNameOnReceipt ?? false,
      defaultInvoicePaper: billingSettings.defaultInvoicePaper === '80mm' ? '80mm' : 'a4',
      whatsappTextStyle: billingSettings.whatsappTextStyle === 'receipt' ? 'receipt' : 'detailed',
      receiptTextWidth:
        billingSettings.receiptTextWidth === 42 || billingSettings.receiptTextWidth === 48
          ? billingSettings.receiptTextWidth
          : 32,
      numberingMode:
        billingSettings.numberingMode === 'per_salesman_series' ? 'per_salesman_series' : 'shared',
    }));
  }, [billingSettings]);

  // Loading & Feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Warehouse Form State
  const [newWhName, setNewWhName] = useState('');
  const [newWhType, setNewWhType] = useState<'vehicle' | 'warehouse'>('vehicle');
  const [newWhRegNo, setNewWhRegNo] = useState('');

  // New Staff Form State
  const [newStaffIdentifier, setNewStaffIdentifier] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'driver' | 'salesman' | 'manager' | 'accountant' | 'admin'>('driver');
  const [newStaffPin, setNewStaffPin] = useState('');

  // Derive distinct vehicles from database trips and salesmen
  const existingVehicles = Array.from(
    new Set([
      ...trips.map((t) => t.vehicle).filter(Boolean),
      ...salesmen.map((s) => s.defaultVehicle).filter(Boolean),
    ])
  ) as string[];

  // Save Settings directly to Supabase cloud and local database
  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);

    const validationErrors = validateOrgProfile({
      name: profileForm.name,
      phone: profileForm.phone,
      email: profileForm.email,
      gstin: profileForm.gstin,
    });

    if (Object.keys(validationErrors).length > 0) {
      setToastMessage(summarizeErrors(validationErrors));
      setIsSaving(false);
      return;
    }
    // GST Rule 46: an invoice number is at most 16 characters of letters, digits, "-" and "/". Live numbers look like
    // PREFIX-S12-123456 (per-salesman series), so the prefix is capped at 6.
    const prefixCheck = String(billingForm.invoicePrefix || 'INV').trim();
    const prefixUnchanged = prefixCheck === String(billingSettings.invoicePrefix || 'INV').trim();
    if (!prefixUnchanged && !/^[A-Za-z0-9/-]{1,6}$/.test(prefixCheck)) {
      setToastMessage('Invoice prefix must be 1-6 letters/digits (GST allows at most 16 characters per invoice number).');
      setIsSaving(false);
      return;
    }


    try {
      const normalizedGstinVal = profileForm.gstin ? normalizeGstin(profileForm.gstin) : profileForm.gstin;

      const profileRes = await updateOrgProfile({
        name: profileForm.name,
        tagline: profileForm.tagline,
        ownerName: profileForm.ownerName,
        phone: profileForm.phone,
        email: profileForm.email,
        address: profileForm.address,
        city: profileForm.city,
        state: profileForm.state,
        stateCode: profileForm.state.slice(0, 2),
        gstin: normalizedGstinVal,
        fssai: profileForm.fssai,
        bankName: profileForm.bankName,
        accountNumber: profileForm.accountNumber,
        ifsc: profileForm.ifsc,
        upiId: profileForm.upiId,
        invoiceTerms: profileForm.invoiceTerms,
      });

      const billingRes = await updateBillingSettings({
        invoicePrefix: billingForm.invoicePrefix,
        defaultSaleType: billingForm.defaultSaleType,
        defaultGstMode: billingForm.defaultGstMode,
        lowStockThreshold: billingForm.lowStockThreshold,
        maxSalesmanDiscountPercent: billingForm.maxSalesmanDiscountPercent,
        roundOffGrandTotal: billingForm.roundOffGrandTotal,
        showBatchOnInvoice: billingForm.showBatchOnInvoice,
        gstOnFreeCases: billingForm.gstOnFreeCases,
        schemesEnabled: billingForm.schemesEnabled,
        autoApplyPromotions: billingForm.autoApplyPromotions,
        showUpiQrOnReceipt: billingForm.showUpiQrOnReceipt,
        showOdiaNameOnReceipt: billingForm.showOdiaNameOnReceipt,
        defaultInvoicePaper: billingForm.defaultInvoicePaper,
        whatsappTextStyle: billingForm.whatsappTextStyle,
        receiptTextWidth: billingForm.receiptTextWidth,
        numberingMode: billingForm.numberingMode,
      });

      if (profileRes.cloudSynced && billingRes.cloudSynced) {
        setToastMessage('Settings saved locally & synchronized to Supabase PostgreSQL cloud!');
      } else {
        setToastMessage('Settings saved successfully!');
      }
    } catch (err: any) {
      setToastMessage(`Saved locally (${err?.message || 'Offline mode'}).`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Pull fresh settings from Supabase Cloud Database
  const handlePullCloud = async () => {
    setIsPulling(true);
    try {
      const pRes = await pullOrgProfileFromCloud();
      const bRes = await pullBillingSettingsFromCloud();
      if (pRes.success || bRes.success) {
        setToastMessage('Refreshed latest settings from Supabase cloud database!');
      } else {
        setToastMessage('Supabase cloud: No remote changes found or already up to date.');
      }
    } catch (err: any) {
      setToastMessage(`Pull notice: ${err?.message || 'Offline'}`);
    } finally {
      setIsPulling(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Add Warehouse or Vehicle directly to database
  const handleAddWarehouseOrVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWhName.trim()) return;

    if (newWhType === 'warehouse') {
      const code = 'WH-' + newWhName.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
      addWarehouse({
        name: newWhName.trim(),
        code,
        location: profileForm.city || 'Main Depot',
        manager: profileForm.ownerName || 'Depot Manager',
        phone: profileForm.phone || '',
        isDefault: warehouses.length === 0,
      });
      setToastMessage(`Warehouse "${newWhName.trim()}" created in database.`);
    } else {
      // Vehicle: add vehicle to the fleet
      const vehicleLabel = newWhRegNo ? `${newWhName.trim()} (${newWhRegNo.trim().toUpperCase()})` : newWhName.trim();
      addWarehouse({
        name: vehicleLabel,
        code: 'VEH-' + Math.floor(Math.random() * 900 + 100),
        location: 'Mobile Delivery Van',
        manager: mobileFleetDriver || 'Driver',
        phone: '',
        isDefault: false,
        notes: `Vehicle Registration: ${newWhRegNo.trim().toUpperCase()}`,
      });
      setToastMessage(`Vehicle "${vehicleLabel}" added to distribution fleet.`);
    }

    setNewWhName('');
    setNewWhRegNo('');
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Add Staff Member directly to database
  const handleAddStaffMember = async (e: React.FormEvent): Promise<boolean> => {
    e.preventDefault();
    if (!newStaffIdentifier.trim()) return false;

    const identifier = newStaffIdentifier.trim();
    const isEmail = identifier.includes('@');
    const name = isEmail ? identifier.split('@')[0] : identifier;
    const phone = isEmail ? '9' + Math.floor(100000000 + Math.random() * 900000000) : identifier;

    // A real PIN is required: the old form silently gave everyone 1234.
    if (!/^\d{4,6}$/.test(newStaffPin)) {
      setToastMessage('Enter a 4 to 6 digit PIN for this staff member (6 digits is safer).');
      setTimeout(() => setToastMessage(null), 3500);
      return false;
    }

    const res = await addSalesman(
      {
        name,
        phone,
        active: true,
        defaultVehicle: existingVehicles[0] || 'Van 1',
      },
      newStaffPin
    );

    if (res.success) {
      setToastMessage(`${name} added. They sign in on the salesman login with phone ${phone} and the PIN you set.`);
      setNewStaffIdentifier('');
      setNewStaffPin('');
      setTimeout(() => setToastMessage(null), 3500);
      return true;
    } else {
      setToastMessage(res.error || 'Failed to add staff member.');
      setTimeout(() => setToastMessage(null), 3500);
      return false;
    }
  };

  // Open Edit Staff Modal
  const handleOpenEditStaff = (staff: Salesman) => {
    setEditingStaff(staff);
    setEditStaffName(staff.name || '');
    setEditStaffPhone(staff.phone || '');
    setEditStaffVehicle(staff.defaultVehicle || staff.default_vehicle || '');
    setEditStaffSeriesCode(
      billingSettings.salesmanSeriesCodes?.[staff.id] || staff.seriesCode || '',
    );
    setEditStaffActive(staff.active !== false);
    setEditStaffNewPin('');
    setEditStaffError(null);
  };

  // Save Edit Staff Details
  const handleSaveEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    if (!editStaffName.trim()) {
      setEditStaffError('Staff name is required.');
      return;
    }
    if (!editStaffPhone.trim()) {
      setEditStaffError('Phone number / login identifier is required.');
      return;
    }
    if (editStaffNewPin.trim() && !/^\d{4,6}$/.test(editStaffNewPin.trim())) {
      setEditStaffError('PIN must be 4 to 6 numeric digits.');
      return;
    }

    setIsStaffSubmitting(true);
    setEditStaffError(null);
    try {
      const cleanSeriesCode = editStaffSeriesCode
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 3);
      const res = await updateSalesman(
        editingStaff.id,
        {
          name: editStaffName.trim(),
          phone: editStaffPhone.trim(),
          defaultVehicle: editStaffVehicle.trim(),
          seriesCode: cleanSeriesCode || undefined,
          active: editStaffActive,
        },
        editStaffNewPin.trim() ? editStaffNewPin.trim() : undefined
      );

      if (res.success) {
        const nextCodes = { ...(billingSettings.salesmanSeriesCodes || {}) };
        if (cleanSeriesCode) nextCodes[editingStaff.id] = cleanSeriesCode;
        else delete nextCodes[editingStaff.id];
        await updateBillingSettings({ salesmanSeriesCodes: nextCodes });
        setToastMessage(`Staff details updated for ${editStaffName.trim()}.`);
        setEditingStaff(null);
      } else {
        setEditStaffError(res.error || 'Failed to update staff member.');
      }
    } catch (err: any) {
      setEditStaffError(err?.message || 'Error updating staff details.');
    } finally {
      setIsStaffSubmitting(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Open Dedicated Set PIN Modal
  const handleOpenSetPin = (staff: Salesman) => {
    setPinModalStaff(staff);
    setTargetPin('');
    setPinModalError(null);
  };

  // Save New Security PIN
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModalStaff) return;
    const cleanPin = targetPin.trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      setPinModalError('PIN must be 4 to 6 numeric digits.');
      return;
    }

    setIsPinSubmitting(true);
    setPinModalError(null);
    try {
      const res = await updateSalesman(pinModalStaff.id, {}, cleanPin);
      if (res.success) {
        setToastMessage(`PIN updated successfully for ${pinModalStaff.name}.`);
        setPinModalStaff(null);
      } else {
        setPinModalError(res.error || 'Could not update PIN.');
      }
    } catch (err: any) {
      setPinModalError(err?.message || 'Error updating PIN.');
    } finally {
      setIsPinSubmitting(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Confirm delete staff
  const handleConfirmDeleteStaff = async () => {
    if (!deletingStaff) return;
    try {
      await deleteSalesman(deletingStaff.id);
      setToastMessage(`${deletingStaff.name} removed from staff.`);
    } catch (err: any) {
      setToastMessage(err?.message || 'Failed to remove staff.');
    } finally {
      setDeletingStaff(null);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Restore backup file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importBackup(content);
      if (res.success) {
        setToastMessage('Backup restored successfully! Refreshing...');
        setTimeout(() => window.location.reload(), 900);
      } else {
        setToastMessage(res.error || 'Failed to import backup file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (isPhone) {
    const ownerLabel =
      (currentUser && 'name' in currentUser && currentUser.name) ||
      currentUser?.username ||
      profileForm.ownerName ||
      'Owner';
    const ownerSub =
      (currentUser && 'email' in currentUser ? currentUser.email : '') ||
      (currentUser && 'phone' in currentUser ? currentUser.phone : '') ||
      profileForm.email ||
      profileForm.phone ||
      '';
    const ownerInitial = (orgProfile?.name || ownerLabel || 'H').charAt(0).toUpperCase();
    const isOwnerAdmin = currentUser?.role === 'admin';

    const paperChoice: '80mm' | 'a5' | 'a4' =
      billingForm.defaultInvoicePaper === '80mm' || billingForm.printLayout === 'Thermal 3-inch (80mm)'
        ? '80mm'
        : billingForm.printLayout === 'Half Page A5'
          ? 'a5'
          : 'a4';

    if (mobileSection === 'beats' && isOwnerAdmin) {
      return <BeatsSettings onBack={() => setMobileSection(null)} />;
    }

    if (mobileSection === 'business') {
      return (
        <SettingsBusinessMobile
          setMobileSection={setMobileSection}
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          orgProfile={orgProfile}
          isSaving={isSaving}
          toastMessage={toastMessage}
          handleSaveAll={handleSaveAll}
        />
      );
    }

    if (mobileSection === 'billing') {
      return (
        <SettingsBillingMobile
          setMobileSection={setMobileSection}
          billingForm={billingForm}
          setBillingForm={setBillingForm}
          paperChoice={paperChoice}
          showMoreBilling={showMoreBilling}
          setShowMoreBilling={setShowMoreBilling}
          isSaving={isSaving}
          toastMessage={toastMessage}
          handleSaveAll={handleSaveAll}
        />
      );
    }

    if (mobileSection === 'fleet') {
      return (
        <SettingsFleetMobile
          setMobileSection={setMobileSection}
          showMobileAddFleet={showMobileAddFleet}
          setShowMobileAddFleet={setShowMobileAddFleet}
          mobileFleetDriver={mobileFleetDriver}
          setMobileFleetDriver={setMobileFleetDriver}
          newWhType={newWhType}
          setNewWhType={setNewWhType}
          newWhName={newWhName}
          setNewWhName={setNewWhName}
          newWhRegNo={newWhRegNo}
          setNewWhRegNo={setNewWhRegNo}
          handleAddWarehouseOrVehicle={handleAddWarehouseOrVehicle}
          warehouses={warehouses}
          existingVehicles={existingVehicles}
          salesmen={salesmen}
          deleteWarehouse={deleteWarehouse}
          setTab={setTab}
          isSaving={isSaving}
          toastMessage={toastMessage}
          setToastMessage={setToastMessage}
        />
      );
    }

    if (mobileSection === 'staff') {
      return (
        <SettingsStaffMobile
          setMobileSection={setMobileSection}
          salesmen={salesmen}
          salesmanSeriesCodes={billingSettings.salesmanSeriesCodes}
          ownerLabel={ownerLabel}
          ownerSub={ownerSub}
          logout={logout}
          existingVehicles={existingVehicles}
          showMobileAddStaff={showMobileAddStaff}
          setShowMobileAddStaff={setShowMobileAddStaff}
          mobileStaffRole={mobileStaffRole}
          setMobileStaffRole={setMobileStaffRole}
          newStaffIdentifier={newStaffIdentifier}
          setNewStaffIdentifier={setNewStaffIdentifier}
          newStaffPin={newStaffPin}
          setNewStaffPin={setNewStaffPin}
          newStaffRole={newStaffRole}
          setNewStaffRole={setNewStaffRole}
          handleAddStaffMember={handleAddStaffMember}
          editingStaff={editingStaff}
          setEditingStaff={setEditingStaff}
          editStaffName={editStaffName}
          setEditStaffName={setEditStaffName}
          editStaffPhone={editStaffPhone}
          setEditStaffPhone={setEditStaffPhone}
          editStaffVehicle={editStaffVehicle}
          setEditStaffVehicle={setEditStaffVehicle}
          editStaffSeriesCode={editStaffSeriesCode}
          setEditStaffSeriesCode={setEditStaffSeriesCode}
          editStaffNewPin={editStaffNewPin}
          setEditStaffNewPin={setEditStaffNewPin}
          editStaffActive={editStaffActive}
          setEditStaffActive={setEditStaffActive}
          editStaffError={editStaffError}
          isStaffSubmitting={isStaffSubmitting}
          handleOpenEditStaff={handleOpenEditStaff}
          handleSaveEditStaff={handleSaveEditStaff}
          pinModalStaff={pinModalStaff}
          setPinModalStaff={setPinModalStaff}
          targetPin={targetPin}
          setTargetPin={setTargetPin}
          pinModalError={pinModalError}
          isPinSubmitting={isPinSubmitting}
          handleOpenSetPin={handleOpenSetPin}
          handleSavePin={handleSavePin}
          deletingStaff={deletingStaff}
          setDeletingStaff={setDeletingStaff}
          handleConfirmDeleteStaff={handleConfirmDeleteStaff}
          isSaving={isSaving}
          toastMessage={toastMessage}
        />
      );
    }

    if (mobileSection === 'display') {
      return (
        <SettingsDisplayMobile
          setMobileSection={setMobileSection}
          t={t}
          fontSize={fontSize}
          setFontSize={setFontSize}
          avatarId={avatarId}
          ownerInitial={ownerInitial}
          showAvatarSheet={showAvatarSheet}
          setShowAvatarSheet={setShowAvatarSheet}
          prefLang={prefLang}
          setPrefLang={setPrefLang}
          setLanguage={setLanguage}
          highContrast={highContrast}
          setHighContrast={setHighContrast}
          lowVisionMode={lowVisionMode}
          toggleLowVisionMode={toggleLowVisionMode}
          isSaving={isSaving}
          toastMessage={toastMessage}
          setToastMessage={setToastMessage}
        />
      );
    }

    if (mobileSection === 'cloud') {
      return (
        <SettingsCloudMobile
          setMobileSection={setMobileSection}
          supabaseConfig={supabaseConfig}
          supabaseStatus={supabaseStatus}
          isPulling={isPulling}
          handlePullCloud={handlePullCloud}
          checkSupabaseConnection={checkSupabaseConnection}
          syncToCloud={syncToCloud}
          isSaving={isSaving}
          toastMessage={toastMessage}
          setToastMessage={setToastMessage}
        />
      );
    }

    if (mobileSection === 'backups') {
      return (
        <SettingsBackupsMobile
          setMobileSection={setMobileSection}
          exportBackup={exportBackup}
          fileInputRef={fileInputRef}
          handleFileUpload={handleFileUpload}
          isOwnerAdmin={isOwnerAdmin}
          showResetSheet={showResetSheet}
          setShowResetSheet={setShowResetSheet}
          clearTransactions={clearTransactions}
          resetToDefault={resetToDefault}
          isSaving={isSaving}
          toastMessage={toastMessage}
          setToastMessage={setToastMessage}
          counts={{
            bills: bills.length,
            payments: payments.length,
            trips: trips.length,
            audits: audits.length,
            stockTransfers: stockTransfers.length,
            customers: customers.length,
            products: products.length,
            grns: grns.length,
            warehouses: warehouses.length,
          }}
        />
      );
    }

    return (
      <SettingsHomeMobile
        t={t}
        isOwnerAdmin={isOwnerAdmin}
        ownerInitial={ownerInitial}
        ownerLabel={ownerLabel}
        ownerSub={ownerSub}
        setMobileSection={setMobileSection}
        onOpenActivityLog={() => setTab('activityLog')}
        isSaving={isSaving}
        toastMessage={toastMessage}
      />
    );
  }

  return (
    <div id="view-settings" className="hh-view w-full min-w-0 text-neutral-900 font-sans">
      <div className="w-full space-y-3 sm:space-y-5">
        {/* Page Header */}
        <div className="hh-pagehead flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1>Settings</h1>
            <p className="hidden sm:block">Business, GST, billing rules, staff</p>
          </div>
          <button
            type="button"
            onClick={() => setTab('activityLog')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-200 bg-white text-xs font-bold text-neutral-800 hover:bg-neutral-50 cursor-pointer shadow-2xs shrink-0"
          >
            <History className="w-3.5 h-3.5 text-[var(--primary)]" aria-hidden="true" />
            <span>View Global Activity Log</span>
          </button>
        </div>

        {/* Success Toast */}
        {toastMessage && (
          <div className="fixed top-6 right-6 z-50 bg-[var(--primary)] text-white px-4 py-2.5 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <Check className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Segmented Filter Tabs */}
        <div className="hh-tabstrip flex items-center gap-1.5 overflow-x-auto pb-1 text-xs -mx-2.5 px-2.5 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { id: 'business' as const, label: t('settings.section.business') },
            { id: 'billing' as const, label: t('settings.section.billing') },
            { id: 'fleet' as const, label: t('settings.section.fleet') },
            ...(currentUser?.role === 'admin' ? [{ id: 'beats' as const, label: t('settings.section.beats') }] : []),
            { id: 'staff' as const, label: t('settings.section.staff') },
            { id: 'display' as const, label: t('settings.section.display') },
            { id: 'cloud' as const, label: t('settings.section.cloud') },
            { id: 'backups' as const, label: t('settings.section.backups') },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeSection === tab.id
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-white border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ========================================================================= */}
        {/* CARD 1: BUSINESS (ORGANISATION PROFILE)                                  */}
        {/* ========================================================================= */}
        {activeSection === 'business' && (
          <SettingsBusinessDesktop profileForm={profileForm} setProfileForm={setProfileForm} />
        )}

        {/* ========================================================================= */}
        {/* CARD 2: BILLING RULES & INVOICING PREFERENCES                            */}
        {/* ========================================================================= */}
        {activeSection === 'billing' && (
          <SettingsBillingDesktop billingForm={billingForm} setBillingForm={setBillingForm} />
        )}

        {/* ========================================================================= */}
        {/* SAVE SETTINGS ACTION BUTTON                  */}
        {/* ========================================================================= */}
        <div>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveAll}
            className="w-full bg-[var(--primary)] hover:bg-[var(--primary)] text-white font-semibold py-3 px-6 rounded-xl transition-all cursor-pointer text-sm shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <span>Saving settings to database...</span> : <span>Save settings</span>}
          </button>
        </div>

        {/* ========================================================================= */}
        {/* CARD 3: WAREHOUSES & VEHICLES (DATABASE BACKED)                          */}
        {/* ========================================================================= */}
        {activeSection === 'fleet' && (
          <SettingsFleetDesktop
            warehouses={warehouses}
            existingVehicles={existingVehicles}
            deleteWarehouse={deleteWarehouse}
            setToastMessage={setToastMessage}
            newWhName={newWhName}
            setNewWhName={setNewWhName}
            newWhType={newWhType}
            setNewWhType={setNewWhType}
            newWhRegNo={newWhRegNo}
            setNewWhRegNo={setNewWhRegNo}
            handleAddWarehouseOrVehicle={handleAddWarehouseOrVehicle}
          />
        )}

        {/* ========================================================================= */}
        {/* CARD 4: STAFF & ROLES (DATABASE BACKED)                                  */}
        {/* ========================================================================= */}
        {activeSection === 'beats' && <BeatsSettings />}

        {activeSection === 'staff' && (
          <SettingsStaffDesktop
            salesmen={salesmen}
            salesmanSeriesCodes={billingSettings.salesmanSeriesCodes}
            currentUser={currentUser}
            profileForm={profileForm}
            logout={logout}
            toggleSalesmanActive={toggleSalesmanActive}
            handleOpenEditStaff={handleOpenEditStaff}
            handleOpenSetPin={handleOpenSetPin}
            setDeletingStaff={setDeletingStaff}
            newStaffIdentifier={newStaffIdentifier}
            setNewStaffIdentifier={setNewStaffIdentifier}
            newStaffPin={newStaffPin}
            setNewStaffPin={setNewStaffPin}
            newStaffRole={newStaffRole}
            setNewStaffRole={setNewStaffRole}
            handleAddStaffMember={handleAddStaffMember}
          />
        )}

        {/* ========================================================================= */}
        {/* CARD 5: DISPLAY & ACCESSIBILITY                                          */}
        {/* ========================================================================= */}
        {activeSection === 'display' && (
          <SettingsDisplayDesktop
            t={t}
            fontSize={fontSize}
            setFontSize={setFontSize}
            avatarId={avatarId}
            orgName={orgProfile?.name}
            highContrast={highContrast}
            setHighContrast={setHighContrast}
            lowVisionMode={lowVisionMode}
            toggleLowVisionMode={toggleLowVisionMode}
          />
        )}

        {/* ========================================================================= */}
        {/* CARD 6: DATABASE & SUPABASE CLOUD SYNC                                   */}
        {/* ========================================================================= */}
        {activeSection === 'cloud' && (
          <SettingsCloudDesktop
            supabaseConfig={supabaseConfig}
            supabaseStatus={supabaseStatus}
            syncToCloud={syncToCloud}
            checkSupabaseConnection={checkSupabaseConnection}
            setToastMessage={setToastMessage}
          />
        )}

        {/* ========================================================================= */}
        {/* CARD 7: DATA & BACKUPS (SAFETY & RECOVERY)                                */}
        {/* ========================================================================= */}
        {activeSection === 'backups' && (
          <SettingsBackupsDesktop
            currentUserRole={currentUser?.role}
            exportBackup={exportBackup}
            fileInputRef={fileInputRef}
            handleFileUpload={handleFileUpload}
            clearTransactions={clearTransactions}
            resetToDefault={resetToDefault}
            setToastMessage={setToastMessage}
            counts={{
              bills: bills.length,
              payments: payments.length,
              trips: trips.length,
              audits: audits.length,
              stockTransfers: stockTransfers.length,
              customers: customers.length,
              products: products.length,
              grns: grns.length,
              warehouses: warehouses.length,
            }}
          />
        )}
      </div>

      <SettingsStaffModals
        editingStaff={editingStaff}
        setEditingStaff={setEditingStaff}
        editStaffName={editStaffName}
        setEditStaffName={setEditStaffName}
        editStaffPhone={editStaffPhone}
        setEditStaffPhone={setEditStaffPhone}
        editStaffVehicle={editStaffVehicle}
        setEditStaffVehicle={setEditStaffVehicle}
        editStaffSeriesCode={editStaffSeriesCode}
        setEditStaffSeriesCode={setEditStaffSeriesCode}
        editStaffNewPin={editStaffNewPin}
        setEditStaffNewPin={setEditStaffNewPin}
        editStaffActive={editStaffActive}
        setEditStaffActive={setEditStaffActive}
        editStaffError={editStaffError}
        isStaffSubmitting={isStaffSubmitting}
        handleSaveEditStaff={handleSaveEditStaff}
        pinModalStaff={pinModalStaff}
        setPinModalStaff={setPinModalStaff}
        targetPin={targetPin}
        setTargetPin={setTargetPin}
        pinModalError={pinModalError}
        isPinSubmitting={isPinSubmitting}
        handleSavePin={handleSavePin}
        deletingStaff={deletingStaff}
        setDeletingStaff={setDeletingStaff}
        handleConfirmDeleteStaff={handleConfirmDeleteStaff}
      />
    </div>
  );
};
