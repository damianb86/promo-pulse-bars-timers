import type { ReactNode } from "react";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import "./dashboard.css";

type AppShellProps = {
  apiKey: string;
  children: ReactNode;
};

const navigationItems = [
  { label: "Dashboard", href: "/app" },
  { label: "Guided setup", href: "/app/onboarding" },
  { label: "Campaigns", href: "/app/campaigns" },
  { label: "Create campaign", href: "/app/campaigns/new" },
  { label: "Analytics", href: "/app/analytics" },
  { label: "Settings", href: "/app/settings" },
  { label: "Billing", href: "/app/billing" },
];

export function AppShell({ apiKey, children }: AppShellProps) {
  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        {navigationItems.map((item) => (
          <s-link key={item.href} href={item.href}>
            {item.label}
          </s-link>
        ))}
      </s-app-nav>
      {children}
    </AppProvider>
  );
}
