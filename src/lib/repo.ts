import "server-only";
import { db } from "./db";
import type { PublicationSlug } from "./publications";
import type { EntityType } from "./urls";

// 資料存取層：頁面與 API 只透過這裡讀資料，SQL 集中管理，
// 之後換成 Postgres 或加上讀取副本時只需改這一層。

export interface ArticleSummary {
  id: number;
  slug: string;
  publication: PublicationSlug;
  title: string;
  dek: string;
  author: string;
  published_at: string;
  updated_at: string;
}
export interface Article extends ArticleSummary {
  body: string;
  syndicated_to: string | null;
}
export interface Company {
  id: number;
  slug: string;
  name: string;
  short_name: string;
  ticker: string | null;
  founded: number;
  employees: number;
  description: string;
  updated_at: string;
  industry_id: number;
  country_id: number;
  industry_slug: string;
  industry_name: string;
  country_slug: string;
  country_name: string;
}
export interface Executive {
  id: number;
  slug: string;
  name: string;
  title: string;
  bio: string;
  updated_at: string;
  company_slug: string;
  company_name: string;
}
export interface Industry { id: number; slug: string; name: string; description: string }
export interface Country { id: number; slug: string; name: string; iso2: string; region: string }
export interface EntityRef { type: EntityType; id: number; slug: string; name: string; aliases: string[]; is_primary: number }
export interface PricePoint { date: string; close: number }

// node:sqlite 回傳 null-prototype 物件；轉型集中在這裡，避免在各處散落 as 斷言
function all<T>(sql: string, ...params: (string | number | null)[]): T[] {
  return db().prepare(sql).all(...params) as unknown as T[];
}
function get<T>(sql: string, ...params: (string | number | null)[]): T | undefined {
  return db().prepare(sql).get(...params) as unknown as T | undefined;
}

// 文章在某刊物「可見」= 原刊於該刊物，或被轉載到該刊物
const VISIBLE_IN_PUB = `(a.publication = ? OR EXISTS (SELECT 1 FROM article_syndications s WHERE s.article_id = a.id AND s.publication = ?))`;
const SUMMARY_COLS = "a.id, a.slug, a.publication, a.title, a.dek, a.author, a.published_at, a.updated_at";

// ---------- 文章 ----------

export function latestArticles(pub: PublicationSlug, limit: number, offset = 0): ArticleSummary[] {
  return all(`SELECT ${SUMMARY_COLS} FROM articles a WHERE ${VISIBLE_IN_PUB} ORDER BY a.published_at DESC LIMIT ? OFFSET ?`, pub, pub, limit, offset);
}

export function getArticle(slug: string): Article | undefined {
  return get(
    `SELECT ${SUMMARY_COLS}, a.body,
       (SELECT group_concat(publication) FROM article_syndications s WHERE s.article_id = a.id) AS syndicated_to
     FROM articles a WHERE a.slug = ?`,
    slug,
  );
}

export function isVisibleIn(article: Article, pub: PublicationSlug): boolean {
  return article.publication === pub || (article.syndicated_to ?? "").split(",").includes(pub);
}

/** 建置時預先產生的文章：只取最近的 N 篇，其餘交給 ISR 首次請求時再產生，控制建置時間 */
export function recentArticleParams(limitPerPub: number): { pub: PublicationSlug; slug: string }[] {
  return all(
    `SELECT publication AS pub, slug FROM (
       SELECT publication, slug, ROW_NUMBER() OVER (PARTITION BY publication ORDER BY published_at DESC) AS rn FROM articles
     ) WHERE rn <= ?`,
    limitPerPub,
  );
}

export function articleEntities(articleId: number): EntityRef[] {
  // 一次 UNION 查回所有類型的實體，避免每種實體各打一次查詢（N+1）
  const rows = all<Omit<EntityRef, "aliases"> & { alias: string | null }>(
    `SELECT ae.entity_type AS type, c.id, c.slug, c.name, c.short_name AS alias, ae.is_primary
       FROM article_entities ae JOIN companies c ON ae.entity_type = 'company' AND c.id = ae.entity_id WHERE ae.article_id = ?
     UNION ALL
     SELECT ae.entity_type, e.id, e.slug, e.name, NULL, ae.is_primary
       FROM article_entities ae JOIN executives e ON ae.entity_type = 'executive' AND e.id = ae.entity_id WHERE ae.article_id = ?
     UNION ALL
     SELECT ae.entity_type, i.id, i.slug, i.name, NULL, ae.is_primary
       FROM article_entities ae JOIN industries i ON ae.entity_type = 'industry' AND i.id = ae.entity_id WHERE ae.article_id = ?
     UNION ALL
     SELECT ae.entity_type, k.id, k.slug, k.name, NULL, ae.is_primary
       FROM article_entities ae JOIN countries k ON ae.entity_type = 'country' AND k.id = ae.entity_id WHERE ae.article_id = ?
     ORDER BY is_primary DESC`,
    articleId, articleId, articleId, articleId,
  );
  return rows.map(({ alias, ...r }) => ({ ...r, aliases: alias && alias !== r.name ? [alias] : [] }));
}

