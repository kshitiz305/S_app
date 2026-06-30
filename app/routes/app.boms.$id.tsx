import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
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
import { useCallback, useState } from "react";
import { authenticate } from "../shopify.server";
import { createBom, deleteBom, getBom, updateBom, type BomInput } from "../lib/boms.server";
import { listPools } from "../lib/pools.server";
import { lookupVariant } from "../lib/sync.server";

interface ComponentRow {
  kind: "pool" | "variant";
  ref: string;
  qtyPerFinished: number;
  costPerUnit: string;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;
  const pools = (await listPools(shopId, { sort: "name", direction: "asc" })).map((p) => ({
    id: p.id,
    name: p.name,
    unit: p.unit,
  }));

  if (params.id === "new") {
    return json({ mode: "new" as const, bom: null, pools });
  }
  const bom = await getBom(shopId, params.id!);
  if (!bom) throw new Response("Not found", { status: 404 });
  return json({ mode: "edit" as const, bom, pools });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shopId = session.shop;
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "delete") {
    if (params.id && params.id !== "new") await deleteBom(shopId, params.id);
    return redirect("/app/boms");
  }

  const components = JSON.parse(String(form.get("components") || "[]")) as ComponentRow[];
  const finishedVariantId = String(form.get("finishedVariantId") || "").trim();
  const name = String(form.get("name") || "").trim();

  if (!name) return json({ error: "Name is required." }, { status: 400 });
  if (!finishedVariantId) return json({ error: "Finished variant is required." }, { status: 400 });
  if (components.length === 0) return json({ error: "Add at least one component." }, { status: 400 });

  const finished = await lookupVariant(admin, finishedVariantId);

  const input: BomInput = {
    name,
    finishedVariantId,
    finishedProductId: finished?.productId ?? null,
    salePrice: form.get("salePrice") ? Number(form.get("salePrice")) : null,
    components: components.map((c) => ({
      kind: c.kind,
      ref: c.ref,
      qtyPerFinished: Number(c.qtyPerFinished) || 1,
      costPerUnit: c.costPerUnit ? Number(c.costPerUnit) : null,
    })),
  };

  if (params.id === "new") {
    const created = await createBom(shopId, input);
    return redirect(`/app/boms/${created.id}?saved=1`);
  }
  await updateBom(shopId, params.id!, input);
  return json({ saved: true });
};

