import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { CredentialCipher } from "../src/integrations/credential-cipher.js";

describe("integration credential cipher",()=>{
  it("encrypts with random AES-GCM nonces and decrypts only in the same workspace context",()=>{
    const cipher=new CredentialCipher(randomBytes(32),"v1"),credentials={accessToken:"secret-token",webhookSecret:"hook-secret"};
    const first=cipher.encrypt(credentials,"storzy:workspace-1:SHOPIFY"),second=cipher.encrypt(credentials,"storzy:workspace-1:SHOPIFY");
    expect(first.iv).toHaveLength(12);
    expect(first.authTag).toHaveLength(16);
    expect(first.ciphertext.equals(second.ciphertext)).toBe(false);
    expect(first.iv.equals(second.iv)).toBe(false);
    expect(first.ciphertext.toString("utf8")).not.toContain("secret-token");
    expect(cipher.decrypt(first,"storzy:workspace-1:SHOPIFY")).toEqual(credentials);
    expect(()=>cipher.decrypt(first,"storzy:workspace-2:SHOPIFY")).toThrow();
  });

  it("requires a 32-byte base64 key and a supported key version",()=>{
    expect(()=>CredentialCipher.fromBase64(undefined)).toThrow("INTEGRATION_CREDENTIAL_KEY_BASE64");
    expect(()=>CredentialCipher.fromBase64(Buffer.alloc(16).toString("base64"))).toThrow("exactly 32 bytes");
    const encrypted=new CredentialCipher(Buffer.alloc(32,1),"v1").encrypt({token:"x"},"context");
    expect(()=>new CredentialCipher(Buffer.alloc(32,1),"v2").decrypt(encrypted,"context")).toThrow("Unsupported");
  });
});
