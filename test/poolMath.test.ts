import { describe, it, expect } from "vitest";
import {
  roundUnits,
  clampNonNegative,
  computeAvailable,
  lineConsumption,
  poolDemand,
  exceedsPool,
  orderLedgerDelta,
  sumDeltas,
} from "../app/domain/poolMath";
import type { PoolConfig } from "../app/domain/types";

describe("roundUnits", () => {
  it("defuses binary floating point drift", () => {
    expect(roundUnits(0.1 + 0.2)).toBe(0.3);
    expect(roundUnits(1.0001 + 2.0002)).toBe(3.0003);
  });

  it("normalizes -0 to 0", () => {
    expect(Object.is(roundUnits(-0), 0)).toBe(true);
  });

  it("throws on non-finite input", () => {
    expect(() => roundUnits(NaN)).toThrow(RangeError);
    expect(() => roundUnits(Infinity)).toThrow(RangeError);
  });
});

describe("clampNonNegative — never go negative (SPEC §4.2)", () => {
  it("floors at zero", () => {
    expect(clampNonNegative(-5)).toBe(0);
    expect(clampNonNegative(-0.0001)).toBe(0);
  });
  it("passes through positives", () => {
    expect(clampNonNegative(12.5)).toBe(12.5);
  });
});

describe("computeAvailable — available = totalOnHand + Σdelta − buffer", () => {
  it("computes a simple consumption", () => {
    expect(
      computeAvailable({ totalOnHand: 50, netLedgerDelta: -10, buffer: 0 }),
    ).toBe(40);
  });

  it("applies a buffer (safety stock)", () => {
    expect(
      computeAvailable({ totalOnHand: 50, netLedgerDelta: -10, buffer: 5 }),
    ).toBe(35);
  });

  it("never returns a negative even when oversold on paper", () => {
    expect(
      computeAvailable({ totalOnHand: 10, netLedgerDelta: -25, buffer: 0 }),
    ).toBe(0);
  });

  it("supports fractional units (oz/ml)", () => {
    expect(
      computeAvailable({ totalOnHand: 12.5, netLedgerDelta: -2.25, buffer: 0.25 }),
    ).toBe(10);
  });
});

describe("lineConsumption", () => {
  it("multiplies quantity by consumesPerUnit", () => {
    expect(lineConsumption(3, 1)).toBe(3);
    expect(lineConsumption(4, 0.5)).toBe(2);
    expect(lineConsumption(3, 0.3)).toBe(0.9);
  });
  it("rejects negative inputs", () => {
    expect(() => lineConsumption(-1, 1)).toThrow(RangeError);
    expect(() => lineConsumption(1, -1)).toThrow(RangeError);
  });
});

describe("sumDeltas", () => {
  it("sums signed deltas with precision", () => {
    expect(sumDeltas([-0.1, -0.2, 0.3])).toBe(0);
    expect(sumDeltas([-1, -2, -3])).toBe(-6);
  });
});

const pool: PoolConfig = {
  poolId: "pool_wax",
  available: 5,
  unit: "each",
  members: [
    { variantId: "gid://shopify/ProductVariant/A", consumes: 1 },
    { variantId: "gid://shopify/ProductVariant/B", consumes: 2 },
  ],
};

describe("poolDemand + exceedsPool — shared pool across variants (SPEC §4.1)", () => {
  it("sums demand across mixed variants from one pool", () => {
    const lines = [
      { variantId: "gid://shopify/ProductVariant/A", quantity: 1 },
      { variantId: "gid://shopify/ProductVariant/B", quantity: 2 },
    ];
    expect(poolDemand(pool, lines)).toBe(5); // 1*1 + 2*2
    expect(exceedsPool(pool, lines)).toBe(false); // exactly at the limit
  });

  it("blocks when mixed-variant demand exceeds the pool", () => {
    const lines = [
      { variantId: "gid://shopify/ProductVariant/A", quantity: 2 },
      { variantId: "gid://shopify/ProductVariant/B", quantity: 2 },
    ];
    expect(poolDemand(pool, lines)).toBe(6);
    expect(exceedsPool(pool, lines)).toBe(true);
  });

  it("ignores variants that are not pool members", () => {
    const lines = [{ variantId: "gid://shopify/ProductVariant/Z", quantity: 99 }];
    expect(poolDemand(pool, lines)).toBe(0);
    expect(exceedsPool(pool, lines)).toBe(false);
  });
});

describe("orderLedgerDelta", () => {
  it("returns a negative delta equal to total consumption", () => {
    const members = [
      { variantId: "gid://shopify/ProductVariant/A", consumesPerUnit: 1 },
      { variantId: "gid://shopify/ProductVariant/B", consumesPerUnit: 0.5 },
    ];
    const lines = [
      { variantId: "gid://shopify/ProductVariant/A", quantity: 2 },
      { variantId: "gid://shopify/ProductVariant/B", quantity: 4 },
    ];
    expect(orderLedgerDelta(members, lines)).toBe(-4); // -(2*1 + 4*0.5)
  });
});
