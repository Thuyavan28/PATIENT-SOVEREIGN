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

if (databaseUrl && databaseUrl.length > 0) {
  console.log('Using PostgreSQL connection from DATABASE_URL');
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('neon.tech') || databaseUrl.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined
  });
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
    const res = await pool.query(text, params);
    return {
      rows: res.rows || [],
      rowCount: res.rowCount || 0
    };
  }
}

export async function closeDb() {
  if (isPglite && pgliteInstance) {
    await pgliteInstance.close();
  } else if (pool) {
    await pool.end();
  }
}