export default function BomEditor() {
  const data = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isNew = data.mode === "new";
  const bom = data.bom;

  const [name, setName] = useState(bom?.name ?? "");
  const [finishedVariantId, setFinishedVariantId] = useState(bom?.finishedVariantId ?? "");
  const [salePrice, setSalePrice] = useState(bom?.salePrice ? String(bom.salePrice) : "");
  const [components, setComponents] = useState<ComponentRow[]>(
    bom?.components.map((c) => ({
      kind: c.kind,
      ref: c.ref,
      qtyPerFinished: c.qtyPerFinished,
      costPerUnit: c.costPerUnit != null ? String(c.costPerUnit) : "",
    })) ?? [],
  );

  const saving = navigation.state === "submitting";
  const poolOptions = [
    { label: "Select a pool…", value: "" },
    ...data.pools.map((p) => ({ label: `${p.name} (${p.unit})`, value: p.id })),
  ];

  const pickFinished = useCallback(async () => {
    const bridge = (globalThis as unknown as { shopify?: { resourcePicker?: Function } }).shopify;
    if (!bridge?.resourcePicker) return;
    const selection = (await bridge.resourcePicker({
      type: "product",
      multiple: false,
      action: "select",
    })) as Array<{ variants?: Array<{ id: string }> }> | undefined;
    const variantId = selection?.[0]?.variants?.[0]?.id;
    if (variantId) setFinishedVariantId(variantId);
  }, []);

  const addComponent = useCallback((kind: "pool" | "variant") => {
    setComponents((c) => [...c, { kind, ref: "", qtyPerFinished: 1, costPerUnit: "" }]);
  }, []);

  const updateComponent = useCallback((index: number, patch: Partial<ComponentRow>) => {
    setComponents((c) => c.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }, []);

  const removeComponent = useCallback((index: number) => {
    setComponents((c) => c.filter((_, i) => i !== index));
  }, []);

  const save = useCallback(() => {
    const fd = new FormData();
    fd.set("intent", "save");
    fd.set("name", name);
    fd.set("finishedVariantId", finishedVariantId);
    fd.set("salePrice", salePrice);
    fd.set("components", JSON.stringify(components));
    submit(fd, { method: "post" });
  }, [name, finishedVariantId, salePrice, components, submit]);

  return (
    <Page
      title={isNew ? "Create BOM" : bom?.name || "Edit BOM"}
      backAction={{ content: "Bills of materials", url: "/app/boms" }}
      primaryAction={{
        content: isNew ? "Create" : "Save",
        onAction: save,
        loading: saving,
        disabled: !name.trim() || !finishedVariantId.trim() || components.length === 0,
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
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Finished product
              </Text>
              <FormLayout>
                <TextField label="BOM name" value={name} onChange={setName} autoComplete="off" requiredIndicator />
                <FormLayout.Group>
                  <TextField
                    label="Finished variant GID"
                    value={finishedVariantId}
                    onChange={setFinishedVariantId}
                    placeholder="gid://shopify/ProductVariant/123"
                    autoComplete="off"
                    connectedRight={<Button onClick={pickFinished}>Pick</Button>}
                  />
                  <TextField
                    label="Sale price"
                    type="number"
                    prefix="$"
                    value={salePrice}
                    onChange={setSalePrice}
                    autoComplete="off"
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
                  Components
                </Text>
                <InlineStack gap="200">
                  <Button onClick={() => addComponent("pool")}>Add pool</Button>
                  <Button onClick={() => addComponent("variant")}>Add variant</Button>
                </InlineStack>
              </InlineStack>

              {components.length === 0 ? (
                <Text as="p" tone="subdued">
                  Add the pools and/or tracked variants this finished product consumes.
                </Text>
              ) : (
                <BlockStack gap="300">
                  {components.map((c, index) => (
                    <InlineStack key={index} gap="300" blockAlign="end" wrap={false}>
                      <Badge tone={c.kind === "pool" ? "info" : undefined}>{c.kind}</Badge>
                      <div style={{ flex: 1 }}>
                        {c.kind === "pool" ? (
                          <Select
                            label="Pool"
                            options={poolOptions}
                            value={c.ref}
                            onChange={(value) => updateComponent(index, { ref: value })}
                          />
                        ) : (
                          <TextField
                            label="Variant GID"
                            value={c.ref}
                            onChange={(value) => updateComponent(index, { ref: value })}
                            placeholder="gid://shopify/ProductVariant/123"
                            autoComplete="off"
                          />
                        )}
                      </div>
                      <div style={{ width: 120 }}>
                        <TextField
                          label="Qty / finished"
                          type="number"
                          value={String(c.qtyPerFinished)}
                          onChange={(value) =>
                            updateComponent(index, { qtyPerFinished: Number(value) || 0 })
                          }
                          autoComplete="off"
                        />
                      </div>
                      <div style={{ width: 120 }}>
                        <TextField
                          label="Unit cost"
                          type="number"
                          prefix="$"
                          value={c.costPerUnit}
                          onChange={(value) => updateComponent(index, { costPerUnit: value })}
                          autoComplete="off"
                        />
                      </div>
                      <Button variant="plain" tone="critical" onClick={() => removeComponent(index)}>
                        Remove
                      </Button>
                    </InlineStack>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Live numbers
              </Text>
              {bom ? (
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="span">Buildable now</Text>
                    <Badge
                      tone={
                        bom.finishedAvailable === null
                          ? undefined
                          : bom.finishedAvailable <= 0
                            ? "critical"
                            : "success"
                      }
                    >
                      {bom.finishedAvailable === null
                        ? "—"
                        : String(bom.finishedAvailable)}
                    </Badge>
                  </InlineStack>
                  {bom.constrainedBy.length > 0 ? (
                    <Text as="p" variant="bodySm" tone="subdued">
                      Runs out first: {bom.constrainedBy.join(", ")}
                    </Text>
                  ) : null}
                  <InlineStack align="space-between">
                    <Text as="span">COGS</Text>
                    <Text as="span">${bom.cogs.toFixed(2)}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span">Margin</Text>
                    <Text as="span">
                      ${bom.margin.toFixed(2)} ({bom.marginPct}%)
                    </Text>
                  </InlineStack>
                </BlockStack>
              ) : (
                <Banner tone="info">Save to compute buildable quantity and margin.</Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
