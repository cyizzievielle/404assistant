/**
 * index.js — HOV Assistant (SQLite FINAL + PREFIX)
 * discord.js v14 + @napi-rs/canvas
 *
 * DB Engine:
 * - Prefer: better-sqlite3 (sync, fast)  -> optional
 * - Fallback: sqlite3 (async, stable)    -> recommended on many Pterodactyl images
 *
 * Features:
 * - Welcome message
 * - AFK system (slash + prefix)
 * - ID Card (canvas) — FONT FIX LINUX (InterReg/InterBold + DejaVu fallback)
 * - Arcane Sorting (LOCK 1x + roles + House Card post)
 * - Sorting "lebih natural": BAG SYSTEM (mis: 20 draw berisi 10 light + 10 dark, diacak, persist)
 * - Registry pagination
 * - Menfess (anonymous public label) + Admin Log channel
 * - Prefix commands: cavatar, cuserinfo, cserverinfo, cafk, cping, chalp/chalo
 * - Owner-only lock: /menfesspanel /sortingpanel /idcard + prefix versi panel & idcard
 *
 * Install (recommended for Pterodactyl):
 *   yarn add discord.js dotenv sqlite3 @napi-rs/canvas
 * Optional:
 *   yarn add better-sqlite3
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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
  MessageFlags,
  StringSelectMenuBuilder,
} = require("discord.js");


const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

// ===================== CONFIG =====================
const BRAND_NAME = "Mystral Assistant";
const ID_CARD_TITLE = "MYSTRAL IDENTITY CARD";
const EMBED_COLOR = 0x77d0d7;

const PREFIX = process.env.PREFIX || "c";

// OWNER LOCK (HARUS diisi)
const BOT_OWNER_ID = process.env.BOT_OWNER_ID || "776022128092774410";

// ===================== SELF ROLES (ADD-ON) =====================
const SELFROLES = require("./selfroles.roles.js");

const SELF_AGE_IDS_RAW = SELFROLES.age.map((x) => x.value);
const SELF_STATUS_IDS_RAW = SELFROLES.status.map((x) => x.value);
const SELF_REGION_IDS_RAW = (SELFROLES.region || []).map((x) => x.value);
const SELF_PING_IDS_RAW = (SELFROLES.ping || []).map((x) => x.value);


// mapping interest per menu (biar update 1 kategori gak ngehapus kategori lain)
const INTEREST_MENU_MAP = {
  "self:int_gaming": SELFROLES.interest.gaming || [],
  "self:int_ent": SELFROLES.interest.entertainment || [],
  "self:int_creative": SELFROLES.interest.creative || [],
};

const ALL_INTEREST_IDS = Object.values(INTEREST_MENU_MAP)
  .flat()
  .map((x) => x.value);

// === SAFETY: kalau ada role ID nyasar/duplikat lintas kategori, jangan sampai kehapus ===
const SET_AGE = new Set(SELF_AGE_IDS_RAW);
const SET_STATUS = new Set(SELF_STATUS_IDS_RAW);
const SET_INTEREST = new Set(ALL_INTEREST_IDS);
const SET_REGION = new Set(SELF_REGION_IDS_RAW);
const SET_PING = new Set(SELF_PING_IDS_RAW);
const SELF_STATUS_IDS = SELF_STATUS_IDS_RAW.filter(

  (id) => !SET_AGE.has(id) && !SET_INTEREST.has(id) && !SET_REGION.has(id) && !SET_PING.has(id)
);

const SELF_AGE_IDS = SELF_AGE_IDS_RAW.filter(
  (id) => !SET_STATUS.has(id) && !SET_INTEREST.has(id) && !SET_REGION.has(id) && !SET_PING.has(id)
);

// ✅ region remover (1 role only)
const SELF_REGION_IDS = SELF_REGION_IDS_RAW.filter(
  (id) => !SET_AGE.has(id) && !SET_STATUS.has(id) && !SET_INTEREST.has(id) && !SET_PING.has(id)
);

// ✅ ping remover (multi)
const SELF_PING_IDS = SELF_PING_IDS_RAW.filter(
  (id) => !SET_AGE.has(id) && !SET_STATUS.has(id) && !SET_INTEREST.has(id) && !SET_REGION.has(id)
);

function buildSelfSelect(customId, placeholder, options, maxValues) {
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(options.map((o) => ({ label: o.label, value: o.value })))
    .setMinValues(0) // allow empty to remove
    .setMaxValues(Math.min(Number(maxValues || 1), 25));
}

function selfrolesPanelEmbeds() {
  const e1 = new EmbedBuilder()
    .setTitle("🎓 AGE / GENERATION")
    .setColor(EMBED_COLOR)
    .setDescription(
      [
        "Setiap generasi memiliki cerita dan sudut pandangnya sendiri.",
        "",
        "Pilih **1 Age / Generation** yang paling menggambarkan dirimu.",
        "Pilihan ini dapat diperbarui kapan saja.",
      ].join("\n")
    )
    .setFooter({ text: "Mystral Academy • Identity Registry" });

  const e2 = new EmbedBuilder()
    .setTitle("🎯 INTEREST / HOBBY")
    .setColor(EMBED_COLOR)
    .setDescription(
      [
        "Minat membentuk cara kita berinteraksi dan berbagi cerita.",
        "",
        "Pilih bebas sesuai ketertarikanmu lewat dropdown di bawah.",
        "Kamu dapat memilih **lebih dari satu** interest (tiap dropdown bisa multi).",
        "",
        "📌 **Gaming** — game yang kamu mainkan / komunitas yang kamu ikuti.",
        "🎬 **Entertainment** — tontonan & musik yang kamu nikmati.",
        "🎨 **Creative** — karya, skill, dan gaya hidup yang kamu sukai.",
      ].join("\n")
    )
    .setFooter({ text: "Mystral Academy • Social Affinity" });

  const e3 = new EmbedBuilder()
    .setTitle("💖 STATUS")
    .setColor(EMBED_COLOR)
    .setDescription(
      [
        "Status mencerminkan keadaan yang ingin kamu tampilkan.",
        "",
        "Pilih **1 Status**, atau kosongkan untuk menghapus.",
      ].join("\n")
    )
    .setFooter({ text: "Mystral Academy • Personal State" });

  const eRegion = new EmbedBuilder()
    .setTitle("🗺️ REGION")
    .setColor(EMBED_COLOR)
    .setDescription(
      [
        "Setiap wilayah memiliki cerita, budaya, dan warna tersendiri.",
        "",
        "Pilih **1 Region** yang paling mewakili tempatmu",
        "atau kosongkan untuk menghapus pilihan.",
      ].join("\n")
    )
    .setFooter({ text: "Mystral Academy • Region" });

  const ePing = new EmbedBuilder()
    .setTitle("🔔 PING ROLES")
    .setColor(EMBED_COLOR)
    .setDescription(
      [
        "Tidak semua kabar perlu sampai ke semua orang.",
        "",
        "Pilih role ping untuk menerima notifikasi yang kamu inginkan.",
        "Kamu dapat memilih **lebih dari satu** role Ping.",
      ].join("\n")
    )
    .setFooter({ text: "Mystral Academy • Ping Opt-in" });

// return semua embed sekaligus
  return [e1, e2, e3, eRegion, ePing];
}

//============== FONT (ULTRA FIX LINUX) =====================
const FONT_CANDIDATES = [
  {
    reg: path.join(__dirname, "assets", "fonts", "Inter-Regular.ttf"),
    bold: path.join(__dirname, "assets", "fonts", "Inter-Bold.ttf"),
    label: "__dirname/assets/fonts",
  },
  {
    reg: path.join(process.cwd(), "assets", "fonts", "Inter-Regular.ttf"),
    bold: path.join(process.cwd(), "assets", "fonts", "Inter-Bold.ttf"),
    label: "cwd/assets/fonts",
  },
  {
    reg: "/home/container/assets/fonts/Inter-Regular.ttf",
    bold: "/home/container/assets/fonts/Inter-Bold.ttf",
    label: "/home/container/assets/fonts",
  },
];

let FONT_FAMILY_REG = "DejaVu Sans";
let FONT_FAMILY_BOLD = "DejaVu Sans";

(function registerFontsSafe() {
  try {
    console.log("[FONT] __dirname:", __dirname);
    console.log("[FONT] cwd:", process.cwd());

    let picked = null;

    for (const c of FONT_CANDIDATES) {
      const regOk = fs.existsSync(c.reg);
      const boldOk = fs.existsSync(c.bold);
      console.log(`[FONT] try ${c.label}`, { reg: c.reg, regOk, bold: c.bold, boldOk });
      if (regOk || boldOk) {
        picked = c;
        break;
      }
    }

    if (!picked) {
      console.log("[FONT] ❌ Inter not found. Using fallback:", { FONT_FAMILY_REG, FONT_FAMILY_BOLD });
      return;
    }

    if (fs.existsSync(picked.reg)) {
      GlobalFonts.registerFromPath(picked.reg, "InterReg");
      FONT_FAMILY_REG = "InterReg";
    }
    if (fs.existsSync(picked.bold)) {
      GlobalFonts.registerFromPath(picked.bold, "InterBold");
      FONT_FAMILY_BOLD = "InterBold";
    }

    const famNames = (GlobalFonts.families || [])
      .map((f) => (typeof f === "string" ? f : f?.family))
      .filter(Boolean);

console.log("[FONT] families count:", famNames.length);
console.log("[FONT] has InterReg:", famNames.includes("InterReg"));
console.log("[FONT] has InterBold:", famNames.includes("InterBold"));


    if (!famNames.includes("InterReg")) FONT_FAMILY_REG = "DejaVu Sans";
    if (!famNames.includes("InterBold")) FONT_FAMILY_BOLD = "DejaVu Sans";

    console.log("[FONT] ✅ Using:", { FONT_FAMILY_REG, FONT_FAMILY_BOLD });
  } catch (e) {
    console.warn("[FONT] register failed:", e?.message || e);
  }
})();

function setFont(ctx, weight, sizePx) {
  const fam = weight === "bold" ? FONT_FAMILY_BOLD : FONT_FAMILY_REG;
  ctx.font = `${weight} ${sizePx}px "${fam}"`;
}

// ===================== ENV =====================
function requireEnv(name) {
  const v = process.env[name];
  return v && String(v).trim().length ? String(v).trim() : null;
}

function isBotOwner(userId) {
  return String(userId) === String(BOT_OWNER_ID);
}

const SQLITE_PATH = requireEnv("SQLITE_PATH") || "./data/hovassistant_v2.db";
const dir = path.dirname(SQLITE_PATH);
if (dir && dir !== "." && dir !== "/") fs.mkdirSync(dir, { recursive: true });

// ===================== DB ENGINE AUTO =====================
let DB_ENGINE = null;

// Try better-sqlite3 first
let BetterSqlite = null;
try {
  BetterSqlite = require("better-sqlite3");
  DB_ENGINE = "better-sqlite3";
} catch {}

// fallback sqlite3
let sqlite3 = null;
if (!DB_ENGINE) {
  try {
    sqlite3 = require("sqlite3").verbose();
    DB_ENGINE = "sqlite3";
  } catch {}
}

if (!DB_ENGINE) {
  console.error("❌ Tidak ada DB engine terpasang. Install salah satu:");
  console.error("   yarn add sqlite3");
  console.error("   (optional) yarn add better-sqlite3");
  process.exit(1);
}

// Wrapper interface
let db = null;
let dbGet = null;
let dbAll = null;
let dbRun = null;
let dbExec = null;
let dbTransaction = null;

function openDb() {
  if (DB_ENGINE === "better-sqlite3") {
    db = new BetterSqlite(SQLITE_PATH);

    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("foreign_keys = ON");

    dbGet = (sql, params = []) => db.prepare(sql).get(params);
    dbAll = (sql, params = []) => db.prepare(sql).all(params);
    dbRun = (sql, params = []) => db.prepare(sql).run(params);
    dbExec = (sql) => db.exec(sql);

    dbTransaction = (fn) => {
      const tx = db.transaction(fn);
      return (...args) => tx(...args);
    };

    console.log("[DB] Engine:", DB_ENGINE);
    return;
  }
  
  // sqlite3 (async)
  db = new sqlite3.Database(SQLITE_PATH);

  dbExec = (sql) =>
    new Promise((resolve, reject) => {
      db.exec(sql, (err) => (err ? reject(err) : resolve()));
    });

  dbRun = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ changes: this.changes ?? 0, lastID: this.lastID });
      });
    });

  dbGet = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });

  dbAll = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    });

  // transaction emulation
  dbTransaction = (fn) => {
    return async (...args) => {
      await dbRun("BEGIN IMMEDIATE");
      try {
        const res = await fn(...args);
        await dbRun("COMMIT");
        return res;
      } catch (e) {
        await dbRun("ROLLBACK").catch(() => {});
        throw e;
      }
    };
  };

  console.log("[DB] Engine:", DB_ENGINE);
}

// ===================== DB SAFE HELPERS (works for better-sqlite3 + sqlite3) =====================
async function safeGet(sql, params = []) {
  try { return await dbGet(sql, params); } catch { return null; }
}

async function safeAll(sql, params = []) {
  try { return await dbAll(sql, params); } catch { return []; }
}

async function safeRun(sql, params = []) {
  try { return await dbRun(sql, params); } catch { return { changes: 0, lastID: null }; }
}

async function safeExec(sql) {
  try { return await dbExec(sql); } catch { return null; }
}


// ===================== DISCORD CLIENT =====================
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


      // ===================== VOICE STATS (FIX) =====================
      async function updateStatsChannels(guild) {
        try {
          if (!guild) return;

          const categoryId = requireEnv("STATS_CATEGORY_ID");
          if (!categoryId) return;

          const category = await guild.channels.fetch(categoryId).catch(() => null);
          if (!category) return;

          // ✅ v14: ambil semua channel lalu filter yang parentId-nya categoryId
          const allChannels = await guild.channels.fetch().catch(() => null);
          if (!allChannels) return;

          const voiceInCategory = allChannels.filter(
            (ch) => ch?.isVoiceBased?.() && ch.parentId === categoryId
          );


          if (!voiceInCategory.size) return;

          // ✅ member counts (lebih hemat: pakai cache kalau ada, kalau nggak fetch sekali)
          let members;
          try {
            members = guild.members.cache?.size ? guild.members.cache : await guild.members.fetch();
          } catch {
            members = null;
          }
          if (!members) return;

          const total = guild.memberCount ?? members.size;
          const bots = members.filter((m) => m.user?.bot).size;
          const humans = total - bots;
          const boosts = guild.premiumSubscriptionCount || 0;

          // Nama final yang mau dipakai
          const names = {
            all: `🔊 All Members: ${total}`,
            members: `👤 Members: ${humans}`,
            bots: `🤖 Bots: ${bots}`,
            boosts: `💎 Boosts: ${boosts}`,
          };

          // ✅ Deteksi target channel berdasarkan AWAL nama (prefix), bukan includes
          //   Biar "All Members" nggak ketembak "members".
          const detectKey = (name) => {
            const n = String(name || "").toLowerCase().trim();

            // buang emoji & spasi depan
            const clean = n.replace(/^[^\w]+/g, "").trim(); // hapus emoji/simbol di awal
            // contoh clean: "all members: 341"

            if (clean.startsWith("all")) return "all";
            if (clean.startsWith("members")) return "members";
            if (clean.startsWith("bots")) return "bots";
            if (clean.startsWith("boosts")) return "boosts";

            // fallback tambahan (kalau kamu pakai label lain)
            if (clean.startsWith("all members")) return "all";
            return null;
          };

          for (const ch of voiceInCategory.values()) {
            const key = detectKey(ch.name);
            if (!key) continue;

            const newName = names[key];
            if (newName && ch.name !== newName) {
              await ch.setName(newName).catch(() => {});
            }
          }
        } catch (e) {
          console.error("[STATS] update failed:", e?.message || e);
        }
      }

   // ===================== PROFILE (EMBED + BUTTONS) =====================
        async function buildProfileEmbed({ guild, user, member }) {
          // fetch full user untuk banner
          const userFull = await client.users.fetch(user.id, { force: true }).catch(() => null);
          const bannerUrl = userFull?.bannerURL?.({ extension: "png", size: 1024 }) || null;

          // DB data
          const idData = await getIdCard(user.id).catch(() => null);
          const sorted = await getSortedUser(user.id).catch(() => null);
          const afk = await getAfk(user.id).catch(() => null);

          // timeline
          const createdUnix = Math.floor((user.createdTimestamp || Date.now()) / 1000);
          const joinedUnix = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

          // roles
          const roleMentions = member
            ? member.roles.cache
                .filter((r) => r.id !== guild.id)
                .sort((a, b) => b.position - a.position)
                .map((r) => r.toString())
            : [];

          const topRole =
            member?.roles.cache
              .filter((r) => r.id !== guild.id)
              .sort((a, b) => b.position - a.position)
              .first() || null;

          const displayName = member?.displayName || user.username;
          const nickname = member?.nickname || "—";

          const afkText = afk
            ? `🕯️ **AFK:** ${afk.reason}\nSejak: <t:${Math.floor((Number(afk.since) || Date.now()) / 1000)}:R>`
            : "—";

          const idText = idData
            ? [
                `**No ID:** \`${idData.number || "—"}\``,
                `**Nama:** ${idData.name || "—"}`,
                `**Gender:** ${idData.gender || "—"}`,
                `**Domisili:** ${idData.domisili || "—"}`,
                `**Hobi:** ${idData.hobi || "—"}`,
                `**Status:** ${idData.status || "—"}`,
                `**Theme:** ${(idData.theme || "light") === "dark" ? "dark" : "light"}`,
              ].join("\n")
            : "Belum punya ID Card.";

          const sortText = sorted?.choice
            ? `✅ **Student:** ${sorted.choice === "dark" ? "<:dark:1459543141609771101> Dark" : "<:light:1459543076736336004> Light"}\nSejak: <t:${Math.floor((Number(sorted.at) || Date.now()) / 1000)}:R>`
            : "Belum melakukan Sorting.";

          const embed = new EmbedBuilder()
            .setTitle(`🧿 Mystral Profile — ${displayName}`)
            .setColor(EMBED_COLOR)
            .setThumbnail(user.displayAvatarURL({ extension: "png", size: 256 }))
            .setDescription(`**Mention:** <@${user.id}>`)
            .addFields(
              {
                name: "🪪 Identity",
                value: [
                  `**Tag:** ${user.tag}`,
                  `**User ID:** \`${user.id}\``,
                  `**Nickname:** ${nickname === "—" ? "—" : `\`${nickname}\``}`,
                ].join("\n"),
                inline: true,
              },
              {
                name: "🕰️ Timeline",
                value: [
                  `**Akun Dibuat:** <t:${createdUnix}:F>`,
                  `**Join Server:** ${joinedUnix ? `<t:${joinedUnix}:F>` : "—"}`,
                  `**Relative:** <t:${createdUnix}:R>${joinedUnix ? ` • <t:${joinedUnix}:R>` : ""}`,
                ].join("\n"),
                inline: true,
              },
              { name: "🕯️ AFK", value: afkText, inline: false },
              { name: "🪪 ID Card", value: idText.length > 1024 ? idText.slice(0, 1020) + "…" : idText, inline: false },
              { name: "🔮 Student Sorting", value: sortText, inline: true },
              { name: "🏷️ Highest Role", value: topRole ? `${topRole} *(pos ${topRole.position})*` : "—", inline: true },
              { name: "🎭 Roles", value: rolesWithPrefix(roleMentions, 12), inline: false }
            )
            .setFooter({ text: `${BRAND_NAME} • Student Registry` })
            .setTimestamp();

          if (bannerUrl) embed.setImage(bannerUrl);

          return { embed, idData, sorted, afk };
        }

        function profileButtons({ hasIdCard, hasSorted, isAfk }) {
          return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("profile:view_idcard")
              .setLabel("Lihat ID Card")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(!hasIdCard)
              .setEmoji("🪪"),

            new ButtonBuilder()
              .setCustomId("profile:view_house")
              .setLabel("Lihat House Card")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(!hasIdCard || !hasSorted)
              .setEmoji("🏰"),

            new ButtonBuilder()
              .setCustomId(isAfk ? "profile:afk_clear" : "profile:afk_set")
              .setLabel(isAfk ? "Hapus AFK" : "Set AFK")
              .setStyle(isAfk ? ButtonStyle.Danger : ButtonStyle.Primary)
              .setEmoji(isAfk ? "🧹" : "🕯️")
          );
        }

        function rolesWithPrefix(roleMentions, max = 12) {
          // roleMentions: array string kayak "<@&id>"
          const shown = roleMentions.slice(0, max);
          const more = Math.max(0, roleMentions.length - shown.length);

          // prefix numbering kecil
          const nums = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩","⑪","⑫","⑬","⑭","⑮"];

          const lines = shown.map((r, i) => `${nums[i] || "•"} ${r}`);
          if (more) lines.push(`…dan **${more}** role lain.`);
          return lines.length ? lines.join("\n") : "—";
        }

        function buildProfileAfkModal(defaultReason = "") {
          const modal = new ModalBuilder().setCustomId("profile:afk_submit").setTitle("🕯️ Set / Update AFK");

          const reasonInput = new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Alasan AFK")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(80)
            .setRequired(true)
            .setValue(String(defaultReason || "").slice(0, 80));

          modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
          return modal;
        }

        function safeText(s, max = 32) {
          return String(s || "")
            .replace(/[\r\n\t]/g, " ")
            .trim()
            .slice(0, max);
        }

        async function safeReply(interaction, payload) {
          try {
            if (interaction.deferred) return await interaction.editReply(payload);
            if (interaction.replied) return await interaction.followUp(payload);
            return await interaction.reply(payload);
          } catch (e) {
            console.error("[safeReply] failed:", e?.message || e);
          }
        }

        async function safeDefer(interaction, ephemeral = true) {
          try {
            if (interaction.deferred || interaction.replied) return;
            await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
          } catch (e) {
            console.error("[safeDefer] failed:", e?.message || e);
          }
        }

        async function safeDeferUpdate(interaction) {
          try {
            if (interaction.deferred || interaction.replied) return;
            await interaction.deferUpdate();
          } catch (e) {
            console.error("[safeDeferUpdate] failed:", e?.message || e);
          }
        }

        async function getTextChannelOrNull(guild, id) {
          if (!guild || !id) return null;
          try {
            const ch = await guild.channels.fetch(id);
            if (!ch) return null;
            if (!ch.isTextBased?.()) return null;
            return ch;
          } catch {
            return null;
          }
        }

        async function getRoleOrNull(guild, roleId) {
          if (!guild || !roleId) return null;
          try {
            const role = await guild.roles.fetch(roleId);
            return role || null;
          } catch {
            return null;
          }
        }

        function genCardNumber(userId) {
          const raw = `${userId}${Date.now()}`.replace(/\D/g, "");
          return raw.slice(-16).padStart(16, "0");
        }

        function formatIdDate(ms) {
          try {
            return new Date(ms).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            });
          } catch {
            return "—";
          }
        }

// ===================== WELCOME =====================
const WELCOME_MESSAGES = [
  (m, g) => `✨ lonceng kristal berdentang lembut di menara akademi saat gerbang terbuka untukmu. ${m}, selamat datang di ${g}. di tempat ini, ilmu, percakapan, dan misteri dijaga bersama. jelajahi aula dengan rasa hormat, ikuti tatanan yang berlaku, dan biarkan perjalananmu berkembang dengan tenang. 🌙`,
  (m, g) => `🔮 tinta arcane kembali mengalir di buku induk akademi, menuliskan satu nama baru: ${m}. selamat datang di ${g}. luangkan waktu untuk memahami aturan yang menjaga keseimbangan kami, agar setiap langkahmu selaras dengan suasana dan kebijaksanaan tempat ini. ✨`,
  (m, g) => `🕯️ cahaya lilin menyala satu per satu di lorong batu tua saat kakimu melangkah masuk. ${m}, selamat datang di ${g}. semoga harimu hangat dan percakapanmu membawa kebaikan. ingatlah untuk menghormati sesama murid dan menaati tata tertib akademi. 🌿`,
  (m, g) => `🌌 angin senja berbisik dari menara observatorium: seorang murid baru telah tiba. ${m}, selamat datang di ${g}. sebelum memulai petualanganmu, luangkan sejenak membaca aturan agar setiap interaksi tetap aman, nyaman, dan bermakna. ✨`,
  (m, g) => `📜 arsip kuno kembali terbuka, menyambut satu nama yang kini tercatat di dalamnya. selamat datang ${m} di ${g}. akademi ini berdiri atas rasa saling menghormati, maka jagalah tutur kata dan patuhi ketentuan yang telah disepakati bersama. 🔮`,
  (m, g) => `🜂 nyala api di aula utama bergetar pelan, menandai kedatanganmu. ${m}, selamat datang di ${g}. belajarlah dengan bebas, berdiskusilah dengan bijak, dan jangan lupa mengikuti aturan agar keseimbangan akademi tetap terjaga. 🌙`,
  (m, g) => `🌙 bulan menggantung tenang di atas menara saat kau resmi diterima. ${m}, selamat datang di ${g}. kami mengundangmu untuk berpartisipasi dengan sopan, menghormati batasan, dan menaati tata tertib yang menjaga keharmonisan bersama. ✨`,
  (m, g) => `🔔 bel akademi berbunyi lirih, seolah menyapa langkah barumu. ${m}, selamat datang di ${g}. sebelum menjelajah lebih jauh, pastikan kau memahami aturan dasar agar setiap ruang tetap menjadi tempat yang aman dan menyenangkan. 🕯️`,
  (m, g) => `🕯️ cahaya hangat di ruang studi menyambut kehadiranmu. ${m}, kini kau bagian dari ${g}. gunakan ruang ini dengan bijaksana, hormati sesama, dan ikuti aturan yang ada agar semua dapat belajar dengan nyaman. 🌿`,
  (m, g) => `🌌 bintang-bintang menjadi saksi langkah pertamamu di akademi. ${m}, selamat datang di ${g}. kebebasan berekspresi dihargai di sini, selama tetap selaras dengan aturan dan rasa hormat terhadap yang lain. ✨`,
  (m, g) => `📖 sebuah halaman kosong terbuka di mejamu, menunggu kisah yang akan kau tulis. ${m}, selamat datang di ${g}. sebelum menorehkan ceritamu, luangkan waktu memahami tata tertib agar perjalananmu berjalan tanpa hambatan. 🔮`,
  (m, g) => `🜄 gemericik air di taman arcane mengiringi langkahmu masuk. ${m}, selamat datang di ${g}. jaga ketenangan, hargai perbedaan, dan patuhi aturan agar suasana akademi tetap seimbang dan damai. 🌙`,
  (m, g) => `✨ gema mantra penyambutan terdengar lembut di aula utama. ${m} kini resmi bergabung dengan ${g}. kami percaya setiap murid mampu menjaga sikap dan menaati aturan demi kenyamanan bersama. 🕯️`,
  (m, g) => `🔮 para penjaga arsip menatap tenang saat satu nama baru dicatat. ${m}, selamat datang di ${g}. ikutilah ketentuan yang telah ditetapkan, karena di sanalah kebijaksanaan akademi dijaga. 🌌`,
  (m, g) => `🌿 dedaunan di halaman dalam bergoyang pelan, menyambut kehadiranmu. ${m}, selamat datang di ${g}. nikmati perjalananmu, jalin percakapan yang baik, dan jangan lupa menaati aturan agar keharmonisan tetap terjaga. ✨`,
];


// ===================== INIT DB =====================
async function initDb() {
  await dbExec(`
    CREATE TABLE IF NOT EXISTS menfess_posts (
      id INTEGER PRIMARY KEY,
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

    CREATE TABLE IF NOT EXISTS menfess_meta (
      key TEXT PRIMARY KEY,
      value INTEGER
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

// ===================== META (TEXT) =====================
async function getMetaText(key) {
  const r = await safeGet(`SELECT value FROM app_meta WHERE key=?`, [key]);
  return r?.value ?? null;
}

async function setMetaText(key, value) {
  await dbRun(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [key, String(value)]
  );
}
// ===================== MENFESS COUNTER =====================
async function ensureMenfessCounterStart() {
  const MIN_LAST_ID = 106;

  let row = null;
  let maxRow = { m: 0 };

  try {
    row = await dbGet(`SELECT value FROM menfess_meta WHERE key='menfess_last_id'`);
  } catch {
    row = null;
  }

  try {
    maxRow = await dbGet(`SELECT COALESCE(MAX(id), 0) AS m FROM menfess_posts`);
  } catch {
    maxRow = { m: 0 };
  }

  const maxId = Number(maxRow?.m || 0);

  if (!row) {
    const startLastId = Math.max(MIN_LAST_ID, maxId);
    await dbRun(`INSERT INTO menfess_meta (key, value) VALUES ('menfess_last_id', ?)`, [startLastId]);
    return;
  }

  const cur = Number(row.value || 0);
  const fixed = Math.max(cur, MIN_LAST_ID, maxId);
  if (fixed !== cur) {
    await dbRun(`UPDATE menfess_meta SET value=? WHERE key='menfess_last_id'`, [fixed]);
  }
}


// ===================== MENFESS =====================
const menfessCooldown = new Map();

function isBadAlias(alias) {
  if (/[<@#>]/.test(alias)) return true;
  const low = alias.toLowerCase();
  const blocked = ["admin", "owner", "mod", "moderator", "staff"];
  return blocked.some((w) => low.includes(w));
}

async function getAnonLabel(userId) {
  const row = await safeGet("SELECT anon_label FROM menfess_anonmap WHERE user_id=?", [userId]);
  if (row?.anon_label) return row.anon_label;

  const c = await safeGet("SELECT COUNT(*) AS n FROM menfess_anonmap");
  const n = Number(c?.n || 0) + 1;

  const label = `Anon #${String(n).padStart(3, "0")}`;

  await safeRun(
    `INSERT INTO menfess_anonmap (user_id, anon_label)
     VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET anon_label=excluded.anon_label`,
    [userId, label]
  );

  return label;
}

async function insertMenfessPost({ id, messageId, channelId }) {
  await dbRun(
    `INSERT INTO menfess_posts (id, message_id, channel_id, created_at)
     VALUES (?,?,?,?)`,
    [id, messageId || null, channelId || null, Date.now()]
  );
  return id;
}

async function updateMenfessPostLink(id, { messageId, channelId }) {
  await dbRun(`UPDATE menfess_posts SET message_id=?, channel_id=? WHERE id=?`, [messageId, channelId, Number(id)]);
}

async function getMenfessPostById(id) {
  return (await safeGet(
    `SELECT id, message_id, channel_id, created_at FROM menfess_posts WHERE id=?`,
    [Number(id)]
  )) || null;
}

async function sendMenfessLog(guild, payload) {
  const logId = requireEnv("MENFESS_LOG_CHANNEL_ID");
  if (!logId) return;
  const logCh = await getTextChannelOrNull(guild, logId);
  if (!logCh) return;
  try {
    await logCh.send(payload);
  } catch (e) {
    console.error("[MENFESS LOG] failed:", e?.message || e);
  }
}

// ===================== TICKET HELPERS =====================
function ticketIsStaff(member) {
  const staffRoleId = requireEnv("TICKET_STAFF_ROLE_ID");
  if (!staffRoleId) return false;
  return Boolean(member?.roles?.cache?.has?.(staffRoleId));
}

async function getTicketLogChannel(guild) {
  const logId = requireEnv("TICKET_LOG_CHANNEL_ID");
  if (!logId) return null;
  return await getTextChannelOrNull(guild, logId);
}

function ticketMeta(type, userId) {
  // simpan owner & type di topic biar persist
  return `[TICKET:${type}] [OWNER:${userId}]`;
}
function getTicketOwnerIdFromTopic(topic) {
  const m = String(topic || "").match(/\[OWNER:(\d{15,25})\]/);
  return m ? m[1] : null;
}
function getTicketTypeFromTopic(topic) {
  const m = String(topic || "").match(/\[TICKET:(complaint|report)\]/);
  return m ? m[1] : null;
}
function getClaimedFromTopic(topic) {
  const m = String(topic || "").match(/\[CLAIMED:(\d{15,25})\]/);
  return m ? m[1] : null;
}
function setClaimedTopic(topic, staffId) {
  const clean = String(topic || "").replace(/\s*\[CLAIMED:\d{15,25}\]\s*/g, "").trim();
  return `${clean} [CLAIMED:${staffId}]`.trim();
}

