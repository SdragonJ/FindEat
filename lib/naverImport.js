/**
 * 네이버 지역 검색 → MariaDB `restaurants` 적재 로직.
 * `server.js`(버튼 API)와 `scripts/naver-local-import.mjs`(CLI)에서 같이 씁니다.
 *
 * `source` 컬럼: `user` = 직접 등록, `naver` = 이 모듈로 넣은 데이터(최신화 시 이쪽만 지웠다가 다시 넣음).
 */

const NAVER_LOCAL_URL = "https://openapi.naver.com/v1/search/local.json";

/** 직접 등록한 맛집 — 최신화(네이버 재수입) 시 삭제되지 않습니다. */
const SOURCE_USER = "user";
/** 네이버 지역 검색으로 넣은 맛집 — 최신화 시 삭제 후 다시 채웁니다. */
const SOURCE_NAVER = "naver";

/**
 * `.env` 의 NAVER_IMPORT_QUERIES 를 쉼표로 잘라 배열로 만듭니다. 비어 있으면 [].
 */
function parseQueriesFromEnv() {
  const raw = process.env.NAVER_IMPORT_QUERIES?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 네이버 지역 검색 한 페이지를 받아옵니다. 환경변수에 ID/Secret 이 있어야 합니다.
 */
async function fetchLocalPage(opts) {
  const id = process.env.NAVER_CLIENT_ID?.trim();
  const secret = process.env.NAVER_CLIENT_SECRET?.trim();
  if (!id || !secret) {
    throw new Error("NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 이 필요합니다.");
  }
  const display = Math.min(5, Math.max(1, opts.display ?? 5));
  const start = Math.min(1000, Math.max(1, opts.start ?? 1));
  const u = new URL(NAVER_LOCAL_URL);
  u.searchParams.set("query", opts.query);
  u.searchParams.set("display", String(display));
  u.searchParams.set("start", String(start));
  u.searchParams.set("sort", "random");

  const res = await fetch(u, {
    headers: {
      "X-Naver-Client-Id": id,
      "X-Naver-Client-Secret": secret,
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`네이버 API 응답이 JSON이 아닙니다. HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const err = data?.errorMessage || data?.message || text.slice(0, 200);
    throw new Error(`네이버 지역 검색 실패 HTTP ${res.status}: ${err}`);
  }
  return data;
}

function stripHtmlTitle(s) {
  return String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/** 화면 콤보와 동일. 네이버 첫 세그먼트가 목록에 없으면 `기타`로 넣습니다. (`server.js` 와 맞출 것) */
const FOOD_CATEGORIES = [
  "한식",
  "양식",
  "아시아음식",
  "일식",
  "중식",
  "분식",
  "카페",
  "뷔페",
  "기타",
];
const FOOD_CATEGORY_SET = new Set(FOOD_CATEGORIES);

function toCategoryField(raw) {
  const first = String(raw ?? "").split(">")[0].trim() || "기타";
  if (FOOD_CATEGORY_SET.has(first)) return first;
  return "기타";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 한 검색어에 대해 페이지를 넘기며 INSERT 합니다. `source` 는 항상 `naver`.
 * @param {import('mysql2/promise').Pool} pool
 */
async function importAllPagesForQuery(pool, query) {
  const display = 5;
  let start = 1;
  let total = 0;
  let inserted = 0;
  let skipped = 0;

  for (;;) {
    const data = await fetchLocalPage({ query, display, start });
    total = Number(data.total) || 0;
    const items = Array.isArray(data.items) ? data.items : [];

    for (const item of items) {
      const name = stripHtmlTitle(item.title).slice(0, 120);
      const road = (item.roadAddress || "").trim();
      const jibun = (item.address || "").trim();
      const address = (road || jibun).slice(0, 255);
      if (!name || !address) {
        skipped += 1;
        continue;
      }
      const category = toCategoryField(item.category);
      const memoParts = [
        item.description ? String(item.description).trim() : "",
        item.link ? `link:${String(item.link).trim()}` : "",
        item.mapx != null && item.mapy != null ? `map:${item.mapx},${item.mapy}` : "",
      ].filter(Boolean);
      const memo = memoParts.join(" | ").slice(0, 500);

      const [dup] = await pool.query(
        "SELECT id FROM restaurants WHERE name = ? AND address = ? LIMIT 1",
        [name, address],
      );
      if (dup.length) {
        skipped += 1;
        continue;
      }
      await pool.query(
        "INSERT INTO restaurants (name, category, address, walk_minutes, memo, source, rating, is_matjip) VALUES (?,?,?,?,?,?,?,?)",
        [name, category, address, null, memo || null, SOURCE_NAVER, null, 0],
      );
      inserted += 1;
    }

    if (items.length === 0) break;
    start += display;
    if (start > total || start > 1000) break;
    await sleep(200);
  }

  return { query, total, inserted, skipped };
}

/**
 * 여러 검색어를 순서대로 수입합니다.
 * @param {import('mysql2/promise').Pool} pool
 * @param {string[]} queries
 */
async function runNaverImportForQueries(pool, queries) {
  const summary = [];
  for (const q of queries) {
    summary.push(await importAllPagesForQuery(pool, q));
    await sleep(300);
  }
  return summary;
}

module.exports = {
  NAVER_LOCAL_URL,
  SOURCE_USER,
  SOURCE_NAVER,
  parseQueriesFromEnv,
  fetchLocalPage,
  runNaverImportForQueries,
};
