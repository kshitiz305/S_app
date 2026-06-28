import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  DataTable,
  InlineStack,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { poolRows, recentConsumption } from "../lib/reports.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;
  const [pools, recent] = await Promise.all([
    poolRows(shopId),
    recentConsumption(shopId, 50),
  ]);
  return { pools, recent };
};

export default function Reports() {
  const { pools, recent } = useLoaderData<typeof loader>();

  const poolTable = pools.map((p) => [
    p.name,
    p.unit,
    String(p.totalOnHand),
    <Badge key={p.id} tone={p.available <= 0 ? "critical" : "success"}>
      {String(p.available)}
    </Badge>,
    p.lowStock ? <Badge key={`${p.id}-low`} tone="warning">Low</Badge> : "OK",
    String(p.memberCount),
  ]);

  const consumptionTable = recent.map((r) => [
    new Date(r.createdAt).toLocaleString(),
    r.poolName,
    r.reason,
    r.sourceId ?? "—",
    `${r.delta > 0 ? "+" : ""}${r.delta} ${r.unit}`,
  ]);

  return (
    <Page
      title="Reports"
      primaryAction={{
        content: "Export consumption CSV",
        url: "/app/reports/export",
        external: true,
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Pool levels
              </Text>
              {pools.length ? (
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "text", "text", "numeric"]}
                  headings={["Pool", "Unit", "On hand", "Available", "Status", "Members"]}
                  rows={poolTable}
                />
              ) : (
                <Text as="p" tone="subdued">
                  No pools yet.
                </Text>
              )}
            </BlockStack>
          </Card>

          <div style={{ height: 16 }} />

          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Consumption ledger
                </Text>
                <Button url="/app/reports/export" external>
                  Download CSV
                </Button>
              </InlineStack>
              {recent.length ? (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "numeric"]}
                  headings={["When", "Pool", "Reason", "Source", "Change"]}
                  rows={consumptionTable}
                />
              ) : (
                <Text as="p" tone="subdued">
                  No ledger activity yet.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
