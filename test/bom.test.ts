import { describe, it, expect } from "vitest";
import {
  bomAvailable,
  bindingComponents,
  bomConsumption,
  bomCogs,
  bomMargin,
} from "../app/domain/bom";
import type { BomComponentConfig } from "../app/domain/types";

const giftBox: BomComponentConfig[] = [
  { ref: "pool_candle", kind: "pool", qtyPerFinished: 1, available: 10, costPerUnit: 4 },
  { ref: "pool_soap", kind: "pool", qtyPerFinished: 2, available: 9, costPerUnit: 1.5 },
  { ref: "gid://shopify/ProductVariant/box", kind: "variant", qtyPerFinished: 1, available: 100, costPerUnit: 0.75 },
];

describe("bomAvailable — qty = whichever component runs out first (SPEC §1)", () => {
  it("is the min over components of floor(available / qtyPerFinished)", () => {
    // candle: floor(10/1)=10, soap: floor(9/2)=4, box: floor(100/1)=100 → 4
    expect(bomAvailable(giftBox)).toBe(4);
  });

  it("returns 0 for an empty BOM", () => {
    expect(bomAvailable([])).toBe(0);
  });

  it("never returns negative", () => {
    expect(
      bomAvailable([{ ref: "x", kind: "pool", qtyPerFinished: 1, available: -5 }]),
    ).toBe(0);
  });

  it("handles fractional component requirements", () => {
    // 7 oz wax available, each candle needs 1.5 oz → floor(7/1.5) = 4
    expect(
      bomAvailable([{ ref: "wax", kind: "pool", qtyPerFinished: 1.5, available: 7 }]),
    ).toBe(4);
  });

  it("throws when qtyPerFinished is not positive", () => {
    expect(() =>
      bomAvailable([{ ref: "x", kind: "pool", qtyPerFinished: 0, available: 5 }]),
    ).toThrow(RangeError);
  });
});

describe("bindingComponents", () => {
  it("identifies the component that runs out first", () => {
    const binding = bindingComponents(giftBox);
    expect(binding.map((c) => c.ref)).toEqual(["pool_soap"]);
  });
});

describe("bomConsumption", () => {
  it("computes per-component consumption for an order", () => {
    const consumption = bomConsumption(giftBox, 3);
    expect(consumption).toEqual([
      { ref: "pool_candle", kind: "pool", consumed: 3 },
      { ref: "pool_soap", kind: "pool", consumed: 6 },
      { ref: "gid://shopify/ProductVariant/box", kind: "variant", consumed: 3 },
    ]);
  });
});

describe("bomCogs + bomMargin (SPEC §5)", () => {
  it("sums component costs into a finished-item COGS", () => {
    // 1*4 + 2*1.5 + 1*0.75 = 7.75
    expect(bomCogs(giftBox)).toBe(7.75);
  });

  it("computes margin and margin %", () => {
    const result = bomMargin(giftBox, 25);
    expect(result.cogs).toBe(7.75);
    expect(result.margin).toBe(17.25);
    expect(result.marginPct).toBeCloseTo(69, 0);
  });

  it("does not divide by zero when salePrice is 0", () => {
    expect(bomMargin(giftBox, 0).marginPct).toBe(0);
  });
});
