import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolvePub } from "@/lib/route-helpers";
import { articlesForEntity, entitySlugs, executivesForCompany, getExecutive } from "@/lib/repo";
import { publicationSlugs } from "@/lib/publications";
import { breadcrumbLd, personLd } from "@/lib/jsonld";
import { canonicalUrl, entityPath, publicationPath } from "@/lib/urls";
import { ArticleList, Breadcrumbs, ChipList, JsonLd, Section } from "@/components/ui";

export const revalidate = 3600;

type Props = { params: Promise<{ pub: string; slug: string }> };

export function generateStaticParams() {
  const slugs = entitySlugs("executive");
  return publicationSlugs.flatMap((pub) => slugs.map((slug) => ({ pub, slug })));
}

async function load(props: Props) {
  const pub = await resolvePub(props.params);
  const { slug } = await props.params;
  const exec = getExecutive(slug);
  if (!exec) notFound();
  return { pub, exec };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { pub, exec } = await load(props);
  return {
    title: `${exec.name}, ${exec.title} of ${exec.company_name} | ${pub.shortName}`,
    description: `${pub.name} coverage of ${exec.name}, ${exec.title} at ${exec.company_name}.`,
    alternates: { canonical: canonicalUrl(entityPath(pub.slug, "executive", exec.slug)) },
  };
}

export default async function ExecutivePage(props: Props) {
  const { pub, exec } = await load(props);
  const url = canonicalUrl(entityPath(pub.slug, "executive", exec.slug));
  const companyUrl = canonicalUrl(entityPath(pub.slug, "company", exec.company_slug));
  const articles = articlesForEntity(pub.slug, "executive", exec.id, 12);
  // 文章未直接標註此人時，退回顯示其公司的報導，避免實體頁內容過薄（thin content）被搜尋引擎降權
  const fallback = articles.length === 0 ? articlesForEntity(pub.slug, "company", exec.company_id, 6) : [];
  const colleagues = executivesForCompany(exec.company_id).filter((e) => e.id !== exec.id);

  return (
    <>
      <JsonLd
        data={[
          personLd(exec, url, companyUrl),
          breadcrumbLd([
            { name: pub.name, url: canonicalUrl(publicationPath(pub.slug)) },
            { name: exec.company_name, url: companyUrl },
            { name: exec.name, url },
          ]),
        ]}
      />
      <Breadcrumbs
        items={[
          { name: pub.shortName, href: publicationPath(pub.slug) },
          { name: exec.company_name, href: entityPath(pub.slug, "company", exec.company_slug) },
          { name: exec.name, href: entityPath(pub.slug, "executive", exec.slug) },
        ]}
      />
      <header className="entity-head">
        <p className="kicker">Executive</p>
        <h1>{exec.name}</h1>
        <p className="entity-sub">
          {exec.title}, <Link href={entityPath(pub.slug, "company", exec.company_slug)}>{exec.company_name}</Link>
        </p>
        <p className="entity-desc">{exec.bio}</p>
      </header>
      <div className="entity-grid">
        <div>
          {articles.length > 0 ? (
            <Section title={`Coverage mentioning ${exec.name}`} id="coverage">
              <ArticleList pub={pub.slug} articles={articles} />
            </Section>
          ) : (
            <Section title={`Latest on ${exec.company_name}`} id="coverage">
              <ArticleList pub={pub.slug} articles={fallback} />
            </Section>
          )}
        </div>
        <aside className="rail">
          <Section title="Colleagues" id="colleagues">
            <ChipList items={colleagues.map((e) => ({ href: entityPath(pub.slug, "executive", e.slug), label: e.name, sub: e.title }))} />
          </Section>
        </aside>
      </div>
    </>
  );
}