async function buildTicketTranscript(channel) {
  const limit = Number(process.env.TICKET_TRANSCRIPT_LIMIT || 300);

  const all = [];
  let before = undefined;

  while (all.length < limit) {
    const batch = await channel.messages.fetch({ limit: Math.min(100, limit - all.length), before }).catch(() => null);
    if (!batch || batch.size === 0) break;

    const arr = [...batch.values()];
    all.push(...arr);
    before = arr[arr.length - 1].id;
  }

  all.sort((a, b) => (a.createdTimestamp || 0) - (b.createdTimestamp || 0));

  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const txt = all
    .map((m) => {
      const time = new Date(m.createdTimestamp || Date.now()).toLocaleString("id-ID");
      const author = `${m.author?.tag || "Unknown"} (${m.author?.id || "—"})`;
      const content = m.content || "";
      const attach = m.attachments?.size ? ` [attachments: ${[...m.attachments.values()].map((x) => x.url).join(" ")}]` : "";
      return `[${time}] ${author}: ${content}${attach}`;
    })
    .join("\n");

  const htmlRows = all
    .map((m) => {
      const time = new Date(m.createdTimestamp || Date.now()).toLocaleString("id-ID");
      const author = `${m.author?.tag || "Unknown"} (${m.author?.id || "—"})`;
      const content = esc(m.content || "");
      const attach = m.attachments?.size
        ? `<div class="att">📎 ${[...m.attachments.values()]
            .map((x) => `<a href="${esc(x.url)}">${esc(x.name || "file")}</a>`)
            .join(" • ")}</div>`
        : "";
      return `<div class="msg">
  <div class="meta"><span class="time">${esc(time)}</span> • <span class="author">${esc(author)}</span></div>
  <div class="content">${content ? content.replace(/\n/g, "<br/>") : "<i>(no content)</i>"}</div>
  ${attach}
</div>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Ticket Transcript</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; background:#0b0716; color:#f4eeff; padding:24px;}
  .wrap{max-width:920px; margin:0 auto;}
  .head{padding:16px 18px; border:1px solid rgba(255,255,255,.12); border-radius:14px; background:rgba(20,16,42,.55); margin-bottom:14px;}
  .msg{padding:12px 14px; border:1px solid rgba(255,255,255,.10); border-radius:14px; background:rgba(10,8,22,.62); margin:10px 0;}
  .meta{opacity:.85; font-size:12px; margin-bottom:6px}
  .content{font-size:14px; line-height:1.45}
  .att{margin-top:8px; font-size:12px; opacity:.9}
  a{color:#a78bfa; text-decoration:none}
  a:hover{text-decoration:underline}
</style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div style="font-weight:800; font-size:16px">Mystral Academy — Ticket Transcript</div>
      <div style="opacity:.85; font-size:12px">Channel: ${esc(channel.name)} • Exported: ${esc(new Date().toLocaleString("id-ID"))}</div>
    </div>
    ${htmlRows || "<i>(no messages)</i>"}
  </div>
</body>
</html>`;

  return {
    count: all.length,
    txtBuffer: Buffer.from(txt || "(no messages)", "utf8"),
    htmlBuffer: Buffer.from(html, "utf8"),
  };
}


// ===================== ID CARD (DB) =====================
async function getIdCard(userId) {
  return (await safeGet(`SELECT * FROM idcard_users WHERE user_id=?`, [userId])) || null;
}

async function upsertIdCard(userId, data) {
  const existing = await getIdCard(userId);
  const createdAt = existing?.created_at ? Number(existing.created_at) : Date.now();
  const number = existing?.number || data.number || genCardNumber(userId);

  await dbRun(
    `INSERT INTO idcard_users (user_id, number, name, gender, domisili, hobi, status, theme, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET
       name=excluded.name,
       gender=excluded.gender,
       domisili=excluded.domisili,
       hobi=excluded.hobi,
       status=excluded.status,
       theme=excluded.theme,
       number=excluded.number,
       updated_at=excluded.updated_at`,
    [userId, number, data.name, data.gender, data.domisili, data.hobi, data.status, data.theme, createdAt, Date.now()]
  );

  return getIdCard(userId);
}

async function countRegistry() {
  const r = await safeGet(`SELECT COUNT(*) AS n FROM idcard_users`);
  return Number(r?.n || 0);
}

async function registryPage(offset, limit) {
  return (await safeAll(
    `SELECT user_id, name, created_at
     FROM idcard_users
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [Number(limit), Number(offset)]
  )) || [];
}

// ===== AFK Nick Helpers (prefix [AFK]) =====
function withAfkPrefix(nickOrName) {
  const base = String(nickOrName || "").trim() || "User";
  if (/^\[AFK\]\s*/i.test(base)) return base;
  const tagged = `[AFK] ${base}`;
  return tagged.length > 32 ? tagged.slice(0, 32) : tagged;
}

function stripAfkPrefix(nickOrName) {
  return String(nickOrName || "").replace(/^\[AFK\]\s*/i, "").trim();
}

async function trySetMemberNick(member, nickOrNull) {
  try {
    if (!member) return false;
    // manageable = bot punya izin & hierarchy aman (owner / role tinggi biasanya false)
    if (!member.manageable) return false;

    // null = reset nickname (balik ke username)
    await member.setNickname(nickOrNull);
    return true;
  } catch (e) {
    console.warn("[AFK] setNickname failed:", e?.message || e);
    return false;
  }
}

// ===================== AFK =====================
async function setAfk(userId, reason) {
  await dbRun(
    `INSERT INTO afk_users (user_id, reason, since)
     VALUES (?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET reason=excluded.reason, since=excluded.since`,
    [userId, safeText(reason || "AFK", 80), Date.now()]
  );
}

async function clearAfk(userId) {
  try {
    const r = await dbRun(`DELETE FROM afk_users WHERE user_id=?`, [userId]);
    return (r?.changes || 0) > 0;
  } catch {
    return false;
  }
}

async function getAfk(userId) {
  try {
    return (await dbGet(`SELECT reason, since FROM afk_users WHERE user_id=?`, [userId])) || null;
  } catch {
    return null;
  }
}

// ===================== SORTING (LOCK) =====================
async function getSortedUser(userId) {
  return (await safeGet(
    `SELECT user_id, choice, at FROM sorting_users WHERE user_id=?`,
    [userId]
  )) || null;
}

async function setSortedUser(userId, choice) {
  await dbRun(
    `INSERT INTO sorting_users (user_id, choice, at)
     VALUES (?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET choice=excluded.choice, at=excluded.at`,
    [userId, choice, Date.now()]
  );
}

// ===================== SORTING BAG SYSTEM =====================
const SORT_BAG_SIZE = Number(process.env.SORT_BAG_SIZE || 20);
const SORT_BAG_KEY = "sorting_bag_json";
const SORT_BAG_IDX_KEY = "sorting_bag_idx";
const SORT_LAST_KEY = "sorting_last_choice";

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function loadOrCreateBag() {
  let bagJson = await getMetaText(SORT_BAG_KEY);
  let idxStr = await getMetaText(SORT_BAG_IDX_KEY);

  let bag = null;
  let idx = Number(idxStr || 0);

  if (bagJson) {
    try {
      bag = JSON.parse(bagJson);
      if (!Array.isArray(bag)) bag = null;
    } catch {
      bag = null;
    }
  }

  if (!bag || bag.length < 2 || idx >= bag.length) {
    const size = SORT_BAG_SIZE % 2 === 0 ? SORT_BAG_SIZE : SORT_BAG_SIZE + 1;
    const half = Math.floor(size / 2);
    bag = [];
    for (let i = 0; i < half; i++) bag.push("light");
    for (let i = 0; i < half; i++) bag.push("dark");

    shuffleInPlace(bag);

    idx = 0;
    await setMetaText(SORT_BAG_KEY, JSON.stringify(bag));
    await setMetaText(SORT_BAG_IDX_KEY, String(idx));
  }

  return { bag, idx };
}

async function pickChoiceFromBag() {
  const { bag, idx } = await loadOrCreateBag();
  const choice = bag[idx];

  await setMetaText(SORT_BAG_IDX_KEY, String(idx + 1));
  return choice === "dark" ? "dark" : "light";
}

async function pickChoiceBagMoreNatural() {
  const last = (await getMetaText(SORT_LAST_KEY)) || null;

  let choice = await pickChoiceFromBag();

  if (last && choice === last) {
    const { bag } = await loadOrCreateBag();
    const curIdx = Number((await getMetaText(SORT_BAG_IDX_KEY)) || 0);
    if (curIdx < bag.length) {
      const alt = bag[curIdx];
      await setMetaText(SORT_BAG_IDX_KEY, String(curIdx + 1));
      choice = alt === "dark" ? "dark" : "light";
    }
  }

  await setMetaText(SORT_LAST_KEY, choice);
  return choice;
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

// ===================== ID CARD RENDER =====================
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
  const x = pad,
    y = pad,
    cw = w - pad * 2,
    ch = h - pad * 2;

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
  setFont(ctx, "bold", 46);
  ctx.fillText(ID_CARD_TITLE, x + 34, y + 82);

  ctx.fillStyle = subInk;
  setFont(ctx, "normal", 20);
  ctx.fillText("Mystral Academy • Verified in the arcane", x + 36, y + 114);

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
    setFont(ctx, "bold", 18);
    ctx.fillText(label, lx, yy);

    ctx.fillStyle = ink;
    setFont(ctx, "bold", 22);
    ctx.fillText(value, lx + 210, yy);
  };

  drawRow("No ID", String(number || "—"), 0);
  drawRow("Nama", String(name || "—"), 1);
  drawRow("Gender", String(gender || "—"), 2);
  drawRow("Domisili", String(domisili || "—"), 3);
  drawRow("Hobi", String(hobi || "—"), 4);
  drawRow("Status", String(status || "—"), 5);

  ctx.fillStyle = subInk;
  setFont(ctx, "normal", 16);
  ctx.fillText(`© Mystral • ${BRAND_NAME}`, x + 36, y + ch - 28);

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
  setFont(ctx, "bold", 16);
  ctx.fillText("Tanggal Dibuat", cx, dateTop);

  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px + 28, dateTop + 12);
  ctx.lineTo(px + pw - 28, dateTop + 12);
  ctx.stroke();

  ctx.fillStyle = ink;
  setFont(ctx, "bold", 20);
  ctx.fillText(String(createdAtText || "—"), cx, dateTop + 38);

  ctx.textAlign = "left";
  return canvas.toBuffer("image/png");
}

// ===================== HOUSE CARD RENDER =====================
async function renderHouseCard({ choice, name, gender, hovId, avatarUrl }) {
  const w = 980;
  const h = 360;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");

  const isDark = choice === "dark";

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

  drawParticles(ctx, { x: 0, y: 0, w, h }, isDark ? "dark" : "light");

  const pad = 26;
  const x = pad,
    y = pad,
    cw = w - pad * 2,
    ch = h - pad * 2;

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
  setFont(ctx, "bold", 34);
  ctx.fillText("MYSTRAL ACADEMY", x + 34, y + 64);

  ctx.fillStyle = subInk;
  setFont(ctx, "bold", 20);
  ctx.fillText(isDark ? "DARK STUDENT" : "LIGHT STUDENT", x + 34, y + 98);

  const lx = x + 34;
  const top = y + 150;
  const gap = 44;

  const row = (label, value, idx) => {
    const yy = top + idx * gap;
    ctx.fillStyle = subInk;
    setFont(ctx, "bold", 18);
    ctx.fillText(label, lx, yy);

    ctx.fillStyle = ink;
    setFont(ctx, "bold", 22);
    ctx.fillText(value, lx + 160, yy);
  };

  row("Nama", safeText(name, 26), 0);
  row("Gender", safeText(gender, 10), 1);
  row("HOV ID", safeText(hovId, 24), 2);

  const avSize = 190;
  const avX = x + cw - avSize - 44;
  const avY = y + 96;

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
  setFont(ctx, "normal", 16);
  ctx.fillText(isDark ? "“Bearer of the Shadow”" : "“Bearer of the Light”", x + 34, y + ch - 28);

  return canvas.toBuffer("image/png");
}

// ===================== PANELS =====================
function sortingPanelEmbed() {
  const LIGHT = process.env.LIGHT_EMOJI || "✨";
  const DARK = process.env.DARK_EMOJI || "🌙";

  return new EmbedBuilder()
    .setTitle("🧙 Student Sorting — Mystral Academy")
    .setColor(EMBED_COLOR)
    .setDescription(
      [
        "When the veil thins, destiny answers.",
        "",
        "Lingkaran arcane kembali aktif, memanggil setiap jiwa yang melangkah ke dalam wilayah Mystral Academy.",
        `Dengan menyentuh segel di bawah, kau akan memasuki **Ritual Pemilahan Arcane**—hukum kuno yang menentukan afiliasimu.`,
        "",
        "✧ Arcane akan membaca gema jiwamu dan menetapkan satu jalan:",
        `${LIGHT} **Light Student** — cahaya, tatanan, dan penjaga keseimbangan kerajaan`,
        `${DARK} **Dark Student** — bayangan, kehendak bebas, dan kekuatan tersembunyi`,
        "",
        "╭──────────────────────────╮",
        "📜 **Prasyarat Ritual**",
        "Hanya mereka yang telah memiliki **Mystral ID Card**",
        "(dengan mantra **/idcard**)",
        "yang diizinkan memasuki lingkaran ini.",
        "",
        "<:segelsihir:1459542892816236747>**Segel Takdir**",
        "Ritual ini hanya dapat dijalankan **satu kali**.",
        "Setelah arcane memilih, hasilnya akan **terkunci selamanya**.",
        "",
        "<:hukum:1459542952907898881> **Hukum Academy Mystral**",
        "Seluruh peran lain yang telah kau miliki",
        "akan tetap utuh dan tidak terpengaruh oleh ritual ini.",
        "╰──────────────────────────╯",
        "",
        "Kini, berdirilah di dalam lingkaran.",
        "**Takdir tidak menunggu mereka yang ragu.**",
      ].join("\n")
    )
    .setFooter({ text: "Sentuh segel untuk memulai Ritual Pemilahan Student." });
}

function sortingPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("sorting:roll").setLabel("Mulai Ritual").setStyle(ButtonStyle.Primary).setEmoji("<:witch:1459543006813229199>")
  );
}

function menfessPanelEmbed() {
  return new EmbedBuilder()
    .setTitle("🕯️ MENFESS")
    .setColor(EMBED_COLOR)
    .setDescription("Klik tombol untuk kirim menfess **anonim**.\nBalasan juga anonim.")
    .setFooter({ text: "No doxxing / hate / threat. Keep it safe." });
}

function menfessPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("menfess:new").setLabel("Kirim Menfess").setStyle(ButtonStyle.Success).setEmoji("✉️")
  );
}

function ticketPanelEmbed() {
  return new EmbedBuilder()
    .setTitle("🎫 Arcane Support Desk — Mystral Academy")
    .setColor(EMBED_COLOR)
    .setDescription(
      [
        "Jika kau mengalami gangguan, kebingungan, atau menemukan pelanggaran tatanan akademi—",
        "buka ticket secara privat di sini.",
        "",
        "🕯️ **Keluhan** — pengalaman tidak nyaman / konflik / hal pribadi",
        "⚠️ **Report** — pelanggaran aturan / tindakan meresahkan",
        "",
        "🔐 Ticket bersifat **rahasia**: hanya kamu & staff yang dapat melihatnya.",
        "Tolong tulis kronologi dengan jelas agar cepat ditangani.",
      ].join("\n")
    )
    .setFooter({ text: "Mystral Academy • Speak freely, we will listen." });
}

function ticketPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket:open:complaint").setLabel("Buat Keluhan").setStyle(ButtonStyle.Primary).setEmoji("🕯️"),
    new ButtonBuilder().setCustomId("ticket:open:report").setLabel("Buat Report").setStyle(ButtonStyle.Danger).setEmoji("⚠️")
  );
}

// ===================== HOUSECARD POST =====================
async function postHouseCard(guild, user, choice) {
  const houseChId = requireEnv("HOUSECARD_CHANNEL_ID");
  const houseChannel = await getTextChannelOrNull(guild, houseChId);
  if (!houseChannel) return false;

  const idData = await getIdCard(user.id);
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
    .setTitle("🪪 Mystral Academy Card")
    .setColor(EMBED_COLOR)
    .setDescription(
      [
        `**Member:** <@${user.id}>`,
        `**Student:** ${choice === "dark" ? "<:dark:1459543141609771101> Dark Student" : "<:light:1459543076736336004> Light Student"}`,
      ].join("\n")
    )
    .setImage(`attachment://${filename}`)
    .setFooter({ text: "Mystral Academy • Student Registry" })
    .setTimestamp();

  await houseChannel.send({
    content: `📜 Takdir telah ditetapkan untuk <@${user.id}>.`,
    embeds: [embed],
    files: [file],
    allowedMentions: { parse: [] },
  });

  return true;
}

// ===================== REGISTRY UI =====================
function registryEmbed(pageIndex, totalPages, totalUsers, pageRows) {
  const desc =
    pageRows.length === 0
      ? "Belum ada student yang terdaftar ID Card."
      : pageRows
          .map((x, idx) => {
            const num = pageIndex * 10 + idx + 1;
            const dateUnix = x.created_at ? Math.floor(Number(x.created_at) / 1000) : null;
            const dateText = dateUnix ? `<t:${dateUnix}:D>` : "—";
            return `**${num}.** <@${x.user_id}> • **${safeText(x.name, 24) || "—"}** • ${dateText}`;
          })
          .join("\n");

  return new EmbedBuilder()
    .setTitle("🗂️ MYSA Registry — Student Terdaftar")
    .setDescription(desc)
    .setColor(EMBED_COLOR)
    .setFooter({ text: `Page ${pageIndex + 1} / ${totalPages} • Total: ${totalUsers}` })
    .setTimestamp();
}

function registryRow(pageIndex, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`registry:prev:${pageIndex}`).setLabel("Prev").setStyle(ButtonStyle.Secondary).setDisabled(pageIndex <= 0),
    new ButtonBuilder().setCustomId(`registry:next:${pageIndex}`).setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(pageIndex >= totalPages - 1)
  );
}

// ===================== READY =====================
client.once(Events.ClientReady, async (c) => {
  console.log(`ONLINE AS: ${c.user.tag} | ID: ${c.user.id}`);
  console.log("[DB] SQLite ready:", SQLITE_PATH);

  if (!process.env.BOT_OWNER_ID || process.env.BOT_OWNER_ID === "ISI_USERID_KAMU") {
    console.warn("[WARN] BOT_OWNER_ID belum diisi bener. Owner-only lock bakal ngaco.");
  }

  const statuses = ["🌙 menjaga gerbang realm", 
                  "🔮 membisikkan mantra penyambutan", 
                  "🕯️ menjaga cahaya di Aula Academy Mystral",
                  "✨ panggil aku dengan mantra /halo"
                ];
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

    // initial stats update
  c.guilds.cache.forEach(g => updateStatsChannels(g));

  // interval update
  setInterval(() => {
    c.guilds.cache.forEach(g => updateStatsChannels(g));
  }, (Number(process.env.STATS_UPDATE_MIN) || 5) * 60 * 1000);

});

// ===================== AUTO WELCOME =====================
client.on(Events.GuildMemberAdd, async (member) => {
  const channel = await getTextChannelOrNull(member.guild, requireEnv("GENERAL_CHANNEL_ID"));
  if (!channel) return;

  const mention = `<@${member.id}>`;
  const guildName = `**${member.guild.name}**`;
  const msg = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)](mention, guildName);
  channel.send(msg).catch(() => {});

    updateStatsChannels(member.guild);
});

client.on(Events.GuildMemberRemove, async (member) => {
  updateStatsChannels(member.guild);
});

// ===================== PREFIX COMMANDS =====================
client.on(Events.MessageCreate, async (message) => {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

   // AFK auto clear on any message
  const wasAfk = await getAfk(message.author.id);
  if (wasAfk) {
    await clearAfk(message.author.id);

  // balikin nickname (hapus prefix [AFK])
  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (member) {
    const current = member.nickname || message.author.username;
    const restored = stripAfkPrefix(current);
    // kalau restored kosong, reset nickname
    await trySetMemberNick(member, restored || null);
  }

  await message
    .reply({
      content: `✅ welcome back <@${message.author.id}>! status AFK kamu sudah dihapus.`,
      allowedMentions: { repliedUser: false, parse: [] },
    })
    .catch(() => {});
}


    // AFK notice on mentions
    if (message.mentions?.users?.size) {
      const lines = [];
      for (const [uid, user] of message.mentions.users) {
        if (user.bot) continue;
        const afk = await getAfk(uid);
        if (!afk) continue;

        const sinceUnix = Math.floor((Number(afk.since) || Date.now()) / 1000);
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
    }

    // Prefix check
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = args.shift()?.toLowerCase();

    // OWNER ONLY prefix commands (panel/idcard)
    const ownerOnly = ["menfesspanel", "sortingpanel", "idcard"];
    if (ownerOnly.includes(cmd) && !isBotOwner(message.author.id)) {
      return message.reply({ content: "❌ command ini cuma buat pembuat bot.", allowedMentions: { repliedUser: false } });
    }

    // cping
    if (cmd === "ping") {
      return message.reply(`🏓 pong! ${message.client.ws.ping}ms`);
    }

   // chelp / chalp
    if (cmd === "help" || cmd === "hai") {
    const embed = new EmbedBuilder()
      .setTitle("📚 Mystral Assistant — Help")
      .setColor(EMBED_COLOR)
      .setDescription(
        [
          "Daftar perintah yang tersedia di server ini.",
          "Gunakan **slash command (/)** atau **prefix command** sesuai kebutuhan.",
        ].join("\n")
      )
      .addFields(
        {
          name: "✨ Slash Commands",
          value: [
            "• `/profile` — lihat profil pengguna",
            "• `/idcard` — buat atau lihat ID Card",
          ].join("\n"),
          inline: false,
        },
        {
          name: "⌨️ Prefix Commands",
          value: [
            `• \`${PREFIX}help\` — tampilkan help`,
            `• \`${PREFIX}ping\` — cek ping bot`,
            `• \`${PREFIX}halo\` — sapaan`,
            `• \`${PREFIX}afk [alasan]\` — set AFK`,
            `• \`${PREFIX}userinfo [@user]\``,
            `• \`${PREFIX}avatar [@user]\``,
            `• \`${PREFIX}serverinfo\``,
          ].join("\n"),
          inline: false,
        },
        {
          name: "🔐 Owner-only",
          value: [
            "• `/menfesspanel`",
            "• `/sortingpanel`",
            "• `/selfrolespanel`",
            "• `/sendembed`",
            "• `/idcard`",
          ].join("\n"),
          inline: false,
        }
      )
      .setFooter({ text: "Mystral Academy • Help Center" })
      .setTimestamp();
      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false, parse: [] } });
    }

    // chalo (prefix) tetap ada sebagai sapaan singkat
    if (cmd === "halo") {
      return message.reply(`✨ salam, <@${message.author.id}>. gerbang Mystral menyambutmu. 🕯️`);
    }

    // cembed
    if (cmd === "embed") {
      if (!isBotOwner(message.author.id)) {
        return message.reply({ content: "❌ command ini cuma buat pembuat bot.", allowedMentions: { repliedUser: false } });
      }

      const raw = args.join(" ");
      const parts = raw.split("|").map((s) => s.trim()).filter(Boolean);

      if (parts.length < 2) {
        return message.reply({
          content: "Format: `cembed Judul | Deskripsi` (opsional warna: `| #77d0d7`)",
          allowedMentions: { repliedUser: false },
        });
      }

      const title = parts[0];
      let description = parts[1];
      let color = EMBED_COLOR;

      // kalau ada argumen 3 dan bentuknya hex, anggap warna
      if (parts[2] && /^#?[0-9a-fA-F]{6}$/.test(parts[2])) {
        color = parseInt(parts[2].replace("#", ""), 16);
      } else if (parts.length > 2) {
        // kalau bukan warna, gabungkan ke deskripsi biar nggak hilang
        description = parts.slice(1).join("\n");
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setFooter({ text: "Mystral Academy • Arcane Notice" })
        .setTimestamp();

      await message.channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
      return message.reply({ content: "✅ embed terkirim.", allowedMentions: { repliedUser: false } });
    }


    //cticketpanel
    if (cmd === "ticketpanel") {
      if (!isBotOwner(message.author.id)) {
        return message.reply({ content: "❌ command ini cuma buat pembuat bot.", allowedMentions: { repliedUser: false } });
      }
      await message.channel.send({ embeds: [ticketPanelEmbed()], components: [ticketPanelRow()], allowedMentions: { parse: [] } });
      return message.reply({ content: "✅ panel ticket terkirim.", allowedMentions: { repliedUser: false } });
    }

    // cavatar
    if (cmd === "avatar") {
      const mentioned = message.mentions.users.first();
      let user = mentioned || message.author;

      if (!mentioned && args[0] && /^\d{15,25}$/.test(args[0])) {
        const fetched = await message.client.users.fetch(args[0]).catch(() => null);
        if (fetched) user = fetched;
      }

      const embed = new EmbedBuilder()
        .setTitle("🖼️ Avatar")
        .setColor(EMBED_COLOR)
        .setDescription(`Avatar milik <@${user.id}>`)
        .setImage(user.displayAvatarURL({ extension: "png", size: 1024 }))
        .setFooter({ text: BRAND_NAME })
        .setTimestamp();

      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    }

    // cuserinfo (PREFIX)
    if (cmd === "userinfo") {
      const mentioned = message.mentions.users.first();
      let user = mentioned || message.author;

      // allow by ID
      if (!mentioned && args[0] && /^\d{15,25}$/.test(args[0])) {
        const fetched = await message.client.users.fetch(args[0]).catch(() => null);
        if (fetched) user = fetched;
      }

      const guild = message.guild;
      const member = await guild.members.fetch(user.id).catch(() => null);

      // ===== Dates =====
      const createdUnix = Math.floor((user.createdTimestamp || Date.now()) / 1000);
      const joinedUnix = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

      // ===== Roles (HIGHEST -> LOWEST) =====
      const roleList = member
        ? member.roles.cache
            .filter((r) => r.id !== guild.id)
            .sort((a, b) => b.position - a.position)
            .map((r) => r.toString())
        : [];

      const maxRolesShown = 15;
      const rolesShown = roleList.slice(0, maxRolesShown);
      const rolesMore = Math.max(0, roleList.length - rolesShown.length);

      // ===== Highest Role =====
      const topRole =
        member?.roles.cache
          .filter((r) => r.id !== guild.id)
          .sort((a, b) => b.position - a.position)
          .first() || null;

      // ===== Nick / Display =====
      const nickname = member?.nickname || "—";
      const displayName = member?.displayName || user.username;

      // ===== Banner (needs user full fetch) =====
      const userFull = await message.client.users.fetch(user.id, { force: true }).catch(() => null);
      const bannerUrl = userFull?.bannerURL?.({ extension: "png", size: 1024 }) || null;

      const embed = new EmbedBuilder()
        .setTitle(`Mystral Profile — ${displayName}`)
        .setColor(EMBED_COLOR)
        .setThumbnail(user.displayAvatarURL({ extension: "png", size: 256 }))
        .setDescription(`**Mention:** <@${user.id}>`)
        .addFields(
          {
            name: "🪪 Identity",
            value: [
              `**Tag:** ${user.tag}`,
              `**User ID:** \`${user.id}\``,
              `**Nickname:** ${nickname === "—" ? "—" : `\`${nickname}\``}`,
            ].join("\n"),
            inline: true,
          },
          {
            name: "🕰️ Timeline",
            value: [
              `**Akun Dibuat:** <t:${createdUnix}:F>`,
              `**Join Server:** ${joinedUnix ? `<t:${joinedUnix}:F>` : "—"}`,
              `**Relative:** <t:${createdUnix}:R>${joinedUnix ? ` • <t:${joinedUnix}:R>` : ""}`,
            ].join("\n"),
            inline: true,
          },
          {
            name: "🎭 Roles",
            value: roleList.length
              ? `${rolesShown.join(" ")}${rolesMore ? `\n…dan **${rolesMore}** role lain.` : ""}`
              : "—",
            inline: false,
          },
          {
            name: "🏷️ Highest Role",
            value: topRole ? `${topRole} *(pos ${topRole.position})*` : "—",
            inline: true,
          },
          {
            name: "🧩 Server",
            value: `**${guild.name}**\nID: \`${guild.id}\``,
            inline: true,
          }
        )
        .setFooter({ text: `${BRAND_NAME} • Student Registry` })
        .setTimestamp();

      if (bannerUrl) embed.setImage(bannerUrl);

      return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false, parse: [] } });
    }

    // cprofile (PREFIX)
