/**
 * migrate-json-to-sqlite.js
 * Migrasi data dari JSON lama -> SQLite (better-sqlite3)
 *
 * Cara pakai:
 *   node migrate-json-to-sqlite.js
 *
 * Syarat:
 *   npm i better-sqlite3
 *
 * File JSON yang dibaca (kalau ada):
 *   ./idcard_db.json
 *   ./menfess_db.json
 *   ./sorting_db.json
 *   ./afk_db.json
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function readJsonSafe(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[ERR] gagal baca ${file}:`, e.message);
    return null;
  }
}

// === DB PATH: samain dengan db.js kamu ===
// Railway: /app/data (volume). Lokal: ./data
const DATA_DIR = process.env.RAILWAY_ENVIRONMENT ? "/app/data" : path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "hovassistant.db");

// backup db dulu (kalau sudah ada)
if (fs.existsSync(DB_PATH)) {
  const backup = path.join(DATA_DIR, `hovassistant.backup.${Date.now()}.db`);
  fs.copyFileSync(DB_PATH, backup);
  console.log(`[OK] backup DB dibuat: ${backup}`);
}

const db = new Database(DB_PATH);

// pastikan tabel ada (copy dari db.js kamu)
db.exec(`
CREATE TABLE IF NOT EXISTS menfess_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  messageId TEXT,
  channelId TEXT,
  createdAt INTEGER
);

CREATE TABLE IF NOT EXISTS menfess_anonmap (
  userId TEXT PRIMARY KEY,
  anonLabel TEXT
);

CREATE TABLE IF NOT EXISTS sorting_users (
  userId TEXT PRIMARY KEY,
  choice TEXT,
  at INTEGER
);

CREATE TABLE IF NOT EXISTS idcard_users (
  userId TEXT PRIMARY KEY,
  number TEXT,
  name TEXT,
  gender TEXT,
  domisili TEXT,
  hobi TEXT,
  status TEXT,
  theme TEXT,
  createdAt INTEGER,
  updatedAt INTEGER
);

CREATE TABLE IF NOT EXISTS afk_users (
  userId TEXT PRIMARY KEY,
  reason TEXT,
  since INTEGER
);
`);

const ROOT = __dirname;
const files = {
  idcard: path.join(ROOT, "idcard_db.json"),
  menfess: path.join(ROOT, "menfess_db.json"),
  sorting: path.join(ROOT, "sorting_db.json"),
  afk: path.join(ROOT, "afk_db.json"),
};

const idcardDb = readJsonSafe(files.idcard);
const menfessDb = readJsonSafe(files.menfess);
const sortingDb = readJsonSafe(files.sorting);
const afkDb = readJsonSafe(files.afk);

// prepared statements
const upsertIdcard = db.prepare(`
  INSERT INTO idcard_users (userId, number, name, gender, domisili, hobi, status, theme, createdAt, updatedAt)
  VALUES (@userId, @number, @name, @gender, @domisili, @hobi, @status, @theme, @createdAt, @updatedAt)
  ON CONFLICT(userId) DO UPDATE SET
    number=excluded.number,
    name=excluded.name,
    gender=excluded.gender,
    domisili=excluded.domisili,
    hobi=excluded.hobi,
    status=excluded.status,
    theme=excluded.theme,
    createdAt=excluded.createdAt,
    updatedAt=excluded.updatedAt
`);

const upsertSorting = db.prepare(`
  INSERT INTO sorting_users (userId, choice, at)
  VALUES (@userId, @choice, @at)
  ON CONFLICT(userId) DO UPDATE SET
    choice=excluded.choice,
    at=excluded.at
`);

const upsertAfk = db.prepare(`
  INSERT INTO afk_users (userId, reason, since)
  VALUES (@userId, @reason, @since)
  ON CONFLICT(userId) DO UPDATE SET
    reason=excluded.reason,
    since=excluded.since
`);

const upsertAnon = db.prepare(`
  INSERT INTO menfess_anonmap (userId, anonLabel)
  VALUES (@userId, @anonLabel)
  ON CONFLICT(userId) DO UPDATE SET
    anonLabel=excluded.anonLabel
`);

const insertMenfessPostWithId = db.prepare(`
  INSERT INTO menfess_posts (id, messageId, channelId, createdAt)
  VALUES (@id, @messageId, @channelId, @createdAt)
  ON CONFLICT(id) DO UPDATE SET
    messageId=excluded.messageId,
    channelId=excluded.channelId,
    createdAt=excluded.createdAt
`);

const countRow = (table) => db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;

const tx = db.transaction(() => {
  let migrated = {
    idcard_users: 0,
    sorting_users: 0,
    afk_users: 0,
    menfess_anonmap: 0,
    menfess_posts: 0,
  };

  // ID CARD
  if (idcardDb?.users && typeof idcardDb.users === "object") {
    for (const [userId, u] of Object.entries(idcardDb.users)) {
      if (!userId) continue;
      upsertIdcard.run({
        userId: String(userId),
        number: u?.number ? String(u.number) : null,
        name: u?.name ? String(u.name) : null,
        gender: u?.gender ? String(u.gender) : null,
        domisili: u?.domisili ? String(u.domisili) : null,
        hobi: u?.hobi ? String(u.hobi) : null,
        status: u?.status ? String(u.status) : null,
        theme: u?.theme ? String(u.theme) : "light",
        createdAt: Number(u?.createdAt || 0),
        updatedAt: Number(u?.updatedAt || 0),
      });
      migrated.idcard_users++;
    }
  }

  // SORTING
  const sUsers = sortingDb?.users || sortingDb?.users?.users; // jaga-jaga struktur dobel
  if (sortingDb?.users && typeof sortingDb.users === "object") {
    for (const [userId, s] of Object.entries(sortingDb.users)) {
      if (!userId) continue;
      upsertSorting.run({
        userId: String(userId),
        choice: s?.choice ? String(s.choice) : null,
        at: Number(s?.at || 0),
      });
      migrated.sorting_users++;
    }
  } else if (sUsers && typeof sUsers === "object") {
    for (const [userId, s] of Object.entries(sUsers)) {
      if (!userId) continue;
      upsertSorting.run({
        userId: String(userId),
        choice: s?.choice ? String(s.choice) : null,
        at: Number(s?.at || 0),
      });
      migrated.sorting_users++;
    }
  }

  // AFK
  if (afkDb?.users && typeof afkDb.users === "object") {
    for (const [userId, a] of Object.entries(afkDb.users)) {
      if (!userId) continue;
      upsertAfk.run({
        userId: String(userId),
        reason: a?.reason ? String(a.reason) : "AFK",
        since: Number(a?.since || 0),
      });
      migrated.afk_users++;
    }
  }

  // MENFESS anonMap
  if (menfessDb?.anonMap && typeof menfessDb.anonMap === "object") {
    for (const [userId, anonLabel] of Object.entries(menfessDb.anonMap)) {
      if (!userId) continue;
      upsertAnon.run({
        userId: String(userId),
        anonLabel: anonLabel ? String(anonLabel) : null,
      });
      migrated.menfess_anonmap++;
    }
  }

  // MENFESS posts: { "1": {messageId, channelId}, "2": {...} }
  if (menfessDb?.posts && typeof menfessDb.posts === "object") {
    for (const [idStr, p] of Object.entries(menfessDb.posts)) {
      const id = Number(idStr);
      if (!Number.isFinite(id)) continue;
      insertMenfessPostWithId.run({
        id,
        messageId: p?.messageId ? String(p.messageId) : null,
        channelId: p?.channelId ? String(p.channelId) : null,
        createdAt: Number(p?.createdAt || 0),
      });
      migrated.menfess_posts++;
    }
  }

  return migrated;
});

const before = {
  idcard_users: countRow("idcard_users"),
  sorting_users: countRow("sorting_users"),
  afk_users: countRow("afk_users"),
  menfess_anonmap: countRow("menfess_anonmap"),
  menfess_posts: countRow("menfess_posts"),
};

console.log("[INFO] Row count sebelum:", before);

const migrated = tx();

const after = {
  idcard_users: countRow("idcard_users"),
  sorting_users: countRow("sorting_users"),
  afk_users: countRow("afk_users"),
  menfess_anonmap: countRow("menfess_anonmap"),
  menfess_posts: countRow("menfess_posts"),
};

console.log("[OK] Migrasi selesai. Insert/Upsert:", migrated);
console.log("[INFO] Row count sesudah:", after);
console.log(`[OK] DB: ${DB_PATH}`);
