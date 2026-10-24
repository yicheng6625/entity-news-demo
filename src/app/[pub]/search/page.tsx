import Link from "next/link";
import type { Metadata } from "next";
import { resolvePub } from "@/lib/route-helpers";
import { searchArticles } from "@/lib/repo";
import { toFtsQuery } from "@/lib/search";
import { articlePath, canonicalUrl, publicationPath } from "@/lib/urls";
import { formatDate } from "@/components/ui";

type Props = { params: Promise<{ pub: string }>; searchParams: Promise<{ q?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pub = await resolvePub(params);
  return {
    title: `Search | ${pub.shortName}`,
    alternates: { canonical: canonicalUrl(publicationPath(pub.slug, "/search")) },
    // 站內搜尋結果頁是無限組合的低品質頁面，不讓搜尋引擎索引以節省爬取預算；follow 讓連結仍可被發現
    robots: { index: false, follow: true },
  };
}

/** snippet() 以 [[ ]] 標記命中字詞；在這裡轉成 <mark>，而不是讓 SQLite 直接輸出 HTML（避免 XSS） */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\[\[.*?\]\])/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith("[[") && p.endsWith("]]") ? <mark key={i}>{p.slice(2, -2)}</mark> : p))}
    </>
  );
}

export default async function SearchPage({ params, searchParams }: Props) {
  const pub = await resolvePub(params);
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 200) ?? "";
  const fts = toFtsQuery(q);
  const hits = fts ? searchArticles(pub.slug, fts, 25) : [];

  return (
    <div className="search">
      <h1>Search {pub.shortName}</h1>
      {/* 使用原生 GET 表單：不需要任何前端 JS，結果頁網址也可分享 */}
      <form action={publicationPath(pub.slug, "/search")} method="get" className="search-form" role="search">
        <label htmlFor="q" className="visually-hidden">Search articles</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Company, executive, topic…" autoComplete="off" />
        <button type="submit">Search</button>
      </form>
      {q && (
        <p className="muted">
          {hits.length} result{hits.length === 1 ? "" : "s"} for “{q}”
        </p>
      )}
      <ul className="article-list">
        {hits.map((h) => (
          <li key={h.id}>
            <Link href={articlePath(pub.slug, h.slug)} className="article-link">
              <span className="article-title">{h.title}</span>
            </Link>
            <p className="article-dek"><Highlighted text={h.snippet} /></p>
            <p className="meta"><time dateTime={h.published_at}>{formatDate(h.published_at)}</time></p>
          </li>
        ))}
      </ul>
    </div>
  );
}
