import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getShopSettings, updateShopSettings } from "../lib/shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;
  const [poolCount, bomCount, ledgerCount, settings] = await Promise.all([
    prisma.pool.count({ where: { shopId } }),
    prisma.bom.count({ where: { shopId } }),
    prisma.ledgerEntry.count({ where: { shopId } }),
    getShopSettings(shopId),
  ]);
  return { poolCount, bomCount, ledgerCount, settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await updateShopSettings(session.shop, { onboardedAt: new Date() });
  return json({ done: true });
};

export default function Onboarding() {
  const { poolCount, bomCount, ledgerCount, settings } = useLoaderData<typeof loader>();

  const steps = [
    {
      title: "Create your first inventory pool",
      done: poolCount > 0,
      detail: "Group the variants that share one physical stock.",
      action: { content: "Create pool", url: "/app/pools/new" },
    },
    {
      title: "Run the self-test",
      done: ledgerCount > 0 || poolCount > 0,
      detail: "Simulate an order and confirm before/after numbers on the pool page.",
      action: poolCount > 0 ? { content: "Open a pool", url: "/app/pools" } : undefined,
    },
    {
      title: "Turn on checkout enforcement",
      done: settings.enforceValidation,
      detail: "Block oversell in real time — including express checkouts.",
      action: { content: "Settings", url: "/app/settings" },
    },
    {
      title: "(Optional) Add a bill of materials",
      done: bomCount > 0,
      detail: "For finished products assembled from multiple components.",
      action: { content: "Create BOM", url: "/app/boms/new" },
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const allDone = completed >= 3;

  return (
    <Page title="Set up StockSentry" subtitle={`${completed} of ${steps.length} steps complete`}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {allDone ? (
              <Banner tone="success" title="You're protected">
                <p>Checkout is guarded against overselling. You can fine-tune anytime.</p>
              </Banner>
            ) : null}
            {steps.map((step) => (
              <Card key={step.title}>
                <InlineStack align="space-between" blockAlign="center" gap="400">
                  <BlockStack gap="100">
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone={step.done ? "success" : "attention"}>
                        {step.done ? "Done" : "To do"}
                      </Badge>
                      <Text as="h3" variant="headingSm">
                        {step.title}
                      </Text>
                    </InlineStack>
                    <Text as="p" tone="subdued" variant="bodySm">
                      {step.detail}
                    </Text>
                  </BlockStack>
                  {step.action ? (
                    <Button url={step.action.url}>{step.action.content}</Button>
                  ) : null}
                </InlineStack>
              </Card>
            ))}
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Finish
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Mark setup complete to dismiss the dashboard reminder. You can revisit these
                steps any time.
              </Text>
              <Form method="post">
                <Button submit variant="primary" disabled={!allDone}>
                  Mark setup complete
                </Button>
              </Form>
              {settings.onboardedAt ? (
                <Text as="p" tone="success" variant="bodySm">
                  Completed {new Date(settings.onboardedAt).toLocaleDateString()}.
                </Text>
              ) : null}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
