# Competitor Review Mining — NASP Connected Inventory (3.3★)

> Full mining of Connected Inventory's App Store reviews (all rating tiers) + aggregators, via Agent Reach (Exa + Jina), 2026-06-28. The incumbent's failures = our requirements. **Core insight: the feature set is right; it's the reliability that's broken.**

## Negative reviews → failure modes → our requirements

| # | What reviewers said (verbatim, trimmed) | Failure mode | Our requirement |
|---|---|---|---|
| 1 | *"crashes if 'too many' orders go through… Black Friday disaster… overselling our inventory. Staff spent hours manually re-setting on the busiest day. Avoid this app!"* (dev admitted: *"sync on Black Friday is slower than other days"*) | **Oversells under load** — async sync too slow | **Real-time oversell prevention at checkout** (validation function), not post-order sync |
| 2 | *"I do flash sales… It sold a whole lot of stock I didn't have."* (dev: *"not suited for this"*) | Same — fails exactly when it matters | Must hold up during flash sales / drops |
| 3 | *"Whenever you couple inventory and something gets sold, the app messes up the whole supply into minus. Happened multiple times with multiple items."* | **Goes negative** (race/calc bug) | **Atomic, never-negative pool math** |
| 4 | *"keeps changing inventory levels… products marked OOS when they aren't. Even after I change it back, it pulls them out again. Never-ending tug-of-war."* | **False OOS**, fights manual edits | **Correct calc + respect manual overrides**, no fighting the merchant |
| 5 | *"It stops working randomly… cannot run a reliable business on such an unstable technical solution."* / *"stopped working properly and ruined our inventory count on tons of products."* | **Unstable / random failures** | **Reliability + monitoring + alerting**; treat accuracy as existential |
| 6 | *"the basic feature of different SKUs start being seen as one on a listing."* | **SKU/variant identity bug** | Correct variant/SKU identity handling |
| 7 | *"None of the buttons are working at the moment."* / *"new app update is unorganized, no way to filter products by name/date, navigation resets to home screen."* | **Broken/regressed UI** | **Solid, searchable/filterable admin UI** that preserves state |
| 8 | *"It never recorded the bundle purchases into the products inventory, I deleted the plugin."* (dev: *"follow the Bundle Setup document"*) | **Silent setup failure** — config is error-prone | **Foolproof setup wizard + a self-test** that proves it's working |
| 9 | *"changes made through Dear (ERP) not reflected back to variant inventory… useless for us."* | **No external/ERP inbound sync** | Optional external-system sync (P2) |
| 10 | *"getting help and support is a nightmare."* / *"support is absolutely terrible."* / *"developer is stopping support."* | **Inconsistent/abandoned support** | **Consistent fast support + self-serve diagnostics** |
| 11 | *"rarely works properly, costs a fortune… but there is no-one else offering this service and it's essential to my business."* | Captive, unhappy | The whole opportunity in one quote |

## Positive reviews → what to KEEP (table stakes)
- **Bundle groups** (1 order pulls multiple products from inventory) + **connected groups** (multiple sellable items pull from one source SKU) — the core value. *"Just a great app to add functionality for bundle groups… connected groups… at a reasonable price."*
- **Composite/shared inventory across listings**, incl. **returns/restock both sides**: *"two listings share inventory… when one is bought the other goes down… and on returns, if one is restocked the other adjusts too."*
- **Variant linking via same SKU with different photos**: *"linked male & female stock using the same SKU which allowed different photos for each."*
- **Cheap + easy install + simple setup** (for many): keep low price & frictionless onboarding.
- **Fast, friendly support** ("Billy") when present — make great support the norm, not the exception.

## The strategic conclusion
Build the **same proven core** (bundle groups, connected groups, shared/composite stock, returns-aware) but make it:
1. **Never oversell** (real-time checkout validation, not slow async sync) — fixes #1, #2.
2. **Never go negative / never false-OOS** (atomic, correct math, respects overrides) — fixes #3, #4, #6.
3. **Rock-solid & monitored** (reliability is the product) — fixes #5, #7.
4. **Foolproof setup with a self-test** — fixes #8.
5. **Consistently well-supported** — fixes #10.

> Requirements flow into `DEVELOPMENT_SPEC.md` (build spec) and `App_Concept_and_Backlog.md` (backlog).
