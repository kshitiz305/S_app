import { describe, it, expect } from "vitest";
import { evaluateCart, type FnCartLine } from "../extensions/oversell-guard/src/poolDemand";

function variantLine(
  variantId: string,
  quantity: number,
  pool: object | null,
): FnCartLine {
  return {
    quantity,
    merchandise: {
      __typename: "ProductVariant",
      id: variantId,
      product: { poolMeta: pool ? { value: JSON.stringify(pool) } : { value: null } },
    },
  };
}

const waxPool = {
  poolId: "pool_wax",
  available: 5,
  unit: "each",
  members: [
    { variantId: "A", consumes: 1 },
    { variantId: "B", consumes: 2 },
  ],
};

describe("validation function — blocks checkout when demand exceeds pool (SPEC §4 DoD)", () => {
  it("allows a cart within availability", () => {
    const errors = evaluateCart([variantLine("A", 5, waxPool)]);
    expect(errors).toHaveLength(0);
  });

  it("blocks when a single variant exceeds the pool", () => {
    const errors = evaluateCart([variantLine("A", 6, waxPool)]);
    expect(errors).toHaveLength(1);
    expect(errors[0].target).toBe("$.cart");
    expect(errors[0].message).toContain("5");
  });

  it("blocks when MIXED variants jointly exceed the pool (the residual-race case)", () => {
    // 1*A (1) + 2*B (4) = 5 OK; add one more A → 6 > 5 → block.
    const errors = evaluateCart([
      variantLine("A", 2, waxPool),
      variantLine("B", 2, waxPool),
    ]);
    expect(errors).toHaveLength(1);
  });

  it("emits exactly one error per pool, not per line", () => {
    const errors = evaluateCart([
      variantLine("A", 10, waxPool),
      variantLine("B", 10, waxPool),
    ]);
    expect(errors).toHaveLength(1);
  });

  it("respects the enforcement toggle (Phase 4.4)", () => {
    const disabled = { ...waxPool, enforce: false };
    const errors = evaluateCart([variantLine("A", 999, disabled)]);
    expect(errors).toHaveLength(0);
  });

  it("uses the merchant's custom block message", () => {
    const custom = { ...waxPool, message: "Sold out — only {available} remain." };
    const errors = evaluateCart([variantLine("A", 99, custom)]);
    expect(errors[0].message).toBe("Sold out — only 5 remain.");
  });

  it("ignores lines with no pool metafield", () => {
    const errors = evaluateCart([variantLine("X", 100, null)]);
    expect(errors).toHaveLength(0);
  });

  it("is resilient to malformed metafield JSON", () => {
    const line: FnCartLine = {
      quantity: 10,
      merchandise: {
        __typename: "ProductVariant",
        id: "A",
        product: { poolMeta: { value: "{not valid json" } },
      },
    };
    expect(() => evaluateCart([line])).not.toThrow();
    expect(evaluateCart([line])).toHaveLength(0);
  });
});
