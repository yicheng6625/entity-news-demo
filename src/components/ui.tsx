import Link from "next/link";
import type { ArticleSummary } from "@/lib/repo";
import { publications, type PublicationSlug } from "@/lib/publications";
import { articlePath } from "@/lib/urls";
import { serializeJsonLd } from "@/lib/jsonld";

// 共用的伺服器元件。全部是 Server Component，不送任何 JS 到瀏覽器：
// 新聞頁的效能瓶頸通常是 JS 體積，內容頁本身不需要互動。

// 固定 UTC 時區格式化：避免伺服器與使用者時區不同時同一篇文章顯示不同日期
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}

export function ArticleList({ pub, articles, compact = false }: { pub: PublicationSlug; articles: ArticleSummary[]; compact?: boolean }) {
  if (articles.length === 0) return <p className="muted">No coverage yet.</p>;
  return (
    <ul className={compact ? "article-list compact" : "article-list"}>
      {articles.map((a) => (
        <li key={a.id}>
          <Link href={articlePath(pub, a.slug)} className="article-link">
            <span className="article-title">{a.title}</span>
          </Link>
          {!compact && <p className="article-dek">{a.dek}</p>}
          <p className="meta">
            <time dateTime={a.published_at}>{formatDate(a.published_at)}</time>
            {a.publication !== pub && <span className="badge">via {publications[a.publication].shortName}</span>}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; href: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol>
        {items.map((item, i) => (
          <li key={item.href}>
            {i < items.length - 1 ? <Link href={item.href}>{item.name}</Link> : <span aria-current="page">{item.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section className="section" aria-labelledby={id}>
      <h2 id={id} className="section-title">{title}</h2>
      {children}
    </section>
  );
}

export function ChipList({ items }: { items: { href: string; label: string; sub?: string }[] }) {
  if (items.length === 0) return <p className="muted">None found.</p>;
  return (
    <ul className="chips">
      {items.map((i) => (
        <li key={i.href}>
          <Link href={i.href}>
            {i.label}
            {i.sub && <span className="chip-sub">{i.sub}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
