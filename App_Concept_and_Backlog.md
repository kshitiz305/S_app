# App Concept & Feature Backlog

> The product idea, positioning, and a prioritized build backlog derived from real merchant needs (Reddit) and the incumbent's actual 1-star reviews (Connected Inventory, 3.3★).

## 1. The concept (one-liner)
**Reliable shared-stock & bill-of-materials inventory for Shopify makers — that won't oversell, even during a flash sale, even on the Basic plan.**

## 2. Why this app (the thesis)
- **Structural Shopify gap:** inventory is per-variant only; no shared pool, no BOM. Durable — Shopify won't trivially fix it.
- **Demand is owned by a broken incumbent:** Connected Inventory (3.3★, 52 reviews) is the Reddit default but **oversells under load** — the dev literally tells customers it's "not suited for flash sales."
- **Well-rated alternatives are all tiny & fragmented** (≤51 reviews) — no dominant reliable player.
- **Captive, unhappy users** ("there is no-one else offering this service and it's essential to my business").

## 3. Positioning & differentiation (the 4 gaps = the moat)
1. 🔴 **Oversell-proof under load** — the #1 unmet need; incumbents fail here on Black Friday.
2. 🟠 **Works on Basic plan** — variant-linking is locked natively on Basic; small makers excluded.
3. 🟠 **Doesn't break native reporting + clean exports** — top complaint about Easify/others.
4. 🟡 **Shared pool + BOM + COGS/margins in one** — today that's 2–3 tools or a $299+ ERP.

**Tagline candidates:** "Inventory that survives your busiest day." / "Shared stock & BOM that never oversells — even on Basic."

## 4. Target customer (ICP)
Small-to-mid DTC **makers/manufacturers** on Shopify (often Basic/Shopify plan) whose sellable variants/products consume shared raw materials/components.
**Lead verticals:** consumables (candles, soap, food/ingredients), POD/custom apparel, configurable goods (furniture), jewelry/charm bars, gift boxes/bundles.

## 5. Feature backlog (prioritized)

### P0 — MVP (the wedge; ship first)
- [ ] **Shared inventory pool → multiple variants/products**, consuming whole units OR fractions (e.g. ounces). *(dashowdetgetcha, dubc4, Shelby-thomas, SnooMarzipans4387)*
- [ ] **Bill-of-materials / "recipe":** finished product = N components; available qty = component that runs out first. *(PDXSCARGuy, dmitrybzns, crazycaleb2008 gift-box)*
- [ ] **Oversell-proof at checkout** via public-app **Cart & Checkout Validation Function** reading metafields (works on Basic; blocks express checkouts). *(see Technical_Architecture.md §1)*
- [ ] **Idempotent webhook ledger** (orders/create, refunds/create, orders/cancelled) keeping the pool accurate; reconciliation job.
- [ ] **Works on Basic plan** (public app distribution — confirmed).
- [ ] **Don't break native reporting**; one-click **CSV export** of orders + which variant/component sold. *(momssssspaghetti)*
- [ ] **Simple onboarding wizard** (pick products → define pool/recipe → preview → go live) — incumbents are "fiddly/confusing."

### P1 — Strong differentiators (fast-follow)
- [ ] **Buffer/safety stock** settings + oversell alerts.
- [ ] **"Hidden component product" mode** → map pool to one tracked SKU so Shopify's native atomic reservation guards stock (strongest oversell guarantee).
- [ ] **COGS / margin per item** tracking + simple profit reporting. *(Asleep-Audience1126)*
- [ ] **Cap total sales across all variants** (unmet micro-need — others only cap per-customer). *(momssssspaghetti)*
- [ ] **Audit log / change history** ("why did stock change?") — trust.
- [ ] **Low-stock notifications**.
- [ ] **Multi-location** support.
- [ ] **Bulk setup** of pools/BOM via CSV (catalogs up to 15k SKUs).
- [ ] **Responsive in-app support/chat** — explicit incumbent weakness.

### P2 — Expansion
- [ ] **External-system sync** (changes from ERP/Dear/Cin7 fed back to variant inventory). *(Connected Inventory's "useless for us" complaint)*
- [ ] **Preorder/backorder** handling at variant level with inventory triggers. *(figuringitout_parent, Feisty-Ad129)*
- [ ] **Bundle builder** compatibility (Meta/Google ad-feed safe). *(water-boi-walkin, thunderberen)*
- [ ] **Multi-channel** pool sync (Amazon/eBay/TikTok) — bigger lift, higher TAM. *(MudSad6268, AshamedComfortable13)*

## 6. Pricing (from market research)
**Free → $19 → $39 → $59/mo**, tiered by order volume.
- Free (≤100 orders/mo) — matches Material Manager, lowers friction.
- $19/$39 — proven band (Connected Inventory $9.99, Material Manager ≤$49.99).
- **$59 "Pro"** (real-time oversell protection + COGS + exports) — reaches the empty $50–$299 gap below ERPs.
- 7-day free trial (standard). Full landscape in `SHOPIFY_APP_PLANNING.md` §7.

## 7. Competitor snapshot (full teardown in SHOPIFY_APP_PLANNING.md §5.1)
| App | Rating | Reviews | Takeaway |
|---|---|---|---|
| NASP Connected Inventory | 3.3★ | 52 | TARGET — most-used, oversells under load |
| Materials Inventory | 5.0★ | 51 | Liked, small |
| Material Manager | 4.6★ | 19 | Liked, small |
| Assemblified BOM | 5.0★ | 22 | Liked, small |
| Raw Materials Inventory (soply) | 0.0★ | 0 | New entrant, same angle — move fast |

## 8. Go-to-market
- **Beachhead vertical first** (candles/soap OR food/ingredients) → focused messaging + tight-community word of mouth.
- **Design partners** from `Outreach_Prospects.md` (start with u/mactac, u/dashowdetgetcha, u/Shelby-thomas).
- **App Store SEO** keywords: "connected inventory", "bundle inventory", "bill of materials", "raw materials", "shared stock", "prevent overselling".
- **Lead all copy with the oversell pain** ("survives your busiest day") + "works on Basic, keeps your reports intact."

## 9. Risks (detail in SHOPIFY_APP_PLANNING.md §8.E)
- Shopify could extend native Bundles → go deeper (BOM, COGS, reliability, support).
- Material Manager liked + cheap → must out-differentiate on the 4 gaps.
- **Reliability is existential** — one oversell destroys trust; treat accuracy/uptime as a feature.
