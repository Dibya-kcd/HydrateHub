import { CategoryKey, Product } from '../../types';
import { CATS } from '../../constants/initialData';

export interface GstBreakdown {
  hsn: string;
  taxable: number;
  cgstRate: number; // in %
  cgstAmt: number;  // in ₹
  sgstRate: number; // in %
  sgstAmt: number;  // in ₹
  totalTax: number; // in ₹
  gstRate: number;  // in %
}

/**
 * GST may be stored as a fraction (0.18) or a whole percent (18).
 * Always normalise to a fraction for arithmetic.
 */
export function normalizeGstFraction(gst: number | undefined | null): number {
  const n = Number(gst);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1 ? n / 100 : n;
}

/**
 * Statutory GST fraction (0-1) by HSN for beverage distribution (post Sep-2025 slabs).
 * 2202 10 xx (aerated / sweetened / flavoured, energy drinks) -> 40%.
 * 2202 99 20 (fruit pulp / fruit juice based drinks)         -> 5%.
 * Packaged water (2201) and other 220299 beverages            -> 18%.
 * Works with 4, 6 or 8 digit codes. Returns null for HSNs this table does not know.
 */
export function gstRateFromHsn(hsn?: string | null): number | null {
  if (!hsn) return null;
  const h = String(hsn).replace(/\D+/g, '');
  if (!h) return null;
  if (h.startsWith('220210')) return 0.4;
  if (h.startsWith('22029920')) return 0.05;
  if (h.startsWith('220299')) return 0.18;
  if (h.startsWith('2201')) return 0.18;
  if (h.startsWith('2202')) return 0.4;
  return null;
}

/**
 * Full 8-digit HSN for a beverage, from what we know about it.
 *  - 22021010  aerated / carbonated soft drinks (cola, lemon, soda ...)
 *  - 22021090  other sweetened / flavoured / energy drinks
 *  - 22029920  fruit-juice / pulp based drinks (juice, mango, mix-fruit ...)
 *  - 22019010  packaged drinking water
 *  - 22029990  other non-alcoholic beverages
 */
export function inferHsn8(category?: string | null, name?: string | null, hsn4or6?: string | null): string {
  const digits = String(hsn4or6 || '').replace(/\D+/g, '');
  const n = String(name || '').toLowerCase();
  const cat = String(category || '').toLowerCase();
  if (digits.startsWith('2201')) return '22019010';
  if (digits.startsWith('220299')) return digits.startsWith('22029920') ? '22029920' : '22029990';
  if (digits.startsWith('220210')) {
    if (/cola|lemon|soda|vibe|clear|orange|sprite|fanta|thums|limca|pepsi|coke|fizz|sparkl|aerated|carbonat/.test(n)) return '22021010';
    return '22021090';
  }
  if (digits === '2202') {
    if (/soda|club\s*soda|plain\s*soda|carbonated\s*water/.test(n)) return '22021010';
    if (/juice|joos|mango|mix.?fruit|pulp|nectar|raskik|slice|maaza|frooti|guava|litchi|apple/.test(n) || cat === 'joos') return '22029920';
    return '22021090';
  }
  // Nothing usable in the stored HSN: decide from the product itself.
  if (/water|aqua|bisleri|kinley|packaged drinking/.test(n) || cat === 'water') return '22019010';
  if (/juice|joos|mango|mix.?fruit|pulp|nectar|raskik|slice|maaza|frooti|guava|litchi|apple/.test(n) || cat === 'joos') return '22029920';
  if (/energy|runner|power\s*up|boost|red\s*bull|monster|campa/.test(n) || cat === 'energy') return '22021090';
  if (/cola|lemon|soda|vibe|clear|sprite|fanta|thums|limca|pepsi|coke|fizz|sparkl|aerated|carbonat/.test(n) || cat === 'vibe') return '22021010';
  const c = (cat && (CATS as any)[cat]?.hsn) as string | undefined;
  return c && c.length === 8 ? c : '22021090';
}

/**
 * Always returns an 8-digit HSN. A stored 8-digit code is kept as is; a 2-7 digit code (for example
 * "2202" from an old product or invoice) is expanded to the full 8-digit tariff code.
 */
export function normalizeTo8DigitHsn(
  hsn?: string | null,
  category?: string | null,
  name?: string | null,
  taxability?: string | null,
): string {
  if (taxability === 'non_gst') {
    return String(hsn ?? '').trim();
  }
  const digits = String(hsn ?? '').replace(/\D+/g, '');
  if (digits.length === 8) return digits;
  if (digits.length > 8) return digits.slice(0, 8);
  return inferHsn8(category, name, digits);
}

/**
 * THE one place that decides a product's GST rate (fraction 0-1). Every billing, purchase and
 * report screen must use this so they cannot disagree.
 * Order: Non-GST product (always 0) -> statutory rate for the product's HSN -> product's own rate -> category -> 18%.
 */
