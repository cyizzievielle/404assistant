require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Events,
  PermissionsBitField,
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, () => {
  console.log("🤖 bot 404 society sudah online!");
});

const WELCOME_MESSAGES = [
  (m, g) => `✨ sebuah jiwa baru telah melintasi gerbang. selamat datang ${m}, di ${g}. semoga perjalananmu di realm ini menyenangkan dan penuh cerita. 🌙`,
  (m, g) => `🔮 gerbang terbuka… ${m} telah tiba. selamat datang di ${g}. silakan jelajahi, berkenalan, dan temukan tempatmu di antara kami. ✨`,
  (m, g) => `🌌 angin membawa kehadiran baru. halo ${m}, selamat datang di ${g}. semoga kamu menemukan teman, cerita, dan kenyamanan di sini. 🕯️`,
  (m, g) => `✨ sebuah langkah baru memasuki realm. ${m}, selamat datang di ${g}. jangan ragu menyapa dan bergabung dengan percakapan. 🌿`,
  (m, g) => `🌙 takdir mempertemukan kita hari ini. selamat datang ${m}, di ${g}. semoga perjalananmu di sini berjalan tenang dan menyenangkan. ✨`,
  (m, g) => `🔮 cahaya gerbang menyambutmu, ${m}. selamat datang di ${g}. semoga kamu merasa diterima dan betah di dalam realm ini. 🌌`,
  (m, g) => `🕯️ sebuah jiwa baru tiba di ambang gerbang. selamat datang ${m}, di ${g}. luangkan waktu untuk membaca aturan, lalu nikmati perjalananmu bersama kami. ✨`,
  (m, g) => `🌠 bisikan takdir membawa ${m} ke dalam ${g}. selamat datang, semoga langkahmu di sini penuh kehangatan dan cerita. ✨`,
  (m, g) => `🕯️ cahaya lembut dari gerbang menyambutmu, ${m}. selamat datang di ${g}. semoga kamu menemukan tempat yang nyaman di antara kami. 🌿`,
  (m, g) => `🌙 di bawah naungan bintang, ${m} melangkah ke ${g}. selamat datang, semoga perjalananmu di realm ini berjalan indah. ✨`,
  (m, g) => `🔮 sebuah kehadiran baru terukir dalam catatan realm. selamat datang ${m}, di ${g}. nikmati waktu dan kebersamaan di sini. 🌌`,
  (m, g) => `✨ gerbang berpendar pelan saat ${m} tiba. selamat datang di ${g}. semoga setiap langkahmu di sini terasa menyenangkan. 🌿`,
  (m, g) => `🌠 takdir menuntun langkahmu ke ${g}, ${m}. selamat datang, semoga kamu merasa diterima dan betah di dalam realm ini. ✨`,
  (m, g) => `🕯️ jejak baru tercipta di ambang gerbang. selamat datang ${m}, di ${g}. luangkan waktu untuk mengenal, lalu jelajahi bersama kami. 🌙`,
  (m, g) => `🔮 aliran waktu membawa ${m} memasuki ${g}. selamat datang, semoga perjalananmu dipenuhi hal-hal baik. ✨`,
  (m, g) => `🌌 langit seakan berbisik saat ${m} tiba di ${g}. selamat datang, semoga kamu menemukan kenyamanan dan teman baru. 🌿`,
  (m, g) => `✨ sebuah langkah tenang memasuki realm. ${m}, selamat datang di ${g}. kami menyambutmu dengan hangat. 🌙`,
];

function getGeneralChannel(guild) {
  const chId = process.env.GENERAL_CHANNEL_ID;
  if (!chId) return null;

  const channel = guild.channels.cache.get(chId);
  if (!channel) return null;
  if (!channel.isTextBased()) return null;

  return channel;
}

// ✅ otomatis saat member join
client.on(Events.GuildMemberAdd, async (member) => {
  const channel = getGeneralChannel(member.guild);
  if (!channel) return;

  const mention = `<@${member.id}>`;
  const guildName = `**${member.guild.name}**`; // otomatis + bold
  const msg =
    WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)](
      mention,
      guildName
    );

  channel.send(msg).catch(console.error);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    return interaction.reply(`🏓 pong! ${client.ws.ping}ms`);
  }

if (interaction.commandName === "halo") {
  const serverName = interaction.guild?.name || "realm ini";

  const replies = [
    `✨ salam, **${interaction.user.username}**.\nsebuah jiwa baru menyapa di **${serverName}**.`,
    `🌙 gerbang berpendar pelan saat **${interaction.user.username}** berbicara.\nselamat datang di **${serverName}**.`,
    `🔮 suaramu menggema di dalam **${serverName}**, **${interaction.user.username}**.\nsemoga langkahmu di sini menyenangkan.`,
    `🕯️ salam hangat, **${interaction.user.username}**.\n**${serverName}** menyambut kehadiranmu.`,
    `🌌 sebuah sapaan sederhana membuka percakapan.\nselamat datang **${interaction.user.username}** di **${serverName}**.`,
    `✨ cahaya lembut menyertai salam darimu.\n**${serverName}** selalu terbuka untukmu, **${interaction.user.username}**.`,
  ];

  const reply = replies[Math.floor(Math.random() * replies.length)];
  return interaction.reply(reply);
}

  // ✅ test welcome (admin only)
  if (interaction.commandName === "testwelcome") {
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.Administrator
      )
    ) {
      return interaction.reply({
        content: "command ini cuma buat admin ya 👀",
        ephemeral: true,
      });
    }

    const channel = getGeneralChannel(interaction.guild);
    if (!channel) {
      return interaction.reply({
        content: "channel welcome belum diset 😭 (cek GENERAL_CHANNEL_ID di .env)",
        ephemeral: true,
      });
    }

    const mention = `<@${interaction.user.id}>`;
    const guildName = `**${interaction.guild.name}**`; // ✅ ini yang bener (bukan member)
    const msg =
      WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)](
        mention,
        guildName
      );

    await channel.send(msg);
    return interaction.reply({
      content: "welcome test berhasil dikirim 👌",
      ephemeral: true,
    });
  }
});

client.login(process.env.TOKEN);
