import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useFetcher, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  FormLayout,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { useCallback, useMemo, useState } from "react";
import { authenticate } from "../shopify.server";
import {
  createPool,
  deletePool,
  getPool,
  syncPoolToShopify,
  updatePool,
  type PoolInput,
  type PoolMemberInput,
} from "../lib/pools.server";
import { lookupVariant } from "../lib/sync.server";
import { getShopSettings } from "../lib/shop.server";
import { canCreatePool } from "../lib/billing.server";
import { reconcilePool } from "../lib/reconcile.server";
import { runSelfTest, type SelfTestResult } from "../lib/selftest.server";

interface MemberRow {
  variantId: string;
  title: string | null;
  sku: string | null;
  productId: string | null;
  inventoryItemId: string | null;
  consumesPerUnit: number;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;
  const settings = await getShopSettings(shopId);

  if (params.id === "new") {
    return json({
      mode: "new" as const,
      allowed: await canCreatePool(shopId, settings.plan),
      defaultBuffer: settings.defaultBuffer,
      pool: null,
    });
  }

  const pool = await getPool(shopId, params.id!);
  if (!pool) throw new Response("Not found", { status: 404 });

  return json({
    mode: "edit" as const,
    allowed: true,
    defaultBuffer: settings.defaultBuffer,
    pool: {
      id: pool.id,
      name: pool.name,
      unit: pool.unit,
      totalOnHand: pool.totalOnHandNum,
      buffer: pool.bufferNum,
      lowStockThreshold: pool.lowStockThreshold == null ? "" : String(pool.lowStockThreshold),
      costPerUnit: pool.costPerUnit == null ? "" : String(pool.costPerUnit),
      reconcileMode: pool.reconcileMode,
      available: pool.available,
      members: pool.members.map((m) => ({
        variantId: m.variantId,
        title: m.title,
        sku: m.sku,
        productId: m.productId,
        inventoryItemId: m.inventoryItemId,
        consumesPerUnit: Number(m.consumesPerUnit),
      })),
    },
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shopId = session.shop;
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "delete") {
    if (params.id && params.id !== "new") await deletePool(shopId, params.id);
    return redirect("/app/pools");
  }

  if (intent === "selftest") {
    if (!params.id || params.id === "new") return json({ selfTest: null });
    const selfTest = await runSelfTest(shopId, params.id);
    return json({ selfTest });
  }

  if (intent === "reconcile") {
    if (!params.id || params.id === "new") return json({ reconciled: false });
    await reconcilePool(admin, shopId, params.id);
    return json({ reconciled: true });
  }

  // intent === "save"
  const members = JSON.parse(String(form.get("members") || "[]")) as MemberRow[];
  if (members.length === 0) {
    return json({ error: "Add at least one member variant." }, { status: 400 });
  }

  // Enrich any members missing product/inventory metadata (manual GID entry).
  const enriched: PoolMemberInput[] = [];
  for (const m of members) {
    let { productId, inventoryItemId, title, sku } = m;
    if (!productId || !inventoryItemId) {
      const details = await lookupVariant(admin, m.variantId);
      if (details) {
        productId = productId ?? details.productId;
        inventoryItemId = inventoryItemId ?? details.inventoryItemId;
        title = title ?? (details.productTitle ? `${details.productTitle} – ${details.title}` : details.title);
        sku = sku ?? details.sku;
      }
    }
    enriched.push({
      variantId: m.variantId,
      consumesPerUnit: Number(m.consumesPerUnit) || 1,
      productId,
      inventoryItemId,
      title,
      sku,
    });
  }

  const input: PoolInput = {
    name: String(form.get("name") || "").trim(),
    unit: String(form.get("unit") || "each"),
    totalOnHand: Number(form.get("totalOnHand")) || 0,
    buffer: Number(form.get("buffer")) || 0,
    lowStockThreshold: form.get("lowStockThreshold")
      ? Number(form.get("lowStockThreshold"))
      : null,
    costPerUnit: form.get("costPerUnit") ? Number(form.get("costPerUnit")) : null,
    reconcileMode: (String(form.get("reconcileMode")) as PoolInput["reconcileMode"]) || "respectManual",
    members: enriched,
  };

  if (!input.name) return json({ error: "Pool name is required." }, { status: 400 });

  if (params.id === "new") {
    const created = await createPool(shopId, input);
    await syncPoolToShopify(admin, shopId, created.id);
    return redirect(`/app/pools/${created.id}?saved=1`);
  }

  await updatePool(shopId, params.id!, input);
  await syncPoolToShopify(admin, shopId, params.id!);
  return json({ saved: true });
};

const UNITS = ["each", "oz", "ml", "g", "kg", "lb"].map((u) => ({ label: u, value: u }));
const RECONCILE_MODES = [
  { label: "Respect manual edits (recommended)", value: "respectManual" },
  { label: "App is authoritative", value: "authoritative" },
];

export default function PoolEditor() {
  const data = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const selfTestFetcher = useFetcher<{ selfTest: SelfTestResult | null }>();
  const reconcileFetcher = useFetcher<{ reconciled: boolean }>();

  const isNew = data.mode === "new";
  const pool = data.pool;

  const [name, setName] = useState(pool?.name ?? "");
  const [unit, setUnit] = useState(pool?.unit ?? "each");
  const [totalOnHand, setTotalOnHand] = useState(String(pool?.totalOnHand ?? "0"));
  const [buffer, setBuffer] = useState(String(pool?.buffer ?? data.defaultBuffer ?? "0"));
  const [lowStockThreshold, setLowStockThreshold] = useState(pool?.lowStockThreshold ?? "");
  const [costPerUnit, setCostPerUnit] = useState(pool?.costPerUnit ?? "");
  const [reconcileMode, setReconcileMode] = useState(pool?.reconcileMode ?? "respectManual");
  const [members, setMembers] = useState<MemberRow[]>(pool?.members ?? []);

  const saving = navigation.state === "submitting";

  const pickProducts = useCallback(async () => {
    const bridge = (globalThis as unknown as { shopify?: { resourcePicker?: Function } }).shopify;
    if (!bridge?.resourcePicker) {
      return;
    }
    const selection = (await bridge.resourcePicker({
      type: "product",
      multiple: true,
      action: "select",
    })) as Array<{
      id: string;
      title: string;
      variants?: Array<{ id: string; title?: string; sku?: string; inventoryItem?: { id?: string } }>;
    }> | undefined;
    if (!selection) return;

    setMembers((current) => {
      const byId = new Map(current.map((m) => [m.variantId, m]));
      for (const product of selection) {
        for (const variant of product.variants ?? []) {
          if (byId.has(variant.id)) continue;
          byId.set(variant.id, {
            variantId: variant.id,
            title: `${product.title}${variant.title ? ` – ${variant.title}` : ""}`,
            sku: variant.sku ?? null,
            productId: product.id,
            inventoryItemId: variant.inventoryItem?.id ?? null,
            consumesPerUnit: 1,
          });
        }
      }
      return [...byId.values()];
    });
  }, []);

  const [manualGid, setManualGid] = useState("");
  const addManual = useCallback(() => {
    const gid = manualGid.trim();
    if (!gid) return;
    setMembers((current) =>
      current.some((m) => m.variantId === gid)
        ? current
        : [
            ...current,
            {
              variantId: gid,
              title: null,
              sku: null,
              productId: null,
              inventoryItemId: null,
              consumesPerUnit: 1,
            },
          ],
    );
    setManualGid("");
  }, [manualGid]);

  const updateConsumes = useCallback((variantId: string, value: string) => {
    const num = Number(value);
    setMembers((current) =>
      current.map((m) =>
        m.variantId === variantId ? { ...m, consumesPerUnit: Number.isFinite(num) ? num : 0 } : m,
      ),
    );
  }, []);

  const removeMember = useCallback((variantId: string) => {
    setMembers((current) => current.filter((m) => m.variantId !== variantId));
  }, []);

  const save = useCallback(() => {
    const fd = new FormData();
    fd.set("intent", "save");
    fd.set("name", name);
    fd.set("unit", unit);
    fd.set("totalOnHand", totalOnHand);
    fd.set("buffer", buffer);
    fd.set("lowStockThreshold", lowStockThreshold);
    fd.set("costPerUnit", costPerUnit);
    fd.set("reconcileMode", reconcileMode);
    fd.set("members", JSON.stringify(members));
    submit(fd, { method: "post" });
  }, [name, unit, totalOnHand, buffer, lowStockThreshold, costPerUnit, reconcileMode, members, submit]);

  const selfTest = selfTestFetcher.data?.selfTest;

  const totalConsumes = useMemo(
    () => members.reduce((sum, m) => sum + (Number(m.consumesPerUnit) || 0), 0),
    [members],
  );

  return (
    <Page
      title={isNew ? "Create pool" : pool?.name || "Edit pool"}
      backAction={{ content: "Pools", url: "/app/pools" }}
      primaryAction={{
        content: isNew ? "Create pool" : "Save",
        onAction: save,
        loading: saving,
        disabled: !data.allowed || members.length === 0 || !name.trim(),
      }}
      secondaryActions={
        isNew
          ? []
          : [
              {
                content: "Delete",
                destructive: true,
                onAction: () => submit({ intent: "delete" }, { method: "post" }),
              },
            ]
      }
    >
      <BlockStack gap="400">
        {!data.allowed ? (
          <Banner tone="warning" title="Plan limit reached" action={{ content: "Upgrade", url: "/app/billing" }}>
            <p>You've reached the pool limit for your plan. Upgrade to add more.</p>
          </Banner>
        ) : null}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Pool details
                </Text>
                <FormLayout>
                  <TextField
                    label="Pool name"
                    value={name}
                    onChange={setName}
                    autoComplete="off"
                    requiredIndicator
                  />
                  <FormLayout.Group>
                    <Select label="Unit" options={UNITS} value={unit} onChange={setUnit} />
                    <TextField
                      label="Total on hand"
                      type="number"
                      value={totalOnHand}
                      onChange={setTotalOnHand}
                      autoComplete="off"
                      helpText="Physical units that exist in the shared pool."
                    />
                  </FormLayout.Group>
                  <FormLayout.Group>
                    <TextField
                      label="Safety buffer"
                      type="number"
                      value={buffer}
                      onChange={setBuffer}
                      autoComplete="off"
                      helpText="Held back from sellable availability to absorb the checkout race."
                    />
                    <TextField
                      label="Low-stock threshold"
                      type="number"
                      value={lowStockThreshold}
                      onChange={setLowStockThreshold}
                      autoComplete="off"
                    />
                  </FormLayout.Group>
                  <FormLayout.Group>
                    <TextField
                      label="Cost per unit (COGS)"
                      type="number"
                      prefix="$"
                      value={costPerUnit}
                      onChange={setCostPerUnit}
                      autoComplete="off"
                    />
                    <Select
                      label="Manual-edit handling"
                      options={RECONCILE_MODES}
                      value={reconcileMode}
                      onChange={setReconcileMode}
                    />
                  </FormLayout.Group>
                </FormLayout>
              </BlockStack>
            </Card>

            <div style={{ height: 16 }} />

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Member variants
                  </Text>
                  <Button onClick={pickProducts}>Add products</Button>
                </InlineStack>

                {members.length === 0 ? (
                  <Text as="p" tone="subdued">
                    No members yet. Use “Add products”, or paste a variant GID below.
                  </Text>
                ) : (
                  <BlockStack gap="200">
                    {members.map((m) => (
                      <InlineStack key={m.variantId} align="space-between" blockAlign="center" gap="300">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text as="span" fontWeight="medium" truncate>
                            {m.title ?? m.variantId}
                          </Text>
                          {m.sku ? (
                            <Text as="span" tone="subdued" variant="bodySm">
                              {` SKU ${m.sku}`}
                            </Text>
                          ) : null}
                        </div>
                        <div style={{ width: 160 }}>
                          <TextField
                            label="Consumes per unit"
                            labelHidden
                            type="number"
                            value={String(m.consumesPerUnit)}
                            onChange={(value) => updateConsumes(m.variantId, value)}
                            autoComplete="off"
                            suffix={unit}
                          />
                        </div>
                        <Button variant="plain" tone="critical" onClick={() => removeMember(m.variantId)}>
                          Remove
                        </Button>
                      </InlineStack>
                    ))}
                  </BlockStack>
                )}

                <InlineStack gap="200" blockAlign="end">
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Add by variant GID"
                      value={manualGid}
                      onChange={setManualGid}
                      placeholder="gid://shopify/ProductVariant/123"
                      autoComplete="off"
                    />
                  </div>
                  <Button onClick={addManual}>Add</Button>
                </InlineStack>
                <Text as="p" tone="subdued" variant="bodySm">
                  Sum of consume rates: {totalConsumes} {unit} per one unit each.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            {!isNew && pool ? (
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Self-test
                  </Text>
                  <InlineStack align="space-between">
                    <Text as="span">Available now</Text>
                    <Badge tone={pool.available <= 0 ? "critical" : "success"}>
                      {String(pool.available)}
                    </Badge>
                  </InlineStack>
                  <selfTestFetcher.Form method="post">
                    <input type="hidden" name="intent" value="selftest" />
                    <Button submit loading={selfTestFetcher.state !== "idle"}>
                      Simulate an order
                    </Button>
                  </selfTestFetcher.Form>

                  {selfTest ? (
                    <BlockStack gap="200">
                      <Banner tone={selfTest.ok ? "success" : "warning"}>
                        {selfTest.ok
                          ? "Linking verified — this pool is protecting checkout."
                          : "Some checks failed — review below."}
                      </Banner>
                      <Text as="p" variant="bodySm">
                        After selling 1 unit: {selfTest.available} → {selfTest.afterOneUnit}
                        {selfTest.blocksAtQuantity
                          ? ` · checkout blocks at qty ${selfTest.blocksAtQuantity}`
                          : ""}
                      </Text>
                      <BlockStack gap="100">
                        {selfTest.checks.map((c) => (
                          <InlineStack key={c.label} gap="200" blockAlign="center">
                            <Badge tone={c.pass ? "success" : "critical"}>
                              {c.pass ? "Pass" : "Fail"}
                            </Badge>
                            <Text as="span" variant="bodySm">
                              {c.label}
                            </Text>
                          </InlineStack>
                        ))}
                      </BlockStack>
                    </BlockStack>
                  ) : null}

                  <reconcileFetcher.Form method="post">
                    <input type="hidden" name="intent" value="reconcile" />
                    <Button submit variant="plain" loading={reconcileFetcher.state !== "idle"}>
                      Re-push to Shopify
                    </Button>
                  </reconcileFetcher.Form>
                  {reconcileFetcher.data?.reconciled ? (
                    <Text as="p" tone="success" variant="bodySm">
                      Availability re-synced.
                    </Text>
                  ) : null}
                </BlockStack>
              </Card>
            ) : (
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    How pools work
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Add the variants that draw from one physical stock. Set how much each
                    variant consumes per unit (e.g. 0.5 for a half-size). StockSentry keeps
                    Shopify correct and blocks checkout the instant true stock runs out.
                  </Text>
                </BlockStack>
              </Card>
            )}
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
