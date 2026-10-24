// 產生虛構的示範資料。所有公司、人物、刊物名稱皆為虛構。
//
// 使用固定種子的亂數產生器：每次執行產出相同內容（只有日期以「今天」為錨點），
// 這樣建置結果可重現，測試與截圖也不會因為資料變動而飄移。

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { schemaSql } from "../src/lib/schema";
import { slugify } from "../src/lib/urls";
import { publicationSlugs, publications, type PublicationSlug } from "../src/lib/publications";

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "news.db");

if (process.argv.includes("--if-missing") && fs.existsSync(DB_PATH)) {
  // prebuild 會呼叫這個模式：已有資料庫就不重建，避免每次 build 都改掉日期造成不必要的差異
  console.log(`資料庫已存在，略過 seed：${DB_PATH}`);
  process.exit(0);
}

// ---------- 確定性亂數 ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261024);
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;

// ---------- 日期工具 ----------
const TODAY = process.env.SEED_TODAY ?? new Date().toISOString().slice(0, 10);
const day = (offset: number) => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const isWeekday = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6;

// ---------- 參考資料 ----------
const industries = [
  { slug: "fintech", name: "Fintech", suffixes: ["Pay", "Capital", "Ledger"], description: "Payments, digital lending and the infrastructure behind modern banking." },
  { slug: "semiconductors", name: "Semiconductors", suffixes: ["Semiconductor", "Microsystems"], description: "Chip design, foundries and the equipment makers that supply them." },
  { slug: "energy-transition", name: "Energy Transition", suffixes: ["Energy", "Renewables"], description: "Grid storage, renewables and the companies decarbonising heavy industry." },
  { slug: "logistics", name: "Logistics", suffixes: ["Logistics", "Freight"], description: "Shipping, warehousing and last-mile delivery networks." },
  { slug: "consumer-retail", name: "Consumer Retail", suffixes: ["Retail Group", "Brands"], description: "Store chains, consumer brands and e-commerce platforms." },
  { slug: "healthcare", name: "Healthcare", suffixes: ["Therapeutics", "Health"], description: "Drug developers, medical devices and care providers." },
  { slug: "media", name: "Media", suffixes: ["Media", "Studios"], description: "Publishing, streaming and advertising technology." },
  { slug: "industrials", name: "Industrials", suffixes: ["Industries", "Dynamics"], description: "Machinery, automation and engineering services." },
  { slug: "software", name: "Enterprise Software", suffixes: ["Software", "Systems"], description: "Cloud platforms and business applications." },
  { slug: "real-estate", name: "Real Estate", suffixes: ["Properties", "Realty"], description: "Commercial property owners, developers and REIT-style vehicles." },
] as const;

const countries = [
  { name: "United States", iso2: "US", region: "Americas" },
  { name: "United Kingdom", iso2: "GB", region: "Europe" },
  { name: "Germany", iso2: "DE", region: "Europe" },
  { name: "Japan", iso2: "JP", region: "Asia-Pacific" },
  { name: "Singapore", iso2: "SG", region: "Asia-Pacific" },
  { name: "Taiwan", iso2: "TW", region: "Asia-Pacific" },
  { name: "India", iso2: "IN", region: "Asia-Pacific" },
  { name: "Brazil", iso2: "BR", region: "Americas" },
] as const;

// 刻意使用罕見或自造的字根，降低與真實公司撞名的機率
const roots = [
  "Aldervane", "Brightmoor", "Cobaltine", "Dunmere", "Elmscroft", "Fennick", "Galewright", "Hollowend",
  "Ironvale", "Jessamy", "Kestrine", "Lumora", "Marrowfield", "Nethercott", "Oakhaven", "Pellucid",
  "Quillon", "Ravensholt", "Saltmarsh", "Thistlewood", "Umberline", "Verdantis", "Wexmoor", "Xanthel",
  "Yarrowby", "Zephyrine", "Ambergate", "Bellweather", "Cindral", "Dovecote", "Emberly", "Foxglade",
  "Granitor", "Heathmere", "Isolde", "Jasperton", "Kelvane", "Lowmarsh", "Mirelock", "Northcairn",
  "Orrisvale", "Pinnacrest", "Quarrystone", "Rookwell", "Sablewick", "Tindrel", "Upwold", "Vesperline",
  "Wintercress", "Yellowdock", "Zircona", "Arbelin", "Brackenford", "Corvane", "Drummlin", "Estervale",
  "Fairwyn", "Glimmerton", "Halcyra", "Ivorleigh",
] as const;

