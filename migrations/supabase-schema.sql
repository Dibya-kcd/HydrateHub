-- ================================================================
-- MR WATER — COMPLETE DATABASE SCHEMA (single, ordered, re-runnable)
-- Paste the WHOLE file in: Supabase Dashboard -> SQL Editor -> Run
--
-- * Works on an EMPTY database and on one that already has older tables.
-- * Section 1 creates all 27 active tables (dependency order).
-- * Section 2 adds any column an older copy of a table may be missing.
-- * Section 3 creates all indexes (after columns exist).
-- * Section 4 enables Row Level Security & policies on all 27 tables.
-- * Never drops tables/policies, never acquires unnecessary locks, and never modifies existing data.
-- * Safe to execute against a live realtime production database.
-- ================================================================

-- ---------------------------------------------------------------
-- SECTION 1: TABLES (27 active application tables)
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
    extra JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_batches (
    id TEXT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    sku TEXT DEFAULT '',
    batch_number TEXT NOT NULL,
    mfg_date DATE,
    expiry_date DATE,
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    billed_quantity INTEGER DEFAULT 0,
    free_quantity INTEGER DEFAULT 0,
    cost_price NUMERIC(10, 2) DEFAULT 0,
    effective_cost_price NUMERIC(10, 2) DEFAULT 0,
    landed_cost_per_crate NUMERIC(10, 2) DEFAULT 0,
    mrp NUMERIC(10, 2) DEFAULT 0,
    scheme TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    supplier_invoice_no TEXT DEFAULT '',
    supplier_name TEXT DEFAULT '',
    inward_date DATE,
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
    type TEXT NOT NULL,
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
    product_group JSONB DEFAULT '[]'::JSONB,
    group_category TEXT,
    group_brand TEXT,
    free_item_rule TEXT DEFAULT 'CHEAPEST_IN_GROUP',
    customer_choice_product_id BIGINT,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    start_date DATE,
    end_date DATE,
    usage_limit INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    per_customer_limit INTEGER,
    funded_by TEXT DEFAULT 'self',
    supplier_share_percent NUMERIC(5, 2) DEFAULT 0,
    supplier_name TEXT DEFAULT '',
    config JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
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
    salesman TEXT DEFAULT '',
    salesman_id UUID REFERENCES public.salesmen(id) ON DELETE SET NULL,
    supply_type TEXT DEFAULT 'B2C',
    customer_gstin TEXT,
    is_retrospective BOOLEAN DEFAULT FALSE,
    items JSONB NOT NULL DEFAULT '[]'::JSONB,
    cancellation JSONB,
    returns JSONB,
    cancelled_returns JSONB,
    edit_history JSONB,
    extra JSONB,
    scheme_discount_total NUMERIC(12, 2) DEFAULT 0,
    schemes_applied JSONB DEFAULT '[]'::JSONB,
    scheme_version_map JSONB DEFAULT '{}'::JSONB,
    you_saved NUMERIC(12, 2) DEFAULT 0,
    manual_override_log JSONB DEFAULT '[]'::JSONB,
    schemes_enabled_at_save BOOLEAN DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trips (
    id BIGINT PRIMARY KEY,
    vehicle TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    warehouse_id TEXT DEFAULT '',
    salesman TEXT DEFAULT '',
    salesman_id UUID REFERENCES public.salesmen(id) ON DELETE SET NULL,
    salesman_phone TEXT,
    route TEXT,
    driver TEXT,
    driver_phone TEXT,
    loaded JSONB NOT NULL DEFAULT '{}'::JSONB,
    warehouse_loads JSONB NOT NULL DEFAULT '{}'::JSONB,
    returned JSONB NOT NULL DEFAULT '{}'::JSONB,
    draft_returned JSONB NOT NULL DEFAULT '{}'::JSONB,
    shortage_reasons JSONB NOT NULL DEFAULT '{}'::JSONB,
    cash_handed_in NUMERIC,
    cash_short_booked NUMERIC,
    cash_recoveries JSONB NOT NULL DEFAULT '[]'::JSONB,
    cash_short_written_off BOOLEAN NOT NULL DEFAULT FALSE,
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
    data JSONB NOT NULL DEFAULT '[]'::JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    retailer TEXT,
    phone TEXT,
    date TEXT,
    status TEXT DEFAULT 'confirmed',
    items JSONB NOT NULL DEFAULT '[]'::JSONB,
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
    product_ids JSONB DEFAULT '[]'::JSONB,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    start_date DATE,
    end_date DATE,
    usage_limit INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    per_customer_limit INTEGER,
    funded_by TEXT DEFAULT 'self',
    supplier_share_percent NUMERIC(5, 2) DEFAULT 0,
    supplier_name TEXT DEFAULT '',
    config JSONB NOT NULL DEFAULT '{}'::JSONB,
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
    edit_history JSONB NOT NULL DEFAULT '[]'::JSONB,
    extra JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.grn_edit_log (
    id            TEXT PRIMARY KEY,
    grn_id        TEXT NOT NULL,
    grn_number    TEXT,
    invoice_no    TEXT,
    supplier_name TEXT,
    edited_by     TEXT,
    reason        TEXT DEFAULT '',
    changes       JSONB NOT NULL DEFAULT '[]'::JSONB,
    edited_at     TIMESTAMPTZ DEFAULT NOW()
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
    period TEXT,
    credit_note_number TEXT,
    credit_note_date TEXT,
    expected_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    actual_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_credited', 'settled')),
    attachment_ref TEXT,
    notes TEXT DEFAULT '',
    taxable_value NUMERIC(14, 2) DEFAULT 0,
    cgst NUMERIC(14, 2) DEFAULT 0,
    sgst NUMERIC(14, 2) DEFAULT 0,
    igst NUMERIC(14, 2) DEFAULT 0,
    warehouse_id TEXT,
    batch_id TEXT,
    quantity NUMERIC(12, 2) DEFAULT 0,
    reason TEXT DEFAULT '',
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
    entries JSONB NOT NULL DEFAULT '[]'::JSONB,
    edit_log JSONB NOT NULL DEFAULT '[]'::JSONB,
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

CREATE TABLE IF NOT EXISTS public.inventory_dispositions (
    id TEXT PRIMARY KEY,
    disposition_type TEXT NOT NULL CHECK (disposition_type IN (
        'expiry_return',
        'quality_return',
        'invoice_error_return',
        'return_to_supplier',
        'return_to_company',
        'free_near_expiry',
        'scheme_free_issue',
        'expired_writeoff',
        'damage_writeoff'
    )),
    product_id BIGINT NOT NULL,
    product_name TEXT,
    warehouse_id TEXT NOT NULL,
    warehouse_name TEXT,
    batch_id TEXT,
    batch_number TEXT,
    expiry_date TEXT,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL DEFAULT 'case',
    cost_per_unit NUMERIC(12, 4) NOT NULL DEFAULT 0,
    cost_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
    supplier_name TEXT,
    grn_id TEXT,
    supplier_invoice_no TEXT,
    credit_note_number TEXT,
    credit_note_date TEXT,
    cn_taxable_value NUMERIC(14, 2) DEFAULT 0,
    cn_cgst NUMERIC(14, 2) DEFAULT 0,
    cn_sgst NUMERIC(14, 2) DEFAULT 0,
    cn_igst NUMERIC(14, 2) DEFAULT 0,
    cn_total NUMERIC(14, 2) DEFAULT 0,
    compensation_status TEXT NOT NULL DEFAULT 'not_applicable'
        CHECK (compensation_status IN (
            'not_applicable', 'pending', 'partial', 'settled', 'rejected'
        )),
    compensated_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    compensated_at TEXT,
    distributed_to_name TEXT,
    distributed_to_phone TEXT,
    salesman_id TEXT,
    salesman_name TEXT,
    reason TEXT NOT NULL DEFAULT '',
    notes TEXT DEFAULT '',
    reference_doc_no TEXT,
    attachment_ref TEXT,
    created_by TEXT,
    approved_by TEXT,
    event_date TEXT NOT NULL,
    stock_applied BOOLEAN DEFAULT TRUE,
    approval_status TEXT DEFAULT 'not_required',
    claim_scheme TEXT,
    compensation_payments JSONB DEFAULT '[]'::JSONB,
    return_tracking JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
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
    entry_kind         TEXT NOT NULL DEFAULT 'receipt'
                           CHECK (entry_kind IN ('receipt', 'advance', 'refund', 'advance_adjustment')),
    is_advance         BOOLEAN NOT NULL DEFAULT FALSE,
    is_refund          BOOLEAN NOT NULL DEFAULT FALSE,
    is_advance_applied BOOLEAN NOT NULL DEFAULT FALSE,
    applied_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    source_payment_id  TEXT,
    source_bill_id     BIGINT,
    reversal_of        TEXT,
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
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS extra JSONB;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS product_id BIGINT;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS sku TEXT DEFAULT '';
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS mfg_date DATE;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS billed_quantity INTEGER DEFAULT 0;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS free_quantity INTEGER DEFAULT 0;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS effective_cost_price NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS landed_cost_per_crate NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS mrp NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS scheme TEXT DEFAULT '';
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS supplier_invoice_no TEXT DEFAULT '';
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS supplier_name TEXT DEFAULT '';
ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS inward_date DATE;
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
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS usage_limit INTEGER;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS per_customer_limit INTEGER;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS funded_by TEXT DEFAULT 'self';
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS supplier_share_percent NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS supplier_name TEXT DEFAULT '';
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- Bundle/custom promotions must not be rejected by an older type check constraint
DO $$ BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'promotions_type_check'
          AND conrelid = 'public.promotions'::regclass
    ) THEN
        ALTER TABLE public.promotions DROP CONSTRAINT promotions_type_check;
    END IF;
END $$;

ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS buy_qty INTEGER DEFAULT 0;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS free_qty INTEGER DEFAULT 0;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS percent NUMERIC DEFAULT 0;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS flat_per_case NUMERIC DEFAULT 0;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS product_ids JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS usage_limit INTEGER;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS per_customer_limit INTEGER;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS funded_by TEXT DEFAULT 'self';
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS supplier_share_percent NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS supplier_name TEXT DEFAULT '';
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.promotional_schemes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS warehouse_id TEXT DEFAULT '';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS salesman TEXT DEFAULT '';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS salesman_id UUID REFERENCES public.salesmen(id) ON DELETE SET NULL;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS supply_type TEXT DEFAULT 'B2C';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS customer_gstin TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS is_retrospective BOOLEAN DEFAULT FALSE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS cancellation JSONB;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS returns JSONB;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS cancelled_returns JSONB;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS edit_history JSONB;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS extra JSONB;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS scheme_discount_total NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS schemes_applied JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS scheme_version_map JSONB DEFAULT '{}'::JSONB;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS you_saved NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS manual_override_log JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS schemes_enabled_at_save BOOLEAN DEFAULT NULL;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS id BIGINT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS vehicle TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS warehouse_id TEXT DEFAULT '';
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS salesman TEXT DEFAULT '';
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS salesman_id UUID REFERENCES public.salesmen(id) ON DELETE SET NULL;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS salesman_phone TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS route TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS driver TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS driver_phone TEXT;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS loaded JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS warehouse_loads JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS returned JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS draft_returned JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS shortage_reasons JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cash_handed_in NUMERIC;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cash_short_booked NUMERIC;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cash_recoveries JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS cash_short_written_off BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS bill_ids JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'out';
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Older single-warehouse trips fallback to warehouse_id + loaded in application code (normalizeTrip / tripLoads) without mutating live rows.

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
ALTER TABLE public.app_collections ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.app_collections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS retailer TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cgst NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sgst NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS warehouse_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS edit_history JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS extra JSONB;
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.grns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS grn_id TEXT;
ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS grn_number TEXT;
ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS invoice_no TEXT;
ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS edited_by TEXT;
ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT '';
ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS changes JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.grn_edit_log ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ DEFAULT NOW();

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
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS taxable_value NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS cgst NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS sgst NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS igst NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS warehouse_id TEXT;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT '';
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.supplier_credit_notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS warehouse_id TEXT;
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS warehouse_name TEXT;
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS time TEXT;
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS auditor_name TEXT;
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS reference_note TEXT DEFAULT '';
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS entries JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS edit_log JSONB NOT NULL DEFAULT '[]'::JSONB;
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

ALTER TABLE public.inventory_dispositions ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'not_required';
ALTER TABLE public.inventory_dispositions ADD COLUMN IF NOT EXISTS claim_scheme TEXT;
ALTER TABLE public.inventory_dispositions ADD COLUMN IF NOT EXISTS compensation_payments JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.inventory_dispositions ADD COLUMN IF NOT EXISTS return_tracking JSONB;

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reversal_of TEXT;

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
CREATE INDEX IF NOT EXISTS idx_inv_disp_type ON public.inventory_dispositions(disposition_type);
CREATE INDEX IF NOT EXISTS idx_inv_disp_product ON public.inventory_dispositions(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_disp_warehouse ON public.inventory_dispositions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inv_disp_batch ON public.inventory_dispositions(batch_id);
CREATE INDEX IF NOT EXISTS idx_inv_disp_batch_number ON public.inventory_dispositions(batch_number);
CREATE INDEX IF NOT EXISTS idx_inv_disp_grn ON public.inventory_dispositions(grn_id);
CREATE INDEX IF NOT EXISTS idx_inv_disp_supplier ON public.inventory_dispositions(supplier_name);
CREATE INDEX IF NOT EXISTS idx_inv_disp_cn ON public.inventory_dispositions(credit_note_number);
CREATE INDEX IF NOT EXISTS idx_inv_disp_event_date ON public.inventory_dispositions(event_date);
CREATE INDEX IF NOT EXISTS idx_inv_disp_comp_status ON public.inventory_dispositions(compensation_status);
CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON public.payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_updated_at ON public.payments(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_source_payment_id ON public.payments(source_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_reversal_of ON public.payments(reversal_of);
CREATE INDEX IF NOT EXISTS idx_payment_history_payment_id ON public.payment_history(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_bill_id ON public.payment_history(bill_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_changed_at ON public.payment_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);

-- ---------------------------------------------------------------
-- SECTION 4: ROW LEVEL SECURITY (all 27 tables)
-- ---------------------------------------------------------------
DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'warehouses') THEN
        ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'warehouses' AND policyname = 'Allow all access to warehouses') THEN
        CREATE POLICY "Allow all access to warehouses" ON public.warehouses FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'salesmen') THEN
        ALTER TABLE public.salesmen ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'salesmen' AND policyname = 'Allow all access to salesmen') THEN
        CREATE POLICY "Allow all access to salesmen" ON public.salesmen FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'products') THEN
        ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'Allow all access to products') THEN
        CREATE POLICY "Allow all access to products" ON public.products FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'inventory_batches') THEN
        ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_batches' AND policyname = 'Allow all access to inventory_batches') THEN
        CREATE POLICY "Allow all access to inventory_batches" ON public.inventory_batches FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'stock_transfers') THEN
        ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'stock_transfers' AND policyname = 'Allow all access to stock_transfers') THEN
        CREATE POLICY "Allow all access to stock_transfers" ON public.stock_transfers FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'promotions') THEN
        ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'promotions' AND policyname = 'Allow all access to promotions') THEN
        CREATE POLICY "Allow all access to promotions" ON public.promotions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'bills') THEN
        ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bills' AND policyname = 'Allow all access to bills') THEN
        CREATE POLICY "Allow all access to bills" ON public.bills FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'trips') THEN
        ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trips' AND policyname = 'Allow all access to trips') THEN
        CREATE POLICY "Allow all access to trips" ON public.trips FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'audits') THEN
        ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audits' AND policyname = 'Allow all access to audits') THEN
        CREATE POLICY "Allow all access to audits" ON public.audits FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'organization_profile') THEN
        ALTER TABLE public.organization_profile ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organization_profile' AND policyname = 'Allow all access to organization_profile') THEN
        CREATE POLICY "Allow all access to organization_profile" ON public.organization_profile FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'billing_settings') THEN
        ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'billing_settings' AND policyname = 'Allow all access to billing_settings') THEN
        CREATE POLICY "Allow all access to billing_settings" ON public.billing_settings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'inventory_items') THEN
        ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_items' AND policyname = 'Allow all access to inventory_items') THEN
        CREATE POLICY "Allow all access to inventory_items" ON public.inventory_items FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'app_collections') THEN
        ALTER TABLE public.app_collections ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_collections' AND policyname = 'Allow all access to app_collections') THEN
        CREATE POLICY "Allow all access to app_collections" ON public.app_collections FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'orders') THEN
        ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Allow all access to orders') THEN
        CREATE POLICY "Allow all access to orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'promotional_schemes') THEN
        ALTER TABLE public.promotional_schemes ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'promotional_schemes' AND policyname = 'Allow all access to promotional_schemes') THEN
        CREATE POLICY "Allow all access to promotional_schemes" ON public.promotional_schemes FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'grns') THEN
        ALTER TABLE public.grns ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'grns' AND policyname = 'Allow all access to grns') THEN
        CREATE POLICY "Allow all access to grns" ON public.grns FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'grn_edit_log') THEN
        ALTER TABLE public.grn_edit_log ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'grn_edit_log' AND policyname = 'Allow all access to grn_edit_log') THEN
        CREATE POLICY "Allow all access to grn_edit_log" ON public.grn_edit_log FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'supplier_schemes') THEN
        ALTER TABLE public.supplier_schemes ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'supplier_schemes' AND policyname = 'Allow all access to supplier_schemes') THEN
        CREATE POLICY "Allow all access to supplier_schemes" ON public.supplier_schemes FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'supplier_scheme_applications') THEN
        ALTER TABLE public.supplier_scheme_applications ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'supplier_scheme_applications' AND policyname = 'Allow all access to supplier_scheme_applications') THEN
        CREATE POLICY "Allow all access to supplier_scheme_applications" ON public.supplier_scheme_applications FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'supplier_credit_notes') THEN
        ALTER TABLE public.supplier_credit_notes ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'supplier_credit_notes' AND policyname = 'Allow all access to supplier_credit_notes') THEN
        CREATE POLICY "Allow all access to supplier_credit_notes" ON public.supplier_credit_notes FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'audit_sessions') THEN
        ALTER TABLE public.audit_sessions ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_sessions' AND policyname = 'Allow all access to audit_sessions') THEN
        CREATE POLICY "Allow all access to audit_sessions" ON public.audit_sessions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'reconciliation_transactions') THEN
        ALTER TABLE public.reconciliation_transactions ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reconciliation_transactions' AND policyname = 'Allow all access to reconciliation_transactions') THEN
        CREATE POLICY "Allow all access to reconciliation_transactions" ON public.reconciliation_transactions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'stock_ledger_entries') THEN
        ALTER TABLE public.stock_ledger_entries ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'stock_ledger_entries' AND policyname = 'Allow all access to stock_ledger_entries') THEN
        CREATE POLICY "Allow all access to stock_ledger_entries" ON public.stock_ledger_entries FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'inventory_dispositions') THEN
        ALTER TABLE public.inventory_dispositions ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inventory_dispositions' AND policyname = 'Allow all access to inventory_dispositions') THEN
        CREATE POLICY "Allow all access to inventory_dispositions" ON public.inventory_dispositions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'payments') THEN
        ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'Allow all access to payments') THEN
        CREATE POLICY "Allow all access to payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'payment_history') THEN
        ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_history' AND policyname = 'Allow all access to payment_history') THEN
        CREATE POLICY "Allow all access to payment_history" ON public.payment_history FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'activity_logs') THEN
        ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activity_logs' AND policyname = 'Allow all access to activity_logs') THEN
        CREATE POLICY "Allow all access to activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ---------------------------------------------------------------
