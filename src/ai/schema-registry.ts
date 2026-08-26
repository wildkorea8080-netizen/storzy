import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import brandProfileSchema from "../../docs/schemas/brand-profile.schema.json" with { type: "json" };
import productContentSchema from "../../docs/schemas/product-content.schema.json" with { type: "json" };
import storeConfigSchema from "../../docs/schemas/store-config.schema.json" with { type: "json" };

export const schemas = {
  brandProfile: brandProfileSchema,
  productContent: productContentSchema,
  storeConfig: storeConfigSchema,
} as const;

export type SchemaName = keyof typeof schemas;

export type ValidationResult =
  | Readonly<{ valid: true; errors: readonly [] }>
  | Readonly<{ valid: false; errors: readonly ErrorObject[] }>;

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validators: Record<SchemaName, ValidateFunction> = {
  brandProfile: ajv.compile(schemas.brandProfile),
  productContent: ajv.compile(schemas.productContent),
  storeConfig: ajv.compile(schemas.storeConfig),
};

export class SchemaValidationError extends Error {
  constructor(
    readonly schemaName: SchemaName,
    readonly validationErrors: readonly ErrorObject[],
  ) {
    const details = validationErrors.map((error) => `${error.instancePath || "/"} ${error.message ?? "invalid"}`).join("; ");
    super(`${schemaName} validation failed: ${details}`);
  }
}

export function validateSchema(name: SchemaName, value: unknown): ValidationResult {
  const validator = validators[name];
  if (validator(value)) return { valid: true, errors: [] };
  return { valid: false, errors: validator.errors ?? [] };
}

export function assertSchema(name: SchemaName, value: unknown): void {
  const result = validateSchema(name, value);
  if (!result.valid) throw new SchemaValidationError(name, result.errors);
}

export function toOpenAiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !["$schema", "$id", "title"].includes(key))
        .map(([key, child]) => [key, normalize(child)]),
    );
  };
  return normalize(schema) as Record<string, unknown>;
}