export function resolveProductGstRate(
  p?: { gstRate?: number | null; hsn?: string | null; category?: string | null; name?: string | null; taxability?: string | null } | null,
  categoryHint?: string | null,
): number {
  if (p?.taxability === 'non_gst') return 0;
  const fromHsn = gstRateFromHsn(p?.hsn);
  if (fromHsn != null) return fromHsn;
  const own = p?.gstRate;
  if (own !== undefined && own !== null && (own as unknown) !== '' && Number.isFinite(Number(own))) {
    return normalizeGstFraction(own);
  }
  const cat = (p?.category || categoryHint) as CategoryKey | undefined;
  if (cat && CATS[cat]) return normalizeGstFraction(CATS[cat].gst);
  return 0.18;
}

/** Standard Indian beverage volume sizes in milliliters */
export const STANDARD_VOLUMES = [2250, 2000, 1750, 1500, 1250, 1200, 1000, 750, 600, 500, 400, 330, 300, 250, 200, 185, 180, 160, 150];

/** Volume pattern with explicit unit: 250ml, 750 ml, 2.25L, 1.25 Ltr, 1.5 litre */
export const VOLUME_UNIT_RE = /(\d+(?:\.\d+)?)\s*(ml|milliliters?|millilitres?|ltrs?|litres?|liters?|lt|l)\b/i;

/** Multipack case pattern: 24x250, 12x750, 6x2.25l, 24*200, 30x150, 24/250 */
export const MULTIPACK_VOLUME_RE = /\b\d{1,2}\s*[*x×/]\s*(\d+(?:\.\d+)?)\s*(ml|ltrs?|litres?|liters?|lt|l)?\b/i;

/**
 * Volume in ml found in a product description or null.
 * Handles decimals (2.25L -> 2250), cases (24x250 -> 250), standard sizes (THUMS UP 750 -> 750).
 */
export function volumeFromName(name?: string | null): number | null {
  if (!name) return null;
  const str = name.trim();

  // 1. Explicit unit match (e.g. 2.25L, 250ml, 185ML, 750 ML, 1.25 Ltr)
  const unitMatch = str.match(VOLUME_UNIT_RE);
  if (unitMatch) {
    const val = parseFloat(unitMatch[1]);
    const unit = unitMatch[2].toLowerCase();
    if (unit.startsWith('l')) return Math.round(val * 1000);
    return Math.round(val);
  }

  // 2. Multipack notation (e.g. 24x250, 12x750, 6x2.25)
  const multiMatch = str.match(MULTIPACK_VOLUME_RE);
  if (multiMatch) {
    const val = parseFloat(multiMatch[1]);
    const unit = (multiMatch[2] || '').toLowerCase();
    if (unit.startsWith('l') || (val <= 5 && !unit)) return Math.round(val * 1000);
    return Math.round(val);
  }

  // 3. Standalone standard beverage volumes in text (e.g. "THUMS UP 750", "MAAZA 600", "LIMCA 300", "COKE 2000", "CAN 185")
  for (const vol of STANDARD_VOLUMES) {
    const re = new RegExp(`\\b${vol}\\b`, 'i');
    if (re.test(str)) {
      return vol;
    }
  }

  return null;
}

export function detectPack(name?: string | null): string {
  if (!name) return 'PET';
  const u = name.toUpperCase();
  if (u.includes('CAN') || u.includes('TIN')) return 'Can';
  if (u.includes('RGB') || u.includes('GLASS') || u.includes('RETURNABLE')) return 'Glass';
  if (u.includes('TETRA') || u.includes('TETRAPAK') || u.includes('POUCH') || u.includes('BRICK')) return 'Tetra';
  if (u.includes('PET') || u.includes('PLASTIC') || u.includes('BTL') || u.includes('BOTTLE')) return 'PET';
  return 'PET';
}

/**
 * Extract bottle pack and volume from beverage description
 */
export function detectPackAndVolume(name: string): { pack: string; volume: number } {
  const pack = detectPack(name);
  const detectedVol = volumeFromName(name);
  return {
    pack,
    volume: detectedVol || 250,
  };
}

/**
 * Formats product volume and pack cleanly without ever rendering "0ml".
 * If volume is 0 or missing, infers from product name.
 * e.g. "185ml Can", "150ml PET", "600ml PET", "1.25L PET", or "Can"
 */
export function formatProductVolPack(volume?: number | null, pack?: string | null, name?: string | null): string {
  const vol = (Number(volume) > 0 ? Number(volume) : (name ? volumeFromName(name) : null)) || 0;
  const volText = vol > 0 ? (vol >= 1000 && vol % 1000 === 0 ? `${vol / 1000}L` : `${vol}ml`) : '';
  const packText = pack && pack !== 'pcs' ? pack : (name ? detectPack(name) : '');
  return [volText, packText].filter(Boolean).join(' ');
}