-- SECTION 5: REPORTING VIEWS & SCHEMA CACHE RELOAD
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_open_supplier_claims AS
SELECT
    id,
    disposition_type,
    supplier_name,
    supplier_invoice_no,
    product_id,
    product_name,
    batch_id,
    batch_number,
    expiry_date,
    warehouse_id,
    warehouse_name,
    quantity,
    cost_value,
    credit_note_number,
    cn_total,
    compensation_status,
    compensated_amount,
    (cost_value - COALESCE(compensated_amount, 0)) AS pending_claim_value,
    event_date,
    grn_id,
    reference_doc_no
FROM public.inventory_dispositions
WHERE compensation_status IN ('pending', 'partial')
ORDER BY event_date DESC;

CREATE OR REPLACE VIEW public.v_free_issue_cost_monthly AS
SELECT
    left(event_date, 7) AS year_month,
    disposition_type,
    sum(quantity) AS total_cases,
    sum(cost_value) AS total_cost
FROM public.inventory_dispositions
WHERE disposition_type IN ('free_near_expiry', 'scheme_free_issue')
GROUP BY left(event_date, 7), disposition_type
ORDER BY year_month DESC;

CREATE OR REPLACE VIEW public.v_writeoff_cost_monthly AS
SELECT
    left(event_date, 7) AS year_month,
    disposition_type,
    sum(quantity) AS total_cases,
    sum(cost_value) AS total_cost
