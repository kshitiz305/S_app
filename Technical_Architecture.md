# Technical Architecture & Prototype Starter

> How to actually prevent overselling for shared-pool / BOM inventory on Shopify — incl. a code scaffold for the validation function. Researched against shopify.dev (2026-06-27). See `SHOPIFY_APP_PLANNING.md` §8.F for the summary.

## 1. Architecture overview

```
                    ┌──────────────────────────────┐
   Admin GraphQL    │  YOUR BACKEND (pool ledger)   │   webhooks (idempotent):
   write metafields │  - authoritative pool/BOM      │◀── orders/create
        ▲           │  - recompute availability      │    refunds/create
        │           │  - reconciliation job          │    orders/cancelled
        │           └──────────────┬───────────────┘
        │                          │ writes
        │                          ▼
   ┌────┴───────────────────────────────────────┐
   │  Shopify metafield (per product/shop):       │
   │  pool availability + BOM config (JSON)       │
   └────┬─────────────────────────────────────────┘
        │ read at checkout (no network call needed)
        ▼
   ┌──────────────────────────────────────────────┐
   │  Cart & Checkout Validation Function (Wasm)   │  ← runs on Shopify servers,
   │  reads cart + metafield → BLOCK if cart>pool  │    blocks checkout incl.
   └──────────────────────────────────────────────┘    Shop Pay/Apple/Google Pay
```

**Why this shape (the constraints that force it):**
- Validation Functions work on **ALL plans (incl. Basic) when distributed as a PUBLIC app** (custom apps need Plus).
- Function **network access (`fetch`) is enterprise-only** → cannot call backend live on Basic → **must read metafields**. Shopify recommends metafields anyway (faster, durable).
- Therefore: backend keeps the truth and pushes availability into metafields *before* checkout; the function reads metafields + cart and blocks.

## 2. Data model (metafields)

Store on the **shared-pool anchor** (a product or shop-level metafield), namespace `$app:inventory`:
```json
// metafield key: "pool"  (type: json)
{
  "poolId": "pool_white_tshirt",
  "available": 50,                       // units in the shared pool (kept fresh by backend)
  "unit": "each",                        // or "oz", "ml", etc. (fractional supported)
  "members": [                            // variants/products that draw from this pool
    { "variantId": "gid://shopify/ProductVariant/111", "consumes": 1 },
    { "variantId": "gid://shopify/ProductVariant/222", "consumes": 1 }
  ]
}
// For BOM: a product's "recipe" metafield lists components + qty each; available = min over components.
```

## 3. Validation function — input query (GraphQL)
Request only what you need (perf matters — there's an instruction/time budget):
```graphql
query Input {
  cart {
    lines {
      quantity
      merchandise {
        ... on ProductVariant {
          id
          product {
            # pool/BOM config + current availability, pushed by your backend
            poolMeta: metafield(namespace: "$app:inventory", key: "pool") { value }
          }
        }
      }
    }
  }
}
```

## 4. Validation function — run logic (pseudo-JS)
```js
// src/run.js  (Shopify Functions, JS via Javy — or Rust)
export function run(input) {
  const errors = [];
  const demandByPool = {};           // poolId -> total units demanded by this cart

  for (const line of input.cart.lines) {
    const meta = line.merchandise?.product?.poolMeta?.value;
    if (!meta) continue;
    const pool = JSON.parse(meta);
    const member = pool.members.find(m => m.variantId === line.merchandise.id);
    const consumes = member ? member.consumes : 0;
    demandByPool[pool.poolId] = (demandByPool[pool.poolId] || 0)
      + line.quantity * consumes;
    demandByPool[`__avail_${pool.poolId}`] = pool.available;
  }

  for (const key of Object.keys(demandByPool)) {
    if (key.startsWith("__avail_")) continue;
    const available = demandByPool[`__avail_${key}`];
    if (demandByPool[key] > available) {
      errors.push({
        localizedMessage: `Only ${available} left in stock for this item.`,
        target: "$.cart",
      });
    }
  }
  return { operations: [{ validationAdd: { errors } }] };
}
```
> Exact result shape follows the current **Cart and Checkout Validation Function API** — verify field names against shopify.dev when scaffolding.

## 5. Backend responsibilities
- **Webhooks (idempotency keys to dedupe retries):** `orders/create`, `refunds/create`, `orders/cancelled`, `fulfillments/*`. On each, recompute pool availability and **write the metafield** via Admin GraphQL `metafieldsSet`.
- **Reconciliation job:** periodically recompute from source of truth and self-heal drift.
- **Buffer/safety stock:** subtract a configurable buffer from `available` to absorb the metafield-freshness window.

## 6. The residual race + mitigations
Metafields are only as fresh as the last write, so two simultaneous *different-variant* checkouts could each pass but jointly exceed the pool. Mitigate:
1. **Buffer stock** (simple, effective).
2. **Reconciliation** to catch & correct fast.
3. **"Hidden component product" pattern** (strongest): map the pool onto ONE tracked component SKU and let **Shopify's native atomic per-variant reservation** ("hold inventory at checkout") guard the real stock. The function/metafield layer handles display + multi-component BOM.

## 7. Prototype setup (run on a Shopify dev store / Partner account)
```bash
# 1. Create a Partner account + development store (partners.shopify.com)
# 2. Scaffold the app + function
npm init @shopify/app@latest
cd <app>
shopify app generate extension --template cart_checkout_validation
# 3. Edit the input query (§3) + run logic (§4)
# 4. Define the metafield + a basic admin UI (function-settings component)
# 5. Run locally against your dev store
shopify app dev
# 6. Seed a product's $app:inventory.pool metafield, add variants to the pool,
#    then test: add more to cart than the pool allows -> checkout should block.
# 7. Load-test: simulate concurrent checkouts to validate buffer + reconciliation.
```

## 8. Open technical validations (do these first)
- [ ] Confirm validation function **blocks express checkouts** (Shop Pay/Apple/Google) on a Basic dev store.
- [ ] Confirm metafield read latency inside the function is acceptable under the instruction budget.
- [ ] Stress-test the residual race; tune buffer size + reconciliation interval.
- [ ] Verify the "hidden component product" reservation actually leverages native checkout hold.

## Sources
shopify.dev/docs/api/functions/latest/cart-and-checkout-validation · /docs/apps/build/checkout/cart-checkout-validation · /docs/apps/build/functions/network-access · shopify.engineering/scaling-inventory-reservations
