/**
 * Pool service (DEVELOPMENT_SPEC §7 Phase 2 + Phase 3 sync).
 *
 * CRUD for inventory pools and the authoritative "push availability to Shopify"
 * routine that keeps the checkout metafield and native variant inventory fresh.
 */

import type { Prisma } from "@prisma/client";
import prisma from "../db.server";
import { roundUnits } from "../domain/poolMath";
import { dec, poolAvailable, poolNetDelta, recordLedger } from "./ledger.server";
import { getShopSettings } from "./shop.server";
import {
  getPrimaryLocationId,
  setVariantAvailable,
  writePoolMetafield,
  type AdminGraphql,
  type PoolMetafieldValue,
} from "./sync.server";
import { logger } from "./logger.server";

export interface PoolMemberInput {
  variantId: string;
  consumesPerUnit: number;
  productId?: string | null;
  inventoryItemId?: string | null;
  sku?: string | null;
  title?: string | null;
}

export interface PoolInput {
  name: string;
  unit: string;
  totalOnHand: number;
  buffer: number;
  lowStockThreshold?: number | null;
  costPerUnit?: number | null;
  anchorProductId?: string | null;
  reconcileMode?: "respectManual" | "authoritative";
  members: PoolMemberInput[];
}

export interface PoolListOptions {
  query?: string;
  sort?: "name" | "onHand" | "updated";
  direction?: "asc" | "desc";
}

export async function listPools(shopId: string, options: PoolListOptions = {}) {
  const { query, sort = "updated", direction = "desc" } = options;
  const orderBy: Prisma.PoolOrderByWithRelationInput =
    sort === "name"
      ? { name: direction }
      : sort === "onHand"
        ? { totalOnHand: direction }
        : { updatedAt: direction };

  const pools = await prisma.pool.findMany({
    where: {
      shopId,
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy,
    include: { _count: { select: { members: true } } },
  });

  return Promise.all(
    pools.map(async (p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      totalOnHand: dec(p.totalOnHand),
      buffer: dec(p.buffer),
      memberCount: p._count.members,
      lowStockThreshold: p.lowStockThreshold === null ? null : dec(p.lowStockThreshold),
      available: await poolAvailable(p),
      updatedAt: p.updatedAt,
    })),
  );
}

export async function getPool(shopId: string, id: string) {
  const pool = await prisma.pool.findFirst({
    where: { id, shopId },
    include: { members: true },
  });
  if (!pool) return null;
  return {
    ...pool,
    totalOnHandNum: dec(pool.totalOnHand),
    bufferNum: dec(pool.buffer),
    available: await poolAvailable(pool),
  };
}

function anchorFor(input: PoolInput): string | null {
  if (input.anchorProductId) return input.anchorProductId;
  const withProduct = input.members.find((m) => m.productId);
  return withProduct?.productId ?? null;
}

export async function createPool(shopId: string, input: PoolInput) {
  return prisma.pool.create({
    data: {
      shopId,
      name: input.name,
      unit: input.unit,
      totalOnHand: input.totalOnHand,
      buffer: input.buffer,
      lowStockThreshold: input.lowStockThreshold ?? null,
      costPerUnit: input.costPerUnit ?? null,
      reconcileMode: input.reconcileMode ?? "respectManual",
      anchorProductId: anchorFor(input),
      members: {
        create: input.members.map((m) => ({
          variantId: m.variantId,
          consumesPerUnit: m.consumesPerUnit,
          productId: m.productId ?? null,
          inventoryItemId: m.inventoryItemId ?? null,
          sku: m.sku ?? null,
          title: m.title ?? null,
        })),
      },
    },
    include: { members: true },
  });
}

export async function updatePool(shopId: string, id: string, input: PoolInput) {
  // Verify ownership before mutating.
  const existing = await prisma.pool.findFirst({ where: { id, shopId } });
  if (!existing) throw new Error("Pool not found");

  // Replace members wholesale — simplest correct semantics for the editor.
  return prisma.$transaction(async (tx) => {
    await tx.poolMember.deleteMany({ where: { poolId: id } });
    return tx.pool.update({
      where: { id },
      data: {
        name: input.name,
        unit: input.unit,
        totalOnHand: input.totalOnHand,
        buffer: input.buffer,
        lowStockThreshold: input.lowStockThreshold ?? null,
        costPerUnit: input.costPerUnit ?? null,
        reconcileMode: input.reconcileMode ?? existing.reconcileMode,
        anchorProductId: anchorFor(input),
        members: {
          create: input.members.map((m) => ({
            variantId: m.variantId,
            consumesPerUnit: m.consumesPerUnit,
            productId: m.productId ?? null,
            inventoryItemId: m.inventoryItemId ?? null,
            sku: m.sku ?? null,
            title: m.title ?? null,
          })),
        },
      },
      include: { members: true },
    });
  });
}

