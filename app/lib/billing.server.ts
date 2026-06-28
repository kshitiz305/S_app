/**
 * Billing helpers (DEVELOPMENT_SPEC §7 Phase 7).
 *
 * Tiers by monthly order volume. The Free tier has no Shopify charge; paid tiers
 * are defined in app/shopify.server.ts and charged via the Billing API.
 */

import prisma from "../db.server";
import { PLANS } from "../shopify.server";

export type PlanName = "Free" | (typeof PLANS)[keyof typeof PLANS];

export interface PlanDef {
  name: PlanName;
  price: number;
  /** Inclusive monthly order ceiling; null = unlimited. */
  maxOrdersPerMonth: number | null;
  /** Max pools the merchant may configure; null = unlimited. */
  maxPools: number | null;
  features: string[];
}

export const PLAN_DEFS: PlanDef[] = [
  {
    name: "Free",
    price: 0,
    maxOrdersPerMonth: 100,
    maxPools: 3,
    features: ["Shared pools", "BOM", "Oversell-proof checkout", "Reconciliation"],
  },
  {
    name: PLANS.STARTER,
    price: 19,
    maxOrdersPerMonth: 500,
    maxPools: 25,
    features: ["Everything in Free", "COGS / margins", "CSV export", "Low-stock alerts"],
  },
  {
    name: PLANS.GROWTH,
    price: 39,
    maxOrdersPerMonth: 2000,
    maxPools: 200,
    features: ["Everything in Starter", "Priority reconciliation"],
  },
  {
    name: PLANS.PRO,
    price: 59,
    maxOrdersPerMonth: null,
    maxPools: null,
    features: ["Everything in Growth", "Unlimited pools", "Unlimited orders"],
  },
];

export const PAID_PLAN_NAMES = [PLANS.STARTER, PLANS.GROWTH, PLANS.PRO] as string[];

export function planDef(name: string | null | undefined): PlanDef {
  return PLAN_DEFS.find((p) => p.name === name) ?? PLAN_DEFS[0];
}

/** Count orders this calendar month (distinct order ledger entries). */
export async function ordersThisMonth(shopId: string): Promise<number> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return prisma.ledgerEntry.count({
    where: { shopId, reason: "order", createdAt: { gte: start } },
  });
}

/** Recommend the cheapest plan that covers the shop's current order volume. */
export function recommendPlan(ordersPerMonth: number): PlanDef {
  return (
    PLAN_DEFS.find(
      (p) => p.maxOrdersPerMonth === null || ordersPerMonth <= p.maxOrdersPerMonth,
    ) ?? PLAN_DEFS[PLAN_DEFS.length - 1]
  );
}

export interface UsageStatus {
  plan: PlanDef;
  ordersUsed: number;
  poolsUsed: number;
  overOrderLimit: boolean;
  overPoolLimit: boolean;
  recommended: PlanDef;
}

/** Current usage vs the shop's plan limits — drives in-app gating + upsell. */
export async function getUsageStatus(shopId: string, planName: string): Promise<UsageStatus> {
  const plan = planDef(planName);
  const [ordersUsed, poolsUsed] = await Promise.all([
    ordersThisMonth(shopId),
    prisma.pool.count({ where: { shopId } }),
  ]);
  return {
    plan,
    ordersUsed,
    poolsUsed,
    overOrderLimit: plan.maxOrdersPerMonth !== null && ordersUsed > plan.maxOrdersPerMonth,
    overPoolLimit: plan.maxPools !== null && poolsUsed >= plan.maxPools,
    recommended: recommendPlan(ordersUsed),
  };
}

/** Can the shop create another pool under its plan? */
export async function canCreatePool(shopId: string, planName: string): Promise<boolean> {
  const plan = planDef(planName);
  if (plan.maxPools === null) return true;
  const count = await prisma.pool.count({ where: { shopId } });
  return count < plan.maxPools;
}
