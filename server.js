/**
 * FindEat_CURSOR — 백엔드 서버 (Node.js + Express + mysql2 / MariaDB)
 *
 * [학습 포인트]
 * - Express: URL·HTTP 메서드에 맞는 핸들러를 등록하고 JSON·정적 파일을 응답하는 웹 프레임워크입니다.
 * - REST 느낌: GET(조회), POST(생성), PUT(수정), DELETE(삭제) — `/api/restaurants` 아래로 모읍니다.
 * - mysql2 `createPool`: 연결을 여러 개 풀에 두고 재사용합니다.
 * - dotenv: `.env`의 비밀값을 `process.env`로 읽어 코드에 비밀번호를 박아 넣지 않습니다.
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const { parseQueriesFromEnv, runNaverImportForQueries } = require("./lib/naverImport.js");

/** 화면·API에서 허용하는 음식 종류(프론트 `FOOD_CATEGORIES` 와 동일해야 함). */
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

/**
 * 요청의 `category` 문자열이 허용 목록에 있으면 그대로, 아니면 400.
 * 비어 있으면 `기타`.
 */
function parseFoodCategoryOr400(category, res) {
  const t = category != null && String(category).trim() ? String(category).trim() : "기타";
  if (!FOOD_CATEGORIES.includes(t)) {
    res.status(400).json({ error: "음식 종류가 올바르지 않습니다." });
    return null;
  }
  return t;
}

/**
 * 별점: 비우면 NULL, 1~5만 허용. 잘못된 값이면 400 후 `undefined`.
 */
function parseRatingOptional(rating, res) {
  if (rating == null || String(rating).trim() === "") return null;
  const n = parseInt(String(rating).trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 5) {
    res.status(400).json({ error: "별점은 1~5 사이 숫자이거나 비워야 합니다." });
    return undefined;
  }
  return n;
}

/** 요청 본문·쿼리에서 맛집 여부(0/1). */
function parseIsMatjipBody(val) {
  if (val === true || val === 1 || val === "1") return 1;
  return 0;
}

