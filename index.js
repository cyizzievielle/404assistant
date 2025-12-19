/**
 * index.js — HOV Assistant (Welcome + Menfess + HOV Identity Card)
 * discord.js v14
 * npm i discord.js dotenv canvas
 *
 * .env wajib:
 * DISCORD_TOKEN=xxxxx
 * GENERAL_CHANNEL_ID=xxxxx
 * MENFESS_CHANNEL_ID=xxxxx
 *
 * optional:
 * MENFESS_COOLDOWN_SEC=60
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

// ===================== BRAND =====================
const BRAND_NAME = "HOV Assistant";
const ID_CARD_TITLE = "HOV IDENTITY CARD";

// ===================== FONT =====================
// pastikan file ini ADA:
// assets/fonts/Inter-Regular.ttf
// assets/fonts/Inter-Bold.ttf
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

// ===================== CLIENT =====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ===================== UTILS =====================
function getChannelById(guild, id) {
  if (!guild || !id) return null;
  const ch = guild.channels.cache.get(id);
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

// ===================== WELCOME (lebih banyak & beda) =====================
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

// ===================== ID CARD RENDER =====================
async function renderIdCard({
  theme,
  number,
  name,
  gender,
  domisili,
  hobi,
  status,
  avatarUrl,
  createdAtText,
}) {
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

  // BG gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, bg1);
  grad.addColorStop(1, bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // glow orbs
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

  // rounded rect helper
  const rr = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // panel
  const pad = 34;
  const x = pad, y = pad, cw = w - pad * 2, ch = h - pad * 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = isDark ? "rgba(12,10,24,.78)" : "rgba(255,255,255,.82)";
  rr(x, y, cw, ch, 22);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  rr(x, y, cw, ch, 22);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // header
  ctx.fillStyle = ink;
  ctx.font = "bold 46px Inter, Arial";
  ctx.fillText("HOV IDENTITY CARD", x + 34, y + 82);

  ctx.fillStyle = subInk;
  ctx.font = "600 20px Inter, Arial";
  ctx.fillText("House of Valerie • Verified in the arcane", x + 36, y + 114);

  // divider
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 34, y + 134);
  ctx.lineTo(x + cw - 34, y + 134);
  ctx.stroke();

  // left rows
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

  // footer left
  ctx.fillStyle = subInk;
  ctx.font = "600 16px Inter, Arial";
  ctx.fillText(`© HOV • ${BRAND_NAME}`, x + 36, y + ch - 28);

  // right avatar
  const px = x + cw - 320;
  const py = y + 170;
  const pw = 250;
  const ph = 250;

  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  rr(px, py, pw, ph, 16);
  ctx.stroke();

  try {
    const img = await loadImage(avatarUrl);
    ctx.save();
    rr(px + 10, py + 10, pw - 20, ph - 20, 14);
    ctx.clip();
    ctx.drawImage(img, px + 10, py + 10, pw - 20, ph - 20);
    ctx.restore();
  } catch {
    ctx.fillStyle = line;
    rr(px + 10, py + 10, pw - 20, ph - 20, 14);
    ctx.fill();
  }

  // tanggal (di bawah avatar, naik dikit, ukuran pas)
  const cx = px + pw / 2;
  const dateTop = py + ph + 14; // lebih naik dari sebelumnya

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

// ===================== READY / PRESENCE =====================
client.once(Events.ClientReady, (c) => {
  console.log(`ONLINE AS: ${c.user.tag} | ID: ${c.user.id}`);

  const statuses = [
    "🌙 menjaga gerbang realm",
    "🔮 merapalkan pesan welcome",
    "🕯️ menemani kalian ngobrol",
    "✨ ketik /halo untuk menyapa",
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
});

// ===================== AUTO WELCOME =====================
client.on(Events.GuildMemberAdd, async (member) => {
  const channel = getChannelById(member.guild, process.env.GENERAL_CHANNEL_ID);
  if (!channel) return;

  const mention = `<@${member.id}>`;
  const guildName = `**${member.guild.name}**`;

  const msg = WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)](
    mention,
    guildName
  );

  channel.send(msg).catch(console.error);
});

// ===================== INTERACTIONS =====================
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // ============ SLASH ============
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
        const member = interaction.guild?.members.cache.get(user.id) || null;

        const created = `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`;
        const joined = member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : "—";

        const roles =
          member?.roles.cache
            .filter((r) => r.id !== interaction.guild.id)
            .map((r) => r.toString())
            .slice(0, 15) || [];

        const rolesText =
          roles.length > 0 ? roles.join(" ") + (member.roles.cache.size - 1 > 15 ? " …" : "") : "—";

        const embed = new EmbedBuilder()
          .setTitle(`👤 User Info — ${user.username}`)
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

      if (name === "serverinfo") {
        const g = interaction.guild;
        if (!g) return interaction.reply({ content: "Ini cuma bisa dipakai di server ya 👀", ephemeral: true });

        const owner = await g.fetchOwner().catch(() => null);
        const channels = g.channels.cache;
        const textCount = channels.filter((c) => c.isTextBased()).size;

        const embed = new EmbedBuilder()
          .setTitle(`🏰 Server Info — ${g.name}`)
          .setThumbnail(g.iconURL({ size: 256 }))
          .addFields(
            { name: "👑 Owner", value: owner ? `<@${owner.id}>` : "Unknown", inline: true },
            { name: "👥 Members", value: `${g.memberCount}`, inline: true },
            { name: "💬 Text Channels", value: `${textCount}`, inline: true },
            { name: "🎭 Roles", value: `${g.roles.cache.size}`, inline: true },
            { name: "📅 Created", value: `<t:${Math.floor(g.createdTimestamp / 1000)}:F>`, inline: false }
          )
          .setFooter({ text: `Server ID: ${g.id}` })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      if (name === "menfesspanel") {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({ content: "command ini cuma buat admin ya 👀", ephemeral: true });
        }

        const ch = getChannelById(interaction.guild, process.env.MENFESS_CHANNEL_ID);
        if (!ch) return interaction.reply({ content: "MENFESS_CHANNEL_ID belum valid di .env", ephemeral: true });

        const embed = new EmbedBuilder()
          .setTitle("🕯️ MENFESS")
          .setDescription("Klik tombol untuk kirim menfess **anonim**.\nBalasan juga bisa anonim.")
          .setFooter({ text: "No doxxing / hate / threat. Keep it safe." });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("menfess:new")
            .setLabel("Kirim Menfess")
            .setStyle(ButtonStyle.Success)
            .setEmoji("✉️")
        );

        await ch.send({ embeds: [embed], components: [row] });
        return interaction.reply({ content: "✅ panel menfess terkirim ke channel menfess.", ephemeral: true });
      }

      if (name === "idcard") {
        const embed = new EmbedBuilder()
          .setTitle(`🪪 ${ID_CARD_TITLE}`)
          .setDescription("Klik tombol untuk membuat / update **HOV IDENTITY CARD** kamu.")
          .setFooter({ text: "Theme: isi Status pakai `| dark` atau `| light` (contoh: single | dark)" });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("idcard:open")
            .setLabel("Buat / Update ID")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("🪪")
        );

        return interaction.reply({ embeds: [embed], components: [row] });
      }

      return;
    }

    // ============ BUTTON ============
    if (interaction.isButton()) {
      const id = interaction.customId;

      // --- MENFESS NEW
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

      // --- MENFESS REPLY
      if (id.startsWith("menfess:reply:")) {
        const menfessId = id.split(":")[2];

        const modal = new ModalBuilder()
          .setCustomId(`menfess:reply_submit:${menfessId}`)
          .setTitle(`🫣 Balas Anonim #${menfessId}`);

        const reply = new TextInputBuilder()
          .setCustomId("reply_msg")
          .setLabel("Isi balasan")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1200)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(reply));
        return interaction.showModal(modal);
      }

      // --- ID CARD OPEN
      if (id === "idcard:open") {
        const modal = new ModalBuilder().setCustomId("idcard:submit").setTitle(`🪪 ${ID_CARD_TITLE}`);

        const nameInput = new TextInputBuilder()
          .setCustomId("name")
          .setLabel("Nama")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(24)
          .setRequired(true);

        const genderInput = new TextInputBuilder()
          .setCustomId("gender")
          .setLabel("Gender (L / P / W / dll)")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(8)
          .setRequired(true);

        const domInput = new TextInputBuilder()
          .setCustomId("dom")
          .setLabel("Domisili")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(24)
          .setRequired(true);

        const hobiInput = new TextInputBuilder()
          .setCustomId("hobi")
          .setLabel("Hobi")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(30)
          .setRequired(true);

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

    // ============ MODAL ============
    if (interaction.isModalSubmit()) {
      const id = interaction.customId;

      // --- MENFESS SUBMIT
      if (id === "menfess:submit") {
        const ch = getChannelById(interaction.guild, process.env.MENFESS_CHANNEL_ID);
        if (!ch) return interaction.reply({ content: "MENFESS_CHANNEL_ID belum valid di .env", ephemeral: true });

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
          .setDescription(`**untuk:** ${to}\n\n${content}\n\n— **${senderLabel}**`)
          .setColor(0x8b5cf6)
          .setFooter({ text: `Posted by ${BRAND_NAME}` })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("menfess:new").setLabel("Kirim Baru").setStyle(ButtonStyle.Success).setEmoji("✉️"),
          new ButtonBuilder().setCustomId(`menfess:reply:${menfessId}`).setLabel("Balas Anonim").setStyle(ButtonStyle.Primary).setEmoji("🫣")
        );

        const sent = await ch.send({ embeds: [embed], components: [row] });

        const db2 = loadMenfessDB();
        db2.posts[String(menfessId)] = { messageId: sent.id, channelId: ch.id };
        saveMenfessDB(db2);

        return interaction.reply({ content: "✅ menfess terkirim.", ephemeral: true });
      }

      // --- MENFESS REPLY SUBMIT
      if (id.startsWith("menfess:reply_submit:")) {
        const menfessId = id.split(":")[2];
        const replyText = interaction.fields.getTextInputValue("reply_msg").trim();
        if (!replyText) return interaction.reply({ content: "Balasan kosong 😭", ephemeral: true });

        const db = loadMenfessDB();
        const post = db.posts[String(menfessId)];
        if (!post) return interaction.reply({ content: "Menfess asal tidak ditemukan (mungkin sudah kehapus).", ephemeral: true });

        const ch = getChannelById(interaction.guild, post.channelId);
        if (!ch) return interaction.reply({ content: "Channel menfess tidak valid.", ephemeral: true });

        const anon = getAnonLabel(db, interaction.user.id);
        saveMenfessDB(db);

        const embed = new EmbedBuilder()
          .setTitle("🫣 Balasan Anonim")
          .setDescription(`${replyText}\n\n— **${anon}**`)
          .setColor(0x8b5cf6)
          .setFooter({ text: `Reply to menfess #${menfessId}` })
          .setTimestamp();

        await ch.send({
          embeds: [embed],
          reply: { messageReference: post.messageId },
          allowedMentions: { repliedUser: false },
        });

        return interaction.reply({ content: "✅ balasan terkirim.", ephemeral: true });
      }

      // --- ID CARD SUBMIT
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

        if (!db.users[uid]) {
          db.users[uid] = { number: genCardNumber(uid), createdAt: Date.now() };
        }
        db.users[uid] = { ...db.users[uid], ...payload, updatedAt: Date.now() };
        saveIdDB(db);

        const createdAtText = new Date(db.users[uid].createdAt).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });

        // IMPORTANT: modal submit -> langsung deferReply sekali, lalu editReply
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
        });

        const file = new AttachmentBuilder(png, { name: "hov_idcard.png" });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("idcard:open")
            .setLabel("Buat / Update ID")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("🪪")
        );

        return interaction.editReply({
          content: `<@${interaction.user.id}>, berikut **${ID_CARD_TITLE}** kamu:`,
          files: [file],
          components: [row],
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
