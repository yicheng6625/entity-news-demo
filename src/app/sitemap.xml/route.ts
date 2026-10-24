import { publicationSlugs } from "@/lib/publications";
import { countCanonicalArticles } from "@/lib/repo";
import { buildSitemapIndex, shardFileName, shardsForPublication } from "@/lib/sitemap";
import { siteOrigin } from "@/lib/urls";

// Sitemap index：只列出分片位置，本身很小，可以頻繁重新產生
export const revalidate = 3600;

export function GET() {
  const locs = publicationSlugs.flatMap((pub) =>
    shardsForPublication(pub, countCanonicalArticles(pub)).map((s) => `${siteOrigin()}/sitemaps/${shardFileName(s)}`),
  );
  return new Response(buildSitemapIndex(locs), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
