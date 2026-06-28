/**
 * Pure oversell-evaluation logic for the Cart & Checkout Validation Function.
 *
 * Dependency-free (no generated Shopify types) so it can be unit-tested
 * directly. Shopify Functions are pure (no network/clock/random) — all data
 * arrives via the input query, so this mirrors the backend's pool math using
 * only the metafield the backend pushes ahead of checkout (DEVELOPMENT_SPEC §5).
 */

export interface PoolMetafield {
  poolId: string;
  available: number;
  unit?: string;
  enforce?: boolean;
  message?: string;
  members: Array<{ variantId: string; consumes: number }>;
}

export interface FnMerchandise {
  __typename: string;
  id?: string;
  product?: { poolMeta?: { value?: string | null } | null } | null;
}

export interface FnCartLine {
  quantity: number;
  merchandise: FnMerchandise;
}

export interface FnValidationError {
  message: string;
  target: string;
}

const SCALE = 10_000;
function round(n: number): number {
  const r = Math.round((n + Number.EPSILON) * SCALE) / SCALE;
  return r === 0 ? 0 : r;
}

function parsePool(value?: string | null): PoolMetafield | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as PoolMetafield;
    if (!parsed || typeof parsed.poolId !== "string" || !Array.isArray(parsed.members)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

interface Accum {
  demand: number;
  available: number;
  enforce: boolean;
  message: string;
}

const DEFAULT_MESSAGE = "Only {available} left in stock — please reduce the quantity.";

/**
 * Evaluate a cart against every pool referenced by its lines and return a
 * validation error per pool whose demand exceeds availability. Demand is summed
 * across mixed variants drawing from the same pool (never per-variant alone).
 */
export function evaluateCart(lines: FnCartLine[]): FnValidationError[] {
  const pools = new Map<string, Accum>();

  for (const line of lines) {
    if (line.merchandise.__typename !== "ProductVariant") continue;
    const variantId = line.merchandise.id;
    const pool = parsePool(line.merchandise.product?.poolMeta?.value);
    if (!variantId || !pool) continue;

    const member = pool.members.find((m) => m.variantId === variantId);
    if (!member) continue;

    const entry =
      pools.get(pool.poolId) ??
      ({
        demand: 0,
        available: round(pool.available),
        enforce: pool.enforce !== false,
        message: pool.message || DEFAULT_MESSAGE,
      } satisfies Accum);

    entry.demand = round(entry.demand + line.quantity * member.consumes);
    pools.set(pool.poolId, entry);
  }

  const errors: FnValidationError[] = [];
  for (const acc of pools.values()) {
    if (!acc.enforce) continue;
    if (acc.demand > acc.available) {
      errors.push({
        message: acc.message.replace("{available}", String(acc.available)),
        target: "$.cart",
      });
    }
  }
  return errors;
}
