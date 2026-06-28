import type {
  CartValidationsGenerateRunInput,
  CartValidationsGenerateRunResult,
} from "../generated/api";
import { evaluateCart, type FnCartLine } from "./poolDemand";

/**
 * StockSentry oversell guard (DEVELOPMENT_SPEC §7 Phase 4).
 * Blocks checkout when cart demand exceeds true shared-pool availability,
 * read from the $app:inventory/pool metafield the backend keeps fresh.
 */
export function cartValidationsGenerateRun(
  input: CartValidationsGenerateRunInput,
): CartValidationsGenerateRunResult {
  const errors = evaluateCart(input.cart.lines as unknown as FnCartLine[]);

  return {
    operations: [
      {
        validationAdd: {
          errors,
        },
      },
    ],
  };
}