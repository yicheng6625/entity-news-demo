import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolvePub } from "@/lib/route-helpers";
import { articlesForEntity, companiesWhere, entitySlugs, getCountry } from "@/lib/repo";
import { publicationSlugs } from "@/lib/publications";
import { breadcrumbLd } from "@/lib/jsonld";
import { canonicalUrl, entityPath, publicationPath } from "@/lib/urls";
import { ArticleList, Breadcrumbs, ChipList, JsonLd, Section } from "@/components/ui";

export const revalidate = 3600;

type Props = { params: Promise<{ pub: string; slug: string }> };

export function generateStaticParams() {
  const slugs = entitySlugs("country");
  return publicationSlugs.flatMap((pub) => slugs.map((slug) => ({ pub, slug })));
}

async function load(props: Props) {
  const pub = await resolvePub(props.params);
  const { slug } = await props.params;
  const country = getCountry(slug);
  if (!country) notFound();
  return { pub, country };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { pub, country } = await load(props);
  return {
    title: `${country.name} business news | ${pub.shortName}`,
    description: `Companies headquartered in ${country.name} and the latest ${pub.name} coverage from the market.`,
    alternates: { canonical: canonicalUrl(entityPath(pub.slug, "country", country.slug)) },
  };
}

export default async function CountryPage(props: Props) {
  const { pub, country } = await load(props);
  const url = canonicalUrl(entityPath(pub.slug, "country", country.slug));
  const companies = companiesWhere("country_id", country.id, 0, 30);
  const articles = articlesForEntity(pub.slug, "country", country.id, 15);

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: pub.name, url: canonicalUrl(publicationPath(pub.slug)) },
          { name: country.name, url },
        ])}
      />
      <Breadcrumbs
        items={[
          { name: pub.shortName, href: publicationPath(pub.slug) },
          { name: country.name, href: entityPath(pub.slug, "country", country.slug) },
        ]}
      />
      <header className="entity-head">
        <p className="kicker">Country · {country.region}</p>
        <h1>{country.name}</h1>
      </header>
      <div className="entity-grid">
        <div>
          <Section title="Latest coverage" id="coverage">
            <ArticleList pub={pub.slug} articles={articles} />
          </Section>
        </div>
        <aside className="rail">
          <Section title={`Headquartered in ${country.name} (${companies.length})`} id="companies">
            <ChipList
              items={companies.map((c) => ({ href: entityPath(pub.slug, "company", c.slug), label: c.name, sub: c.industry_name }))}
            />
          </Section>
        </aside>
      </div>
    </>
  );
}
