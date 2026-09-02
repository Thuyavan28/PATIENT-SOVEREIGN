import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import pkg from 'pg';
import { PGlite } from '@electric-sql/pglite';

dotenv.config();

const { Pool } = pkg;

let pool = null;
let pgliteInstance = null;
let isPglite = false;

const databaseUrl = process.env.DATABASE_URL?.trim();

function createPool() {
  const newPool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('neon.tech') || databaseUrl.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
    max: 5,
    min: 1,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 15000,
    allowExitOnIdle: false
  });
  newPool.on('error', (err) => {
    console.error('[DB] Pool client error (pool will self-heal):', err.message);
  });
  return newPool;
}

if (databaseUrl && databaseUrl.length > 0) {
  console.log('Using PostgreSQL connection from DATABASE_URL');
  pool = createPool();
} else {
  console.log('DATABASE_URL not provided. Using local embedded PostgreSQL (PGlite)');
  isPglite = true;
  const dataDir = path.resolve(process.cwd(), 'data', 'rxvault_db');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  pgliteInstance = new PGlite(dataDir);
}

/**
 * Execute a SQL query with parameters.
 * Returns { rows: any[], rowCount: number }
 */
export async function query(text, params = []) {
  if (isPglite) {
    const res = await pgliteInstance.query(text, params);
    return {
      rows: res.rows || [],
      rowCount: res.affectedRows !== undefined ? res.affectedRows : (res.rows?.length || 0)
    };
  } else {
    // Retry with fresh pool on transient Neon serverless connection drops
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await pool.query(text, params);
        return {
          rows: res.rows || [],
          rowCount: res.rowCount || 0
        };
      } catch (err) {
        const isTransient =
          err.code === 'ECONNRESET' ||
          err.code === 'ENOTFOUND' ||
          err.code === 'ECONNREFUSED' ||
          err.message?.includes('Connection terminated') ||
          err.message?.includes('connection timeout') ||
          err.message?.includes('connection refused') ||
          err.message?.includes('getaddrinfo');

        if (isTransient && attempt < 3) {
          const delay = attempt * 500;
          console.warn(`[DB] Transient error (attempt ${attempt}), recreating pool in ${delay}ms...`, err.message);
          try { await pool.end(); } catch (_) {}
          pool = createPool();
          await new Promise(r => setTimeout(r, delay));
        } else {
          throw err;
        }
      }
    }
  }
}

export async function closeDb() {
  if (isPglite && pgliteInstance) {
    await pgliteInstance.close();
  } else if (pool) {
    await pool.end();
  }
}
