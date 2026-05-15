#!/usr/bin/env node
/**
 * 네이버 지역 검색 API만 한 번 호출해, 키·권한이 정상인지 확인합니다.
 * DB에 쓰지 않으므로 MariaDB 설정 없이도 먼저 돌려 볼 수 있습니다.
 *
 * 사용: 프로젝트 루트에 `.env` 에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 넣은 뒤
 *   npm run verify:naver
 * 선택: NAVER_VERIFY_QUERY=검색어 (기본값: 강남역 음식점)
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

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

  const query = (process.env.NAVER_VERIFY_QUERY || "강남역 음식점").trim();
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
  console.log("검색어:", query);
  console.log("총 검색 결과 수(total):", total);
  console.log("이번 요청에서 받은 샘플(최대 3곳):", titles.length ? titles.join(" | ") : "(없음)");
  console.log("");
  console.log("다음 단계: .env 에 NAVER_IMPORT_QUERIES 를 적고 npm run import:naver");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
