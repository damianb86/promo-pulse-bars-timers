import type { ReactNode } from "react";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";

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
  { label: "Reports", href: "/app/reports" },
  { label: "Recommendations", href: "/app/recommendations" },
  { label: "Template Library", href: "/app/templates" },
  { label: "Agency", href: "/app/agency" },
  { label: "Settings", href: "/app/settings" },
  { label: "Billing", href: "/app/billing" },
];

export function AppShell({ apiKey, children }: AppShellProps) {
  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        {navigationItems.map((item) => (
          <a
            href={item.href}
            key={item.href}
            rel={item.href === "/app" ? "home" : undefined}
          >
            {item.label}
          </a>
        ))}
      </NavMenu>
      <div className="counterpulse-app-surface">{children}</div>
    </AppProvider>
  );
}
