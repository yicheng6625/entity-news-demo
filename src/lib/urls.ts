import { isPublicationSlug, publications, type PublicationSlug } from "./publications";

// URL 是 SEO 的公開契約：一旦被索引就很難改。
// 所以所有 URL 都必須由這個模組產生，頁面不可自行拼字串，否則 canonical、sitemap、內部連結容易出現不一致。

export type EntityType = "company" | "executive" | "industry" | "country";
export const entityTypes: readonly EntityType[] = ["company", "executive", "industry", "country"];

/**
 * 產生 URL slug。
 * 先做 NFKD 正規化再去掉變音符號，確保 "Société" 與 "Societe" 對應同一個 slug，避免重複頁面。
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** 站台根網址；預設為本地開發，正式環境以環境變數覆寫，避免 canonical 指向 localhost。 */
export function siteOrigin(): string {
  const raw = process.env.SITE_URL ?? "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** 站內相對路徑（給 <Link> 使用） */
export function entityPath(pub: PublicationSlug, type: EntityType, slug: string): string {
  return `/${pub}/${type}/${encodeURIComponent(slug)}`;
}

export function articlePath(pub: PublicationSlug, slug: string): string {
  return `/${pub}/news/${encodeURIComponent(slug)}`;
}

export function publicationPath(pub: PublicationSlug, rest = ""): string {
  return `/${pub}${rest}`;
}

/**
 * 網址模式：
 * - path：所有刊物共用一個網域，以 /[pub] 前綴區分（本地開發、預覽環境）
 * - host：每個刊物有自己的網域，由 proxy 把 Host 改寫到 /[pub] 路由（正式環境）
 * 頁面內部一律用帶前綴的路徑，只有輸出給搜尋引擎的絕對網址才依模式轉換，兩種部署共用同一組頁面程式。
 */
export function urlMode(): "path" | "host" {
  return process.env.URL_MODE === "host" ? "host" : "path";
}

/**
 * 產生 canonical 絕對網址。
 * - 一律小寫、去除 query 與尾斜線：追蹤參數 (utm_*) 不應分散排名訊號。
 * - 允許保留 page 參數 (>1)，因為分頁內容本身不同，Google 建議分頁各自 self-canonical。
 */
export function canonicalUrl(path: string, opts: { page?: number } = {}): string {
  const [pathname] = path.split(/[?#]/);
  let clean = (pathname ?? "/").toLowerCase().replace(/\/{2,}/g, "/");
  if (!clean.startsWith("/")) clean = `/${clean}`;
  if (clean.length > 1) clean = clean.replace(/\/+$/, "");
  const page = opts.page && opts.page > 1 ? `?page=${Math.floor(opts.page)}` : "";

  if (urlMode() === "host") {
    const [, first, ...rest] = clean.split("/");
    const pub = first && isPublicationSlug(first) ? publications[first] : undefined;
    if (pub) {
      const restPath = rest.length ? `/${rest.join("/")}` : "/";
      return `https://${pub.domain}${restPath}${page}`;
    }
  }
  return `${siteOrigin()}${clean}${page}`;
}
