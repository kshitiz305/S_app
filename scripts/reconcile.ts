import "@shopify/shopify-app-remix/adapters/node";
import prisma from "../app/db.server";
import { unauthenticated } from "../app/shopify.server";
import { reconcileShop } from "../app/lib/reconcile.server";
import { logger } from "../app/lib/logger.server";

/**
 * Reconciliation cron entry point (DEVELOPMENT_SPEC §7 Phase 8.3).
 *
 * Recomputes every installed shop's pools from the authoritative ledger and
 * re-pushes availability to Shopify, self-healing any drift. Schedule on your
 * host (e.g. `*\/15 * * * *`) via:  `npm run reconcile`.
 */
async function main() {
  const shops = await prisma.session.findMany({
    distinct: ["shop"],
    select: { shop: true },
  });

  logger.info("reconcile cron start", { shops: shops.length });

  for (const { shop } of shops) {
    try {
      const { admin } = await unauthenticated.admin(shop);
      const results = await reconcileShop(admin, shop);
      logger.info("reconcile cron shop done", { shop, pools: results.length });
    } catch (error) {
      logger.error("reconcile cron shop failed", { shop, error: String(error) });
    }
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  logger.error("reconcile cron fatal", { error: String(error) });
  await prisma.$disconnect();
  process.exit(1);
});
