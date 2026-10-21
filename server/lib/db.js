import mysql from "mysql2/promise";

// Two separate pools: the web database (nm_* tables, read/write) and the
// AuthMe database (read-only credentials strongly recommended).

function build(urlEnv, sslEnv, limit = 3) {
  const uri = process.env[urlEnv];
  if (!uri) return null;
  const ssl =
    process.env[sslEnv] === "true"
      ? { rejectUnauthorized: process.env[`${sslEnv}_INSECURE`] !== "true" }
      : undefined;
  const pool = mysql.createPool({
    uri,
    ssl,
    connectionLimit: limit,
    waitForConnections: true,
    queueLimit: 50,
    connectTimeout: 8000,
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: false,
    supportBigNumbers: true,
    bigNumberStrings: false,
    decimalNumbers: true,
  });
  pool.on("connection", (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  return pool;
}

let webPool = null;
let authmePool = null;

export function db() {
  if (!webPool) {
    webPool = build("DATABASE_URL", "DATABASE_SSL");
    if (!webPool) throw new Error("DATABASE_URL is not configured");
  }
  return webPool;
}

export function authmeDb() {
  if (!authmePool) authmePool = build("AUTHME_DATABASE_URL", "AUTHME_DATABASE_SSL", 2);
  return authmePool; // may be null when not configured
}

export async function closeDb() {
  const pools = [webPool, authmePool].filter(Boolean);
  webPool = null;
  authmePool = null;
  await Promise.all(pools.map((p) => p.end().catch(() => {})));
}

// Parameterised queries only. Never build SQL from user input.
export async function query(sql, params = [], conn = null) {
  const [rows] = await (conn || db()).query(sql, params);
  return rows;
}

export async function queryOne(sql, params = [], conn = null) {
  const rows = await query(sql, params, conn);
  return rows[0] || null;
}

export async function exec(sql, params = [], conn = null) {
  const [res] = await (conn || db()).query(sql, params);
  return res; // { affectedRows, insertId }
}

export async function tx(fn) {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    conn.release();
  }
}
