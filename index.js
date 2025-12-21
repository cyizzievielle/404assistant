/**
 * index.js — HOV Assistant
 * (Welcome + Menfess + HOV Identity Card + Registry + AFK + Avatar + Sorting (IDCard-required) + HouseCard + /myhouse)
 * discord.js v14
 * npm i discord.js dotenv canvas
 *
 * .env wajib:
 * DISCORD_TOKEN=xxxxx
 * GENERAL_CHANNEL_ID=xxxxx
 * MENFESS_CHANNEL_ID=xxxxx
 * CLIENT_ID=xxxxx
 * GUILD_ID=xxxxx
 *
 * optional:
 * MENFESS_COOLDOWN_SEC=60
 *
 * Sorting + HouseCard:
 * LIGHT_ROLE_ID=xxxxx
 * DARK_ROLE_ID=xxxxx
 * SORTING_CHANNEL_ID=xxxxx
 * HOUSECARD_CHANNEL_ID=xxxxx
 * IDCARD_CHANNEL_ID=xxxxx
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  Events,
  PermissionsBitField,
  ActivityType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
} = require("discord.js");

const { createCanvas, loadImage, registerFont } = require("canvas");

// ===================== CONFIG =====================
const BRAND_NAME = "HOV Assistant";
const ID_CARD_TITLE = "HOV IDENTITY CARD";
const EMBED_COLOR = 0x77d0d7;

// Font (optional)
const FONT_REG = path.join(__dirname, "assets", "fonts", "Inter-Regular.ttf");
const FONT_BOLD = path.join(__dirname, "assets", "fonts", "Inter-Bold.ttf");

(function registerFontsSafe() {
  try {
    if (fs.existsSync(FONT_REG)) registerFont(FONT_REG, { family: "Inter", weight: "normal" });
    if (fs.existsSync(FONT_BOLD)) registerFont(FONT_BOLD, { family: "Inter", weight: "bold" });
    console.log("[FONT] Loaded Inter fonts.");
  } catch (e) {
    console.warn("[FONT] Failed to register fonts, fallback to system fonts.", e?.message || e);
  }
})();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// anti-crash
process.on("unhandledRejection", (reason) => console.error("[unhandledRejection]", reason));
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));
client.on("error", (err) => console.error("[client error]", err));

// ===================== UTILS =====================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getChannelById(guild, id) {
  if (!guild || !id) return null;

  let ch = guild.channels.cache.get(id) || null;
  if (!ch) {
    try {
      ch = await guild.channels.fetch(id);
    } catch {
      return null;
    }
  }

  if (!ch) return null;
  if (!ch.isTextBased()) return null;
  return ch;
}

function safeText(s, max = 32) {
  return String(s || "")
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .slice(0, max);
}

function requireEnv(name) {
  const v = process.env[name];
  return v && String(v).trim().length ? String(v).trim() : null;
}

// ===================== WELCOME =====================
const WELCOME_MESSAGES = [
  (m, g) => `✨ gerbang berpendar pelan… ${m} kini terdaftar di ${g}. selamat datang dan semoga betah. 🌙`,
  (m, g) => `🔮 sebuah nama baru tertulis di arsip. selamat datang ${m} di ${g}. jangan ragu menyapa ya. ✨`,
  (m, g) => `🕯️ cahaya lilin menyambut langkahmu, ${m}. selamat datang di ${g}. semoga harimu hangat. 🌿`,
  (m, g) => `🌌 angin malam membawa kabar: ${m} tiba di ${g}. jelajahi realm ini dengan tenang. ✨`,
  (m, g) => `🌙 takdir mempertemukan kita. selamat datang ${m} di ${g}. semoga menemukan teman dan cerita. 🔮`,
  (m, g) => `✨ gerbang terbuka. ${m} masuk ke ${g}. baca aturan dulu, lalu mari bersenang-senang. 🕯️`,
  (m, g) => `🪄 sihir kecil menyapa: halo ${m}! selamat datang di ${g}. semoga nyaman di sini. 🌙`,
  (m, g) => `🌠 bintang mencatat kedatanganmu. ${m}, selamat datang di ${g}. ayo kenalan pelan-pelan. ✨`,
  (m, g) => `🔮 aura baru terdeteksi… ${m} telah tiba di ${g}. semoga harimu penuh hal baik. 🌿`,
  (m, g) => `🕯️ langkahmu resmi di realm ini, ${m}. selamat datang di ${g}. nikmati setiap percakapan. ✨`,
  (m, g) => `🌌 pintu dimensi terbuka—${m} mendarat di ${g}. jangan sungkan untuk gabung obrolan. 🌙`,
  (m, g) => `✨ halo ${m}! selamat datang di ${g}. kalau bingung mulai dari mana, ketik /halo ya. 🔮`,
  (m, g) => `🌙 sebuah jiwa baru bergabung: ${m}. selamat datang di ${g}. semoga betah dan aman. 🕯️`,
  (m, g) => `🔮 arsip diperbarui. ${m}, selamat datang di ${g}. semoga menemukan tempatmu di sini. ✨`,
  (m, g) => `🌿 selamat datang ${m} di ${g}. di sini kita ngobrol santai, tapi tetap sopan ya. 🕯️`,
];

// ===================== MENFESS DB =====================
const menfessCooldown = new Map();
const MENFESS_DB_PATH = path.join(__dirname, "menfess_db.json");

function loadMenfessDB() {
  try {
    return JSON.parse(fs.readFileSync(MENFESS_DB_PATH, "utf8"));
  } catch {
    return { lastId: 0, posts: {}, anonMap: {} };
  }
}
function saveMenfessDB(db) {
  fs.writeFileSync(MENFESS_DB_PATH, JSON.stringify(db, null, 2), "utf8");
}
function getAnonLabel(db, userId) {
  if (!db.anonMap[userId]) {
    const n = Object.keys(db.anonMap).length + 1;
    db.anonMap[userId] = `Anon #${String(n).padStart(3, "0")}`;
  }
  return db.anonMap[userId];
}
function isBadAlias(alias) {
  if (/[<@#>]/.test(alias)) return true;
  const low = alias.toLowerCase();
  const blocked = ["admin", "owner", "mod", "moderator", "staff"];
  return blocked.some((w) => low.includes(w));
}

// ===================== ID CARD DB =====================
const IDCARD_DB_PATH = path.join(__dirname, "idcard_db.json");

function loadIdDB() {
  try {
    return JSON.parse(fs.readFileSync(IDCARD_DB_PATH, "utf8"));
  } catch {
    return { users: {} };
  }
}
function saveIdDB(db) {
  fs.writeFileSync(IDCARD_DB_PATH, JSON.stringify(db, null, 2), "utf8");
}
function genCardNumber(userId) {
  const raw = `${userId}${Date.now()}`.replace(/\D/g, "");
  return raw.slice(-16).padStart(16, "0");
}

// ===================== AFK DB =====================
const AFK_DB_PATH = path.join(__dirname, "afk_db.json");

function loadAfkDB() {
  try {
    return JSON.parse(fs.readFileSync(AFK_DB_PATH, "utf8"));
  } catch {
    return { users: {} };
  }
}
function saveAfkDB(db) {
  fs.writeFileSync(AFK_DB_PATH, JSON.stringify(db, null, 2), "utf8");
}
function setAfk(userId, reason) {
  const db = loadAfkDB();
  db.users[userId] = { reason: safeText(reason || "AFK", 80), since: Date.now() };
  saveAfkDB(db);
}
function clearAfk(userId) {
  const db = loadAfkDB();
  if (db.users[userId]) {
    delete db.users[userId];
    saveAfkDB(db);
    return true;
  }
  return false;
}
function getAfk(userId) {
  const db = loadAfkDB();
  return db.users[userId] || null;
}

// ===================== SORTING DB (LOCK) =====================
const SORTING_DB_PATH = path.join(__dirname, "sorting_db.json");

function loadSortingDB() {
  try {
    return JSON.parse(fs.readFileSync(SORTING_DB_PATH, "utf8"));
  } catch {
    return { users: {} };
  }
}
function saveSortingDB(db) {
  fs.writeFileSync(SORTING_DB_PATH, JSON.stringify(db, null, 2), "utf8");
}
function getSortedUser(userId) {
  const db = loadSortingDB();
  return db.users[userId] || null; // { choice: "light"|"dark", at: number }
}
function setSortedUser(userId, choice) {
  const db = loadSortingDB();
  db.users[userId] = { choice, at: Date.now() };
  saveSortingDB(db);
}

// ===================== CANVAS HELPERS =====================
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawParticles(ctx, area, mode = "light") {
  const { x, y, w, h } = area;
  for (let i = 0; i < 28; i++) {
    const px = x + Math.random() * w;
    const py = y + Math.random() * h;
    const r = 1 + Math.random() * 3;
    ctx.globalAlpha = mode === "dark" ? 0.22 : 0.18;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = mode === "dark" ? "rgba(200,160,255,1)" : "rgba(255,240,180,1)";
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ===================== ID CARD RENDER (+ badge arcana) =====================
async function renderIdCard({ theme, number, name, gender, domisili, hobi, status, avatarUrl, createdAtText, arcanaChoice }) {
  const w = 980;
  const h = 560;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");

  const isDark = theme === "dark";

  const bg1 = isDark ? "#070610" : "#faf7ff";
  const bg2 = isDark ? "#1a0f2f" : "#ffeefe";
  const ink = isDark ? "#f5efff" : "#15101f";
  const subInk = isDark ? "#cab8ff" : "#3a2c54";
  const line = isDark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.10)";
  const accent = isDark ? "#a78bfa" : "#8b5cf6";

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, bg1);
  grad.addColorStop(1, bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.28;
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  glow(170, 120, 220, "#a78bfa");
  glow(830, 120, 240, "#22d3ee");
  glow(780, 470, 270, "#fb7185");
  ctx.globalAlpha = 1;

  const pad = 34;
  const x = pad, y = pad, cw = w - pad * 2, ch = h - pad * 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = isDark ? "rgba(12,10,24,.78)" : "rgba(255,255,255,.82)";
  rr(ctx, x, y, cw, ch, 22);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  rr(ctx, x, y, cw, ch, 22);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = ink;
  ctx.font = "bold 46px Inter, Arial";
  ctx.fillText("HOV IDENTITY CARD", x + 34, y + 82);

  ctx.fillStyle = subInk;
  ctx.font = "600 20px Inter, Arial";
  ctx.fillText("House of Valerie • Verified in the arcane", x + 36, y + 114);

  if (arcanaChoice === "light" || arcanaChoice === "dark") {
    const bx = x + cw - 250;
    const by = y + 48;
    const bw = 210;
    const bh = 38;

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = arcanaChoice === "dark" ? "rgba(20,14,40,.65)" : "rgba(255,255,255,.65)";
    rr(ctx, bx, by, bw, bh, 14);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    rr(ctx, bx, by, bw, bh, 14);
    ctx.stroke();

    ctx.fillStyle = ink;
    ctx.font = "700 16px Inter, Arial";
    const label = arcanaChoice === "dark" ? "🌙 DARK ARCANA" : "✨ LIGHT ARCANA";
    ctx.fillText(label, bx + 16, by + 24);
  }

  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 34, y + 134);
  ctx.lineTo(x + cw - 34, y + 134);
  ctx.stroke();

  const lx = x + 44;
  const topListY = y + 190;
  const rowGap = 46;

  const drawRow = (label, value, i) => {
    const yy = topListY + i * rowGap;
    ctx.fillStyle = subInk;
    ctx.font = "700 18px Inter, Arial";
    ctx.fillText(label, lx, yy);

    ctx.fillStyle = ink;
    ctx.font = "700 22px Inter, Arial";
    ctx.fillText(value, lx + 210, yy);
  };

  drawRow("No ID", number, 0);
  drawRow("Nama", name, 1);
  drawRow("Gender", gender, 2);
  drawRow("Domisili", domisili, 3);
  drawRow("Hobi", hobi, 4);
  drawRow("Status", status, 5);

  ctx.fillStyle = subInk;
  ctx.font = "600 16px Inter, Arial";
  ctx.fillText(`© HOV • ${BRAND_NAME}`, x + 36, y + ch - 28);

  const px = x + cw - 320;
  const py = y + 170;
  const pw = 250;
  const ph = 250;

  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  rr(ctx, px, py, pw, ph, 16);
  ctx.stroke();

  try {
    const img = await loadImage(avatarUrl);
    ctx.save();
    rr(ctx, px + 10, py + 10, pw - 20, ph - 20, 14);
    ctx.clip();
    ctx.drawImage(img, px + 10, py + 10, pw - 20, ph - 20);
    ctx.restore();
  } catch {
    ctx.fillStyle = line;
    rr(ctx, px + 10, py + 10, pw - 20, ph - 20, 14);
    ctx.fill();
  }

  const cx = px + pw / 2;
  const dateTop = py + ph + 18;

  ctx.textAlign = "center";
  ctx.fillStyle = subInk;
  ctx.font = "700 16px Inter, Arial";
  ctx.fillText("Tanggal Dibuat", cx, dateTop);

  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px + 28, dateTop + 12);
  ctx.lineTo(px + pw - 28, dateTop + 12);
  ctx.stroke();

  ctx.fillStyle = ink;
  ctx.font = "700 20px Inter, Arial";
  ctx.fillText(createdAtText, cx, dateTop + 38);

  ctx.textAlign = "left";
  return canvas.toBuffer("image/png");
}

// ===================== HOUSE CARD RENDER (avatar di samping) =====================
async function renderHouseCard({ choice, name, gender, hovId, avatarUrl }) {
  const w = 980;
  const h = 360;

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");

  const isDark = choice === "dark";

  // palettes
  const bgA = isDark ? "#0b0716" : "#ffffff";
  const bgB = isDark ? "#14102a" : "#cfefff";
  const bgC = isDark ? "#071a2f" : "#fff2b8";

  const ink = isDark ? "#f4eeff" : "#17131f";
  const subInk = isDark ? "rgba(220,200,255,.82)" : "rgba(35,32,44,.72)";
  const line = isDark ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.10)";

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, bgA);
  grad.addColorStop(0.55, bgB);
  grad.addColorStop(1, bgC);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = isDark ? 0.33 : 0.25;
  const orb = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  if (isDark) {
    orb(180, 120, 190, "#a78bfa");
    orb(760, 110, 210, "#1e3a8a");
    orb(820, 300, 240, "#0f172a");
  } else {
    orb(160, 90, 190, "#fff3b0");
    orb(760, 110, 210, "#93c5fd");
    orb(820, 300, 240, "#fde68a");
  }
  ctx.globalAlpha = 1;

  drawParticles(ctx, { x: 0, y: 0, w, h }, isDark ? "dark" : "light");

  const pad = 26;
  const x = pad, y = pad, cw = w - pad * 2, ch = h - pad * 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = isDark ? "rgba(10,8,22,.72)" : "rgba(255,255,255,.78)";
  rr(ctx, x, y, cw, ch, 24);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  rr(ctx, x, y, cw, ch, 24);
  ctx.stroke();

  ctx.fillStyle = ink;
  ctx.font = "bold 34px Inter, Arial";
  ctx.fillText("HOUSE OF VALERIE", x + 34, y + 64);

  ctx.fillStyle = subInk;
  ctx.font = "700 20px Inter, Arial";
  ctx.fillText(isDark ? "DARK ARCANA" : "LIGHT ARCANA", x + 34, y + 98);

  const lx = x + 34;
  const top = y + 150;
  const gap = 44;

  const row = (label, value, idx) => {
    const yy = top + idx * gap;
    ctx.fillStyle = subInk;
    ctx.font = "700 18px Inter, Arial";
    ctx.fillText(label, lx, yy);

    ctx.fillStyle = ink;
    ctx.font = "700 22px Inter, Arial";
    ctx.fillText(value, lx + 160, yy);
  };

  row("Nama", safeText(name, 26), 0);
  row("Gender", safeText(gender, 10), 1);
  row("HOV ID", safeText(hovId, 24), 2);

  // avatar right (bulat, samping)
  const avSize = 190;
  const avX = x + cw - avSize - 44;
  const avY = y + 96;

  ctx.save();
  ctx.globalAlpha = 0.9;
  const ring = ctx.createRadialGradient(
    avX + avSize / 2,
    avY + avSize / 2,
    avSize / 5,
    avX + avSize / 2,
    avY + avSize / 2,
    avSize / 1.05
  );
  if (isDark) {
    ring.addColorStop(0, "rgba(167,139,250,.55)");
    ring.addColorStop(1, "rgba(15,23,42,0)");
  } else {
    ring.addColorStop(0, "rgba(255,242,184,.55)");
    ring.addColorStop(1, "rgba(147,197,253,0)");
  }
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 1.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  try {
    const img = await loadImage(avatarUrl);
    ctx.drawImage(img, avX, avY, avSize, avSize);
  } catch {
    ctx.fillStyle = line;
    ctx.fillRect(avX, avY, avSize, avSize);
  }
  ctx.restore();

  ctx.fillStyle = subInk;
  ctx.font = "600 16px Inter, Arial";
  ctx.fillText(isDark ? "“Bearer of the Shadow”" : "“Bearer of the Light”", x + 34, y + ch - 28);

  return canvas.toBuffer("image/png");
}

// ===================== REGISTRY HELPERS =====================
function buildRegistryPages(guild, idDb) {
  const users = idDb?.users || {};
  const list = Object.entries(users)
    .map(([uid, data]) => ({
      uid,
      name: data?.name || "—",
      createdAt: data?.createdAt || 0,
      inGuild: Boolean(guild?.members?.cache?.has(uid)),
    }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const pageSize = 10;
  const pages = [];
  for (let i = 0; i < list.length; i += pageSize) pages.push(list.slice(i, i + pageSize));
  return pages.length ? pages : [[]];
}

function registryEmbed(guild, pages, pageIndex) {
  const page = pages[pageIndex] || [];
  const totalPages = pages.length;
  const totalUsers = pages.flat().length;

  const desc =
    page.length === 0
      ? "Belum ada warga yang terdaftar ID Card."
      : page
          .map((x, idx) => {
            const num = pageIndex * 10 + idx + 1;
            const dateUnix = x.createdAt ? Math.floor(x.createdAt / 1000) : null;
            const dateText = dateUnix ? `<t:${dateUnix}:D>` : "—";
            const status = x.inGuild ? "" : " *(left)*";
            return `**${num}.** <@${x.uid}> • **${safeText(x.name, 24)}** • ${dateText}${status}`;
          })
          .join("\n");

  return new EmbedBuilder()
    .setTitle("🗂️ HOV Registry — Warga Terdaftar")
    .setDescription(desc)
    .setColor(EMBED_COLOR)
    .setFooter({ text: `Page ${pageIndex + 1} / ${totalPages} • Total: ${totalUsers}` })
    .setTimestamp();
}

function registryRow(pageIndex, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`registry:prev:${pageIndex}`)
      .setLabel("Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex <= 0),
    new ButtonBuilder()
      .setCustomId(`registry:next:${pageIndex}`)
      .setLabel("Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex >= totalPages - 1)
  );
}

// ===================== SORTING UI =====================
function sortingPanelEmbed() {
  return new EmbedBuilder()
    .setTitle("<:witch:1452256560108666977> Arcane Sorting — House of Valerie")
    .setColor(EMBED_COLOR)
    .setDescription(
      [
        "**When the veil thins, destiny answers.**",
        "",
        "Lingkaran arcane kembali aktif, memanggil setiap jiwa yang melangkah ke dalam wilayah **House of Valerie**.",
        "Dengan menyentuh segel di bawah, kau akan memasuki **Ritual Pemilahan Arcana**—hukum kuno yang menentukan afiliasimu.",
        "",
        "✧ Arcana akan membaca gema jiwamu dan menetapkan satu jalan:",
        "<:light:1452229058841542748> **Light Arcana** — cahaya, tatanan, dan penjaga keseimbangan kerajaan",
        "<:dark:1452229004663849052> **Dark Arcana** — bayangan, kehendak bebas, dan kekuatan tersembunyi",
        "",
        "╭──────────────────────────╮",
        "📜 **Prasyarat Ritual**",
        "Hanya mereka yang telah memiliki **Valerie ID Card**",
        "(dengan mantra **/idcard**)",
        "yang diizinkan memasuki lingkaran ini.",
        "",
        "<:segelsihir:1452256773846335579> **Segel Takdir**",
        "Ritual ini hanya dapat dijalankan **satu kali**.",
        "Setelah arcana memilih, hasilnya akan terkunci selamanya.",
        "",
        "<:hukum:1452256507314835590> **Hukum Kerajaan Valerie**",
        "Seluruh peran lain yang telah kau miliki",
        "akan tetap utuh dan tidak terpengaruh oleh ritual ini.",
        "╰──────────────────────────╯",
        "",
        "Kini, berdirilah di dalam lingkaran.",
        "**Takdir tidak menunggu mereka yang ragu.**",
      ].join("\n")
    );
}

function sortingPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("sorting:roll")
      .setLabel("Mulai Ritual")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("<:witch:1452256560108666977>")
  );
}

// ===================== READY / PRESENCE =====================
client.once(Events.ClientReady, (c) => {
  console.log(`ONLINE AS: ${c.user.tag} | ID: ${c.user.id}`);

  const statuses = ["🌙 menjaga gerbang realm", "🔮 merapalkan pesan welcome", "🕯️ menemani kalian ngobrol", "✨ ketik /halo untuk menyapa"];
  let i = 0;

  const setStatus = () => {
    const text = statuses[i % statuses.length];
    c.user.setPresence({
      status: "online",
      activities: [{ name: text, type: ActivityType.Playing }],
    });
    i++;
  };

  setStatus();
  setInterval(setStatus, 30_000);
});

// ===================== AUTO WELCOME =====================
client.on(Events.GuildMemberAdd, async (member) => {
  const channel = await getChannelById(member.guild, process.env.GENERAL_CHANNEL_ID);
  if (!channel) return;

  const mention = `<@${member.id}>`;
  const guildName = `**${member.guild.name}**`;
  const msg = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)](mention, guildName);
  channel.send(msg).catch(console.error);
});

// ===================== AFK SYSTEM =====================
client.on(Events.MessageCreate, async (message) => {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    const wasAfk = getAfk(message.author.id);
    if (wasAfk) {
      clearAfk(message.author.id);
      await message
        .reply({
          content: `✅ welcome back <@${message.author.id}>! status AFK kamu sudah dihapus.`,
          allowedMentions: { repliedUser: false, parse: [] },
        })
        .catch(() => {});
    }

    if (!message.mentions?.users?.size) return;

    const lines = [];
    for (const [uid, user] of message.mentions.users) {
      if (user.bot) continue;
      const afk = getAfk(uid);
      if (!afk) continue;

      const sinceUnix = Math.floor((afk.since || Date.now()) / 1000);
      lines.push(`• <@${uid}> sedang **AFK** — ${afk.reason}\n  sejak <t:${sinceUnix}:R>`);
      if (lines.length >= 5) break;
    }

    if (lines.length) {
      await message
        .reply({
          content: `🕯️ **AFK Notice**\n${lines.join("\n")}`,
          allowedMentions: { repliedUser: false, parse: [] },
        })
        .catch(() => {});
    }
  } catch (e) {
    console.error("[AFK] error:", e);
  }
});

