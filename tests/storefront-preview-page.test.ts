import { describe, expect, it, vi } from "vitest";
import { StoreConfigService } from "../src/storefront/config-service.js";
import { storefrontPreviewCss, storefrontPreviewHtml, storefrontPreviewJs } from "../src/admin/storefront-preview-page.js";
import { storeHtml, storeJs } from "../src/admin/store-page.js";
import { storefrontCartCss, storefrontCartJs } from "../src/admin/storefront-cart.js";
import { storefrontCheckoutCss, storefrontCheckoutJs } from "../src/admin/storefront-checkout.js";
import { storefrontCatalogCss, storefrontCatalogJs } from "../src/admin/storefront-catalog.js";
import { storefrontSeoJs } from "../src/admin/storefront-seo.js";
import { storefrontA11yCss, storefrontA11yJs } from "../src/admin/storefront-a11y.js";
import { storefrontImagesJs } from "../src/admin/storefront-images.js";
import { storefrontDataCacheJs } from "../src/admin/storefront-data-cache.js";
import { storefrontResilienceCss, storefrontResilienceJs } from "../src/admin/storefront-resilience.js";

describe("게시 스토어 고객 미리보기", () => {
  it("최신 PUBLISHED revision만 조회한다", async () => {
    const query=vi.fn().mockResolvedValue({rows:[{id:"draft-1",workspace_id:"workspace-1",brand_profile_revision_id:"brand-1",revision:3,status:"PUBLISHED",template_key:"KOREAN_STREET",config_data:{},source:"GENERATED",base_store_draft_id:null,created_by:"test",approved_by:"test",created_at:new Date(),approved_at:new Date(),publication_status:"SUCCEEDED",publication_attempts:1,publication_error:null}]});
    const service=new StoreConfigService({query} as never);
    await expect(service.published("workspace-1")).resolves.toMatchObject({id:"draft-1",status:"PUBLISHED",revision:3});
    expect(query).toHaveBeenCalledWith(expect.stringContaining("d.status='PUBLISHED'"),["workspace-1"]);
    expect(query.mock.calls[0]?.[0]).toContain("ORDER BY d.revision DESC LIMIT 1");
  });

  it("테마와 페이지 콘텐츠로 고객 홈을 렌더링한다", () => {
    expect(storefrontPreviewHtml).not.toContain("<script>");
    expect(storefrontPreviewJs).toContain("c.theme");
    expect(storefrontPreviewJs).toContain("p.home.title");
    expect(storefrontPreviewJs).toContain("p.collections.title");
    expect(storefrontPreviewJs).toContain("p.about.body");
    expect(storefrontPreviewCss).toContain("--primary");
    expect(storefrontPreviewJs).toContain("store.draft.configData");
    expect(storefrontPreviewJs).toContain("products.map(product");
    expect(storefrontPreviewJs).toContain("product.priceMinor");
    expect(() => new Function(storefrontPreviewJs)).not.toThrow();
  });

  it("Shopify 게시 성공 상품을 고객용 데이터로 정규화한다", async () => {
    const query=vi.fn().mockResolvedValue({rows:[{id:"revision-1",content_data:{title_en:"SEOUL TOTE",admin_title_ko:"서울 토트백",description:"Seoul everyday tote.",collection:"SEOUL LINE",tags:["seoul","tote"]},recommended_retail_minor:"4500",currency:"USD",mockup_data:{images:[{url:"https://preview-assets.storzy.local/mockups/1.jpg"}]},shopify_product_id:"gid://shopify/Product/1"}]});
    const service=new StoreConfigService({query} as never);
    await expect(service.publishedProducts("workspace-1")).resolves.toEqual([{id:"revision-1",title:"SEOUL TOTE",adminTitle:"서울 토트백",description:"Seoul everyday tote.",collection:"SEOUL LINE",tags:["seoul","tote"],priceMinor:4500,currency:"USD",imageUrl:"https://preview-assets.storzy.local/mockups/1.jpg",shopifyProductId:"gid://shopify/Product/1"}]);
    expect(query.mock.calls[0]?.[0]).toContain("j.status='SUCCEEDED'");
  });

  it("게시 완료 버전에서 고객 미리보기 링크를 제공한다", () => {
    expect(storeHtml).toContain("고객 화면 미리보기");
    expect(storeJs).toContain("item.status!=='PUBLISHED'");
    expect(storeJs).toContain("'/preview/store/'");
  });

  it("8개 스토어 페이지를 해시 라우팅하고 현재 메뉴를 강조한다", () => {
    expect(storefrontPreviewJs).toContain("keys=['home','shop','collections','about','faq','shipping','returns','contact']");
    expect(storefrontPreviewJs).toContain("window.addEventListener('hashchange',draw)");
    expect(storefrontPreviewJs).toContain("classList.toggle('active'");
    expect(storefrontPreviewJs).toContain("key==='shop'||key==='collections'");
    expect(storefrontPreviewCss).toContain(".links a.active");
    expect(storefrontPreviewCss).not.toContain(".links{display:none}");
  });

  it("게시 상품 카드에서 고객용 상세 화면으로 이동한다", () => {
    expect(storefrontPreviewJs).toContain("href=\"#product/");
    expect(storefrontPreviewJs).toContain("function detail(x)");
    expect(storefrontPreviewJs).toContain("x.tags||[]");
    expect(storefrontPreviewJs).toContain("Shop으로 돌아가기");
    expect(storefrontPreviewJs).toContain("current==='product'?'shop':current");
    expect(storefrontPreviewCss).toContain(".product-detail");
    expect(() => new Function(storefrontPreviewJs)).not.toThrow();
  });

  it("워크스페이스별 미리보기 장바구니를 제공한다", () => {
    expect(storefrontPreviewHtml).toContain("storefront-cart.css");
    expect(storefrontPreviewHtml).toContain("storefront-cart.js");
    expect(storefrontCartJs).toContain("storzy.preview.cart.");
    expect(storefrontCartJs).toContain("localStorage.setItem");
    expect(storefrontCartJs).toContain("data-action=\"minus\"");
    expect(storefrontCartJs).toContain("미리보기에서는 결제할 수 없습니다");
    expect(storefrontCartCss).toContain(".cart-panel[hidden]");
    expect(() => new Function(storefrontCartJs)).not.toThrow();
  });

  it("외부 주문 없는 체크아웃 미리보기만 제공한다", () => {
    expect(storefrontPreviewHtml).toContain("storefront-checkout.js");
    expect(storefrontCheckoutJs).toContain("form.reportValidity()");
    expect(storefrontCheckoutJs).toContain("실제 결제나 주문은 생성되지 않았습니다");
    expect(storefrontCheckoutJs).not.toContain("/orders");
    expect(storefrontCheckoutJs).not.toContain("method:'POST'");
    expect(storefrontCheckoutCss).toContain(".checkout-backdrop[hidden]");
    expect(() => new Function(storefrontCheckoutJs)).not.toThrow();
  });

  it("Shop과 Collections에서 상품 탐색 도구를 제공한다", () => {
    expect(storefrontPreviewHtml).toContain("storefront-catalog.js");
    expect(storefrontCatalogJs).toContain("상품명, 설명, 태그 검색");
    expect(storefrontCatalogJs).toContain("모든 컬렉션");
    expect(storefrontCatalogJs).toContain("낮은 가격순");
    expect(storefrontCatalogJs).toContain("높은 가격순");
    expect(storefrontCatalogJs).toContain("필터 초기화");
    expect(storefrontCatalogCss).toContain(".catalog-empty");
    expect(() => new Function(storefrontCatalogJs)).not.toThrow();
  });

  it("페이지와 상품별 SEO 미리보기 메타데이터를 구성한다", () => {
    expect(storefrontPreviewHtml).toContain('name="robots" content="noindex,nofollow"');
    expect(storefrontPreviewHtml).toContain("storefront-seo.js");
    expect(storefrontSeoJs).toContain("og:title");
    expect(storefrontSeoJs).toContain("og:description");
    expect(storefrontSeoJs).toContain("twitter:card");
    expect(storefrontSeoJs).toContain("application/ld+json");
    expect(storefrontSeoJs).toContain("'@type':'Product'");
    expect(storefrontSeoJs).toContain("priceCurrency:item.currency");
    expect(() => new Function(storefrontSeoJs)).not.toThrow();
  });

  it("키보드와 보조기술을 위한 접근성 동작을 제공한다", () => {
    expect(storefrontPreviewHtml).toContain("storefront-a11y.js");
    expect(storefrontA11yJs).toContain("본문으로 바로가기");
    expect(storefrontA11yJs).toContain("aria-current");
    expect(storefrontA11yJs).toContain("aria-live");
    expect(storefrontA11yJs).toContain("heading.focus({preventScroll:true})");
    expect(storefrontA11yJs).toContain("e.key!=='Escape'");
    expect(storefrontA11yJs).toContain("checkout.tagName!=='BUTTON'");
    expect(storefrontA11yJs).toContain("cart.setAttribute('role','dialog')");
    expect(storefrontA11yJs).toContain(".cart-close')?.focus()");
    expect(storefrontA11yCss).toContain("prefers-reduced-motion:reduce");
    expect(storefrontA11yCss).toContain(":focus-visible");
    expect(() => new Function(storefrontA11yJs)).not.toThrow();
  });

  it("허용된 Printful 목업만 표시하고 실패 시 대체 이미지를 사용한다", () => {
    expect(storefrontPreviewHtml).toContain("storefront-images.js");
    expect(storefrontImagesJs).toContain("u.protocol==='https:'");
    expect(storefrontImagesJs).toContain(".endsWith('.printful.com')");
    expect(storefrontImagesJs).toContain(".endsWith('.printfulusercontent.com')");
    expect(storefrontImagesJs).toContain("img.onerror");
    expect(storefrontImagesJs).toContain("img.loading=index===0?'eager':'lazy'");
    expect(storefrontImagesJs).toContain("img.alt=product.title");
    expect(() => new Function(storefrontImagesJs)).not.toThrow();
  });

  it("동일 storefront GET 요청을 한 번만 실행하고 응답을 복제한다", () => {
    const cacheIndex=storefrontPreviewHtml.indexOf("storefront-data-cache.js");
    const appIndex=storefrontPreviewHtml.indexOf("storefront.js");
    expect(cacheIndex).toBeGreaterThan(-1);
    expect(cacheIndex).toBeLessThan(appIndex);
    expect(storefrontDataCacheJs).toContain("method==='GET'");
    expect(storefrontDataCacheJs).toContain("url.origin===location.origin");
    expect(storefrontDataCacheJs).toContain("parts[5]==='storefront'");
    expect(storefrontDataCacheJs).toContain("response.clone()");
    expect(storefrontDataCacheJs).toContain("cache.delete(key)");
    expect(() => new Function(storefrontDataCacheJs)).not.toThrow();
  });

  it("로딩·오프라인·API 실패에서 복구 동선을 제공한다", () => {
    expect(storefrontPreviewHtml).toContain("storefront-loading");
    expect(storefrontPreviewHtml).toContain("storefront-resilience.js");
    expect(storefrontResilienceJs).toContain("navigator.onLine");
    expect(storefrontResilienceJs).toContain("window.addEventListener('offline'");
    expect(storefrontResilienceJs).toContain("location.reload()");
    expect(storefrontResilienceJs).toContain("8000");
    expect(storefrontResilienceCss).toContain(".loading-line");
    expect(storefrontResilienceCss).toContain(".retry-button");
    expect(() => new Function(storefrontResilienceJs)).not.toThrow();
  });
});
