import { describe, expect, it } from "vitest";
import { PreviewDesignFileInspector } from "../src/mockups/file-inspector.js";

describe("preview design file inspector",()=>{
  it("returns fixed verified metadata only for the bundled preview asset",async()=>{
    const inspector=new PreviewDesignFileInspector();
    await expect(inspector.inspect("https://preview-assets.storzy.local/seoul-side-design.png")).resolves.toMatchObject({mimeType:"image/png",widthPx:3000,heightPx:3000});
    await expect(inspector.inspect("https://example.com/design.png")).rejects.toMatchObject({code:"INVALID_DESIGN_FILE"});
  });
});
