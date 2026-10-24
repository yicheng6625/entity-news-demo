import { NextResponse, type NextRequest } from "next/server";
import { coMentionedCompanies, executivesForCompany, getCompany, priceSeries } from "@/lib/repo";
import { cacheHeaders } from "@/lib/http";
import { isStale, todayUtc } from "@/lib/freshness";
import { publicationSlugs } from "@/lib/publications";
import { canonicalUrl, entityPath } from "@/lib/urls";

// GET /api/companies/:slug — 單一公司實體，附帶高管、相關公司與近期股價
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = getCompany(slug);
  if (!company) {
    // 404 也短暫快取：避免爬蟲反覆打不存在的 slug 時每次都穿透到資料庫
    return NextResponse.json({ error: "not_found", message: `Company '${slug}' not found` }, { status: 404, headers: cacheHeaders(60) });
  }
  const prices = company.ticker ? priceSeries(company.id, 30) : [];
  const lastDate = prices.at(-1)?.date ?? null;

  return NextResponse.json(
    {
      data: {
        slug: company.slug,
        name: company.name,
        shortName: company.short_name,
        ticker: company.ticker,
        founded: company.founded,
        employees: company.employees,
        description: company.description,
        industry: { slug: company.industry_slug, name: company.industry_name },
        country: { slug: company.country_slug, name: company.country_name },
        executives: executivesForCompany(company.id).map((e) => ({ slug: e.slug, name: e.name, title: e.title })),
        relatedCompanies: coMentionedCompanies(company.id, 5).map((c) => ({ slug: c.slug, name: c.name, sharedStories: c.mentions })),
        prices: company.ticker ? { lastDate, stale: isStale(lastDate, todayUtc()), series: prices } : null,
        // 讓 API 使用者知道每個品牌上的對應頁面，前端不需要自己組網址
        pages: Object.fromEntries(publicationSlugs.map((p) => [p, canonicalUrl(entityPath(p, "company", company.slug))])),
        updatedAt: company.updated_at,
      },
      links: { articles: `/api/articles?entity=company:${company.slug}` },
    },
    // 股價每天更新，5 分鐘 CDN 快取足夠；背景更新期間仍回舊資料，不讓尖峰流量打穿
    { headers: cacheHeaders(300) },
  );
}
