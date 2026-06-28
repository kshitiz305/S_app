import { describe, it, expect } from "vitest";
import { SimulatedPool } from "./helpers/simulatedPool";

describe("idempotency — replaying a webhook never double-counts (SPEC §7 Phase 3 DoD)", () => {
  it("an order applied twice consumes stock only once", () => {
    const pool = new SimulatedPool(50, 0, [
      { variantId: "A", consumesPerUnit: 1 },
    ]);

    const r1 = pool.tryReserve("order_1001", [{ variantId: "A", quantity: 5 }]);
    const r2 = pool.tryReserve("order_1001", [{ variantId: "A", quantity: 5 }]); // replay

    expect(r1.committed).toBe(true);
    expect(r2.committed).toBe(true); // idempotent ack
    expect(pool.consumed).toBe(5); // NOT 10
    expect(pool.available).toBe(45);
  });

  it("a refund applied twice restocks only once", () => {
    const pool = new SimulatedPool(50, 0, [
      { variantId: "A", consumesPerUnit: 1 },
    ]);
    pool.tryReserve("order_1", [{ variantId: "A", quantity: 10 }]);
    expect(pool.available).toBe(40);

    pool.restock("refund", "refund_1", [{ variantId: "A", quantity: 4 }]);
    pool.restock("refund", "refund_1", [{ variantId: "A", quantity: 4 }]); // replay

    expect(pool.available).toBe(44); // restocked 4 once, not 8
  });

  it("restocks BOTH sides of a shared pool on refund (incumbent gap, SPEC §7 Phase 3.4)", () => {
    const pool = new SimulatedPool(20, 0, [
      { variantId: "A", consumesPerUnit: 1 },
      { variantId: "B", consumesPerUnit: 1 },
    ]);
    // Sell variant A, which shares the pool with B.
    pool.tryReserve("order_9", [{ variantId: "A", quantity: 8 }]);
    expect(pool.available).toBe(12); // B's availability fell too

    // Refund variant A → pool (and therefore B) is restored.
    pool.restock("refund", "refund_9", [{ variantId: "A", quantity: 8 }]);
    expect(pool.available).toBe(20);
  });
});
