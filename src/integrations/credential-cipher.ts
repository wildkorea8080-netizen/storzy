import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedCredentials = Readonly<{
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyVersion: string;
}>;

export class CredentialCipher {
  readonly #key: Buffer;
  readonly #keyVersion: string;

  constructor(key:Buffer,keyVersion="v1"){
    if(key.byteLength!==32)throw new Error("Integration credential key must be exactly 32 bytes");
    if(!/^[A-Za-z0-9._-]{1,64}$/.test(keyVersion))throw new Error("Invalid integration credential key version");
    this.#key=Buffer.from(key);
    this.#keyVersion=keyVersion;
  }

  static fromBase64(value:string|undefined,keyVersion="v1"):CredentialCipher{
    if(!value?.trim())throw new Error("INTEGRATION_CREDENTIAL_KEY_BASE64 is required");
    const key=Buffer.from(value.trim(),"base64");
    return new CredentialCipher(key,keyVersion);
  }

  encrypt(credentials:Readonly<Record<string,string>>,context:string):EncryptedCredentials{
    if(!context.trim())throw new Error("Credential encryption context is required");
    const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",this.#key,iv);
    cipher.setAAD(Buffer.from(context,"utf8"));
    const plaintext=Buffer.from(JSON.stringify(credentials),"utf8");
    const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);
    plaintext.fill(0);
    return {ciphertext,iv,authTag:cipher.getAuthTag(),keyVersion:this.#keyVersion};
  }

  decrypt(encrypted:EncryptedCredentials,context:string):Record<string,string>{
    if(encrypted.keyVersion!==this.#keyVersion)throw new Error("Unsupported integration credential key version");
    const decipher=createDecipheriv("aes-256-gcm",this.#key,encrypted.iv);
    decipher.setAAD(Buffer.from(context,"utf8"));
    decipher.setAuthTag(encrypted.authTag);
    const plaintext=Buffer.concat([decipher.update(encrypted.ciphertext),decipher.final()]);
    try{
      const value=JSON.parse(plaintext.toString("utf8")) as unknown;
      if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid credential payload");
      return value as Record<string,string>;
    }finally{plaintext.fill(0);}
  }
}
