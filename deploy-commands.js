/**
 * deploy-commands.js
 * node deploy-commands.js
 *
 * npm i discord.js dotenv
 * .env wajib:
 * DISCORD_TOKEN=xxxxx
 * CLIENT_ID=xxxxx
 * GUILD_ID=xxxxx
 */

require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("cek ping bot"),
  new SlashCommandBuilder().setName("halo").setDescription("sapa bot"),
  new SlashCommandBuilder().setName("about").setDescription("info bot"),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("lihat info user")
    .addUserOption((o) => o.setName("user").setDescription("pilih user").setRequired(false)),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("lihat avatar user")
    .addUserOption((o) => o.setName("user").setDescription("pilih user").setRequired(false)),

  new SlashCommandBuilder()
    .setName("afk")
    .setDescription("set status afk")
    .addStringOption((o) => o.setName("reason").setDescription("alasan AFK").setRequired(false)),

  new SlashCommandBuilder().setName("registry").setDescription("lihat daftar warga terdaftar ID Card"),
  new SlashCommandBuilder().setName("serverinfo").setDescription("info server"),
  new SlashCommandBuilder().setName("menfesspanel").setDescription("kirim panel menfess (admin only)"),
  new SlashCommandBuilder().setName("idcard").setDescription("buat / update HOV identity card"),
  new SlashCommandBuilder().setName("sortingpanel").setDescription("kirim panel Arcane Sorting (admin only)"),

  // ✅ /myhouse (public + bisa lihat orang lain)
  new SlashCommandBuilder()
    .setName("myhouse")
    .setDescription("lihat Valerie House Card (punya kamu atau user lain)")
    .addUserOption((o) => o.setName("user").setDescription("pilih user (opsional)").setRequired(false)),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const clientId = process.env.CLIENT_ID;
    const guildId = process.env.GUILD_ID;

    if (!clientId || !guildId) throw new Error("CLIENT_ID / GUILD_ID belum ada di .env");
    if (!process.env.DISCORD_TOKEN) throw new Error("DISCORD_TOKEN belum ada di .env");

    console.log("Deploying slash commands...");
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log("✅ Done deploy commands.");
  } catch (err) {
    console.error(err);
  }
})();
