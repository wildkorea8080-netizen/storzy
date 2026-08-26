import { describe,expect,it } from "vitest";
import { PreviewMockupClient } from "../src/mockups/preview-client.js";
import { parseCreatedTaskIds,parseMockupTasks } from "../src/mockups/response.js";

describe("preview mockup client",()=>{it("returns completed variant mockups",async()=>{const client=new PreviewMockupClient();const created=await client.createMockupTask({products:[{catalog_variant_ids:[101,102],mockup_style_ids:[2],placements:[{placement:"front"}]}]}),ids=parseCreatedTaskIds(created),tasks=parseMockupTasks(await client.getMockupTasks(ids));expect(ids).toHaveLength(1);expect(tasks[0]).toMatchObject({status:"completed"});expect(tasks[0]?.images).toHaveLength(2);expect(tasks[0]?.images[0]).toMatchObject({catalogVariantId:"101",styleId:2,placement:"front"})})});
