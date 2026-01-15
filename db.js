// db.js
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL belum di-set di environment (Railway Variables).");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.RAILWAY_ENVIRONMENT ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menfess_posts (
      id SERIAL PRIMARY KEY,
      message_id TEXT,
      channel_id TEXT,
      created_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS menfess_anonmap (
      user_id TEXT PRIMARY KEY,
      anon_label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sorting_users (
      user_id TEXT PRIMARY KEY,
      choice TEXT NOT NULL,
      at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS idcard_users (
      user_id TEXT PRIMARY KEY,
      number TEXT,
      name TEXT,
      gender TEXT,
      domisili TEXT,
      hobi TEXT,
      status TEXT,
      theme TEXT,
      created_at BIGINT,
      updated_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS afk_users (
      user_id TEXT PRIMARY KEY,
      reason TEXT,
      since BIGINT
    );
  `);
}

module.exports = { pool, initDb };
