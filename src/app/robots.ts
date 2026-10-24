import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/urls";

// 爬取預算管理：API、後台、站內搜尋結果頁對搜尋引擎沒有價值，擋掉後爬蟲會把配額花在文章與實體頁
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin/", "/*/search"] }],
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