if (cmd === "profile") {
  const mentioned = message.mentions.users.first();
  let user = mentioned || message.author;

  if (!mentioned && args[0] && /^\d{15,25}$/.test(args[0])) {
    const fetched = await message.client.users.fetch(args[0]).catch(() => null);
    if (fetched) user = fetched;
  }

  const guild = message.guild;
  const member = await guild.members.fetch(user.id).catch(() => null);

  const { embed, idData, sorted, afk } = await buildProfileEmbed({ guild, user, member });

  const row = profileButtons({
    hasIdCard: Boolean(idData),
    hasSorted: Boolean(sorted?.choice),
    isAfk: Boolean(afk),
  });

  return message.reply({
    embeds: [embed],
    components: [row],
    allowedMentions: { repliedUser: false, parse: [] },
  });
}

    // cserverinfo
    if (cmd === "serverinfo") {
      const g = message.guild;
      if (!g) return;

      // fetch data
      const owner = await g.fetchOwner().catch(() => null);
      const channels = await g.channels.fetch().catch(() => null);

      // counts
      const totalMembers = g.memberCount ?? 0;

      const channelCount = channels ? channels.size : 0;
      const textCount = channels ? channels.filter((c) => c?.type === 0).size : 0;
      const voiceCount = channels ? channels.filter((c) => c?.type === 2).size : 0;
      const categoryCount = channels ? channels.filter((c) => c?.type === 4).size : 0;
      const forumCount = channels ? channels.filter((c) => c?.type === 15).size : 0;
      const stageCount = channels ? channels.filter((c) => c?.type === 13).size : 0;
      const threadCount = channels ? channels.filter((c) => [11, 12].includes(c?.type)).size : 0;

      const roleCount = g.roles?.cache?.size ? Math.max(0, g.roles.cache.size - 1) : 0;

      // boosts
      const boostTier = g.premiumTier ?? 0;
      const boostCount = g.premiumSubscriptionCount ?? 0;

      // verification
      const verMap = {
        0: "🔓 None",
        1: "🪶 Low",
        2: "🛡️ Medium",
        3: "🔒 High",
        4: "👑 Very High",
      };
      const verLabel = verMap[g.verificationLevel] || `Level ${g.verificationLevel ?? "—"}`;

      // created
      const createdUnix = Math.floor((g.createdTimestamp || Date.now()) / 1000);

      // visuals
      const icon = g.iconURL({ extension: "png", size: 512 });
      const banner = g.bannerURL?.({ extension: "png", size: 1024 }) || null;

      const embed = new EmbedBuilder()
        .setTitle("🏛️ Mystral Academy — Realm Dossier")
        .setColor(EMBED_COLOR)
        .setThumbnail(icon)
        .setDescription(
          [
            `**Realm:** **${g.name}**`,
            `**Realm ID:** \`${g.id}\``,
            owner ? `**Sovereign:** <@${owner.id}>` : `**Sovereign:** —`,
          ].join("\n")
        )
        .addFields(
          {
            name: "🧭 Population",
            value: [
              `**Members:** **${totalMembers.toLocaleString("id-ID")}**`,
              `**Boosts:** **${boostCount.toLocaleString("id-ID")}**`,
              `**Boost Tier:** **${boostTier}**`,
            ].join("\n"),
            inline: true,
          },
          {
            name: "🗺️ Channels",
            value: channels
              ? [
                  `**Total:** **${channelCount}**`,
                  `💬 Text: ${textCount}`,
                  `🔊 Voice: ${voiceCount}`,
                  `🗂️ Category: ${categoryCount}`,
                  `🧵 Threads: ${threadCount}`,
                  `🧷 Forum: ${forumCount}`,
                  `🎙️ Stage: ${stageCount}`,
                ].join("\n")
              : "⚠️ tidak bisa fetch channel.",
            inline: true,
          },
          {
            name: "🎭 Structure",
            value: [
              `**Roles:** **${roleCount}**`,
              `**Verification:** ${verLabel}`,
              `**Created:** <t:${createdUnix}:F>`,
              `**Age:** <t:${createdUnix}:R>`,
            ].join("\n"),
            inline: false,
          }
        )
        .setFooter({ text: `${BRAND_NAME} • Student Registry` })
        .setTimestamp();

      // 🔥 banner only if exists
      if (banner) embed.setImage(banner);

      return message.reply({
        embeds: [embed],
        allowedMentions: { repliedUser: false, parse: [] },
      });
    }


    // cafk
    if (cmd === "afk") {
      const reason = args.join(" ") || "AFK";
      await setAfk(message.author.id, reason);

      // set nickname jadi [AFK] ...
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (member) {
        const base = member.nickname || message.author.username;
        await trySetMemberNick(member, withAfkPrefix(base));
      }

      return message.reply({
      content: `🕯️ <@${message.author.id}> kini berstatus **AFK** — ${safeText(reason, 80)}`,
      allowedMentions: { repliedUser: false },
    });
  }

    // Owner-only: cmenfesspanel
    if (cmd === "menfesspanel") {
      const ch = await getTextChannelOrNull(message.guild, requireEnv("MENFESS_CHANNEL_ID"));
      if (!ch) return message.reply("⚠️ MENFESS_CHANNEL_ID tidak ketemu / bot tidak punya akses / bukan text channel.");

      await ch.send({ embeds: [menfessPanelEmbed()], components: [menfessPanelRow()], allowedMentions: { parse: [] } });
      return message.reply({ content: "✅ panel menfess terkirim.", allowedMentions: { repliedUser: false } });
    }

    // Owner-only: csortingpanel
    if (cmd === "sortingpanel") {
      const targetChannelId = requireEnv("SORTING_CHANNEL_ID") || message.channelId;
      const ch = await getTextChannelOrNull(message.guild, targetChannelId);
      if (!ch) return message.reply("⚠️ SORTING_CHANNEL_ID tidak valid / bot tidak punya akses / bukan text channel.");

      await ch.send({ embeds: [sortingPanelEmbed()], components: [sortingPanelRow()], allowedMentions: { parse: [] } });
      return message.reply({ content: "✅ panel sorting terkirim.", allowedMentions: { repliedUser: false } });
    }

    // Owner-only: cidcard (arahin ke slash)
    if (cmd === "idcard") {
      return message.reply("🪪 pakai slash **/idcard** ya (fiturnya terkunci khusus owner).");
    }
  } catch (e) {
    console.error("[PREFIX CMD ERROR]", e);
  }
});

