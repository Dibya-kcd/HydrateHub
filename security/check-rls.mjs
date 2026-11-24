#!/usr/bin/env node
/**
 * Tells you, in plain words, whether the public (anon) key can still change your database.
 *
 *   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=eyJ... node security/check-rls.mjs
 *   (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are accepted too.)  Needs Node 18+.
 *
 * It writes ONE harmless row (key "rls_canary") into app_collections with the public key, then removes it.
 *   - row accepted      -> OPEN: anyone with the app can change your data.
 *   - permission denied -> LOCKED for writing (this is what you want after lock-down-rls.sql).
 * It also tries to read bills/payments/salesmen. A locked table answers with an empty list, so "0 rows" can mean
 * locked OR empty; only trust a read as OPEN when it shows rows.
 * Exit code: 0 = locked, 2 = open, 1 = could not tell.
 */
const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_ANON_KEY (the public key from Project settings > API).");
  process.exit(1);
}
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const rest = (path, init = {}) => fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });

let open = false;
let unsure = false;

for (const table of ["bills", "payments", "salesmen", "customers"]) {
  try {
    const r = await rest(`${table}?select=*&limit=1`);
    if (!r.ok) { console.log(`read  ${table.padEnd(10)} blocked (${r.status})`); continue; }
    const rows = await r.json();
    if (Array.isArray(rows) && rows.length > 0) { console.log(`read  ${table.padEnd(10)} OPEN - the public key can read rows`); open = true; }
    else console.log(`read  ${table.padEnd(10)} no rows visible (locked, or the table is empty)`);
  } catch (e) { console.log(`read  ${table.padEnd(10)} could not check: ${e.message}`); unsure = true; }
}

try {
  const r = await rest("app_collections?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: "rls_canary", data: { note: "safe to delete" }, updated_at: new Date().toISOString() }),
  });
  if (r.ok) {
    console.log("write app_collections OPEN - the public key can WRITE to your database");
    open = true;
    await rest("app_collections?key=eq.rls_canary", { method: "DELETE" }).catch(() => {});
  } else if (r.status === 401 || r.status === 403) {
    console.log(`write app_collections LOCKED (${r.status})`);
  } else {
    console.log(`write app_collections no clear answer (${r.status}): ${(await r.text()).slice(0, 160)}`);
    unsure = true;
  }
} catch (e) { console.log(`write could not check: ${e.message}`); unsure = true; }

console.log(open ? "\nRESULT: OPEN. Run security/lock-down-rls.sql on staging first (see RUNBOOK.md)." : unsure ? "\nRESULT: could not tell." : "\nRESULT: LOCKED for the public key.");
process.exit(open ? 2 : unsure ? 1 : 0);
