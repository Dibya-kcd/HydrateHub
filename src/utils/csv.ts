/** One CSV cell escaper for every export. Quotes cells holding comma, quote, CR or LF, and defuses spreadsheet
 *  formulas ("=...", "@...") typed into a name or note by prefixing an apostrophe. Numbers are never altered. */
export function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  let s = String(val);
  if (typeof val === 'string' && /^[=@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
