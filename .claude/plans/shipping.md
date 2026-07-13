# Ship Plan: myanmardev.com

## Goal
Fix all critical bugs, make products dynamic (Firestore-backed), ensure token economy works end-to-end, and polish for production ship — all in parallel.

---

## Stream 1: Fix Worker + Token Economy (CRITICAL)

### Files to modify:
- `worker/src/index.ts` — Fix double deduction, add rollback, add `/api/products` endpoint
- `worker/src/auth.ts` — Fix race condition in `deductTokens`, add `refundTokens()`
- `src/components/SubdomainBuilder.tsx` — Remove client-side `deductTokens()` call

### Changes:

**A. Remove double token deduction in SubdomainBuilder.tsx:**
```typescript
// REMOVE lines 248-250:
// const deducted = await deductTokens(profile.uid, TOKEN_COST);
// if (!deducted) throw new Error('Insufficient tokens...');
// The worker already deducts tokens server-side via /api/create-subdomain
```

**B. Fix worker token deduction (auth.ts):**
- Keep atomic increment but add a safety check: after increment, if balance < 0, refund immediately
- Add `refundTokens()` function for rollback scenarios

**C. Add DNS rollback in index.ts:**
- If TXT record creation fails after CNAME succeeds → delete CNAME + refund tokens
- Wrap in try/catch with proper cleanup

**D. Add `/api/products` GET endpoint to worker:**
- Returns product catalog from Firestore (public read, cached)
- Admin can manage via Firestore directly (existing rules already allow admin write)

---

## Stream 2: Dynamic Products System

### Firestore data model for `products` collection:
```typescript
{
  id: string;              // auto-generated
  name: string;            // "Subdomain Registration"
  slug: string;            // "subdomain"
  description: string;     // Short description
  features: string[];      // ["Instant DNS", "Free SSL", ...]
  priceUSD: number;        // 2.50
  priceMMK: number;        // 10000
  tokenCost: number;       // 10
  status: 'live' | 'comingsoon';
  category: string;        // "dns" | "hosting" | "portfolio"
  icon: string;            // emoji or icon name
  sortOrder: number;       // display order
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Files to create/modify:
- `src/lib/products.ts` — CRUD functions for products (Firestore)
- `src/components/admin/ProductsManager.tsx` — Admin UI to manage products
- `src/components/Products.astro` —改成从 Firestore 动态读取 products
- `src/components/ProductCard.astro` — Accept product data as props
- `firestore.rules` — Add products collection rules (admin write, public read)
- `src/pages/[lang]/admin/products.astro` — Admin products page

### Admin Product Management UI:
- Table view of all products
- Create/Edit modal with fields: name, slug, description, features, prices, status, icon
- Drag-to-reorder (sortOrder)
- Toggle live/comingsoon status
- Delete with confirmation

---

## Stream 3: Polish + Integration

### Files to modify:
- `src/components/BuyTokensModal.tsx` — Simplify to redeem-code-only flow
- `src/components/MySubdomains.tsx` — Add delete button, fix hardcoded domain
- `worker/src/index.ts` — Add CORS credentials, basic rate limiting headers
- `src/lib/api.ts` — Fix hardcoded domain, use env var

### Changes:

**A. Simplify BuyTokensModal:**
- Since user wants redeem codes as primary, make the modal show: "Enter Redeem Code" as primary action
- Keep package display for reference but flow is: enter code → tokens added instantly

**B. MySubdomains improvements:**
- Add "Delete" button per subdomain (calls worker DELETE endpoint)
- Fix hardcoded `.myanmardev.com` → use configurable domain

**C. Worker CORS fix:**
- Add `Access-Control-Allow-Credentials: true`
- Add basic rate limiting via `CF-RateLimit-Limit` headers

**D. API URL fix:**
- `src/lib/api.ts` already uses `PUBLIC_WORKER_API_URL` env var — verify it's set correctly in deploy

---

## Execution Plan (Parallel Agents)

### Agent 1: Worker + Token Economy Fix
- Fix `worker/src/auth.ts` (refundTokens, race condition)
- Fix `worker/src/index.ts` (rollback, products endpoint, admin stubs)
- Fix `src/components/SubdomainBuilder.tsx` (remove double deduction)

### Agent 2: Dynamic Products System
- Create `src/lib/products.ts`
- Create `src/components/admin/ProductsManager.tsx`
- Update `firestore.rules` for products
- Create admin products page
- Update Products.astro to be dynamic

### Agent 3: Polish + Integration
- Keep BuyTokensModal with ALL payment options (MMK, crypto, redeem codes) — just ensure redeem codes work as primary
- Fix MySubdomains (delete button, configurable domain)
- Fix CORS headers in worker
- Fix api.ts hardcoded domain
- Final integration testing

---

## Verification

After all agents complete:
1. `pnpm build` — ensure no compile errors
2. `cd worker && npx tsc --noEmit` — ensure worker compiles
3. Manual test flow: Sign in → Redeem code → Get tokens → Create subdomain → DNS records created
4. Admin test: Sign in as admin → Manage products → Products appear on homepage
5. Security check: Verify Firestore rules, no double charges, rollback works
