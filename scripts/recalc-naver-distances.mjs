#!/usr/bin/env node
/**
 * `.env` 의 회사 기준점(NAVER_REFERENCE_LAT/LNG)으로 DB에 이미 있는 naver 행의
 * distance_meters·walk_minutes 만 다시 계산합니다.
 *
 * [언제 쓰나요]
 * - 기준점 좌표만 고쳤을 때 (예: 강남 127.04 → 가산 126.88)
 * - distance_meters 가 1만 m대·walk_minutes 가 비어 있을 때
 *
 * 사용: npm run recalc:naver-distances
 * (서버를 켜 둔 채로 .env 를 바꿨다면, import/sync 전에 이 스크립트를 돌리거나 서버를 재시작하세요.)
 */

import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const { recalculateNaverDistancesFromEnv } = require("../lib/naverImport.js");

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
  const pool = mysql.createPool({ ...getDbConfig(), waitForConnections: true, connectionLimit: 2 });
  try {
    const out = await recalculateNaverDistancesFromEnv(pool);
    console.log("기준점:", `위도 ${out.reference.lat}`, `경도 ${out.reference.lng}`);
    console.log(JSON.stringify({ ok: true, ...out }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
