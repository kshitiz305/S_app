import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { logger } from "../lib/logger.server";

/**
 * Mandatory GDPR / compliance webhooks (DEVELOPMENT_SPEC §7 Phase 8.1).
 * One endpoint handles all three topics; `authenticate.webhook` verifies HMAC.
 *
 * StockSentry stores NO customer PII — the ledger only records Shopify order /
 * refund IDs — so data_request and customers/redact have nothing to return or
 * delete. shop/redact erases all of a shop's business data.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      logger.info("gdpr customers/data_request — no customer PII stored", { shop });
      break;

    case "CUSTOMERS_REDACT":
      logger.info("gdpr customers/redact — no customer PII stored", { shop });
      break;

    case "SHOP_REDACT":
      // Cascades remove members, ledger (via pool) and components (via bom).
      await prisma.$transaction([
        prisma.bom.deleteMany({ where: { shopId: shop } }),
        prisma.pool.deleteMany({ where: { shopId: shop } }),
        prisma.webhookEvent.deleteMany({ where: { shopId: shop } }),
        prisma.shop.deleteMany({ where: { shopId: shop } }),
        prisma.session.deleteMany({ where: { shop } }),
      ]);
      logger.info("gdpr shop/redact — shop data erased", { shop });
      break;

    default:
      logger.warn("unhandled compliance topic", { topic, shop });
  }

  return new Response();
};
