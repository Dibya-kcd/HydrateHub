-- ================================================================
-- 018 - Payment reversals
-- A recorded payment is never deleted: it is reversed with a new row of the opposite amount that points at the original.
-- Additive and idempotent. Run it before the first reversal if you want reversals to appear in public.payments
-- (until then they still save in app_collections and sync normally).
-- ================================================================
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reversal_of TEXT;
CREATE INDEX IF NOT EXISTS idx_payments_reversal_of ON public.payments(reversal_of);