function queryMatjipOnly(raw) {
  if (raw == null || String(raw).trim() === "") return false;
  const s = String(raw).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || raw === true || raw === 1;
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// 다른 출처(포트가 다른 프론트 등)에서 API를 부를 때 브라우저가 막지 않도록 CORS 허용
app.use(cors());

// JSON 본문을 파싱해 req.body에 넣음 (POST/PUT)
app.use(express.json());

// public/index.html, app.js, style.css 등 정적 파일 제공
app.use(express.static("public"));

/** SQL 연결 풀: 프로세스가 살아 있는 동안 한 번 만들고 재사용합니다. */
let pool;

/**
 * mysql2 `createPool`에 넘길 연결 설정 객체를 만듭니다.
 *
 * [문법] `process.env.DB_PORT?.trim()` — `?.`는 앞 값이 null/undefined면 뒤를 실행하지 않고 undefined를 반환합니다(optional chaining).
 */
function getDbConfig() {
  const portRaw = process.env.DB_PORT?.trim();
  const port = portRaw !== undefined && portRaw !== "" ? Number(portRaw) : 3306;

  return {
    host: process.env.DB_SERVER || process.env.DB_HOST || "127.0.0.1",
    port: Number.isNaN(port) || port <= 0 ? 3306 : port,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME || "terp_db",
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
  };
}

/**
 * 전역 `pool`이 없으면 생성합니다. 첫 쿼리 시점에 DB와 맺어집니다.
 * 장기 실행 Node 프로세스에서는 연결 풀을 재사용하는 편이 일반적입니다.
 */
async function getPool() {
  if (!pool) {
    pool = mysql.createPool(getDbConfig());
  }
  return pool;
}

/**
 * UI의 거리 필터(100m/300m/600m)를 DB 조건에 쓸 “도보 최대 분” 숫자로 바꿉니다.
 */
function maxWalkMinutesForWithinMeters(withinMeters) {
  const n = parseInt(String(withinMeters ?? ""), 10);
  if (n === 100) return 2;
  if (n === 300) return 5;
  if (n === 600) return 10;
  return null;
}

/**
 * GET /api/health — 서버 살아 있음 + DB `SELECT 1` 성공 여부를 JSON으로 반환합니다.
 * 모니터링·배포 환경에서 자주 호출하는 패턴입니다.
 */
app.get("/api/health", async (_req, res) => {
  try {
    const p = await getPool();
    await p.query("SELECT 1 AS ok");
    res.json({ ok: true, db: true });
  } catch (e) {
    res.status(503).json({ ok: false, db: false, error: String(e.message) });
  }
});

/**
 * GET /api/restaurants — 맛집 목록(페이지). 쿼리: `category`, `within_meters`, `min_rating`, `matjip_only`, `page`, `limit`.
 * 응답: `{ items, total, page, pageSize, totalPages }`. 정렬은 `user_touched_at`·`category`·`name` 규칙 동일.
 */
app.get("/api/restaurants", async (req, res) => {
  const category = req.query.category;
  const maxWalk = maxWalkMinutesForWithinMeters(req.query.within_meters);
  const minRatingRaw = req.query.min_rating;
  let minRating = null;
  if (minRatingRaw != null && String(minRatingRaw).trim() !== "") {
    minRating = parseInt(String(minRatingRaw).trim(), 10);
    if (!Number.isFinite(minRating) || minRating < 1 || minRating > 5) {
      return res.status(400).json({ error: "별점 조건은 1~5 사이 숫자이거나 비워야 합니다." });
    }
  }
  const matjipOnly = queryMatjipOnly(req.query.matjip_only);
  let page = parseInt(String(req.query.page ?? "1"), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  let limit = parseInt(String(req.query.limit ?? "5"), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 5;
  if (limit > 50) limit = 50;

  const orderList =
    "ORDER BY (user_touched_at IS NULL) ASC, user_touched_at DESC, category, name";

  const conds = [];
  const params = [];
  if (category && String(category).trim()) {
    conds.push("category = ?");
    params.push(String(category).trim());
  }
  if (maxWalk != null) {
    conds.push("(walk_minutes IS NULL OR walk_minutes <= ?)");
    params.push(maxWalk);
  }
  if (minRating != null) {
    conds.push("rating >= ?");
    params.push(minRating);
  }
  if (matjipOnly) {
    conds.push("is_matjip = 1");
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  try {
    const p = await getPool();
    const [countRows] = await p.query(`SELECT COUNT(*) AS cnt FROM restaurants ${where}`, params);
    const total = Number(countRows[0]?.cnt ?? 0);
    if (total === 0) {
      return res.json({ items: [], total: 0, page: 1, pageSize: limit, totalPages: 0 });
    }
    const totalPages = Math.ceil(total / limit);
    if (page > totalPages) page = totalPages;

    const offsetClamped = (page - 1) * limit;
    const listSql = `SELECT id, name, category, address, walk_minutes, memo, rating, is_matjip, source, created_at, user_touched_at
      FROM restaurants ${where} ${orderList} LIMIT ? OFFSET ?`;
    const [recordset] = await p.query(listSql, [...params, limit, offsetClamped]);

    res.json({
      items: recordset,
      total,
      page,
      pageSize: limit,
      totalPages,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB 오류", detail: e.message });
  }
});

/**
 * GET /api/restaurants/categories — 등록된 맛집에서 DISTINCT 카테고리 문자열 배열을 반환합니다.
 * 프론트 셀렉트 옵션 채우기용입니다.
 */
app.get("/api/restaurants/categories", async (_req, res) => {
  try {
    const p = await getPool();
    const [recordset] = await p.query(
      "SELECT DISTINCT category FROM restaurants ORDER BY category",
    );
    res.json(recordset.map((r) => r.category));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB 오류", detail: e.message });
  }
});

/**
 * GET /api/restaurants/pick — 조건에 맞는 행 중 무작위 한 건을 골라 JSON으로 반환합니다. 없으면 404.
 * 쿼리: `category`, `within_meters`, `min_rating`, `matjip_only`(1/true면 is_matjip=1 만).
 */
app.get("/api/restaurants/pick", async (req, res) => {
  const category = req.query.category;
  const maxWalk = maxWalkMinutesForWithinMeters(req.query.within_meters);
  const minRatingRaw = req.query.min_rating;
  let minRating = null;
  if (minRatingRaw != null && String(minRatingRaw).trim() !== "") {
    minRating = parseInt(String(minRatingRaw).trim(), 10);
    if (!Number.isFinite(minRating) || minRating < 1 || minRating > 5) {
      return res.status(400).json({ error: "별점 조건은 1~5 사이 숫자이거나 비워야 합니다." });
    }
  }
  const matjipOnly = queryMatjipOnly(req.query.matjip_only);
  try {
    const p = await getPool();
    const conds = [];
    const params = [];
    if (category && String(category).trim()) {
      conds.push("category = ?");
      params.push(String(category).trim());
    }
    if (maxWalk != null) {
      conds.push("(walk_minutes IS NULL OR walk_minutes <= ?)");
      params.push(maxWalk);
    }
    if (minRating != null) {
      conds.push("rating >= ?");
      params.push(minRating);
    }
    if (matjipOnly) {
      conds.push("is_matjip = 1");
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const queryText = `SELECT id, name, category, address, walk_minutes, memo, rating, is_matjip, source FROM restaurants ${where}`;

    const [rows] = await p.query(queryText, params);
    if (!rows.length) {
      return res.status(404).json({
        error:
          "조건에 맞는 곳이 없습니다. 거리·음식 종류·별점을 바꾸거나 ‘맛집만’을 해제해 보세요.",
      });
    }
    const pick = rows[Math.floor(Math.random() * rows.length)];
    res.json(pick);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB 오류", detail: e.message });
  }
});

/**
 * POST /api/restaurants — 새 맛집 한 건 INSERT. 성공 시 201 + `{ id }`.
 *
 * [문법] `return res.status(400)...`처럼 조기 `return`으로 “이 아래는 실행하지 않음”을 표현합니다.
 */
app.post("/api/restaurants", async (req, res) => {
  const { name, category, address, walk_minutes, memo, rating, is_matjip } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "식당이름은 필수입니다." });
  }
  const addrTrim = address != null ? String(address).trim() : "";
  if (walk_minutes == null || String(walk_minutes).trim() === "") {
    return res.status(400).json({ error: "도보(분)은 필수입니다." });
  }
  const walkParsed = parseInt(String(walk_minutes).trim(), 10);
  if (!Number.isFinite(walkParsed) || walkParsed < 0 || walkParsed > 255) {
    return res.status(400).json({ error: "도보(분)은 0~255 사이 숫자로 입력해 주세요." });
  }
  const walk = walkParsed;
  const catFinal = parseFoodCategoryOr400(category, res);
  if (catFinal == null) return;
  const ratingVal = parseRatingOptional(rating, res);
  if (ratingVal === undefined) return;
  const matjipVal = parseIsMatjipBody(is_matjip);
  try {
    const p = await getPool();
    const memoVal =
      memo != null ? String(memo).trim().slice(0, 500) || null : null;

    const [result] = await p.query(
      `INSERT INTO restaurants (name, category, address, walk_minutes, memo, rating, is_matjip, source, user_touched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'user', NOW())`,
      [
        String(name).trim(),
        catFinal,
        addrTrim || null,
        walk,
        memoVal,
        ratingVal,
        matjipVal,
      ],
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB 오류", detail: e.message });
  }
});

/**
 * GET /api/restaurants/:id — 단일 맛집 상세(수정 폼 채우기용). 경로 파라미터는 `req.params.id`.
 */
app.get("/api/restaurants/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: "잘못된 id입니다." });
  }
  try {
    const p = await getPool();
    const [recordset] = await p.query(
      "SELECT id, name, category, address, walk_minutes, memo, rating, is_matjip, source, created_at, user_touched_at FROM restaurants WHERE id = ?",
      [id],
    );
    if (!recordset.length) {
      return res.status(404).json({ error: "맛집을 찾을 수 없습니다." });
    }
    res.json(recordset[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB 오류", detail: e.message });
  }
});

/**
 * PUT /api/restaurants/:id — 기존 행 UPDATE. 없으면 404.
 * `source` 는 바꾸지 않습니다. 저장 시 `user_touched_at` 만 갱신합니다.
 */
app.put("/api/restaurants/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: "잘못된 id입니다." });
  }
  const { name, category, address, walk_minutes, memo, rating, is_matjip } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "식당이름은 필수입니다." });
  }
  const catFinal = parseFoodCategoryOr400(category, res);
  if (catFinal == null) return;
  const ratingVal = parseRatingOptional(rating, res);
  if (ratingVal === undefined) return;
  const matjipVal = parseIsMatjipBody(is_matjip);
  try {
    const p = await getPool();
    const walk =
      walk_minutes != null && walk_minutes !== ""
        ? Math.min(255, Math.max(0, parseInt(walk_minutes, 10) || 0))
        : null;
    const memoVal =
      memo != null ? String(memo).trim().slice(0, 500) || null : null;

    const [result] = await p.query(
      `UPDATE restaurants SET name=?, category=?, address=?, walk_minutes=?, memo=?, rating=?, is_matjip=?, user_touched_at=NOW() WHERE id=?`,
      [
        String(name).trim(),
        catFinal,
        address != null ? String(address).trim() || null : null,
        walk,
        memoVal,
        ratingVal,
        matjipVal,
        id,
      ],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "맛집을 찾을 수 없습니다." });
    }
    res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB 오류", detail: e.message });
  }
});

