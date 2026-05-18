#!/usr/bin/env node
/**
 * TMAP 보행 경로 API 키·연결 확인 (DB 불필요).
 * 사용: .env 에 TMAP_APP_KEY, NAVER_REFERENCE_LAT/LNG 넣은 뒤 npm run verify:tmap
 */

import dotenv from "dotenv";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const { parseReferenceLatLngFromEnv } = require("../lib/naverImport.js");
const {
  parseTmapAppKeyFromEnv,
  fetchTmapPedestrianWalk,
  isTmapWalkEnabled,
} = require("../lib/tmapWalk.js");

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

async function main() {
  const key = parseTmapAppKeyFromEnv();
  if (!key) {
    console.error("TMAP_APP_KEY 가 .env 에 없습니다. https://openapi.sk.com/ 앱 키를 넣으세요.");
    process.exit(1);
  }
  if (!isTmapWalkEnabled()) {
    console.error("TMAP_USE_WALK=0 이면 비활성입니다.");
    process.exit(1);
  }

  const ref = parseReferenceLatLngFromEnv();
  if (!ref) {
    console.error("NAVER_REFERENCE_LAT, NAVER_REFERENCE_LNG (회사 출발지) 가 필요합니다.");
    process.exit(1);
  }

  const endLat = parseFloat(process.env.TMAP_VERIFY_END_LAT?.trim() ?? "");
  const endLng = parseFloat(process.env.TMAP_VERIFY_END_LNG?.trim() ?? "");
  const dest =
    Number.isFinite(endLat) && Number.isFinite(endLng)
      ? { lat: endLat, lng: endLng }
      : { lat: ref.lat + 0.002, lng: ref.lng + 0.002 };

  console.log("TMAP 보행 경로 테스트");
  console.log("출발:", ref.lat.toFixed(5), ref.lng.toFixed(5));
  console.log("도착:", dest.lat.toFixed(5), dest.lng.toFixed(5));

  const route = await fetchTmapPedestrianWalk(ref, dest, "테스트");
  console.log("OK — 거리:", route.distanceMeters, "m, 도보 약", route.walkMinutes, "분");
  console.log("다음: 주변 식당 최신화 또는 npm run recalc:naver-distances");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
