/**
 * Webhook processing (DEVELOPMENT_SPEC §7 Phase 3).
 *
 * Two layers of idempotency keep stock correct under Shopify's at-least-once
 * delivery + retries:
 *   1. WebhookEvent.shopifyEventId — fast-path dedupe of a redelivered event.
 *   2. LedgerEntry unique (poolId, reason, sourceId) — the real guarantee; even
 *      a duplicated event cannot double-count because the ledger write is the
 *      idempotency boundary.
 *
 * Handlers ack fast and keep work small; heavier deployments should enqueue the
 * `run` body to a worker (BullMQ/Redis) — the shape here is queue-ready.
 */

import prisma from "../db.server";
import { captureException, logger } from "./logger.server";
import { recordLedger } from "./ledger.server";
import { resolvePoolConsumption, type OrderLine } from "./consumption.server";
import { syncPoolToShopify } from "./pools.server";
import type { AdminGraphql } from "./sync.server";
import type { LedgerReason } from "../domain/types";

interface ProcessArgs {
  shopId: string;
  topic: string;
  eventId?: string | null;
  run: () => Promise<void>;
}

/** Dedupe + run + record status, leaving failed events retryable by Shopify. */
export async function processWebhook({ shopId, topic, eventId, run }: ProcessArgs): Promise<void> {
  if (eventId) {
    const existing = await prisma.webhookEvent.findUnique({
      where: { shopifyEventId: eventId },
    });
    if (existing?.status === "processed") {
      logger.info("webhook dedupe skip", { topic, eventId });
      return;
    }
  }

  try {
    await run();
    if (eventId) {
      await prisma.webhookEvent.upsert({
        where: { shopifyEventId: eventId },
        create: { shopId, topic, shopifyEventId: eventId, status: "processed" },
        update: {
          status: "processed",
          attempts: { increment: 1 },
          error: null,
          processedAt: new Date(),
        },
      });
    }
  } catch (error) {
    captureException(error, { topic, eventId, shopId });
    if (eventId) {
      await prisma.webhookEvent.upsert({
        where: { shopifyEventId: eventId },
        create: {
          shopId,
          topic,
          shopifyEventId: eventId,
          status: "failed",
          error: String(error),
        },
        update: {
          status: "failed",
          attempts: { increment: 1 },
          error: String(error),
        },
      });
    }
    throw error; // surface a 500 so Shopify retries (dead-letters after its budget)
  }
}

/** Numeric REST variant id → Admin GraphQL GID. */
export function variantGid(id: unknown): string | null {
  if (id === null || id === undefined) return null;
  const s = String(id);
  if (s.startsWith("gid://")) return s;
  if (!/^\d+$/.test(s)) return null;
  return `gid://shopify/ProductVariant/${s}`;
}

interface WebhookLineItem {
  variant_id?: number | string | null;
  quantity?: number;
}

export function orderLinesFromPayload(payload: {
  line_items?: WebhookLineItem[];
}): OrderLine[] {
  const lines: OrderLine[] = [];
  for (const li of payload.line_items ?? []) {
    const gid = variantGid(li.variant_id);
    if (!gid || !li.quantity) continue;
    lines.push({ variantId: gid, quantity: li.quantity });
  }
  return lines;
}

export function refundLinesFromPayload(payload: {
  refund_line_items?: Array<{ quantity?: number; line_item?: WebhookLineItem }>;
}): OrderLine[] {
  const lines: OrderLine[] = [];
  for (const rli of payload.refund_line_items ?? []) {
    const gid = variantGid(rli.line_item?.variant_id);
    if (!gid || !rli.quantity) continue;
    lines.push({ variantId: gid, quantity: rli.quantity });
  }
  return lines;
}

/**
 * Resolve lines → per-pool delta, write idempotent ledger entries, and re-sync
 * affected pools to Shopify. `sign` is -1 for consumption, +1 for restock.
 */
async function applyConsumption(
  admin: AdminGraphql,
  shopId: string,
  sourceId: string,
  reason: LedgerReason,
  sign: -1 | 1,
  lines: OrderLine[],
): Promise<void> {
  const consumption = await resolvePoolConsumption(shopId, lines);
  const affected = new Set<string>();

  for (const [poolId, units] of consumption) {
    const wrote = await recordLedger({
      shopId,
      poolId,
      delta: sign * units,
      reason,
      sourceId,
    });
    if (wrote) affected.add(poolId);
  }

  for (const poolId of affected) {
    try {
      await syncPoolToShopify(admin, shopId, poolId);
    } catch (error) {
      // A failed re-sync is recoverable by reconciliation; don't lose the ledger.
      captureException(error, { poolId, sourceId, reason });
    }
  }

  logger.info("applied consumption", {
    shopId,
    reason,
    sourceId,
    pools: [...affected],
    lines: lines.length,
  });
}

export async function handleOrdersCreate(
  admin: AdminGraphql,
  shopId: string,
  payload: { id?: number | string; line_items?: WebhookLineItem[] },
  eventId?: string | null,
): Promise<void> {
  await processWebhook({
    shopId,
    topic: "orders/create",
    eventId,
    run: () =>
      applyConsumption(
        admin,
        shopId,
        String(payload.id),
        "order",
        -1,
        orderLinesFromPayload(payload),
      ),
  });
}

export async function handleRefundsCreate(
  admin: AdminGraphql,
  shopId: string,
  payload: {
    id?: number | string;
    refund_line_items?: Array<{ quantity?: number; line_item?: WebhookLineItem }>;
  },
  eventId?: string | null,
): Promise<void> {
  await processWebhook({
    shopId,
    topic: "refunds/create",
    eventId,
    run: () =>
      applyConsumption(
        admin,
        shopId,
        String(payload.id),
        "refund",
        1, // restock BOTH sides of a shared/composite item (incumbent gap)
        refundLinesFromPayload(payload),
      ),
  });
}

export async function handleOrdersCancelled(
  admin: AdminGraphql,
  shopId: string,
  payload: { id?: number | string; line_items?: WebhookLineItem[] },
  eventId?: string | null,
): Promise<void> {
  await processWebhook({
    shopId,
    topic: "orders/cancelled",
    eventId,
    // NOTE: if a cancel also issues refunds, reconciliation (Phase 8) corrects
    // any double-restock drift; the ledger keeps a full audit trail either way.
    run: () =>
      applyConsumption(
        admin,
        shopId,
        String(payload.id),
        "cancel",
        1,
        orderLinesFromPayload(payload),
      ),
  });
}

export async function handleFulfillmentsCreate(
  admin: AdminGraphql,
  shopId: string,
  payload: { id?: number | string },
  eventId?: string | null,
): Promise<void> {
  // v1 consumes at orders/create, so fulfillment is observability-only. Still
  // deduped + recorded so the health indicator can show recent activity.
  await processWebhook({
    shopId,
    topic: "fulfillments/create",
    eventId,
    run: async () => {
      logger.info("fulfillment observed", { shopId, fulfillmentId: payload.id });
    },
  });
}
