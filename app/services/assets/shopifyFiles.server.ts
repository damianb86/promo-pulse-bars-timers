import type { ShopifyGraphqlClient } from "../shopifyDiscounts.server";

// Uploads binary assets to the Shopify Files library. There is NO server-side
// storage fallback: any failure throws AssetUploadError so the caller aborts the
// whole asset-generation flow.

export class AssetUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetUploadError";
  }
}

export type ShopifyUploadedFile = {
  id: string;
  url: string;
};

export type ShopifyUploadInput = {
  bytes: Buffer;
  filename: string;
  mimeType: string;
  alt?: string;
};

type StagedUploadsCreateResponse = {
  data?: {
    stagedUploadsCreate?: {
      stagedTargets?: Array<{
        url?: string | null;
        resourceUrl?: string | null;
        parameters?: Array<{ name: string; value: string }> | null;
      }> | null;
      userErrors?: Array<{ message?: string }> | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

type FileCreateResponse = {
  data?: {
    fileCreate?: {
      files?: Array<{
        id?: string | null;
        fileStatus?: string | null;
      }> | null;
      userErrors?: Array<{ message?: string }> | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

type FileNodeResponse = {
  data?: {
    node?: {
      id?: string | null;
      fileStatus?: string | null;
      image?: { url?: string | null } | null;
      url?: string | null;
    } | null;
  };
};

function firstUserError(
  errors: Array<{ message?: string }> | null | undefined,
): string | null {
  const message = errors?.find((error) => error?.message)?.message;
  return message ?? null;
}

async function createStagedTarget(
  admin: ShopifyGraphqlClient,
  input: ShopifyUploadInput,
) {
  const response = await admin.graphql(
    `#graphql
      mutation PromoPulseStagedUploads($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { message }
        }
      }`,
    {
      variables: {
        input: [
          {
            resource: "FILE",
            filename: input.filename,
            mimeType: input.mimeType,
            httpMethod: "POST",
            fileSize: String(input.bytes.byteLength),
          },
        ],
      },
    },
  );
  const payload = (await response.json()) as StagedUploadsCreateResponse;
  const error =
    firstUserError(payload.data?.stagedUploadsCreate?.userErrors) ??
    firstUserError(payload.errors);
  if (error) throw new AssetUploadError(error);

  const target = payload.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target?.url || !target.resourceUrl) {
    throw new AssetUploadError("Shopify did not return a staged upload target.");
  }
  return {
    url: target.url,
    resourceUrl: target.resourceUrl,
    parameters: target.parameters ?? [],
  };
}

async function uploadToStagedTarget(
  target: {
    url: string;
    parameters: Array<{ name: string; value: string }>;
  },
  input: ShopifyUploadInput,
) {
  const form = new FormData();
  for (const parameter of target.parameters) {
    form.append(parameter.name, parameter.value);
  }
  form.append(
    "file",
    new Blob([new Uint8Array(input.bytes)], { type: input.mimeType }),
    input.filename,
  );

  const response = await fetch(target.url, { method: "POST", body: form });
  if (!response.ok) {
    throw new AssetUploadError(
      `Shopify rejected the file upload (status ${response.status}).`,
    );
  }
}

async function createFile(
  admin: ShopifyGraphqlClient,
  resourceUrl: string,
  input: ShopifyUploadInput,
) {
  const response = await admin.graphql(
    `#graphql
      mutation PromoPulseFileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files { id fileStatus }
          userErrors { message }
        }
      }`,
    {
      variables: {
        files: [
          {
            originalSource: resourceUrl,
            contentType: "IMAGE",
            alt: input.alt ?? "",
          },
        ],
      },
    },
  );
  const payload = (await response.json()) as FileCreateResponse;
  const error =
    firstUserError(payload.data?.fileCreate?.userErrors) ??
    firstUserError(payload.errors);
  if (error) throw new AssetUploadError(error);

  const fileId = payload.data?.fileCreate?.files?.[0]?.id;
  if (!fileId) {
    throw new AssetUploadError("Shopify did not return a created file id.");
  }
  return fileId;
}

// fileCreate is async on Shopify's side; poll until the file is READY and has a
// public URL.
async function waitForFileUrl(
  admin: ShopifyGraphqlClient,
  fileId: string,
): Promise<string> {
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await admin.graphql(
      `#graphql
        query PromoPulseFileStatus($id: ID!) {
          node(id: $id) {
            ... on MediaImage { id fileStatus image { url } }
            ... on GenericFile { id fileStatus url }
          }
        }`,
      { variables: { id: fileId } },
    );
    const payload = (await response.json()) as FileNodeResponse;
    const node = payload.data?.node;
    const status = node?.fileStatus;
    const url = node?.image?.url ?? node?.url ?? null;

    if (status === "FAILED") {
      throw new AssetUploadError("Shopify failed to process the uploaded file.");
    }
    if (status === "READY" && url) {
      return url;
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  throw new AssetUploadError("Timed out waiting for Shopify to process the file.");
}

export async function uploadFileToShopify(
  admin: ShopifyGraphqlClient,
  input: ShopifyUploadInput,
): Promise<ShopifyUploadedFile> {
  const target = await createStagedTarget(admin, input);
  await uploadToStagedTarget(target, input);
  const fileId = await createFile(admin, target.resourceUrl, input);
  const url = await waitForFileUrl(admin, fileId);
  return { id: fileId, url };
}
