/**
 * 네이버 지역 검색 → MariaDB `restaurants` 적재 로직.
 * `server.js`(버튼 API)와 `scripts/naver-local-import.mjs`(CLI)에서 같이 씁니다.
 *
 * `source` 컬럼: `user` = 직접 등록, `naver` = 이 모듈로 넣은 데이터(최신화 시 이름+좌표 같으면 유지·새 곳만 추가).
 *
 * 거리·도보: 응답의 `mapx`·`mapy`를 WGS84 경위도(도×10⁷ 정수)로 해석하고, `.env` 의 기준점과 Haversine 거리로
 * `distance_meters`·`walk_minutes`를 채웁니다. `TMAP_APP_KEY` 가 있으면 TMAP 보행 경로 기준.
 * 기준점이 없으면 좌표만 넣거나(파싱 성공 시) 모두 NULL 입니다.
 */

const NAVER_LOCAL_URL = "https://openapi.naver.com/v1/search/local.json";

/** 직접 등록한 맛집 — 최신화(네이버 재수입) 시 삭제되지 않습니다. */
const SOURCE_USER = "user";
/** 네이버 지역 검색으로 넣은 맛집 — 최신화 시 삭제 후 다시 채웁니다. */
const SOURCE_NAVER = "naver";

/** 직선거리에 길 따라가기(우회)를 반영. 네이버 지도 도보는 직선보다 길게 잡힙니다. */
const WALK_DETOUR_FACTOR = 1.25;
/** 직선 추정 폴백 시 속도(분당 약 75m). UI 도보 필터는 10·20·30분 미만·30분 이상(`max_walk_minutes`). */
const WALK_METERS_PER_MINUTE = 75;
/** 이보다 멀면 좌표·기준점 오류 가능성이 커서 `walk_minutes` 는 넣지 않습니다(직선 14km→234분 같은 값 방지). */
const MAX_REASONABLE_WALK_DISTANCE_METERS = 3500;

/** 네이버 지역 검색 API: 요청당 최대 5건. `start`>1 페이지네이션은 2020-07 이후 불가. */
const NAVER_LOCAL_DISPLAY_MAX = 5;

/** `.env` NAVER_IMPORT_TARGET — 네이버(`source=naver`)로 채울 목표 건수(기본 50). */
const DEFAULT_IMPORT_TARGET = 50;

/** 기본 검색어 뒤에 붙여 추가 API 호출할 음식 종류(검색어당 최대 5건씩). */
const CATEGORY_SEARCH_SUFFIXES = [
  "한식",
  "양식",
  "아시아음식",
  "일식",
  "중식",
  "분식",
  "카페",
  "뷔페",
  "치킨",
  "피자",
  "요리주점",
  "닭강정",
];

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

