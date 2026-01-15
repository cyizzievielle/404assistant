/**
 * deploy-commands.js — Mystral Assistant (FIXED)
 * discord.js v14
 *
 * Run:
 *   node deploy-commands.js
 *
 * Env required:
 *   DISCORD_TOKEN=xxxxx
 *   CLIENT_ID=xxxxx
 *   GUILD_ID=xxxxx
 */

require("dotenv").config();
const { REST, Routes, SlashCommandBuilder, ChannelType } = require("discord.js");

function need(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    console.error(`❌ Missing env: ${name}`);
    process.exit(1);
  }
  return String(v).trim();
}

const token = need("DISCORD_TOKEN");
const clientId = need("CLIENT_ID");
const guildId = need("GUILD_ID");

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("cek ping bot"),
  new SlashCommandBuilder().setName("halo").setDescription("sapa bot"),
  new SlashCommandBuilder().setName("about").setDescription("info bot"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("lihat daftar perintah bot"),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("lihat avatar user")
    .addUserOption((o) => o.setName("user").setDescription("pilih user").setRequired(false)),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("lihat info user (lebih lengkap)")
    .addUserOption((o) => o.setName("user").setDescription("pilih user").setRequired(false)),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("lihat info server (lebih lengkap)"),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("lihat profile Mystral: ID Card, Arcana, AFK, roles")
    .addUserOption((o) => o.setName("user").setDescription("pilih user").setRequired(false)),

  new SlashCommandBuilder()
    .setName("afk")
    .setDescription("set status AFK")
    .addStringOption((o) => o.setName("reason").setDescription("alasan AFK (opsional)").setRequired(false)),

  new SlashCommandBuilder()
    .setName("registry")
    .setDescription("lihat daftar student yang sudah terdaftar ID Card"),

  new SlashCommandBuilder()
    .setName("myhouse")
    .setDescription("lihat hasil arcane sorting (punya kamu atau orang lain)")
    .addUserOption((o) => o.setName("user").setDescription("pilih user (opsional)").setRequired(false)),

  // OWNER-only panels (lock di index.js)
  new SlashCommandBuilder()
    .setName("menfesspanel")
    .setDescription("kirim panel menfess (owner only)"),

  new SlashCommandBuilder()
    .setName("sortingpanel")
    .setDescription("kirim panel sorting (owner only)"),

  new SlashCommandBuilder()
    .setName("idcard")
    .setDescription("buka panel ID Card (owner only)"),

  new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("kirim panel ticket (owner only)"),

  new SlashCommandBuilder()
    .setName("selfrolespanel")
    .setDescription("kirim panel self-role (Age/Interest/Status/Region/Ping) (owner only)"),

  // OWNER-only: send embed custom
  new SlashCommandBuilder()
    .setName("sendembed")
    .setDescription("kirim embed custom ke channel (owner-only)")
    .addStringOption((o) => o.setName("title").setDescription("judul embed").setRequired(true))
    .addStringOption((o) => o.setName("description").setDescription("isi embed").setRequired(true))
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("channel tujuan (opsional)")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )
    .addStringOption((o) => o.setName("color").setDescription("warna hex, contoh: #77d0d7 (opsional)").setRequired(false))
    .addStringOption((o) => o.setName("footer").setDescription("footer text (opsional)").setRequired(false))
    .addStringOption((o) => o.setName("image").setDescription("image URL (opsional)").setRequired(false))
    .addStringOption((o) => o.setName("thumbnail").setDescription("thumbnail URL (opsional)").setRequired(false)),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log(`🚀 Deploying ${commands.length} commands to guild ${guildId}...`);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log("✅ Done! Commands updated.");
  } catch (e) {
    console.error("❌ Deploy failed:", e);
    process.exit(1);
  }
})();

console.log("TOKEN prefix:", process.env.DISCORD_TOKEN?.slice(0, 10));
console.log("CLIENT_ID:", process.env.CLIENT_ID);
console.log("GUILD_ID:", process.env.GUILD_ID);
console.log("DEPLOY LIST:", commands.map(c => c.name));
