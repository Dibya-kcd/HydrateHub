/**
 * Pure server/sync merge rules for invoices (`bills`).
 *
 * Key invariants:
 * 1. Tombstoned (`deleted_bill_ids`) active bills MUST NEVER be resurrected by a stale client's
 *    full-list PUT `/api/bills` sync or outbox replay.
 * 2. Only explicitly cancelled bills (`status === "cancelled"` or `cancellation` set) are preserved
 *    or un-tombstoned for GST invoice series continuity.
 * 3. Two distinct offline bills that happen to pick the same fallback numeric ID (#105 created on
 *    Phone A and #105 created on Phone B while offline) MUST BOTH survive sync: the second copy gets
 *    a fresh unique internal ID, keeps its issued `docNo` for audit, and is flagged with
 *    `duplicateNumberConflict: true` so the owner can assign it a fresh unique GST invoice number.
 */

export const isCancelledBillRecord = (b: any): boolean =>
  b?.status === "cancelled" || Boolean(b?.cancellation);

const normName = (v: any): string =>
  String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const readExtraField = (b: any, key: string): any =>
  b?.[key] !== undefined ? b[key] : b?.extra?.[key];

const fallbackDisplayDocNo = (b: any): string => {
  const explicit = String(b?.docNo || b?.extra?.docNo || "").trim();
  if (explicit) return explicit;
  if (
    b?.docSeries === "non_gst" ||
    b?.extra?.docSeries === "non_gst" ||
    b?.gstExclude === true ||
    b?.extra?.gstExclude === true
  ) {
    return `NG-${b?.id}`;
  }
  const isGst =
    b?.invoiceType === "tax_invoice" ||
    b?.isGstInvoice === true ||
    b?.extra?.invoiceType === "tax_invoice" ||
    b?.extra?.isGstInvoice === true ||
    (b?.supplyType === "B2B" && Boolean(b?.customerGstin));
  return `${isGst ? "INV" : "RET"}-${b?.id}`;
};

/**
 * Returns true if two bill objects with the same numeric `id` represent the same logical invoice
 * (e.g. an edit or sync copy of one bill) rather than two separate offline bills colliding on an ID.
 */
export function areSameBillIdentity(a: any, b: any): boolean {
  if (!a || !b) return true;
  const uidA = String(readExtraField(a, "clientUid") || "").trim();
  const uidB = String(readExtraField(b, "clientUid") || "").trim();
  if (uidA && uidB) return uidA === uidB;

  const devA = String(readExtraField(a, "originDeviceId") || "").trim();
  const devB = String(readExtraField(b, "originDeviceId") || "").trim();
  if (devA && devB && devA !== devB) {
    // Unless edit history proves one is an edit of the same original bill created on the other device
    const edA = Array.isArray(a?.editHistory) ? a.editHistory.length : 0;
    const edB = Array.isArray(b?.editHistory) ? b.editHistory.length : 0;
    if (edA === 0 && edB === 0) return false;
  }

  // Legacy bills without clientUid: check if retailer/date/total look like two completely different invoices
  const retA = normName(a?.retailer);
  const retB = normName(b?.retailer);
  if (retA && retB && retA !== retB) {
    const historyA = JSON.stringify(a?.editHistory || []).toLowerCase();
    const historyB = JSON.stringify(b?.editHistory || []).toLowerCase();
    const customerWasEdited =
      historyA.includes("customer") ||
      historyA.includes("retailer") ||
      historyB.includes("customer") ||
      historyB.includes("retailer");
    if (!customerWasEdited) {
      const dateDiff = String(a?.date || "").slice(0, 10) !== String(b?.date || "").slice(0, 10);
      const totalDiff = Math.abs((Number(a?.total) || 0) - (Number(b?.total) || 0)) > 1;
      if (dateDiff || totalDiff) return false;
    }
  }
  return true;
}

export const incomingBillWins = (cur: any, b: any): boolean => {
  if (!cur) return true;
  const stamp = (x: any) => Date.parse(x?.updatedAt || x?.extra?.updatedAt || "") || 0;
  const curStamp = stamp(cur);
  const newStamp = stamp(b);
  if (curStamp !== newStamp && (curStamp > 0 || newStamp > 0)) {
    return newStamp >= curStamp;
  }
  const curEdits = Array.isArray(cur?.editHistory) ? cur.editHistory.length : 0;
  const newEdits = Array.isArray(b?.editHistory) ? b.editHistory.length : 0;
  if (curEdits > newEdits) return false;
  if (curEdits < newEdits) return true;
  return true;
};

export function collectCancelledRestores(rawBills: any[], deletedIds: Set<number>): number[] {
  const restoredIds: number[] = [];
  for (const b of rawBills || []) {
    const id = Number(b?.id);
    if (Number.isFinite(id) && deletedIds.has(id) && isCancelledBillRecord(b)) {
      deletedIds.delete(id);
      restoredIds.push(id);
    }
  }
  return restoredIds;
}

