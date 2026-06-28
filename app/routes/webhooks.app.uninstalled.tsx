import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { logger } from "../lib/logger.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session } = await authenticate.webhook(request);
  logger.info("app uninstalled", { shop });

  // Sessions become invalid on uninstall; remove them. Shop business data is
  // retained until the GDPR shop/redact webhook (Shopify fires it ~48h later).
  if (session) {
    await prisma.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
