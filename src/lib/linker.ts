// 實體內部連結注入器：把文章內文中「第一次出現」的已知實體名稱轉成連到實體頁的連結。
//
// 設計取捨：
// 1. 只比對「這篇文章已標註的實體」，而不是全庫實體：全庫比對在百萬級實體時又慢又容易誤連（同名公司、常見字）。
// 2. 回傳 segment 陣列而非 HTML 字串：交給 React 渲染可避免 XSS，也不用再做 HTML 跳脫。
// 3. 只連第一次出現：SEO 與可讀性都不希望同一連結重複十次（Google 也只計第一個錨點文字）。
// 4. 長名稱優先：避免 "Kestrel" 先吃掉 "Kestrel Biosystems" 的前半段。

export interface LinkableEntity {
  /** 唯一鍵，例如 "company:12"；同一實體的多個別名共用同一鍵 */
  key: string;
  href: string;
  /** 正式名稱 + 別名（如短名、股票代號） */
  names: string[];
}

export type Segment = { type: "text"; text: string } | { type: "link"; text: string; href: string; key: string };

export interface LinkerOptions {
  /** 整篇文章最多插入的連結數，避免過度最佳化（over-optimization）被視為垃圾連結 */
  maxLinks?: number;
  /** 不連結的實體（例如目前所在頁面本身的實體，自我連結沒有意義） */
  excludeKeys?: Iterable<string>;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 對多個段落套用連結注入。段落之間共享「已連結」狀態，確保第一次出現是以整篇文章為範圍。
 */
export function linkEntities(paragraphs: string[], entities: LinkableEntity[], options: LinkerOptions = {}): Segment[][] {
  const maxLinks = options.maxLinks ?? 8;
  const linked = new Set<string>(options.excludeKeys ?? []);
  let linkCount = 0;

  const byName = new Map<string, LinkableEntity>();
  for (const entity of entities) {
    for (const name of entity.names) {
      const trimmed = name.trim();
      // 太短的別名（如 2 個字母的代號）誤判率高，直接略過
      if (trimmed.length < 3) continue;
      if (!byName.has(trimmed)) byName.set(trimmed, entity);
    }
  }
  if (byName.size === 0) return paragraphs.map((text) => [{ type: "text", text }]);

  const alternation = [...byName.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  // 用 Unicode 字母/數字當邊界，而非 \b：\b 對非 ASCII 字元（如 é）判斷錯誤。
  // 名稱比對區分大小寫：專有名詞本來就有大小寫，忽略大小寫會把一般單字誤連成公司。
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternation})(?![\\p{L}\\p{N}])`, "gu");

  return paragraphs.map((text) => {
    const segments: Segment[] = [];
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      const entity = byName.get(match[0]);
      if (!entity || linked.has(entity.key) || linkCount >= maxLinks) continue;
      const start = match.index;
      if (start > cursor) segments.push({ type: "text", text: text.slice(cursor, start) });
      segments.push({ type: "link", text: match[0], href: entity.href, key: entity.key });
      cursor = start + match[0].length;
      linked.add(entity.key);
      linkCount++;
    }
    if (cursor < text.length) segments.push({ type: "text", text: text.slice(cursor) });
    return segments;
  });
}