const firstNames = ["Mara", "Tobias", "Ingrid", "Ravi", "Leonie", "Kenji", "Ama", "Felipe", "Sora", "Dmitra", "Owen", "Priya", "Annika", "Tomasz", "Yuna", "Callum", "Noor", "Elio", "Hana", "Baptiste"];
const lastNames = ["Vantreese", "Okonkwo-Hale", "Lindqvist", "Sarangan", "Marchetti", "Takeuchi", "Ferreira-Lowe", "Brannagh", "Iwasaki", "Kovalenko", "Pemberton", "Achterberg", "Moraleda", "Sundaram", "Halloran", "Deverell", "Nakashima", "Rosenquist", "Thorncliffe", "Quaresma"];
const authors = ["Elena Marwick", "Jun Okabe", "Sasha Pellerin", "Daniel Ferro", "Aiko Brandt", "Martin Oyelaran"];
const execTitles = ["Chief Executive Officer", "Chief Financial Officer", "Chief Operating Officer", "Chief Technology Officer", "Chair"];

// ---------- 建立資料庫 ----------
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(DB_PATH + suffix, { force: true });
const db = new DatabaseSync(DB_PATH);
db.exec(schemaSql);
db.exec("BEGIN");

const nowIso = `${TODAY}T06:00:00Z`;

const insIndustry = db.prepare("INSERT INTO industries (id, slug, name, description) VALUES (?, ?, ?, ?)");
industries.forEach((ind, i) => insIndustry.run(i + 1, ind.slug, ind.name, ind.description));

const insCountry = db.prepare("INSERT INTO countries (id, slug, name, iso2, region) VALUES (?, ?, ?, ?, ?)");
countries.forEach((c, i) => insCountry.run(i + 1, slugify(c.name), c.name, c.iso2, c.region));

