import Link from "next/link";
import type { Metadata } from "next";
import { publications } from "@/lib/publications";
import { publicationPath } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Entity News Platform — demo",
  // 平台入口只是導覽頁，不應與各品牌首頁競爭排名
  robots: { index: false, follow: true },
};

const endpoints = [
  { href: "/api/companies?pageSize=5", label: "GET /api/companies" },
  { href: "/api/companies/aldervane-capital", label: "GET /api/companies/[slug]" },
  { href: "/api/articles?entity=industry:fintech&pageSize=5", label: "GET /api/articles?entity=…" },
  { href: "/sitemap.xml", label: "sitemap.xml (index)" },
  { href: "/robots.txt", label: "robots.txt" },
  { href: "/admin/freshness", label: "Admin · data freshness" },
];

export default function PlatformHome() {
  return (
    <main className="platform">
      <div className="wrap">
        <p className="kicker">One codebase · multiple publications</p>
        <h1>Entity News Platform</h1>
        <p className="platform-lede">
          A demo of entity-based business publishing: articles linked to companies, executives, industries and countries;
          programmatic entity hubs; technical SEO; and a cached REST API. All publications, companies and people are fictional.
        </p>
        <div className="pub-cards">
          {Object.values(publications).map((p) => (
            <Link key={p.slug} href={publicationPath(p.slug)} className="pub-card" style={{ borderTopColor: p.theme.accent }}>
              <span className="pub-card-name" style={{ fontFamily: p.theme.headingFont, color: p.theme.accent }}>{p.name}</span>
              <span className="muted">{p.tagline}</span>
            </Link>
          ))}
        </div>
        <h2 className="section-title">Platform endpoints</h2>
        <ul className="endpoint-list">
          {endpoints.map((e) => (
            <li key={e.href}>
              <a href={e.href}><code>{e.label}</code></a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
