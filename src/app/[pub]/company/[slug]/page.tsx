import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolvePub } from "@/lib/route-helpers";
import {
  articlesForEntity, coMentionedCompanies, companiesWhere, entitySlugs, executivesForCompany, getCompany, priceSeries,
} from "@/lib/repo";
import { publicationSlugs } from "@/lib/publications";
import { breadcrumbLd, companyLd } from "@/lib/jsonld";
import { isStale, todayUtc } from "@/lib/freshness";
import { canonicalUrl, entityPath, publicationPath } from "@/lib/urls";
import { ArticleList, Breadcrumbs, ChipList, JsonLd, Section } from "@/components/ui";
import { PriceChart } from "@/components/PriceChart";

// 實體頁：靜態生成 + 每小時 ISR。股價每日更新、相關文章持續增加，一小時是新鮮度與源站負載的折衷
export const revalidate = 3600;

type Props = { params: Promise<{ pub: string; slug: string }> };

// 程式化頁面生成：每個刊物 × 每家公司一頁。百萬級實體時改為只預建熱門實體，其餘按需生成
export function generateStaticParams() {
  const slugs = entitySlugs("company");
  return publicationSlugs.flatMap((pub) => slugs.map((slug) => ({ pub, slug })));
}

async function load(props: Props) {
  const pub = await resolvePub(props.params);
  const { slug } = await props.params;
  const company = getCompany(slug);
  if (!company) notFound();
  return { pub, company };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { pub, company } = await load(props);
  const title = company.ticker ? `${company.name} (${company.ticker}) news, executives & stock` : `${company.name} news & executives`;
  return {
    title: `${title} | ${pub.shortName}`,
    description: `Latest ${pub.name} coverage of ${company.name}, a ${company.country_name}-based ${company.industry_name.toLowerCase()} company: news, leadership and peers.`,
    // 實體頁在每個刊物各自 self-canonical：兩個品牌的頁面列出的報導不同，屬於不同內容而非重複
    alternates: { canonical: canonicalUrl(entityPath(pub.slug, "company", company.slug)) },
  };
}

export default async function CompanyPage(props: Props) {
  const { pub, company } = await load(props);
  const url = canonicalUrl(entityPath(pub.slug, "company", company.slug));
  const execs = executivesForCompany(company.id);
  const articles = articlesForEntity(pub.slug, "company", company.id, 12);
  const related = coMentionedCompanies(company.id, 6);
  const peers = companiesWhere("industry_id", company.industry_id, company.id, 8);
  const prices = company.ticker ? priceSeries(company.id, 90) : [];
  const stale = company.ticker ? isStale(prices.at(-1)?.date ?? null, todayUtc()) : false;

  return (
    <>
      <JsonLd
        data={[
          companyLd(company, url, execs, (s) => canonicalUrl(entityPath(pub.slug, "executive", s))),
          breadcrumbLd([
            { name: pub.name, url: canonicalUrl(publicationPath(pub.slug)) },
            { name: company.industry_name, url: canonicalUrl(entityPath(pub.slug, "industry", company.industry_slug)) },
            { name: company.name, url },
          ]),
        ]}
      />
      <Breadcrumbs
        items={[
          { name: pub.shortName, href: publicationPath(pub.slug) },
          { name: company.industry_name, href: entityPath(pub.slug, "industry", company.industry_slug) },
          { name: company.name, href: entityPath(pub.slug, "company", company.slug) },
        ]}
      />
      <header className="entity-head">
        <p className="kicker">Company</p>
        <h1>{company.name}</h1>
        <dl className="facts">
          <div><dt>Ticker</dt><dd>{company.ticker ?? "Private"}</dd></div>
          <div><dt>Industry</dt><dd><Link href={entityPath(pub.slug, "industry", company.industry_slug)}>{company.industry_name}</Link></dd></div>
          <div><dt>Headquarters</dt><dd><Link href={entityPath(pub.slug, "country", company.country_slug)}>{company.country_name}</Link></dd></div>
          <div><dt>Founded</dt><dd>{company.founded}</dd></div>
          <div><dt>Employees</dt><dd>{company.employees.toLocaleString("en-US")}</dd></div>
        </dl>
        <p className="entity-desc">{company.description}</p>
      </header>

      <div className="entity-grid">
        <div>
          {company.ticker && <PriceChart ticker={company.ticker} points={prices} stale={stale} />}
          <Section title={`Latest on ${company.short_name}`} id="coverage">
            <ArticleList pub={pub.slug} articles={articles} />
          </Section>
        </div>
        <aside className="rail">
          {/* 沒有資料的區塊直接不渲染，避免出現大量「None found」的空殼內容 */}
          {execs.length > 0 && (
            <Section title="Leadership" id="leadership">
              <ChipList items={execs.map((e) => ({ href: entityPath(pub.slug, "executive", e.slug), label: e.name, sub: e.title }))} />
            </Section>
          )}
          <Section title="Often covered with" id="related">
            <ChipList items={related.map((c) => ({ href: entityPath(pub.slug, "company", c.slug), label: c.name, sub: `${c.mentions} shared stories` }))} />
          </Section>
          <Section title={`${company.industry_name} peers`} id="peers">
            <ChipList items={peers.map((c) => ({ href: entityPath(pub.slug, "company", c.slug), label: c.name, sub: c.country_name }))} />
          </Section>
        </aside>
      </div>
    </>
  );
}
