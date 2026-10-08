import "server-only";
import { Pool, type QueryResultRow } from "pg";

// Neon Postgres — replaces the earlier Supabase setup. A single pooled connection
// (Neon's pooler endpoint, already reflected in DATABASE_URL) shared across requests.
let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Missing DATABASE_URL env var.");

  pool = new Pool({ connectionString });
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
