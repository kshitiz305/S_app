import type { HeadersFunction, LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { getOrCreateShop } from "../lib/shop.server";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  // Ensure a Shop settings row exists for this shop.
  await getOrCreateShop(session.shop);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/pools">Pools</Link>
        <Link to="/app/boms">Bills of materials</Link>
        <Link to="/app/reports">Reports</Link>
        <Link to="/app/settings">Settings</Link>
        <Link to="/app/billing">Plan</Link>
        <Link to="/app/onboarding">Setup</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs the embedded app's boundaries to propagate auth/CSP headers.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
