const sqlite3 = require("sqlite3").verbose();

const DB_PATH = "./data/hovassistant_v2.db";
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.get("PRAGMA journal_mode;", (e, r) => {
    console.log("journal_mode:", r ? Object.values(r)[0] : e);
  });

  db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;", (e, rows) => {
    if (e) return console.error("tables error:", e);
    console.log("tables:", rows.map(x => x.name));
    
    // optional: hitung total row per table (kalau tabelnya banyak, ini tetap aman untuk DB kecil)
    const tables = rows.map(x => x.name).filter(n => !n.startsWith("sqlite_"));
    let i = 0;

    const next = () => {
      if (i >= tables.length) return db.close(() => console.log("done"));
      const t = tables[i++];
      db.get(`SELECT COUNT(*) AS c FROM "${t}"`, (err, row) => {
        console.log(`- ${t}:`, err ? err.message : row.c);
        next();
      });
    };
    next();
  });
});
