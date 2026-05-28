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
const crypto = require("crypto");
const path = require("path");
const {
  parseQueriesFromEnv,
  runNaverImportForQueries,
  parseReferenceLatLngFromEnv,
} = require("./lib/naverImport.js");
const { isTmapWalkEnabled } = require("./lib/tmapWalk.js");

/** 화면·API에서 허용하는 음식 종류(프론트 `FOOD_CATEGORIES` 와 동일해야 함). */
const FOOD_CATEGORIES = [
  "한식",
  "양식",
  "아시아음식",
  "일식",
  "중식",
  "분식",
  "치킨",
  "피자",
  "카페",
  "뷔페",
  "요리주점",
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

/** 별점 4점 이상 → 맛집, 3점 이하 → 맛집 해제, 별점 없음 → 맛집 체크값 따름. */
const MATJIP_AUTO_RATING_MIN = 4;
const MATJIP_AUTO_RATING_CLEAR_MAX = 3;

function matjipMatchSql() {
  return `((rating IS NOT NULL AND rating >= ${MATJIP_AUTO_RATING_MIN}) OR (is_matjip = 1 AND rating IS NULL))`;
}

function resolveIsMatjip(ratingVal, isMatjipBody) {
  if (ratingVal != null && ratingVal >= MATJIP_AUTO_RATING_MIN) return 1;
  if (ratingVal != null && ratingVal <= MATJIP_AUTO_RATING_CLEAR_MAX) return 0;
  return parseIsMatjipBody(isMatjipBody);
}

function queryMatjipOnly(raw) {
  if (raw == null || String(raw).trim() === "") return false;
  const s = String(raw).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || raw === true || raw === 1;
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const CLIENT_COOKIE_NAME = "findeat_uid";
const CLIENT_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

// 다른 출처(포트가 다른 프론트 등)에서 API를 부를 때 브라우저가 막지 않도록 CORS 허용
app.use(cors());

// JSON 본문을 파싱해 req.body에 넣음 (POST/PUT)
app.use(express.json());

// public/index.html, app.js, style.css 등 정적 파일 제공
app.use(express.static("public"));

/**
 * Cookie 헤더 문자열(`a=1; b=2`)을 객체로 바꿉니다.
 * 로그인 없이도 “이 브라우저 사용자”를 구분하는 ID(`findeat_uid`)를 읽을 때 사용합니다.
 */
function parseCookieHeader(cookieHeader) {
  const out = {};
  const raw = String(cookieHeader || "");
  if (!raw.trim()) return out;
  raw.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx < 1) return;
    const key = decodeURIComponent(part.slice(0, idx).trim());
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    if (!key) return;
    out[key] = val;
  });
  return out;
}

/** `findeat_uid` 형식(대시 포함 UUID v4)을 간단히 확인합니다. */
function isValidClientId(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || ""),
  );
}

/** 요청 쿠키에서 `findeat_uid`를 읽고, 없거나 형식이 이상하면 null을 반환합니다. */
function readClientIdFromReq(req) {
  const cookies = parseCookieHeader(req.headers?.cookie);
  const cid = cookies[CLIENT_COOKIE_NAME];
  return isValidClientId(cid) ? cid : null;
}

/** 응답 헤더에 장기 쿠키(`findeat_uid`)를 내려 다음 방문에서도 같은 사용자를 구분합니다. */
function setClientIdCookie(res, clientId) {
  res.setHeader(
    "Set-Cookie",
    `${CLIENT_COOKIE_NAME}=${encodeURIComponent(clientId)}; Path=/; Max-Age=${CLIENT_COOKIE_MAX_AGE_SEC}; HttpOnly; SameSite=Lax`,
  );
}

/**
 * 현재 요청의 클라이언트 ID를 보장합니다.
 * - 이미 쿠키가 있으면 그대로
 * - 없으면 UUID를 새로 만들고 쿠키로 발급
 */
function ensureClientId(req, res) {
  const existing = readClientIdFromReq(req);
  if (existing) return existing;
  const created = crypto.randomUUID();
  setClientIdCookie(res, created);
  return created;
}

