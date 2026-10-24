import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { publicationSlugs } from "@/lib/publications";
import { articlePath, entityPath, entityTypes, type EntityType } from "@/lib/urls";

// 主動失效（on-demand ISR）：CMS 發布更正或股價匯入完成後呼叫，
// 讓受影響的頁面立即更新，而不是等 revalidate 週期到期。這樣 revalidate 可以設長，降低源站負載。
//
// POST /api/revalidate  header: x-revalidate-secret
// body: { "type": "company", "slug": "aldervane-capital" }  或  { "article": "<slug>" }

function authorized(req: NextRequest): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  const given = req.headers.get("x-revalidate-secret");
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  // 固定時間比較，避免以回應時間差逐字猜出密鑰
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "disabled", message: "REVALIDATE_SECRET is not configured" }, { status: 503 });
  }
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { type?: string; slug?: string; article?: string } | null;
  const paths: string[] = [];
  if (body?.article) {
    publicationSlugs.forEach((p) => paths.push(articlePath(p, body.article!)));
  } else if (body?.type && body.slug && (entityTypes as readonly string[]).includes(body.type)) {
    // 同一實體在每個品牌都有頁面，必須全部失效，否則兩個刊物會顯示不一致的資料
    publicationSlugs.forEach((p) => paths.push(entityPath(p, body.type as EntityType, body.slug!)));
  } else {
    return NextResponse.json({ error: "bad_request", message: "provide {article} or {type, slug}" }, { status: 400 });
  }
  paths.forEach((p) => revalidatePath(p));
  return NextResponse.json({ revalidated: paths });
}
