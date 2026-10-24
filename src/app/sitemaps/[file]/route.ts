import { publications } from "@/lib/publications";
import { countCanonicalArticles, latestArticles, sitemapArticles, sitemapEntities } from "@/lib/repo";
import { ARTICLES_PER_SHARD, buildNewsSitemap, buildUrlset, parseShardFileName, shardFileName, shardsForPublication } from "@/lib/sitemap";
import { articlePath, canonicalUrl, entityPath, publicationPath } from "@/lib/urls";

export const revalidate = 3600;

// 預先產生所有已知分片；新增的分片（文章變多）在第一次請求時才生成
export function generateStaticParams() {
  return Object.values(publications).flatMap((p) =>
    shardsForPublication(p.slug, countCanonicalArticles(p.slug)).map((s) => ({ file: shardFileName(s) })),
  );
}

const xml = (body: string) => new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const shard = parseShardFileName((await params).file);
  if (!shard) return new Response("Not found", { status: 404 });
  const { pub, kind } = shard;

  switch (kind) {
    case "pages":
      return xml(buildUrlset([{ loc: canonicalUrl(publicationPath(pub)) }]));
    case "news": {
      // 新聞 sitemap 只放原刊於本刊物且 48 小時內的文章
      const cutoff = Date.now() - 48 * 3_600_000;
      const recent = latestArticles(pub, 1000).filter((a) => a.publication === pub && Date.parse(a.published_at) >= cutoff);
      return xml(
        buildNewsSitemap(
          publications[pub].name,
          recent.map((a) => ({ loc: canonicalUrl(articlePath(pub, a.slug)), title: a.title, published: a.published_at })),
        ),
      );
    }
    case "articles": {
      const rows = sitemapArticles(pub, ARTICLES_PER_SHARD, (shard.index - 1) * ARTICLES_PER_SHARD);
      if (rows.length === 0) return new Response("Not found", { status: 404 });
      return xml(buildUrlset(rows.map((r) => ({ loc: canonicalUrl(articlePath(pub, r.slug)), lastmod: r.updated_at }))));
    }
    default:
      return xml(
        buildUrlset(sitemapEntities(kind, pub).map((r) => ({ loc: canonicalUrl(entityPath(pub, kind, r.slug)), lastmod: r.lastmod }))),
      );
  }
}
