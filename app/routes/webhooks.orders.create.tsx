import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { handleOrdersCreate } from "../lib/webhookProcessing.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, admin, webhookId } = await authenticate.webhook(request);
  // No admin context (e.g. app already uninstalled) — ack to stop retries.
  if (!admin) return new Response();
  await handleOrdersCreate(admin, shop, payload as never, webhookId);
  return new Response();
};
