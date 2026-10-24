import Link from "next/link";
import type { CSSProperties } from "react";
import { publicationSlugs, publications } from "@/lib/publications";
import { resolvePub } from "@/lib/route-helpers";
import { publicationPath } from "@/lib/urls";

// 注意：不在 layout 設 dynamicParams = false，因為它會套用到整個子樹，讓未預建的文章（長尾 ISR）全部變成 404。
// 未知刊物前綴改由 resolvePub() 在請求時回 404。
export function generateStaticParams() {
  return publicationSlugs.map((pub) => ({ pub }));
}

export default async function PublicationLayout({ children, params }: { children: React.ReactNode; params: Promise<{ pub: string }> }) {
  const pub = await resolvePub(params);
  // 品牌主題以 CSS 變數注入：同一套 CSS、同一組元件，只換變數就換品牌，不會產生兩份樣式表
  const theme = {
    "--accent": pub.theme.accent,
    "--accent-soft": pub.theme.accentSoft,
    "--ink": pub.theme.ink,
    "--paper": pub.theme.paper,
    "--heading-font": pub.theme.headingFont,
  } as CSSProperties;

  return (
    <div className="brand" style={theme} data-pub={pub.slug}>
      <header className="masthead">
        <div className="wrap masthead-inner">
          <Link href={publicationPath(pub.slug)} className="logo">
            {pub.name}
          </Link>
          <p className="tagline">{pub.tagline}</p>
        </div>
        <nav className="wrap nav" aria-label="Sections">
          {pub.nav.map((item) => (
            <Link key={item.label} href={publicationPath(pub.slug, item.href)}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="wrap main">{children}</main>
      <footer className="footer">
        <div className="wrap footer-inner">
          <span>
            © {pub.name}. Fictional publication for demonstration. All companies and people are invented.
          </span>
          <span className="footer-links">
            {publicationSlugs
              .filter((s) => s !== pub.slug)
              .map((s) => (
                <Link key={s} href={publicationPath(s)}>
                  {publications[s].name}
                </Link>
              ))}
          </span>
        </div>
      </footer>
    </div>
  );
}
