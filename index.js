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
  (m, g) => `eh halo ${m}! 👋 selamat bergabung yaaa. ${g} jadi makin rame nih ada kamu. have fun dan semoga harimu menyenangkan! 💫`,
  (m, g) => `knock knock! ada ${m} dateng nih! 🚪 selamat datang di ${g} bestie! jangan lupa say hi di chat yaaa! 🌈`,
  (m, g) => `waaah ada temen baru! halo ${m}, salken yaaa! 🥰 jangan malu-malu buat ngobrol di chat umum. we are happy to have you! 💖`,
  (m, g) => `hi hi ${m}! akhirnya dateng juga! 🥳 yuk kenalan sama yang lain. kalo butuh bantuan, jangan ragu buat tanya-tanya admin ya! 💕`,
  (m, g) => `yey! ${m} sudah mendarat di ${g}! 🚀 selamat bergabung! semoga kita bisa jadi temen baik yaaa! 🌙`,
  (m, g) => `halo ${m}, selamat datang! 🌷 ih seneng deh nambah member baru. semoga kamu nyaman main di ${g} yaaa! ✨`,
  (m, g) => `welcome home ${m}! 🏡 makasih banyak udah mampir ke ${g}. yuk langsung seru-seruan bareng kita! jangan lupa baca rules dulu ya cantik/ganteng! 🎀`,
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
    const replies = [
      `halo **${interaction.user.username}** 👋\nselamat datang di 404 society`,
      `hai **${interaction.user.username}**\nsantai aja, kamu udah di 404 society`,
      `halo **${interaction.user.username}** 👀\nnyasar? enggak kok, ini 404 society`,
      `yo **${interaction.user.username}** 😄\nwelcome to 404 society`,
      `halo **${interaction.user.username}**\nrumahnya orang-orang yang “nggak ketemu”`,
      `hai **${interaction.user.username}** ✨\n404 society selalu kebuka buat kamu`,
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
