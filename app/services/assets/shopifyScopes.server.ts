import type { ShopifyGraphqlClient } from "../shopifyDiscounts.server";

// The scope required to upload generated assets to the Shopify Files library.
export const WRITE_FILES_SCOPE = "write_files";

type AccessScopesResponse = {
  data?: {
    currentAppInstallation?: {
      accessScopes?: Array<{ handle?: string | null } | null> | null;
    } | null;
  };
};

// Returns the access scopes currently granted to the app installation.
export async function getGrantedScopes(
  admin: ShopifyGraphqlClient | null | undefined,
): Promise<string[]> {
  if (!admin) return [];
  try {
    const response = await admin.graphql(
      `#graphql
        query PromoPulseGrantedScopes {
          currentAppInstallation {
            accessScopes {
              handle
            }
          }
        }`,
    );
    const payload = (await response.json()) as AccessScopesResponse;
    const scopes = payload.data?.currentAppInstallation?.accessScopes ?? [];
    return scopes
      .map((scope) => scope?.handle?.trim() ?? "")
      .filter((handle): handle is string => handle.length > 0);
  } catch {
    return [];
  }
}

// True only when the app installation has the write_files scope granted. Used to
// gate asset generation on the server — never trust the client checkbox.
export async function hasWriteFilesScope(
  admin: ShopifyGraphqlClient | null | undefined,
): Promise<boolean> {
  const scopes = await getGrantedScopes(admin);
  return scopes.includes(WRITE_FILES_SCOPE);
}