// ===================== HOUSECARD POST =====================
async function postHouseCard(guild, user, choice) {
  const houseChId = requireEnv("HOUSECARD_CHANNEL_ID");
  const houseChannel = await getChannelById(guild, houseChId);
  if (!houseChannel) return false;

  const idDb = loadIdDB();
  const idData = idDb.users?.[user.id];
  if (!idData) return false;

  const png = await renderHouseCard({
    choice,
    name: idData.name || user.username,
    gender: idData.gender || "—",
    hovId: idData.number || "—",
    avatarUrl: user.displayAvatarURL({ extension: "png", size: 256 }),
  });

  const filename = `house_card_${user.id}.png`;
  const file = new AttachmentBuilder(png, { name: filename });

  const embed = new EmbedBuilder()
    .setTitle("🪪 Valerie House Card")
    .setColor(EMBED_COLOR)
    .setDescription([`**Member:** <@${user.id}>`, `**Arcana:** ${choice === "dark" ? "<:dark:1452229004663849052> Dark Arcana" : "<:light:1452229058841542748> Light Arcana"}`].join("\n"))
    .setImage(`attachment://house_card_${user.id}.png`)
    .setFooter({ text: "House of Valerie • Arcane Registry" })
    .setTimestamp();

  await houseChannel.send({
    content: `📜 Takdir telah ditetapkan untuk <@${user.id}>.`,
    embeds: [embed],
    files: [file],
    allowedMentions: { parse: [] },
  });

  return true;
}

