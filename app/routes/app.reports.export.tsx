import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { consumptionCsv } from "../lib/reports.server";

// Resource route (no UI) — streams the consumption ledger as CSV.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const csv = await consumptionCsv(session.shop);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stocksentry-consumption.csv"`,
      "Cache-Control": "no-store",
    },
  });
};
