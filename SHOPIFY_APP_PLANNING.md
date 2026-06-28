# Shopify App Planning

> Consolidated research + plan for building a Shopify app. Compiled 2026-06-27.
> Research done via **Agent Reach** (Reddit/OpenCLI for merchant pain, Exa + Jina for competitor/pricing).
> Goal: find a validated, app-shaped problem with day-one customers, then plan the product, pricing, and build.

---

## 1. Executive summary — what to build

**Recommendation: a "Shared-Stock & Bill-of-Materials Inventory" app for makers & manufacturers.**

Shopify tracks inventory **per variant only** — it cannot let multiple variants/products draw from one shared physical stock pool, and has no native bill-of-materials (BOM). This breaks for anyone whose finished products are made from shared raw materials/components (candle makers, food/ingredients, POD apparel, furniture, jewelry, assembled goods). It's a **structural, durable** limitation (not a feature Shopify will trivially close), it recurs constantly on r/shopify with many distinct, motivated merchants, and existing solutions are cheap but clunky — leaving clear gaps.

**The winning wedge (what no competitor nails):**
1. **Oversell-proof under load** — existing webhook-based apps recalc too slowly and still oversell during traffic spikes (race condition). This is the visceral, money-losing pain.
2. **Works on the Basic plan** — variant-linking is locked on Basic; small makers are stuck.
3. **Doesn't break Shopify's native reporting / clean exports** — a top complaint about incumbents.
4. **Shared pool + BOM/components + COGS/margins in one** — today that's 2–3 tools or a $299+ ERP.

**Positioning:** *"Reliable shared-stock & bill-of-materials inventory for makers — won't oversell, even on Basic, ERP-grade reliability without the ERP price."*

