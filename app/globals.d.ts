import type { ReactNode } from "react";

declare module "*.css";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": {
        children?: ReactNode;
      };
    }
  }
}

export {};