export async function deletePool(shopId: string, id: string) {
  const existing = await prisma.pool.findFirst({ where: { id, shopId } });
  if (!existing) return;
  await prisma.pool.delete({ where: { id } });
}

/**
 * Push a pool's current availability to Shopify: write the checkout metafield
 * AND mirror availability into each member variant's native inventory.
 * Idempotent and safe to call after every save, webhook, and reconciliation.
 */
export async function syncPoolToShopify(
  admin: AdminGraphql,
  shopId: string,
  poolId: string,
): Promise<{ available: number; metafieldWritten: boolean }> {
  const pool = await prisma.pool.findFirst({
    where: { id: poolId, shopId },
    include: { members: true },
  });
  if (!pool) throw new Error(`Pool ${poolId} not found for shop ${shopId}`);

  const settings = await getShopSettings(shopId);
  const available = await poolAvailable(pool);

  const anchorProductId =
    pool.anchorProductId ?? pool.members.find((m) => m.productId)?.productId ?? null;

  let metafieldWritten = false;
  if (anchorProductId) {
    const value: PoolMetafieldValue = {
      poolId: pool.id,
      available,
      unit: pool.unit,
      enforce: settings.enforceValidation,
      message: settings.blockMessage,
      members: pool.members.map((m) => ({
        variantId: m.variantId,
        consumes: dec(m.consumesPerUnit),
      })),
    };
    await writePoolMetafield(admin, anchorProductId, value);
    metafieldWritten = true;
  } else {
    logger.warn("Pool has no anchor product; metafield not written", { poolId });
  }

  // Mirror availability into native variant inventory where we can.
  const trackable = pool.members.filter((m) => m.inventoryItemId);
  if (trackable.length > 0) {
    const locationId = await getPrimaryLocationId(admin);
    if (locationId) {
      for (const m of trackable) {
        try {
          await setVariantAvailable(admin, {
            inventoryItemId: m.inventoryItemId as string,
            locationId,
            quantity: available,
          });
        } catch (error) {
          logger.warn("Failed to mirror variant inventory", {
            poolId,
            variantId: m.variantId,
            error: String(error),
          });
        }
      }
    }
  }

  return { available, metafieldWritten };
}

/**
 * Respect (or override) a merchant's manual inventory edit made directly in
 * Shopify (DEVELOPMENT_SPEC §4.3 + §7 Phase 3.5). Driven by the
 * `inventory_levels/update` webhook.
 *
 * Loop-safety: we mirror availability into native inventory ourselves, which
 * also fires this webhook. When the observed value already equals what we last
 * pushed, it's our own echo and we do nothing — so there is no tug-of-war.
 *
 *  - respectManual: treat the merchant's value as the new pool availability by
 *    adjusting totalOnHand (capacity), log a `manual` ledger entry, re-sync.
 *  - authoritative: re-push the app's computed value, overwriting the edit.
 */
export async function applyManualInventoryEdit(
  admin: AdminGraphql,
  shopId: string,
  inventoryItemId: string,
  observed: number,
  sourceId: string,
): Promise<{ handled: boolean; mode?: string; available?: number }> {
  const member = await prisma.poolMember.findFirst({
    where: { inventoryItemId, pool: { shopId } },
    include: { pool: true },
  });
  if (!member) return { handled: false };

  const pool = member.pool;
  const current = await poolAvailable(pool);
  const lastPushed = Math.max(0, Math.trunc(current));

  // Our own write echoing back → ignore (prevents the loop the incumbent has).
  if (observed === lastPushed) return { handled: false };

  if (pool.reconcileMode === "authoritative") {
    await syncPoolToShopify(admin, shopId, pool.id);
    logger.info("manual edit overridden (authoritative)", {
      poolId: pool.id,
      observed,
      restoredTo: lastPushed,
    });
    return { handled: true, mode: "authoritative", available: current };
  }

  // respectManual: make availability equal the merchant's value via totalOnHand.
  const netDelta = await poolNetDelta(pool.id);
  const newTotalOnHand = roundUnits(observed - netDelta + dec(pool.buffer));
  await prisma.pool.update({
    where: { id: pool.id },
    data: { totalOnHand: newTotalOnHand },
  });
  await recordLedger({
    shopId,
    poolId: pool.id,
    delta: 0,
    reason: "manual",
    sourceId: `manual:${sourceId}`,
    note: `Manual edit on ${inventoryItemId}: availability set to ${observed}`,
  });
  const result = await syncPoolToShopify(admin, shopId, pool.id);
  logger.info("manual edit respected", {
    poolId: pool.id,
    observed,
    newTotalOnHand,
  });
  return { handled: true, mode: "respectManual", available: result.available };
}

