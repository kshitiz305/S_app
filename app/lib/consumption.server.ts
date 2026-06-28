/**
 * Map order/refund lines to per-pool consumption (DEVELOPMENT_SPEC §7 Phase 3.3).
 *
 * Resolves three cases:
 *   1. A variant that is a direct pool member.
 *   2. A BOM finished variant → expand into its components.
 *   3. A BOM variant-component that is itself a pool member → consume its pool.
 *
 * Returns a map of poolId → units consumed (positive).
 */

import prisma from "../db.server";
import { roundUnits } from "../domain/poolMath";
import { dec } from "./ledger.server";

export interface OrderLine {
  variantId: string; // gid://shopify/ProductVariant/...
  quantity: number;
}

export async function resolvePoolConsumption(
  shopId: string,
  lines: OrderLine[],
): Promise<Map<string, number>> {
  const consumption = new Map<string, number>();
  const add = (poolId: string, units: number) => {
    if (units === 0) return;
    consumption.set(poolId, roundUnits((consumption.get(poolId) ?? 0) + units));
  };

  const variantIds = [...new Set(lines.map((l) => l.variantId))];
  if (variantIds.length === 0) return consumption;

  // 1. Direct pool members
  const members = await prisma.poolMember.findMany({
    where: { variantId: { in: variantIds }, pool: { shopId } },
    select: { variantId: true, poolId: true, consumesPerUnit: true },
  });
  const memberByVariant = new Map<string, { poolId: string; consumes: number }[]>();
  for (const m of members) {
    const arr = memberByVariant.get(m.variantId) ?? [];
    arr.push({ poolId: m.poolId, consumes: dec(m.consumesPerUnit) });
    memberByVariant.set(m.variantId, arr);
  }

  // 2. BOMs whose finished variant appears in the order
  const boms = await prisma.bom.findMany({
    where: { shopId, finishedVariantId: { in: variantIds } },
    include: { components: true },
  });
  const bomByVariant = new Map(boms.map((b) => [b.finishedVariantId, b]));

  // 3. Resolve variant-type BOM components that are themselves pool members
  const componentVariantIds = boms
    .flatMap((b) => b.components)
    .map((c) => c.variantId)
    .filter((v): v is string => Boolean(v));
  const componentMembers = componentVariantIds.length
    ? await prisma.poolMember.findMany({
        where: { variantId: { in: componentVariantIds }, pool: { shopId } },
        select: { variantId: true, poolId: true, consumesPerUnit: true },
      })
    : [];
  const componentMemberByVariant = new Map<string, { poolId: string; consumes: number }>();
  for (const cm of componentMembers) {
    componentMemberByVariant.set(cm.variantId, {
      poolId: cm.poolId,
      consumes: dec(cm.consumesPerUnit),
    });
  }

  for (const line of lines) {
    for (const d of memberByVariant.get(line.variantId) ?? []) {
      add(d.poolId, line.quantity * d.consumes);
    }

    const bom = bomByVariant.get(line.variantId);
    if (!bom) continue;
    for (const c of bom.components) {
      const qty = line.quantity * dec(c.qtyPerFinished);
      if (c.poolId) {
        add(c.poolId, qty);
      } else if (c.variantId) {
        const cm = componentMemberByVariant.get(c.variantId);
        if (cm) add(cm.poolId, qty * cm.consumes);
        // else: plain tracked variant component — Shopify manages its own stock.
      }
    }
  }

  return consumption;
}