**Two alternatives considered (and why #2 won):**
- **AI product import/catalog** — strongly validated but the lane is already crowded (DataEase 4.9★/1,254 reviews, Csvio, BulkFlow, Altera). Only build here if you target the unsolved *images* problem (auto-host + AI-match images to SKUs), not the generic field-mapper.
- **Returns + warranty** — plain returns saturated (Loop, AfterShip); only the *warranty-claims-with-returns* angle is a real gap.

---

## 2. The opportunity — three validated problem clusters

| # | Cluster | Verdict | Competition |
|---|---|---|---|
| 1 | AI catalog / bulk import | Validated, **crowded** | High (DataEase, Csvio, BulkFlow, Matrixify) |
| **2** | **Shared / component inventory (BOM)** | **TOP PICK — sharp, durable, underserved** | Moderate (cheap apps, clunky) |
| 3 | Returns + warranty | Niche gap only | Returns saturated; warranty open |

---

## 3. Recommended product — Shared/Component Inventory

**Who it's for (ICP):** small-to-mid DTC **makers/manufacturers** on Shopify (often Basic/Shopify plan) whose sellable variants consume shared raw materials/components. Lead verticals: **consumables (candles, soap, food/ingredients)**, **POD/custom apparel**, **furniture/configurable goods**, **jewelry**.

**Core jobs to be done:**
- One physical stock → many sellable variants/sizes, never oversold.
- Finished product = recipe of components; available qty = whichever component runs out first.
- Keep accurate counts automatically as orders, refunds, and cancellations happen.
- Know true cost/margin per item.

---

## 4. Day-one customers (outreach lists, from Reddit)

### Cluster #2 — Shared/component inventory (PRIMARY — warmest design partners)
| User | Situation | Link |
|---|---|---|
| u/dashowdetgetcha | Ingredients in 5 sizes, all from one oz-based raw pool; wants no overselling | https://www.reddit.com/r/shopify/comments/1s1jzy4/ |
| u/Shelby-thomas | Sofa: 2 frames × 22 fabrics = 44 variants sharing physical stock; on Basic (**posted twice**) | https://www.reddit.com/r/shopify/comments/1o22q4o/ · https://www.reddit.com/r/shopify/comments/1q86n44/ |
| u/Asleep-Audience1126 | "Nightmare" tracking material costs/stock/margins in spreadsheets (71-comment thread) | https://www.reddit.com/r/shopify/comments/1loc3tn/ |
| u/momssssspaghetti | Variant limits, weekly preorders, "tired of workarounds," eyeing other platforms | https://www.reddit.com/r/shopify/comments/1pp85zl/ |
| u/maybecanifly | Manufacturer limited by raw materials, not variants | https://www.reddit.com/r/shopify/comments/y4l5vb/ |
| u/PDXSCARGuy | Wants component consumption deduction on sale | https://www.reddit.com/r/shopify/comments/1ndnbqe/ |
| u/dmitrybzns | Decal + blank shirt → finished shirt (component stock) | https://www.reddit.com/r/shopify/comments/1ak23hy/ |
| u/dubc4 | T-shirt + logo A/B share 50 shirts | https://www.reddit.com/r/shopify/comments/198dncr/ |
| u/SnooMarzipans4387 | Handmade, 8 fabric colors, shared limited stock | https://www.reddit.com/r/shopify/comments/1hxrb07/ |
| u/MudSad6268 | Multi-channel overselling (Shopify+Amazon+Walmart+eBay) at peak | https://www.reddit.com/r/shopify/comments/1n9oplg/ |

### Cluster #1 — Catalog/import (if pivoting to the images-importer)
u/khyati21 (jewelry, 200→10k SKUs) https://www.reddit.com/r/shopify/comments/1nepxvg/ · u/dellottobros (3k products/mo, every supplier different format, in 1nepxvg) · u/HappyBottomSexToys (15k items, variant merging) https://www.reddit.com/r/shopify/comments/1qzoeiv/ · u/starlynagency (2k products + zip images) https://www.reddit.com/r/shopify/comments/18tat5x/ · u/pokethehippo (17k+5k migration) https://www.reddit.com/r/shopify/comments/1hwwchl/ · u/Momentum313 https://www.reddit.com/r/shopify/comments/1if9h2h/ · u/theboulderbeholder https://www.reddit.com/r/shopify/comments/1aphidv/ · u/you_played_yourself1 (URL-scan import) https://www.reddit.com/r/shopify/comments/12xtpff/

### Cluster #3 — Returns + warranty (if pivoting)
u/knock_his_block_off ("returns taking hours daily", 50c) https://www.reddit.com/r/shopify/comments/1r39z0m/ · u/moosh445566 ("apps fall short on warranty") https://www.reddit.com/r/shopify/comments/1is6cd1/ · u/Fantastic_Ad7050 (warranty via Google Form) https://www.reddit.com/r/shopify/comments/1rdcxcr/ · u/BipoIarBearO (sell + self-manage warranties) https://www.reddit.com/r/shopify/comments/1lq6qfc/ · u/FizzySalad https://www.reddit.com/r/shopify/comments/1q7m844/

---

## 5. Competitor intel (what merchants tried & how they feel)

| App | What it does | Sentiment / gap |
|---|---|---|
| **Material Manager** | BOM/materials, deducts components on sale | **Liked & cheap** — "all functionality we need for much less." The one to beat. |
| **Connected Inventory** | Link variants to hidden shared "items" | Works but **fiddly setup + monthly fee**, "confusing" |
| **Easify** | Product options / preorder | **Disliked** — breaks native reporting (can't export which variant sold → manual retyping), billing bugs |
| **Mechanic (Lightward)** | Custom automation scripting | Powerful but **needs dev skills** |
| **Prediko / Qoblex / StockTrim** | Raw-materials & BOM forecasting/planning | More planning-focused; pricier |
| **ERPs** (Cin7, Unleashed, NetSuite, Linnworks, Katana, inFlow) | Full inventory/manufacturing | "**Too expensive / overkill**" for small makers — the graduate-to endgame |
| **DIY** (Webhooks → Google Sheets + Apps Script) | Roll-your-own | Fragile, requires coding, race conditions |

**The 4 unmet gaps (your moat):**
1. 🔴 **Overselling under load** — webhook recalc too slow; race condition during flash sales/BF. Practitioners say "most apps handle it poorly."
2. 🟠 **Basic-plan support** — variant linking locked on Basic; small makers excluded.
3. 🟠 **Reporting/export that doesn't break** — merchants retype orders into spreadsheets.
4. 🟡 **Pool + BOM + COGS in one** — currently fragmented across tools/ERP.

---

## 5.1 App Store teardown — ratings & the disruption target (researched 2026-06-27)

**Primary target: NASP Connected Inventory — `apps.shopify.com/connected-inventory` — 3.3★ (52 reviews), 21% at 1–2 stars.** The most-recommended yet worst-rated app in the niche (Reddit's default for shared/bundle inventory, $9.99/mo). Its real 1-star reviews map onto our moat:
- 🔴 **Oversells under load** — *"I do flash sales… it sold stock I didn't have. Their reply: 'not suited for this.' I lost clients."* / *"crashes if too many orders go through… Black Friday disaster… overselling. Avoid!"* (The dev literally tells customers it can't handle traffic.)
- 🟠 **False OOS / "tug-of-war"** — *"keeps marking products OOS when they aren't."*
- 🟠 **No external-system sync** — *"changes made in Dear/ERP not fed back… makes the app useless."*
- 🟠 **Bad/abandoned support** — *"support is absolutely terrible" / "developer is stopping support."*
- 💡 **Captive users** — *"rarely works properly… but there is no-one else offering this service and it's essential to my business."*

**Niche ratings (competitive set):**
| App | Rating | Reviews | Note |
|---|---|---|---|
| **NASP Connected Inventory** | **3.3★** | 52 | TARGET — most-used, worst-rated, oversells under load |
| Materials Inventory (makers) | 5.0★ | 51 | Liked, small |
| Material Manager | 4.6★ | 19 | Liked, small ("nice" incumbent) |
| Assemblified BOM | 5.0★ | 22 | Liked, small (kits/bundles) |
| Product Component Manager | 4.6★ | 19 | Small |
| Raw Materials Inventory (soply) | 0.0★ | 0 | New entrant, "overselling prevention for makers" = our exact angle, no traction |
| Multi-store sync (diff. use case) | 4.5–5.0★ | 97–162 | Syncio / Synkro / Multi-Store Sync Power |

**Strategic read:** (1) Best opening = "the Connected Inventory that survives a flash sale" — it owns demand but is 3.3★ because it oversells under load (the one thing we'd build correctly per §8.F); its 21% unhappy users + Reddit referrals = day-one list. (2) Well-rated maker apps are all small (≤51 reviews) & fragmented — no dominant reliable player. (3) soply (0 reviews, our exact positioning) = others see the gap; move with a sharper wedge.

---

## 6. Feature spec (build checklist)

- [ ] One **shared stock pool → multiple variants**, consuming **whole units OR fractions** (e.g. ounces)
- [ ] **Component/BOM ("recipe")**: finished product = N components; available qty = component that runs out first
- [ ] **Real-time recalculation** of all linked variants after every order — **without overselling under traffic**
- [ ] **Oversell guardrails**: stock reservation / buffer thresholds / block-at-checkout
- [ ] **Cap total sales regardless of variant** (unmet micro-need — existing apps only cap per-customer)
- [ ] **COGS / margin tracking** per item
- [ ] **Preorder/backorder-aware**
- [ ] **Multi-location** inventory support
- [ ] **Clean exports** + don't break Shopify's native variant reporting
- [ ] **Bulk setup** of pools/BOM via CSV (large catalogs up to 15k SKUs)
- [ ] **Audit log / change history** (why stock changed → trust)
- [ ] **Low-stock alerts/notifications**
- [ ] Correct handling of **refunds, cancellations, partial fulfillment, exchanges** (restock to pool)

---

## 7. Pricing

### Market landscape
| Tier | Tools | Price/mo |
|---|---|---|
| Lightweight apps (direct comps) | Connected Inventory | **$9.99** flat |
| | Material Manager | **Free → $19.99 → $29.99 → $49.99** (by orders) |
| | Mechanic | $16 → $29 → $99 → $199 |
| Mid inventory-ops | Prediko | $49 → $119 → $199 (by revenue) |
| | Qoblex | $99 → $179 (+$49 B2B) |
| Full ERP/IMS (ceiling) | Katana | Free + Core from **$299** |
| | Cin7 Core | **$349 → $599 → $999** |
| | SkuLabs | **$299 → $499 → $799** |

**Conventions:** 7-day free trial standard; free tier common; tier by **order volume or revenue**, not flat.
**Key insight:** big white-space gap between top app (~$50) and bottom ERP (~$299).

### Recommended pricing for our app
> **Free → $19 → $39 → $59/mo**, tiered by order volume.
- **Free** (≤100 orders/mo) to match Material Manager and lower friction.
- **$19 / $39** sit on the proven Material Manager band.
- **$59 "Pro"** (real-time oversell protection + COGS/margins + exports) reaches into the empty $50–$299 gap — the "ERP-grade reliability without the ERP price" story. Merchants already pay $299–$999 for ERPs to get this, so $59 is screaming value.

---

## 8. Design & build considerations (things to keep in mind)

### A. Shopify platform & technical
- **Inventory is variant-level and atomic.** All your logic layers on top via your own data model (store pool/BOM config in **metafields** or your own DB keyed by SKU/variant ID).
- **Overselling prevention — RESOLVED, feasible on Basic.** See the dedicated section §8.F below for the confirmed architecture.
- **Use the GraphQL Admin API.** Shopify has deprecated REST for products/variants; bulk variant updates via `productVariantsBulkUpdate`. Respect **rate limits** (GraphQL cost-based) — design batching + backoff.
- **Webhook reliability:** handle missed/duplicate webhooks idempotently; subscribe to `orders/create`, `orders/cancelled`, `refunds/create`, `fulfillments`. Run periodic **reconciliation jobs** to self-heal drift (inventory accuracy is mission-critical — drift = oversell = your one job failing).
- **Multi-location:** Shopify supports multiple inventory locations; pool/BOM logic must respect them.
- **Performance:** if you touch the storefront, use **theme app extensions**, never script tags (Web Vitals matter for Built for Shopify).

### B. App Store, compliance & business model
- **Billing must go through Shopify's Billing API** (you can't bill outside it for app charges). Shopify takes a **revenue share** — *verify current terms (historically 0% under $1M/year, then a cut).*
- **Mandatory GDPR webhooks**: `customers/data_request`, `customers/redact`, `shop/redact` — required for approval.
- **App review/approval** process; comply with Shopify API terms & data-protection requirements.
- **Embedded app** using **App Bridge + Polaris** so it feels native inside Shopify admin (merchants expect this).
- **"Built for Shopify" (BFS) badge** boosts App Store ranking — worth targeting (performance, embedded, review thresholds). *Verify current BFS criteria.*
- **Reviews drive discovery** — build a tasteful in-app review-request flow; early 5★ reviews from design partners are gold.
- **App Store SEO**: target keywords merchants actually search — "connected inventory", "bundle inventory", "bill of materials", "raw materials", "shared stock".

### C. Product / UX (where incumbents fail — your chance to win)
- **Onboarding is the differentiator.** Every competitor's setup is called "fiddly/confusing." Build a guided wizard (pick products → define pool/recipe → preview → go live).
- **Never break native reporting**; always provide clean CSV/sheet exports of orders + which variant/component sold.
- **Trust & transparency:** audit log of every stock change with the reason; a clear dashboard of pools and what's blocking sales.
- **Safe defaults + guardrails:** buffer stock, oversell alerts, "what-if" preview before applying changes.
- **Edge cases are the product:** refunds/cancellations/exchanges must restock the pool correctly; preorders/backorders; bundles.

### D. Go-to-market
- **Start with ONE vertical** (e.g. candle/soap makers or food/ingredients) for your first 10 customers — focused messaging + word of mouth in tight communities.
- **Recruit design partners** from the Reddit list above (esp. the repeat-posters and platform-switchers — highest intent). Offer free Pro for feedback + a testimonial.
- **Engage authentically** in r/shopify (answer the exact threads with genuine help; respect self-promo rules) and maker communities.
- **Lead all messaging with the oversell pain** (lost money + angry customers) and "works on Basic, keeps your reports intact."

### E. Risks
- **Shopify platform risk:** Shopify already ships a native **Bundles** app and could extend shared-pool/BOM natively. Mitigate by going deeper than Shopify will (true BOM, COGS, multi-location, reliability, support).
- **Incumbent is liked + cheap (Material Manager).** You must visibly out-differentiate on the 4 gaps — being "another shared-inventory app" won't work.
- **Reliability is existential:** an inventory app that ever oversells or loses accuracy destroys trust instantly. Uptime, idempotency, and reconciliation are not optional. Consider an accuracy/SLA promise as a feature.
- **Support load:** inventory bugs are urgent for merchants; budget for responsive support (a competitor sells on "24-hour support").

---

### F. Overselling prevention — confirmed architecture (researched 2026-06-27, shopify.dev)

**Verdict: feasible on the Basic plan.** The make-or-break risk is resolved.

**Why overselling happens (3 races):** (1) per-variant inventory, no shared-pool concept; (2) concurrent checkouts both read "1 left"; (3) `orders/create` webhook recalc is too slow under load (why incumbents oversell on BF).

**Layered solution:**
1. **Native settings (any plan):** `inventory_policy: deny` + enable **"hold inventory at checkout"** (Shopify reserves stock for a several-minute hold during payment). Covers single-variant concurrency.
2. **Cart & Checkout Validation Function (the moat):** runs **server-side, blocks checkout incl. express checkouts (Shop Pay/Apple/Google Pay), cannot be bypassed.** Blocks any cart that would exceed the shared pool.
3. **Backend ledger + webhooks:** authoritative pool/BOM stock; on each `orders/create` / `refunds/create` / `orders/cancelled` webhook (**idempotency keys** to dedupe retries), recompute availability and **write it to a metafield** via Admin GraphQL API.
4. **Safety net:** **buffer/safety stock** + periodic **reconciliation** job to self-heal drift.

**Two plan facts that dictate the design:**
- ✅ Validation Functions work on **ALL plans (incl. Basic) IF distributed as a PUBLIC App Store app.** (Custom apps with Functions = Plus only. Our app is public → Basic merchants covered.)
- ❌ **Network access (`fetch` target) is NOT on Basic** (it's "Shopify for enterprises + custom apps," must be enabled by Shopify). So the function **cannot call our backend live at checkout.**

**Forced (and Shopify-recommended) pattern:** function reads **metafields**, not live network. Backend writes current pool availability to a metafield (Admin API) *before* checkout; the function reads metafield + cart and blocks if cart > pool. Shopify explicitly recommends metafields over `fetch` (more efficient, durable).

```
Backend (pool ledger) ──Admin GraphQL──▶ metafield (pool availability)
   ▲ webhooks (idempotent)                    │ read at checkout
   │                                          ▼
orders/refunds/cancel            Validation Function ──▶ block if cart > pool
```

**Residual-concurrency caveat (= the moat):** metafields are only as fresh as the last write, so two simultaneous different-variant checkouts could each pass but jointly exceed the pool. Close it with buffer stock + reconciliation, and for the strongest guarantee use the **"hidden component product" pattern** — map the shared pool onto one tracked component SKU so **Shopify's native atomic reservation** guards the real stock (how Connected Inventory/Bundles work). Doing this reliably is the depth competitors skip.

**Sources:** shopify.dev/docs/api/functions/latest/cart-and-checkout-validation · /docs/apps/build/checkout/cart-checkout-validation · /docs/apps/build/functions/network-access · shopify.engineering/scaling-inventory-reservations

---

## 9. Open questions / next steps
- [x] ~~Validate the oversell-prevention approach~~ → **RESOLVED** (see §8.F): public-app validation function + metafields works on Basic. Next: prototype it on a dev store.
- [ ] Interview 5–8 design partners from the Reddit list; confirm willingness to pay at $19–$59.
- [ ] Decide lead vertical (consumables vs POD apparel).
- [ ] Deep-dive Material Manager (install, map exact feature/UX gaps).
- [ ] Draft App Store listing + landing page around the 4 gaps.
- [ ] Build outreach DMs to warmest prospects (design-partner invite).

## 10. Research provenance
- **Reddit** (r/shopify) via Agent Reach OpenCLI: ~20 searches, ~90 posts parsed, 6 comment threads read in full.
- **Exa** web search: competitor landscape + pricing.
- **Jina Reader**: App Store + ERP pricing pages.
- Twitter/X attempted (not logged in — empty).
- Reusable parsers: `/tmp/rparse.py` (search), `/tmp/cparse.py` (thread read) for `opencli reddit search/read -f json`.
- Pricing captured 2026-06-27; re-verify before launch (apps change tiers).
