import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolvePub } from "@/lib/route-helpers";
import { articlesForEntity, companiesWhere, entitySlugs, getIndustry } from "@/lib/repo";
import { publicationSlugs } from "@/lib/publications";
import { breadcrumbLd } from "@/lib/jsonld";
import { canonicalUrl, entityPath, publicationPath } from "@/lib/urls";
import { ArticleList, Breadcrumbs, ChipList, JsonLd, Section } from "@/components/ui";

export const revalidate = 3600;

type Props = { params: Promise<{ pub: string; slug: string }> };

export function generateStaticParams() {
  const slugs = entitySlugs("industry");
  return publicationSlugs.flatMap((pub) => slugs.map((slug) => ({ pub, slug })));
}

async function load(props: Props) {
  const pub = await resolvePub(props.params);
  const { slug } = await props.params;
  const industry = getIndustry(slug);
  if (!industry) notFound();
  return { pub, industry };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { pub, industry } = await load(props);
  return {
    title: `${industry.name} news & companies | ${pub.shortName}`,
    description: `${industry.description} Latest ${industry.name.toLowerCase()} coverage from ${pub.name}.`,
    alternates: { canonical: canonicalUrl(entityPath(pub.slug, "industry", industry.slug)) },
  };
}

export default async function IndustryPage(props: Props) {
  const { pub, industry } = await load(props);
  const url = canonicalUrl(entityPath(pub.slug, "industry", industry.slug));
  const companies = companiesWhere("industry_id", industry.id, 0, 30);
  const articles = articlesForEntity(pub.slug, "industry", industry.id, 15);

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: pub.name, url: canonicalUrl(publicationPath(pub.slug)) },
          { name: industry.name, url },
        ])}
      />
      <Breadcrumbs
        items={[
          { name: pub.shortName, href: publicationPath(pub.slug) },
          { name: industry.name, href: entityPath(pub.slug, "industry", industry.slug) },
        ]}
      />
      <header className="entity-head">
        <p className="kicker">Industry</p>
        <h1>{industry.name}</h1>
        <p className="entity-desc">{industry.description}</p>
      </header>
      <div className="entity-grid">
        <div>
          <Section title="Latest coverage" id="coverage">
            <ArticleList pub={pub.slug} articles={articles} />
          </Section>
        </div>
        <aside className="rail">
          <Section title={`Companies (${companies.length})`} id="companies">
            <ChipList
              items={companies.map((c) => ({ href: entityPath(pub.slug, "company", c.slug), label: c.name, sub: c.ticker ?? "Private" }))}
            />
          </Section>
        </aside>
      </div>
    </>
  );
}
