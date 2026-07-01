import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  InlineGrid,
  List,
  Page,
  Text,
} from "@shopify/polaris";
import { authenticate, PLANS } from "../shopify.server";
import { PLAN_DEFS, getUsageStatus, useTestBilling } from "../lib/billing.server";
import { requestBillingWithDevFallback } from "../lib/billingRequest.server";
import { getShopSettings, updateShopSettings } from "../lib/shop.server";

const PAID = [PLANS.STARTER, PLANS.GROWTH, PLANS.PRO];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);
  const usage = await getUsageStatus(session.shop, settings.plan);
  const isTest = await useTestBilling(admin);

  let activePlans: string[] | null = null;
  try {
    const result = await billing.check({ plans: PAID, isTest });
    activePlans = result.appSubscriptions?.map((s) => s.name) ?? [];
  } catch {
    // Couldn't reach Shopify Billing — leave the stored plan untouched rather
    // than misread a transient error as "no subscription" and downgrade a
    // paying merchant to Free.
    activePlans = null;
  }

  // Keep our stored plan honest with Shopify's source of truth, but only when we
  // actually determined it. On a billing-check failure, trust the stored plan.
  const effectivePlan = activePlans ? (activePlans[0] ?? "Free") : settings.plan;
  if (activePlans && effectivePlan !== settings.plan) {
    await updateShopSettings(session.shop, { plan: effectivePlan });
  }

  return json({ plans: PLAN_DEFS, usage, currentPlan: effectivePlan });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const isTest = await useTestBilling(admin);

  if (intent === "cancel") {
    const result = await billing.check({ plans: PAID, isTest });
    for (const sub of result.appSubscriptions ?? []) {
      await billing.cancel({ subscriptionId: sub.id, isTest, prorate: true });
    }
    await updateShopSettings(session.shop, { plan: "Free" });
    return json({ ok: true });
  }

  if (intent === "subscribe") {
    const plan = String(form.get("plan"));
    return requestBillingWithDevFallback(billing, {
      plan,
      isTest,
      returnUrl: `${process.env.SHOPIFY_APP_URL}/app/billing`,
    });
  }

  return json({ ok: false });
};

export default function Billing() {
  const { plans, usage, currentPlan } = useLoaderData<typeof loader>();

  return (
    <Page title="Plan & billing" subtitle="Tiered by monthly order volume · 7-day free trial">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Usage this month
            </Text>
            <Text as="p">
              {usage.ordersUsed} orders · {usage.poolsUsed} pools · current plan{" "}
              <Badge>{currentPlan}</Badge>
            </Text>
            {usage.overOrderLimit ? (
              <Text as="p" tone="critical">
                You are over your plan's monthly order limit. Recommended:{" "}
                {usage.recommended.name}.
              </Text>
            ) : null}
          </BlockStack>
        </Card>

        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          {plans.map((plan) => {
            const isCurrent = plan.name === currentPlan;
            return (
              <Card key={plan.name}>
                <BlockStack gap="300">
                  <InlineGrid columns="1fr auto">
                    <Text as="h3" variant="headingMd">
                      {plan.name}
                    </Text>
                    {isCurrent ? <Badge tone="success">Current</Badge> : null}
                  </InlineGrid>
                  <Text as="p" variant="heading2xl">
                    ${plan.price}
                    <Text as="span" variant="bodySm" tone="subdued">
                      {" "}
                      /mo
                    </Text>
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {plan.maxOrdersPerMonth === null
                      ? "Unlimited orders"
                      : `Up to ${plan.maxOrdersPerMonth} orders/mo`}
                    {" · "}
                    {plan.maxPools === null ? "unlimited pools" : `${plan.maxPools} pools`}
                  </Text>
                  <List>
                    {plan.features.map((f) => (
                      <List.Item key={f}>{f}</List.Item>
                    ))}
                  </List>
                  <Box>
                    {plan.name === "Free" ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="cancel" />
                        <Button submit disabled={isCurrent} fullWidth>
                          {isCurrent ? "Active" : "Downgrade to Free"}
                        </Button>
                      </Form>
                    ) : (
                      <Form method="post">
                        <input type="hidden" name="intent" value="subscribe" />
                        <input type="hidden" name="plan" value={plan.name} />
                        <Button submit variant="primary" disabled={isCurrent} fullWidth>
                          {isCurrent ? "Active" : `Choose ${plan.name}`}
                        </Button>
                      </Form>
                    )}
                  </Box>
                </BlockStack>
              </Card>
            );
          })}
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}
