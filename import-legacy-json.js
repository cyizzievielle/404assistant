/**
 * import-legacy-json.js — Import legacy JSON backups into SQLite for HOV Assistant
 *
 * Usage:
 *   node import-legacy-json.js --db ./data/hovassistant_v2.db --sorting ./sorting_db.json --menfess ./menfess_db.json --idcard ./idcard_db.json
 *
 * If --db not provided, uses env SQLITE_PATH or ./data/hovassistant.db
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

const DB_PATH = (argValue("--db") || process.env.SQLITE_PATH || "./data/hovassistant.db").trim();
const SORTING_JSON = argValue("--sorting");
const MENFESS_JSON = argValue("--menfess");
const IDCARD_JSON = argValue("--idcard");

function mustExist(p, label) {
  if (!p) return;
  if (!fs.existsSync(p)) {
    console.error(`❌ File not found for ${label}:`, p);
    process.exit(1);
  }
}

mustExist(SORTING_JSON, "sorting");
mustExist(MENFESS_JSON, "menfess");
mustExist(IDCARD_JSON, "idcard");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS menfess_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT,
      channel_id TEXT,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS menfess_anonmap (
      user_id TEXT PRIMARY KEY,
      anon_label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sorting_users (
      user_id TEXT PRIMARY KEY,
      choice TEXT NOT NULL,
      at INTEGER NOT NULL
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
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS afk_users (
      user_id TEXT PRIMARY KEY,
      reason TEXT,
      since INTEGER
    );
  `);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function asText(v) {
  if (v === undefined || v === null) return null;
  return String(v);
}
function asInt(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function importSorting(jsonPath) {
  if (!jsonPath) return { ok: 0, skip: 0 };

  const data = readJson(jsonPath);
  const users = data?.users || {};
  const entries = Object.entries(users);

  const stmt = db.prepare(`
    INSERT INTO sorting_users (user_id, choice, at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET choice=excluded.choice, at=excluded.at
  `);

  let ok = 0, skip = 0;
  const tx = db.transaction(() => {
    for (const [userId, v] of entries) {
      const choice = (v?.choice || "").toLowerCase();
      const at = asInt(v?.at, Date.now());
      if (!userId || (choice !== "light" && choice !== "dark")) { skip++; continue; }
      try {
        stmt.run(asText(userId), choice, at);
        ok++;
      } catch {
        skip++;
      }
    }
  });
  tx();

  console.log(`[sorting_users] imported=${ok} skipped=${skip} from ${path.basename(jsonPath)}`);
  return { ok, skip };
}

function importMenfess(jsonPath) {
  if (!jsonPath) return { postsOk: 0, postsSkip: 0, anonOk: 0, anonSkip: 0 };

  const data = readJson(jsonPath);

  // anonMap: { "userId": "Anon #001", ... }
  const anonMap = data?.anonMap || {};
  const anonEntries = Object.entries(anonMap);

  const anonStmt = db.prepare(`
    INSERT INTO menfess_anonmap (user_id, anon_label)
    VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET anon_label=excluded.anon_label
  `);

  let anonOk = 0, anonSkip = 0;
  const txAnon = db.transaction(() => {
    for (const [userId, label] of anonEntries) {
      if (!userId || !label) { anonSkip++; continue; }
      try {
        anonStmt.run(asText(userId), asText(label));
        anonOk++;
      } catch {
        anonSkip++;
      }
    }
  });
  txAnon();

  // posts: { "1": {messageId, channelId}, "2": {...}, ... }
  const posts = data?.posts || {};
  const postEntries = Object.entries(posts);

  // preserve numeric id from key "1","2",... (ini penting biar reply menfess #id konsisten)
  const postStmt = db.prepare(`
    INSERT INTO menfess_posts (id, message_id, channel_id, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      message_id=excluded.message_id,
      channel_id=excluded.channel_id,
      created_at=excluded.created_at
  `);

  let postsOk = 0, postsSkip = 0;
  const txPosts = db.transaction(() => {
    for (const [idStr, p] of postEntries) {
      const id = asInt(idStr, null);
      const messageId = asText(p?.messageId);
      const channelId = asText(p?.channelId);
      if (!id || !messageId || !channelId) { postsSkip++; continue; }

      // JSON kamu nggak simpan createdAt, jadi kita isi 0 (atau Date.now)
      // 0 = gampang dibedain kalau nanti mau update.
      const createdAt = 0;

      try {
        postStmt.run(id, messageId, channelId, createdAt);
        postsOk++;
      } catch {
        postsSkip++;
      }
    }
  });
  txPosts();

  console.log(`[menfess_anonmap] imported=${anonOk} skipped=${anonSkip} from ${path.basename(jsonPath)}`);
  console.log(`[menfess_posts] imported=${postsOk} skipped=${postsSkip} from ${path.basename(jsonPath)}`);

  return { postsOk, postsSkip, anonOk, anonSkip };
}

function importIdCards(jsonPath) {
  if (!jsonPath) return { ok: 0, skip: 0 };

  const data = readJson(jsonPath);
  const users = data?.users || {};
  const entries = Object.entries(users);

  const stmt = db.prepare(`
    INSERT INTO idcard_users (user_id, number, name, gender, domisili, hobi, status, theme, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      number=excluded.number,
      name=excluded.name,
      gender=excluded.gender,
      domisili=excluded.domisili,
      hobi=excluded.hobi,
      status=excluded.status,
      theme=excluded.theme,
      created_at=excluded.created_at,
      updated_at=excluded.updated_at
  `);

  let ok = 0, skip = 0;
  const tx = db.transaction(() => {
    for (const [userId, v] of entries) {
      if (!userId || !v) { skip++; continue; }

      const number = asText(v.number);
      const createdAt = asInt(v.createdAt, Date.now());
      const updatedAt = asInt(v.updatedAt, createdAt);

      const name = asText(v.name);
      const gender = asText(v.gender);
      const domisili = asText(v.domisili);
      const hobi = asText(v.hobi);
      const status = asText(v.status);

      let theme = (asText(v.theme) || "light").toLowerCase();
      theme = theme === "dark" ? "dark" : "light";

      try {
        stmt.run(
          asText(userId),
          number,
          name,
          gender,
          domisili,
          hobi,
          status,
          theme,
          createdAt,
          updatedAt
        );
        ok++;
      } catch {
        skip++;
      }
    }
  });
  tx();

  console.log(`[idcard_users] imported=${ok} skipped=${skip} from ${path.basename(jsonPath)}`);
  return { ok, skip };
}

function main() {
  initSchema();

  console.log("DB:", DB_PATH);
  console.log("Inputs:", {
    sorting: SORTING_JSON || null,
    menfess: MENFESS_JSON || null,
    idcard: IDCARD_JSON || null,
  });

  if (!SORTING_JSON && !MENFESS_JSON && !IDCARD_JSON) {
    console.log("⚠️ No input files provided. Nothing to import.");
    process.exit(0);
  }

  if (IDCARD_JSON) importIdCards(IDCARD_JSON);
  if (SORTING_JSON) importSorting(SORTING_JSON);
  if (MENFESS_JSON) importMenfess(MENFESS_JSON);

  console.log("✅ Import finished.");
  db.close();
}

main();
