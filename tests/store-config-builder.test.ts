import { describe, expect, it } from "vitest";
import { buildStoreConfig } from "../src/storefront/config-builder.js";

describe("store configuration builder",()=>{
  it("selects Korean Street and generates all allowed pages from the Brand Profile",()=>{
    const config=buildStoreConfig({
      brand_name:"Seoul Side Studio",
      summary:"Minimal objects inspired by everyday Seoul.",
      brand_style:{keywords:["Seoul street","minimal"],primary_colors:[{hex:"#000000"},{hex:"#FFFFFF"},{hex:"#777777"}]},
      catalog_plan:{preferred_product_types:["t-shirt"]},
    });
    expect(config.templateKey).toBe("KOREAN_STREET");
    expect(Object.keys(config.pages)).toEqual(["home","shop","collections","about","faq","shipping","returns","contact"]);
    expect(config.theme).toEqual({primary:"#000000",secondary:"#FFFFFF",accent:"#777777",background:"#FFFFFF"});
    expect(config.pages.home).toMatchObject({title:"Seoul Side Studio"});
  });

  it("uses safe template and color defaults for sparse input",()=>{
    const config=buildStoreConfig({brand_name:"Plain Studio",brand_style:{primary_colors:[{hex:"red"}]}});
    expect(config.templateKey).toBe("MINIMAL_FASHION");
    expect(config.theme.primary).toBe("#181815");
    expect(config.navigation).toHaveLength(8);
  });
});
