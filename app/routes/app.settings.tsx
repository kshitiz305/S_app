import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  FormLayout,
  Layout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { useCallback, useState } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getShopSettings, updateShopSettings } from "../lib/shop.server";
import { syncPoolToShopify } from "../lib/pools.server";
import { captureException } from "../lib/logger.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);
  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shopId = session.shop;
  const form = await request.formData();

  await updateShopSettings(shopId, {
    enforceValidation: form.get("enforceValidation") === "on",
    blockMessage: String(form.get("blockMessage") || "").trim(),
    defaultBuffer: Number(form.get("defaultBuffer")) || 0,
  });

  // Re-push every pool so the metafield reflects the new enforcement + message.
  const pools = await prisma.pool.findMany({ where: { shopId }, select: { id: true } });
  for (const p of pools) {
    try {
      await syncPoolToShopify(admin, shopId, p.id);
    } catch (error) {
      captureException(error, { poolId: p.id, op: "settings-resync" });
    }
  }

  return json({ saved: true, resynced: pools.length });
};

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [enforce, setEnforce] = useState(settings.enforceValidation);
  const [message, setMessage] = useState(settings.blockMessage);
  const [buffer, setBuffer] = useState(String(settings.defaultBuffer));

  const save = useCallback(() => {
    const fd = new FormData();
    if (enforce) fd.set("enforceValidation", "on");
    fd.set("blockMessage", message);
    fd.set("defaultBuffer", buffer);
    submit(fd, { method: "post" });
  }, [enforce, message, buffer, submit]);

  return (
    <Page
      title="Settings"
      primaryAction={{
        content: "Save",
        onAction: save,
        loading: navigation.state === "submitting",
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Checkout enforcement
              </Text>
              <Checkbox
                label="Block checkout when a cart exceeds true shared-pool availability"
                checked={enforce}
                onChange={setEnforce}
                helpText="Turning this off disables the oversell guard for all pools."
              />
              <FormLayout>
                <TextField
                  label="Block message shown to buyers"
                  value={message}
                  onChange={setMessage}
                  autoComplete="off"
                  helpText="Use {available} to insert the remaining quantity."
                  multiline
                />
                <TextField
                  label="Default safety buffer for new pools"
                  type="number"
                  value={buffer}
                  onChange={setBuffer}
                  autoComplete="off"
                  helpText="Held back from sellable availability to absorb the checkout race."
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Banner tone="info" title="How enforcement works">
            <p>
              StockSentry pushes availability into a product metafield that the Cart &amp;
              Checkout Validation Function reads on Shopify's servers. This blocks checkout
              in real time — including Shop Pay, Apple Pay, and Google Pay — on every plan,
              including Basic.
            </p>
          </Banner>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
