/**
 * BOM service (DEVELOPMENT_SPEC §7 Phase 2.3 + Phase 5 COGS/margin).
 *
 * A finished variant is assembled from N components (pools or tracked variants).
 * Sellable quantity = whichever component runs out first.
 */

import prisma from "../db.server";
import { bindingComponents, bomAvailable, bomCogs, bomMargin } from "../domain/bom";
import type { BomComponentConfig } from "../domain/types";
import { dec, poolAvailable } from "./ledger.server";

export interface BomComponentInput {
  kind: "pool" | "variant";
  ref: string; // poolId or variantId GID
  qtyPerFinished: number;
  costPerUnit?: number | null;
}

export interface BomInput {
  name: string;
  finishedVariantId: string;
  finishedProductId?: string | null;
  salePrice?: number | null;
  components: BomComponentInput[];
}

export async function listBoms(shopId: string) {
  const boms = await prisma.bom.findMany({
    where: { shopId },
    orderBy: { updatedAt: "desc" },
    include: { components: { include: { pool: true } } },
  });
  return Promise.all(boms.map((b) => decorateBom(b)));
}

export async function getBom(shopId: string, id: string) {
  const bom = await prisma.bom.findFirst({
    where: { id, shopId },
    include: { components: { include: { pool: true } } },
  });
  if (!bom) return null;
  return decorateBom(bom);
}

type BomWithComponents = NonNullable<
  Awaited<ReturnType<typeof prisma.bom.findFirst>>
> & {
  components: Array<{
    id: string;
    poolId: string | null;
    variantId: string | null;
    qtyPerFinished: unknown;
    costPerUnit: unknown;
    pool: { id: string; name: string; costPerUnit: unknown } | null;
  }>;
};

async function decorateBom(bom: BomWithComponents) {
  // Build component configs for pure math. Pool components use live pool
  // availability + the pool's per-unit cost; variant components are treated as
  // non-constraining for availability unless tracked elsewhere.
  const configs: BomComponentConfig[] = [];
  for (const c of bom.components) {
    if (c.poolId && c.pool) {
      const poolRecord = await prisma.pool.findUnique({ where: { id: c.poolId } });
      const liveAvailable = poolRecord ? await poolAvailable(poolRecord) : 0;
      configs.push({
        ref: c.poolId,
        kind: "pool",
        qtyPerFinished: dec(c.qtyPerFinished),
        available: liveAvailable,
        costPerUnit:
          c.costPerUnit != null
            ? dec(c.costPerUnit)
            : c.pool.costPerUnit != null
              ? dec(c.pool.costPerUnit)
              : undefined,
      });
    } else if (c.variantId) {
      configs.push({
        ref: c.variantId,
        kind: "variant",
        qtyPerFinished: dec(c.qtyPerFinished),
        available: Number.POSITIVE_INFINITY, // unknown → non-constraining for v1
        costPerUnit: c.costPerUnit != null ? dec(c.costPerUnit) : undefined,
      });
    }
  }

  const salePrice = bom.salePrice != null ? dec(bom.salePrice) : 0;
  const margin = bomMargin(configs, salePrice);

  // Identify the component(s) that run out first (the binding constraint, §1).
  const finite = configs.filter((c) => Number.isFinite(c.available));
  const labelByRef = new Map<string, string>();
  for (const c of bom.components) {
    labelByRef.set(c.poolId ?? c.variantId ?? "", c.pool?.name ?? c.variantId ?? "component");
  }
  const constrainedBy = bindingComponents(finite).map((b) => labelByRef.get(b.ref) ?? b.ref);

  return {
    id: bom.id,
    name: bom.name,
    finishedVariantId: bom.finishedVariantId,
    finishedProductId: bom.finishedProductId,
    salePrice,
    components: bom.components.map((c) => ({
      id: c.id,
      kind: (c.poolId ? "pool" : "variant") as "pool" | "variant",
      ref: c.poolId ?? c.variantId ?? "",
      poolName: c.pool?.name ?? null,
      qtyPerFinished: dec(c.qtyPerFinished),
      costPerUnit: c.costPerUnit != null ? dec(c.costPerUnit) : null,
    })),
    finishedAvailable: bomAvailable(finite),
    constrainedBy,
    cogs: bomCogs(configs),
    margin: margin.margin,
    marginPct: margin.marginPct,
    updatedAt: bom.updatedAt,
  };
}

export async function createBom(shopId: string, input: BomInput) {
  return prisma.bom.create({
    data: {
      shopId,
      name: input.name,
      finishedVariantId: input.finishedVariantId,
      finishedProductId: input.finishedProductId ?? null,
      salePrice: input.salePrice ?? null,
      components: {
        create: input.components.map((c) => ({
          poolId: c.kind === "pool" ? c.ref : null,
          variantId: c.kind === "variant" ? c.ref : null,
          qtyPerFinished: c.qtyPerFinished,
          costPerUnit: c.costPerUnit ?? null,
        })),
      },
    },
  });
}

export async function updateBom(shopId: string, id: string, input: BomInput) {
  const existing = await prisma.bom.findFirst({ where: { id, shopId } });
  if (!existing) throw new Error("BOM not found");

  return prisma.$transaction(async (tx) => {
    await tx.bomComponent.deleteMany({ where: { bomId: id } });
    return tx.bom.update({
      where: { id },
      data: {
        name: input.name,
        finishedVariantId: input.finishedVariantId,
        finishedProductId: input.finishedProductId ?? null,
        salePrice: input.salePrice ?? null,
        components: {
          create: input.components.map((c) => ({
            poolId: c.kind === "pool" ? c.ref : null,
            variantId: c.kind === "variant" ? c.ref : null,
            qtyPerFinished: c.qtyPerFinished,
            costPerUnit: c.costPerUnit ?? null,
          })),
        },
      },
    });
  });
}

export async function deleteBom(shopId: string, id: string) {
  const existing = await prisma.bom.findFirst({ where: { id, shopId } });
  if (!existing) return;
  await prisma.bom.delete({ where: { id } });
}
