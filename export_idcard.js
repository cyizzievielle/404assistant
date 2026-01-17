const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./data/hovassistant_v2.db");

db.all("SELECT * FROM idcard_users", (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log(JSON.stringify(rows, null, 2));
  }
  db.close();
});
