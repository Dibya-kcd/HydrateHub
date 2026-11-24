import { Bill, Customer, ExistingCustomer, PaymentRecord } from "../types";
import { billPaymentGaps, sumCustomerRecordedPaid } from "../utils/paymentAllocation";
import { billNetTotal, billReturnCredit } from "../utils/salesReturns";
import { isPaymentFromDeletedCustomerId } from "../utils/ghostPayments";
import { normCustName, readCustomerTombstones } from "./ledgerHelpers";

import { isDummyPhone, realLast10Phone } from "../utils/customerDedupe";

export { isDummyPhone };

export function last10Of(phone?: string): string {
  return realLast10Phone(phone);
}

export function customerPhonesMatch(
  custPhones: (string | undefined)[],
  targetPhone?: string,
  isUniqueCustomerName: boolean = true,
): boolean {
  const targetLast10 = last10Of(targetPhone);
  // If target has no phone recorded on the invoice/receipt (or is dummy 1234567890), name match is accepted
  if (!targetLast10) return true;

  const validCustLast10s = custPhones
    .map((p) => last10Of(p))
    .filter((p): p is string => Boolean(p));

  // If customer has no non-dummy phones registered in profile, name match is accepted
  if (validCustLast10s.length === 0) return true;

  // If target phone matches any of the customer's phone numbers (primary or alternate)
  if (validCustLast10s.includes(targetLast10)) return true;

  // If this customer's name is unique in the customer directory,
  // match even if a secondary or employee contact number was typed during billing
  if (isUniqueCustomerName) return true;

  return false;
}