/** Pieces (bottles / cans) in one crate / case. 30, 24, 12 and 10 are the usual pack sizes. */
export const CASE_PACK_SIZES = [30, 24, 12, 10] as const;

/**
 * Units per case, read from the text when it is stated ("24 x 200ml", "30 pcs/cs", "12 btl per case"),
 * otherwise a sensible default for the bottle size (<=200ml: 30, <=750ml: 24, <=1.25L: 12, bigger: 10).
 * Always editable on the product.
 */
export function inferUnitsPerCase(text?: string | null, volumeMl?: number | null): number {
  const t = String(text || '').toLowerCase();
  const m1 = t.match(/(\d{1,3})\s*(?:x|\*|×)\s*\d+(?:\.\d+)?\s*(?:ml|ltr|lt|l)\b/);
  const m2 = t.match(/(\d{1,3})\s*(?:pcs|pc|btl|btls|bottles?|cans?|units?|nos|pouch(?:es)?)\s*(?:\/|per)?\s*(?:cs|case|crate|ctn|box)?/);
  const m3 = t.match(/(\d{1,3})\s*(?:\/|per)\s*(?:cs|case|crate|ctn)/);
  for (const m of [m1, m2, m3]) {
    const n = m ? Number(m[1]) : 0;
    if (n >= 2 && n <= 60) return n;
  }
  const v = Number(volumeMl) || 0;
  if (v <= 0 || v <= 200) return 30;
  if (v <= 750) return 24;
  if (v <= 1250) return 12;
  return 10;
}

/** Product with 8-digit HSN (or optional raw HSN when non_gst), statutory GST rate, and units-per-case value. */
export function normalizeProductTax<T extends { hsn?: string | null; category?: any; name?: string; gstRate?: number | null; taxability?: string | null; unitsPerCrate?: number; pack?: string; volume?: number }>(p: T): T {
  const isNonGst = p.taxability === 'non_gst';
  const hsn = normalizeTo8DigitHsn(p.hsn, p.category, p.name, p.taxability);
  const rate = isNonGst ? 0 : gstRateFromHsn(hsn);
  const detectedVol = volumeFromName(p.name);
  const vol = Number(p.volume) > 0 ? Number(p.volume) : (detectedVol || 150);
  const pack = p.pack && p.pack.trim() !== '' && p.pack !== 'pcs' ? p.pack : detectPack(p.name);
  return {
    ...p,
    hsn,
    gstRate: isNonGst ? 0 : (rate != null ? rate : p.gstRate),
    volume: vol,
    pack,
    unitsPerCrate: Number(p.unitsPerCrate) > 0 ? p.unitsPerCrate : inferUnitsPerCase(`${p.name || ''} ${pack}`, vol),
  };
}

/** Just the normalized tax/pack/volume fields, for spreading over a product object. */
export function productTaxFields(p: Parameters<typeof normalizeProductTax>[0]) {
  const n = normalizeProductTax(p);
  return {
    hsn: n.hsn as string,
    gstRate: n.gstRate as number | undefined,
    taxability: (p.taxability === 'non_gst' ? 'non_gst' : undefined) as Product['taxability'],
    unitsPerCrate: n.unitsPerCrate as number | undefined,
    volume: n.volume as number | undefined,
    pack: n.pack as string | undefined,
  };
}

/** HSN to print for a product: 8-digit code for taxable goods, optional raw code for non_gst. */
export function resolveProductHsn(
  p?: { hsn?: string | null; category?: string | null; name?: string | null; productName?: string | null; taxability?: string | null } | null,
  categoryHint?: string | null,
): string {
  if (p?.taxability === 'non_gst') return String(p?.hsn || '').trim();
  return normalizeTo8DigitHsn(p?.hsn, p?.category || categoryHint, p?.name || p?.productName, p?.taxability);
}

/**
 * Computes taxable value, CGST Rate/Amt and SGST Rate/Amt for a product.
 * In India, total GST is split 50/50 between CGST and SGST.
 */
export function computeProductGstBreakdown(
  productRate: number,
  categoryOrCustomGst?: number,
  customHsn?: string,
  categoryKey?: CategoryKey
): GstBreakdown {
  const gst = normalizeGstFraction(
    categoryOrCustomGst !== undefined
      ? categoryOrCustomGst
      : categoryKey && CATS[categoryKey]
      ? CATS[categoryKey].gst
      : 0.18
  );

  const hsn =
    customHsn ||
    (categoryKey && CATS[categoryKey] ? CATS[categoryKey].hsn : '22029990');

  const halfGst = gst / 2;
  const taxable = gst > 0 ? productRate / (1 + gst) : productRate;
  const totalTax = productRate - taxable;
  const cgstAmt = totalTax / 2;
  const sgstAmt = totalTax / 2;

  return {
    hsn,
    taxable,
    cgstRate: halfGst * 100,
    cgstAmt,
    sgstRate: halfGst * 100,
    sgstAmt,
    totalTax,
    gstRate: gst * 100,
  };
}
