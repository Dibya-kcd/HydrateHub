export const COMPLETE_SQL_SCHEMA_SCRIPT = `-- ================================================================
-- MR WATER — COMPLETE DATABASE SCHEMA  (single, ordered, re-runnable)
-- Paste the WHOLE file in: Supabase Dashboard -> SQL Editor -> Run
--
-- * Works on an EMPTY database and on one that already has older tables.
-- * Section 1 creates every table (dependency order).
-- * Section 2 adds any column an older copy of a table is missing, BEFORE
--   indexes/policies use them (fixes errors like: column "period" does not exist).
-- * Section 3 = indexes, Section 4 = row level security, Section 5 = extras.
-- * Never drops data.
-- ================================================================

-- ---------------------------------------------------------------
-- SECTION 1: TABLES
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    manager TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    capacity_cases INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.salesmen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  default_vehicle TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
    id BIGINT PRIMARY KEY,
    sku TEXT DEFAULT '',
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    volume NUMERIC(10, 2) NOT NULL DEFAULT 0,
    pack TEXT NOT NULL DEFAULT '',
    expiry TEXT NOT NULL DEFAULT '',
    batch_number TEXT DEFAULT '',
    mfg_date TEXT DEFAULT '',
    warehouse_id TEXT DEFAULT '',
    opening INTEGER NOT NULL DEFAULT 0,
    cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    effective_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    retail NUMERIC(10, 2) NOT NULL DEFAULT 0,
    wholesale NUMERIC(10, 2) NOT NULL DEFAULT 0,
    hsn TEXT DEFAULT '22029990',
    gst_rate NUMERIC(5, 4) DEFAULT 0.18,
    scheme TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_batches (
    id TEXT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    batch_number TEXT NOT NULL,
    mfg_date DATE,
    expiry_date DATE,
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    cost_price NUMERIC(10, 2) DEFAULT 0,
    mrp NUMERIC(10, 2) DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    from_warehouse_id TEXT,
    to_warehouse_id TEXT,
    product_id BIGINT NOT NULL,
    batch_number TEXT DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 0,
    reference_note TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.promotions (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'bogo', 'percent', 'flat', 'bundle'
    buy_qty INTEGER DEFAULT 0,
    free_qty INTEGER DEFAULT 0,
    percent NUMERIC(5, 2) DEFAULT 0,
    flat_per_case NUMERIC(10, 2) DEFAULT 0,
    product_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
    bundle_buy_type TEXT DEFAULT 'any',
    required_distinct_types INTEGER DEFAULT 2,
    min_qty_per_type INTEGER DEFAULT 1,
    free_reward_choice TEXT DEFAULT 'all_eligible',
    free_product_id BIGINT,
    free_product_qty INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bills (
    id BIGINT PRIMARY KEY,
    retailer TEXT NOT NULL,
    phone TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cgst NUMERIC(12, 2) NOT NULL DEFAULT 0,
    sgst NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
    warehouse_id TEXT DEFAULT '',
    items JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trips (
    id BIGINT PRIMARY KEY,
    vehicle TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    warehouse_id TEXT DEFAULT '',
    loaded JSONB NOT NULL DEFAULT '{}'::JSONB,
    returned JSONB NOT NULL DEFAULT '{}'::JSONB,
    bill_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
    status TEXT NOT NULL DEFAULT 'out' CHECK (status IN ('out', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audits (
    id BIGINT PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    warehouse_id TEXT DEFAULT '',
    entries JSONB NOT NULL DEFAULT '[]'::JSONB,
    adjusted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_profile (
    id TEXT PRIMARY KEY DEFAULT 'default',
    data JSONB NOT NULL DEFAULT '{}'::JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billing_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    data JSONB NOT NULL DEFAULT '{}'::JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  stock_on_hand INTEGER NOT NULL DEFAULT 0,
  reserved_stock INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  warehouse_id TEXT,
  warehouse_name TEXT,
  warehouse_bay TEXT,
  batch_number TEXT,
  mfg_date TEXT,
  expiry_date TEXT,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  selling_scheme TEXT,
  selling_scheme_discount NUMERIC,
  selling_scheme_label TEXT,
  last_restocked TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_collections (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  retailer TEXT,
  phone TEXT,
  date TEXT,
  status TEXT DEFAULT 'confirmed',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC DEFAULT 0,
  cgst NUMERIC DEFAULT 0,
  sgst NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  warehouse_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.promotional_schemes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  buy_qty INTEGER DEFAULT 0,
  free_qty INTEGER DEFAULT 0,
  percent NUMERIC DEFAULT 0,
  flat_per_case NUMERIC DEFAULT 0,
  product_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.grns (
    id TEXT PRIMARY KEY,
    grn_number TEXT NOT NULL,
    invoice_no TEXT NOT NULL DEFAULT '',
    supplier_name TEXT NOT NULL DEFAULT '',
    supplier_gstin TEXT DEFAULT '',
    supplier_address TEXT DEFAULT '',
    supplier_phone TEXT DEFAULT '',
    supplier_email TEXT DEFAULT '',
    inward_date DATE NOT NULL DEFAULT CURRENT_DATE,
    vehicle_no TEXT DEFAULT '',
    warehouse_id TEXT DEFAULT '',
    warehouse_name TEXT DEFAULT '',
    items JSONB NOT NULL DEFAULT '[]'::JSONB,
    total_billed_qty INTEGER DEFAULT 0,
    total_free_qty INTEGER DEFAULT 0,
    total_paid_qty INTEGER DEFAULT 0,
    total_received_qty INTEGER DEFAULT 0,
    total_taxable NUMERIC(12, 2) DEFAULT 0,
    total_cgst NUMERIC(12, 2) DEFAULT 0,
    total_sgst NUMERIC(12, 2) DEFAULT 0,
    total_tax NUMERIC(12, 2) DEFAULT 0,
    grand_total NUMERIC(12, 2) DEFAULT 0,
    inward_costs JSONB DEFAULT '{}'::JSONB,
    total_inward_cost NUMERIC(12, 2) DEFAULT 0,
    inward_cost_per_crate NUMERIC(10, 2) DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplier_schemes (
    id TEXT PRIMARY KEY,
    supplier_name TEXT NOT NULL,
    name TEXT NOT NULL,
    scheme_type TEXT NOT NULL CHECK (scheme_type IN ('free_goods', 'pending_credit', 'volume_incentive')),
    product_ids BIGINT[] NOT NULL DEFAULT '{}',
    warehouse_id TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT,
    target_quantity NUMERIC(12, 2),
    incentive_rate NUMERIC(12, 2),
    calculation_method TEXT CHECK (calculation_method IN ('all_eligible', 'excess_only')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplier_scheme_applications (
    id TEXT PRIMARY KEY,
    scheme_id TEXT NOT NULL REFERENCES public.supplier_schemes(id) ON DELETE CASCADE,
    scheme_type TEXT NOT NULL CHECK (scheme_type IN ('free_goods', 'pending_credit')),
    grn_id TEXT NOT NULL,
    grn_line_id TEXT NOT NULL,
    product_id BIGINT NOT NULL,
    supplier_name TEXT NOT NULL,
    supplier_invoice_no TEXT DEFAULT '',
    eligible_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
    free_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0,
    expected_benefit NUMERIC(12, 2) NOT NULL DEFAULT 0,
    warehouse_id TEXT,
    batch_id TEXT,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplier_credit_notes (
    id TEXT PRIMARY KEY,
    supplier_name TEXT NOT NULL,
    scheme_id TEXT REFERENCES public.supplier_schemes(id) ON DELETE SET NULL,
    grn_id TEXT,
    product_id BIGINT,
    period TEXT, -- "YYYY-MM" for Type C monthly settlements
    credit_note_number TEXT,
    credit_note_date TEXT,
    expected_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    actual_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_credited', 'settled')),
    attachment_ref TEXT,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_sessions (
    id TEXT PRIMARY KEY,
    warehouse_id TEXT,
    warehouse_name TEXT,
    date TEXT NOT NULL,
    time TEXT,
    auditor_name TEXT NOT NULL,
    reference_note TEXT DEFAULT '',
    entries JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reconciliation_transactions (
    id TEXT PRIMARY KEY,
    audit_session_id TEXT NOT NULL REFERENCES public.audit_sessions(id) ON DELETE CASCADE,
    variance_entry_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('swap', 'investigation_reason', 'adjustment')),
    from_product_id BIGINT NOT NULL,
    to_product_id BIGINT,
    quantity NUMERIC(12, 2) NOT NULL,
    reason_code TEXT,
    match_score NUMERIC(5, 2),
    notes TEXT DEFAULT '',
    identified_by TEXT NOT NULL,
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_ledger_entries (
    id TEXT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    warehouse_id TEXT,
    quantity NUMERIC(12, 2) NOT NULL,
    transaction_type TEXT NOT NULL DEFAULT 'audit_reconciliation',
    reference_audit_session_id TEXT NOT NULL REFERENCES public.audit_sessions(id) ON DELETE CASCADE,
    reference_reconciliation_id TEXT NOT NULL REFERENCES public.reconciliation_transactions(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.grn_edit_log (
    id            TEXT PRIMARY KEY,
    grn_id        TEXT NOT NULL,              -- no FK on purpose: the log must survive a GRN delete
    grn_number    TEXT,
    invoice_no    TEXT,
    supplier_name TEXT,
    edited_by     TEXT,
    reason        TEXT DEFAULT '',
    changes       JSONB NOT NULL DEFAULT '[]'::JSONB,   -- [{scope, lineLabel, field, from, to}, ...]
    edited_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
    id                 TEXT PRIMARY KEY,
    bill_id            BIGINT,
    customer_id        TEXT,
    customer_name      TEXT NOT NULL DEFAULT '',
    customer_phone     TEXT DEFAULT '',
    salesman_id        TEXT,
    payment_date       TEXT NOT NULL,
    amount             NUMERIC(12, 2) NOT NULL DEFAULT 0,
    mode               TEXT NOT NULL DEFAULT 'cash',
    entry_kind         TEXT NOT NULL DEFAULT 'receipt',
    is_advance         BOOLEAN NOT NULL DEFAULT FALSE,
    is_refund          BOOLEAN NOT NULL DEFAULT FALSE,
    is_advance_applied BOOLEAN NOT NULL DEFAULT FALSE,
    applied_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    source_payment_id  TEXT,
    source_bill_id     BIGINT,
    reference_note     TEXT DEFAULT '',
    recorded_by        TEXT DEFAULT '',
    deleted_at         TIMESTAMPTZ,
    deleted_by         TEXT,
    delete_reason      TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_history (
    id            TEXT PRIMARY KEY,
    payment_id    TEXT,
    bill_id       BIGINT,
    customer_name TEXT DEFAULT '',
    action        TEXT NOT NULL,
    amount        NUMERIC(12, 2),
    note          TEXT DEFAULT '',
    changed_by    TEXT NOT NULL DEFAULT 'Admin',
    before_data   JSONB,
    after_data    JSONB,
    changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id            TEXT PRIMARY KEY,
    entity_type   TEXT NOT NULL,
    entity_id     TEXT NOT NULL,
    entity_label  TEXT DEFAULT '',
    action        TEXT NOT NULL,
    actor_name    TEXT NOT NULL DEFAULT 'Admin',
    actor_role    TEXT NOT NULL DEFAULT 'admin',
    actor_phone   TEXT DEFAULT '',
    source_screen TEXT DEFAULT '',
    reason        TEXT DEFAULT '',
    summary       TEXT DEFAULT '',
    before_data   JSONB,
    after_data    JSONB,
    changes       JSONB DEFAULT '[]'::JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs (entity_type, entity_id);

-- ---------------------------------------------------------------
-- SECTION 2: REPAIR OLDER TABLES (add columns that may be missing)
-- ---------------------------------------------------------------
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '';
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS manager TEXT NOT NULL DEFAULT '';
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS capacity_cases INTEGER DEFAULT 0;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.salesmen ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.salesmen ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.salesmen ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.salesmen ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE public.salesmen ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.salesmen ADD COLUMN IF NOT EXISTS default_vehicle TEXT DEFAULT '';
ALTER TABLE public.salesmen ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.salesmen ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS id BIGINT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS volume NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pack TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS expiry TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS batch_number TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mfg_date TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS warehouse_id TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS opening INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS effective_cost NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS retail NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS wholesale NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS hsn TEXT DEFAULT '22029990';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5, 4) DEFAULT 0.18;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS scheme TEXT DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS product_id BIGINT;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS mfg_date DATE;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS mrp NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS from_warehouse_id TEXT;
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS to_warehouse_id TEXT;
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS product_id BIGINT;
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS batch_number TEXT DEFAULT '';
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS reference_note TEXT DEFAULT '';
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS id BIGINT;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS buy_qty INTEGER DEFAULT 0;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS free_qty INTEGER DEFAULT 0;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS percent NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS flat_per_case NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS product_ids JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS bundle_buy_type TEXT DEFAULT 'any';
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS required_distinct_types INTEGER DEFAULT 2;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS min_qty_per_type INTEGER DEFAULT 1;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS free_reward_choice TEXT DEFAULT 'all_eligible';
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS free_product_id BIGINT;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS free_product_qty INTEGER DEFAULT 1;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS product_group JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS group_category TEXT;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS group_brand TEXT;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS free_item_rule TEXT DEFAULT 'CHEAPEST_IN_GROUP';
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS customer_choice_product_id BIGINT;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS id BIGINT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS retailer TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS cgst NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS sgst NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS total NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS discount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS extra JSONB;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS extra JSONB;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS extra JSONB;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS warehouse_id TEXT DEFAULT '';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS cancellation JSONB;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS returns JSONB;

ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS id BIGINT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS vehicle TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS warehouse_id TEXT DEFAULT '';
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS loaded JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS returned JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS bill_ids JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS shortage_reasons JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS draft_returned JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cash_handed_in NUMERIC;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cash_short_booked NUMERIC;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cash_recoveries JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cash_short_written_off BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'out';
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS id BIGINT;
ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS warehouse_id TEXT DEFAULT '';
ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS entries JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS adjusted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.audits ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.organization_profile ADD COLUMN IF NOT EXISTS id TEXT DEFAULT 'default';
ALTER TABLE public.organization_profile ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE public.organization_profile ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.billing_settings ADD COLUMN IF NOT EXISTS id TEXT DEFAULT 'default';
ALTER TABLE public.billing_settings ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE public.billing_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS stock_on_hand INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS reserved_stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS reorder_level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS warehouse_id TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS warehouse_name TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS warehouse_bay TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS mfg_date TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS expiry_date TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS selling_scheme TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS selling_scheme_discount NUMERIC;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS selling_scheme_label TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS last_restocked TEXT;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.app_collections ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE public.app_collections ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.app_collections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS retailer TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cgst NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sgst NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS warehouse_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS buy_qty INTEGER DEFAULT 0;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS free_qty INTEGER DEFAULT 0;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS percent NUMERIC DEFAULT 0;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS flat_per_case NUMERIC DEFAULT 0;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS product_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS grn_number TEXT;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS invoice_no TEXT NOT NULL DEFAULT '';
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS supplier_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS supplier_gstin TEXT DEFAULT '';
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS supplier_address TEXT DEFAULT '';
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS supplier_phone TEXT DEFAULT '';
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS supplier_email TEXT DEFAULT '';
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS inward_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS vehicle_no TEXT DEFAULT '';
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS warehouse_id TEXT DEFAULT '';
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS warehouse_name TEXT DEFAULT '';
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS total_billed_qty INTEGER DEFAULT 0;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS total_free_qty INTEGER DEFAULT 0;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS total_paid_qty INTEGER DEFAULT 0;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS total_received_qty INTEGER DEFAULT 0;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS total_taxable NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS total_cgst NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS total_sgst NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS total_tax NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS grand_total NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS inward_costs JSONB DEFAULT '{}'::JSONB;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS total_inward_cost NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS inward_cost_per_crate NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.supplier_schemes ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.supplier_schemes ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE public.supplier_schemes ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.supplier_schemes ADD COLUMN IF NOT EXISTS scheme_type TEXT;
ALTER TABLE public.supplier_schemes ADD COLUMN IF NOT EXISTS product_ids BIGINT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.supplier_schemes ADD COLUMN IF NOT EXISTS warehouse_id TEXT;
ALTER TABLE public.supplier_schemes ADD COLUMN IF NOT EXISTS start_date TEXT;
ALTER TABLE public.supplier_schemes ADD COLUMN IF NOT EXISTS end_date TEXT;
ALTER TABLE public.supplier_schemes ADD COLUMN IF NOT EXISTS target_quantity NUMERIC(12, 2);
ALTER TABLE public.supplier_schemes ADD COLUMN IF NOT EXISTS incentive_rate NUMERIC(12, 2);
ALTER TABLE public.supplier_schemes ADD COLUMN IF NOT EXISTS calculation_method TEXT;
ALTER TABLE public.supplier_schemes ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.supplier_schemes ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.supplier_schemes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.supplier_schemes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.supplier_scheme_applications ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.supplier_scheme_applications ADD COLUMN IF NOT EXISTS scheme_id TEXT REFERENCES public.supplier_schemes(id) ON DELETE CASCADE;
ALTER TABLE public.supplier_scheme_applications ADD COLUMN IF NOT EXISTS scheme_type TEXT;
ALTER TABLE public.supplier_scheme_applications ADD COLUMN IF NOT EXISTS grn_id TEXT;
ALTER TABLE public.supplier_scheme_applications ADD COLUMN IF NOT EXISTS grn_line_id TEXT;
ALTER TABLE public.supplier_scheme_applications ADD COLUMN IF NOT EXISTS product_id BIGINT;
ALTER TABLE public.supplier_scheme_applications ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE public.supplier_scheme_applications ADD COLUMN IF NOT EXISTS supplier_invoice_no TEXT DEFAULT '';
ALTER TABLE public.supplier_scheme_applications ADD COLUMN IF NOT EXISTS eligible_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.supplier_scheme_applications ADD COLUMN IF NOT EXISTS free_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.supplier_scheme_applications ADD COLUMN IF NOT EXISTS expected_benefit NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.supplier_scheme_applications ADD COLUMN IF NOT EXISTS warehouse_id TEXT;
ALTER TABLE public.supplier_scheme_applications ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE public.supplier_scheme_applications ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.supplier_scheme_applications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS scheme_id TEXT REFERENCES public.supplier_schemes(id) ON DELETE SET NULL;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS grn_id TEXT;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS product_id BIGINT;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS period TEXT;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS credit_note_number TEXT;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS credit_note_date TEXT;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS expected_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS actual_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS attachment_ref TEXT;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS warehouse_id TEXT;
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS warehouse_name TEXT;
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS time TEXT;
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS auditor_name TEXT;
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS reference_note TEXT DEFAULT '';
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS entries JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.reconciliation_transactions ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.reconciliation_transactions ADD COLUMN IF NOT EXISTS audit_session_id TEXT REFERENCES public.audit_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.reconciliation_transactions ADD COLUMN IF NOT EXISTS variance_entry_id TEXT;
ALTER TABLE public.reconciliation_transactions ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.reconciliation_transactions ADD COLUMN IF NOT EXISTS from_product_id BIGINT;
ALTER TABLE public.reconciliation_transactions ADD COLUMN IF NOT EXISTS to_product_id BIGINT;
ALTER TABLE public.reconciliation_transactions ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 2);
ALTER TABLE public.reconciliation_transactions ADD COLUMN IF NOT EXISTS reason_code TEXT;
ALTER TABLE public.reconciliation_transactions ADD COLUMN IF NOT EXISTS match_score NUMERIC(5, 2);
ALTER TABLE public.reconciliation_transactions ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.reconciliation_transactions ADD COLUMN IF NOT EXISTS identified_by TEXT;
ALTER TABLE public.reconciliation_transactions ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.reconciliation_transactions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.reconciliation_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS product_id BIGINT;
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS warehouse_id TEXT;
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 2);
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL DEFAULT 'audit_reconciliation';
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS reference_audit_session_id TEXT REFERENCES public.audit_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS reference_reconciliation_id TEXT REFERENCES public.reconciliation_transactions(id) ON DELETE CASCADE;
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.stock_ledger_entries ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS grn_id TEXT;
ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS grn_number TEXT;
ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS invoice_no TEXT;
ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS edited_by TEXT;
ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT '';
ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS changes JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS edit_log JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS edit_history JSONB NOT NULL DEFAULT '[]'::JSONB;
-- Salesman links on trips & bills
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS salesman_id UUID REFERENCES public.salesmen(id) ON DELETE SET NULL;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS salesman_id UUID REFERENCES public.salesmen(id) ON DELETE SET NULL;
-- Bundle promotions must not be rejected by an old check constraint
ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS promotions_type_check;

-- ---------------------------------------------------------------
-- SECTION 3: INDEXES
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_inventory_items_product_id ON public.inventory_items(product_id);
CREATE INDEX IF NOT EXISTS idx_salesmen_phone ON public.salesmen(phone);
CREATE INDEX IF NOT EXISTS idx_trips_salesman_id ON public.trips(salesman_id);
CREATE INDEX IF NOT EXISTS idx_bills_salesman_id ON public.bills(salesman_id);
CREATE INDEX IF NOT EXISTS idx_supplier_scheme_applications_scheme_id ON public.supplier_scheme_applications(scheme_id);
CREATE INDEX IF NOT EXISTS idx_supplier_scheme_applications_grn_id ON public.supplier_scheme_applications(grn_id);
CREATE INDEX IF NOT EXISTS idx_supplier_scheme_applications_product_id ON public.supplier_scheme_applications(product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_credit_notes_scheme_id ON public.supplier_credit_notes(scheme_id);
CREATE INDEX IF NOT EXISTS idx_supplier_credit_notes_grn_id ON public.supplier_credit_notes(grn_id);
CREATE INDEX IF NOT EXISTS idx_supplier_credit_notes_period ON public.supplier_credit_notes(period);
CREATE INDEX IF NOT EXISTS idx_reconciliation_transactions_session ON public.reconciliation_transactions(audit_session_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_transactions_variance_entry ON public.reconciliation_transactions(variance_entry_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_transactions_from_product ON public.reconciliation_transactions(from_product_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_entries_product ON public.stock_ledger_entries(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_entries_session ON public.stock_ledger_entries(reference_audit_session_id);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_date ON public.audit_sessions(date);
CREATE INDEX IF NOT EXISTS idx_grn_edit_log_grn ON public.grn_edit_log(grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_edit_log_time ON public.grn_edit_log(edited_at DESC);
CREATE INDEX IF NOT EXISTS idx_grns_inward_date ON public.grns(inward_date);

-- ---------------------------------------------------------------
-- SECTION 4: ROW LEVEL SECURITY (open policy, same as the app expects)
-- ---------------------------------------------------------------
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to warehouses" ON public.warehouses;
CREATE POLICY "Allow all access to warehouses" ON public.warehouses FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.salesmen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to salesmen" ON public.salesmen;
CREATE POLICY "Allow all access to salesmen" ON public.salesmen FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to products" ON public.products;
CREATE POLICY "Allow all access to products" ON public.products FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to inventory_batches" ON public.inventory_batches;
CREATE POLICY "Allow all access to inventory_batches" ON public.inventory_batches FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to stock_transfers" ON public.stock_transfers;
CREATE POLICY "Allow all access to stock_transfers" ON public.stock_transfers FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to promotions" ON public.promotions;
CREATE POLICY "Allow all access to promotions" ON public.promotions FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to bills" ON public.bills;
CREATE POLICY "Allow all access to bills" ON public.bills FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to trips" ON public.trips;
CREATE POLICY "Allow all access to trips" ON public.trips FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to audits" ON public.audits;
CREATE POLICY "Allow all access to audits" ON public.audits FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.organization_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to organization_profile" ON public.organization_profile;
CREATE POLICY "Allow all access to organization_profile" ON public.organization_profile FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to billing_settings" ON public.billing_settings;
CREATE POLICY "Allow all access to billing_settings" ON public.billing_settings FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to inventory_items" ON public.inventory_items;
CREATE POLICY "Allow all access to inventory_items" ON public.inventory_items FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.app_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to app_collections" ON public.app_collections;
CREATE POLICY "Allow all access to app_collections" ON public.app_collections FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to orders" ON public.orders;
CREATE POLICY "Allow all access to orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.promotional_schemes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to promotional_schemes" ON public.promotional_schemes;
CREATE POLICY "Allow all access to promotional_schemes" ON public.promotional_schemes FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.grns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to grns" ON public.grns;
CREATE POLICY "Allow all access to grns" ON public.grns FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.supplier_schemes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to supplier_schemes" ON public.supplier_schemes;
CREATE POLICY "Allow all access to supplier_schemes" ON public.supplier_schemes FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.supplier_scheme_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to supplier_scheme_applications" ON public.supplier_scheme_applications;
CREATE POLICY "Allow all access to supplier_scheme_applications" ON public.supplier_scheme_applications FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.supplier_credit_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to supplier_credit_notes" ON public.supplier_credit_notes;
CREATE POLICY "Allow all access to supplier_credit_notes" ON public.supplier_credit_notes FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.audit_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to audit_sessions" ON public.audit_sessions;
CREATE POLICY "Allow all access to audit_sessions" ON public.audit_sessions FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.reconciliation_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to reconciliation_transactions" ON public.reconciliation_transactions;
CREATE POLICY "Allow all access to reconciliation_transactions" ON public.reconciliation_transactions FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.stock_ledger_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to stock_ledger_entries" ON public.stock_ledger_entries;
CREATE POLICY "Allow all access to stock_ledger_entries" ON public.stock_ledger_entries FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.grn_edit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to grn_edit_log" ON public.grn_edit_log;
CREATE POLICY "Allow all access to grn_edit_log" ON public.grn_edit_log FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to payments" ON public.payments;
CREATE POLICY "Allow all access to payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to payment_history" ON public.payment_history;
CREATE POLICY "Allow all access to payment_history" ON public.payment_history FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to activity_logs" ON public.activity_logs;
CREATE POLICY "Allow all access to activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------
-- SECTION 5: refresh the API cache so new tables/columns work immediately
-- ---------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- Handy queries (run separately):
--   SELECT edited_at, grn_number, invoice_no, supplier_name, edited_by, reason, changes
--     FROM public.grn_edit_log ORDER BY edited_at DESC;
--   SELECT id, date, warehouse_name, auditor_name, jsonb_array_length(entries) AS skus
--     FROM public.audit_sessions ORDER BY date DESC;
`;