interface Company { id: number; name: string; short: string; ticker: string | null; industry: number; country: number }
const companies: Company[] = [];
const insCompany = db.prepare(
  `INSERT INTO companies (id, slug, name, short_name, ticker, industry_id, country_id, founded, employees, description, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const usedTickers = new Set<string>();
roots.forEach((root, i) => {
  const industryIdx = i % industries.length;
  const industry = industries[industryIdx]!;
  const countryIdx = int(0, countries.length - 1);
  const name = `${root} ${pick(industry.suffixes)}`;
  // 每 6 家設一家未上市，讓「沒有股價」的分支也被頁面與新鮮度檢查涵蓋到
  let ticker: string | null = null;
  if (i % 6 !== 5) {
    ticker = root.slice(0, 4).toUpperCase();
    if (usedTickers.has(ticker)) ticker = (root.slice(0, 3) + root.at(-1)).toUpperCase();
    usedTickers.add(ticker);
  }
  const id = i + 1;
  const country = countries[countryIdx]!;
  insCompany.run(
    id, slugify(name), name, root, ticker, industryIdx + 1, countryIdx + 1,
    int(1952, 2019), int(80, 48_000),
    `${name} is a ${country.name}-based ${industry.name.toLowerCase()} company. ${industry.description}`,
    nowIso,
  );
  companies.push({ id, name, short: root, ticker, industry: industryIdx + 1, country: countryIdx + 1 });
});

interface Exec { id: number; name: string; title: string; company: number }
const execs: Exec[] = [];
const insExec = db.prepare("INSERT INTO executives (id, slug, name, title, company_id, bio, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
const usedNames = new Set<string>();
for (let i = 0; i < 40; i++) {
  // 前 30 家公司各一位 CEO，其餘 10 位分配為前 10 家的其他高管，模擬「一家公司多位高管」
  const company = companies[i < 30 ? i : i - 30]!;
  const title = i < 30 ? execTitles[0]! : execTitles[1 + (i % 4)]!;
  let name: string;
  do name = `${pick(firstNames)} ${pick(lastNames)}`; while (usedNames.has(name));
  usedNames.add(name);
  const id = i + 1;
  insExec.run(id, slugify(name), name, title, company.id,
    `${name} is ${title} of ${company.name}, having joined in ${int(2008, 2023)} after senior roles in ${industries[company.industry - 1]!.name.toLowerCase()}.`,
    nowIso);
  execs.push({ id, name, title, company: company.id });
}

// ---------- 股價 ----------
const insPrice = db.prepare("INSERT INTO prices (company_id, date, close, volume) VALUES (?, ?, ?, ?)");
const listed = companies.filter((c) => c.ticker);
// 其中幾家模擬資料源中斷：最後一筆價格停在數個營業日之前，用來展示新鮮度監控
const staleIds = new Set(listed.filter((_, i) => i % 9 === 4).map((c) => c.id));
for (const c of listed) {
  const stopOffset = staleIds.has(c.id) ? -int(5, 14) : 0;
  let price = int(18, 320) + rand();
  const drift = (rand() - 0.45) * 0.004;
  for (let off = -182; off <= stopOffset; off++) {
    const d = day(off);
    if (!isWeekday(d)) continue;
    price = Math.max(1, price * (1 + drift + (rand() - 0.5) * 0.04));
    insPrice.run(c.id, iso(d), Math.round(price * 100) / 100, int(80_000, 4_000_000));
  }
}

// ---------- 文章 ----------
const insArticle = db.prepare(
  "INSERT INTO articles (id, slug, publication, title, dek, body, author, published_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
);
const insLink = db.prepare("INSERT OR IGNORE INTO article_entities (article_id, entity_type, entity_id, is_primary) VALUES (?, ?, ?, ?)");
const insSynd = db.prepare("INSERT INTO article_syndications (article_id, publication) VALUES (?, ?)");

type Ctx = { c: Company; c2: Company; e: Exec | undefined; ind: string; indLower: string; country: string };
const templates: { title: (x: Ctx) => string; dek: (x: Ctx) => string; body: (x: Ctx) => string[] }[] = [
  {
    title: (x) => `${x.c.name} beats estimates as ${x.indLower} demand holds up`,
    dek: (x) => `The ${x.country}-based group raised its full-year outlook while rivals trimmed theirs.`,
    body: (x) => [
      `${x.c.name} reported quarterly revenue of $${int(2, 19)}.${int(0, 9)} billion, ahead of analyst expectations, as customers across ${x.indLower} kept spending despite tighter credit conditions.`,
      x.e ? `${x.e.name}, ${x.c.short}'s ${x.e.title.toLowerCase()}, told investors that order books in ${x.country} were the strongest in three years and that pricing had held firm.` : `Management told investors that order books in ${x.country} were the strongest in three years and that pricing had held firm.`,
      `${x.c.short} shares moved ${int(2, 9)}.${int(0, 9)}% in early trading. ${x.c2.name} has struggled to match that pace, and analysts expect ${x.c2.short} to face questions about margins when it reports next month.`,
      `The results reinforce ${x.c.short}'s position in ${x.ind}, where scale increasingly decides who can absorb higher input costs.`,
    ],
  },
  {
    title: (x) => `${x.c.name} bets on ${x.country} with a new regional hub`,
    dek: (x) => `The expansion puts ${x.c.short} in direct competition with ${x.c2.short} for local talent and customers.`,
    body: (x) => [
      `${x.c.name} will open a regional headquarters in ${x.country}, committing roughly $${int(80, 900)} million over five years and adding ${int(150, 1200)} jobs.`,
      x.e ? `"We have been underweight in ${x.country} for too long," said ${x.e.name}, who has made international growth a priority since taking the role.` : `Executives said the company had been underweight in ${x.country} for too long.`,
      `The move brings ${x.c.short} onto the home turf of ${x.c2.name}, which has spent a decade building relationships with ${x.indLower} buyers in the region.`,
      `Analysts said the bet would weigh on ${x.c.short}'s margins for at least two years before contributing meaningfully to earnings.`,
    ],
  },
  {
    title: (x) => (x.e ? `${x.e.name} sets out a faster growth plan at ${x.c.short}` : `${x.c.name} board pushes for faster growth`),
    dek: (x) => `Investors want evidence that ${x.c.short} can outpace a crowded ${x.indLower} field.`,
    body: (x) => [
      x.e ? `${x.e.name} used ${x.c.name}'s investor day to outline a plan to double recurring revenue by the end of the decade.` : `${x.c.name} used its investor day to outline a plan to double recurring revenue by the end of the decade.`,
      `The strategy leans heavily on acquisitions in ${x.country} and on cutting overlapping functions, which the company estimates will save $${int(40, 300)} million a year.`,
      `Peers such as ${x.c2.name} have pursued similar plans with mixed results, and several shareholders questioned whether ${x.c.short} had the balance sheet to follow through.`,
      `Still, the reaction from ${x.ind} analysts was broadly positive, with two brokers lifting their price targets after the presentation.`,
    ],
  },
  {
    title: (x) => `${x.c.short} and ${x.c2.short} square off over ${x.indLower} customers`,
    dek: (x) => `A price war in ${x.country} is testing both companies' discipline.`,
    body: (x) => [
      `${x.c.name} and ${x.c2.name} have each cut list prices by double digits this quarter as they compete for a shrinking pool of large ${x.indLower} contracts.`,
      `Industry consultants say the rivalry is most intense in ${x.country}, where a handful of buyers account for most of the market.`,
      x.e ? `${x.e.name} insisted that ${x.c.short} would "not chase unprofitable volume", but conceded the company had lost two significant tenders to ${x.c2.short}.` : `${x.c.short} insisted it would not chase unprofitable volume, but conceded it had lost two significant tenders to ${x.c2.short}.`,
      `Whichever company blinks first could reshape ${x.ind} pricing for years.`,
    ],
  },
  {
    title: (x) => `What a slowdown in ${x.indLower} means for ${x.c.name}`,
    dek: (x) => `Leading indicators in ${x.country} have turned, and ${x.c.short} is more exposed than most.`,
    body: (x) => [
      `New orders across ${x.ind} fell for a third consecutive month, according to industry surveys, raising questions about how long the sector's recent strength can last.`,
      `${x.c.name} generates roughly ${int(30, 70)}% of its revenue in ${x.country}, making it one of the most exposed listed names if the slowdown deepens.`,
      `By contrast, ${x.c2.name} has diversified into adjacent markets, which may cushion the blow.`,
      `${x.c.short} has so far declined to change its guidance, but analysts expect a more cautious tone at the next update.`,
    ],
  },
  {
    title: (x) => `${x.c.name} agrees to take a minority stake in ${x.c2.short}`,
    dek: (x) => `The deal gives ${x.c.short} a foothold in a fast-growing corner of ${x.indLower}.`,
    body: (x) => [
      `${x.c.name} will buy a ${int(9, 24)}% stake in ${x.c2.name} for an undisclosed sum, according to people familiar with the agreement.`,
      `The two companies said they would cooperate on research and on customer contracts in ${x.country}, where ${x.c2.short} has a strong presence.`,
      x.e ? `${x.e.name} described the stake as "an option on the next phase of ${x.ind}" rather than a prelude to a full takeover.` : `Executives described the stake as an option on the next phase of ${x.ind} rather than a prelude to a full takeover.`,
      `Competition regulators are not expected to review the transaction given its size.`,
    ],
  },
];

