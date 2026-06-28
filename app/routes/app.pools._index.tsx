import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  EmptyState,
  IndexTable,
  InlineStack,
  Page,
  Select,
  Text,
  TextField,
  useBreakpoints,
} from "@shopify/polaris";
import { useCallback } from "react";
import { authenticate } from "../shopify.server";
import { listPools, type PoolListOptions } from "../lib/pools.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const options: PoolListOptions = {
    query: url.searchParams.get("q") ?? undefined,
    sort: (url.searchParams.get("sort") as PoolListOptions["sort"]) ?? "updated",
    direction: (url.searchParams.get("dir") as "asc" | "desc") ?? "desc",
  };
  const pools = await listPools(session.shop, options);
  return { pools, options };
};

const SORT_OPTIONS = [
  { label: "Recently updated", value: "updated" },
  { label: "Name", value: "name" },
  { label: "On hand", value: "onHand" },
];

export default function PoolsList() {
  const { pools, options } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { smUp } = useBreakpoints();

  // State lives in the URL, so it is preserved on back-navigation (SPEC §2.1).
  const updateParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(key, value);
      else next.delete(key);
      setSearchParams(next, { preventScrollReset: true });
    },
    [searchParams, setSearchParams],
  );

  const rowMarkup = pools.map((pool, index) => (
    <IndexTable.Row id={pool.id} key={pool.id} position={index}>
      <IndexTable.Cell>
        <Text as="span" fontWeight="semibold">
          {pool.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{pool.unit}</IndexTable.Cell>
      <IndexTable.Cell>{pool.totalOnHand}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={pool.available <= 0 ? "critical" : "success"}>
          {String(pool.available)}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>{pool.memberCount}</IndexTable.Cell>
      <IndexTable.Cell>
        <Button url={`/app/pools/${pool.id}`} variant="plain">
          Edit
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Inventory pools"
      primaryAction={{ content: "Create pool", url: "/app/pools/new" }}
    >
      <Card padding="0">
        <Box>
          <BlockStack gap="300">
            <div style={{ padding: 16 }}>
              <InlineStack gap="300" align="space-between" blockAlign="end">
                <div style={{ flex: 1, minWidth: 240 }}>
                  <TextField
                    label="Search pools"
                    labelHidden
                    name="q"
                    value={options.query ?? ""}
                    onChange={(value) => updateParam("q", value)}
                    placeholder="Search by pool name"
                    autoComplete="off"
                    clearButton
                    onClearButtonClick={() => updateParam("q", "")}
                  />
                </div>
                <InlineStack gap="200">
                  <Select
                    label="Sort by"
                    labelInline
                    options={SORT_OPTIONS}
                    value={options.sort ?? "updated"}
                    onChange={(value) => updateParam("sort", value)}
                  />
                  <Button
                    onClick={() =>
                      updateParam("dir", options.direction === "asc" ? "desc" : "asc")
                    }
                  >
                    {options.direction === "asc" ? "Ascending" : "Descending"}
                  </Button>
                </InlineStack>
              </InlineStack>
            </div>

            {pools.length > 0 ? (
              <IndexTable
                condensed={!smUp}
                itemCount={pools.length}
                selectable={false}
                headings={[
                  { title: "Pool" },
                  { title: "Unit" },
                  { title: "On hand" },
                  { title: "Available" },
                  { title: "Members" },
                  { title: "" },
                ]}
              >
                {rowMarkup}
              </IndexTable>
            ) : (
              <EmptyState
                heading="No pools yet"
                action={{ content: "Create pool", url: "/app/pools/new" }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Group variants that share one physical stock so they never oversell.</p>
              </EmptyState>
            )}
          </BlockStack>
        </Box>
      </Card>
    </Page>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
