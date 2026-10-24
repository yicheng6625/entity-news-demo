import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalUrl, entityPath, slugify } from "@/lib/urls";
import { publicationForHost } from "@/lib/publications";

afterEach(() => vi.unstubAllEnvs());

describe("slugify", () => {
  it("轉小寫、去除變音符號與標點", () => {
    expect(slugify("Société Générale-ish & Co.")).toBe("societe-generale-ish-and-co");
    expect(slugify("  Kestrine's  Q3   results!! ")).toBe("kestrines-q3-results");
  });
  it("長度上限後不留結尾連字號", () => {
    const s = slugify("word ".repeat(40));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("canonicalUrl", () => {
  it("path 模式：使用 SITE_URL，去除 query、尾斜線與大寫", () => {
    vi.stubEnv("SITE_URL", "https://news.example.com/");
    expect(canonicalUrl("/Northwind/company/Foo/?utm_source=x")).toBe("https://news.example.com/northwind/company/foo");
    expect(canonicalUrl("//northwind//news/a")).toBe("https://news.example.com/northwind/news/a");
  });
  it("分頁參數只在第 2 頁以後保留", () => {
    vi.stubEnv("SITE_URL", "https://news.example.com");
    expect(canonicalUrl("/harbor", { page: 1 })).toBe("https://news.example.com/harbor");
    expect(canonicalUrl("/harbor", { page: 3 })).toBe("https://news.example.com/harbor?page=3");
  });
  it("host 模式：刊物前綴轉成品牌網域", () => {
    vi.stubEnv("URL_MODE", "host");
    expect(canonicalUrl(entityPath("harbor", "company", "aldervane-capital"))).toBe(
      "https://harbor-business.example/company/aldervane-capital",
    );
    expect(canonicalUrl("/northwind")).toBe("https://northwind-markets.example/");
  });
});

describe("publicationForHost", () => {
  it("依網域、www 與 *.localhost 找到刊物，忽略連接埠", () => {
    expect(publicationForHost("harbor-business.example")?.slug).toBe("harbor");
    expect(publicationForHost("www.northwind-markets.example")?.slug).toBe("northwind");
    expect(publicationForHost("northwind.localhost:3000")?.slug).toBe("northwind");
    expect(publicationForHost("localhost:3000")).toBeUndefined();
  });
});
