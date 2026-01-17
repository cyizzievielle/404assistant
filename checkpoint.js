const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./data/hovassistant_v2.db", (err) => {
  if (err) return console.error(err);
  console.log("DB opened");
});

db.serialize(() => {
  db.run("PRAGMA wal_checkpoint(FULL);", (err) => {
    if (err) console.error("Checkpoint error:", err);
    else console.log("WAL checkpoint DONE");

    db.run("PRAGMA journal_mode=DELETE;", (err) => {
      if (err) console.error("Journal mode error:", err);
      else console.log("Journal mode set to DELETE");

      db.close(() => console.log("DB closed"));
    });
  });
});
