import { describe, it, expect, vi } from "vitest";
import {
  requestBillingWithDevFallback,
  type DevFallbackBilling,
} from "../app/lib/billingRequest.server";

const OPTS = { plan: "Starter", isTest: false, returnUrl: "https://x.test/app/billing" };

describe("requestBillingWithDevFallback", () => {
  it("propagates the redirect Response thrown on success (no retry)", async () => {
    const redirect = new Response(null, { status: 302 });
    const request = vi.fn().mockRejectedValue(redirect);
    const billing: DevFallbackBilling = { request };

    await expect(requestBillingWithDevFallback(billing, OPTS)).rejects.toBe(redirect);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(OPTS);
  });

  it("retries as a test charge when a real charge fails on a development store", async () => {
    const redirect = new Response(null, { status: 302 });
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("real charges are not allowed on a development store"))
      .mockRejectedValueOnce(redirect);
    const billing: DevFallbackBilling = { request };

    await expect(requestBillingWithDevFallback(billing, OPTS)).rejects.toBe(redirect);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(1, { ...OPTS, isTest: false });
    expect(request).toHaveBeenNthCalledWith(2, { ...OPTS, isTest: true });
  });

  it("does not retry (and rethrows) when the charge was already a test charge", async () => {
    const err = new Error("billing failed");
    const request = vi.fn().mockRejectedValue(err);
    const billing: DevFallbackBilling = { request };

    await expect(
      requestBillingWithDevFallback(billing, { ...OPTS, isTest: true }),
    ).rejects.toBe(err);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
