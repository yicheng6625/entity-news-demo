// REST API 共用工具：分頁解析與快取標頭。
// 集中在一處是為了讓所有端點的分頁上限與快取策略一致，避免某個端點被拿來一次拉出全庫資料。

export interface Pagination {
  page: number;
  pageSize: number;
  offset: number;
}

export const MAX_PAGE_SIZE = 50;

/** 解析 ?page=&pageSize=；非法輸入回到預設值而非報錯，因為爬蟲與舊連結常帶著奇怪參數 */
export function parsePagination(params: URLSearchParams, defaultSize = 20): Pagination {
  const toInt = (v: string | null, fallback: number) => {
    const n = Number.parseInt(v ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const page = Math.min(toInt(params.get("page"), 1), 10_000);
  const pageSize = Math.min(toInt(params.get("pageSize"), defaultSize), MAX_PAGE_SIZE);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function pageMeta(p: Pagination, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / p.pageSize));
  return { page: p.page, pageSize: p.pageSize, total, totalPages, hasNext: p.page < totalPages };
}

/**
 * CDN 快取標頭。
 * s-maxage 讓 CDN 快取、max-age 較短讓瀏覽器較常回源；stale-while-revalidate 讓 CDN 在背景更新時
 * 仍回傳舊資料，流量高峰時源站只會收到少量回源請求，而不是每個使用者都打到資料庫。
 */
export function cacheHeaders(sMaxAge: number, swr = sMaxAge * 10): HeadersInit {
  return {
    "Cache-Control": `public, max-age=60, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
  };
}
