-- ============================================================================================
-- LOCK DOWN THE DATABASE  (NOT applied automatically - read security/RUNBOOK.md first)
--
-- Today every table has an "allow everything" policy and the app ships the public key, so anyone who finds the app
-- URL can read or change bills, customers and payments. This script removes those policies and lets ONLY the owner
-- emails listed in public.app_admins (signed in with Supabase Auth) - plus the server's service-role key, which always
-- bypasses RLS - reach the data.
--
-- Compared with the first version: "any signed-in user" is no longer enough. If email sign-ups are switched on in
-- Supabase Auth, a stranger could create an account and would have been let in. Now the email must be on the list.
--
-- BEFORE YOU RUN IT (on a STAGING copy first):
--   1. Put your admin email(s) in the list (step 0 below). The script stops if the list is empty, so it cannot lock you out.
--   2. The server must have SUPABASE_SERVICE_ROLE_KEY and API_AUTH_REQUIRED=true must work for you.
--   3. Read the "What breaks" table in security/RUNBOOK.md: salesmen, and an owner who signs in with the server password,
--      have NO Supabase session, so anything the app still does directly against the database from their devices stops.
--   4. Check afterwards with:  node security/check-rls.mjs
-- To undo, run security/undo-lock-down-rls.sql.
-- ============================================================================================

-- 0. Who may use the database from the browser. EDIT THE EMAIL(S) BELOW before running.
CREATE TABLE IF NOT EXISTS public.app_admins (email text PRIMARY KEY);
-- INSERT INTO public.app_admins (email) VALUES ('owner@example.com') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_app_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_admins a
    WHERE lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

-- 1. Policies: only listed admins. (app_admins itself gets no policy: only the server can read or change it.)
DO $$
DECLARE t record; p record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_admins) THEN
    RAISE EXCEPTION 'public.app_admins is empty. Add your admin email first (see step 0) or you would lock yourself out.';
  END IF;

  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t.tablename);
    END LOOP;
    IF t.tablename <> 'app_admins' THEN
      EXECUTE format(
        'CREATE POLICY "app_admins_only" ON public.%I FOR ALL TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin())',
        t.tablename
      );
    END IF;
  END LOOP;
END $$;

-- 2. Privileges: the public (anon) key gets nothing, now or on tables / functions created later.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
