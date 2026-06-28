/**
 * Per-shop settings + billing state helpers (used by the function-settings UI,
 * billing gate, and metafield writer).
 */

import prisma from "../db.server";
import { Prisma } from "@prisma/client";

export const DEFAULT_BLOCK_MESSAGE =
  "Only {available} left in stock — please reduce the quantity.";

export interface ShopSettings {
  shopId: string;
  plan: string;
  enforceValidation: boolean;
  blockMessage: string;
  defaultBuffer: number;
  onboardedAt: Date | null;
  lastReconciledAt: Date | null;
}

export async function getOrCreateShop(shopId: string) {
  try {
    return await prisma.shop.upsert({
      where: { shopId },
      create: { shopId },
      update: {},
    });
  } catch (error) {
    // Remix runs nested route loaders in parallel, so on the very first app open
    // two requests can both try to INSERT the Shop row. Recover from the
    // unique-constraint race (P2002) by reading the row the other request made.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return prisma.shop.findUniqueOrThrow({ where: { shopId } });
    }
    throw error;
  }
}

export async function getShopSettings(shopId: string): Promise<ShopSettings> {
  const shop = await getOrCreateShop(shopId);
  return {
    shopId: shop.shopId,
    plan: shop.plan,
    enforceValidation: shop.enforceValidation,
    blockMessage: shop.blockMessage || DEFAULT_BLOCK_MESSAGE,
    defaultBuffer: Number(shop.defaultBuffer),
    onboardedAt: shop.onboardedAt,
    lastReconciledAt: shop.lastReconciledAt,
  };
}

export async function updateShopSettings(
  shopId: string,
  data: Partial<{
    enforceValidation: boolean;
    blockMessage: string;
    defaultBuffer: number;
    plan: string;
    onboardedAt: Date | null;
    lastReconciledAt: Date | null;
  }>,
) {
  await getOrCreateShop(shopId);
  return prisma.shop.update({ where: { shopId }, data });
}