const usedSlugs = new Set<string>();
for (let id = 1; id <= 150; id++) {
  const c = pick(companies);
  // 競爭對手優先挑同產業公司，讓「共同提及」關聯圖反映真實的產業結構
  const peers = companies.filter((p) => p.industry === c.industry && p.id !== c.id);
  const c2 = rand() < 0.8 && peers.length ? pick(peers) : pick(companies.filter((p) => p.id !== c.id));
  const companyExecs = execs.filter((e) => e.company === c.id);
  const e = companyExecs.length ? pick(companyExecs) : undefined;
  const industry = industries[c.industry - 1]!;
  const countryId = rand() < 0.7 ? c.country : int(1, countries.length);
  const country = countries[countryId - 1]!;
  const ctx: Ctx = { c, c2, e, ind: industry.name, indLower: industry.name.toLowerCase(), country: country.name };
  const tpl = pick(templates);

  // 刊物歸屬依編輯定位：產業屬於該刊物重點者優先歸給它
  const focused = publicationSlugs.filter((p) => (publications[p].focusIndustries as string[]).includes(industry.slug));
  const pub: PublicationSlug = focused.length && rand() < 0.75 ? pick(focused) : pick(publicationSlugs);

  const title = tpl.title(ctx);
  let slug = slugify(title);
  if (usedSlugs.has(slug)) slug = `${slug}-${id}`;
  usedSlugs.add(slug);

  // 發布時間分散在過去 120 天，越近期越密集，模擬新聞站的真實時間分佈
  const ageDays = Math.floor(Math.pow(rand(), 1.6) * 120);
  const published = day(-ageDays);
  published.setUTCHours(int(5, 20), int(0, 59));
  // 不可產生未來時間的文章：sitemap 的 lastmod 與 JSON-LD datePublished 若在未來，搜尋引擎會判定為不可信
  if (published.getTime() > Date.now()) published.setTime(Date.now() - 3_600_000);
  const updated = rand() < 0.25 ? new Date(published.getTime() + int(1, 30) * 3_600_000) : published;

  insArticle.run(id, slug, pub, title, tpl.dek(ctx), tpl.body(ctx).join("\n\n"), pick(authors), published.toISOString(), updated.toISOString());
  insLink.run(id, "company", c.id, 1);
  insLink.run(id, "company", c2.id, 0);
  if (e) insLink.run(id, "executive", e.id, 0);
  insLink.run(id, "industry", c.industry, 0);
  insLink.run(id, "country", countryId, 0);

  if (rand() < 0.15) insSynd.run(id, publicationSlugs.find((p) => p !== pub)!);
}

db.exec("INSERT INTO articles_fts(articles_fts) VALUES ('rebuild')");
db.exec("COMMIT");
// 統計資訊讓查詢規劃器在實體關聯查詢上選對索引
db.exec("ANALYZE");
db.close();

console.log(`已產生示範資料：${DB_PATH}（基準日 ${TODAY}，${companies.length} 家公司、${execs.length} 位高管、150 篇文章）`);
