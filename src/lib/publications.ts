// 多品牌設定：同一份程式碼服務多個刊物。
// 品牌差異集中在「設定」而非「分支程式碼」，新增刊物只需加一筆設定，不必複製頁面元件。

export type PublicationSlug = "northwind" | "harbor";

export interface Publication {
  slug: PublicationSlug;
  name: string;
  shortName: string;
  tagline: string;
  /** 正式網域（host mapping 用）。本地開發時改走 /[pub] 路徑前綴。 */
  domain: string;
  /** 文章的編輯定位：決定首頁優先呈現哪些產業 */
  focusIndustries: string[];
  theme: {
    accent: string;
    accentSoft: string;
    ink: string;
    paper: string;
    /** 字體堆疊使用系統字型，避免建置期向外部字型 CDN 取資源，也省去 FOIT */
    headingFont: string;
  };
  nav: { label: string; href: string }[];
}

export const publications: Record<PublicationSlug, Publication> = {
  northwind: {
    slug: "northwind",
    name: "Northwind Markets Review",
    shortName: "Northwind",
    tagline: "Markets, capital and the companies that move them.",
    domain: "northwind-markets.example",
    focusIndustries: ["fintech", "semiconductors", "energy-transition", "logistics"],
    theme: {
      accent: "#0f4c5c",
      accentSoft: "#e3eef0",
      ink: "#14181c",
      paper: "#fbfaf7",
      headingFont: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
    },
    nav: [
      { label: "Latest", href: "" },
      { label: "Fintech", href: "/industry/fintech" },
      { label: "Semiconductors", href: "/industry/semiconductors" },
      { label: "Energy", href: "/industry/energy-transition" },
      { label: "Search", href: "/search" },
    ],
  },
  harbor: {
    slug: "harbor",
    name: "Harbor Business Review",
    shortName: "Harbor",
    tagline: "Strategy and leadership across Asia-Pacific and beyond.",
    domain: "harbor-business.example",
    focusIndustries: ["consumer-retail", "healthcare", "logistics", "media"],
    theme: {
      accent: "#9a3412",
      accentSoft: "#fbece4",
      ink: "#1c1917",
      paper: "#fffdf9",
      headingFont: '"Avenir Next", "Segoe UI", system-ui, sans-serif',
    },
    nav: [
      { label: "Latest", href: "" },
      { label: "Retail", href: "/industry/consumer-retail" },
      { label: "Healthcare", href: "/industry/healthcare" },
      { label: "Japan", href: "/country/japan" },
      { label: "Search", href: "/search" },
    ],
  },
};

export const publicationSlugs = Object.keys(publications) as PublicationSlug[];

export function isPublicationSlug(value: string): value is PublicationSlug {
  return Object.hasOwn(publications, value);
}

/** 依 Host 標頭找刊物；用於 proxy 將品牌網域改寫到 /[pub] 路由，讓兩種部署模式共用同一組頁面。 */
export function publicationForHost(host: string | null): Publication | undefined {
  if (!host) return undefined;
  const bare = host.split(":")[0]!.toLowerCase();
  return Object.values(publications).find(
    (p) => bare === p.domain || bare === `www.${p.domain}` || bare === `${p.slug}.localhost`,
  );
}