export function articlesForEntity(pub: PublicationSlug, type: EntityType, id: number, limit = 12, offset = 0): ArticleSummary[] {
  return all(
    `SELECT ${SUMMARY_COLS} FROM article_entities ae JOIN articles a ON a.id = ae.article_id
     WHERE ae.entity_type = ? AND ae.entity_id = ? AND ${VISIBLE_IN_PUB}
     ORDER BY a.published_at DESC LIMIT ? OFFSET ?`,
    type, id, pub, pub, limit, offset,
  );
}

/** 跨刊物的實體文章查詢（REST API 用），回傳總數以支援分頁 */
export function articlesByEntityApi(opts: { type?: EntityType; slug?: string; pub?: PublicationSlug; limit: number; offset: number }) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.type && opts.slug) {
    const table = { company: "companies", executive: "executives", industry: "industries", country: "countries" }[opts.type];
    where.push(`a.id IN (SELECT ae.article_id FROM article_entities ae JOIN ${table} t ON t.id = ae.entity_id WHERE ae.entity_type = ? AND t.slug = ?)`);
    params.push(opts.type, opts.slug);
  }
  if (opts.pub) {
    where.push(VISIBLE_IN_PUB);
    params.push(opts.pub, opts.pub);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = get<{ n: number }>(`SELECT count(*) AS n FROM articles a ${clause}`, ...params)!.n;
  const items = all<ArticleSummary>(
    `SELECT ${SUMMARY_COLS} FROM articles a ${clause} ORDER BY a.published_at DESC LIMIT ? OFFSET ?`,
    ...params, opts.limit, opts.offset,
  );
  return { total, items };
}

// ---------- 實體 ----------

const COMPANY_SELECT = `SELECT c.id, c.slug, c.name, c.short_name, c.ticker, c.founded, c.employees, c.description, c.updated_at,
  c.industry_id, c.country_id, i.slug AS industry_slug, i.name AS industry_name, k.slug AS country_slug, k.name AS country_name
  FROM companies c JOIN industries i ON i.id = c.industry_id JOIN countries k ON k.id = c.country_id`;

export function getCompany(slug: string): Company | undefined {
  return get(`${COMPANY_SELECT} WHERE c.slug = ?`, slug);
}

export function listCompanies(limit: number, offset: number, industry?: string): { total: number; items: Company[] } {
  const clause = industry ? "WHERE i.slug = ?" : "";
  const params = industry ? [industry] : [];
  const total = get<{ n: number }>(`SELECT count(*) AS n FROM companies c JOIN industries i ON i.id = c.industry_id ${clause}`, ...params)!.n;
  const items = all<Company>(`${COMPANY_SELECT} ${clause} ORDER BY c.name LIMIT ? OFFSET ?`, ...params, limit, offset);
  return { total, items };
}

export function companiesWhere(field: "industry_id" | "country_id", id: number, excludeId = 0, limit = 12): Company[] {
  return all(`${COMPANY_SELECT} WHERE c.${field} = ? AND c.id != ? ORDER BY c.name LIMIT ?`, id, excludeId, limit);
}

/**
 * 「相關公司」以共同出現在同一篇文章的次數排序。
 * 這比單純同產業更能反映編輯脈絡（併購對象、跨產業競爭），也是實體圖譜最便宜的近似。
 */
export function coMentionedCompanies(companyId: number, limit = 6): (Company & { mentions: number })[] {
  return all(
    `WITH co AS (
       SELECT b.entity_id AS id, count(*) AS mentions
       FROM article_entities a JOIN article_entities b ON a.article_id = b.article_id
       WHERE a.entity_type = 'company' AND a.entity_id = ? AND b.entity_type = 'company' AND b.entity_id != ?
       GROUP BY b.entity_id
     )
     SELECT x.*, co.mentions FROM co JOIN (${COMPANY_SELECT}) x ON x.id = co.id
     ORDER BY co.mentions DESC, x.name LIMIT ?`,
    companyId, companyId, limit,
  );
}

export function executivesForCompany(companyId: number): Executive[] {
  return all(
    `SELECT e.id, e.slug, e.name, e.title, e.bio, e.updated_at, c.slug AS company_slug, c.name AS company_name
     FROM executives e JOIN companies c ON c.id = e.company_id WHERE e.company_id = ? ORDER BY e.id`,
    companyId,
  );
}

export function getExecutive(slug: string): (Executive & { company_id: number }) | undefined {
  return get(
    `SELECT e.id, e.slug, e.name, e.title, e.bio, e.updated_at, e.company_id, c.slug AS company_slug, c.name AS company_name
     FROM executives e JOIN companies c ON c.id = e.company_id WHERE e.slug = ?`,
    slug,
  );
}

