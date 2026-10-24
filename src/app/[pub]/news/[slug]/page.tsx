import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolvePub } from "@/lib/route-helpers";
import { articleEntities, articlesForEntity, getArticle, isVisibleIn, recentArticleParams } from "@/lib/repo";
import { linkEntities } from "@/lib/linker";
import { newsArticleLd, breadcrumbLd } from "@/lib/jsonld";
import { publications } from "@/lib/publications";
import { articlePath, canonicalUrl, entityPath, publicationPath } from "@/lib/urls";
import { ArticleList, Breadcrumbs, ChipList, JsonLd, Section, formatDate } from "@/components/ui";

// 文章發布後很少變動，一天重新生成一次即可；真正的更正走 /api/revalidate 主動失效
export const revalidate = 86400;
// 只預先建置最近的文章，舊文章在第一次被請求時才生成並快取（長尾內容不拖慢建置）
export const dynamicParams = true;

type Props = { params: Promise<{ pub: string; slug: string }> };

export function generateStaticParams() {
  return recentArticleParams(40);
}

async function load(props: Props) {
  const pub = await resolvePub(props.params);
  const { slug } = await props.params;
  const article = getArticle(slug);
  if (!article || !isVisibleIn(article, pub.slug)) notFound();
  return { pub, article };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { pub, article } = await load(props);
  // 轉載文章的 canonical 指回原刊物：兩個品牌都能刊登，但排名訊號集中在原文
  const canonical = canonicalUrl(articlePath(article.publication, article.slug));
  return {
    title: `${article.title} | ${pub.shortName}`,
    description: article.dek,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.dek,
      url: canonical,
      siteName: pub.name,
      publishedTime: article.published_at,
      modifiedTime: article.updated_at,
      authors: [article.author],
    },
  };
}

export default async function ArticlePage(props: Props) {
  const { pub, article } = await load(props);
  const entities = articleEntities(article.id);
  const canonical = canonicalUrl(articlePath(article.publication, article.slug));

  const paragraphs = linkEntities(
    article.body.split(/\n{2,}/),
    entities.map((e) => ({
      key: `${e.type}:${e.id}`,
      href: entityPath(pub.slug, e.type, e.slug),
      names: [e.name, ...e.aliases],
    })),
  );

  const primary = entities.find((e) => e.is_primary && e.type === "company");
  // 「同一主實體的更多報導」是最有價值的內部連結：讓爬蟲沿著實體圖譜發現長尾文章
  const more = primary ? articlesForEntity(pub.slug, "company", primary.id, 6).filter((a) => a.id !== article.id).slice(0, 5) : [];
  const origin = publications[article.publication];

  return (
    <article className="article">
      <JsonLd
        data={[
          newsArticleLd(origin, article, entities, canonical),
          breadcrumbLd([
            { name: pub.name, url: canonicalUrl(publicationPath(pub.slug)) },
            { name: article.title, url: canonical },
          ]),
        ]}
      />
      <Breadcrumbs
        items={[
          { name: pub.shortName, href: publicationPath(pub.slug) },
          ...(primary ? [{ name: primary.name, href: entityPath(pub.slug, "company", primary.slug) }] : []),
          { name: "Article", href: articlePath(pub.slug, article.slug) },
        ]}
      />
      <header className="article-head">
        <h1>{article.title}</h1>
        <p className="lead-dek">{article.dek}</p>
        <p className="meta">
          By {article.author} · <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>
          {article.updated_at !== article.published_at && (
            <> · Updated <time dateTime={article.updated_at}>{formatDate(article.updated_at)}</time></>
          )}
          {origin.slug !== pub.slug && (
            <span className="badge">
              Originally published in <Link href={articlePath(origin.slug, article.slug)}>{origin.name}</Link>
            </span>
          )}
        </p>
      </header>
      <div className="article-body">
        {paragraphs.map((segments, i) => (
          <p key={i}>
            {segments.map((s, j) =>
              s.type === "link" ? (
                <Link key={j} href={s.href} className="entity-link">
                  {s.text}
                </Link>
              ) : (
                s.text
              ),
            )}
          </p>
        ))}
      </div>
      <Section title="In this story" id="entities">
        <ChipList
          items={entities.map((e) => ({ href: entityPath(pub.slug, e.type, e.slug), label: e.name, sub: e.type[0]!.toUpperCase() + e.type.slice(1) }))}
        />
      </Section>
      {primary && (
        <Section title={`More on ${primary.name}`} id="more">
          <ArticleList pub={pub.slug} articles={more} compact />
        </Section>
      )}
    </article>
  );
}
