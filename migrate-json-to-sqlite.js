const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

// ====== SESUAIKAN ======
const DB_PATH   = path.join(__dirname, "data", "hovassistant_v2.db"); // ✅ DB di folder data
const JSON_PATH = path.join(__dirname, "idcard_db.json");            // ✅ JSON kamu ini
const TABLE     = "idcards";
// ======================

if (!fs.existsSync(DB_PATH)) {
  console.error("DB tidak ditemukan:", DB_PATH);
  process.exit(1);
}
if (!fs.existsSync(JSON_PATH)) {
  console.error("idcard_db.json tidak ditemukan:", JSON_PATH);
  process.exit(1);
}

const json = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  // 1. Pastikan tabel ada (AMAN untuk DB lama)
  db.run(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      user_id TEXT PRIMARY KEY,
      name TEXT,
      gender TEXT,
      dom TEXT,
      hobi TEXT,
      status TEXT,
      theme TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      raw_json TEXT
    )
  `);

  const stmt = db.prepare(`
    INSERT INTO ${TABLE}
    (user_id, name, gender, dom, hobi, status, theme, created_at, updated_at, raw_json)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      name=excluded.name,
      gender=excluded.gender,
      dom=excluded.dom,
      hobi=excluded.hobi,
      status=excluded.status,
      theme=excluded.theme,
      updated_at=excluded.updated_at,
      raw_json=excluded.raw_json
  `);

  let count = 0;

  for (const [user_id, data] of Object.entries(json)) {
    if (!user_id || !data) continue;

    const statusRaw = String(data.status || "");
    let status = statusRaw;
    let theme = null;

    // support "status | light/dark"
    if (statusRaw.includes("|")) {
      const [s, t] = statusRaw.split("|").map(v => v.trim());
      status = s;
      theme = t?.toLowerCase() === "dark" ? "dark" : "light";
    }

    const now = Date.now();

    stmt.run([
      user_id,
      data.name || null,
      data.gender || null,
      data.dom || null,
      data.hobi || null,
      status || null,
      theme,
      data.created_at || now,
      now,
      JSON.stringify(data)
    ]);

    count++;
  }

  stmt.finalize();

  db.get(`SELECT COUNT(*) as total FROM ${TABLE}`, (_, row) => {
    console.log(`Migrasi selesai`);
    console.log(`→ Diproses : ${count}`);
    console.log(`→ Total row di ${TABLE}: ${row.total}`);
    db.close();
  });
});