/**
 * 로그인 없이 볼 수 있는 기본 범위:
 * - 네이버 공통 데이터(source='naver')
 * - 내 브라우저가 추가한 데이터(owner_client_id=내 쿠키 ID)
 * - 예전 데이터 호환: owner_client_id 가 비어 있는 user 행(기존 공통 데이터)
 */
function visibilityScopeSql() {
  return "(source = 'naver' OR owner_client_id = ? OR (source = 'user' AND owner_client_id IS NULL))";
}

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
 * 도보 시간 필터: `max_walk_minutes` = 10 | 20 | 30 | gte30
 * - 10/20/30 → `walk_minutes` 가 각각 10·20·30분 **미만** (`<`)
 * - gte30 → 30분 **이상** (`>=`)
 * 하위 호환: `gte20`→30분 이상, `within_meters` 100/300/600→10/20/30분 미만, `5`→10분 미만.
 */
function parseWalkFilterFromQuery(query) {
  const raw = query.max_walk_minutes ?? query.within_meters;
  const v = String(raw ?? "").trim();
  if (!v) return { walkLessThan: null, walkGte: null };
  if (v === "gte30" || v === "gte20" || v === "30plus" || v === "30+" || v === "20plus" || v === "20+") {
    return { walkLessThan: null, walkGte: 30 };
  }
  if (v === "100") return { walkLessThan: 10, walkGte: null };
  if (v === "300") return { walkLessThan: 20, walkGte: null };
  if (v === "600") return { walkLessThan: 30, walkGte: null };
  const n = parseInt(v, 10);
  if (n === 5) return { walkLessThan: 10, walkGte: null };
  if (n === 10) return { walkLessThan: 10, walkGte: null };
  if (n === 20) return { walkLessThan: 20, walkGte: null };
  if (n === 30) return { walkLessThan: 30, walkGte: null };
  return { walkLessThan: null, walkGte: null };
}

function applyWalkFilterSql(conds, params, walkFilter) {
  if (walkFilter.walkLessThan != null) {
    conds.push("walk_minutes IS NOT NULL AND walk_minutes < ?");
    params.push(walkFilter.walkLessThan);
  }
  if (walkFilter.walkGte != null) {
    conds.push("walk_minutes IS NOT NULL AND walk_minutes >= ?");
    params.push(walkFilter.walkGte);
  }
}

/**
 * `.env` 의 NAVER_REFERENCE_LAT/LNG 를 API JSON에 넣을 형태로 돌려줍니다.
 * [용도] 각 행의 `latitude`/`longitude`는 **식당** 좌표이고, 이 값은 **내 위치(기준점)** 입니다.
 */
