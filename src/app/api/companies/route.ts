import { NextResponse, type NextRequest } from "next/server";
import { listCompanies } from "@/lib/repo";
import { cacheHeaders, pageMeta, parsePagination } from "@/lib/http";

// GET /api/companies?page=1&pageSize=20&industry=fintech
export function GET(req: NextRequest) {
  const p = parsePagination(req.nextUrl.searchParams);
  const industry = req.nextUrl.searchParams.get("industry") ?? undefined;
  const { total, items } = listCompanies(p.pageSize, p.offset, industry);
  return NextResponse.json(
    {
      data: items.map((c) => ({
        slug: c.slug,
        name: c.name,
        ticker: c.ticker,
        industry: { slug: c.industry_slug, name: c.industry_name },
        country: { slug: c.country_slug, name: c.country_name },
        href: `/api/companies/${c.slug}`,
      })),
      meta: pageMeta(p, total),
    },
    // 公司清單變動慢，CDN 快取 10 分鐘
    { headers: cacheHeaders(600) },
  );
}
