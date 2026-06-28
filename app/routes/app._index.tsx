import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  DataTable,
  InlineGrid,
  InlineStack,
  Layout,
  Link as PolarisLink,
  Page,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { dashboardData } from "../lib/reports.server";
import { getShopSettings } from "../lib/shop.server";
import { getUsageStatus } from "../lib/billing.server";
import { reconcileShop } from "../lib/reconcile.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;
  const [data, settings] = await Promise.all([
    dashboardData(shopId),
    getShopSettings(shopId),
  ]);
  const usage = await getUsageStatus(shopId, settings.plan);
  return { data, settings, usage };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const results = await reconcileShop(admin, session.shop);
  return { reconciled: results.length };
};

export default function Dashboard() {
  const { data, settings, usage } = useLoaderData<typeof loader>();
  const reconcile = useFetcher<typeof action>();

  const lastReconciled = settings.lastReconciledAt
    ? new Date(settings.lastReconciledAt).toLocaleString()
    : "never";

  const consumptionRows = data.recent.map((r) => [
    r.poolName,
    <Badge key={r.id} tone={r.delta < 0 ? "warning" : "success"}>
      {`${r.delta > 0 ? "+" : ""}${r.delta} ${r.unit}`}
    </Badge>,
    r.reason,
    r.sourceId ?? "—",
    new Date(r.createdAt).toLocaleString(),
  ]);

  return (
    <Page
      title="StockSentry"
      subtitle="Shared-stock & BOM inventory that never oversells"
      primaryAction={{ content: "Create pool", url: "/app/pools/new" }}
      secondaryActions={[{ content: "Set up wizard", url: "/app/onboarding" }]}
    >
      <BlockStack gap="400">
        {data.poolCount === 0 ? (
          <Banner
            title="Create your first inventory pool"
            tone="info"
            action={{ content: "Start setup", url: "/app/onboarding" }}
          >
            <p>
              A pool lets many variants share one physical stock. Once linked,
              StockSentry blocks checkout the instant true stock runs out.
            </p>
          </Banner>
        ) : null}

        {usage.overOrderLimit ? (
          <Banner
            title="You've exceeded your plan's monthly order limit"
            tone="warning"
            action={{ content: "Upgrade plan", url: "/app/billing" }}
          >
            <p>
              {usage.ordersUsed} orders this month on the {usage.plan.name} plan.
              Upgrade to keep protection uninterrupted.
            </p>
          </Banner>
        ) : null}

        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <StatCard label="Pools" value={String(data.poolCount)} />
          <StatCard label="Bills of materials" value={String(data.bomCount)} />
          <StatCard
            label="Low stock"
            value={String(data.lowStockCount)}
            tone={data.lowStockCount > 0 ? "critical" : "success"}
          />
          <StatCard label="Orders this month" value={String(usage.ordersUsed)} />
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Recent consumption
                  </Text>
                  <PolarisLink url="/app/reports">View reports</PolarisLink>
                </InlineStack>
                {consumptionRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text"]}
                    headings={["Pool", "Change", "Reason", "Source", "When"]}
                    rows={consumptionRows}
                  />
                ) : (
                  <Text as="p" tone="subdued">
                    No ledger activity yet. Place a test order to see it here.
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Health
                </Text>
                <InlineStack align="space-between">
                  <Text as="span">Checkout enforcement</Text>
                  <Badge tone={settings.enforceValidation ? "success" : "attention"}>
                    {settings.enforceValidation ? "On" : "Off"}
                  </Badge>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span">Plan</Text>
                  <Badge>{usage.plan.name}</Badge>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span">Last reconciled</Text>
                  <Text as="span" tone="subdued">
                    {lastReconciled}
                  </Text>
                </InlineStack>
                <reconcile.Form method="post">
                  <Button submit loading={reconcile.state !== "idle"} variant="primary">
                    Reconcile now
                  </Button>
                </reconcile.Form>
                {reconcile.data?.reconciled !== undefined ? (
                  <Text as="p" tone="success">
                    Reconciled {reconcile.data.reconciled} pool(s).
                  </Text>
                ) : null}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
      <Box paddingBlockEnd="400" />
    </Page>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "critical" | "success";
}) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text as="span" tone="subdued" variant="bodySm">
          {label}
        </Text>
        <Text as="span" variant="heading2xl" tone={tone}>
          {value}
        </Text>
      </BlockStack>
    </Card>
  );
}
