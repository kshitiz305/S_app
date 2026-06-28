# DEVELOPMENT SPEC — Shopify Shared-Stock & BOM Inventory App
**Working name: "StockSentry"** (placeholder — rename freely)

> **READ THIS FIRST (for the building Claude / developer).**
> This is a self-contained build spec. You have no prior context — everything you need is here. Build a Shopify **public app** that gives merchants **shared-stock and bill-of-materials (BOM) inventory that never oversells**, even during flash sales, **even on the Basic plan**. It disrupts an incumbent (NASP Connected Inventory, 3.3★) whose core features are right but which **oversells under load, goes negative, and fails silently** — so our entire bar is *reliability + correctness*.
> Work phase by phase (§7). Each phase has a **Definition of Done (DoD)**. Do not skip testing (§8) — accuracy is existential: one oversell destroys merchant trust.

---

## 1. Product summary
A Shopify app that lets a merchant define **inventory pools** (one physical stock shared by many variants/products) and **bills of materials** (a finished product made of N components; sellable quantity = whichever component runs out first). The app keeps Shopify inventory correct in real time, **blocks checkout when a purchase would exceed true available stock**, tracks COGS/margins, and never lets inventory go negative or falsely out-of-stock.

## 2. The problem (why merchants need this)
Shopify tracks inventory **per variant only** — no shared pools, no BOM. Makers/manufacturers whose variants consume shared raw materials hit this constantly. The leading existing app oversells during high traffic and corrupts counts. Merchants (often on the **Basic** plan) are stuck.

## 3. Target users
Small-to-mid DTC **makers/manufacturers**: candles/soap, food/ingredients (fractional units like oz/ml), POD/custom apparel (blank + decal), configurable goods (furniture: frame + fabric), jewelry/charm bars, gift boxes/bundles. Often on **Basic/Shopify** plans, cost-sensitive, non-technical.

## 4. NON-NEGOTIABLES (the bar that beats the incumbent)
1. **Never oversell** — enforce true availability at **checkout in real time** (not slow post-order sync). Must hold during flash sales and cover express checkouts (Shop Pay, Apple Pay, Google Pay).
2. **Never go negative** — all pool math is atomic and floored at 0.
3. **Never false-OOS / no "tug-of-war"** — calculations are correct and respect merchant manual edits.
4. **Reliable & observable** — monitored, idempotent, self-healing via reconciliation; surfaces a clear status.
5. **Foolproof setup with a self-test** — a wizard + a "simulate an order" check that proves linking works before the merchant relies on it.
6. **Works on the Basic plan** (achieved via public-app distribution — see §5).

## 5. Architecture (how we prevent overselling)

```
 Your backend (source of truth)            Shopify
 ┌─────────────────────────────┐           ┌───────────────────────────────┐
 │ DB: pools, BOMs, ledger     │  Admin    │ metafields ($app:inventory)    │
 │ recompute availability      │──GraphQL─▶│  per anchor product/shop:      │
 │ idempotent webhook handlers │  write    │  { available, members[] }      │
 │ reconciliation job          │           └───────────────┬───────────────┘
 └──────────────▲──────────────┘                           │ read at checkout
      webhooks   │ orders/create, refunds/create,          ▼
      (idempotent) orders/cancelled, fulfillments  ┌────────────────────────────────┐
                                                    │ Cart & Checkout Validation Fn  │
                                                    │ (Wasm, runs on Shopify):       │
                                                    │ cart + metafield → BLOCK if    │
                                                    │ cart demand > pool available   │
                                                    └────────────────────────────────┘
```

