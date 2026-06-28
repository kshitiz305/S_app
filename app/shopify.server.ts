import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import type { BillingConfig } from "@shopify/shopify-api";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// NOTE: keep this in sync with `api_version` in shopify.app.toml.
export const API_VERSION = ApiVersion.October25;

// Recurring plans (DEVELOPMENT_SPEC §7 Phase 7). The Free tier is the default
// (no Shopify charge); paid tiers tier by monthly order volume.
export const PLANS = {
  STARTER: "Starter",
  GROWTH: "Growth",
  PRO: "Pro",
} as const;

// Annotated as BillingConfig so the (conditional, future-flag-generic) plan
// value type resolves to the legacy union and discriminates on `interval`.
const billing: BillingConfig = {
  [PLANS.STARTER]: {
    amount: 19,
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    trialDays: 7,
  },
  [PLANS.GROWTH]: {
    amount: 39,
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    trialDays: 7,
  },
  [PLANS.PRO]: {
    amount: 59,
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    trialDays: 7,
  },
};

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: API_VERSION,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  // Public App Store distribution is REQUIRED so the validation function runs on
  // all plans incl. Basic (DEVELOPMENT_SPEC §5).
  distribution: AppDistribution.AppStore,
  billing,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
