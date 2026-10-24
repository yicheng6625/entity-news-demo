import { NextResponse, type NextRequest } from "next/server";
import { publicationForHost } from "@/lib/publications";

// Host 對應：讓每個品牌可以用自己的網域（或本地的 northwind.localhost:3000）存取，
// 內部仍改寫到同一組 /[pub] 路由。這樣多品牌只是「設定」，不需要為每個品牌部署一份程式。
export function proxy(req: NextRequest) {
  const pub = publicationForHost(req.headers.get("host"));
  if (!pub) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // 已帶前綴的路徑直接放行；重複網址由 canonical 收斂，不做轉址以免多一次往返
  if (pathname === `/${pub.slug}` || pathname.startsWith(`/${pub.slug}/`)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/${pub.slug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // 靜態資源、API、sitemap、robots 不經過改寫：它們是全平台共用的，不屬於任何單一品牌
  matcher: ["/((?!_next/|api/|admin/|sitemap|robots.txt|favicon.ico).*)"],
};
