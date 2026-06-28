/**
 * SimulatedPool — an in-memory model of StockSentry's authoritative pool ledger.
 *
 * It mirrors the production backend's correctness guarantees so the unit /
 * concurrency tests can prove "zero oversell" without a real database or
 * Shopify. The critical section in `tryReserve` is fully synchronous, which is
 * exactly how the production code stays atomic — a Postgres transaction with a
 * conditional update (`UPDATE ... WHERE available >= demand`) provides the same
 * compare-and-commit guarantee.
 */

import {
  computeAvailable,
  orderLedgerDelta,
  roundUnits,
} from "../../app/domain/poolMath";

export interface SimMember {
  variantId: string;
  consumesPerUnit: number;
}

export interface SimLine {
  variantId: string;
  quantity: number;
}

interface LedgerRow {
  reason: string;
  sourceId: string;
  delta: number;
}

export interface ReserveResult {
  committed: boolean;
  available: number;
}

export class SimulatedPool {
  private ledger: LedgerRow[] = [];
  private seen = new Set<string>();

  constructor(
    public readonly totalOnHand: number,
    public readonly buffer: number,
    public readonly members: SimMember[],
  ) {}

  private idempotencyKey(reason: string, sourceId: string): string {
    return `${reason}:${sourceId}`;
  }

  get netDelta(): number {
    return roundUnits(this.ledger.reduce((acc, r) => acc + r.delta, 0));
  }

  get available(): number {
    return computeAvailable({
      totalOnHand: this.totalOnHand,
      netLedgerDelta: this.netDelta,
      buffer: this.buffer,
    });
  }

  /** Raw remaining stock ignoring buffer — used to assert we never go negative. */
  get rawRemaining(): number {
    return roundUnits(this.totalOnHand + this.netDelta);
  }

  private memberConfig() {
    return this.members.map((m) => ({
      variantId: m.variantId,
      consumesPerUnit: m.consumesPerUnit,
    }));
  }

  /**
   * Atomic reserve. The read-decide-write below contains no `await`, so under
   * JS's run-to-completion semantics it executes as one indivisible step even
   * when called from many "concurrent" promises.
   */
  tryReserve(sourceId: string, lines: SimLine[]): ReserveResult {
    const key = this.idempotencyKey("order", sourceId);
    if (this.seen.has(key)) {
      // Idempotent replay: do not double-count.
      return { committed: true, available: this.available };
    }

    const delta = orderLedgerDelta(this.memberConfig(), lines); // <= 0
    const demand = -delta;

    // --- critical section (synchronous => atomic) ---
    if (demand > this.available) {
      return { committed: false, available: this.available };
    }
    this.seen.add(key);
    this.ledger.push({ reason: "order", sourceId, delta });
    // ------------------------------------------------
    return { committed: true, available: this.available };
  }

  /** Idempotent restock (refund / cancel). delta is positive. */
  restock(reason: "refund" | "cancel", sourceId: string, lines: SimLine[]): void {
    const key = this.idempotencyKey(reason, sourceId);
    if (this.seen.has(key)) return;
    const consume = orderLedgerDelta(this.memberConfig(), lines); // <= 0
    this.seen.add(key);
    this.ledger.push({ reason, sourceId, delta: -consume }); // restore
  }

  /** Total units consumed (positive). */
  get consumed(): number {
    return roundUnits(-this.netDelta);
  }
}
