// 資料新鮮度檢查 CLI：列出股價資料過期的公司。
// 有過期資料時以非零結束碼退出，方便直接掛在 cron / CI 上當作告警來源。

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { businessDaysBetween, isStale, todayUtc } from "../src/lib/freshness";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "news.db");
const db = new DatabaseSync(dbPath, { readOnly: true });
const today = todayUtc();

const rows = db
  .prepare(
    `SELECT c.name, c.ticker, (SELECT max(date) FROM prices p WHERE p.company_id = c.id) AS last_date
     FROM companies c WHERE c.ticker IS NOT NULL ORDER BY last_date, c.name`,
  )
  .all() as unknown as { name: string; ticker: string; last_date: string | null }[];

const stale = rows.filter((r) => isStale(r.last_date, today));

console.log(`新鮮度檢查（${today} UTC）：${rows.length} 家上市公司，${stale.length} 家過期\n`);
if (stale.length) {
  console.table(
    stale.map((r) => ({
      ticker: r.ticker,
      company: r.name,
      lastClose: r.last_date ?? "none",
      lagBusinessDays: r.last_date ? businessDaysBetween(r.last_date, today) : "n/a",
    })),
  );
  process.exitCode = 1;
}
