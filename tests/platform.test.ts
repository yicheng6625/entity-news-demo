import { describe, expect, it } from "vitest";
import { toFtsQuery } from "@/lib/search";
import { parsePagination, MAX_PAGE_SIZE } from "@/lib/http";
import { businessDaysBetween, isStale } from "@/lib/freshness";
import { parseShardFileName, shardFileName, shardsForPublication, buildUrlset, ARTICLES_PER_SHARD } from "@/lib/sitemap";
import { serializeJsonLd } from "@/lib/jsonld";

describe("toFtsQuery", () => {
  it("移除 FTS5 語法字元並加上前綴比對", () => {
    expect(toFtsQuery('semi" OR title:*')).toBe('"semi"* "OR"* "title"*');
    expect(toFtsQuery("  ")).toBeNull();
  });
});

describe("parsePagination", () => {
  it("非法值回到預設，pageSize 有上限", () => {
    expect(parsePagination(new URLSearchParams("page=-3&pageSize=abc"))).toEqual({ page: 1, pageSize: 20, offset: 0 });
    expect(parsePagination(new URLSearchParams("page=3&pageSize=9999"))).toEqual({
      page: 3, pageSize: MAX_PAGE_SIZE, offset: 2 * MAX_PAGE_SIZE,
    });
  });
});

describe("freshness", () => {
  it("以營業日計算，週末不算落後", () => {
    // 2026-10-23 是週五，2026-10-26 是週一
    expect(businessDaysBetween("2026-10-23", "2026-10-26")).toBe(1);
    expect(isStale("2026-10-23", "2026-10-26")).toBe(false);
    expect(isStale("2026-10-20", "2026-10-26")).toBe(true);
    expect(isStale(null, "2026-10-26")).toBe(true);
  });
});

describe("sitemap 分片", () => {
  it("文章依數量切成多個分片，檔名可逆解析", () => {
    const shards = shardsForPublication("northwind", ARTICLES_PER_SHARD * 2 + 1);
    expect(shards.filter((s) => s.kind === "articles")).toHaveLength(3);
    for (const s of shards) expect(parseShardFileName(shardFileName(s))).toEqual(s);
  });
  it("拒絕不合法的檔名", () => {
    expect(parseShardFileName("unknown-articles-1.xml")).toBeNull();
    expect(parseShardFileName("northwind-articles-0.xml")).toBeNull();
    expect(parseShardFileName("northwind-company-2.xml")).toBeNull();
  });
  it("XML 內容會被跳脫", () => {
    expect(buildUrlset([{ loc: "https://x/a?b=1&c=2" }])).toContain("https://x/a?b=1&amp;c=2");
  });
});

describe("serializeJsonLd", () => {
  it("跳脫 < 以防止 </script> 注入", () => {
    expect(serializeJsonLd({ headline: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});
