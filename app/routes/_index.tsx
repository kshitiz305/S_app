import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return { showForm: Boolean(login) };
};

export default function Index() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", maxWidth: 640, margin: "64px auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>StockSentry</h1>
      <p style={{ color: "#555", marginBottom: 24 }}>
        Shared-stock &amp; bill-of-materials inventory for Shopify that never oversells —
        even during flash sales, even on the Basic plan.
      </p>
      {showForm ? (
        <Form method="post" action="/auth/login" style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            name="shop"
            placeholder="my-shop-domain.myshopify.com"
            style={{ flex: 1, padding: "8px 12px", border: "1px solid #ccc", borderRadius: 8 }}
          />
          <button type="submit" style={{ padding: "8px 16px", borderRadius: 8 }}>
            Install
          </button>
        </Form>
      ) : null}
      <ul style={{ marginTop: 32, color: "#444", lineHeight: 1.8 }}>
        <li>Never oversell — enforced in real time at checkout.</li>
        <li>Never go negative, never falsely out-of-stock.</li>
        <li>Returns &amp; cancels restock both sides of shared pools.</li>
        <li>Foolproof setup with a one-click self-test.</li>
      </ul>
    </div>
  );
}