export function computeExistingCustomers(params: {
  customers: Customer[];
  bills: Bill[];
  payments: PaymentRecord[];
  hiddenCustNames: Set<string>;
}): ExistingCustomer[] {
  const { customers, bills, payments, hiddenCustNames } = params;
  const map = new Map<string, ExistingCustomer>();

  // 1. Initialize from registered Customer master (preferring beat-mapped / real master records over legacy bill ghosts)
  const masterByKey = new Map<string, Customer>();
  customers.forEach((c) => {
    const key = normCustName(c.name);
    if (!key) return;
    const existing = map.get(key);
    const cleanPhone = isDummyPhone(c.phone) ? "" : c.phone;
    const cleanAltPhone = isDummyPhone(c.altPhone) ? "" : c.altPhone;

    if (!existing) {
      masterByKey.set(key, c);
      map.set(key, {
        id: c.id,
        name: c.name,
        phone: cleanPhone,
        altPhone: cleanAltPhone,
        address: c.address,
        city: c.city,
        gstin: c.gstin,
        creditLimit: c.creditLimit,
        openingBalance: c.openingBalance || 0,
        totalBills: 0,
        totalBilled: 0,
        totalPaid: 0,
        balanceDue: c.openingBalance || 0,
        lastBillDate: "",
        lastPaymentDate: "",
      });
    } else {
      const prevMaster = masterByKey.get(key);
      const prevHasBeat = Boolean((prevMaster?.beatId && prevMaster.beatId.trim()) || (prevMaster?.route && prevMaster.route.trim()));
      const curHasBeat = Boolean((c.beatId && c.beatId.trim()) || (c.route && c.route.trim()));
      const prevIsBillGhost = String(prevMaster?.id || "").startsWith("cust_bill_");
      const curIsBillGhost = String(c.id || "").startsWith("cust_bill_");
      if ((!prevHasBeat && curHasBeat) || (prevIsBillGhost && !curIsBillGhost && (curHasBeat || !prevHasBeat))) {
        masterByKey.set(key, c);
        existing.id = c.id;
      }
      if ((!existing.phone || isDummyPhone(existing.phone)) && cleanPhone) {
        existing.phone = cleanPhone;
      }
      if ((!existing.altPhone || isDummyPhone(existing.altPhone)) && cleanAltPhone) {
        existing.altPhone = cleanAltPhone;
      }
      if ((!existing.creditLimit || existing.creditLimit === 0) && c.creditLimit) {
        existing.creditLimit = c.creditLimit;
      }
      if (!existing.address && c.address) existing.address = c.address;
      if (!existing.city && c.city) existing.city = c.city;
      if (!existing.gstin && c.gstin) existing.gstin = c.gstin;
    }
  });

  // Map alternate / historical shop names (aliases) to the unified master customer key
  const aliasToKeyMap = new Map<string, string>();
  customers.forEach((c) => {
    const primaryKey = normCustName(c.name);
    if (!primaryKey) return;
    (c.aliases || []).forEach((a) => {
      const aKey = normCustName(a);
      if (aKey) aliasToKeyMap.set(aKey, primaryKey);
    });
  });

  // 2. Aggregate active non-cancelled bills
  bills.forEach((b) => {
    if (b.status === "cancelled" || b.cancelled) return;
    const name = b.retailer?.trim();
    if (!name) return;
    const rawKey = normCustName(name);
    const key = aliasToKeyMap.get(rawKey) || rawKey;
    // Deleted by the owner: keep the bill, but do not list the customer again.
    if (hiddenCustNames.has(key) && !map.has(key)) return;
    let record = map.get(key);
    const cleanBPhone = isDummyPhone(b.phone) ? "" : b.phone || "";
    if (!record) {
      record = {
        name,
        phone: cleanBPhone,
        totalBills: 0,
        totalBilled: 0,
        totalPaid: 0,
        balanceDue: 0,
        openingBalance: 0,
        lastBillDate: "",
        lastPaymentDate: "",
      };
      map.set(key, record);
    }

    record.totalBills += 1;
    const netBilled = billNetTotal(b);
    record.totalBilled += netBilled;

    if (!record.lastBillDate || b.date > record.lastBillDate) {
      record.lastBillDate = b.date;
    }
    if (cleanBPhone && (!record.phone || isDummyPhone(record.phone))) {
      record.phone = cleanBPhone;
    }
  });

  // 3. Aggregate payments cleanly without double-counting
  const deletedCustIds = readCustomerTombstones();
  const activeCustIds = new Set(customers.map((c) => c.id));

  map.forEach((record, key) => {
    const matchMasterList = customers.filter(
      (c) => normCustName(c.name) === key || (record.id && c.id === record.id),
    );
    const matchMaster = matchMasterList[0];
    const matchAliases = (matchMaster?.aliases || []).map(normCustName);
    const matchesKeyOrAlias = (n?: string) => {
      const kn = normCustName(n);
      return kn === key || matchAliases.includes(kn);
    };
    const distinctPhones = new Set(
      matchMasterList
        .map((c) => last10Of(c.phone))
        .filter(Boolean),
    );
    const isUniqueName = distinctPhones.size <= 1;
    const custPhones = [
      record.phone,
      record.altPhone,
      ...matchMasterList.map((c) => c.phone),
      ...matchMasterList.map((c) => c.altPhone),
    ].filter((p) => !isDummyPhone(p));

    const custBills = bills.filter((b) => {
      if (b.status === "cancelled" || b.cancelled) return false;
      return matchesKeyOrAlias(b.retailer) && customerPhonesMatch(custPhones, b.phone, isUniqueName);
    });

    const custBillIds = new Set(custBills.map((b) => b.id));

    const custPayments = payments.filter((p) => {
      if (isPaymentFromDeletedCustomerId(p, deletedCustIds, activeCustIds, custBillIds)) {
        return false;
      }
      if (p.billId && custBillIds.has(p.billId)) return true;
      const pCust = normCustName(p.customerName);
      return (
        !!pCust &&
        matchesKeyOrAlias(p.customerName) &&
        customerPhonesMatch(custPhones, p.customerPhone, isUniqueName)
      );
    });

    const totalRecordedPaid = sumCustomerRecordedPaid(custPayments);
    const missingUpfront = billPaymentGaps(custBills, custPayments).reduce(
      (t, g) => t + g.shortfall,
      0,
    );

    record.totalPaid = totalRecordedPaid + missingUpfront;

    custPayments.forEach((p) => {
      const pDate = p.paymentDate || p.createdAt?.slice(0, 10);
      if (pDate && (!record.lastPaymentDate || pDate > record.lastPaymentDate)) {
        record.lastPaymentDate = pDate;
      }
    });

    const openingBal = matchMaster?.openingBalance || record.openingBalance || 0;
    record.openingBalance = openingBal;
    const rawBal = Math.round((openingBal + record.totalBilled - record.totalPaid) * 100) / 100;
    record.balanceDue = Math.max(0, rawBal);
    record.advance = Math.max(0, -rawBal);
  });

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function resolveMasterCustomerIdInList(
  customers: Customer[],
  name?: string,
  phone?: string,
): string | undefined {
  const n = normCustName(name);
  if (!n) return undefined;
  const sameName = customers.filter((c) => normCustName(c.name) === n);
  const ph = last10Of(phone || "");
  if (sameName.length === 1) return sameName[0].id;
  if (sameName.length > 1 && ph.length === 10) {
    const byPhone = sameName.filter((c) => last10Of(c.phone) === ph || last10Of(c.altPhone || "") === ph);
    if (byPhone.length >= 1) return byPhone[0].id;
  }
  if (sameName.length > 1 && ph.length === 0) {
    const distinctPhones = new Set(sameName.map((c) => last10Of(c.phone)).filter(Boolean));
    if (distinctPhones.size <= 1) {
      return sameName[0].id;
    }
  }
  if (sameName.length === 0 && ph.length === 10) {
    const byPhone = customers.filter((c) => last10Of(c.phone) === ph);
    return byPhone.length >= 1 ? byPhone[0].id : undefined;
  }
  return undefined;
}

export function computeCustomerLedger(params: {
  customerNameOrId: string;
  customerPhone?: string;
  customerAltPhone?: string;
  customers: Customer[];
  existingCustomers: ExistingCustomer[];
  bills: Bill[];
  payments: PaymentRecord[];
}) {
  const {
    customerNameOrId,
    customerPhone,
    customerAltPhone,
    customers,
    existingCustomers,
    bills,
    payments,
  } = params;

  const trimmedInput = (customerNameOrId || "").trim();
  const cleanLower = normCustName(trimmedInput);

  // 1. Resolve customer profile from customers master, existingCustomers, or bills
  const custInMaster =
    customers.find((c) => c.id === trimmedInput) ||
    (() => {
      const byName = customers.filter(
        (c) => normCustName(c.name) === cleanLower || (c.aliases || []).some((a) => normCustName(a) === cleanLower),
      );
      if (byName.length === 1) return byName[0];
      const id = byName.length > 1 ? resolveMasterCustomerIdInList(customers, trimmedInput, customerPhone) : undefined;
      return id ? customers.find((c) => c.id === id) : undefined;
    })();
  const existing = existingCustomers.find(
    (ec) =>
      (ec.id && ec.id === trimmedInput) ||
      normCustName(ec.name) === cleanLower,
  );
  const anyMatchingBill = bills.find(
    (b) =>
      b.status !== "cancelled" &&
      !b.cancelled &&
      normCustName(b.retailer) === cleanLower,
  );

  const resolvedName =
    custInMaster?.name ||
    existing?.name ||
    anyMatchingBill?.retailer ||
    trimmedInput;
  const cleanName = normCustName(resolvedName);

  // A registered customer with no phone is matched by name only (never borrow a number from a bill).
  const resolvedPhone = custInMaster
    ? custInMaster.phone || ""
    : existing?.phone || customerPhone || anyMatchingBill?.phone || "";
  const resolvedAltPhone =
    custInMaster?.altPhone || existing?.altPhone || customerAltPhone || "";

  const resolvedCustomer: Customer = custInMaster || {
    id:
      existing?.id ||
      `cust_${cleanName.replace(/[^a-z0-9]/gi, "_") || Date.now()}`,
    name: resolvedName,
    phone: resolvedPhone,
    altPhone: resolvedAltPhone,
    address: existing?.address,
    city: existing?.city,
    gstin: existing?.gstin,
    creditLimit: existing?.creditLimit || 0,
    openingBalance: existing?.openingBalance || 0,
    createdAt:
      existing?.lastBillDate ||
      anyMatchingBill?.date ||
      new Date().toISOString(),
  };

  const sameNameCusts = customers.filter(
    (c) => normCustName(c.name) === cleanName,
  );
  const distinctPhones = new Set(
    sameNameCusts
      .map((c) => last10Of(c.phone))
      .filter(Boolean),
  );
  const isUniqueCustomerName = distinctPhones.size <= 1;

  const ownPhones = custInMaster
    ? [custInMaster.phone, custInMaster.altPhone].map((p) => last10Of(p)).filter(Boolean)
    : [];
  const keepSeparate = !!custInMaster && !isUniqueCustomerName && ownPhones.length > 0;
  const relatedSame = keepSeparate
    ? sameNameCusts.filter((c) => {
        if (c.id === custInMaster!.id) return true;
        const cp = [c.phone, c.altPhone].map((p) => last10Of(p)).filter(Boolean);
        return cp.length === 0 || cp.some((p) => ownPhones.includes(p));
      })
    : sameNameCusts;

  const allCustPhones = [
    resolvedPhone,
    resolvedAltPhone,
    ...relatedSame.map((c) => c.phone),
    ...relatedSame.map((c) => c.altPhone),
    ...(keepSeparate ? [] : [existing?.phone, existing?.altPhone]),
    customerPhone,
    customerAltPhone,
  ].filter((p) => !isDummyPhone(p));

  const customerById = new Map<string, Customer>(customers.map((c) => [c.id, c]));
  const matchingCustIds = new Set<string>();
  if (custInMaster?.id) matchingCustIds.add(custInMaster.id);
  for (const c of relatedSame) {
    if (
      keepSeparate ||
      isUniqueCustomerName ||
      customerPhonesMatch(allCustPhones, c.phone, isUniqueCustomerName)
    ) {
      matchingCustIds.add(c.id);
    }
  }

  // 2. Match non-cancelled bills
  const matchedBills = bills
    .filter((b) => {
      if (b.status === "cancelled" || b.cancelled) return false;
      if (b.customerId && matchingCustIds.has(b.customerId)) {
        return true;
      }
      if (keepSeparate && b.customerId && customerById.has(b.customerId)) return false;
      if (b.customerId && customerById.has(b.customerId)) {
        const otherCust = customerById.get(b.customerId)!;
        if (
          normCustName(otherCust.name) !== cleanName &&
          !customerPhonesMatch(allCustPhones, otherCust.phone, false)
        ) {
          return false;
        }
      }
      const bRetailer = normCustName(b.retailer);
      const nameMatches =
        bRetailer === cleanName ||
        (custInMaster?.aliases || []).some((a) => normCustName(a) === bRetailer);
      return (
        nameMatches &&
        customerPhonesMatch(allCustPhones, b.phone, isUniqueCustomerName)
      );
    })
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  const matchedBillIds = new Set(matchedBills.map((b) => b.id));

  // 3. Match payments
  const deletedCustIdsForLedger = readCustomerTombstones();
  const activeCustIdsForLedger = new Set(customers.map((c) => c.id));
  const matchedPayments = payments
    .filter((p) => {
      if (p.billId && matchedBillIds.has(p.billId)) return true;
      if (isPaymentFromDeletedCustomerId(p, deletedCustIdsForLedger, activeCustIdsForLedger, matchedBillIds)) {
        return false;
      }
      if (p.customerId && matchingCustIds.has(p.customerId)) {
        return true;
      }
      if (keepSeparate && p.customerId && customerById.has(p.customerId)) return false;
      if (p.customerId && customerById.has(p.customerId)) {
        const otherCust = customerById.get(p.customerId)!;
        if (
          normCustName(otherCust.name) !== cleanName &&
          !customerPhonesMatch(allCustPhones, otherCust.phone, false)
        ) {
          return false;
        }
      }
      const pCust = normCustName(p.customerName);
      const nameMatches =
        pCust === cleanName ||
        (custInMaster?.aliases || []).some((a) => normCustName(a) === pCust);
      return (
        !!pCust &&
        nameMatches &&
        customerPhonesMatch(allCustPhones, p.customerPhone, isUniqueCustomerName)
      );
    })
    .sort((a, b) => ((a.paymentDate || "") > (b.paymentDate || "") ? 1 : -1));

  // 4. Show an invoice's "paid" that has no payment row behind it
  const allPayments = [...matchedPayments];
  for (const gap of billPaymentGaps(matchedBills, matchedPayments)) {
    const b = matchedBills.find((x) => x.id === gap.billId);
    if (!b) continue;
    allPayments.push({
      id: `legacy_pay_${b.id}`,
      billId: b.id,
      customerName: b.retailer,
      customerPhone: b.phone,
      paymentDate: b.paymentDate || b.date,
      amount: gap.shortfall,
      mode: b.paymentMode || "cash",
      referenceNote: b.paymentNote || `Upfront payment on bill #${b.id}`,
      createdAt: b.date,
    });
  }

  allPayments.sort((a, b) =>
    (a.paymentDate || "") > (b.paymentDate || "") ? 1 : -1,
  );

  // 5. Totals
  const totalBilled = matchedBills.reduce(
    (sum, b) => sum + (Number(b.total) || 0),
    0,
  );
  const totalReturns = matchedBills.reduce(
    (sum, b) => sum + billReturnCredit(b),
    0,
  );
  const netBilled = Math.max(0, totalBilled - totalReturns);
  const totalPaid = sumCustomerRecordedPaid(allPayments);
  const openingBal = resolvedCustomer.openingBalance || 0;
  const rawBalance = openingBal + totalBilled - totalReturns - totalPaid;
  const balanceDue = Math.max(0, Math.round(rawBalance * 100) / 100);
  const isOverLimit = !!(
    resolvedCustomer.creditLimit &&
    resolvedCustomer.creditLimit > 0 &&
    balanceDue > resolvedCustomer.creditLimit
  );

  return {
    customer: resolvedCustomer,
    bills: matchedBills,
    payments: allPayments,
    totalBilled,
    totalReturns,
    netBilled,
    totalPaid,
    balanceDue,
    rawBalance: Math.round(rawBalance * 100) / 100,
    openingBalance: openingBal,
    isOverLimit,
  };
}
