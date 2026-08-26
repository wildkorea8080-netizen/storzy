import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { DomainError } from "../brand/errors.js";

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_DIMENSION = 20_000;
const MIME_EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg" } as const;

type SupportedMime = keyof typeof MIME_EXTENSIONS;
export type PreviewUpload = Readonly<{
  id: string;
  workspaceId: string;
  fileUrl: string;
  mimeType: SupportedMime;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
}>;

export class PreviewDesignUploadService {
  private readonly root: string;
  private readonly maxFilesPerWorkspace: number;
  private readonly maxBytesPerWorkspace: number;
  private uploadQueue: Promise<void> = Promise.resolve();

  constructor(directory: string, limits: Readonly<{ maxFilesPerWorkspace?: number; maxBytesPerWorkspace?: number }> = {}) {
    this.root = resolve(directory);
    this.maxFilesPerWorkspace = positiveInteger(limits.maxFilesPerWorkspace ?? 100, "maxFilesPerWorkspace");
    this.maxBytesPerWorkspace = positiveInteger(limits.maxBytesPerWorkspace ?? 500 * 1024 * 1024, "maxBytesPerWorkspace");
  }

  async save(workspaceId: string, bytes: Uint8Array, declaredMime: string): Promise<PreviewUpload> {
    const scope = validWorkspace(workspaceId);
    if (!bytes.byteLength) throw invalid("디자인 파일이 비어 있습니다.");
    if (bytes.byteLength > MAX_BYTES) throw invalid("디자인 파일은 50MB 이하여야 합니다.");
    if (!(declaredMime in MIME_EXTENSIONS)) throw invalid("PNG 또는 JPEG 파일만 업로드할 수 있습니다.");

    const mimeType = declaredMime as SupportedMime;
    const dimensions = mimeType === "image/png" ? pngDimensions(bytes) : jpegDimensions(bytes);
    if (!dimensions) throw invalid("파일 내용과 이미지 형식이 일치하지 않습니다.");
    if (dimensions.widthPx > MAX_DIMENSION || dimensions.heightPx > MAX_DIMENSION) {
      throw invalid("이미지 가로와 세로는 각각 20,000픽셀 이하여야 합니다.");
    }

    return this.exclusive(async()=>{
      const workspaceRoot = resolve(this.root, scope);
      await mkdir(workspaceRoot, { recursive: true });
      const usage = await this.usage(scope);
      if (usage.fileCount >= this.maxFilesPerWorkspace || usage.sizeBytes + bytes.byteLength > this.maxBytesPerWorkspace) {
        throw new DomainError("DESIGN_UPLOAD_QUOTA_EXCEEDED", "워크스페이스 디자인 업로드 저장 한도를 초과했습니다.");
      }
      const id = randomUUID();
      const extension = MIME_EXTENSIONS[mimeType];
      await writeFile(resolve(workspaceRoot, `${id}.${extension}`), bytes, { flag: "wx" });
      return {id,workspaceId:scope,fileUrl:`https://preview-assets.storzy.local/uploads/${encodeURIComponent(scope)}/${id}.${extension}`,mimeType,sizeBytes:bytes.byteLength,...dimensions};
    });
  }

  async usage(workspaceId: string): Promise<Readonly<{ fileCount: number; sizeBytes: number; maxFiles: number; maxBytes: number }>> {
    const scope = validWorkspace(workspaceId);
    const workspaceRoot = resolve(this.root, scope);
    let entries;
    try { entries = await readdir(workspaceRoot, { withFileTypes: true }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { fileCount: 0, sizeBytes: 0, maxFiles: this.maxFilesPerWorkspace, maxBytes: this.maxBytesPerWorkspace };
      throw error;
    }
    const files = entries.filter(entry => entry.isFile() && /^[0-9a-f-]{36}[.](png|jpg)$/.test(entry.name));
    const sizes = await Promise.all(files.map(async entry => (await stat(resolve(workspaceRoot, entry.name))).size));
    return { fileCount: files.length, sizeBytes: sizes.reduce((sum, size) => sum + size, 0), maxFiles: this.maxFilesPerWorkspace, maxBytes: this.maxBytesPerWorkspace };
  }

  async read(workspaceId: string, name: string): Promise<Buffer | null> {
    const scope = validWorkspace(workspaceId);
    if (!/^[0-9a-f-]{36}[.](png|jpg)$/.test(name)) return null;
    const workspaceRoot = resolve(this.root, scope);
    const path = resolve(workspaceRoot, name);
    if (!path.startsWith(`${workspaceRoot}${sep}`)) return null;
    try {
      return await readFile(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async inspect(rawUrl: string): Promise<PreviewUpload> {
    let url: URL;
    try { url = new URL(rawUrl); } catch { throw invalid("업로드 디자인 URL이 올바르지 않습니다."); }
    if (url.protocol !== "https:" || url.hostname !== "preview-assets.storzy.local") {
      throw invalid("미리보기 업로드 자산 URL이 아닙니다.");
    }
    const match = url.pathname.match(/^\/uploads\/([A-Za-z0-9_-]{1,128})\/([0-9a-f-]{36}[.](png|jpg))$/);
    if (!match?.[1] || !match[2]) throw invalid("미리보기 업로드 자산 경로가 올바르지 않습니다.");
    const workspaceId = validWorkspace(decodeURIComponent(match[1]));
    const bytes = await this.read(workspaceId, match[2]);
    if (!bytes) throw invalid("업로드된 디자인 파일을 찾을 수 없습니다.");
    const mimeType: SupportedMime = match[3] === "png" ? "image/png" : "image/jpeg";
    const dimensions = mimeType === "image/png" ? pngDimensions(bytes) : jpegDimensions(bytes);
    if (!dimensions) throw invalid("저장된 이미지 파일이 손상되었습니다.");
    return { id: match[2].slice(0, 36), workspaceId, fileUrl: url.toString(), mimeType, sizeBytes: bytes.byteLength, ...dimensions };
  }

  private async exclusive<T>(operation:()=>Promise<T>):Promise<T>{
    let release!:()=>void;const previous=this.uploadQueue;this.uploadQueue=new Promise<void>(resolve=>{release=resolve});await previous;try{return await operation()}finally{release()}
  }
}

function pngDimensions(data: Uint8Array): { widthPx: number; heightPx: number } | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (data.length < 24 || !signature.every((value, index) => data[index] === value)) return null;
  if (String.fromCharCode(...data.slice(12, 16)) !== "IHDR") return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const widthPx = view.getUint32(16);
  const heightPx = view.getUint32(20);
  return widthPx && heightPx ? { widthPx, heightPx } : null;
}

function jpegDimensions(data: Uint8Array): { widthPx: number; heightPx: number } | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  let index = 2;
  while (index + 8 < data.length) {
    if (data[index] !== 0xff) { index++; continue; }
    const marker = data[index + 1]!;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { index += 2; continue; }
    const length = (data[index + 2]! << 8) | data[index + 3]!;
    if (length < 2 || index + 2 + length > data.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      const heightPx = (data[index + 5]! << 8) | data[index + 6]!;
      const widthPx = (data[index + 7]! << 8) | data[index + 8]!;
      return widthPx && heightPx ? { widthPx, heightPx } : null;
    }
    index += 2 + length;
  }
  return null;
}

function invalid(message: string): DomainError {
  return new DomainError("INVALID_DESIGN_FILE", message);
}

function validWorkspace(value: string): string {
  const result = value.trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(result)) throw invalid("워크스페이스 ID가 올바르지 않습니다.");
  return result;
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${field} must be a positive integer`);
  return value;
}
