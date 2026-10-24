import { NextResponse, type NextRequest } from "next/server";
import { articlesByEntityApi } from "@/lib/repo";
import { cacheHeaders, pageMeta, parsePagination } from "@/lib/http";
import { isPublicationSlug } from "@/lib/publications";
import { articlePath, canonicalUrl, entityTypes, type EntityType } from "@/lib/urls";

// GET /api/articles?entity=company:aldervane-capital&pub=northwind&page=1&pageSize=20
export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const p = parsePagination(sp);

  let type: EntityType | undefined;
  let slug: string | undefined;
  const entity = sp.get("entity");
  if (entity) {
    // 實體參數格式 "type:slug"；格式錯誤回 400，而不是默默忽略條件回傳全部文章（會讓呼叫端誤以為篩選成功）
    const [t, s] = entity.split(":");
    if (!t || !s || !(entityTypes as readonly string[]).includes(t)) {
      return NextResponse.json(
        { error: "bad_request", message: `entity must be one of ${entityTypes.join("|")}:<slug>` },
        { status: 400 },
      );
    }
    type = t as EntityType;
    slug = s;
  }
  const pubParam = sp.get("pub");
  if (pubParam && !isPublicationSlug(pubParam)) {
    return NextResponse.json({ error: "bad_request", message: `unknown pub '${pubParam}'` }, { status: 400 });
  }
  const pub = pubParam && isPublicationSlug(pubParam) ? pubParam : undefined;

  const { total, items } = articlesByEntityApi({ type, slug, pub, limit: p.pageSize, offset: p.offset });
  return NextResponse.json(
    {
      data: items.map((a) => ({
        slug: a.slug,
        title: a.title,
        dek: a.dek,
        author: a.author,
        publication: a.publication,
        publishedAt: a.published_at,
        updatedAt: a.updated_at,
        url: canonicalUrl(articlePath(a.publication, a.slug)),
      })),
      meta: pageMeta(p, total),
    },
    { headers: cacheHeaders(120) },
  );
}
