import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

// 使用 Node 內建的 node:sqlite 而非 better-sqlite3：不需要原生編譯，
// 在 CI、Vercel 建置環境與新版 Node 上都不會因為缺少 prebuilt binary 而失敗。

export const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "news.db");

// 用 globalThis 保存連線：開發模式熱重載會重新執行模組，否則每次存檔都多開一個連線
const globalForDb = globalThis as unknown as { __newsDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!globalForDb.__newsDb) {
    // turbopackIgnore：路徑來自環境變數，靜態分析無法確定範圍會把整個專案打包進函式；
    // 資料庫檔已在 next.config 的 outputFileTracingIncludes 明確列入，這裡不需要自動追蹤
    if (!fs.existsSync(/*turbopackIgnore: true*/ DB_PATH)) {
      throw new Error(`找不到資料庫 ${DB_PATH}，請先執行 npm run seed`);
    }
    // 網站端只讀：寫入只發生在 seed / 匯入流程，唯讀可避免頁面程式碼意外改到資料
    globalForDb.__newsDb = new DatabaseSync(/*turbopackIgnore: true*/ DB_PATH, { readOnly: true });
  }
  return globalForDb.__newsDb;
}