function referenceLocationJson() {
  const ref = parseReferenceLatLngFromEnv();
  if (!ref) return null;
  return { latitude: ref.lat, longitude: ref.lng };
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
 * GET /api/me — 로그인 없이도 브라우저별 고유 ID를 발급/확인합니다.
 * 프론트는 페이지 초기화 시 이 API를 한 번 호출해 `findeat_uid` 쿠키를 확정합니다.
 */
app.get("/api/me", (req, res) => {
  const clientId = ensureClientId(req, res);
  res.json({ ok: true, client_id: clientId });
});

/**
 * GET /api/restaurants — 맛집 목록(페이지). 쿼리: `category`, `max_walk_minutes`, `min_rating`, `matjip_only`, `page`, `limit`.
 * 응답: `{ items, total, page, pageSize, totalPages }`. `reference_location` 은 `.env` 기준점(내 위치) 위·경도, 각 item 의 `latitude`/`longitude` 는 **식당** 좌표, `distance_meters`/`walk_minutes` 는 기준점에서 식당까지입니다.
 * 정렬은 `user_touched_at`·`category`·`name` 규칙 동일.
 */
app.get("/api/restaurants", async (req, res) => {
  const clientId = ensureClientId(req, res);
  const category = req.query.category;
  const walkFilter = parseWalkFilterFromQuery(req.query);
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
  conds.push(visibilityScopeSql());
  params.push(clientId);
  if (category && String(category).trim()) {
    conds.push("category = ?");
    params.push(String(category).trim());
  }
  applyWalkFilterSql(conds, params, walkFilter);
  if (minRating != null) {
    conds.push("rating >= ?");
    params.push(minRating);
  }
  if (matjipOnly) {
    conds.push(matjipMatchSql());
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

  try {
    const p = await getPool();
    const [countRows] = await p.query(`SELECT COUNT(*) AS cnt FROM restaurants ${where}`, params);
    const total = Number(countRows[0]?.cnt ?? 0);
    if (total === 0) {
      return res.json({
        reference_location: referenceLocationJson(),
        items: [],
        total: 0,
        page: 1,
        pageSize: limit,
        totalPages: 0,
      });
    }
    const totalPages = Math.ceil(total / limit);
    if (page > totalPages) page = totalPages;

    const offsetClamped = (page - 1) * limit;
    const listSql = `SELECT id, name, category, address, walk_minutes, memo, rating, is_matjip, source, created_at, user_touched_at,
      latitude, longitude, distance_meters
      FROM restaurants ${where} ${orderList} LIMIT ? OFFSET ?`;
    const [recordset] = await p.query(listSql, [...params, limit, offsetClamped]);

    res.json({
      reference_location: referenceLocationJson(),
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
 * GET /api/restaurants/categories — 네이버 공통 + 내 추가분에서 DISTINCT 카테고리를 반환합니다.
 * 프론트 셀렉트 옵션 채우기용입니다.
 */
app.get("/api/restaurants/categories", async (req, res) => {
  const clientId = ensureClientId(req, res);
  try {
    const p = await getPool();
    const [recordset] = await p.query(
      `SELECT DISTINCT category FROM restaurants
       WHERE ${visibilityScopeSql()}
       ORDER BY category`,
      [clientId],
    );
    res.json(recordset.map((r) => r.category));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "DB 오류", detail: e.message });
  }
});

/**
 * GET /api/restaurants/pick — 조건에 맞는 행 중 무작위 한 건을 골라 JSON으로 반환합니다. 없으면 404.
 * 쿼리: `category`, `max_walk_minutes`, `min_rating`, `matjip_only`(1/true면 is_matjip=1 만). 응답에 `latitude`·`longitude`·`distance_meters` 포함.
 */
app.get("/api/restaurants/pick", async (req, res) => {
  const clientId = ensureClientId(req, res);
  const category = req.query.category;
  const walkFilter = parseWalkFilterFromQuery(req.query);
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
    conds.push(visibilityScopeSql());
    params.push(clientId);
    if (category && String(category).trim()) {
      conds.push("category = ?");
      params.push(String(category).trim());
    }
    applyWalkFilterSql(conds, params, walkFilter);
    if (minRating != null) {
      conds.push("rating >= ?");
      params.push(minRating);
    }
    if (matjipOnly) {
      conds.push(matjipMatchSql());
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const queryText = `SELECT id, name, category, address, walk_minutes, memo, rating, is_matjip, source,
      latitude, longitude, distance_meters FROM restaurants ${where}`;

    const [rows] = await p.query(queryText, params);
    if (!rows.length) {
      return res.status(404).json({
        error:
          "조건에 맞는 곳이 없습니다. 거리·음식 종류·별점을 바꾸거나 ‘맛집만’을 해제해 보세요.",
      });
    }
    const pick = rows[Math.floor(Math.random() * rows.length)];
    res.json({ ...pick, reference_location: referenceLocationJson() });
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
  const clientId = ensureClientId(req, res);
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
  const matjipVal = resolveIsMatjip(ratingVal, is_matjip);
  try {
    const p = await getPool();
    const memoVal =
      memo != null ? String(memo).trim().slice(0, 500) || null : null;

    const [result] = await p.query(
      `INSERT INTO restaurants (name, category, address, walk_minutes, memo, rating, is_matjip, source, owner_client_id, user_touched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'user', ?, NOW())`,
      [
        String(name).trim(),
        catFinal,
        addrTrim || null,
        walk,
        memoVal,
        ratingVal,
        matjipVal,
        clientId,
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
  const clientId = ensureClientId(req, res);
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: "잘못된 id입니다." });
  }
  try {
    const p = await getPool();
    const [recordset] = await p.query(
      `SELECT id, name, category, address, walk_minutes, memo, rating, is_matjip, source, created_at, user_touched_at, latitude, longitude, distance_meters
       FROM restaurants
       WHERE id = ? AND ${visibilityScopeSql()}`,
      [id, clientId],
    );
    if (!recordset.length) {
      return res.status(404).json({ error: "맛집을 찾을 수 없습니다." });
    }
    res.json({ ...recordset[0], reference_location: referenceLocationJson() });
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
  const clientId = ensureClientId(req, res);
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
  const matjipVal = resolveIsMatjip(ratingVal, is_matjip);
  try {
    const p = await getPool();
    const walk =
      walk_minutes != null && walk_minutes !== ""
        ? Math.min(255, Math.max(0, parseInt(walk_minutes, 10) || 0))
        : null;
    const memoVal =
      memo != null ? String(memo).trim().slice(0, 500) || null : null;

    const [result] = await p.query(
      `UPDATE restaurants SET name=?, category=?, address=?, walk_minutes=?, memo=?, rating=?, is_matjip=?, user_touched_at=NOW()
       WHERE id=? AND ${visibilityScopeSql()}`,
      [
        String(name).trim(),
        catFinal,
        address != null ? String(address).trim() || null : null,
        walk,
        memoVal,
        ratingVal,
        matjipVal,
        id,
        clientId,
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
  const clientId = ensureClientId(req, res);
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: "잘못된 id입니다." });
  }
  try {
    const p = await getPool();
    const [result] = await p.query(
      `DELETE FROM restaurants WHERE id = ? AND ${visibilityScopeSql()}`,
      [id, clientId],
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
 * POST /api/restaurants/sync-naver — 네이버 지역 검색으로 새 식당만 추가합니다.
 * 이름+좌표가 같으면 기존 행은 그대로 두고 TMAP·UPDATE 를 하지 않습니다. `source=user` 는 덮어쓰지 않습니다.
 */
app.post("/api/restaurants/sync-naver", async (_req, res) => {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
  const queries = parseQueriesFromEnv();
  if (!queries.length) {
    return res.status(400).json({
      error: "NAVER_IMPORT_QUERIES 가 비어 있습니다. .env 에 검색어를 쉼표로 넣어 주세요.",
    });
  }
  if (!parseReferenceLatLngFromEnv()) {
    return res.status(400).json({
      error:
        "NAVER_REFERENCE_LAT, NAVER_REFERENCE_LNG(회사 출발지)가 필요합니다. 도보 시간 계산에 쓰입니다.",
    });
  }
  try {
    const p = await getPool();
    const { summary, walkFill } = await runNaverImportForQueries(p, queries);
    const insertedTotal = summary.reduce((acc, row) => acc + (row.inserted || 0), 0);
    const unchangedTotal = summary.reduce((acc, row) => acc + (row.unchanged || 0), 0);
    const skippedTotal = summary.reduce((acc, row) => acc + (row.skipped || 0), 0);
    const [countRows] = await p.query(
      "SELECT COUNT(*) AS c FROM restaurants WHERE source = ?",
      ["naver"],
    );
    const naverTotal = Number(countRows[0]?.c ?? 0);
    const [walkNullRows] = await p.query(
      `SELECT COUNT(*) AS c FROM restaurants WHERE source = ? AND walk_minutes IS NULL
       AND latitude IS NOT NULL AND longitude IS NOT NULL`,
      ["naver"],
    );
    const walkMinutesMissing = Number(walkNullRows[0]?.c ?? 0);
    res.json({
      ok: true,
      insertedTotal,
      unchangedTotal,
      skippedTotal,
      naverTotal,
      tmapWalk: isTmapWalkEnabled(),
      walkFill,
      walkMinutesMissing,
      summary,
    });
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