export interface BillCollisionRemap {
  oldId: number;
  newId: number;
  originalIncoming: any;
  reassignedBill: any;
}

export function mergeBillListsWithConflictResolution(
  stored: any[],
  incoming: any[],
  deletedIds: Set<number>,
): {
  merged: any[];
  accepted: Set<any>;
  remapped: BillCollisionRemap[];
} {
  const accepted = new Set<any>();
  const remapped: BillCollisionRemap[] = [];
  const byId = new Map<number, any>();
  const byClientUid = new Map<string, any>();

  let maxId = 100;
  const bumpMax = (n: number) => {
    if (Number.isFinite(n) && n > maxId) maxId = n;
  };
  deletedIds.forEach(bumpMax);

  const registerBill = (bill: any) => {
    const id = Number(bill?.id);
    if (!Number.isFinite(id)) return;
    bumpMax(id);
    byId.set(id, bill);
    const uid = String(readExtraField(bill, "clientUid") || "").trim();
    if (uid) byClientUid.set(uid, bill);
  };

  for (const b of stored || []) {
    const id = Number(b?.id);
    if (Number.isFinite(id) && (isCancelledBillRecord(b) || !deletedIds.has(id))) {
      registerBill(b);
    }
  }
  for (const b of incoming || []) {
    const id = Number(b?.id);
    if (Number.isFinite(id)) bumpMax(id);
  }

  for (const b of incoming || []) {
    const origId = Number(b?.id);
    if (!Number.isFinite(origId) || (!isCancelledBillRecord(b) && deletedIds.has(origId))) continue;

    // If this incoming copy matches an already-remapped bill by clientUid, update it under that remapped id
    const uid = String(readExtraField(b, "clientUid") || "").trim();
    if (uid && byClientUid.has(uid)) {
      const existingByUid = byClientUid.get(uid);
      if (Number(existingByUid.id) !== origId) {
        const aligned = { ...b, id: Number(existingByUid.id) };
        if (incomingBillWins(existingByUid, aligned)) {
          registerBill(aligned);
          accepted.add(aligned);
        }
        continue;
      }
    }

    const cur = byId.get(origId);
    if (!cur) {
      registerBill(b);
      accepted.add(b);
      continue;
    }

    if (areSameBillIdentity(cur, b)) {
      if (!incomingBillWins(cur, b)) continue;
      registerBill(b);
      accepted.add(b);
      continue;
    }

    // Offline collision: two DIFFERENT invoices claim the same numeric ID!
    // Never overwrite `cur`. Preserve `b` with a new unique numeric ID and flag only if display docNo also matches.
    maxId += 1;
    const newId = maxId;
    const curDocNo = fallbackDisplayDocNo(cur);
    const sharedDocNo = fallbackDisplayDocNo(b);
    const sameDisplayDocNo = normName(curDocNo) === normName(sharedDocNo);
    const conflictNote = sameDisplayDocNo
      ? `Offline collision with ${curDocNo} (${cur?.retailer || "another party"}) on #${origId}. Moved to internal ID #${newId}; assign a unique invoice number.`
      : undefined;
    if (sameDisplayDocNo && !cur.duplicateNumberConflict) {
      const curFlagged = {
        ...cur,
        duplicateNumberConflict: true,
        conflictNote:
          cur.conflictNote ||
          `Offline number #${origId} was also issued on another device (${b?.retailer || "another party"}).`,
      };
      registerBill(curFlagged);
      accepted.add(curFlagged);
    }

    const reassignedBill = {
      ...b,
      id: newId,
      docNo: sharedDocNo,
      collidedFromId: Number(b?.collidedFromId) || origId,
      ...(sameDisplayDocNo
        ? {
            duplicateNumberConflict: true,
            conflictNote,
          }
        : {
            duplicateNumberConflict: false,
            conflictNote: undefined,
          }),
      updatedAt: new Date().toISOString(),
    };
    registerBill(reassignedBill);
    accepted.add(reassignedBill);
    remapped.push({
      oldId: origId,
      newId,
      originalIncoming: b,
      reassignedBill,
    });
  }

  const merged = Array.from(byId.values()).sort((x, y) => Number(y.id) - Number(x.id));
  return { merged, accepted, remapped };
}

export function mergeBillLists(
  stored: any[],
  incoming: any[],
  deletedIds: Set<number>,
  accepted?: Set<any>,
): any[] {
  const res = mergeBillListsWithConflictResolution(stored, incoming, deletedIds);
  if (accepted) {
    res.accepted.forEach((b) => accepted.add(b));
  }
  return res.merged;
}

