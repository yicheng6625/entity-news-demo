import Link from "next/link";
import type { Metadata } from "next";
import { resolvePub } from "@/lib/route-helpers";
import { latestArticles, listCountries, listIndustries, trendingCompanies } from "@/lib/repo";
import { articlePath, canonicalUrl, entityPath, publicationPath } from "@/lib/urls";
import { publisherLd } from "@/lib/jsonld";
import { ArticleList, ChipList, JsonLd, Section, formatDate } from "@/components/ui";

// 首頁內容變動最頻繁，5 分鐘重新生成一次；CDN 在背景更新時仍回傳舊版，讀者不會等待
export const revalidate = 300;

type Props = { params: Promise<{ pub: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const pub = await resolvePub(params);
  return {
    title: `${pub.name} — ${pub.tagline}`,
    description: pub.tagline,
    alternates: { canonical: canonicalUrl(publicationPath(pub.slug)) },
    openGraph: { siteName: pub.name, type: "website", url: canonicalUrl(publicationPath(pub.slug)) },
  };
}

export default async function PublicationHome({ params }: Props) {
  const pub = await resolvePub(params);
  const articles = latestArticles(pub.slug, 13);
  const [lead, ...rest] = articles;
  const trending = trendingCompanies(pub.slug, 60, 10);
  // 依刊物編輯定位排序產業，讓兩個品牌即使共用資料，首頁也呈現不同重點
  const industries = listIndustries().sort(
    (a, b) => Number(pub.focusIndustries.includes(b.slug)) - Number(pub.focusIndustries.includes(a.slug)),
  );

  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", ...publisherLd(pub) }} />
      <h1 className="visually-hidden">{pub.name}</h1>
      <div className="home-grid">
        <div>
          {lead && (
            <article className="lead">
              <p className="kicker">Latest</p>
              <h2 className="lead-title">
                <Link href={articlePath(pub.slug, lead.slug)}>{lead.title}</Link>
              </h2>
              <p className="lead-dek">{lead.dek}</p>
              <p className="meta">
                By {lead.author} · <time dateTime={lead.published_at}>{formatDate(lead.published_at)}</time>
              </p>
            </article>
          )}
          <Section title="More stories" id="more">
            <ArticleList pub={pub.slug} articles={rest} />
          </Section>
        </div>
        <aside className="rail">
          <Section title="Most covered companies" id="trending">
            <ol className="ranked">
              {trending.map((c) => (
                <li key={c.id}>
                  <Link href={entityPath(pub.slug, "company", c.slug)}>{c.name}</Link>
                  <span className="muted"> {c.ticker ?? "Private"} · {c.mentions} stories</span>
                </li>
              ))}
            </ol>
          </Section>
          <Section title="Industries" id="industries">
            <ChipList items={industries.map((i) => ({ href: entityPath(pub.slug, "industry", i.slug), label: i.name }))} />
          </Section>
          <Section title="Countries" id="countries">
            <ChipList items={listCountries().map((c) => ({ href: entityPath(pub.slug, "country", c.slug), label: c.name }))} />
          </Section>
        </aside>
      </div>
    </>
  );
}
