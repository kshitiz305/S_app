/**
 * Ledger + availability (DEVELOPMENT_SPEC §7 Phase 1.5 / Phase 3).
 *
 * The ledger is append-only and idempotent on (poolId, reason, sourceId). Pool
 * availability is ALWAYS derived from totalOnHand + Σledger − buffer, so it is
 * reconstructable and self-healing (Phase 8.3).
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import prisma from "../db.server";
import { computeAvailable, roundUnits } from "../domain/poolMath";
import type { LedgerReason } from "../domain/types";

type Db = PrismaClient | Prisma.TransactionClient;

/** Convert a Prisma.Decimal | number | string to a JS number. */
export function dec(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  // Prisma.Decimal has a toNumber(); strings/objects fall back to Number().
  const maybe = value as { toNumber?: () => number };
  return typeof maybe.toNumber === "function" ? maybe.toNumber() : Number(value);
}

/** Σ of all ledger deltas for a pool. */
export async function poolNetDelta(poolId: string, db: Db = prisma): Promise<number> {
  const result = await db.ledgerEntry.aggregate({
    where: { poolId },
    _sum: { delta: true },
  });
  return roundUnits(dec(result._sum.delta));
}

export interface PoolLike {
  id: string;
  totalOnHand: unknown; // Prisma.Decimal
  buffer: unknown;
}

/** Current sellable availability of a pool, floored at 0. */
export async function poolAvailable(pool: PoolLike, db: Db = prisma): Promise<number> {
  const netLedgerDelta = await poolNetDelta(pool.id, db);
  return computeAvailable({
    totalOnHand: dec(pool.totalOnHand),
    netLedgerDelta,
    buffer: dec(pool.buffer),
  });
}

export interface RecordLedgerInput {
  shopId: string;
  poolId: string;
  delta: number; // <0 consume, >0 restock
  reason: LedgerReason;
  sourceId?: string | null;
  note?: string | null;
}

/**
 * Idempotently append a ledger entry. The unique (poolId, reason, sourceId)
 * constraint guarantees replays (webhook retries) never double-count.
 * Returns true if a new row was written, false if it already existed.
 */
export async function recordLedger(
  input: RecordLedgerInput,
  db: Db = prisma,
): Promise<boolean> {
  try {
    await db.ledgerEntry.create({
      data: {
        shopId: input.shopId,
        poolId: input.poolId,
        delta: roundUnits(input.delta),
        reason: input.reason,
        sourceId: input.sourceId ?? null,
        note: input.note ?? null,
      },
    });
    return true;
  } catch (error) {
    // P2002 = unique constraint violation => already processed => idempotent ack.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return false;
    }
    throw error;
  }
}
