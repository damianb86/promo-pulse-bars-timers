import type { ReactNode } from "react";

declare module "*.css";

type ShopifyFileIntentResponse =
  | { code: "ok"; data?: { ids?: unknown } }
  | { code: "closed" }
  | { code: "error"; message?: string };

type ShopifyFileIntentActivity = {
  complete: Promise<ShopifyFileIntentResponse>;
};

type ShopifySaveBarController = {
  hide: (id: string) => Promise<void> | void;
  show: (id: string) => Promise<void> | void;
  leaveConfirmation?: () => Promise<void> | void;
};

declare module "react" {
  interface ButtonHTMLAttributes<T> {
    variant?: string;
  }
}

declare global {
  interface Window {
    shopify?: {
      intents?: {
        invoke?: (
          query: string,
          options?: { data?: Record<string, unknown> },
        ) => Promise<ShopifyFileIntentActivity>;
      };
      saveBar?: ShopifySaveBarController;
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": {
        children?: ReactNode;
      };
      "ui-save-bar": {
        children?: ReactNode;
        id: string;
      };
    }
  }
}

export {};
