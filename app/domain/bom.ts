/**
 * StockSentry bill-of-materials math — PURE functions.
 *
 * A finished product is made of N components. The sellable quantity of the
 * finished product is whichever component runs out first (DEVELOPMENT_SPEC §1):
 *
 *   bomAvailable = min over components of floor(component.available / qtyPerFinished)
 *
 * COGS of one finished item = Σ (qtyPerFinished × component.costPerUnit).
 */

import type { BomComponentConfig } from "./types";
import { roundUnits } from "./poolMath";

/**
 * Sellable whole-unit availability of a finished BOM item.
 * Returns an integer count of finished items, floored at 0.
 */
export function bomAvailable(components: BomComponentConfig[]): number {
  if (components.length === 0) return 0;

  let min = Infinity;
  for (const c of components) {
    if (c.qtyPerFinished <= 0) {
      throw new RangeError(`qtyPerFinished must be > 0, got ${c.qtyPerFinished} for ${c.ref}`);
    }
    const buildable = Math.floor(roundUnits(c.available) / c.qtyPerFinished);
    const safe = buildable < 0 ? 0 : buildable;
    if (safe < min) min = safe;
  }
  return min === Infinity ? 0 : min;
}

/** Which component(s) are the binding constraint (the ones that run out first). */
export function bindingComponents(components: BomComponentConfig[]): BomComponentConfig[] {
  const limit = bomAvailable(components);
  return components.filter(
    (c) => Math.floor(roundUnits(c.available) / c.qtyPerFinished) === limit,
  );
}

export interface ComponentConsumption {
  ref: string;
  kind: BomComponentConfig["kind"];
  consumed: number;
}

/**
 * Per-component consumption when `finishedQty` finished items are sold.
 * Used to write ledger entries for each pool/variant a BOM touches.
 */
export function bomConsumption(
  components: BomComponentConfig[],
  finishedQty: number,
): ComponentConsumption[] {
  if (finishedQty < 0) throw new RangeError(`finishedQty must be >= 0, got ${finishedQty}`);
  return components.map((c) => ({
    ref: c.ref,
    kind: c.kind,
    consumed: roundUnits(finishedQty * c.qtyPerFinished),
  }));
}

/** COGS of a single finished item. Components without a cost contribute 0. */
export function bomCogs(components: BomComponentConfig[]): number {
  let cogs = 0;
  for (const c of components) {
    if (c.costPerUnit && c.costPerUnit > 0) {
      cogs += c.qtyPerFinished * c.costPerUnit;
    }
  }
  return roundUnits(cogs);
}

export interface MarginResult {
  cogs: number;
  margin: number;
  marginPct: number; // 0..100, rounded to 2 dp; 0 when salePrice <= 0
}

/** Margin of a finished item: salePrice − COGS, plus margin %. */
export function bomMargin(components: BomComponentConfig[], salePrice: number): MarginResult {
  const cogs = bomCogs(components);
  const margin = roundUnits(salePrice - cogs);
  const marginPct =
    salePrice > 0 ? Math.round(((margin / salePrice) * 100 + Number.EPSILON) * 100) / 100 : 0;
  return { cogs, margin, marginPct };
}