// ===================== INTERACTIONS =====================
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // ===================== SLASH =====================
    if (interaction.isChatInputCommand()) {
      const name = interaction.commandName;

      if (name === "ping") return interaction.reply(`🏓 pong! ${client.ws.ping}ms`);

      if (name === "halo") {
        const serverName = interaction.guild?.name || "realm ini";
        const replies = [
          `✨ salam, **${interaction.user.username}**.\nsebuah jiwa baru menyapa di **${serverName}**.`,
          `🌙 gerbang berpendar pelan saat **${interaction.user.username}** berbicara.\nselamat datang di **${serverName}**.`,
          `🔮 suaramu menggema di dalam **${serverName}**, **${interaction.user.username}**.\nsemoga langkahmu di sini menyenangkan.`,
          `🕯️ salam hangat, **${interaction.user.username}**.\n**${serverName}** menyambut kehadiranmu.`,
        ];
        return interaction.reply(replies[Math.floor(Math.random() * replies.length)]);
      }

      if (name === "about") {
        const uptime = Math.floor(process.uptime());
        const hours = Math.floor(uptime / 3600);
        const mins = Math.floor((uptime % 3600) / 60);
        const secs = uptime % 60;

        const embed = new EmbedBuilder()
          .setTitle("🤖 About Bot")
          .setColor(EMBED_COLOR)
          .setDescription("Aku penjaga gerbang realm yang menyambut jiwa-jiwa baru ✨")
          .addFields(
            { name: "🏷️ Name", value: `${client.user.tag}`, inline: true },
            { name: "📡 Ping", value: `${client.ws.ping}ms`, inline: true },
            { name: "⏳ Uptime", value: `${hours}h ${mins}m ${secs}s`, inline: true },
            { name: "🧩 Version", value: "discord.js v14", inline: true }
          )
          .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
          .setFooter({ text: `ID: ${client.user.id}` })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (name === "userinfo") {
        const user = interaction.options.getUser("user") || interaction.user;
        const member = interaction.guild ? await interaction.guild.members.fetch(user.id).catch(() => null) : null;

        const created = `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`;
        const joined = member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : "—";

        const roles =
          member?.roles.cache
            .filter((r) => interaction.guild && r.id !== interaction.guild.id)
            .map((r) => r.toString())
            .slice(0, 15) || [];

        const rolesText =
          roles.length > 0 ? roles.join(" ") + ((member?.roles.cache.size || 1) - 1 > 15 ? " …" : "") : "—";

        const embed = new EmbedBuilder()
          .setTitle(`👤 User Info — ${user.username}`)
          .setColor(EMBED_COLOR)
          .setThumbnail(user.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: "🏷️ Tag", value: `${user.tag}`, inline: true },
            { name: "🆔 ID", value: `${user.id}`, inline: true },
            { name: "📅 Created", value: created, inline: false },
            { name: "📌 Joined Server", value: joined, inline: false },
            { name: "🎭 Roles", value: rolesText, inline: false }
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (name === "avatar") {
        const user = interaction.options.getUser("user") || interaction.user;
        const member = interaction.guild ? await interaction.guild.members.fetch(user.id).catch(() => null) : null;

        const globalAvatar = user.displayAvatarURL({ extension: "png", size: 1024 });
        const serverAvatar = member?.avatarURL({ extension: "png", size: 1024 }) || null;

        const embed = new EmbedBuilder()
          .setTitle(`🖼️ Avatar — ${user.username}`)
          .setColor(EMBED_COLOR)
          .setDescription(serverAvatar ? "Menampilkan **Server Avatar** (kalau ada) + Global Avatar." : "Menampilkan **Global Avatar**.")
          .setImage(serverAvatar || globalAvatar)
          .addFields(
            { name: "Global Avatar", value: globalAvatar, inline: false },
            ...(serverAvatar ? [{ name: "Server Avatar", value: serverAvatar, inline: false }] : [])
          )
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (name === "afk") {
        const reason = interaction.options.getString("reason") || "AFK";
        setAfk(interaction.user.id, reason);
        return interaction.reply({
          content: `🕯️ <@${interaction.user.id}> sekarang **AFK** — ${safeText(reason, 80)}`,
          allowedMentions: { parse: [] },
        });
      }

      if (name === "registry") {
        if (!interaction.guild) return interaction.reply({ content: "Command ini cuma bisa dipakai di server ya.", ephemeral: true });
        await interaction.guild.members.fetch({ withPresences: false }).catch(() => null);

        const idDb = loadIdDB();
        const pages = buildRegistryPages(interaction.guild, idDb);
        const pageIndex = 0;

        const embed = registryEmbed(interaction.guild, pages, pageIndex);
        const row = registryRow(pageIndex, pages.length);

        return interaction.reply({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
      }

      if (name === "serverinfo") {
        const g = interaction.guild;
        if (!g) return interaction.reply({ content: "Ini cuma bisa dipakai di server ya 👀", ephemeral: true });

        const owner = await g.fetchOwner().catch(() => null);
        const channels = await g.channels.fetch().catch(() => g.channels.cache);
        const textCount = channels.filter((c) => c?.isTextBased?.()).size;
        const voiceCount = channels.filter((c) => c?.isVoiceBased?.()).size;

        const boosts = g.premiumSubscriptionCount || 0;
        const boostTier = g.premiumTier ?? 0;

        const embed = new EmbedBuilder()
          .setTitle(`🏰 Server Info — ${g.name}`)
          .setColor(EMBED_COLOR)
          .setThumbnail(g.iconURL({ size: 256 }))
          .addFields(
            { name: "👑 Owner", value: owner ? `<@${owner.id}>` : "Unknown", inline: true },
            { name: "👥 Members", value: `${g.memberCount}`, inline: true },
            { name: "💎 Boost", value: `Tier ${boostTier} • ${boosts} boosts`, inline: true },
            { name: "💬 Channels", value: `Text: ${textCount}\nVoice: ${voiceCount}\nTotal: ${channels.size}`, inline: true },
            { name: "🎭 Roles", value: `${g.roles.cache.size}`, inline: true },
            { name: "✅ Verification", value: `${g.verificationLevel}`, inline: true },
            { name: "📅 Created", value: `<t:${Math.floor(g.createdTimestamp / 1000)}:F>`, inline: false }
          )
          .setFooter({ text: `Server ID: ${g.id}` })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
      }

      if (name === "menfesspanel") {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({ content: "command ini cuma buat admin ya 👀", ephemeral: true });
        }

        const ch = await getChannelById(interaction.guild, process.env.MENFESS_CHANNEL_ID);
        if (!ch) {
          return interaction.reply({
            content: "MENFESS_CHANNEL_ID tidak ketemu / bot tidak punya akses / bukan text channel.",
            ephemeral: true,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle("🕯️ MENFESS")
          .setColor(EMBED_COLOR)
          .setDescription("Klik tombol untuk kirim menfess **anonim**.\nBalasan juga bisa anonim.")
          .setFooter({ text: "No doxxing / hate / threat. Keep it safe." });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("menfess:new").setLabel("Kirim Menfess").setStyle(ButtonStyle.Success).setEmoji("✉️")
        );

        await ch.send({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
        return interaction.reply({ content: "✅ panel menfess terkirim ke channel menfess.", ephemeral: true });
      }

      if (name === "idcard") {
        const embed = new EmbedBuilder()
          .setTitle(`🪪 ${ID_CARD_TITLE}`)
          .setColor(EMBED_COLOR)
          .setDescription("Klik tombol untuk membuat / update **HOV IDENTITY CARD** kamu.")
          .setFooter({ text: "Theme: isi Status pakai `| dark` atau `| light` (contoh: single | dark)" });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("idcard:open").setLabel("Buat / Update ID").setStyle(ButtonStyle.Primary).setEmoji("🪪")
        );

        return interaction.reply({ embeds: [embed], components: [row] });
      }

      if (name === "sortingpanel") {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({ content: "command ini cuma buat admin ya 👀", ephemeral: true });
        }

        const targetChannelId = process.env.SORTING_CHANNEL_ID || interaction.channelId;
        const ch = await getChannelById(interaction.guild, targetChannelId);

        if (!ch) {
          return interaction.reply({
            content: "SORTING_CHANNEL_ID tidak valid / bot tidak punya akses / bukan text channel.",
            ephemeral: true,
          });
        }

        await ch.send({
          embeds: [sortingPanelEmbed()],
          components: [sortingPanelRow()],
          allowedMentions: { parse: [] },
        });

        return interaction.reply({ content: "✅ panel sorting terkirim.", ephemeral: true });
      }

      // ✅ /myhouse
      if (name === "myhouse") {
        if (!interaction.guild) return interaction.reply({ content: "Command ini cuma bisa dipakai di server ya.", ephemeral: true });

        const sorted = getSortedUser(interaction.user.id);
        if (!sorted?.choice) {
          return interaction.reply({ content: "⚠️ Kamu belum melakukan Arcane Sorting. Klik panel sorting dulu ya.", ephemeral: true });
        }

        const idDb = loadIdDB();
        const idData = idDb.users?.[interaction.user.id];
        if (!idData) {
          const idCh = requireEnv("IDCARD_CHANNEL_ID");
          const mention = idCh ? `<#${idCh}>` : "channel ID Card";
          return interaction.reply({
            content: `⚠️ Kamu belum punya **Valerie ID Card**.\nSilahkan buat dulu di ${mention} dengan command **/idcard**.`,
            ephemeral: true,
          });
        }

        await interaction.deferReply({ ephemeral: true });

        const png = await renderHouseCard({
          choice: sorted.choice,
          name: idData.name || interaction.user.username,
          gender: idData.gender || "—",
          hovId: idData.number || "—",
          avatarUrl: interaction.user.displayAvatarURL({ extension: "png", size: 256 }),
        });

        const filename = `my_house_${interaction.user.id}.png`;
        const file = new AttachmentBuilder(png, { name: filename });

        const embed = new EmbedBuilder()
          .setTitle("🪪 My Valerie House Card")
          .setColor(EMBED_COLOR)
          .setDescription(`**Arcana:** ${sorted.choice === "dark" ? "🌙 Dark Arcana" : "✨ Light Arcana"}`)
          .setImage(`attachment://${filename}`)
          .setTimestamp();

        return interaction.editReply({ embeds: [embed], files: [file] });
      }

      return;
    }

    // ===================== BUTTONS =====================
    if (interaction.isButton()) {
      const id = interaction.customId;

      // Registry pagination
      if (id.startsWith("registry:")) {
        await interaction.deferUpdate();

        const [, action, currentStr] = id.split(":");
        const current = Number(currentStr || 0);

        await interaction.guild.members.fetch({ withPresences: false }).catch(() => null);

        const idDb = loadIdDB();
        const pages = buildRegistryPages(interaction.guild, idDb);

        let nextPage = current;
        if (action === "prev") nextPage = Math.max(0, current - 1);
        if (action === "next") nextPage = Math.min(pages.length - 1, current + 1);

        const embed = registryEmbed(interaction.guild, pages, nextPage);
        const row = registryRow(nextPage, pages.length);

        return interaction.message.edit({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
      }

      // ✅ SORTING ROLL: kalau belum punya ID Card => kasih pesan, STOP
      if (id === "sorting:roll") {
        const lightRoleId = requireEnv("LIGHT_ROLE_ID");
        const darkRoleId = requireEnv("DARK_ROLE_ID");
        const idcardChannelId = requireEnv("IDCARD_CHANNEL_ID");

        if (!lightRoleId || !darkRoleId) {
          return interaction.reply({ content: "⚠️ LIGHT_ROLE_ID / DARK_ROLE_ID belum diisi di .env", ephemeral: true });
        }

        const locked = getSortedUser(interaction.user.id);
        if (locked) {
          const when = Math.floor((locked.at || Date.now()) / 1000);
          const text = locked.choice === "light" ? "✨ Light Arcana" : "🌙 Dark Arcana";
          return interaction.reply({
            content: `🔒 Kamu sudah tersortir ke **${text}**.\nSejak: <t:${when}:F>\n\nTidak bisa sorting ulang.`,
            ephemeral: true,
          });
        }

        // cek ID card harus sudah ada
        const idDb = loadIdDB();
        const idData = idDb.users?.[interaction.user.id];
        if (!idData) {
          const mention = idcardChannelId ? `<#${idcardChannelId}>` : "channel ID Card";
          return interaction.reply({
            content: `🔒 Kamu belum punya **Valerie ID Card**.\nSilahkan buat dulu di ${mention} dengan command **/idcard**.\n\nSetelah itu balik lagi dan klik **Mulai Ritual**.`,
            ephemeral: true,
          });
        }

        // lanjut ritual
        await interaction.deferReply({ ephemeral: true });

        const stages = [
          "🕯️ Lingkaran arcane menyala…",
          "🔮 Aura kamu dibaca oleh Arcana…",
          "✨ Fragmen takdir berputar di udara…",
          "🌙 Tirai antara cahaya & bayangan menipis…",
          "📜 Keputusan hampir ditetapkan…",
        ];
        for (const s of stages) {
          await interaction.editReply({ content: s });
          await sleep(850);
        }

        const choice = Math.random() < 0.5 ? "light" : "dark";

        // lock dulu anti spam
        setSortedUser(interaction.user.id, choice);

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) return interaction.editReply({ content: "⚠️ Gagal fetch member." });

        const roleIdToAdd = choice === "light" ? lightRoleId : darkRoleId;
        await member.roles.add(roleIdToAdd).catch((e) => console.error("[SORTING] add role failed:", e));

        const finalText = choice === "light" ? "✨ **LIGHT ARCANA**" : "🌙 **DARK ARCANA**";
        await interaction.editReply({
          content: `🧙‍♀️ Arcane telah memutuskan...\nKamu masuk ke ${finalText}!\n\n📨 House Card kamu dikirim ke channel hasil.\n🔒 Ritual terkunci (1x saja).`,
        });

        // kirim house card ke channel result
        await postHouseCard(interaction.guild, interaction.user, choice).catch((e) => console.error("[HOUSECARD] send failed:", e));

        return;
      }

      // MENFESS new
      if (id === "menfess:new") {
        const cdSec = Number(process.env.MENFESS_COOLDOWN_SEC || 60);
        const now = Date.now();
        const last = menfessCooldown.get(interaction.user.id) || 0;

        if (now - last < cdSec * 1000) {
          const wait = Math.ceil((cdSec * 1000 - (now - last)) / 1000);
          return interaction.reply({ content: `⏳ tunggu ${wait}s dulu ya.`, ephemeral: true });
        }

        const modal = new ModalBuilder().setCustomId("menfess:submit").setTitle("✉️ Menfess Anon");

        const toInput = new TextInputBuilder()
          .setCustomId("to_initial")
          .setLabel("Untuk (inisial / kata singkat)")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(12)
          .setRequired(true);

        const aliasInput = new TextInputBuilder()
          .setCustomId("alias")
          .setLabel("Nama (opsional)")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(24)
          .setRequired(false);

        const msgInput = new TextInputBuilder()
          .setCustomId("msg")
          .setLabel("Isi menfess")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1500)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(toInput),
          new ActionRowBuilder().addComponents(aliasInput),
          new ActionRowBuilder().addComponents(msgInput)
        );

        return interaction.showModal(modal);
      }

      if (id.startsWith("menfess:reply:")) {
        const menfessId = id.split(":")[2];

        const modal = new ModalBuilder().setCustomId(`menfess:reply_submit:${menfessId}`).setTitle(`🫣 Balas Anonim #${menfessId}`);

        const reply = new TextInputBuilder()
          .setCustomId("reply_msg")
          .setLabel("Isi balasan")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1200)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(reply));
        return interaction.showModal(modal);
      }

      // ID Card open (fitur lama tetap)
      if (id === "idcard:open") {
        const modal = new ModalBuilder().setCustomId("idcard:submit").setTitle(`🪪 ${ID_CARD_TITLE}`);

        const nameInput = new TextInputBuilder().setCustomId("name").setLabel("Nama").setStyle(TextInputStyle.Short).setMaxLength(24).setRequired(true);
        const genderInput = new TextInputBuilder()
          .setCustomId("gender")
          .setLabel("Gender (L / P / W / dll)")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(8)
          .setRequired(true);

        const domInput = new TextInputBuilder().setCustomId("dom").setLabel("Domisili").setStyle(TextInputStyle.Short).setMaxLength(24).setRequired(true);
        const hobiInput = new TextInputBuilder().setCustomId("hobi").setLabel("Hobi").setStyle(TextInputStyle.Short).setMaxLength(30).setRequired(true);

        const statusInput = new TextInputBuilder()
          .setCustomId("status")
          .setLabel("Status + Theme (contoh: single | dark/light)")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(32)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(nameInput),
          new ActionRowBuilder().addComponents(genderInput),
          new ActionRowBuilder().addComponents(domInput),
          new ActionRowBuilder().addComponents(hobiInput),
          new ActionRowBuilder().addComponents(statusInput)
        );

        return interaction.showModal(modal);
      }

      return;
    }

    // ===================== MODALS =====================
    if (interaction.isModalSubmit()) {
      const id = interaction.customId;

      // MENFESS submit
      if (id === "menfess:submit") {
        const ch = await getChannelById(interaction.guild, process.env.MENFESS_CHANNEL_ID);
        if (!ch) {
          return interaction.reply({
            content: "Channel menfess tidak ketemu / bot tidak punya akses / bukan text channel.",
            ephemeral: true,
          });
        }

        const to = interaction.fields.getTextInputValue("to_initial").trim();
        const aliasRaw = (interaction.fields.getTextInputValue("alias") || "").trim();
        const content = interaction.fields.getTextInputValue("msg").trim();

        if (!to || !content) return interaction.reply({ content: "Form kosong 😭", ephemeral: true });
        if (aliasRaw && isBadAlias(aliasRaw)) {
          return interaction.reply({ content: "Nama tidak boleh mengandung mention / nyamar staff ya.", ephemeral: true });
        }

        const cdSec = Number(process.env.MENFESS_COOLDOWN_SEC || 60);
        const now = Date.now();
        const last = menfessCooldown.get(interaction.user.id) || 0;
        if (now - last < cdSec * 1000) {
          const wait = Math.ceil((cdSec * 1000 - (now - last)) / 1000);
          return interaction.reply({ content: `⏳ tunggu ${wait}s dulu ya.`, ephemeral: true });
        }
        menfessCooldown.set(interaction.user.id, now);

        const db = loadMenfessDB();
        const menfessId = ++db.lastId;

        const anonDefault = getAnonLabel(db, interaction.user.id);
        const senderLabel = aliasRaw ? aliasRaw : anonDefault;
        saveMenfessDB(db);

        const embed = new EmbedBuilder()
          .setTitle(`🕯️ MENFESS #${menfessId}`)
          .setColor(EMBED_COLOR)
          .setDescription(`**untuk:** ${safeText(to, 24)}\n\n${content}\n\n— **${safeText(senderLabel, 24)}**`)
          .setFooter({ text: `Posted by ${BRAND_NAME}` })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("menfess:new").setLabel("Kirim Baru").setStyle(ButtonStyle.Success).setEmoji("✉️"),
          new ButtonBuilder().setCustomId(`menfess:reply:${menfessId}`).setLabel("Balas Anonim").setStyle(ButtonStyle.Primary).setEmoji("🫣")
        );

        const sent = await ch.send({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });

        const db2 = loadMenfessDB();
        db2.posts[String(menfessId)] = { messageId: sent.id, channelId: ch.id };
        saveMenfessDB(db2);

        return interaction.reply({ content: "✅ menfess terkirim.", ephemeral: true });
      }

      // MENFESS reply submit
      if (id.startsWith("menfess:reply_submit:")) {
        const menfessId = id.split(":")[2];
        const replyText = interaction.fields.getTextInputValue("reply_msg").trim();
        if (!replyText) return interaction.reply({ content: "Balasan kosong 😭", ephemeral: true });

        const db = loadMenfessDB();
        const post = db.posts[String(menfessId)];
        if (!post) return interaction.reply({ content: "Menfess asal tidak ditemukan (mungkin sudah kehapus).", ephemeral: true });

        const ch = await getChannelById(interaction.guild, post.channelId);
        if (!ch) return interaction.reply({ content: "Channel menfess tidak valid / bot tidak punya akses.", ephemeral: true });

        const anon = getAnonLabel(db, interaction.user.id);
        saveMenfessDB(db);

        const embed = new EmbedBuilder()
          .setTitle("🫣 Balasan Anonim")
          .setColor(EMBED_COLOR)
          .setDescription(`${replyText}\n\n— **${anon}**`)
          .setFooter({ text: `Reply to menfess #${menfessId}` })
          .setTimestamp();

        await ch.send({
          embeds: [embed],
          reply: { messageReference: post.messageId },
          allowedMentions: { repliedUser: false, parse: [] },
        });

        return interaction.reply({ content: "✅ balasan terkirim.", ephemeral: true });
      }

      // ID CARD submit (fitur lama tetap)
      if (id === "idcard:submit") {
        const rawName = interaction.fields.getTextInputValue("name");
        const rawGender = interaction.fields.getTextInputValue("gender");
        const rawDom = interaction.fields.getTextInputValue("dom");
        const rawHobi = interaction.fields.getTextInputValue("hobi");
        const rawStatusTheme = interaction.fields.getTextInputValue("status");

        const parts = rawStatusTheme.split("|").map((s) => s.trim()).filter(Boolean);
        const status = safeText(parts[0] || "—", 18);
        const theme = (parts[1] || "light").toLowerCase() === "dark" ? "dark" : "light";

        const payload = {
          name: safeText(rawName, 18) || interaction.user.username,
          gender: safeText(rawGender, 8) || "—",
          domisili: safeText(rawDom, 18) || "—",
          hobi: safeText(rawHobi, 18) || "—",
          status,
          theme,
        };

        const db = loadIdDB();
        const uid = interaction.user.id;

        if (!db.users[uid]) db.users[uid] = { number: genCardNumber(uid), createdAt: Date.now() };
        db.users[uid] = { ...db.users[uid], ...payload, updatedAt: Date.now() };
        saveIdDB(db);

        const createdAtText = new Date(db.users[uid].createdAt).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });

        const sorted = getSortedUser(uid);
        const arcanaChoice = sorted?.choice || null;

        await interaction.deferReply({ ephemeral: false });

        const png = await renderIdCard({
          theme: payload.theme,
          number: db.users[uid].number,
          name: payload.name,
          gender: payload.gender,
          domisili: payload.domisili,
          hobi: payload.hobi,
          status: payload.status,
          avatarUrl: interaction.user.displayAvatarURL({ extension: "png", size: 256 }),
          createdAtText,
          arcanaChoice,
        });

        const file = new AttachmentBuilder(png, { name: "hov_idcard.png" });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("idcard:open").setLabel("Buat / Update ID").setStyle(ButtonStyle.Primary).setEmoji("🪪")
        );

        const embed = new EmbedBuilder()
          .setTitle(`🪪 ${ID_CARD_TITLE}`)
          .setColor(EMBED_COLOR)
          .setDescription(`<@${interaction.user.id}>, berikut **${ID_CARD_TITLE}** kamu:`)
          .setImage("attachment://hov_idcard.png")
          .setTimestamp();

        return interaction.editReply({
          embeds: [embed],
          files: [file],
          components: [row],
          allowedMentions: { parse: [] },
        });
      }

      return;
    }
  } catch (err) {
    console.error(err);
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: "⚠️ ada error di bot, coba lagi ya.", ephemeral: true });
    }
  }
});

// ===================== LOGIN =====================
client.login(process.env.DISCORD_TOKEN);