// ===================== INTERACTIONS =====================
client.on(Events.InteractionCreate, async (interaction) => {
  try {

        // ===================== STRING SELECT (SELF ROLES) =====================
        if (interaction.isStringSelectMenu()) {
          const { customId, values, guild, member } = interaction;

          if (!guild || !member) {
            return interaction.reply({
              content: "⚠️ Interaction ini hanya bisa dipakai di server.",
              flags: MessageFlags.Ephemeral
            });
          }
          try {
            // ===== AGE (1 role only) =====
            if (customId === "self:age") {
              const toRemove = member.roles.cache.filter((r) => SELF_AGE_IDS.includes(r.id));
              if (toRemove.size) await member.roles.remove(toRemove);

              if (values.length) await member.roles.add(values[0]);
              return interaction.editReply("✅ **Age role** berhasil diperbarui.");
            }

            // ===== STATUS (1 role only) =====
            if (customId === "self:status") {
              const toRemove = member.roles.cache.filter((r) => SELF_STATUS_IDS.includes(r.id));
              if (toRemove.size) await member.roles.remove(toRemove);

              if (values.length) {
                await member.roles.add(values[0]);
                return interaction.editReply("💖 **Status role** diperbarui.");
              }

              return interaction.editReply("🧹 **Status role** dihapus.");
            }

            // ===== REGION (1 role only) =====
            if (customId === "self:region") {
              const toRemove = member.roles.cache.filter((r) => SELF_REGION_IDS.includes(r.id));
              if (toRemove.size) await member.roles.remove(toRemove);

              if (values.length) {
                await member.roles.add(values[0]);
                return interaction.editReply("🗺️ **Region role** diperbarui.");
              }

              return interaction.editReply("🧹 **Region role** dihapus.");
            }

            // ===== PING (MULTI) =====
            if (customId === "self:ping") {
              const toRemove = member.roles.cache.filter((r) => SELF_PING_IDS.includes(r.id));
              if (toRemove.size) await member.roles.remove(toRemove);

              if (values.length) await member.roles.add(values);
              return interaction.editReply("🔔 **Ping roles** diperbarui.");
            }

            // ===== INTEREST (MULTI, per kategori) =====
            if (customId.startsWith("self:int_")) {
              const optionsForThisMenu = INTEREST_MENU_MAP[customId] || [];
              const idsForThisMenu = optionsForThisMenu.map((x) => x.value);

              const toRemove = member.roles.cache.filter((r) => idsForThisMenu.includes(r.id));
              if (toRemove.size) await member.roles.remove(toRemove);

              if (values.length) await member.roles.add(values);

              return interaction.editReply("🎯 **Interest roles** diperbarui.");
            }

            return interaction.editReply("⚠️ Select menu tidak dikenali.");
          } catch (err) {
            console.error("[SELF ROLE ERROR]", err);
            return interaction.editReply("❌ Gagal mengubah role. Cek permission bot.");
          }
        }

    // ===================== SLASH =====================
    if (interaction.isChatInputCommand()) {
      const name = interaction.commandName;

      if (name === "ping") return safeReply(interaction, { content: `🏓 pong! ${client.ws.ping}ms` });
      
      if (name === "help") {
        const embed = new EmbedBuilder()
          .setTitle("📜 Mystral Assistant — Help (Slash)")
          .setColor(EMBED_COLOR)
          .setDescription(
            [
              "Selamat datang di aula panduan.",
              "Di bawah ini daftar mantra (slash command) yang tersedia di server ini.",
            ].join("\n")
          )
          .addFields(
            {
              name: "🧭 Basic",
              value: ["• `/help`", "• `/ping`", "• `/halo`", "• `/about`"].join("\n"),
              inline: true,
            },
            {
              name: "🪞 Info",
              value: [
                "• `/avatar [user]`",
                "• `/userinfo [user]`",
                "• `/serverinfo`",
                "• `/profile [user]`",
              ].join("\n"),
              inline: true,
            },
            {
              name: "🕯️ AFK",
              value: ["• `/afk [reason]` — set AFK dan tandai nickname **[AFK]**"].join("\n"),
              inline: false,
            },
            {
              name: "🪪 Registry / Arcana",
              value: ["• `/registry`", "• `/myhouse [user]`"].join("\n"),
              inline: false,
            },
            {
              name: "🔐 Owner-only",
              value: [
                "• `/selfrolespanel` — kirim panel self roles",
                "• `/menfesspanel`",
                "• `/sortingpanel`",
                "• `/ticketpanel`",
                "• `/sendembed` — kirim embed custom",
                "• `/idcard`",
              ].join("\n"),
              inline: false,
            }
          )
          .setFooter({ text: "Mystral Academy • Follow the rules, respect the realm." })
          .setTimestamp();

        return safeReply(interaction, {
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
      }

      // ===================== SELF ROLES PANEL (OWNER-ONLY) =====================
      if (name === "selfrolespanel") {
        if (!isBotOwner(interaction.user.id)) {
          return safeReply(interaction, { content: "❌ khusus pembuat bot.", flags: MessageFlags.Ephemeral });
        }

        const [eAge, eInt, eStatus, eRegion, ePing] = selfrolesPanelEmbeds();

        const rowAge = new ActionRowBuilder().addComponents(
          buildSelfSelect("self:age", "Pilih Age (1)", SELFROLES.age, 1)
        );

        const rowGame = new ActionRowBuilder().addComponents(
          buildSelfSelect("self:int_gaming", "Gaming (pilih bebas)", SELFROLES.interest.gaming, Math.min(SELFROLES.interest.gaming.length, 25))
        );

        const rowEnt = new ActionRowBuilder().addComponents(
          buildSelfSelect("self:int_ent", "Entertainment (pilih bebas)", SELFROLES.interest.entertainment, Math.min(SELFROLES.interest.entertainment.length, 25))
        );

        const rowCre = new ActionRowBuilder().addComponents(
          buildSelfSelect("self:int_creative", "Creative (pilih bebas)", SELFROLES.interest.creative, Math.min(SELFROLES.interest.creative.length, 25))
        );

        const rowStatus = new ActionRowBuilder().addComponents(
          buildSelfSelect("self:status", "Pilih Status (opsional, 1)", SELFROLES.status, 1)
        );
        const rowRegion = new ActionRowBuilder().addComponents(
          buildSelfSelect("self:region", "Pilih Region (1)", SELFROLES.region || [], 1)
        );

        const rowPing = new ActionRowBuilder().addComponents(
          buildSelfSelect("self:ping", "Pilih Ping Roles (multi)", SELFROLES.ping || [], Math.min((SELFROLES.ping || []).length, 25))
        );

        await interaction.reply({ content: "✅ Panel self-role dikirim.", flags: MessageFlags.Ephemeral });
        await interaction.channel.send({ embeds: [eAge], components: [rowAge] });
        await interaction.channel.send({ embeds: [eInt], components: [rowGame, rowEnt, rowCre] });
        await interaction.channel.send({ embeds: [eStatus], components: [rowStatus] });
        await interaction.channel.send({ embeds: [eRegion], components: [rowRegion] });
        await interaction.channel.send({ embeds: [ePing], components: [rowPing] });

        return;
      }
      // ===================== END SELF ROLES PANEL =====================

      function parseHexColor(input, fallback = EMBED_COLOR) {
        if (!input) return fallback;
        const s = String(input).trim().replace(/^0x/i, "#");
        const m = s.match(/^#?([0-9a-fA-F]{6})$/);
        if (!m) return fallback;
        return parseInt(m[1], 16);
      }

      function isValidUrl(u) {
        try {
          const url = new URL(u);
          return url.protocol === "http:" || url.protocol === "https:";
        } catch {
          return false;
        }
      }

      // ... di dalam interaction.isChatInputCommand()
      if (name === "sendembed") {
        if (!isBotOwner(interaction.user.id)) {
          return safeReply(interaction, { content: "❌ khusus pembuat bot.", flags: MessageFlags.Ephemeral });
        }

        const title = interaction.options.getString("title");
        const description = interaction.options.getString("description");
        const channel = interaction.options.getChannel("channel") || interaction.channel;

        const colorRaw = interaction.options.getString("color");
        const footerRaw = interaction.options.getString("footer");
        const img = interaction.options.getString("image");
        const thumb = interaction.options.getString("thumbnail");

        // safety: pastikan channel text-based
        if (!channel?.isTextBased?.()) {
          return safeReply(interaction, { content: "⚠️ channel tujuan harus text channel.", flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(parseHexColor(colorRaw, EMBED_COLOR))
          .setTimestamp();

        // lore footer default
        embed.setFooter({ text: footerRaw?.trim() || "Mystral Academy • Arcane Notice" });

        if (thumb && isValidUrl(thumb)) embed.setThumbnail(thumb);
        if (img && isValidUrl(img)) embed.setImage(img);

        await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);

        return safeReply(interaction, { content: "✅ embed terkirim.", flags: MessageFlags.Ephemeral });
      }

     
      //ticketpanel
      if (name === "ticketpanel") {
      if (!isBotOwner(interaction.user.id)) {
        return safeReply(interaction, { content: "❌ khusus pembuat bot.", flags: MessageFlags.Ephemeral });
      }
      await interaction.channel.send({ embeds: [ticketPanelEmbed()], components: [ticketPanelRow()], allowedMentions: { parse: [] } });
      return safeReply(interaction, { content: "✅ panel ticket terkirim.", flags: MessageFlags.Ephemeral });
    }

      if (name === "halo") {
        const serverName = interaction.guild?.name || "realm ini";
        const replies = [
          `✨ salam, **${interaction.user.username}**.\nsebuah jiwa baru menyapa di **${serverName}**.`,
          `🌙 gerbang berpendar pelan saat **${interaction.user.username}** berbicara.\nselamat datang di **${serverName}**.`,
          `🔮 suaramu menggema di dalam **${serverName}**, **${interaction.user.username}**.\nsemoga langkahmu di sini menyenangkan.`,
          `🕯️ salam hangat, **${interaction.user.username}**.\n**${serverName}** menyambut kehadiranmu.`,
        ];
        return safeReply(interaction, { content: replies[Math.floor(Math.random() * replies.length)] });
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
          .setThumbnail(client.user.displayAvatarURL({ extension: "png", size: 256 }))
          .setFooter({ text: `ID: ${client.user.id}` })
          .setTimestamp();

        return safeReply(interaction, { embeds: [embed] });
      }

      if (name === "avatar") {
        const user = interaction.options.getUser("user") || interaction.user;

        const embed = new EmbedBuilder()
          .setTitle("🖼️ Avatar")
          .setColor(EMBED_COLOR)
          .setDescription(`Avatar milik <@${user.id}>`)
          .setImage(user.displayAvatarURL({ extension: "png", size: 1024 }))
          .setFooter({ text: BRAND_NAME })
          .setTimestamp();

        return safeReply(interaction, { embeds: [embed], allowedMentions: { parse: [] } });
      }

      //userinfo
      if (name === "userinfo") {
        const user = interaction.options.getUser("user") || interaction.user;
        await safeDefer(interaction, false);

        const guild = interaction.guild;
        const member = await guild?.members.fetch(user.id).catch(() => null);

        // ===== Dates =====
        const createdUnix = Math.floor((user.createdTimestamp || Date.now()) / 1000);
        const joinedUnix = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

        // ===== Roles (HIGHEST -> LOWEST) =====
        const roleList = member
          ? member.roles.cache
              .filter((r) => r.id !== guild.id) // buang @everyone
              .sort((a, b) => b.position - a.position)
              .map((r) => r.toString())
          : [];

        const maxRolesShown = 15;
        const rolesShown = roleList.slice(0, maxRolesShown);
        const rolesMore = Math.max(0, roleList.length - rolesShown.length);

        // ===== Highest Role =====
        const topRole =
          member?.roles.cache
            .filter((r) => r.id !== guild.id)
            .sort((a, b) => b.position - a.position)
            .first() || null;

        // ===== Nick / Display =====
        const nickname = member?.nickname || "—";
        const displayName = member?.displayName || user.username;

        // ===== Banner (needs fetch user full) =====
        const userFull = await client.users.fetch(user.id, { force: true }).catch(() => null);
        const bannerUrl = userFull?.bannerURL?.({ extension: "png", size: 1024 }) || null;

        const embed = new EmbedBuilder()
          .setTitle(`Mystral Profile — ${displayName}`)
          .setColor(EMBED_COLOR)
          .setThumbnail(user.displayAvatarURL({ extension: "png", size: 256 }))
          .setDescription(`**Mention:** <@${user.id}>`)
          .addFields(
            {
              name: "🪪 Identity",
              value: [
                `**Tag:** ${user.tag}`,
                `**User ID:** \`${user.id}\``,
                `**Nickname:** ${nickname === "—" ? "—" : `\`${nickname}\``}`,
              ].join("\n"),
              inline: true,
            },
            {
              name: "🕰️ Timeline",
              value: [
                `**Akun Dibuat:** <t:${createdUnix}:F>`,
                `**Join Server:** ${joinedUnix ? `<t:${joinedUnix}:F>` : "—"}`,
                `**Relative:** <t:${createdUnix}:R>${joinedUnix ? ` • <t:${joinedUnix}:R>` : ""}`,
              ].join("\n"),
              inline: true,
            },
            {
              name: "🎭 Roles",
              value: roleList.length
                ? `${rolesShown.join(" ")}${rolesMore ? `\n…dan **${rolesMore}** role lain.` : ""}`
                : "—",
              inline: false,
            },
            {
              name: "🏷️ Highest Role",
              value: topRole ? `${topRole} *(pos ${topRole.position})*` : "—",
              inline: true,
            },
            {
              name: "🧩 Server",
              value: guild ? `**${guild.name}**\nID: \`${guild.id}\`` : "—",
              inline: true,
            }
          )
          .setFooter({ text: `${BRAND_NAME} • Student Registry` })
          .setTimestamp();

        if (bannerUrl) embed.setImage(bannerUrl);

        return safeReply(interaction, { embeds: [embed], allowedMentions: { parse: [] } });
      }

      if (name === "profile") {
      const user = interaction.options.getUser("user") || interaction.user;
      await safeDefer(interaction, false);

      const guild = interaction.guild;
      if (!guild) return safeReply(interaction, { content: "Command ini cuma bisa dipakai di server ya." });

      const member = await guild.members.fetch(user.id).catch(() => null);

      const { embed, idData, sorted, afk } = await buildProfileEmbed({ guild, user, member });

      const row = profileButtons({
        hasIdCard: Boolean(idData),
        hasSorted: Boolean(sorted?.choice),
        isAfk: Boolean(afk),
      });

      return safeReply(interaction, { embeds: [embed], components: [row], allowedMentions: { parse: [] } });
    }

    //serverinfo
      if (name === "serverinfo") {
        await safeDefer(interaction, false); // <- bukan ephemeral

        const g = interaction.guild;
        if (!g) return safeReply(interaction, { content: "Command ini cuma bisa dipakai di server ya.", flags: MessageFlags.Ephemeral });

        // fetch data
        const owner = await g.fetchOwner().catch(() => null);
        const channels = await g.channels.fetch().catch(() => null);

        // counts
        const totalMembers = g.memberCount ?? 0;

        const channelCount = channels ? channels.size : 0;
        const textCount = channels ? channels.filter((c) => c?.type === 0).size : 0; // GuildText
        const voiceCount = channels ? channels.filter((c) => c?.type === 2).size : 0; // GuildVoice
        const categoryCount = channels ? channels.filter((c) => c?.type === 4).size : 0; // GuildCategory
        const forumCount = channels ? channels.filter((c) => c?.type === 15).size : 0; // GuildForum
        const stageCount = channels ? channels.filter((c) => c?.type === 13).size : 0; // GuildStageVoice
        const threadCount = channels ? channels.filter((c) => [11, 12].includes(c?.type)).size : 0; // Public/Private thread (may not appear depending fetch)

        const roleCount = g.roles?.cache?.size ? Math.max(0, g.roles.cache.size - 1) : 0; // minus @everyone

        // boosts
        const boostTier = g.premiumTier ?? 0;
        const boostCount = g.premiumSubscriptionCount ?? 0;

        // verification level label (Discord enum)
        const verMap = {
          0: "🔓 None",
          1: "🪶 Low",
          2: "🛡️ Medium",
          3: "🔒 High",
          4: "👑 Very High",
        };
        const verLabel = verMap[g.verificationLevel] || `Level ${g.verificationLevel ?? "—"}`;

        // created
        const createdUnix = Math.floor((g.createdTimestamp || Date.now()) / 1000);

        // aesthetics
        const icon = g.iconURL({ extension: "png", size: 512 });
        const banner = g.bannerURL?.({ extension: "png", size: 1024 }) || null;

        const embed = new EmbedBuilder()
          .setTitle("🏛️ Mystral Academy — Realm Dossier")
          .setColor(EMBED_COLOR)
          .setThumbnail(icon)
          .setDescription(
            [
              `**Realm:** **${g.name}**`,
              `**Realm ID:** \`${g.id}\``,
              owner ? `**Ownership:** <@${owner.id}>` : `**Sovereign:** —`,
            ].join("\n")
          )
          .addFields(
            {
              name: "🧭 Population",
              value: [
                `**Members:** **${totalMembers.toLocaleString("id-ID")}**`,
                `**Boosts:** **${boostCount.toLocaleString("id-ID")}**`,
                `**Boost Tier:** **${boostTier}**`,
              ].join("\n"),
              inline: true,
            },
            {
              name: "🗺️ Channels",
              value: channels
                ? [
                    `**Total:** **${channelCount}**`,
                    `💬 Text: ${textCount}`,
                    `🔊 Voice: ${voiceCount}`,
                    `🗂️ Category: ${categoryCount}`,
                    `🧵 Threads: ${threadCount}`,
                    `🧷 Forum: ${forumCount}`,
                    `🎙️ Stage: ${stageCount}`,
                  ].join("\n")
                : "⚠️ tidak bisa fetch channel (izin kurang / error).",
              inline: true,
            },
            {
              name: "🎭 Structure",
              value: [
                `**Roles:** **${roleCount}**`,
                `**Verification:** ${verLabel}`,
                `**Created:** <t:${createdUnix}:F>`,
                `**Age:** <t:${createdUnix}:R>`,
              ].join("\n"),
              inline: false,
            }
          )
          .setFooter({ text: `${BRAND_NAME} • Student Registry` })
          .setTimestamp();

        if (banner) embed.setImage(banner);

        return safeReply(interaction, { embeds: [embed], allowedMentions: { parse: [] } });
      }

      //afk
      if (name === "afk") {
        const reason = interaction.options.getString("reason") || "AFK";
        await setAfk(interaction.user.id, reason);

        // set nickname jadi [AFK] ...
        const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
        if (member) {
          const base = member.nickname || interaction.user.username;
          await trySetMemberNick(member, withAfkPrefix(base));
        }

        return safeReply(interaction, {
          content: `🕯️ <@${interaction.user.id}> kini berstatus **AFK** — ${safeText(reason, 80)}`,
          allowedMentions: { repliedUser: false, parse: [] },
        });
      }

      //registry
      if (name === "registry") {
        if (!interaction.guild) return safeReply(interaction, { content: "Command ini cuma bisa dipakai di server ya.", flags: MessageFlags.Ephemeral });

        const total = await countRegistry();
        const pageSize = 10;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const pageIndex = 0;

        const rows = await registryPage(pageIndex * pageSize, pageSize);
        const embed = registryEmbed(pageIndex, totalPages, total, rows);
        const row = registryRow(pageIndex, totalPages);

        return safeReply(interaction, { embeds: [embed], components: [row], allowedMentions: { parse: [] } });
      }

      // OWNER ONLY
      if (name === "menfesspanel") {
        if (!isBotOwner(interaction.user.id)) {
          return safeReply(interaction, { content: "❌ command ini cuma buat pembuat bot.", flags: MessageFlags.Ephemeral });
        }

        const ch = await getTextChannelOrNull(interaction.guild, requireEnv("MENFESS_CHANNEL_ID"));
        if (!ch) {
          return safeReply(interaction, { content: "⚠️ MENFESS_CHANNEL_ID tidak ketemu / bot tidak punya akses / bukan text channel.", flags: MessageFlags.Ephemeral });
        }

        await ch.send({ embeds: [menfessPanelEmbed()], components: [menfessPanelRow()], allowedMentions: { parse: [] } });
        return safeReply(interaction, { content: "✅ panel menfess terkirim ke channel menfess.", flags: MessageFlags.Ephemeral });
      }

      // OWNER ONLY
      if (name === "sortingpanel") {
        if (!isBotOwner(interaction.user.id)) {
          return safeReply(interaction, { content: "❌ command ini cuma buat pembuat bot.", flags: MessageFlags.Ephemeral });
        }

        const targetChannelId = requireEnv("SORTING_CHANNEL_ID") || interaction.channelId;
        const ch = await getTextChannelOrNull(interaction.guild, targetChannelId);
        if (!ch) {
          return safeReply(interaction, { content: "⚠️ SORTING_CHANNEL_ID tidak valid / bot tidak punya akses / bukan text channel.", flags: MessageFlags.Ephemeral });
        }

        await ch.send({ embeds: [sortingPanelEmbed()], components: [sortingPanelRow()], allowedMentions: { parse: [] } });
        return safeReply(interaction, { content: "✅ panel sorting terkirim.", flags: MessageFlags.Ephemeral });
      }

      // OWNER ONLY
      if (name === "idcard") {
        if (!isBotOwner(interaction.user.id)) {
          return safeReply(interaction, { content: "❌ fitur ID Card ini dikunci (khusus pembuat bot).", flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
          .setTitle(`🪪 ${ID_CARD_TITLE}`)
          .setColor(EMBED_COLOR)
          .setDescription("Klik tombol untuk membuat / update **MYSTRAL IDENTITY CARD** kamu.")
          .setFooter({ text: "Theme: isi Status pakai `| dark` atau `| light` (contoh: single | dark)" });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("idcard:open").setLabel("Buat / Update ID").setStyle(ButtonStyle.Primary).setEmoji("🪪")
        );

        return safeReply(interaction, { embeds: [embed], components: [row] });
      }

      if (name === "myhouse") {
        if (!interaction.guild) return safeReply(interaction, { content: "Command ini cuma bisa dipakai di server ya.", flags: 0 });

        const targetUser = interaction.options.getUser("user") || interaction.user;

        const sorted = await getSortedUser(targetUser.id);
        if (!sorted?.choice) {
          return safeReply(interaction, { content: `⚠️ ${targetUser.id === interaction.user.id ? "Kamu" : `<@${targetUser.id}>`} belum melakukan Arcane Sorting.`, allowedMentions: { parse: [] } });
        }

        const idData = await getIdCard(targetUser.id);
        if (!idData) {
          const idCh = requireEnv("IDCARD_CHANNEL_ID");
          const mention = idCh ? `<#${idCh}>` : "channel ID Card";
          return safeReply(interaction, { content: `⚠️ ${targetUser.id === interaction.user.id ? "Kamu" : `<@${targetUser.id}>`} belum punya **Mystral Academy ID Card**.\nSilahkan buat dulu di ${mention} dengan command **/idcard**.`, allowedMentions: { parse: [] } });
        }

        await safeDefer(interaction, false);

        const png = await renderHouseCard({
          choice: sorted.choice,
          name: idData.name || targetUser.username,
          gender: idData.gender || "—",
          hovId: idData.number || "—",
          avatarUrl: targetUser.displayAvatarURL({ extension: "png", size: 256 }),
        });

        const filename = `house_${targetUser.id}.png`;
        const file = new AttachmentBuilder(png, { name: filename });

        const embed = new EmbedBuilder()
          .setTitle("🪪 Mystral Academy Card")
          .setColor(EMBED_COLOR)
          .setDescription(
            [
              `**Member:** <@${targetUser.id}>`,
              `**Student:** ${sorted.choice === "dark" ? "<:dark:1459543141609771101> Dark Arcane" : "<:light:1459543076736336004> Light Arcane"}`,
            ].join("\n")
          )
          .setImage(`attachment://${filename}`)
          .setFooter({ text: "Mystral Academy • Student Registry" })
          .setTimestamp();

        return safeReply(interaction, { embeds: [embed], files: [file], allowedMentions: { parse: [] } });
      }
    }

    // ===================== BUTTONS =====================
    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id.startsWith("registry:")) {
        await safeDeferUpdate(interaction);

        const [, action, currentStr] = id.split(":");
        const current = Number(currentStr || 0);

        const total = await countRegistry();
        const pageSize = 10;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        let nextPage = current;
        if (action === "prev") nextPage = Math.max(0, current - 1);
        if (action === "next") nextPage = Math.min(totalPages - 1, current + 1);

        const rows = await registryPage(nextPage * pageSize, pageSize);
        const embed = registryEmbed(nextPage, totalPages, total, rows);
        const row = registryRow(nextPage, totalPages);

        return interaction.message.edit({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
      }

 if (id.startsWith("profile:")) {
  const guild = interaction.guild;
  if (!guild) {
    return safeReply(interaction, { content: "Command ini cuma bisa dipakai di server ya.", flags: MessageFlags.Ephemeral });
  }

  const targetUser = interaction.user; // tombol dipencet oleh siapa

  // ✅ MODAL HARUS DIDAHULUKAN (JANGAN DEFER SEBELUM showModal)
  if (id === "profile:afk_set") {
    const cur = await getAfk(targetUser.id).catch(() => null);
    const modal = buildProfileAfkModal(cur?.reason || "AFK");
    return interaction.showModal(modal);
  }

  // selain modal: baru defer
  await safeDefer(interaction, true);

  if (id === "profile:afk_clear") {
    const ok = await clearAfk(targetUser.id).catch(() => false);

    // balikin nickname (hapus prefix [AFK]) kalau bisa
    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (member) {
      const current = member.nickname || targetUser.username;
      const restored = stripAfkPrefix(current);
      await trySetMemberNick(member, restored || null);
    }

    return interaction.editReply(ok ? "✅ AFK kamu sudah dihapus." : "⚠️ Kamu memang tidak sedang AFK.");
  }

  if (id === "profile:view_idcard") {
    const idData = await getIdCard(targetUser.id).catch(() => null);
    if (!idData) return interaction.editReply("⚠️ Kamu belum punya ID Card.");

    const sorted = await getSortedUser(targetUser.id).catch(() => null);
    const arcanaChoice = sorted?.choice || null;

    const createdAtText = formatIdDate(Number(idData.created_at) || Date.now());

    const png = await renderIdCard({
      theme: (idData.theme || "light") === "dark" ? "dark" : "light",
      number: idData.number || "—",
      name: idData.name || targetUser.username,
      gender: idData.gender || "—",
      domisili: idData.domisili || "—",
      hobi: idData.hobi || "—",
      status: idData.status || "—",
      avatarUrl: targetUser.displayAvatarURL({ extension: "png", size: 256 }),
      createdAtText,
      arcanaChoice,
    });

    const file = new AttachmentBuilder(png, { name: "mystral_idcard.png" });

    const embed = new EmbedBuilder()
      .setTitle("🪪 Mystral ID Card")
      .setColor(EMBED_COLOR)
      .setImage("attachment://mystral_idcard.png")
      .setTimestamp();

    return interaction.editReply({ embeds: [embed], files: [file], allowedMentions: { parse: [] } });
  }

  if (id === "profile:view_house") {
    const sorted = await getSortedUser(targetUser.id).catch(() => null);
    if (!sorted?.choice) return interaction.editReply("⚠️ Kamu belum melakukan Student Sorting.");

    const idData = await getIdCard(targetUser.id).catch(() => null);
    if (!idData) return interaction.editReply("⚠️ Kamu belum punya ID Card.");

    const png = await renderHouseCard({
      choice: sorted.choice,
      name: idData.name || targetUser.username,
      gender: idData.gender || "—",
      hovId: idData.number || "—",
      avatarUrl: targetUser.displayAvatarURL({ extension: "png", size: 256 }),
    });

    const file = new AttachmentBuilder(png, { name: "mystral_housecard.png" });

    const embed = new EmbedBuilder()
      .setTitle("🏰 Mystral Student Card")
      .setColor(EMBED_COLOR)
      .setImage("attachment://mystral_housecard.png")
      .setTimestamp();

    return interaction.editReply({ embeds: [embed], files: [file], allowedMentions: { parse: [] } });
  }

  // kalau customId profile lain masuk, biar gak silent
  return interaction.editReply("⚠️ tombol profile ini belum punya handler.");
}
 
      if (id === "menfess:new") {
        const cdSec = Number(process.env.MENFESS_COOLDOWN_SEC || 60);
        const now = Date.now();
        const last = menfessCooldown.get(interaction.user.id) || 0;

        if (now - last < cdSec * 1000) {
          const wait = Math.ceil((cdSec * 1000 - (now - last)) / 1000);
          return safeReply(interaction, { content: `⏳ tunggu ${wait}s dulu ya.`, flags: MessageFlags.Ephemeral });
        }

        const modal = new ModalBuilder().setCustomId("menfess:submit").setTitle("✉️ Menfess Anon");

        const toInput = new TextInputBuilder()
          .setCustomId("to_initial")
          .setLabel("Untuk (inisial / kata singkat)")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(12)
          .setRequired(true);

        const msgInput = new TextInputBuilder()
          .setCustomId("msg")
          .setLabel("Isi menfess")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1500)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(toInput), new ActionRowBuilder().addComponents(msgInput));
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

      //modal ticket
      if (id.startsWith("ticket:open:")) {
      const type = id.split(":")[2]; // complaint / report
      const label = type === "report" ? "Report" : "Keluhan";

      const modal = new ModalBuilder()
        .setCustomId(`ticket:submit:${type}`)
        .setTitle(`🎫 ${label} — Mystral Academy`);

      const subject = new TextInputBuilder()
        .setCustomId("subject")
        .setLabel("Judul Singkat")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(60)
        .setRequired(true);

      const detail = new TextInputBuilder()
        .setCustomId("detail")
        .setLabel("Kronologi / Detail")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1500)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(subject),
        new ActionRowBuilder().addComponents(detail)
      );

      return interaction.showModal(modal);
    }

    if (id === "ticket:claim") {
  await safeDefer(interaction, true);

  const guild = interaction.guild;
  const ch = interaction.channel;
  if (!guild || !ch?.name?.startsWith("ticket-")) return interaction.editReply("⚠️ ini bukan channel ticket.");

  if (!ticketIsStaff(interaction.member)) {
    return interaction.editReply("❌ hanya staff yang bisa claim ticket.");
  }

  const already = getClaimedFromTopic(ch.topic);
  if (already) {
    return interaction.editReply(`🔒 ticket ini sudah di-claim oleh <@${already}>.`);
  }

  await ch.setTopic(setClaimedTopic(ch.topic || "", interaction.user.id)).catch(() => {});
  await ch.send(`🧠 Ticket ini di-claim oleh <@${interaction.user.id}>. *(handled by staff)*`).catch(() => {});

  const logCh = await getTicketLogChannel(guild);
  if (logCh) {
    const logEmbed = new EmbedBuilder()
      .setTitle("🧠 Ticket Claimed")
      .setColor(EMBED_COLOR)
      .setDescription([`**Channel:** ${ch}`, `**Claimed by:** <@${interaction.user.id}> (${interaction.user.tag})`].join("\n"))
      .setTimestamp();
    await logCh.send({ embeds: [logEmbed], allowedMentions: { parse: [] } }).catch(() => {});
  }

  return interaction.editReply("✅ ticket berhasil kamu claim.");
}

if (id === "ticket:close") {
  await safeDefer(interaction, true);

  const guild = interaction.guild;
  const ch = interaction.channel;
  if (!guild || !ch?.name?.startsWith("ticket-")) return interaction.editReply("⚠️ ini bukan channel ticket.");

  if (!ticketIsStaff(interaction.member)) {
    return interaction.editReply("❌ hanya staff yang bisa menutup ticket.");
  }

  const logCh = await getTicketLogChannel(guild);
  const claimedBy = getClaimedFromTopic(ch.topic);
  const ownerId = getTicketOwnerIdFromTopic(ch.topic);
  const type = getTicketTypeFromTopic(ch.topic);

  // buat transcript
  try {
    const { txtBuffer, htmlBuffer, count } = await buildTicketTranscript(ch);

    if (logCh) {
      const files = [
        new AttachmentBuilder(txtBuffer, { name: `${ch.name}_transcript.txt` }),
        new AttachmentBuilder(htmlBuffer, { name: `${ch.name}_transcript.html` }),
      ];

      const logEmbed = new EmbedBuilder()
        .setTitle("📦 Ticket Closed + Transcript")
        .setColor(0xffc107)
        .setDescription(
          [
            `**Channel:** #${ch.name}`,
            `**Type:** ${String(type || "—").toUpperCase()}`,
            ownerId ? `**Owner:** <@${ownerId}>` : `**Owner:** —`,
            claimedBy ? `**Claimed by:** <@${claimedBy}>` : `**Claimed by:** —`,
            `**Closed by:** <@${interaction.user.id}> (${interaction.user.tag})`,
            `**Messages exported:** ${count}`,
          ].join("\n")
        )
        .setTimestamp();

      await logCh.send({ embeds: [logEmbed], files, allowedMentions: { parse: [] } }).catch(() => {});
    }
  } catch (e) {
    console.error("[TICKET] transcript failed:", e?.message || e);
  }

  await ch.send("🔒 Ticket akan ditutup dalam 5 detik...").catch(() => {});
  setTimeout(() => ch.delete().catch(() => {}), 5000);

  return interaction.editReply(`✅ ticket ditutup. ${logCh ? "Transcript dikirim ke log staff." : ""}`);
}

      // idcard open modal
      if (id === "idcard:open") {
        const modal = new ModalBuilder().setCustomId("idcard:submit").setTitle(`🪪 ${ID_CARD_TITLE}`);

        const nameInput = new TextInputBuilder().setCustomId("name").setLabel("Nama").setStyle(TextInputStyle.Short).setMaxLength(24).setRequired(true);
        const genderInput = new TextInputBuilder().setCustomId("gender").setLabel("Gender (L / P / W / dll)").setStyle(TextInputStyle.Short).setMaxLength(8).setRequired(true);
        const domInput = new TextInputBuilder().setCustomId("dom").setLabel("Domisili").setStyle(TextInputStyle.Short).setMaxLength(24).setRequired(true);
        const hobiInput = new TextInputBuilder().setCustomId("hobi").setLabel("Hobi").setStyle(TextInputStyle.Short).setMaxLength(30).setRequired(true);
        const statusInput = new TextInputBuilder().setCustomId("status").setLabel("Status + Theme (contoh: single | dark/light)").setStyle(TextInputStyle.Short).setMaxLength(32).setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(nameInput),
          new ActionRowBuilder().addComponents(genderInput),
          new ActionRowBuilder().addComponents(domInput),
          new ActionRowBuilder().addComponents(hobiInput),
          new ActionRowBuilder().addComponents(statusInput)
        );

        return interaction.showModal(modal);
      }

      // sorting roll
      if (id === "sorting:roll") {
        const EMOJI_LIGHT = process.env.LIGHT_EMOJI || "<:light:1459543076736336004>";
        const EMOJI_DARK = process.env.DARK_EMOJI || "<:dark:1459543141609771101>";

        const lightRoleId = requireEnv("LIGHT_ROLE_ID");
        const darkRoleId = requireEnv("DARK_ROLE_ID");
        const idcardChannelId = requireEnv("IDCARD_CHANNEL_ID");

        if (!lightRoleId || !darkRoleId) {
          return safeReply(interaction, { content: "⚠️ LIGHT_ROLE_ID / DARK_ROLE_ID belum diisi di .env", flags: MessageFlags.Ephemeral });
        }

        const rLight = await getRoleOrNull(interaction.guild, lightRoleId);
        const rDark = await getRoleOrNull(interaction.guild, darkRoleId);
        if (!rLight || !rDark) {
          return safeReply(interaction, { content: "⚠️ Role sorting tidak ditemukan. Update ROLE_ID di .env.", flags: MessageFlags.Ephemeral });
        }

        const locked = await getSortedUser(interaction.user.id);
        if (locked?.choice) {
          const when = Math.floor((Number(locked.at) || Date.now()) / 1000);
          const text = locked.choice === "light" ? `${EMOJI_LIGHT} Light Student` : `${EMOJI_DARK} Dark Student`;
          return safeReply(interaction, { content: `🔒 Kamu sudah tersortir ke **${text}**.\nSejak: <t:${when}:F>\n\nTidak bisa sorting ulang.`, flags: MessageFlags.Ephemeral });
        }

        const idData = await getIdCard(interaction.user.id);
        if (!idData) {
          const mention = idcardChannelId ? `<#${idcardChannelId}>` : "channel ID Card";
          return safeReply(interaction, {
            content: `⚠️ Kamu belum buat **Mystral Academy ID Card**.\nSilahkan buat dulu di ${mention} dengan command **/idcard**.\n\nSetelah itu balik lagi dan klik **Mulai Ritual**.`,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
          });
        }

        await safeDefer(interaction, true);

        const stages = [
          "🕯️ Lingkaran arcane menyala…",
          "🔮 Aura kamu dibaca oleh Arcane…",
          "✨ Fragmen takdir berputar di udara…",
          "🌙 Tirai antara cahaya & bayangan menipis…",
          "📜 Keputusan hampir ditetapkan…",
        ];
        for (const s of stages) {
          await interaction.editReply({ content: s });
          await sleep(850);
        }

        const choice = await pickChoiceBagMoreNatural();
        await setSortedUser(interaction.user.id, choice);

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) return interaction.editReply({ content: "⚠️ Gagal fetch member." });

        const roleIdToAdd = choice === "light" ? lightRoleId : darkRoleId;
        await member.roles.add(roleIdToAdd).catch((e) => console.error("[SORTING] add role failed:", e));

        const finalText = choice === "light" ? `${EMOJI_LIGHT} **LIGHT STUDENT**` : `${EMOJI_DARK} **DARK STUDENT**`;

        await postHouseCard(interaction.guild, interaction.user, choice).catch((e) => console.error("[HOUSECARD] send failed:", e));

        return interaction.editReply({ content: `📜 Takdir ditetapkan: ${finalText}` });
      }
    }

    // ===================== MODALS =====================
    if (interaction.isModalSubmit()) {
      const id = interaction.customId;

      if (id === "profile:afk_submit") {
      await safeDefer(interaction, true);

      const reason = interaction.fields.getTextInputValue("reason") || "AFK";
      await setAfk(interaction.user.id, reason);

      // set nickname jadi [AFK] ...
      const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
      if (member) {
        const base = member.nickname || interaction.user.username;
        await trySetMemberNick(member, withAfkPrefix(base));
      }

      return interaction.editReply(`🕯️ kamu sekarang AFK — **${safeText(reason, 80)}**`);
    }

      if (id === "menfess:submit") {
        const ch = await getTextChannelOrNull(interaction.guild, requireEnv("MENFESS_CHANNEL_ID"));
        if (!ch) return safeReply(interaction, { content: "Channel menfess tidak ketemu / bot tidak punya akses.", flags: MessageFlags.Ephemeral });

        const to = interaction.fields.getTextInputValue("to_initial").trim();
        const content = interaction.fields.getTextInputValue("msg").trim();

        if (!to || !content) return safeReply(interaction, { content: "Form kosong 😭", flags: MessageFlags.Ephemeral });
        if (isBadAlias(to)) return safeReply(interaction, { content: "⚠️ Bagian 'Untuk' jangan pakai mention / tag ya.", flags: MessageFlags.Ephemeral });

        const cdSec = Number(process.env.MENFESS_COOLDOWN_SEC || 60);
        const now = Date.now();
        const last = menfessCooldown.get(interaction.user.id) || 0;
        if (now - last < cdSec * 1000) {
          const wait = Math.ceil((cdSec * 1000 - (now - last)) / 1000);
          return safeReply(interaction, { content: `⏳ tunggu ${wait}s dulu ya.`, flags: MessageFlags.Ephemeral });
        }
        menfessCooldown.set(interaction.user.id, now);

        const senderLabel = "Pengirim Anonymous";
        const menfessId = await nextMenfessId();

        await insertMenfessPost({ id: menfessId, messageId: null, channelId: ch.id });
        await getAnonLabel(interaction.user.id);

        const embed = new EmbedBuilder()
          .setTitle(`🕯️ MENFESS #${menfessId}`)
          .setColor(EMBED_COLOR)
          .setDescription(`**untuk:** ${safeText(to, 24)}\n\n${content}\n\n— **${senderLabel}**`)
          .setFooter({ text: `Posted by ${BRAND_NAME}` })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("menfess:new").setLabel("Kirim Baru").setStyle(ButtonStyle.Success).setEmoji("✉️"),
          new ButtonBuilder().setCustomId(`menfess:reply:${menfessId}`).setLabel("Balas Anonim").setStyle(ButtonStyle.Primary).setEmoji("🫣")
        );

        const sent = await ch.send({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
        await updateMenfessPostLink(menfessId, { messageId: sent.id, channelId: ch.id });

        await sendMenfessLog(interaction.guild, {
          embeds: [
            new EmbedBuilder()
              .setTitle(`🧾 MENFESS LOG #${menfessId}`)
              .setColor(0xffc107)
              .setDescription(
                [
                  `**Sender:** <@${interaction.user.id}> (${interaction.user.tag})`,
                  `**Sender ID:** ${interaction.user.id}`,
                  `**To:** ${safeText(to, 24)}`,
                  `**Channel:** <#${ch.id}>`,
                  `**Message ID:** ${sent.id}`,
                  "",
                  "**Content:**",
                  content.length > 1800 ? content.slice(0, 1800) + "…" : content,
                ].join("\n")
              )
              .setTimestamp(),
          ],
          allowedMentions: { parse: [] },
        });

        return safeReply(interaction, { content: "✅ menfess terkirim.", flags: MessageFlags.Ephemeral });
      }

      if (id.startsWith("menfess:reply_submit:")) {
        const menfessId = id.split(":")[2];
        const replyText = interaction.fields.getTextInputValue("reply_msg").trim();
        if (!replyText) return safeReply(interaction, { content: "Balasan kosong 😭", flags: MessageFlags.Ephemeral });

        const post = await getMenfessPostById(menfessId);
        if (!post?.message_id || !post?.channel_id) {
          return safeReply(interaction, { content: "Menfess asal tidak ditemukan (mungkin sudah kehapus).", flags: MessageFlags.Ephemeral });
        }

        const ch = await getTextChannelOrNull(interaction.guild, post.channel_id);
        if (!ch) return safeReply(interaction, { content: "Channel menfess tidak valid / bot tidak punya akses.", flags: MessageFlags.Ephemeral });

        const anon = "Pengirim Anonymous";

        const embed = new EmbedBuilder()
          .setTitle("🫣 Balasan Anonim")
          .setColor(EMBED_COLOR)
          .setDescription(`${replyText}\n\n— **${anon}**`)
          .setFooter({ text: `Reply to menfess #${menfessId}` })
          .setTimestamp();

        await ch.send({
          embeds: [embed],
          reply: { messageReference: post.message_id },
          allowedMentions: { repliedUser: false, parse: [] },
        });

        await sendMenfessLog(interaction.guild, {
          embeds: [
            new EmbedBuilder()
              .setTitle(`🧾 MENFESS REPLY LOG -> #${menfessId}`)
              .setColor(0x03a9f4)
              .setDescription(
                [
                  `**Replier:** <@${interaction.user.id}> (${interaction.user.tag})`,
                  `**Replier ID:** ${interaction.user.id}`,
                  `**Reply To Menfess:** #${menfessId}`,
                  "",
                  "**Reply:**",
                  replyText.length > 1800 ? replyText.slice(0, 1800) + "…" : replyText,
                ].join("\n")
              )
              .setTimestamp(),
          ],
          allowedMentions: { parse: [] },
        });

        return safeReply(interaction, { content: "✅ balasan terkirim.", flags: MessageFlags.Ephemeral });
      }

      if (id.startsWith("ticket:submit:")) {
  await safeDefer(interaction, true);

  const guild = interaction.guild;
  const user = interaction.user;

  const type = id.split(":")[2]; // complaint / report
  const label = type === "report" ? "REPORT" : "KELUHAN";

  const categoryId = requireEnv("TICKET_CATEGORY_ID");
  const staffRoleId = requireEnv("TICKET_STAFF_ROLE_ID");
  if (!categoryId || !staffRoleId) {
    return interaction.editReply("⚠️ Ticket belum dikonfigurasi (TICKET_CATEGORY_ID / TICKET_STAFF_ROLE_ID).");
  }

  const subject = interaction.fields.getTextInputValue("subject").trim();
  const detail = interaction.fields.getTextInputValue("detail").trim();

  // bikin nama channel aman (max 100, tanpa spasi aneh)
  const safeUser = user.username.toLowerCase().replace(/[^a-z0-9-_]/g, "").slice(0, 12) || "user";
  const chName = `ticket-${type}-${safeUser}`.slice(0, 90);

  const channel = await guild.channels.create({
    name: chName,
    parent: categoryId,
    topic: ticketMeta(type, user.id),
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
        ],
      },
      {
        id: staffRoleId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.EmbedLinks,
        ],
      },
    ],
  });

  const mainEmbed = new EmbedBuilder()
    .setTitle(`🎫 TICKET ${label}`)
    .setColor(type === "report" ? 0xff5252 : EMBED_COLOR)
    .setDescription(
      [
        `👤 **Pengirim:** <@${user.id}>`,
        `📌 **Judul:** ${subject}`,
        "",
        "📝 **Detail:**",
        detail,
        "",
        "🧠 Staff dapat **Claim** ticket ini untuk menandai penanggung jawab.",
        "🔒 Jika sudah selesai, staff dapat menutup ticket dan transcript akan tersimpan.",
      ].join("\n")
    )
    .setFooter({ text: "Mystral Academy • Ticket System" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket:claim").setLabel("Claim").setStyle(ButtonStyle.Primary).setEmoji("🧠"),
    new ButtonBuilder().setCustomId("ticket:close").setLabel("Close").setStyle(ButtonStyle.Secondary).setEmoji("🔒")
  );

  await channel.send({
    content: `<@&${staffRoleId}>`,
    embeds: [mainEmbed],
    components: [row],
    allowedMentions: { roles: [staffRoleId] },
  });

  // log open
  const logCh = await getTicketLogChannel(guild);
  if (logCh) {
    const logEmbed = new EmbedBuilder()
      .setTitle("📄 Ticket Opened")
      .setColor(type === "report" ? 0xff5252 : EMBED_COLOR)
      .setDescription(
        [
          `**Type:** ${type.toUpperCase()}`,
          `**User:** <@${user.id}> (${user.tag})`,
          `**Channel:** ${channel}`,
          `**Subject:** ${subject}`,
        ].join("\n")
      )
      .setTimestamp();

    await logCh.send({ embeds: [logEmbed], allowedMentions: { parse: [] } }).catch(() => {});
  }

  return interaction.editReply(`✅ Ticket dibuat: ${channel}`);
}


      // ID CARD SUBMIT (OWNER LOCK BY SLASH ONLY) — modal ini cuma kebuka dari tombol /idcard (owner)
      if (id === "idcard:submit") {
        await safeDefer(interaction, false);
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

        const saved = await upsertIdCard(interaction.user.id, payload);
        const sorted = await getSortedUser(interaction.user.id);
        const arcanaChoice = sorted?.choice || null;
        const createdAtText = formatIdDate(Number(saved.created_at) || Date.now());

        const png = await renderIdCard({
          theme: payload.theme,
          number: saved.number || "—",
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

        return safeReply(interaction, { embeds: [embed], files: [file], components: [row], allowedMentions: { parse: [] } });
      }
    }
  } catch (err) {
  console.error("[INTERACTION ERROR]", err);

  try {
    if (interaction.deferred && !interaction.replied) {
      return await interaction.editReply({
        content: "⚠️ ada error di bot, coba lagi ya.",
      });
    }

    if (!interaction.replied && !interaction.deferred) {
      return await interaction.reply({
        content: "⚠️ ada error di bot, coba lagi ya.",
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch {}
}
});

// ===================== BOOT =====================
(async function boot() {
  try {
    if (!process.env.DISCORD_TOKEN) {
      console.error("❌ DISCORD_TOKEN belum diisi di .env");
      process.exit(1);
    }

    openDb();
    await initDb();
    await ensureMenfessCounterStart();

    console.log("[DB] SQLite ready:", SQLITE_PATH);
    client.login(process.env.DISCORD_TOKEN);
  } catch (e) {
    console.error("❌ Boot failed:", e);
    process.exit(1);
  }
})();
