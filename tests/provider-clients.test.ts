import { describe, expect, it, vi } from "vitest";
import { PrintfulClient } from "../src/integrations/printful.js";
import { ShopifyAdminClient,ShopifyGraphqlError } from "../src/integrations/shopify.js";

describe("provider clients", () => {
  it("sends Shopify GraphQL to the versioned endpoint", async () => {
    const fetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ data: { shop: { name: "Fixture" } } }), { status: 200 }),
    );
    const client = new ShopifyAdminClient({
      shopDomain: "fixture.myshopify.com",
      accessToken: "token",
      apiVersion: "2026-07",
      fetch,
    });
    await expect(client.graphql("query { shop { name } }")).resolves.toEqual({ shop: { name: "Fixture" } });
    expect(fetch.mock.calls[0]?.[0]).toBe("https://fixture.myshopify.com/admin/api/2026-07/graphql.json");
  });

  it("maps Shopify GraphQL throttle cost to a retry delay",async()=>{const fetch=vi.fn(async()=>new Response(JSON.stringify({errors:[{message:"Throttled",extensions:{code:"THROTTLED"}}],extensions:{cost:{requestedQueryCost:50,throttleStatus:{currentlyAvailable:10,restoreRate:20}}}}),{status:200})),client=new ShopifyAdminClient({shopDomain:"fixture.myshopify.com",accessToken:"token",apiVersion:"2026-07",fetch});await expect(client.graphql("mutation { test }")).rejects.toMatchObject({status:429,retryAfterMs:2000});await expect(client.graphql("mutation { test }")).rejects.toBeInstanceOf(ShopifyGraphqlError)});
  it("marks non-throttle GraphQL errors as permanent input failures",async()=>{const fetch=vi.fn(async()=>new Response(JSON.stringify({errors:[{message:"Invalid query",extensions:{code:"GRAPHQL_VALIDATION_FAILED"}}]}),{status:200})),client=new ShopifyAdminClient({shopDomain:"fixture.myshopify.com",accessToken:"token",apiVersion:"2026-07",fetch});await expect(client.graphql("bad query")).rejects.toMatchObject({status:422,retryAfterMs:null})});

  it("sends Printful store scope and bearer token", async () => {
    const fetch = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    const client = new PrintfulClient({ token: "token", storeId: "42", fetch });
    await client.listCatalogProducts();
    const init = fetch.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token");
    expect(headers.get("X-PF-Store-Id")).toBe("42");
  });
  it("deletes a Printful v2 draft and accepts an empty 204 response",async()=>{const fetch=vi.fn(async(_input:string|URL|Request,_init?:RequestInit)=>new Response(null,{status:204})),client=new PrintfulClient({token:"token",storeId:"42",fetch});await expect(client.deleteDraftOrder("draft/99")).resolves.toBeUndefined();expect(String(fetch.mock.calls[0]?.[0])).toBe("https://api.printful.com/v2/orders/draft%2F99");expect(fetch.mock.calls[0]?.[1]?.method).toBe("DELETE")});
});
