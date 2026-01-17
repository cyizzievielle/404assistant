const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./recovery.db", (err) => {
  if (err) return console.error("open error:", err.message);
  console.log("DB opened");
});

db.serialize(() => {
  db.run("PRAGMA wal_checkpoint(FULL);", (err) => {
    if (err) console.error("checkpoint error:", err.message);
    else console.log("checkpoint OK");

    db.get("SELECT COUNT(*) AS c FROM idcard_users", (err2, row) => {
      if (err2) console.error("count error:", err2.message);
      else console.log("idcard_users =", row.c);

      db.close(() => console.log("closed"));
    });
  });
});
