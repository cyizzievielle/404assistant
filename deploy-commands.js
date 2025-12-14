require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("cek latency bot"),

  new SlashCommandBuilder()
    .setName("halo")
    .setDescription("bot nyapa kamu"),

  new SlashCommandBuilder()
    .setName("testwelcome")
    .setDescription("test welcome message (admin only)"),
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("⏳ registering slash commands...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("✅ slash commands registered!");
  } catch (err) {
    console.error(err);
  }
})();
