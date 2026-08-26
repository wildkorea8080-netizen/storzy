import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPrintfulWebhook } from "../src/integrations/printful.js";
import { verifyShopifyWebhook } from "../src/integrations/shopify.js";

describe("webhook signatures", () => {
  const rawBody = Buffer.from('{"id":"evt-1"}');

  it("verifies Shopify base64 HMAC over the raw body", () => {
    const secret = "shopify-secret";
    const signature = createHmac("sha256", secret).update(rawBody).digest("base64");
    expect(verifyShopifyWebhook(rawBody, signature, secret)).toBe(true);
    expect(verifyShopifyWebhook(Buffer.from("changed"), signature, secret)).toBe(false);
  });

  it("verifies Printful hex-key HMAC over the raw body", () => {
    const secret = Buffer.alloc(32, 11);
    const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
    expect(verifyPrintfulWebhook(rawBody, signature, secret.toString("hex"))).toBe(true);
    expect(verifyPrintfulWebhook(Buffer.from("changed"), signature, secret.toString("hex"))).toBe(false);
  });
});