function parseImportTargetFromEnv() {
  const n = parseInt(String(process.env.NAVER_IMPORT_TARGET ?? String(DEFAULT_IMPORT_TARGET)), 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_IMPORT_TARGET;
  return Math.min(500, n);
}

/** 중복 없이 기본 검색어 + 종류별 검색어 순서를 만듭니다. */
function buildQuerySchedule(baseQueries) {
  const seen = new Set();
  const schedule = [];
  const add = (q) => {
    const t = String(q ?? "").trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    schedule.push(t);
  };
  for (const q of baseQueries) add(q);
  for (const q of baseQueries) {
    for (const suffix of CATEGORY_SEARCH_SUFFIXES) {
      add(`${q} ${suffix}`);
    }
  }
  return schedule;
}

/**
 * `.env` 에서 기준점(회사·집 등) WGS84 위도·경도를 읽습니다. 없거나 범위 밖이면 `null`.
 * [왜 따로 두나요?] 네이버 지역 검색 API는 “검색어 기준” 거리 숫자를 주지 않아, 직선 거리는 기준 좌표가 있어야 계산됩니다.
 */
function parseReferenceLatLngFromEnv() {
  let lat = parseFloat(process.env.NAVER_REFERENCE_LAT?.trim() ?? "");
  let lng = parseFloat(process.env.NAVER_REFERENCE_LNG?.trim() ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // LAT=위도(37.x), LNG=경도(127.x) — 줄을 반대로 적은 경우 자동 교정
  const latInKr = lat >= 33 && lat <= 43;
  const lngInKr = lng >= 124 && lng <= 132;
  if (!latInKr && lat >= 124 && lat <= 132 && lng >= 33 && lng <= 43) {
    [lat, lng] = [lng, lat];
    console.warn(
      "[naverImport] NAVER_REFERENCE_LAT/LNG 가 뒤바뀐 것 같아 바꿔 씁니다. LAT=위도, LNG=경도 로 맞추세요.",
    );
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat < 33 || lat > 43 || lng < 124 || lng > 132) {
    console.warn(
      "[naverImport] NAVER_REFERENCE_* 가 한국 범위(위도 33~43, 경도 124~132) 밖입니다. 네이버 지도 출발지 좌표를 확인하세요.",
    );
    return null;
  }
  return { lat, lng };
}

/**
 * 네이버 지역 검색 `mapx`·`mapy`를 WGS84 위도·경도로 바꿉니다.
 * 최신 API는 보통 경도×10⁷(`mapx`)·위도×10⁷(`mapy`) 정수입니다. 한국 대략 범위 밖이면 `null`입니다.
 */
function parseNaverLocalMapXYToLatLng(mapx, mapy) {
  const mx = parseInt(String(mapx ?? "").trim(), 10);
  const my = parseInt(String(mapy ?? "").trim(), 10);
  if (!Number.isFinite(mx) || !Number.isFinite(my)) return null;

  const inKoreaRough = (lng, lat) =>
    lat >= 33 && lat <= 43 && lng >= 124 && lng <= 132;

  const lng1 = mx / 1e7;
  const lat1 = my / 1e7;
  if (inKoreaRough(lng1, lat1)) return { lat: lat1, lng: lng1 };

  // 혹시 응답 순서가 바뀐 경우에만 스왑 허용
  const lng2 = my / 1e7;
  const lat2 = mx / 1e7;
  if (inKoreaRough(lng2, lat2)) return { lat: lat2, lng: lng2 };

  return null;
}

/**
 * 두 WGS84 점 사이의 대권 거리(미터). 작은 거리·한반도 용도로 충분한 Haversine 공식입니다.
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const φ1 = rad(lat1);
  const φ2 = rad(lat2);
  const Δφ = rad(lat2 - lat1);
  const Δλ = rad(lng2 - lng1);
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 직선 거리(미터)를 도보 분으로 올림합니다. 우회 계수 적용. `TINYINT` 상한 255, 최소 1분.
 */
function walkMinutesFromMeters(straightMeters) {
  if (straightMeters == null || !Number.isFinite(straightMeters) || straightMeters <= 0) {
    return null;
  }
  const routeLike = straightMeters * WALK_DETOUR_FACTOR;
  const mins = Math.ceil(routeLike / WALK_METERS_PER_MINUTE);
  return Math.min(255, Math.max(1, mins));
}

const {
  isTmapWalkEnabled,
  fetchTmapPedestrianWalk,
  throttleTmapRequest,
} = require("./tmapWalk.js");

/**
 * 기준점·식당 좌표로 거리(m)·도보 분을 계산합니다.
 * `TMAP_APP_KEY` 가 있으면 TMAP 보행 경로 우선(원거리도 시도), 실패 시 직선+추정 폴백.
 */
async function computeDistanceAndWalkFromRef(ref, placeLatLng, placeNameForLog) {
  const straightM = haversineMeters(ref.lat, ref.lng, placeLatLng.lat, placeLatLng.lng);
  const straightDistanceMeters = Math.round(straightM);
  const tooFarStraight = straightM > MAX_REASONABLE_WALK_DISTANCE_METERS;
  const label = placeNameForLog ? stripHtmlTitle(placeNameForLog) : "도착";

  if (isTmapWalkEnabled()) {
    try {
      await throttleTmapRequest();
      const route = await fetchTmapPedestrianWalk(ref, placeLatLng, label);
      if (route && route.walkMinutes != null) {
        const distanceMeters =
          route.distanceMeters > 0 ? route.distanceMeters : straightDistanceMeters;
        return { distanceMeters, walkMinutes: route.walkMinutes };
      }
    } catch (e) {
      console.warn(`[tmap] "${label}" ${e.message} — 직선 추정으로 대체`);
    }
  }

  if (tooFarStraight) {
    console.warn(
      `[naverImport] "${label}" 직선 약 ${straightDistanceMeters}m — TMAP 실패·비활성, walk_minutes 비움`,
    );
    return { distanceMeters: straightDistanceMeters, walkMinutes: null };
  }

  return {
    distanceMeters: straightDistanceMeters,
    walkMinutes: walkMinutesFromMeters(straightM),
  };
}

/**
 * 좌표는 있는데 walk_minutes 가 비어 있는 naver 행을 TMAP/추정으로 채웁니다.
 */
async function fillMissingWalkMinutesForNaver(pool) {
  const ref = parseReferenceLatLngFromEnv();
  if (!ref) return { filled: 0, stillNull: 0 };
  const [rows] = await pool.query(
    `SELECT id, name, latitude, longitude FROM restaurants
     WHERE source = ? AND walk_minutes IS NULL
       AND latitude IS NOT NULL AND longitude IS NOT NULL`,
    [SOURCE_NAVER],
  );
  let filled = 0;
  for (const row of rows) {
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const { distanceMeters, walkMinutes } = await computeDistanceAndWalkFromRef(
      ref,
      { lat, lng },
      row.name,
    );
    if (walkMinutes == null) continue;
    await pool.query(
      "UPDATE restaurants SET distance_meters = ?, walk_minutes = ? WHERE id = ?",
      [distanceMeters, walkMinutes, row.id],
    );
    filled += 1;
  }
  return { filled, stillNull: rows.length - filled };
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
  const display = Math.min(NAVER_LOCAL_DISPLAY_MAX, Math.max(1, opts.display ?? NAVER_LOCAL_DISPLAY_MAX));
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
  "치킨",
  "피자",
  "카페",
  "뷔페",
  "요리주점",
  "기타",
];
const FOOD_CATEGORY_SET = new Set(FOOD_CATEGORIES);

/** 네이버 상위 분류 — FindEat 종류가 아니라 경로만 잡아 주는 래퍼. */
const NAVER_GENERIC_SEGMENTS = new Set(["음식점", "맛집", "식당", "술집"]);

/**
 * 네이버 `category` 한 덩어리(또는 `,`로 이어진 부분) → FindEat 음식 종류.
 * 예: `일본식라면` → `일식`, `카페,디저트` → `카페`
 */
const NAVER_SEGMENT_ALIASES = {
  일본식라면: "일식",
  일식당: "일식",
  일본음식: "일식",
  중국요리: "중식",
  중국집: "중식",
  베트남음식: "아시아음식",
  태국음식: "아시아음식",
  인도음식: "아시아음식",
  아시아음식: "아시아음식",
  동남아음식: "아시아음식",
  이탈리아음식: "양식",
  프랑스음식: "양식",
  스테이크: "양식",
  파스타: "양식",
  "카페,디저트": "카페",
  디저트: "카페",
  베이커리: "카페",
  제과: "카페",
  피자: "피자",
  치킨: "치킨",
  닭강정: "치킨",
  "치킨,닭강정": "치킨",
  요리주점: "요리주점",
  호프: "요리주점",
};

/** 세그먼트·별칭으로 못 맞출 때 전체 문자열에 부분 일치. (앞 규칙이 우선) */
const NAVER_CATEGORY_KEYWORD_RULES = [
  { food: "일식", keys: ["일식", "일본", "라멘", "라면", "스시", "초밥", "우동", "소바", "돈까스", "텐동", "이자카야", "오마카세"] },
  { food: "중식", keys: ["중식", "중국", "짜장", "짬뽕", "마라"] },
  { food: "한식", keys: ["한식", "한정식", "국밥", "찌개", "고기", "육류", "삼겹", "갈비", "백반"] },
  { food: "분식", keys: ["분식", "김밥", "떡볶이", "순대"] },
  { food: "치킨", keys: ["치킨", "닭강정", "통닭", "후라이드"] },
  { food: "피자", keys: ["피자"] },
  { food: "요리주점", keys: ["요리주점", "호프", "포차"] },
  { food: "양식", keys: ["양식", "이탈리아", "프랑스", "스테이크", "파스타", "브런치", "햄버거"] },
  { food: "아시아음식", keys: ["베트남", "태국", "인도", "쌀국수", "팟타이", "커리", "동남아"] },
  { food: "카페", keys: ["카페", "디저트", "베이커리", "커피", "제과"] },
  { food: "뷔페", keys: ["뷔페", "무한리필"] },
];

function naverCategorySegments(raw) {
  return String(raw ?? "")
    .split(">")
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapOneNaverCategoryToken(token) {
  const t = String(token ?? "").trim();
  if (!t) return null;
  if (FOOD_CATEGORY_SET.has(t)) return t;
  if (NAVER_SEGMENT_ALIASES[t]) return NAVER_SEGMENT_ALIASES[t];
  for (const { food, keys } of NAVER_CATEGORY_KEYWORD_RULES) {
    if (keys.some((k) => t.includes(k))) return food;
  }
  return null;
}

/**
 * 네이버 지역검색 `category` → 화면 콤보 값.
 * `음식점>일식>일본식라면` 처럼 중간에 `일식`이 있으면 첫 칸 `음식점`만 보지 않고 경로 전체를 봅니다.
 */
function toCategoryField(raw) {
  const segments = naverCategorySegments(raw);
  if (!segments.length) return "기타";

  for (const seg of segments) {
    if (NAVER_GENERIC_SEGMENTS.has(seg)) continue;
    const direct = mapOneNaverCategoryToken(seg);
    if (direct) return direct;
    for (const part of seg.split(/[,，]/)) {
      const fromPart = mapOneNaverCategoryToken(part);
      if (fromPart) return fromPart;
    }
  }

  for (const seg of segments) {
    const direct = mapOneNaverCategoryToken(seg);
    if (direct) return direct;
    for (const part of seg.split(/[,，]/)) {
      const fromPart = mapOneNaverCategoryToken(part);
      if (fromPart) return fromPart;
    }
  }

  const flat = segments.join(">");
  for (const { food, keys } of NAVER_CATEGORY_KEYWORD_RULES) {
    if (keys.some((k) => flat.includes(k))) return food;
  }
  return "기타";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** DB `DECIMAL(10,7)` 에 맞게 위경도를 반올림합니다. */
function roundCoord7(n) {
  return Math.round(n * 1e7) / 1e7;
}

/** 증분 동기화: 이름 + 좌표(소수 7자리) 가 같으면 같은 식당. */
function placeKey(name, lat, lng) {
  const la = roundCoord7(Number(lat));
  const ln = roundCoord7(Number(lng));
  if (!String(name ?? "").trim() || !Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return `${String(name).trim()}\0${la}\0${ln}`;
}

/**
 * DB에 있는 식당을 이름+좌표 키로 인덱싱합니다 (직접 등록·네이버 모두).
 * @returns {Promise<Map<string, { id: number, source: string }>>}
 */
async function loadRestaurantPlaceIndex(pool) {
  const [rows] = await pool.query(
    `SELECT id, name, latitude, longitude, source FROM restaurants
     WHERE latitude IS NOT NULL AND longitude IS NOT NULL`,
  );
  const index = new Map();
  for (const row of rows) {
    const key = placeKey(row.name, row.latitude, row.longitude);
    if (key && !index.has(key)) index.set(key, { id: row.id, source: row.source });
  }
  return index;
}

/**
 * 한 검색어에 대해 네이버 API 1회(최대 5건). 이미 있는 이름+좌표는 건너뛰고 새 곳만 INSERT·TMAP.
 * @param {import('mysql2/promise').Pool} pool
 * @param {Map<string, { id: number, source: string }>} placeIndex
 */
async function importAllPagesForQuery(pool, query, placeIndex) {
  const display = NAVER_LOCAL_DISPLAY_MAX;
  let inserted = 0;
  let unchanged = 0;
  let skipped = 0;
  const ref = parseReferenceLatLngFromEnv();

  const data = await fetchLocalPage({ query, display, start: 1 });
  const total = Number(data.total) || 0;
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

    const placeLatLng = parseNaverLocalMapXYToLatLng(item.mapx, item.mapy);
    if (!placeLatLng) {
      skipped += 1;
      continue;
    }

    const latitude = roundCoord7(placeLatLng.lat).toFixed(7);
    const longitude = roundCoord7(placeLatLng.lng).toFixed(7);
    const key = placeKey(name, latitude, longitude);
    if (!key) {
      skipped += 1;
      continue;
    }

    const existing = placeIndex.get(key);
    if (existing) {
      if (existing.source === SOURCE_USER) skipped += 1;
      else unchanged += 1;
      continue;
    }

    const category = toCategoryField(item.category);
    const memoParts = [
      item.description ? String(item.description).trim() : "",
      item.link ? `link:${String(item.link).trim()}` : "",
      `map:${item.mapx},${item.mapy}`,
    ].filter(Boolean);
    const memo = memoParts.join(" | ").slice(0, 500);

    let distanceMeters = null;
    let walkMinutes = null;
    if (ref) {
      const computed = await computeDistanceAndWalkFromRef(ref, placeLatLng, name);
      distanceMeters = computed.distanceMeters;
      walkMinutes = computed.walkMinutes;
    }

    const [result] = await pool.query(
      "INSERT INTO restaurants (name, category, address, walk_minutes, memo, source, rating, is_matjip, latitude, longitude, distance_meters) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [
        name,
        category,
        address,
        walkMinutes,
        memo || null,
        SOURCE_NAVER,
        null,
        0,
        latitude,
        longitude,
        distanceMeters,
      ],
    );
    placeIndex.set(key, { id: result.insertId, source: SOURCE_NAVER });
    inserted += 1;
  }

  return { query, total, inserted, unchanged, skipped };
}

/**
 * `.env` 의 NAVER_REFERENCE_* 만 바꾼 뒤, 이미 DB에 있는 `source=naver` 행의
 * `distance_meters`·`walk_minutes` 를 식당 좌표(latitude/longitude) 기준으로 다시 채웁니다.
 * 네이버 API 재호출·행 삭제는 하지 않습니다.
 * @param {import('mysql2/promise').Pool} pool
 */
async function recalculateNaverDistancesFromEnv(pool) {
  const ref = parseReferenceLatLngFromEnv();
  if (!ref) {
    throw new Error(
      "NAVER_REFERENCE_LAT, NAVER_REFERENCE_LNG 가 필요합니다. LAT=위도(37.47x), LNG=경도(126.88x)",
    );
  }
  const [rows] = await pool.query(
    `SELECT id, name, latitude, longitude FROM restaurants
     WHERE source = ? AND latitude IS NOT NULL AND longitude IS NOT NULL`,
    [SOURCE_NAVER],
  );
  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      skipped += 1;
      continue;
    }
    const { distanceMeters, walkMinutes } = await computeDistanceAndWalkFromRef(
      ref,
      { lat, lng },
      row.name,
    );
    await pool.query(
      "UPDATE restaurants SET distance_meters = ?, walk_minutes = ? WHERE id = ?",
      [distanceMeters, walkMinutes, row.id],
    );
    updated += 1;
  }
  return { reference: ref, total: rows.length, updated, skipped };
}

/**
 * 여러 검색어를 순서대로 수입합니다.
 * @param {import('mysql2/promise').Pool} pool
 * @param {string[]} queries
 */
async function runNaverImportForQueries(pool, queries) {
  const target = parseImportTargetFromEnv();
  const schedule = buildQuerySchedule(queries);
  const placeIndex = await loadRestaurantPlaceIndex(pool);
  const summary = [];
  for (const q of schedule) {
    const [countRows] = await pool.query(
      "SELECT COUNT(*) AS c FROM restaurants WHERE source = ?",
      [SOURCE_NAVER],
    );
    if (Number(countRows[0]?.c ?? 0) >= target) break;
    summary.push(await importAllPagesForQuery(pool, q, placeIndex));
    await sleep(300);
  }
  const walkFill = await fillMissingWalkMinutesForNaver(pool);
  if (walkFill.filled > 0) {
    console.log(`[naverImport] walk_minutes 보정: ${walkFill.filled}건 채움`);
  }
  return { summary, walkFill };
}

module.exports = {
  NAVER_LOCAL_URL,
  SOURCE_USER,
  SOURCE_NAVER,
  WALK_DETOUR_FACTOR,
  WALK_METERS_PER_MINUTE,
  MAX_REASONABLE_WALK_DISTANCE_METERS,
  NAVER_LOCAL_DISPLAY_MAX,
  DEFAULT_IMPORT_TARGET,
  parseImportTargetFromEnv,
  buildQuerySchedule,
  parseQueriesFromEnv,
  parseReferenceLatLngFromEnv,
  parseNaverLocalMapXYToLatLng,
  haversineMeters,
  walkMinutesFromMeters,
  computeDistanceAndWalkFromRef,
  fetchLocalPage,
  recalculateNaverDistancesFromEnv,
  fillMissingWalkMinutesForNaver,
  runNaverImportForQueries,
  toCategoryField,
  placeKey,
  loadRestaurantPlaceIndex,
};
