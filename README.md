# Shopify App Planning

Everything for evaluating & building a Shopify app, from Reddit/market research (via Agent Reach). Compiled 2026-06-27/28.

## 📌 The idea in one line
**Reliable shared-stock & bill-of-materials inventory for Shopify makers — won't oversell, even during a flash sale, even on the Basic plan.** Disrupts NASP Connected Inventory (3.3★, the most-used but worst-rated app in the niche, which oversells under load).

## 📂 Files in this folder
| File | What's in it |
|---|---|
| **[SHOPIFY_APP_PLANNING.md](SHOPIFY_APP_PLANNING.md)** | **Master plan** — full research: 3 problem clusters, all customer lists, competitor intel, App Store teardown (§5.1), feature spec, pricing, design considerations, overselling architecture (§8.F) |
| **[App_Concept_and_Backlog.md](App_Concept_and_Backlog.md)** | The concept, positioning, prioritized P0/P1/P2 feature backlog, pricing, GTM |
| **[Outreach_Prospects.md](Outreach_Prospects.md)** | Contactable unhappy merchants (Reddit) = day-one customer / design-partner pipeline, with outreach angles + status |
| **[Outreach_DM_Drafts.md](Outreach_DM_Drafts.md)** | Ready-to-send, personalized Reddit DM drafts + etiquette + qualifying questions |
| **[Technical_Architecture.md](Technical_Architecture.md)** | Overselling-prevention architecture + validation-function code scaffold + prototype setup steps |
| **[DEVELOPMENT_SPEC.md](DEVELOPMENT_SPEC.md)** | ⭐ **Self-contained step-by-step build spec for another Claude/dev** — phases, features, acceptance criteria. Hand this to a fresh session to build the app. |
| **[Competitor_Review_Mining.md](Competitor_Review_Mining.md)** | Full mining of Connected Inventory's reviews → every failure mode → our requirements |

## ✅ What's validated
- **Problem:** structural Shopify gap (no shared pool / BOM); recurring across 30+ distinct merchants.
- **Competition:** incumbent Connected Inventory is 3.3★ and oversells under load; alternatives are well-rated but tiny/fragmented.
- **Tech feasibility:** oversell-prevention works on Basic via public-app validation function + metafields (confirmed against shopify.dev).
- **Pricing:** market band $10–$50 (apps) vs $299+ (ERPs); recommended Free→$19→$39→$59.

## ▶️ Next steps (in priority order)
1. **Build it** — open a fresh Claude session and give it `DEVELOPMENT_SPEC.md`; it's self-contained and step-by-step. (Provide your Shopify Partner account + dev store.)
2. **Reach out to design partners** — start with u/mactac (current Connected Inventory user), then Tier A in `Outreach_Prospects.md`. Confirm willingness to pay $19–$59.
3. **Validate as you build** — show prototype phases to design partners; refine the backlog.

To hand off to a builder Claude, say e.g.: *"Build the app described in `Shopify App Planning/DEVELOPMENT_SPEC.md`, starting at Phase 0."*

## 🔁 Reproduce / extend the research
Research was done with **Agent Reach** (`agent-reach doctor --json` for status). Reddit via OpenCLI; competitor/pricing via Exa + Jina. Reusable parsers: `/tmp/rparse.py` (search), `/tmp/cparse.py` (thread read).
