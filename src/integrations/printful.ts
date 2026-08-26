import { createHmac, timingSafeEqual } from "node:crypto";
import { parseJsonResponse } from "./http.js";

type PrintfulOptions = Readonly<{
  token: string;
  storeId?: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}>;

export class PrintfulClient {
  readonly #token: string;
  readonly #storeId: string | undefined;
  readonly #baseUrl: string;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: PrintfulOptions) {
    this.#token = options.token;
    this.#storeId = options.storeId;
    this.#baseUrl = options.baseUrl ?? "https://api.printful.com";
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.#token}`);
    headers.set("Content-Type", "application/json");
    if (this.#storeId) headers.set("X-PF-Store-Id", this.#storeId);
    const response = await this.#fetch(new URL(path, this.#baseUrl), { ...init, headers });
    return parseJsonResponse<T>("printful", response);
  }

  listCatalogProducts(limit = 20, offset = 0): Promise<unknown> {
    return this.request(`/v2/catalog-products?limit=${limit}&offset=${offset}`);
  }

  createMockupTask(payload: unknown): Promise<unknown> {
    return this.request("/v2/mockup-tasks", { method: "POST", body: JSON.stringify(payload) });
  }

  getMockupTasks(ids: readonly string[]): Promise<unknown> {
    const query = new URLSearchParams();
    for (const id of ids) query.append("id", id);
    return this.request(`/v2/mockup-tasks?${query.toString()}`);
  }

  createDraftOrder(payload: unknown): Promise<unknown> {
    return this.request("/v2/orders", { method: "POST", body: JSON.stringify(payload) });
  }

  getOrder(orderId: string): Promise<unknown> {
    return this.request(`/v2/orders/${encodeURIComponent(orderId)}`);
  }

  confirmOrder(orderId: string): Promise<unknown> {
    return this.request(`/v2/orders/${encodeURIComponent(orderId)}/confirmation`, { method: "POST" });
  }

  deleteDraftOrder(orderId:string):Promise<void>{
    return this.request(`/v2/orders/${encodeURIComponent(orderId)}`,{method:"DELETE"});
  }
}

export function verifyPrintfulWebhook(rawBody: Buffer, signatureHex: string, secretHex: string): boolean {
  if(!isValidPrintfulWebhookSecret(secretHex))return false;
  let supplied: Buffer;
  let secret: Buffer;
  try {
    supplied = Buffer.from(signatureHex, "hex");
    secret = Buffer.from(secretHex, "hex");
  } catch {
    return false;
  }
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function isValidPrintfulWebhookSecret(value:string|undefined):boolean{return typeof value==='string'&&/^[0-9a-f]{64,}$/i.test(value)&&value.length%2===0;}
