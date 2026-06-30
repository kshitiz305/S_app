/**
 * Setup self-test (DEVELOPMENT_SPEC §7 Phase 6.2).
 *
 * Simulates an order against a pool and reports before/after numbers so a
 * merchant can SEE that linking works before they depend on it. Pure math — it
 * does not mutate Shopify or the ledger.
 */

import prisma from "../db.server";
import { clampNonNegative, lineConsumption } from "../domain/poolMath";
import { dec, poolAvailable } from "./ledger.server";

export interface SelfTestResult {
  ok: boolean;
  poolId: string;
  poolName: string;
  available: number;
  testVariantId: string | null;
  consumesPerUnit: number;
  afterOneUnit: number;
  blocksAtQuantity: number | null; // qty at which checkout would block
  checks: Array<{ label: string; pass: boolean; detail?: string }>;
}

export async function runSelfTest(shopId: string, poolId: string): Promise<SelfTestResult> {
  const pool = await prisma.pool.findFirst({
    where: { id: poolId, shopId },
    include: { members: true },
  });

  if (!pool) {
    return {
      ok: false,
      poolId,
      poolName: "(missing)",
      available: 0,
      testVariantId: null,
      consumesPerUnit: 0,
      afterOneUnit: 0,
      blocksAtQuantity: null,
      checks: [{ label: "Pool exists", pass: false }],
    };
  }

  const available = await poolAvailable(pool);
  const firstMember = pool.members[0];
  const consumesPerUnit = firstMember ? dec(firstMember.consumesPerUnit) : 0;

  const afterOneUnit = firstMember
    ? clampNonNegative(available - lineConsumption(1, consumesPerUnit))
    : available;

  // Smallest whole quantity whose demand exceeds availability.
  let blocksAtQuantity: number | null = null;
  if (firstMember && consumesPerUnit > 0) {
    blocksAtQuantity = Math.floor(available / consumesPerUnit) + 1;
  }

  const hasAnchor = Boolean(
    pool.anchorProductId || pool.members.find((m) => m.productId)?.productId,
  );

  const checks = [
    { label: "Pool has at least one member variant", pass: pool.members.length > 0 },
    {
      label: "Pool has an anchor product for the checkout metafield",
      pass: hasAnchor,
      detail: hasAnchor ? undefined : "Add a member whose product can hold the metafield.",
    },
    {
      label: "Availability computes and is non-negative",
      pass: available >= 0,
      detail: `Available now: ${available}`,
    },
    {
      label: "Consuming one unit reduces availability",
      pass: !firstMember || afterOneUnit < available || available === 0,
      detail: firstMember ? `After 1× ${firstMember.title ?? "member"}: ${afterOneUnit}` : undefined,
    },
  ];

  return {
    ok: checks.every((c) => c.pass),
    poolId: pool.id,
    poolName: pool.name,
    available,
    testVariantId: firstMember?.variantId ?? null,
    consumesPerUnit,
    afterOneUnit,
    blocksAtQuantity,
    checks,
  };
}
