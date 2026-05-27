# Google OAuth — Implementation Plan

**Project:** `intel-ignite-pro` (YesLiv)
**Date:** 2026-05-27
**Status:** Approved — ready to implement
**Related:** [STRIPE-GOOGLE-OAUTH-PLAN.md](STRIPE-GOOGLE-OAUTH-PLAN.md) Phase 6 (this supersedes that section)

---

## Goal

Users can sign up and log in with Google at **https://dev-livapp.vercel.app**, and the downstream flows (anonymous onboarding → signup → Stripe checkout; existing-user login → dashboard) continue to work transparently.

**Project ref:** `zfscbxwisoikeqxwxwkw` (current active Supabase project)
**Approach:** Supabase handles the OAuth dance end-to-end. Work is on each side: Google Cloud Console config, Supabase Dashboard config, and frontend integration. No backend code, no migrations.

---

## Confirmed design decisions

| Decision | Choice |
|---|---|
| Button placement | **Single button at top of card**, shared by login + signup tabs (Google doesn't distinguish; matches Supabase docs and Google branding guidelines) |
| `prompt: 'consent'` query param | **Keep during staging/testing**, drop for production polish |
| Staging Site URL | `https://dev-livapp.vercel.app` |

---

## Phase 0 — Google Cloud Console (one-time, manual)

| # | Action | Where |
|---|---|---|
| 0.1 | Create / select a project | console.cloud.google.com |
| 0.2 | OAuth consent screen → **External** → fill App name (`YesLiv`), support email, developer email, app domain `dev-livapp.vercel.app` | APIs & Services → OAuth consent screen |
| 0.3 | Add scopes: `userinfo.email`, `userinfo.profile`, `openid` | Same page, "Scopes" step |
| 0.4 | Add test users — every email that will sign in during staging (consent stays "In testing", capped at 100 users) | Same page, "Test users" |
| 0.5 | Create credentials → **OAuth 2.0 Client ID** → Application type: **Web application** | APIs & Services → Credentials |
| 0.6 | Authorized JavaScript origins: `https://dev-livapp.vercel.app`, `http://localhost:8080`, `http://localhost:5173` | Same form |
| 0.7 | Authorized redirect URI: `https://zfscbxwisoikeqxwxwkw.supabase.co/auth/v1/callback` (exactly this — Supabase's callback, not ours) | Same form |
| 0.8 | Copy **Client ID** and **Client Secret** — secret shown only once | Modal after Create |

---

## Phase 1 — Supabase Auth config

| # | Action |
|---|---|
| 1.1 | Dashboard → Authentication → Providers → **Google** → toggle Enable |
| 1.2 | Paste Client ID + Client Secret from Phase 0 → Save |
| 1.3 | Authentication → URL Configuration → **Site URL** = `https://dev-livapp.vercel.app` |
| 1.4 | URL Configuration → **Redirect URLs allow list** — add: `https://dev-livapp.vercel.app/**`, `http://localhost:8080/**`, `http://localhost:5173/**` |
| 1.5 | (Optional but recommended) Authentication → Settings → confirm email confirmation behavior matches existing email/password flow |

The Google "Skip nonce check" toggle should stay **off** (default). Nothing changes in `supabase/config.toml` — providers are configured in the hosted dashboard, not in code.

---

## Phase 2 — Frontend changes

### 2a. Extract `ensureUserRow` helper

**New file:** `src/services/users.ts`

Currently, logic for creating/updating the `public.users` row after auth is duplicated across [Auth.tsx](src/pages/Auth.tsx), [Dashboard.tsx](src/pages/Dashboard.tsx), and [onboardingAnonStorage.ts](src/lib/onboardingAnonStorage.ts). For Google OAuth, the user metadata shape differs from email/password signup (Google returns `name`, `picture`, `email_verified`; our signup form returns just `name`). The helper accepts a Supabase `User` object and writes the right fields.

Signature:
```ts
export async function ensureUserRow(user: User): Promise<{ created: boolean; row: UsersRow }>
```

Logic:
- Select `public.users` by `id`
- If row exists → update `name`/`avatar_url` from user_metadata if missing (don't overwrite user-set values)
- If not exists → insert with sensible defaults (`onboarding_completed: false`, fields from metadata)

### 2b. Google button in [src/pages/Auth.tsx](src/pages/Auth.tsx)

Single button at the **top of the card**, above the login/signup tabs:

```
┌─────────────────────────────────┐
│   [ G  Continuar com Google ]   │
│   ─────────── ou ───────────    │
│   [ Entrar ] [ Criar Conta ]    │
│      <email/password tabs>       │
└─────────────────────────────────┘
```

Google doesn't differentiate signup vs login at the OAuth layer — `signInWithOAuth` works for both. New users get created automatically; existing users (matched by email) get a session.

Handler — must preserve the existing `returnTo` query param convention used by PricingScreen:

```ts
const returnTo = searchParams.get('returnTo') ?? '/dashboard';

const handleGoogleSignIn = async () => {
  setLoading(true);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) {
    toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setLoading(false);
  }
};
```

**Google logo:** inline 4-color SVG of the official "G" — Lucide doesn't have a brand-faithful version. ~14 lines of JSX, drop into a `GoogleIcon` component near the top of Auth.tsx or as a separate file.

**Note on `prompt: 'consent'`:** keep for staging so every signin shows the consent screen (easier debugging). Remove for production launch so returning users skip the unnecessary screen.

### 2c. New page: `src/pages/AuthCallback.tsx`

Users land here after Supabase finishes the OAuth handshake. Supabase processes the code at its own `/auth/v1/callback`, sets the session in localStorage, then forwards the user to whatever was passed as `redirectTo` — which is our `/auth/callback` page with the `returnTo` param preserved.

Flow:
1. Show existing loading spinner component
2. `supabase.auth.getSession()` — should already be populated by the SDK
3. If session missing → wait briefly, retry once, then redirect `/auth?reason=oauth_failed`
4. Call `ensureUserRow(user)` from the new helper
5. Decide destination:
   - If `localStorage.getItem('yesliv_pending_plan_v1')` is set → `/onboarding/finish` (existing logic handles the Stripe redirect — works for free)
   - Else if `users.onboarding_completed === false` → `/onboarding`
   - Else → `returnTo` query param (defaults to `/dashboard`)

Page exists purely to bridge Supabase's session-set with our app's user-state setup. No UI beyond a loader.

### 2d. Register `/auth/callback` in [src/App.tsx](src/App.tsx)

```tsx
const AuthCallback = lazyRetry(() => import('./pages/AuthCallback'));
// ...
<Route path="/auth/callback" element={<AuthCallback />} />
```

Public route — no `ProtectedRoute` wrapper, because the user is mid-authentication when they land here.

---

## Phase 3 — Edge cases

| Scenario | Handling |
|---|---|
| User cancels at Google consent screen | Supabase redirects back to `/auth?error=access_denied` → existing toast pattern handles this |
| Email/password user signs in with Google using same email | Supabase auto-links by default (single `auth.users` row, multiple `auth.identities` rows). Existing onboarding state preserved. |
| Google account has no verified email | Supabase blocks — `signInWithOAuth` returns error. Rare; surface in toast. |
| User picked a plan, then signed up with Google → must continue to Stripe Checkout | Works automatically: AuthCallback routes through `/onboarding/finish`, which reads `yesliv_pending_plan_v1` and calls `startCheckout` |
| Session expired by the time user clicks email confirmation | Google flow doesn't use email confirmation. N/A. |
| Incognito / 3rd-party cookies blocked | Supabase v2.x uses PKCE flow by default — no 3rd-party cookies needed. Should work. |
| 100-test-user cap reached | Submit consent screen for verification (Google takes 1–6 weeks). Before then, anyone not in test users list gets blocked at Google. |

---

## Phase 4 — Files to create / modify

**New files (2):**
- `src/services/users.ts` — `ensureUserRow(user)` helper
- `src/pages/AuthCallback.tsx` — post-OAuth landing page

**Modified files (2):**
- [src/pages/Auth.tsx](src/pages/Auth.tsx) — add Google button, handler, separator, `returnTo` passthrough
- [src/App.tsx](src/App.tsx) — lazy import + `/auth/callback` route

**No backend changes.** No migrations, no edge functions, no `supabase/config.toml` edits.

---

## Phase 5 — Verification (staging)

Run all 7 paths in order on https://dev-livapp.vercel.app:

| # | Path | Expected result |
|---|---|---|
| 1 | Anonymous → "Continuar com Google" from login screen | Lands on `/dashboard` (existing user) or `/onboarding` (new user) |
| 2 | Anonymous → "Continuar com Google" from signup screen | Same as #1 |
| 3 | Anonymous → start onboarding → answer questions → PricingScreen → pick plan → Google signup | Lands on Stripe Checkout (via `/onboarding/finish` chain) |
| 4 | Cancel at Google consent screen | Returns to `/auth?error=...` with toast |
| 5 | Existing email/password user → "Continuar com Google" with same email | Logs in; same `users.id`; `auth.identities` has both providers |
| 6 | Log out → log back in via Google | Same session works |
| 7 | Sign up with Google, complete onboarding, log out, sign back in | Lands directly on `/dashboard` (no re-onboarding) |

**SQL check after #5:**
```sql
select id, email from auth.users where email = 'test@example.com';
select user_id, provider, identity_data->>'email' from auth.identities where user_id = '<id>';
-- Should see entries for both 'google' and 'email'
```

---

## Estimated effort

| Phase | Effort |
|---|---|
| 0. Google Cloud Console config | 30 min |
| 1. Supabase Auth config | 15 min |
| 2a. `ensureUserRow` helper + refactor existing duplicates | 1.5 h |
| 2b. Auth.tsx button + handler + Google SVG | 1 h |
| 2c. AuthCallback page | 1 h |
| 2d. App.tsx route registration | 5 min |
| 5. Test all 7 paths | 1.5 h |
| **Total** | **~5 hours** |

---

## Out of scope

- **Production verification** — moving consent screen out of "Testing" requires Google review (1–6 weeks). Plan separately when close to public launch.
- **Other providers** (Apple, Facebook, GitHub) — same pattern; could add later by duplicating Phase 1.2 + Phase 2b's button.
- **Profile picture sync from Google** — `picture` URL in user_metadata. `ensureUserRow` should populate `users.avatar_url` from it only if user hasn't manually changed their avatar (lightweight, included in helper design).
- **Google One Tap** sign-in (inline credential prompt) — different SDK, more complex. Not v1.
- **Account unlinking UI** — letting users disconnect Google. Stripe-portal-style management. Out of scope.

---

## Execution order

1. **Phase 0** — Google Cloud Console (blocking, manual)
2. **Phase 1** — Supabase Auth config (blocking, manual)
3. **Phase 2a** — `ensureUserRow` helper (refactor)
4. **Phase 2b** — Auth.tsx Google button + handler
5. **Phase 2c** — AuthCallback page
6. **Phase 2d** — App.tsx route
7. **Type check** — `npx tsc --noEmit`
8. **Phase 5** — manual test all 7 paths in staging
9. **Production polish** — remove `prompt: 'consent'` when launching publicly; submit consent screen for verification

---

## Approval

- [x] Top-of-card single button placement
- [x] `prompt: 'consent'` during testing only
- [x] Site URL `https://dev-livapp.vercel.app` confirmed
- [x] Approved to implement