**Why this shape (hard platform constraints — do not fight them):**
- **Validation Functions work on ALL plans (incl. Basic) ONLY if the app is PUBLIC** (App Store). Custom apps with Functions require Plus. → **Ship as a public app.**
- **Function network access (`fetch`) is enterprise-only** → the function **cannot call your backend at checkout**. → It must **read metafields**. (Shopify officially recommends metafields anyway: faster, durable.)
- Therefore: backend is the source of truth and **pushes availability into metafields before checkout**; the function reads metafield + cart and blocks.
- **Residual race** (two simultaneous different-variant checkouts each within pool but jointly over): close with **buffer/safety stock**, **reconciliation**, and the optional **"hidden component product" pattern** (map a pool to one tracked SKU so Shopify's native atomic reservation guards it).

## 6. Tech stack & prerequisites
- **Shopify Partner account** + a **development store** (partners.shopify.com). *(The human owner provides this; you can't create it.)*
- **App framework:** Shopify's **Remix app template** (Node.js) via Shopify CLI.
- **DB + ORM:** Prisma. SQLite for dev; **Postgres** for prod (sessions + pool/BOM/ledger tables).
- **Admin UI:** **Polaris** (React) + **App Bridge** (embedded app).
- **Functions:** Shopify Functions — **Rust** (recommended for performance) or JS via Javy. Extension template: `cart_checkout_validation`.
- **Admin API:** GraphQL Admin API (REST is deprecated for products/variants). Use `metafieldsSet`, `inventoryAdjustQuantities`, `productVariantsBulkUpdate`.
- **Billing:** Shopify **Billing API** (mandatory; no external billing).
- **Hosting:** Fly.io / Railway / Render (needs a persistent Node server + Postgres + reliable webhook ingestion).
- **Observability:** structured logging + error tracking (e.g. Sentry) + a job runner/queue for webhooks & reconciliation (e.g. BullMQ/Redis or a managed queue).

## 7. STEP-BY-STEP BUILD PLAN
> Do phases in order. Commit per step. Each phase ends with a **DoD**.

### Phase 0 — Project setup
1. `npm init @shopify/app@latest` → choose **Remix**, TypeScript.
2. Configure `shopify.app.toml`: app name, scopes = `read_products,write_products,read_inventory,write_inventory,read_orders,read_merchant_managed_fulfillment_orders`. Add later scopes as needed.
3. Set up Prisma with Postgres; run the default Shopify session table migration.
4. `shopify app dev` and install on the dev store; confirm the embedded app loads (Polaris welcome page).
- **DoD:** app installs on the dev store, OAuth works, embedded admin renders.

### Phase 1 — Data model (DB)
Create Prisma models:
1. `Pool` — id, shopId, name, unit (`each`|`oz`|`ml`|…), totalOnHand (int/decimal), buffer (int, default 0), anchorProductId (the product holding the metafield).
2. `PoolMember` — id, poolId, variantId (GID), consumesPerUnit (decimal, e.g. 1, or 0.5).
3. `Bom` — id, shopId, finishedVariantId, name.
4. `BomComponent` — id, bomId, componentRef (a Pool or a tracked variant), qtyPerFinished.
5. `LedgerEntry` — id, shopId, poolId, delta, reason (`order`|`refund`|`cancel`|`manual`|`reconcile`), sourceId (orderId etc.), createdAt. **Used for idempotency + audit log.**
6. `WebhookEvent` — id, shopId, topic, shopifyEventId (UNIQUE — idempotency key), processedAt.
- **DoD:** migrations run; can CRUD pools/BOMs in a Prisma test.

### Phase 2 — Pool/BOM config + admin UI (Polaris, embedded)
1. **Pools list page** — searchable, filterable, sortable table (fix the incumbent's UI complaints; **preserve state on back-nav**). Columns: pool name, unit, on-hand, members, status.
2. **Create/Edit Pool** — pick member variants (product picker via App Bridge ResourcePicker), set consumesPerUnit, totalOnHand, buffer.
3. **BOM builder** — define a finished variant = list of components (pool or variant) × qty.
4. On save: write the pool config + computed availability to a **metafield** on the anchor product (namespace `$app:inventory`, key `pool`, type `json`) via `metafieldsSet`, AND set member variants' Shopify inventory to the computed available (via `inventoryAdjustQuantities`).
- **DoD:** create a pool of 2 variants sharing 50 units; both variants show 50 available in Shopify; metafield is populated.

### Phase 3 — Webhooks + ledger (keep stock correct)
1. Subscribe to webhooks: `orders/create`, `refunds/create`, `orders/cancelled`, `fulfillments/create` (+ mandatory compliance webhooks, Phase 8).
2. **Idempotent handler:** on each event, check `WebhookEvent.shopifyEventId`; if seen, ack and skip. Otherwise process in a **queue/worker** (don't block the webhook response; ack fast).
3. On `orders/create`: for each line that belongs to a pool/BOM, compute consumption, write a `LedgerEntry`, recompute pool `available = totalOnHand − Σconsumed − buffer` (**floored at 0, never negative**), then push new availability to the **metafield** and update member variants' Shopify inventory.
4. On `refunds/create` / `orders/cancelled`: reverse the consumption (restock the pool **and both sides of shared/composite items** — a known incumbent gap).
5. **Respect manual edits:** if a merchant manually changes inventory in Shopify, don't fight it — reconcile by treating manual change as a `totalOnHand` adjustment (config option), never overwrite in a loop.
- **DoD:** place a test order for variant A in a shared pool → variant B's available drops correctly; refund → both restock; replay the same webhook → no double-count.

### Phase 4 — Cart & Checkout Validation Function (THE moat: real-time oversell block)
1. `shopify app generate extension --template cart_checkout_validation`.
2. **Input query** — request cart lines, merchandise variant id, and the product's pool metafield:
   ```graphql
   query Input { cart { lines { quantity merchandise { ... on ProductVariant {
     id product { poolMeta: metafield(namespace:"$app:inventory", key:"pool"){ value } } } } } } }
   ```
3. **Run logic** — sum each cart's demand per pool (quantity × consumesPerUnit), compare to `available` from the metafield, and return a validation **error** (block checkout) if demand > available. Never rely on per-variant counts alone.
4. Build a small **function-settings admin UI** so merchants can toggle enforcement + customize the block message.
5. Deploy the function; enable it on the dev store.
- **DoD:** with pool available = 1, add 2 of variant A (or 1 of A + 1 of B sharing the pool) to cart → **checkout is blocked**, including via Shop Pay/Apple Pay. Confirm it works on a **Basic** dev store.

### Phase 5 — COGS / margins + reporting + exports
1. Add per-component cost fields; compute COGS per finished item and margin (sale price − COGS).
2. Simple dashboard: pool levels, low-stock, recent consumption, margins.
3. **CSV export** of orders with which variant/component was consumed (the incumbent breaks native reporting — we must not).
- **DoD:** dashboard shows correct margins; CSV export downloads with per-line component consumption.

### Phase 6 — Onboarding wizard + self-test (fix silent-setup failures)
1. Guided wizard: connect → pick products → define first pool/BOM → preview → activate.
2. **Self-test:** simulate an order against a pool and show the merchant the before/after numbers, proving linking works *before* they depend on it.
3. Inline help + a "health" indicator (sync OK / last reconciled / errors).
- **DoD:** a new merchant can set up a working pool in <5 minutes and see a green self-test.

### Phase 7 — Billing (Shopify Billing API)
1. Implement recurring charges via the Billing API: **Free** (≤100 orders/mo), **$19**, **$39**, **$59/mo** (tier by order volume); 7-day trial.
2. Gate features/limits by plan; handle upgrade/downgrade + trial.
- **DoD:** a test merchant can subscribe and is correctly gated; charges appear in the Partner dashboard.

### Phase 8 — Compliance & reliability
1. Implement **mandatory GDPR webhooks**: `customers/data_request`, `customers/redact`, `shop/redact`.
2. Handle app uninstall (`app/uninstalled`) → clean up.
3. Add **buffer/safety stock** per pool + a **reconciliation job** (cron) that recomputes from the ledger and self-heals drift; alert on anomalies.
4. Error tracking + structured logs + dead-letter for failed webhooks.
- **DoD:** GDPR webhooks return 200 with correct behavior; reconciliation corrects an intentionally-injected drift; failed webhooks retry.

### Phase 9 — Testing (DO NOT SKIP — accuracy is existential)
1. **Unit tests:** pool math (never negative, fractional units, buffer), BOM min-component logic, refund/cancel reversal, idempotency.
2. **Integration tests:** webhook → ledger → metafield → Shopify inventory.
3. **Concurrency/load test (critical):** simulate many simultaneous checkouts of pooled variants (incl. mixed variants from one pool) → assert **zero oversell** and **no negative inventory**. Tune buffer + reconciliation interval. This is the test the incumbent fails.
- **DoD:** concurrency test passes with zero oversell across 1000+ simulated concurrent orders.

### Phase 10 — App Store submission
1. **Built for Shopify** alignment: embedded (App Bridge/Polaris), performance, no storefront script tags (use theme app extensions if any storefront UI).
2. Listing: name, the oversell-proof + works-on-Basic + keeps-reports-intact value props, screenshots, demo store, pricing, privacy policy.
3. Submit for review; address feedback.
- **DoD:** app passes review and is listed.

## 8. Feature requirements traceability (major customer requirements → where built)
| Requirement (from customers) | Phase |
|---|---|
| Shared pool across variants (incl. fractional units) | 2, 3 |
| Bill of materials / components (qty = component that runs out first) | 2, 3 |
| **Never oversell (real-time, flash-sale-proof, express checkouts)** | 4 |
| Never go negative / no false-OOS / respect manual edits | 3 |
| Returns/cancel restock both sides | 3 |
| Works on Basic plan | 4, 5 (public app) |
| COGS / margins | 5 |
| Clean reporting + CSV export (don't break native) | 5 |
| Foolproof setup + self-test | 6 |
| Searchable/filterable admin UI that preserves state | 2 |
| Reliability, monitoring, reconciliation, audit log | 3, 8 |
| Cap total sales across variants | 4 (extend validation) |
| Low-stock alerts | 5/8 |
| External/ERP inbound sync | P2 (post-v1) |

## 9. Out of scope for v1 (do later)
Multi-channel (Amazon/eBay/TikTok) pool sync; external ERP two-way sync; multi-location advanced rules; bundle storefront builder. Keep v1 laser-focused on **reliable shared-stock + BOM + oversell prevention**.

## 10. Definition of "ready to launch"
- Concurrency test: **zero oversell** at 1000+ concurrent orders.
- Pool never goes negative; no false-OOS in a 7-day soak test.
- Setup wizard self-test passes for a fresh store in <5 min.
- Validation function blocks checkout (incl. Shop Pay/Apple Pay) on a **Basic** store.
- Billing, GDPR webhooks, reconciliation all working.

## 11. References (verify current details on shopify.dev when building)
- Cart & Checkout Validation Function API: shopify.dev/docs/api/functions/latest/cart-and-checkout-validation
- About cart/checkout validation: shopify.dev/docs/apps/build/checkout/cart-checkout-validation
- Functions network access (why metafields, not fetch): shopify.dev/docs/apps/build/functions/network-access
- Shopify Engineering — inventory reservations: shopify.engineering/scaling-inventory-reservations
- Remix app template, Polaris, App Bridge, Admin GraphQL, Billing API, GDPR webhooks: shopify.dev

## 12. Companion context (in this folder, optional reading)
- `Competitor_Review_Mining.md` — the exact incumbent failures this spec fixes.
- `App_Concept_and_Backlog.md` — positioning, pricing, prioritized backlog.
- `Technical_Architecture.md` — deeper architecture + code scaffold.
- `SHOPIFY_APP_PLANNING.md` — full market research.
- `Outreach_Prospects.md` — real merchants to validate features with.
