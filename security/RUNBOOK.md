# Closing the open database and API - staged runbook

What exists now (server sign-in is ON by default; production refuses to start without APP_SESSION_SECRET, an owner login and the Supabase settings):
- Server sign-in with signed 12-hour session tokens (`server-auth.ts`), PIN checked ON THE SERVER with a lock after 5 wrong tries.
- Every /api route needs a valid token (health and the sign-in routes stay public). `API_AUTH_REQUIRED=false` exists for a developer machine only and is refused in production.
- Salesman logins follow an allow-list (bills, payments, trip returns, own records); everything else is owner-only, and reads are filtered to the salesman's own records.
- Salesman PINs are stored as scrypt hashes with a random salt per salesman; old hashes upgrade at the next sign-in. Set a PIN again for anyone who has not signed in since.
- Salesmen can never change salesmen or settings; they never receive PIN hashes; the old "send a hash" PIN route is switched off.
- The app attaches the session automatically to every /api call and signs the user out if the server ends the session.
- `lock-down-rls.sql` removes the "anyone" database policies (needs staging first).

## Step 1 - server settings (Render / your host)
```
APP_SESSION_SECRET=<32+ random characters>      # e.g. run: openssl rand -hex 32
ADMIN_PASSWORD=<a strong password only you know>  # lets you sign in as admin through the server
SUPABASE_SERVICE_ROLE_KEY=<from Supabase > Project settings > API>   # server only, never in the app
# do NOT set API_AUTH_REQUIRED yet
```
Deploy. Check `https://<your-app>/api/auth/status` shows `sessionsEnabled: true, adminLoginEnabled: true`.

## Step 2 - test sign-in with enforcement still OFF
Sign in as admin (user `admin`, your ADMIN_PASSWORD) and as a salesman. Both should work; salesmen now sign in through the server.

## Step 3 - switch enforcement on
Set `API_AUTH_REQUIRED=true` and redeploy. Check: opening `/api/bills` in a browser without signing in shows "Sign in required".
Test the whole day: billing, payments, GRN, trips, salesman phone. If anything fails, remove `API_AUTH_REQUIRED` to go back at once.

## Step 4 - the database itself (STAGING copy first; do not run on production yet)
The browser still talks to the database directly with the public key (`src/lib/supabase/*`). Steps 1-3 protect only the `/api` routes.

**Check where you stand any time:** `SUPABASE_URL=... SUPABASE_ANON_KEY=... node security/check-rls.mjs` writes and removes one harmless row
and says OPEN or LOCKED.

**What breaks the moment `lock-down-rls.sql` is run** (these have no Supabase Auth session, so the database refuses them):

| Who / what | Why it stops | Needed first |
|---|---|---|
| Salesman phones | They sign in through the server and hold only a server token | Salesman reads and writes must go through `/api` routes |
| Owner who signs in as `admin` + `ADMIN_PASSWORD` | Same: a server token, not a Supabase session | Sign in with the Supabase email login instead, or move the owner's calls behind `/api` too |
| The GitHub Pages build (`isStaticDeployment()`) | Saves go straight from the browser to Supabase by design | A server for that build (`VITE_API_BASE_URL`) and routes for every collection |
| Pull / sync (`ledgerSync.ts`, 32 direct calls), inventory and settings (`inventoryAndSettings.ts`, 39), tombstones (14), activity logs (6) | All use the browser client | Server routes for each, then switch the client over one module at a time |

So the lock-down is the LAST step of a code change, not a switch: move the modules above behind the server one by one (the server already has
routes for most collections), test the full salesman day on staging after each, and only then run the SQL.

**When you do run it** (staging first):
1. Edit step 0 of `lock-down-rls.sql` so your own email is in `public.app_admins`. The script stops if the list is empty.
2. Run the script, then `node security/check-rls.mjs` (it should say LOCKED), then test a full day on every role.
3. Undo if needed: `security/undo-lock-down-rls.sql`.

What changed in the script: access is limited to the emails in `public.app_admins` (before, ANY signed-in user could read everything, including a
stranger who signs up if email sign-ups are on); the public key also loses sequences and functions, and tables created later.

## Also
- Rotate the Gemini key that was in `.env.example`, and consider rotating the Supabase keys (they were in the shared files).
- Remove `VITE_LOCAL_ADMIN_PASSWORD` from production builds once the server sign-in works (anything `VITE_` is readable inside the app).
- Salesman PINs are 4-6 digits: the server now limits guessing, but use 6 digits for new salesmen.
