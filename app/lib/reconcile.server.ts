/**
 * Reconciliation (DEVELOPMENT_SPEC §7 Phase 8.3).
 *
 * Recomputes each pool's availability from the authoritative ledger and re-pushes
 * it to Shopify (metafield + native inventory), self-healing any drift caused by
 * a missed webhook, a failed sync, or a manual edit. Safe to run on a cron.
 */

import prisma from "../db.server";
import { captureException, logger } from "./logger.server";
import { poolAvailable } from "./ledger.server";
import { syncPoolToShopify } from "./pools.server";
import { updateShopSettings } from "./shop.server";
import type { AdminGraphql } from "./sync.server";

export interface ReconcileResult {
  poolId: string;
  name: string;
  available: number;
  resynced: boolean;
}

export async function reconcilePool(
  admin: AdminGraphql,
  shopId: string,
  poolId: string,
): Promise<ReconcileResult> {
  const pool = await prisma.pool.findFirst({ where: { id: poolId, shopId } });
  if (!pool) throw new Error(`Pool ${poolId} not found`);
  const available = await poolAvailable(pool);
  let resynced = false;
  try {
    await syncPoolToShopify(admin, shopId, poolId);
    resynced = true;
  } catch (error) {
    captureException(error, { poolId, shopId, op: "reconcile" });
  }
  return { poolId, name: pool.name, available, resynced };
}

export async function reconcileShop(
  admin: AdminGraphql,
  shopId: string,
): Promise<ReconcileResult[]> {
  const pools = await prisma.pool.findMany({ where: { shopId } });
  const results: ReconcileResult[] = [];
  for (const pool of pools) {
    results.push(await reconcilePool(admin, shopId, pool.id));
  }
  await updateShopSettings(shopId, { lastReconciledAt: new Date() });
  logger.info("reconcile complete", { shopId, pools: results.length });
  return results;
}
