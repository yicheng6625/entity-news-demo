// 將使用者輸入轉成安全的 SQLite FTS5 查詢。
// 直接把輸入丟進 MATCH 會因為引號、冒號、NEAR、AND 等語法字元而丟錯（甚至被用來做昂貴查詢），
// 因此只保留字詞，並把每個字詞包成帶前綴比對的片語。

export function toFtsQuery(input: string, maxTerms = 8): string | null {
  const terms = input
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, maxTerms);
  if (terms.length === 0) return null;
  // "term"* 表示前綴比對（輸入 "semi" 能找到 "semiconductors"），多個字詞預設為 AND
  return terms.map((t) => `"${t.replace(/"/g, "")}"*`).join(" ");
}
