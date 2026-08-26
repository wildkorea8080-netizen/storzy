import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { schemas, toOpenAiSchema, validateSchema } from "../src/ai/schema-registry.js";
import { buildStoreConfig } from "../src/storefront/config-builder.js";

const loadFixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

function assertStrictObjects(node: unknown, path = "$"): void {
  if (!node || typeof node !== "object") return;
  const schema = node as Record<string, unknown>;
  if (schema.type === "object") {
    expect(schema.additionalProperties, `${path}.additionalProperties`).toBe(false);
    const properties = (schema.properties ?? {}) as Record<string, unknown>;
    expect(new Set(schema.required as string[]), `${path}.required`).toEqual(new Set(Object.keys(properties)));
  }
  for (const [key, value] of Object.entries(schema)) {
    if (key !== "examples") assertStrictObjects(value, `${path}.${key}`);
  }
}

describe("AI schema registry", () => {
  it("accepts canonical fixtures", () => {
    expect(validateSchema("brandProfile", loadFixture("brand-profile.valid.json"))).toEqual({ valid: true, errors: [] });
    expect(validateSchema("productContent", loadFixture("product-content.valid.json"))).toEqual({ valid: true, errors: [] });
    expect(validateSchema("storeConfig", buildStoreConfig({ brand_name: "Test Store" }))).toEqual({ valid: true, errors: [] });
  });

  it("rejects extra model-generated fields", () => {
    const fixture = loadFixture("product-content.valid.json") as Record<string, unknown>;
    fixture.unapproved_field = "must fail";
    expect(validateSchema("productContent", fixture).valid).toBe(false);
  });

  it("keeps every object compatible with OpenAI strict output rules", () => {
    assertStrictObjects(schemas.brandProfile);
    assertStrictObjects(schemas.productContent);
    assertStrictObjects(schemas.storeConfig);
  });

  it("removes document-only metadata before sending a schema to OpenAI", () => {
    const schema = toOpenAiSchema(schemas.brandProfile);
    expect(schema).not.toHaveProperty("$schema");
    expect(schema).not.toHaveProperty("$id");
    expect(schema).not.toHaveProperty("title");
    expect(schema).toHaveProperty("properties.brand_name.type", "string");
  });
});
