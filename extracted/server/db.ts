import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isNeon = process.env.DATABASE_URL.includes("neon.tech") || process.env.DATABASE_URL.includes("neon.");

let db: any;
let pool: any;

if (isNeon) {
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ 
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  db = drizzleNeon(pool, { schema });
} else {
  pool = new PgPool({ 
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,        // Kill queries > 30s
  });
  db = drizzlePg(pool, { schema });
}

// Log pool errors (prevent unhandled rejections)
pool.on?.('error', (err: Error) => {
  const { logger } = require('./security-middleware');
  logger.error('[DB Pool] Connection error:', { error: err.message });
});

export { db, pool };
