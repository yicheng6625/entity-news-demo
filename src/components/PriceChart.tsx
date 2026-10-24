import type { PricePoint } from "@/lib/repo";

// 以內嵌 SVG 繪製股價走勢，而非引入圖表函式庫：
// 一個 90 點的折線圖只需要幾行計算，引入 Chart.js / Recharts 會多出上百 KB 的 JS 並延後 LCP。
// 伺服器端算好 path，瀏覽器零 JS 即可呈現，也能被 ISR 快取。

const W = 640;
const H = 180;
const PAD_Y = 12;

export function buildPath(points: PricePoint[], width = W, height = H): { line: string; area: string; min: number; max: number } {
  const closes = points.map((p) => p.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1; // 價格完全持平時避免除以零
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = closes.map((c, i) => [i * step, PAD_Y + (1 - (c - min) / span) * (height - PAD_Y * 2)] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return { line, area, min, max };
}

export function PriceChart({ ticker, points, stale }: { ticker: string; points: PricePoint[]; stale: boolean }) {
  if (points.length < 2) return <p className="muted">Price data unavailable.</p>;
  const first = points[0]!;
  const last = points.at(-1)!;
  const change = ((last.close - first.close) / first.close) * 100;
  const up = change >= 0;
  const { line, area, min, max } = buildPath(points);
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <figure className="price-card">
      <div className="price-head">
        <div>
          <span className="ticker">{ticker}</span>
          <span className="price">{fmt(last.close)}</span>
          <span className={up ? "delta up" : "delta down"}>
            {up ? "▲" : "▼"} {Math.abs(change).toFixed(2)}% <span className="muted">· {points.length} sessions</span>
          </span>
        </div>
        {/* 過期資料要明確告知讀者，而非默默顯示舊價格：財經內容的可信度比版面整潔重要 */}
        <span className={stale ? "fresh stale" : "fresh"}>{stale ? `Delayed · last close ${last.date}` : `Close ${last.date}`}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${ticker} closing price, ${first.date} to ${last.date}: ${fmt(first.close)} to ${fmt(last.close)}`} preserveAspectRatio="none" className="chart">
        <defs>
          <linearGradient id={`g-${ticker}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#g-${ticker})`} />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="price-range muted">
        <span>{first.date}</span>
        <span>Range {fmt(min)} – {fmt(max)}</span>
        <span>{last.date}</span>
      </figcaption>
    </figure>
  );
}
