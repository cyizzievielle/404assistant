require("dotenv").config();
const { REST, Routes } = require("discord.js");

const commands = [
  { name: "ping", description: "Cek latency bot" },
  { name: "halo", description: "Sapa bot" },
  { name: "about", description: "Info bot" },

  {
    name: "userinfo",
    description: "Lihat info user",
    options: [
      { name: "user", description: "Pilih user (opsional)", type: 6, required: false }, // USER
    ],
  },

  {
    name: "avatar",
    description: "Lihat avatar user",
    options: [
      { name: "user", description: "Pilih user (opsional)", type: 6, required: false }, // USER
    ],
  },

  { name: "serverinfo", description: "Lihat info server" },
  { name: "menfesspanel", description: "Kirim panel menfess ke channel menfess (Admin only)" },
  { name: "idcard", description: "Buka panel pembuatan HOV Identity Card" },

  {
    name: "afk",
    description: "Set status AFK kamu",
    options: [{ name: "reason", description: "Alasan AFK (opsional)", type: 3, required: false }], // STRING
  },

  { name: "registry", description: "Lihat daftar warga yang sudah punya HOV ID Card" },
];

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId || !guildId) {
    console.error("ENV kurang. Pastikan DISCORD_TOKEN, CLIENT_ID, GUILD_ID ada di .env");
    process.exit(1);
  }

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    console.log("Deploying guild commands...");
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log("✅ Done deploy guild commands!");
  } catch (err) {
    console.error(err);
  }
}

main();
