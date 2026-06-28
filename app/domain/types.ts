/**
 * StockSentry domain types — shared, pure, dependency-free.
 *
 * The `PoolConfig` shape here is the canonical contract that is serialized into
 * the Shopify product metafield ($app:inventory / pool, type json) and read at
 * checkout by the Cart & Checkout Validation Function (DEVELOPMENT_SPEC §5).
 */

export type Unit = "each" | "oz" | "ml" | "g" | "kg" | "lb" | (string & {});

/** A variant that draws from a shared pool. Serialized into the metafield. */
export interface PoolMemberConfig {
  variantId: string;
  /** Units of the pool consumed per 1 unit of this variant (e.g. 1, or 0.5). */
  consumes: number;
}

/** The JSON written to the anchor product metafield and read at checkout. */
export interface PoolConfig {
  poolId: string;
  /** Sellable units currently available in the shared pool (kept fresh by backend). */
  available: number;
  unit: Unit;
  members: PoolMemberConfig[];
}

export interface CartLineInput {
  variantId: string;
  quantity: number;
}

export type BomComponentKind = "pool" | "variant";

export interface BomComponentConfig {
  /** Pool id or tracked-variant id. */
  ref: string;
  kind: BomComponentKind;
  /** Units of this component consumed per 1 finished item. */
  qtyPerFinished: number;
  /** Currently available units of this component. */
  available: number;
  /** Optional unit cost for COGS/margin math (Phase 5). */
  costPerUnit?: number;
}

export type LedgerReason =
  | "order"
  | "refund"
  | "cancel"
  | "fulfillment"
  | "manual"
  | "reconcile"
  | "init";
