// 資料庫結構。刻意寫成可移植到 PostgreSQL 的 SQL（除了 FTS5 虛擬表），
// 因為 demo 用 SQLite 只是為了零依賴啟動，正式環境的讀寫應在 Postgres + 讀取副本上。

export const schemaSql = /* sql */ `
PRAGMA foreign_keys = ON;

CREATE TABLE industries (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE countries (
  id     INTEGER PRIMARY KEY,
  slug   TEXT NOT NULL UNIQUE,
  name   TEXT NOT NULL,
  iso2   TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL
);

CREATE TABLE companies (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  short_name  TEXT NOT NULL,
  ticker      TEXT UNIQUE,            -- NULL 代表未上市公司，不需要股價也不列入新鮮度檢查
  industry_id INTEGER NOT NULL REFERENCES industries(id),
  country_id  INTEGER NOT NULL REFERENCES countries(id),
  founded     INTEGER NOT NULL,
  employees   INTEGER NOT NULL,
  description TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_companies_industry ON companies(industry_id);
CREATE INDEX idx_companies_country  ON companies(country_id);

CREATE TABLE executives (
  id         INTEGER PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  title      TEXT NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  bio        TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_executives_company ON executives(company_id);

CREATE TABLE articles (
  id           INTEGER PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  publication  TEXT NOT NULL,          -- 原始刊登刊物：決定 canonical 歸屬
  title        TEXT NOT NULL,
  dek          TEXT NOT NULL,
  body         TEXT NOT NULL,          -- 純文字段落以空行分隔；連結於渲染時注入，資料層不存 HTML
  author       TEXT NOT NULL,
  published_at TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_articles_pub_date ON articles(publication, published_at DESC);
CREATE INDEX idx_articles_date     ON articles(published_at DESC);

-- 轉載：同一篇文章出現在其他刊物，但 canonical 仍指回原刊物，避免重複內容稀釋排名
CREATE TABLE article_syndications (
  article_id  INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  publication TEXT NOT NULL,
  PRIMARY KEY (article_id, publication)
);
CREATE INDEX idx_syndications_pub ON article_syndications(publication, article_id);

-- 文章與實體的多對多關聯，是整個實體化發布的核心表
CREATE TABLE article_entities (
  article_id  INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company','executive','industry','country')),
  entity_id   INTEGER NOT NULL,
  is_primary  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, entity_type, entity_id)
);
-- 反向索引：實體頁「相關文章」查詢走這個索引，而不是掃描整張關聯表
CREATE INDEX idx_article_entities_entity ON article_entities(entity_type, entity_id, article_id);

CREATE TABLE prices (
  company_id INTEGER NOT NULL REFERENCES companies(id),
  date       TEXT NOT NULL,
  close      REAL NOT NULL,
  volume     INTEGER NOT NULL,
  PRIMARY KEY (company_id, date)
) WITHOUT ROWID;  -- 時間序列以複合主鍵聚簇儲存，區間查詢可循序讀取

-- 外部內容 FTS5：索引不重複儲存全文，節省空間；由 seed 在寫入後重建
CREATE VIRTUAL TABLE articles_fts USING fts5(
  title, dek, body,
  content='articles', content_rowid='id',
  tokenize='porter unicode61'
);
`;
