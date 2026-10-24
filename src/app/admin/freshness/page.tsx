import Link from "next/link";
import type { Metadata } from "next";
import { lastPriceDates } from "@/lib/repo";
import { STALE_AFTER_BUSINESS_DAYS, businessDaysBetween, isStale, todayUtc } from "@/lib/freshness";
import { entityPath } from "@/lib/urls";

// 監控頁必須每次即時查詢；若被 ISR 快取，看到的會是「過期的過期報告」
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Data freshness · Admin",
  robots: { index: false, follow: false },
};

export default function FreshnessPage() {
  const today = todayUtc();
  const rows = lastPriceDates().map((r) => ({
    ...r,
    lag: r.last_date ? businessDaysBetween(r.last_date, today) : null,
    stale: isStale(r.last_date, today),
  }));
  const stale = rows.filter((r) => r.stale);

  return (
    <main className="wrap main admin">
      <p className="kicker">Platform admin</p>
      <h1>Price data freshness</h1>
      <p className="muted">
        As of {today} (UTC). A listed company is stale when its last close is more than {STALE_AFTER_BUSINESS_DAYS} business
        days old. {stale.length} of {rows.length} listed companies are stale. CLI equivalent: <code>npm run freshness</code>.
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Company</th>
              <th scope="col">Ticker</th>
              <th scope="col">Last close</th>
              <th scope="col">Lag (business days)</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.stale ? "row-stale" : undefined}>
                <td><Link href={entityPath("northwind", "company", r.slug)}>{r.name}</Link></td>
                <td>{r.ticker}</td>
                <td>{r.last_date ?? "—"}</td>
                <td>{r.lag ?? "—"}</td>
                <td>{r.stale ? <span className="fresh stale">Stale</span> : <span className="fresh">OK</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
