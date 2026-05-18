#!/usr/bin/env node
/**
 * 네이버 지역 검색 API·회사 기준점(.env)이 맞는지 한 번에 확인합니다.
 * DB에 쓰지 않으므로 MariaDB 없이도 실행할 수 있습니다.
 *
 * 사용: `.env` 에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 넣은 뒤
 *   npm run verify:naver
 *
 * 검색어 우선순위:
 *   1) NAVER_VERIFY_QUERY (이번만 다른 검색어로 테스트할 때)
 *   2) NAVER_IMPORT_QUERIES 의 첫 번째 검색어 (실제 수입과 동일)
 *   3) 없으면 안내 후 종료
 */

import dotenv from "dotenv";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const {
  parseQueriesFromEnv,
  parseReferenceLatLngFromEnv,
  parseNaverLocalMapXYToLatLng,
  computeDistanceAndWalkFromRef,
  haversineMeters,
} = require("../lib/naverImport.js");

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

const NAVER_LOCAL_URL = "https://openapi.naver.com/v1/search/local.json";

async function main() {
  const id = process.env.NAVER_CLIENT_ID?.trim();
  const secret = process.env.NAVER_CLIENT_SECRET?.trim();
  if (!id || !secret) {
    console.error(
      "c:\\FindEat\\.env 파일에 NAVER_CLIENT_ID 와 NAVER_CLIENT_SECRET 을 넣은 뒤 다시 실행하세요.",
    );
    process.exit(1);
  }

  const verifyOverride = process.env.NAVER_VERIFY_QUERY?.trim();
  const importQueries = parseQueriesFromEnv();
  const query = verifyOverride || importQueries[0] || "";
  if (!query) {
    console.error(
      "검색어가 없습니다. .env 에 NAVER_IMPORT_QUERIES=대륭테크노타운19차 주변 식당 처럼 넣거나,",
    );
    console.error("  이번만 테스트할 때는 NAVER_VERIFY_QUERY=... 를 쓰세요.");
    process.exit(1);
  }
  const u = new URL(NAVER_LOCAL_URL);
  u.searchParams.set("query", query);
  u.searchParams.set("display", "3");
  u.searchParams.set("start", "1");
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
    console.error(`응답이 JSON이 아닙니다. HTTP ${res.status}: ${text.slice(0, 300)}`);
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`HTTP ${res.status}:`, data?.errorMessage || data?.message || text.slice(0, 300));
    console.error(
      "403 이면 개발자센터 앱에서 ‘검색’ > ‘지역 검색’ 사용이 켜져 있는지 확인하세요.",
    );
    process.exit(1);
  }

  const total = data.total ?? 0;
  const items = Array.isArray(data.items) ? data.items : [];
  const titles = items.map((it) =>
    String(it.title ?? "")
      .replace(/<[^>]+>/g, "")
      .trim(),
  );

  console.log("네이버 지역 검색 연결 OK");
  console.log(
    "검색어:",
    query,
    verifyOverride ? "(NAVER_VERIFY_QUERY)" : "(NAVER_IMPORT_QUERIES 첫 항목)",
  );
  console.log("");
  console.log(
    "[설정 구분] NAVER_IMPORT_QUERIES = 네이버에 넣을 식당 검색어 | NAVER_REFERENCE_LAT/LNG = 회사(대륭19차) 위·경도로 거리·도보 계산",
  );
  console.log("총 검색 결과 수(total):", total);
  console.log("이번 요청에서 받은 샘플(최대 3곳):", titles.length ? titles.join(" | ") : "(없음)");
  const ref = parseReferenceLatLngFromEnv();
  if (ref) {
    console.log(
      "회사 기준점(.env NAVER_REFERENCE_*):",
      `위도 ${ref.lat.toFixed(5)}`,
      `경도 ${ref.lng.toFixed(5)}`,
    );
    if (query.includes("대륭") || query.includes("가산")) {
      const gasanDr19 = { lat: 37.477, lng: 126.889 };
      const toGasan = Math.round(haversineMeters(ref.lat, ref.lng, gasanDr19.lat, gasanDr19.lng));
      if (toGasan > 5000) {
        console.warn(
          `⚠ 기준점이 가산 대륭테크노타운19차(대략 37.477, 126.889)에서 약 ${(toGasan / 1000).toFixed(1)}km 떨어져 있습니다.`,
        );
        console.warn(
          "  네이버 지도에서 「대륭테크노타운19차」 건물 위치 우클릭 → 좌표를 LAT/LNG 에 넣으세요. (지금 값은 강남 쪽이면 도보 분이 수백 분처럼 나옵니다.)",
        );
      }
    }
  } else {
    console.log(
      "기준점(.env): NAVER_REFERENCE_LAT/LNG 없음 또는 범위 밖 — LAT=위도(37.x), LNG=경도(127.x)",
    );
  }

  if (items[0]) {
    const it = items[0];
    const title = String(it.title ?? "")
      .replace(/<[^>]+>/g, "")
      .trim();
    console.log("첫 건 mapx/mapy:", it.mapx ?? "(없음)", it.mapy ?? "(없음)");
    const place = parseNaverLocalMapXYToLatLng(it.mapx, it.mapy);
    if (place) {
      console.log(
        "첫 건 식당 좌표(WGS84):",
        `위도 ${place.lat.toFixed(5)}`,
        `경도 ${place.lng.toFixed(5)}`,
      );
      if (ref) {
        const { distanceMeters, walkMinutes } = await computeDistanceAndWalkFromRef(ref, place, title);
        console.log(
          "첫 건 거리·도보(계산값):",
          distanceMeters != null ? `약 ${distanceMeters}m` : "(없음)",
          walkMinutes != null ? `도보 약 ${walkMinutes}분` : "(거리 너무 멀어 walk 생략)",
        );
        console.log(
          "(TMAP_APP_KEY 가 있으면 TMAP 보행 경로, 없으면 직선 추정. 네이버 지도와 비교해 보세요.)",
        );
      }
    } else {
      console.log("첫 건 좌표 파싱 실패 — mapx/mapy 형식 확인");
    }
  }
  console.log("");
  console.log("다음 단계: .env 에 NAVER_IMPORT_QUERIES 를 적고 npm run import:naver");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
