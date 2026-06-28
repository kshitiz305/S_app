/**
 * Shopify write layer (DEVELOPMENT_SPEC §7 Phase 2.4 / Phase 3.3).
 *
 * The backend is the source of truth. Before checkout it pushes pool
 * availability into:
 *   1. the anchor product metafield ($app:inventory / pool, type json) that the
 *      Cart & Checkout Validation Function reads, and
 *   2. each member variant's native Shopify "available" inventory (so the admin
 *      and storefront reflect the shared pool, and the optional "hidden
 *      component product" pattern can leverage native atomic reservation).
 *
 * All GraphQL operations here were validated against the Admin API 2026-04
 * schema.
 */

import type { PoolMemberConfig } from "../domain/types";

export const POOL_METAFIELD_NAMESPACE = "$app:inventory";
export const POOL_METAFIELD_KEY = "pool";

/** A thin structural type for the Remix Admin GraphQL client. */
export interface AdminGraphql {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
}

/** Exact JSON written to the metafield and read by the checkout function. */
export interface PoolMetafieldValue {
  poolId: string;
  available: number;
  unit: string;
  enforce: boolean;
  message: string;
  members: PoolMemberConfig[];
}

const SET_POOL_METAFIELD = /* GraphQL */ `
  mutation SetPoolMetafield($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id namespace key value }
      userErrors { field message code }
    }
  }
`;

const SET_AVAILABLE = /* GraphQL */ `
  mutation SetAvailable($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      inventoryAdjustmentGroup { createdAt reason }
      userErrors { field message code }
    }
  }
`;

const VARIANT_FOR_POOL = /* GraphQL */ `
  query VariantForPool($id: ID!) {
    productVariant(id: $id) {
      id
      title
      sku
      product { id title }
      inventoryItem { id tracked }
    }
  }
`;

const PRIMARY_LOCATION = /* GraphQL */ `
  query PrimaryLocation {
    location { id name }
  }
`;

interface GraphqlUserError {
  field?: string[] | null;
  message: string;
  code?: string | null;
}

function assertNoUserErrors(errors: GraphqlUserError[] | undefined, op: string) {
  if (errors && errors.length > 0) {
    throw new Error(`${op} failed: ${errors.map((e) => e.message).join("; ")}`);
  }
}

/** Write the pool config + current availability to the anchor product metafield. */
export async function writePoolMetafield(
  admin: AdminGraphql,
  anchorProductId: string,
  value: PoolMetafieldValue,
): Promise<void> {
  const response = await admin.graphql(SET_POOL_METAFIELD, {
    variables: {
      metafields: [
        {
          ownerId: anchorProductId,
          namespace: POOL_METAFIELD_NAMESPACE,
          key: POOL_METAFIELD_KEY,
          type: "json",
          value: JSON.stringify(value),
        },
      ],
    },
  });
  const body = (await response.json()) as {
    data?: { metafieldsSet?: { userErrors?: GraphqlUserError[] } };
  };
  assertNoUserErrors(body.data?.metafieldsSet?.userErrors, "metafieldsSet");
}

/** Set a variant's native Shopify "available" inventory to an absolute value. */
export async function setVariantAvailable(
  admin: AdminGraphql,
  params: { inventoryItemId: string; locationId: string; quantity: number },
): Promise<void> {
  const response = await admin.graphql(SET_AVAILABLE, {
    variables: {
      input: {
        name: "available",
        reason: "correction",
        // Our atomic backend + checkout function are the real oversell guard, so
        // we overwrite rather than compare-and-set here.
        ignoreCompareQuantity: true,
        quantities: [
          {
            inventoryItemId: params.inventoryItemId,
            locationId: params.locationId,
            quantity: Math.max(0, Math.trunc(params.quantity)),
          },
        ],
      },
    },
  });
  const body = (await response.json()) as {
    data?: { inventorySetQuantities?: { userErrors?: GraphqlUserError[] } };
  };
  assertNoUserErrors(body.data?.inventorySetQuantities?.userErrors, "inventorySetQuantities");
}

export interface VariantDetails {
  variantId: string;
  title: string | null;
  sku: string | null;
  productId: string | null;
  productTitle: string | null;
  inventoryItemId: string | null;
  tracked: boolean;
}

/** Resolve a variant GID to the details we persist on a PoolMember. */
export async function lookupVariant(
  admin: AdminGraphql,
  variantId: string,
): Promise<VariantDetails | null> {
  const response = await admin.graphql(VARIANT_FOR_POOL, { variables: { id: variantId } });
  const body = (await response.json()) as {
    data?: {
      productVariant?: {
        id: string;
        title: string | null;
        sku: string | null;
        product: { id: string; title: string } | null;
        inventoryItem: { id: string; tracked: boolean } | null;
      } | null;
    };
  };
  const v = body.data?.productVariant;
  if (!v) return null;
  return {
    variantId: v.id,
    title: v.title,
    sku: v.sku,
    productId: v.product?.id ?? null,
    productTitle: v.product?.title ?? null,
    inventoryItemId: v.inventoryItem?.id ?? null,
    tracked: v.inventoryItem?.tracked ?? false,
  };
}

/** The shop's primary location GID, used as the inventory write target. */
export async function getPrimaryLocationId(admin: AdminGraphql): Promise<string | null> {
  const response = await admin.graphql(PRIMARY_LOCATION);
  const body = (await response.json()) as {
    data?: { location?: { id: string } | null };
  };
  return body.data?.location?.id ?? null;
}
