/**
 * Reporting + CSV export (DEVELOPMENT_SPEC §7 Phase 5).
 *
 * Native Shopify reporting keeps working — this is additive. The CSV export
 * records exactly which pool/component each order consumed (the incumbent breaks
 * native reporting; we must not).
 */

import prisma from "../db.server";
import { dec, poolAvailable } from "./ledger.server";
import { listBoms } from "./boms.server";

export interface PoolRow {
  id: string;
  name: string;
  unit: string;
  totalOnHand: number;
  available: number;
  lowStock: boolean;
  memberCount: number;
}

export async function poolRows(shopId: string): Promise<PoolRow[]> {
  const pools = await prisma.pool.findMany({
    where: { shopId },
    include: { _count: { select: { members: true } } },
    orderBy: { name: "asc" },
  });
  return Promise.all(
    pools.map(async (p) => {
      const available = await poolAvailable(p);
      const threshold = p.lowStockThreshold == null ? null : dec(p.lowStockThreshold);
      return {
        id: p.id,
        name: p.name,
        unit: p.unit,
        totalOnHand: dec(p.totalOnHand),
        available,
        lowStock: threshold != null && available <= threshold,
        memberCount: p._count.members,
      };
    }),
  );
}

export interface ConsumptionRow {
  id: string;
  poolName: string;
  unit: string;
  delta: number;
  reason: string;
  sourceId: string | null;
  createdAt: Date;
}

export async function recentConsumption(
  shopId: string,
  limit = 25,
): Promise<ConsumptionRow[]> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { pool: { select: { name: true, unit: true } } },
  });
  return entries.map((e) => ({
    id: e.id,
    poolName: e.pool.name,
    unit: e.pool.unit,
    delta: dec(e.delta),
    reason: e.reason,
    sourceId: e.sourceId,
    createdAt: e.createdAt,
  }));
}

export async function dashboardData(shopId: string) {
  const [rows, recent, boms] = await Promise.all([
    poolRows(shopId),
    recentConsumption(shopId, 20),
    listBoms(shopId),
  ]);
  return {
    poolRows: rows,
    recent,
    boms,
    lowStockCount: rows.filter((r) => r.lowStock).length,
    poolCount: rows.length,
    bomCount: boms.length,
  };
}

function csvField(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/** CSV of per-line component consumption for every ledger event. */
export async function consumptionCsv(shopId: string): Promise<string> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    include: { pool: { select: { name: true, unit: true } } },
  });
  const header = ["createdAt", "pool", "unit", "reason", "sourceId", "delta", "note"].join(",");
  const lines = entries.map((e) =>
    [
      e.createdAt.toISOString(),
      csvField(e.pool.name),
      e.pool.unit,
      e.reason,
      csvField(e.sourceId),
      dec(e.delta),
      csvField(e.note),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}