FROM public.inventory_dispositions
WHERE disposition_type IN ('expired_writeoff', 'damage_writeoff')
GROUP BY left(event_date, 7), disposition_type
ORDER BY year_month DESC;

CREATE OR REPLACE VIEW public.v_batch_disposition_impact AS
SELECT
    d.batch_id,
    d.batch_number,
    d.product_id,
    max(d.product_name) AS product_name,
    d.warehouse_id,
    max(d.warehouse_name) AS warehouse_name,
    max(d.expiry_date) AS expiry_date,
    max(d.supplier_invoice_no) AS supplier_invoice_no,
    count(*) AS event_count,
    sum(d.quantity) AS disposed_qty,
    sum(d.cost_value) AS disposed_cost
FROM public.inventory_dispositions d
WHERE d.batch_id IS NOT NULL OR d.batch_number IS NOT NULL
GROUP BY d.batch_id, d.batch_number, d.product_id, d.warehouse_id
ORDER BY disposed_cost DESC;

CREATE OR REPLACE VIEW public.v_all_supplier_credit_activity AS
SELECT
    'disposition'::text AS source,
    d.id AS source_id,
    d.supplier_name,
    d.credit_note_number,
    d.credit_note_date,
    d.cn_taxable_value AS taxable_value,
    d.cn_cgst AS cgst,
    d.cn_sgst AS sgst,
    d.cn_igst AS igst,
    d.cn_total AS total_amount,
    d.compensated_amount AS actual_amount,
    d.compensation_status AS status,
    d.product_id,
    d.batch_number,
    d.event_date,
    d.grn_id
FROM public.inventory_dispositions d
WHERE d.credit_note_number IS NOT NULL AND d.credit_note_number <> ''
UNION ALL
SELECT
    'scheme'::text AS source,
    s.id AS source_id,
    s.supplier_name,
    s.credit_note_number,
    s.credit_note_date,
    COALESCE(s.taxable_value, 0) AS taxable_value,
    COALESCE(s.cgst, 0) AS cgst,
    COALESCE(s.sgst, 0) AS sgst,
    COALESCE(s.igst, 0) AS igst,
    s.actual_amount AS total_amount,
    s.actual_amount,
    s.status,
    s.product_id,
    NULL::text AS batch_number,
    COALESCE(s.credit_note_date, left(s.created_at::text, 10)) AS event_date,
    s.grn_id
FROM public.supplier_credit_notes s;

NOTIFY pgrst, 'reload schema';
