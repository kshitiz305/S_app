/**
 * Billing request wrapper that lets development / test stores complete checkout.
 *
 * `billing.request` never returns normally: on success it throws a redirect
 * `Response` (App Bridge navigates the top window to Shopify's confirmation page),
 * and on failure it throws a `BillingError`. Shopify rejects REAL charges on
 * development stores, which is what surfaced as a generic 500 ("Application error")
 * when a merchant on a dev store clicked a paid plan.
 *
 * When we asked for a real charge (`isTest === false`) and it threw a non-Response
 * error, we retry once as a TEST charge. That keeps dev / staging stores working
 * while real merchant stores still get real charges.
 */

export interface BillingRequestOptions {
  plan: string;
  isTest: boolean;
  returnUrl: string;
}

export interface DevFallbackBilling {
  request(options: BillingRequestOptions): Promise<unknown>;
}

export async function requestBillingWithDevFallback(
  billing: DevFallbackBilling,
  options: BillingRequestOptions,
): Promise<never> {
  try {
    await billing.request(options);
  } catch (error) {
    // A thrown Response IS the success path (the App Bridge redirect) — propagate it.
    if (error instanceof Response) throw error;
    // Shopify rejects real charges on development stores. If we attempted a real
    // charge and it failed, retry once as a test charge so dev / staging stores can
    // finish subscribing instead of surfacing a generic 500.
    if (!options.isTest) {
      await billing.request({ ...options, isTest: true });
      throw new Error("Billing request did not redirect after test-charge retry.");
    }
    throw error;
  }
  // billing.request always throws (redirect Response on success, error on failure);
  // reaching here means the contract changed.
  throw new Error("Billing request did not redirect.");
}
