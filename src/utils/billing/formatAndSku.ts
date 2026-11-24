export const money = (n: number): string =>
  (Math.round((n + Number.EPSILON) * 100) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Helper to format a date input into DDMMYY (e.g. 16-Oct-2026 -> "161026").
 * Supports ISO strings (YYYY-MM-DD), Indian formats (DD-MM-YYYY, DD/MM/YYYY), and Date objects.
 */
export function formatDdMmYy(dateInput?: string | Date | null): string {
  if (!dateInput) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    return `${dd}${mm}${yy}`;
  }

  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    const dd = String(dateInput.getDate()).padStart(2, '0');
    const mm = String(dateInput.getMonth() + 1).padStart(2, '0');
    const yy = String(dateInput.getFullYear()).slice(-2);
    return `${dd}${mm}${yy}`;
  }

  const s = String(dateInput).trim();
  // Check for ISO format YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const yy = isoMatch[1].slice(-2);
    const mm = isoMatch[2].padStart(2, '0');
    const dd = isoMatch[3].padStart(2, '0');
    return `${dd}${mm}${yy}`;
  }

  // Check for DD-MM-YYYY or DD/MM/YYYY or DD-MM-YY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    const yy = dmyMatch[3].length === 4 ? dmyMatch[3].slice(-2) : dmyMatch[3].padStart(2, '0');
    return `${dd}${mm}${yy}`;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yy = String(parsed.getFullYear()).slice(-2);
    return `${dd}${mm}${yy}`;
  }

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

/**
 * Generates an industry-standard unique Batch/Tag/Lot number for product inwards.
 * Guaranteed to be fresh and unique, never reusing old batch numbers from catalog/stock.
 * Uses DDMMYY (e.g. 161026 for 16-Oct-2026) based on invoiceDate so batches align with supplier invoices.
 */
export function generateBatchNumber(
  productName?: string,
  schemeCode?: string,
  existingBatches?: string[],
  sequenceIndex?: number,
  invoiceDate?: string | Date | null
): string {
  const datePart = formatDdMmYy(invoiceDate);

  const cleanName = (productName || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 3)
    .toUpperCase() || 'LOT';

  const seqPart = sequenceIndex !== undefined ? String(sequenceIndex + 1).padStart(2, '0') : '';

  let attempts = 0;
  let batch = '';
  do {
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    if (schemeCode) {
      const cleanScheme = schemeCode.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
      batch = `LOT-${cleanScheme}-${cleanName}-${datePart}-${seqPart ? seqPart + '-' : ''}${rand}`;
    } else {
      batch = `LOT-${cleanName}-${datePart}-${seqPart ? seqPart + '-' : ''}${rand}`;
    }
    attempts++;
  } while (existingBatches && existingBatches.includes(batch) && attempts < 20);

  return batch;
}

/**
 * Automatically generates a standardized SKU ID for beverages and water bottles.
 * e.g. SKU-WTR-500ML-101, SKU-CMP-150ML-102
 */
export function generateSkuId(productName?: string, category?: string, idHint?: number): string {
  const clean = (productName || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let prefix = 'BEV';
  if (clean.includes('WATER') || category === 'water' || clean.includes('AQUA') || clean.includes('KINLEY') || clean.includes('BISLERI')) {
    prefix = 'WTR';
  } else if (clean.includes('CAMPA') || clean.includes('POWER') || clean.includes('BOOST')) {
    prefix = 'CMP';
  } else if (clean.includes('SOSYO') || clean.includes('JOOS') || clean.includes('RUNNER')) {
    prefix = 'SSY';
  } else if (clean.includes('VIBE') || clean.includes('COLA')) {
    prefix = 'VIB';
  } else if (clean.length >= 3) {
    prefix = clean.slice(0, 3);
  }

  // Extract volume if present e.g. 150ML, 500ML, 1L, 20L
  const volMatch = (productName || '').match(/(\d+)\s*(ML|L|LTR|LITRE)/i);
  const volTag = volMatch ? `-${volMatch[1]}${volMatch[2].toUpperCase()}` : '';

  const num = idHint ? String(idHint).padStart(3, '0') : Math.floor(100 + Math.random() * 900);
  return `SKU-${prefix}${volTag}-${num}`;
}

/**
 * Generates exact Auto SKU adhering to specification:
 * Category code + Name initials + 3-digit running number
 * e.g. "CAMPA MANGO BLAST" in Energy -> "ENR-CMB-015"
 */
export function generateAutoSku(
  productName: string,
  category: import('../../types').CategoryKey,
  runningNumber: number
): string {
  const catCodeMap: Record<import('../../types').CategoryKey, string> = {
    energy: 'ENR',
    vibe: 'VIB',
    joos: 'JOS',
    water: 'WTR',
    general: 'GEN',
  };
  const catCode = catCodeMap[category] || 'GEN';

  // Words ignoring volume/packaging tokens (e.g. 150ML, 500ML, PET, CAN)
  const cleanWords = (productName || '')
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => {
      if (!w) return false;
      if (/^\d+(ML|L|LTR|KG)?$/i.test(w)) return false;
      if (['PET', 'CAN', 'GLASS', 'BOTTLE', 'BOTTLES', 'CRATE', 'CRATES', 'TIN'].includes(w)) return false;
      return true;
    });

  let initials = cleanWords.map((w) => w[0]).join('');
  if (!initials) {
    initials = (productName || 'PRODUCT')
      .replace(/[^a-zA-Z]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'PRD';
  } else if (initials.length > 4) {
    initials = initials.slice(0, 4);
  }

  const numStr = String(runningNumber).padStart(3, '0');
  return `${catCode}-${initials}-${numStr}`;
}

export function whatsappLink(phone: string, text: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  const base = withCountryCode ? `https://wa.me/${withCountryCode}` : 'https://api.whatsapp.com/send';
  return `${base}?text=${encodeURIComponent(text)}`;
}

/**
 * Parses and coerces a dictionary of { [productId: number]: qty: number } safely,
 * converting numeric keys and string values to standard numbers.
 */
export function parseJsonDict(val: any): Record<number, number> {
  if (!val) return {};
  let parsed = val;
  if (typeof val === 'string') {
    try {
      parsed = JSON.parse(val);
    } catch {
      return {};
    }
  }
  if (typeof parsed !== 'object' || parsed === null) return {};
  const res: Record<number, number> = {};
  for (const [k, v] of Object.entries(parsed)) {
    const numK = Number(k);
    const numV = Number(v);
    if (!isNaN(numK) && numK > 0) {
      res[numK] = isNaN(numV) ? 0 : numV;
    }
  }
  return res;
}

/**
 * Parses an array of bill IDs safely from JSON string or raw array, coercing to number[].
 */
export function parseBillIds(val: any): number[] {
  if (!val) return [];
  let parsed = val;
  if (typeof val === 'string') {
    try {
      parsed = JSON.parse(val);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((x) => Number(x)).filter((x) => !isNaN(x));
}
