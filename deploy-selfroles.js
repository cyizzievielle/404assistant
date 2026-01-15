require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("selfrolespanel")
    .setDescription("Kirim panel self-role (Age/Interest/Status) ke channel ini. (Owner-only)")
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  if (!process.env.CLIENT_ID || !process.env.GUILD_ID) {
    console.log("❌ Isi CLIENT_ID dan GUILD_ID di .env dulu.");
    process.exit(1);
  }

  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );

  console.log("✅ /selfrolespanel deployed");
})();