/**
 * DELETE /api/restaurants/:id — 한 행 삭제. 없으면 404.
 */
app.delete("/api/restaurants/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: "잘못된 id입니다." });
  }
  try {
    const p = await getPool();
    const [result] = await p.query("DELETE FROM restaurants WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "맛집을 찾을 수 없습니다." });
    }
    res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB 오류", detail: e.message });
  }
});

/**
 * POST /api/restaurants/sync-naver — `source=naver` 행만 삭제한 뒤, 네이버 지역 검색으로 다시 채웁니다.
 * 직접 등록(`source=user`) 행은 건드리지 않습니다. `.env` 의 NAVER_IMPORT_QUERIES·키가 필요합니다.
 */
app.post("/api/restaurants/sync-naver", async (_req, res) => {
  const queries = parseQueriesFromEnv();
  if (!queries.length) {
    return res.status(400).json({
      error: "NAVER_IMPORT_QUERIES 가 비어 있습니다. .env 에 검색어를 쉼표로 넣어 주세요.",
    });
  }
  try {
    const p = await getPool();
    const [delResult] = await p.query("DELETE FROM restaurants WHERE source = ?", ["naver"]);
    const deleted = delResult.affectedRows ?? 0;
    const summary = await runNaverImportForQueries(p, queries);
    const insertedTotal = summary.reduce((acc, row) => acc + (row.inserted || 0), 0);
    res.json({ ok: true, deleted, insertedTotal, summary });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "동기화 실패", detail: e.message });
  }
});

/**
 * HTTP 서버를 띄우고 포트를 점유합니다. `EADDRINUSE`면 친절한 메시지 후 종료합니다.
 */
const server = app.listen(PORT, () => {
  console.log(`FindEat_CURSOR http://127.0.0.1:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `포트 ${PORT}이(가) 이미 사용 중입니다. 다른 터미널에서 돌아가는 서버를 Ctrl+C로 끄거나, .env의 PORT를 바꾸세요.`,
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});
