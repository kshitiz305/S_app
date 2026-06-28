import { describe, it, expect } from "vitest";
import { SimulatedPool } from "./helpers/simulatedPool";

/**
 * THE test the incumbent fails (DEVELOPMENT_SPEC §9.3 / §10):
 * simulate 1000+ simultaneous checkouts against one shared pool and assert
 * ZERO oversell and NO negative inventory — including mixed variants drawing
 * from the same pool.
 */
describe("concurrency — zero oversell under flash-sale load", () => {
  it("never commits more than the pool holds (single variant, 2000 concurrent orders)", async () => {
    const TOTAL = 100;
    const ATTEMPTS = 2000;
    const pool = new SimulatedPool(TOTAL, 0, [{ variantId: "A", consumesPerUnit: 1 }]);

    // Each "checkout" arrives concurrently. We yield to the event loop before the
    // reservation to interleave scheduling, mimicking real simultaneous traffic.
    const results = await Promise.all(
      Array.from({ length: ATTEMPTS }, (_, i) =>
        Promise.resolve().then(() =>
          pool.tryReserve(`order_${i}`, [{ variantId: "A", quantity: 1 }]),
        ),
      ),
    );

    const committed = results.filter((r) => r.committed).length;
    expect(committed).toBe(TOTAL); // exactly 100 succeed
    expect(pool.consumed).toBe(TOTAL); // exactly 100 units consumed
    expect(pool.rawRemaining).toBe(0); // landed exactly at 0
    expect(pool.rawRemaining).toBeGreaterThanOrEqual(0); // never negative
  });

  it("never oversells with mixed variants from one pool", async () => {
    const TOTAL = 300;
    const pool = new SimulatedPool(TOTAL, 0, [
      { variantId: "A", consumesPerUnit: 1 },
      { variantId: "B", consumesPerUnit: 2 }, // B consumes 2 pool units each
    ]);

    const orders = [
      ...Array.from({ length: 800 }, (_, i) => ({
        id: `a_${i}`,
        lines: [{ variantId: "A", quantity: 1 }],
      })),
      ...Array.from({ length: 800 }, (_, i) => ({
        id: `b_${i}`,
        lines: [{ variantId: "B", quantity: 1 }],
      })),
    ];

    const results = await Promise.all(
      orders.map((o) =>
        Promise.resolve().then(() => ({ o, r: pool.tryReserve(o.id, o.lines) })),
      ),
    );

    // Recompute consumption from what actually committed and assert it fits.
    const committedConsumption = results
      .filter(({ r }) => r.committed)
      .reduce(
        ({ sum }, { o }) => ({
          sum: sum + (o.lines[0].variantId === "A" ? 1 : 2),
        }),
        { sum: 0 },
      ).sum;

    expect(committedConsumption).toBeLessThanOrEqual(TOTAL);
    expect(pool.rawRemaining).toBeGreaterThanOrEqual(0);
    expect(pool.consumed).toBe(committedConsumption);
  });

  it("respects a safety buffer (no checkout dips into reserved stock)", async () => {
    const TOTAL = 100;
    const BUFFER = 10;
    const pool = new SimulatedPool(TOTAL, BUFFER, [{ variantId: "A", consumesPerUnit: 1 }]);

    await Promise.all(
      Array.from({ length: 500 }, (_, i) =>
        Promise.resolve().then(() =>
          pool.tryReserve(`order_${i}`, [{ variantId: "A", quantity: 1 }]),
        ),
      ),
    );

    // Only TOTAL - BUFFER may be sold; buffer remains as physical safety stock.
    expect(pool.consumed).toBe(TOTAL - BUFFER);
    expect(pool.available).toBe(0);
    expect(pool.rawRemaining).toBe(BUFFER);
  });

  it("handles fractional-unit pools without drift or oversell", async () => {
    // 50 oz of wax; each candle consumes 1.5 oz → floor(50/1.5) = 33 candles.
    const pool = new SimulatedPool(50, 0, [{ variantId: "candle", consumesPerUnit: 1.5 }]);

    const results = await Promise.all(
      Array.from({ length: 1000 }, (_, i) =>
        Promise.resolve().then(() =>
          pool.tryReserve(`order_${i}`, [{ variantId: "candle", quantity: 1 }]),
        ),
      ),
    );

    const committed = results.filter((r) => r.committed).length;
    expect(committed).toBe(33);
    expect(pool.rawRemaining).toBeGreaterThanOrEqual(0);
    expect(pool.rawRemaining).toBeCloseTo(0.5, 5); // 50 - 33*1.5 = 0.5 oz left
  });
});
