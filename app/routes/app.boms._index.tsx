import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Card,
  DataTable,
  EmptyState,
  Page,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { listBoms } from "../lib/boms.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const boms = await listBoms(session.shop);
  return { boms };
};

export default function BomsList() {
  const { boms } = useLoaderData<typeof loader>();

  const rows = boms.map((b) => [
    b.name,
    String(b.components.length),
    <Badge key={b.id} tone={b.finishedAvailable <= 0 ? "critical" : "success"}>
      {String(b.finishedAvailable)}
    </Badge>,
    b.salePrice ? `$${b.salePrice.toFixed(2)}` : "—",
    `$${b.cogs.toFixed(2)}`,
    `$${b.margin.toFixed(2)} (${b.marginPct}%)`,
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a key={`${b.id}-edit`} href={`/app/boms/${b.id}`}>
      Edit
    </a>,
  ]);

  return (
    <Page
      title="Bills of materials"
      subtitle="A finished product = components; sellable qty = whichever runs out first"
      primaryAction={{ content: "Create BOM", url: "/app/boms/new" }}
    >
      <Card padding={boms.length ? "0" : "400"}>
        {boms.length > 0 ? (
          <DataTable
            columnContentTypes={["text", "numeric", "text", "numeric", "numeric", "text", "text"]}
            headings={["Name", "Components", "Buildable", "Price", "COGS", "Margin", ""]}
            rows={rows}
          />
        ) : (
          <EmptyState
            heading="No bills of materials yet"
            action={{ content: "Create BOM", url: "/app/boms/new" }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <BlockStack gap="100">
              <Text as="p">
                Define a finished product made of components (pools or variants). StockSentry
                sells only as many as the first component allows.
              </Text>
            </BlockStack>
          </EmptyState>
        )}
      </Card>
    </Page>
  );
}
