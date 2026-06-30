import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { handleInventoryLevelsUpdate } from "../lib/webhookProcessing.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, admin, webhookId } = await authenticate.webhook(request);
  if (!admin) return new Response();
  await handleInventoryLevelsUpdate(admin, shop, payload as never, webhookId);
  return new Response();
};