export function getIndustry(slug: string): Industry | undefined {
  return get("SELECT id, slug, name, description FROM industries WHERE slug = ?", slug);
}
export function listIndustries(): Industry[] {
  return all("SELECT id, slug, name, description FROM industries ORDER BY name");
}
export function getCountry(slug: string): Country | undefined {
  return get("SELECT id, slug, name, iso2, region FROM countries WHERE slug = ?", slug);
}
export function listCountries(): Country[] {
  return all("SELECT id, slug, name, iso2, region FROM countries ORDER BY name");
}

/** 某刊物近期最常被報導的公司：首頁「熱門公司」區塊，同時也是重要的內部連結入口 */
export function trendingCompanies(pub: PublicationSlug, days: number, limit: number): (Company & { mentions: number })[] {
  return all(
    `WITH m AS (
       SELECT ae.entity_id AS id, count(*) AS mentions FROM article_entities ae JOIN articles a ON a.id = ae.article_id
       WHERE ae.entity_type = 'company' AND ${VISIBLE_IN_PUB} AND a.published_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', ?)
       GROUP BY ae.entity_id
     )
     SELECT x.*, m.mentions FROM m JOIN (${COMPANY_SELECT}) x ON x.id = m.id ORDER BY m.mentions DESC, x.name LIMIT ?`,
    pub, pub, `-${days} days`, limit,
  );
}

export function entitySlugs(type: EntityType): string[] {
  const table = { company: "companies", executive: "executives", industry: "industries", country: "countries" }[type];
  return all<{ slug: string }>(`SELECT slug FROM ${table} ORDER BY id`).map((r) => r.slug);
}

// ---------- 股價 ----------

export function priceSeries(companyId: number, points = 90): PricePoint[] {
  // 先取最新 N 筆再反轉為時間正序：走主鍵索引倒序掃描，不需要排序整段歷史
  return all<PricePoint>("SELECT date, close FROM prices WHERE company_id = ? ORDER BY date DESC LIMIT ?", companyId, points).reverse();
}

export function lastPriceDates(): { id: number; slug: string; name: string; ticker: string; last_date: string | null }[] {
  return all(
    `SELECT c.id, c.slug, c.name, c.ticker, (SELECT max(date) FROM prices p WHERE p.company_id = c.id) AS last_date
     FROM companies c WHERE c.ticker IS NOT NULL ORDER BY last_date ASC, c.name`,
  );
}

// ---------- 搜尋 ----------

export interface SearchHit extends ArticleSummary { snippet: string }

export function searchArticles(pub: PublicationSlug, ftsQuery: string, limit = 20): SearchHit[] {
  // bm25 權重：標題命中比內文重要；snippet 由 SQLite 產生，避免把整篇內文傳到前端再截斷
  return all(
    `SELECT ${SUMMARY_COLS}, snippet(articles_fts, 2, '[[', ']]', ' … ', 18) AS snippet
     FROM articles_fts JOIN articles a ON a.id = articles_fts.rowid
     WHERE articles_fts MATCH ? AND ${VISIBLE_IN_PUB}
     ORDER BY bm25(articles_fts, 8.0, 3.0, 1.0) LIMIT ?`,
    ftsQuery, pub, pub, limit,
  );
}

// ---------- Sitemap ----------

/** 只列出 canonical 屬於該刊物的文章：轉載副本不進 sitemap，避免提交與 canonical 矛盾的網址 */
export function sitemapArticles(pub: PublicationSlug, limit: number, offset: number): { slug: string; updated_at: string }[] {
  return all("SELECT slug, updated_at FROM articles WHERE publication = ? ORDER BY id LIMIT ? OFFSET ?", pub, limit, offset);
}
export function countCanonicalArticles(pub: PublicationSlug): number {
  return get<{ n: number }>("SELECT count(*) AS n FROM articles WHERE publication = ?", pub)!.n;
}

/** 實體頁的 lastmod 取「最近一篇相關文章」與實體本身更新時間的較晚者，讓爬蟲優先抓真正有變動的頁面 */
export function sitemapEntities(type: EntityType, pub: PublicationSlug): { slug: string; lastmod: string | null }[] {
  const table = { company: "companies", executive: "executives", industry: "industries", country: "countries" }[type];
  const ownUpdated = type === "company" || type === "executive" ? "t.updated_at" : "NULL";
  const rows = all<{ slug: string; lastmod: string }>(
    `SELECT t.slug, max(coalesce(
       (SELECT max(a.updated_at) FROM article_entities ae JOIN articles a ON a.id = ae.article_id
        WHERE ae.entity_type = ? AND ae.entity_id = t.id AND ${VISIBLE_IN_PUB}), ''), coalesce(${ownUpdated}, '')) AS lastmod
     FROM ${table} t ORDER BY t.id`,
    type, pub, pub,
  );
  return rows.map((r) => ({ slug: r.slug, lastmod: r.lastmod || null }));
}
