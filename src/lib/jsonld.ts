import type { Publication } from "./publications";
import type { Article, Company, EntityRef, Executive } from "./repo";
import { canonicalUrl, entityPath, publicationPath } from "./urls";

// 結構化資料（schema.org JSON-LD）產生器。
// 搜尋引擎靠這些資料把「文章」與「公司 / 人物」實體連起來（Top Stories、知識面板），
// 所以每個實體都帶上 @id = canonical URL，讓不同頁面的 JSON-LD 指向同一個節點而非各自孤立。

type Json = Record<string, unknown>;

export function publisherLd(pub: Publication): Json {
  return {
    "@type": "NewsMediaOrganization",
    "@id": `${canonicalUrl(publicationPath(pub.slug))}#publisher`,
    name: pub.name,
    url: canonicalUrl(publicationPath(pub.slug)),
  };
}

export function newsArticleLd(pub: Publication, article: Article, entities: EntityRef[], url: string): Json {
  const ref = (e: EntityRef) => ({
    "@type": e.type === "executive" ? "Person" : e.type === "company" ? "Organization" : "Thing",
    "@id": canonicalUrl(entityPath(pub.slug, e.type, e.slug)),
    name: e.name,
  });
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.dek,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: [{ "@type": "Person", name: article.author }],
    publisher: publisherLd(pub),
    // about = 主要實體；mentions = 次要實體。區分兩者讓搜尋引擎知道文章「在講誰」而非只是「提到誰」
    about: entities.filter((e) => e.is_primary).map(ref),
    mentions: entities.filter((e) => !e.is_primary && (e.type === "company" || e.type === "executive")).map(ref),
    contentLocation: entities.filter((e) => e.type === "country").map((e) => ({ "@type": "Place", name: e.name })),
  };
}

export function companyLd(company: Company, url: string, executives: Executive[], execUrl: (slug: string) => string): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Corporation",
    "@id": url,
    name: company.name,
    alternateName: company.short_name,
    url,
    description: company.description,
    foundingDate: String(company.founded),
    numberOfEmployees: { "@type": "QuantitativeValue", value: company.employees },
    address: { "@type": "PostalAddress", addressCountry: company.country_name },
    ...(company.ticker ? { tickerSymbol: company.ticker } : {}),
    employee: executives.map((e) => ({ "@type": "Person", "@id": execUrl(e.slug), name: e.name, jobTitle: e.title })),
  };
}

export function personLd(exec: Executive, url: string, companyUrl: string): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": url,
    name: exec.name,
    jobTitle: exec.title,
    description: exec.bio,
    worksFor: { "@type": "Organization", "@id": companyUrl, name: exec.company_name },
  };
}

export function breadcrumbLd(items: { name: string; url: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: item.url })),
  };
}

/**
 * 序列化成可安全放進 <script> 的字串。
 * 必須跳脫 "<"：若內容含 "</script>"（例如文章標題被惡意輸入），否則會提早結束 script 標籤造成 XSS。
 */
export function serializeJsonLd(data: Json | Json[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
