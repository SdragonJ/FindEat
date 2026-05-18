/**
 * TMAP 보행자 경로 API — 실제 도보 거리·소요시간.
 * https://openapi.sk.com/ 에서 앱 등록 후 `TMAP_APP_KEY` (.env)
 * API: https://tmap-skopenapi.readme.io/reference/보행자-경로안내
 */

const TMAP_PEDESTRIAN_URL = "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1";

function parseTmapAppKeyFromEnv() {
  return process.env.TMAP_APP_KEY?.trim() || "";
}

function parseTmapRequestDelayMs() {
  const n = parseInt(String(process.env.TMAP_REQUEST_DELAY_MS ?? "150"), 10);
  if (!Number.isFinite(n) || n < 0) return 150;
  return Math.min(2000, n);
}

function isTmapWalkEnabled() {
  if (String(process.env.TMAP_USE_WALK ?? "1").trim() === "0") return false;
  return Boolean(parseTmapAppKeyFromEnv());
}

/** TMAP 기준 N분 미만이면 보정 없음(기본 10). */
function parseWalkShortMaxMinutesFromEnv() {
  const n = parseInt(String(process.env.TMAP_WALK_SHORT_MAX_MIN ?? "10"), 10);
  if (!Number.isFinite(n) || n < 1) return 10;
  return Math.min(60, n);
}

/** 10분 이상 구간: 신호등 간격 추정(분, 5~7 평균 6). */
function parseWalkSignalEveryMinutesFromEnv() {
  const n = parseInt(String(process.env.TMAP_WALK_SIGNAL_EVERY_MIN ?? "6"), 10);
  if (!Number.isFinite(n) || n < 3) return 6;
  return Math.min(15, n);
}

/** 신호 1회당 대기 추정(분). */
function parseWalkSignalWaitMinutesFromEnv() {
  const n = parseInt(String(process.env.TMAP_WALK_SIGNAL_WAIT_MIN ?? "1"), 10);
  if (!Number.isFinite(n) || n < 0) return 1;
  return Math.min(5, n);
}

/** 모든 도보 분에 더하는 고정 보정(분). */
function parseWalkBaseExtraMinutesFromEnv() {
  const n = parseInt(String(process.env.TMAP_WALK_BASE_EXTRA_MIN ?? "3"), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(30, n);
}

/**
 * TMAP 도보 분 → 네이버 지도에 가깝게 보정.
 * 10분 미만: TMAP 그대로. 10분 이상: 신호 가산 후 +3분(기본).
 */
function alignWalkMinutesFromTmap(totalTimeSec) {
  const baseMin = Math.max(1, Math.ceil(totalTimeSec / 60));
  const shortMax = parseWalkShortMaxMinutesFromEnv();
  if (baseMin < shortMax) {
    return Math.min(255, baseMin);
  }
  const every = parseWalkSignalEveryMinutesFromEnv();
  const wait = parseWalkSignalWaitMinutesFromEnv();
  const baseExtra = parseWalkBaseExtraMinutesFromEnv();
  const signalCount = Math.ceil(baseMin / every);
  const adjusted = baseMin + signalCount * wait + baseExtra;
  return Math.min(255, Math.max(1, adjusted));
}

/**
 * GeoJSON FeatureCollection 에서 totalTime(초)·totalDistance(m) 추출.
 * @param {unknown} data
 * @returns {{ distanceMeters: number, walkMinutes: number } | null}
 */
function parseTmapPedestrianResponse(data) {
  const features = data?.features;
  if (!Array.isArray(features)) return null;

  let totalTimeSec = null;
  let totalDistM = null;
  for (const f of features) {
    const p = f?.properties;
    if (!p) continue;
    if (p.totalTime != null && Number(p.totalTime) > 0) {
      totalTimeSec = Number(p.totalTime);
      if (p.totalDistance != null) totalDistM = Number(p.totalDistance);
      break;
    }
  }
  if (totalTimeSec == null || !Number.isFinite(totalTimeSec)) return null;

  const walkMinutes = alignWalkMinutesFromTmap(totalTimeSec);
  const distanceMeters =
    totalDistM != null && Number.isFinite(totalDistM) && totalDistM > 0
      ? Math.round(totalDistM)
      : null;
  return { distanceMeters, walkMinutes };
}

/**
 * 기준점 → 식당 TMAP 보행 경로. 실패 시 `null` (호출측에서 직선 추정 폴백).
 * @param {{ lat: number, lng: number }} ref 출발(회사)
 * @param {{ lat: number, lng: number }} dest 도착(식당)
 * @param {string} [destName] 목적지 이름(로그·TMAP 요청용)
 */
async function fetchTmapPedestrianWalk(ref, dest, destName) {
  const appKey = parseTmapAppKeyFromEnv();
  if (!appKey) return null;

  const startName = String(process.env.TMAP_START_NAME?.trim() || "출발");
  const endName = String(destName || "도착").slice(0, 80);

  const res = await fetch(TMAP_PEDESTRIAN_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      appKey,
    },
    body: JSON.stringify({
      startX: ref.lng,
      startY: ref.lat,
      endX: dest.lng,
      endY: dest.lat,
      startName,
      endName,
      reqCoordType: "WGS84GEO",
      resCoordType: "WGS84GEO",
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`TMAP 응답 JSON 아님 HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const err =
      data?.error?.message ||
      data?.errorMessage ||
      data?.message ||
      text.slice(0, 200);
    throw new Error(`TMAP 보행 경로 HTTP ${res.status}: ${err}`);
  }

  const parsed = parseTmapPedestrianResponse(data);
  if (!parsed) {
    throw new Error("TMAP 응답에 totalTime 이 없습니다.");
  }
  return parsed;
}

let lastTmapCallAt = 0;

async function throttleTmapRequest() {
  const delay = parseTmapRequestDelayMs();
  if (delay <= 0) return;
  const now = Date.now();
  const wait = lastTmapCallAt + delay - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastTmapCallAt = Date.now();
}

module.exports = {
  TMAP_PEDESTRIAN_URL,
  parseTmapAppKeyFromEnv,
  parseTmapRequestDelayMs,
  isTmapWalkEnabled,
  alignWalkMinutesFromTmap,
  parseWalkShortMaxMinutesFromEnv,
  parseWalkSignalEveryMinutesFromEnv,
  parseWalkSignalWaitMinutesFromEnv,
  parseWalkBaseExtraMinutesFromEnv,
  parseTmapPedestrianResponse,
  fetchTmapPedestrianWalk,
  throttleTmapRequest,
};
