import { createHmac, timingSafeEqual } from "node:crypto";
import { parseJsonResponse } from "./http.js";

type ShopifyGraphqlEnvelope<T>={data?:T;errors?:Array<{message?:string;extensions?:{code?:string}}> ;extensions?:{cost?:{requestedQueryCost?:number;throttleStatus?:{currentlyAvailable?:number;restoreRate?:number}}}};
export class ShopifyGraphqlError extends Error{constructor(readonly errors:unknown,readonly status:422|429,readonly retryAfterMs:number|null=null){super(`Shopify GraphQL error: ${JSON.stringify(errors)}`);this.name="ShopifyGraphqlError"}}
function throttleDelay(result:ShopifyGraphqlEnvelope<unknown>):number|null{if(!result.errors?.some(error=>error.extensions?.code==="THROTTLED"))return null;const cost=result.extensions?.cost,requested=Number(cost?.requestedQueryCost??1),available=Number(cost?.throttleStatus?.currentlyAvailable??0),rate=Number(cost?.throttleStatus?.restoreRate??0);if(!Number.isFinite(rate)||rate<=0)return 1000;return Math.min(60_000,Math.max(1000,Math.ceil(Math.max(1,requested-available)/rate*1000)))}

export type ShopifyClientOptions = Readonly<{
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
  fetch?: typeof globalThis.fetch;
}>;

export class ShopifyAdminClient {
  readonly #endpoint: string;
  readonly #token: string;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: ShopifyClientOptions) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(options.shopDomain)) {
      throw new Error("Invalid Shopify shop domain");
    }
    this.#endpoint = `https://${options.shopDomain}/admin/api/${options.apiVersion}/graphql.json`;
    this.#token = options.accessToken;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const response = await this.#fetch(this.#endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": this.#token },
      body: JSON.stringify({ query, variables }),
    });
    const result = await parseJsonResponse<ShopifyGraphqlEnvelope<T>>("shopify", response);
    const retryAfterMs=throttleDelay(result);
    if(retryAfterMs!==null)throw new ShopifyGraphqlError(result.errors,429,retryAfterMs);
    if (result.errors || !result.data) throw new ShopifyGraphqlError(result.errors,422);
    return result.data;
  }
}

export function verifyShopifyWebhook(rawBody: Buffer, hmacBase64: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(hmacBase64, "base64");
  } catch {
    return false;
  }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export const PRODUCT_SET_MUTATION = `#graphql
mutation ProductSet($identifier: ProductSetIdentifiers, $input: ProductSetInput!, $synchronous: Boolean!) {
  productSet(identifier: $identifier, input: $input, synchronous: $synchronous) {
    product { id title status }
    productSetOperation { id status }
    userErrors { field message code }
  }
}`;
