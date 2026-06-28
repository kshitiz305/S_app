/**
 * StockSentry pool math — PURE functions, no Shopify / Prisma / IO.
 *
 * These encode the NON-NEGOTIABLES from DEVELOPMENT_SPEC §4:
 *   - never go negative (always floored at 0)
 *   - fractional units are first-class (oz/ml/g) via fixed-precision rounding
 *   - availability = totalOnHand + ΣledgerDelta − buffer
 *
 * Ledger sign convention (single source of truth for the whole app):
 *   delta < 0  → units consumed from the pool (an order)
 *   delta > 0  → units returned to the pool (a refund / cancel / restock)
 */

import type { CartLineInput, PoolConfig } from "./types";

/** Decimal places of precision for fractional units. */
export const UNIT_SCALE = 4;

const SCALE_FACTOR = 10 ** UNIT_SCALE;

/**
 * Round to UNIT_SCALE decimal places to defuse binary floating-point drift
 * (e.g. 0.1 + 0.2). Normalizes -0 to 0.
 */
export function roundUnits(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`roundUnits received a non-finite value: ${value}`);
  }
  const rounded = Math.round((value + Number.EPSILON) * SCALE_FACTOR) / SCALE_FACTOR;
  return rounded === 0 ? 0 : rounded;
}

/** Clamp to a non-negative, fixed-precision number. Never returns a negative. */
export function clampNonNegative(value: number): number {
  const rounded = roundUnits(value);
  return rounded < 0 ? 0 : rounded;
}

/** Sum of ledger deltas (signed). */
export function sumDeltas(deltas: number[]): number {
  return roundUnits(deltas.reduce((acc, d) => acc + d, 0));
}

export interface AvailabilityInput {
  /** Capacity of the pool (physical units that exist). */
  totalOnHand: number;
  /** Net ledger delta (Σ delta). Negative as the pool is consumed. */
  netLedgerDelta: number;
  /** Safety stock held back from sellable availability. Default 0. */
  buffer?: number;
}

/**
 * Canonical availability formula (DEVELOPMENT_SPEC §7 Phase 3.3):
 *   available = totalOnHand + Σdelta − buffer, floored at 0.
 */
export function computeAvailable({
  totalOnHand,
  netLedgerDelta,
  buffer = 0,
}: AvailabilityInput): number {
  return clampNonNegative(totalOnHand + netLedgerDelta - buffer);
}

/** Units a single cart/order line consumes from a pool. */
export function lineConsumption(quantity: number, consumesPerUnit: number): number {
  if (quantity < 0) throw new RangeError(`quantity must be >= 0, got ${quantity}`);
  if (consumesPerUnit < 0)
    throw new RangeError(`consumesPerUnit must be >= 0, got ${consumesPerUnit}`);
  return roundUnits(quantity * consumesPerUnit);
}

/**
 * Aggregate cart demand per pool from a metafield-style PoolConfig.
 * Returns total units demanded from THIS pool by the given cart lines.
 * Lines whose variant is not a member of the pool contribute 0.
 */
export function poolDemand(pool: PoolConfig, lines: CartLineInput[]): number {
  const consumesByVariant = new Map<string, number>();
  for (const m of pool.members) consumesByVariant.set(m.variantId, m.consumes);

  let demand = 0;
  for (const line of lines) {
    const consumes = consumesByVariant.get(line.variantId);
    if (consumes === undefined) continue;
    demand += lineConsumption(line.quantity, consumes);
  }
  return roundUnits(demand);
}

/**
 * Would fulfilling this cart exceed the pool's available stock?
 * This is the exact predicate the checkout validation function enforces.
 */
export function exceedsPool(pool: PoolConfig, lines: CartLineInput[]): boolean {
  return poolDemand(pool, lines) > pool.available;
}

/**
 * Compute the order consumption (as a NEGATIVE ledger delta) for one pool,
 * given the order lines and the pool's member consume rates.
 */
export function orderLedgerDelta(
  members: { variantId: string; consumesPerUnit: number }[],
  lines: CartLineInput[],
): number {
  const consumesByVariant = new Map<string, number>();
  for (const m of members) consumesByVariant.set(m.variantId, m.consumesPerUnit);

  let consumed = 0;
  for (const line of lines) {
    const consumes = consumesByVariant.get(line.variantId);
    if (consumes === undefined) continue;
    consumed += lineConsumption(line.quantity, consumes);
  }
  // Consumption reduces the pool → negative delta.
  return roundUnits(-consumed);
}
