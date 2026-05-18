#!/usr/bin/env node
/**
 * 네이버 지역 검색 결과를 MariaDB에 넣는 CLI.
 * 화면의「주변 식당 최신화」버튼은 `POST /api/restaurants/sync-naver` 가 같은 `lib/naverImport.js` 로직을 씁니다.
 *
 * 사용 순서: `npm run verify:naver` 로 키·권한 확인 → `NAVER_IMPORT_QUERIES` 설정 → `npm run import:naver`
 *
 * [왜 이 파일이 필요한가요?]
 * - CI/스케줄러에서 `node scripts/naver-local-import.mjs` 만 돌리면 서버를 켜지 않고도 수입할 수 있습니다.
 * - CLIENT SECRET 은 **서버·스크립트 안에서만** 쓰고, 브라우저에 넣지 않습니다.
 *
 * [한 달에 한 번 자동 실행]
 * - Windows 작업 스케줄러 / Linux cron / GitHub Actions 등에서 이 파일을 호출합니다.
 */

import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const { parseQueriesFromEnv, runNaverImportForQueries } = require("../lib/naverImport.js");

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

function getDbConfig() {
  const portRaw = process.env.DB_PORT?.trim();
  const port = portRaw !== undefined && portRaw !== "" ? Number(portRaw) : 3306;
  return {
    host: process.env.DB_SERVER || process.env.DB_HOST || "127.0.0.1",
    port: Number.isNaN(port) || port <= 0 ? 3306 : port,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME || "terp_db",
    charset: "utf8mb4",
  };
}

async function main() {
  const queries = parseQueriesFromEnv();
  if (!queries.length) {
    console.error(
      "NAVER_IMPORT_QUERIES 가 비었습니다. 예: NAVER_IMPORT_QUERIES=\"역삼동 음식점,강남구 한식\"",
    );
    process.exit(1);
  }

  const pool = mysql.createPool({ ...getDbConfig(), waitForConnections: true, connectionLimit: 2 });
  try {
    for (const q of queries) {
      console.log(`… 검색어: ${q}`);
    }
    const out = await runNaverImportForQueries(pool, queries);
    console.log(JSON.stringify({ ok: true, ...out }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
