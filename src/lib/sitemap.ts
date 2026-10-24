import { isPublicationSlug, type PublicationSlug } from "./publications";

// Sitemap 分片：協定上限為每檔 50,000 個網址 / 50MB。
// 大型新聞站必須用 sitemap index + 多個分片，並且讓分片「依內容類型」切分，
// 這樣能在 Search Console 分別觀察文章、公司頁、人物頁的收錄率，找出哪一類頁面有品質問題。

/** demo 刻意設小，讓 75 篇文章也能看出分片效果；正式環境約設 10,000～45,000 */
export const ARTICLES_PER_SHARD = 50;

export type ShardKind = "articles" | "news" | "company" | "executive" | "industry" | "country" | "pages";
const ENTITY_KINDS = ["company", "executive", "industry", "country"] as const;

export interface Shard {
  pub: PublicationSlug;
  kind: ShardKind;
  /** 從 1 開始；只有 articles 會有多個分片 */
  index: number;
}

export function shardFileName(s: Shard): string {
  return s.kind === "articles" ? `${s.pub}-articles-${s.index}.xml` : `${s.pub}-${s.kind}.xml`;
}

/** 解析分片檔名；不合法的名稱回傳 null 讓路由回 404，而不是產生空的 sitemap */
export function parseShardFileName(file: string): Shard | null {
  const m = /^([a-z0-9]+)-(articles|news|company|executive|industry|country|pages)(?:-(\d+))?\.xml$/.exec(file);
  if (!m) return null;
  const [, pub, kind, idx] = m;
  if (!pub || !isPublicationSlug(pub)) return null;
  if (kind === "articles") {
    const index = Number(idx);
    return Number.isInteger(index) && index >= 1 ? { pub, kind, index } : null;
  }
  if (idx !== undefined) return null;
  return { pub, kind: kind as ShardKind, index: 1 };
}

export function shardsForPublication(pub: PublicationSlug, articleCount: number): Shard[] {
  const articleShards = Math.max(1, Math.ceil(articleCount / ARTICLES_PER_SHARD));
  return [
    { pub, kind: "pages", index: 1 },
    { pub, kind: "news", index: 1 },
    ...Array.from({ length: articleShards }, (_, i) => ({ pub, kind: "articles" as const, index: i + 1 })),
    ...ENTITY_KINDS.map((kind) => ({ pub, kind, index: 1 })),
  ];
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

export function buildSitemapIndex(locs: string[]): string {
  const body = locs.map((loc) => `  <sitemap><loc>${escapeXml(loc)}</loc></sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export function buildUrlset(entries: { loc: string; lastmod?: string | null }[]): string {
  const body = entries
    .map((e) => `  <url><loc>${escapeXml(e.loc)}</loc>${e.lastmod ? `<lastmod>${escapeXml(e.lastmod)}</lastmod>` : ""}</url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/** Google News sitemap：只收 48 小時內的文章，讓新聞爬蟲快速發現新稿而不必重爬整個文章分片 */
export function buildNewsSitemap(
  publicationName: string,
  entries: { loc: string; title: string; published: string }[],
): string {
  const body = entries
    .map(
      (e) => `  <url><loc>${escapeXml(e.loc)}</loc><news:news><news:publication><news:name>${escapeXml(publicationName)}</news:name><news:language>en</news:language></news:publication><news:publication_date>${escapeXml(e.published)}</news:publication_date><news:title>${escapeXml(e.title)}</news:title></news:news></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${body}\n</urlset>\n`;
}
