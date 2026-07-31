/**
 * MIYO Discord Bot — Stream Anime to Discord Voice Channels
 * 
 * Slash commands:
 *   /play <anime> [episode] [sub|dub] [provider]  — Search, resolve, and stream to VC
 *   /search <query>                                — Browse results with a select menu
 *   /stop                                          — Stop playback and leave VC
 *   /skip                                          — Skip to the next episode in queue
 *   /queue                                         — Show current queue
 *   /np                                            — Now-playing info
 * 
 * Requires: DISCORD_BOT_TOKEN in .env
 */

import { createRequire } from 'module';
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
  ActivityType,
} from 'discord.js';
import {
  joinVoiceChannel,
  createAudioResource,
  createAudioPlayer,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  NoSubscriberBehavior,
  StreamType,
} from '@discordjs/voice';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);

// ── Resolve FFmpeg binary ──
let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
} catch {
  ffmpegPath = 'ffmpeg'; // fallback to system ffmpeg
}

// ── Load anime providers (same extensions the web app uses) ──
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const providers = {};
const extensionsDir = path.join(__dirname, 'extensions', 'Anime');

import fs from 'fs';
if (fs.existsSync(extensionsDir)) {
  const files = fs.readdirSync(extensionsDir).filter(f => f.endsWith('.cjs') || f.endsWith('.js'));
  for (const file of files) {
    try {
      const provider = require(path.join(extensionsDir, file));
      if (provider.name) {
        providers[provider.name] = provider;
      }
    } catch (err) {
      console.warn(`[MIYO-BOT] Failed to load provider ${file}:`, err.message);
    }
  }
}

const PROVIDER_NAME = 'anikoto';
const provider = providers[PROVIDER_NAME];
if (!provider) {
  console.warn(`[MIYO-BOT] Provider '${PROVIDER_NAME}' not loaded — bot may not work.`);
}

// ── Bot token check ──
const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) {
  console.warn('[MIYO-BOT] DISCORD_BOT_TOKEN not set — Discord bot disabled.');
  // Export empty so server.js import doesn't crash
  // (no-op module)
} else {
  bootBot(TOKEN);
}

// ═══════════════════════════════════════════════════════════════════════
// ── Per-guild state ──
// ═══════════════════════════════════════════════════════════════════════
const APPLICATION_ID = '1297956800427065475';
let botClient = null; // stored so we can update Rich Presence from anywhere
const guilds = new Map(); // guildId → GuildState

class GuildState {
  constructor() {
    this.queue = [];          // { animeTitle, episodeNum, episodeId, subdub, provider, thumbnail, animeId }
    this.current = null;      // same shape as queue item, plus { player, connection, resource, ffmpeg }
    this.textChannel = null;  // last text channel used
    this.autoPlay = false;
    this.lastInteraction = null;
  }
}

function getGuild(guildId) {
  if (!guilds.has(guildId)) guilds.set(guildId, new GuildState());
  return guilds.get(guildId);
}

// ═══════════════════════════════════════════════════════════════════════
// ── Slash Command Definitions ──
// ═══════════════════════════════════════════════════════════════════════
const commands = [
  {
    name: 'play',
    description: 'Stream anime audio to voice channel',
    options: [
      { name: 'anime', description: 'Anime name to search', type: 3, required: true },
      { name: 'episode', description: 'Episode number (default: 1)', type: 4, required: false },
      { name: 'lang', description: 'Subtitle language (sub or dub)', type: 3, required: false,
        choices: [
          { name: 'Sub (Japanese audio + subtitles)', value: 'sub' },
          { name: 'Dub (English audio)', value: 'dub' },
        ]
      },
    ],
  },
  {
    name: 'search',
    description: 'Search anime and browse results',
    options: [
      { name: 'query', description: 'Anime name to search', type: 3, required: true },
    ],
  },
  { name: 'stop', description: 'Stop playback and leave voice channel' },
  { name: 'skip', description: 'Skip to the next episode' },
  { name: 'queue', description: 'Show the current queue' },
  { name: 'np', description: 'Show now-playing info' },
  {
    name: 'watch',
    description: 'Launch MIYO player inside Discord (Activity)',
    options: [
      { name: 'anime', description: 'Anime name to search (optional)', type: 3, required: false },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════
// ── Boot the bot ──
// ═══════════════════════════════════════════════════════════════════════
function bootBot(token) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
    ],
  });

  client.once('clientReady', async () => {
    botClient = client;
    console.log(`[MIYO-BOT] Logged in as ${client.user.tag}`);
    updateBotPresence(); // set idle presence

    // Register slash commands
    const rest = new REST({ version: '10' }).setToken(token);
    try {
      const guildId = process.env.DISCORD_GUILD_ID;
      
      // Fetch existing commands to preserve the Activity Entry Point (type 4)
      const route = guildId 
        ? Routes.applicationGuildCommands(client.user.id, guildId)
        : Routes.applicationCommands(client.user.id);
        
      const existing = await rest.get(route).catch(() => []);
      const entryPointCmd = existing.find(cmd => cmd.type === 4);
      
      const payload = [...commands];
      if (entryPointCmd) {
        // Strip readonly fields before putting it back
        const { id, application_id, version, ...restCmd } = entryPointCmd;
        payload.push(restCmd);
      }

      await rest.put(route, { body: payload });
      console.log(`[MIYO-BOT] Slash commands registered (${guildId ? 'guild' : 'global'})`);
    } catch (err) {
      console.error('[MIYO-BOT] Failed to register commands:', err.message);
    }
  });

  // ── Slash command handler ──
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
      const g = getGuild(interaction.guildId);
      g.textChannel = interaction.channel;
      g.lastInteraction = interaction;

      try {
        switch (interaction.commandName) {
          case 'play':    await handlePlay(interaction, g); break;
          case 'search':  await handleSearch(interaction, g); break;
          case 'stop':    await handleStop(interaction, g); break;
          case 'skip':    await handleSkip(interaction, g); break;
          case 'queue':   await handleQueue(interaction, g); break;
          case 'np':      await handleNowPlaying(interaction, g); break;
          case 'watch':   await handleWatch(interaction, g); break;
        }
      } catch (err) {
        console.error(`[MIYO-BOT] Command error:`, err);
        const msg = { content: `❌ Error: ${err.message}`, ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(msg).catch(() => {});
        } else {
          await interaction.reply(msg).catch(() => {});
        }
      }
    }

    // ── Button interactions (auto-play, next episode, stop) ──
    if (interaction.isButton()) {
      const g = getGuild(interaction.guildId);
      g.textChannel = interaction.channel;
      try {
        if (interaction.customId === 'miyo_next_ep') {
          await interaction.deferUpdate();
          await playNextInQueue(g, interaction.guild);
        } else if (interaction.customId === 'miyo_autoplay') {
          g.autoPlay = !g.autoPlay;
          await interaction.update({
            content: g.autoPlay
              ? '🔁 **Auto-play enabled** — Next episodes will play automatically.'
              : '⏹️ **Auto-play disabled**.',
            components: [],
          });
          if (g.autoPlay && !g.current && g.queue.length > 0) {
            await playNextInQueue(g, interaction.guild);
          }
        } else if (interaction.customId === 'miyo_stop') {
          await interaction.deferUpdate();
          stopPlayback(g);
          await interaction.editReply({ content: '⏹️ Stopped playback.', components: [] });
        }
      } catch (err) {
        console.error('[MIYO-BOT] Button error:', err);
      }
    }

    // ── Select menu interactions (search results) ──
    if (interaction.isStringSelectMenu() && interaction.customId === 'miyo_search_select') {
      const g = getGuild(interaction.guildId);
      g.textChannel = interaction.channel;
      try {
        await interaction.deferUpdate();
        const animeId = interaction.values[0];
        await playAnimeById(interaction, g, animeId, 1, 'sub');
      } catch (err) {
        console.error('[MIYO-BOT] Select error:', err);
      }
    }
  });

  client.login(token).catch(err => {
    console.error('[MIYO-BOT] Login failed:', err.message);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// ── Command Handlers ──
// ═══════════════════════════════════════════════════════════════════════

async function handlePlay(interaction, g) {
  const animeName = interaction.options.getString('anime');
  const episode = interaction.options.getInteger('episode') || 1;
  const lang = interaction.options.getString('lang') || 'sub';

  // Check user is in a voice channel
  const member = interaction.member;
  const voiceChannel = member?.voice?.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: '❌ You need to be in a voice channel first!', ephemeral: true });
  }

  await interaction.deferReply();

  if (!provider) {
    return interaction.editReply('❌ Anime provider not loaded. Check server logs.');
  }

  // Search for the anime
  const searchResults = await provider.SearchAnime(animeName);
  if (!searchResults?.results?.length) {
    return interaction.editReply(`❌ No results found for **${animeName}**`);
  }

  // Use first result
  const anime = searchResults.results[0];
  await playAnimeById(interaction, g, anime.id, episode, lang);
}

async function handleSearch(interaction, g) {
  const query = interaction.options.getString('query');

  await interaction.deferReply();

  if (!provider) {
    return interaction.editReply('❌ Anime provider not loaded. Check server logs.');
  }

  const searchResults = await provider.SearchAnime(query);
  if (!searchResults?.results?.length) {
    return interaction.editReply(`❌ No results found for **${query}**`);
  }

  const results = searchResults.results.slice(0, 10);

  const embed = new EmbedBuilder()
    .setColor(0xFF6B9D)
    .setTitle(`🔍 Search Results — "${query}"`)
    .setDescription(results.map((r, i) =>
      `**${i + 1}.** ${r.title || r.name || 'Unknown'} ${r.subOrDub ? `(${r.subOrDub})` : ''}`
    ).join('\n'))
    .setFooter({ text: 'Select an anime below to start playing' })
    .setTimestamp();

  if (results[0]?.image || results[0]?.poster) {
    embed.setThumbnail(results[0].image || results[0].poster);
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('miyo_search_select')
    .setPlaceholder('Pick an anime to play…')
    .addOptions(
      results.map((r, i) => ({
        label: (r.title || r.name || 'Unknown').slice(0, 100),
        description: `${r.subOrDub || 'sub'} • ${r.type || 'TV'}`.slice(0, 100),
        value: r.id,
      }))
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);
  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleStop(interaction, g) {
  stopPlayback(g);
  g.queue = [];
  g.autoPlay = false;
  await interaction.reply({ embeds: [
    new EmbedBuilder()
      .setColor(0xFF4444)
      .setDescription('⏹️ Stopped playback and cleared queue.')
  ]});
}

async function handleSkip(interaction, g) {
  if (g.queue.length === 0 && !g.current) {
    return interaction.reply({ content: '❌ Nothing to skip — queue is empty.', ephemeral: true });
  }

  await interaction.deferReply();
  stopPlayback(g, false); // stop current but don't disconnect
  await playNextInQueue(g, interaction.guild);
  if (!g.current) {
    await interaction.editReply('⏭️ Skipped. Queue is now empty.');
  }
}

async function handleQueue(interaction, g) {
  const lines = [];
  if (g.current) {
    lines.push(`▶️ **Now Playing:** ${g.current.animeTitle} — Episode ${g.current.episodeNum} (${g.current.subdub})`);
  }
  if (g.queue.length > 0) {
    lines.push('', '📋 **Queue:**');
    g.queue.forEach((item, i) => {
      lines.push(`${i + 1}. ${item.animeTitle} — Episode ${item.episodeNum} (${item.subdub})`);
    });
  }
  if (lines.length === 0) {
    lines.push('Queue is empty. Use `/play` to add something!');
  }
  lines.push('', `🔁 Auto-play: ${g.autoPlay ? '**ON**' : '**OFF**'}`);

  await interaction.reply({ embeds: [
    new EmbedBuilder()
      .setColor(0xFF6B9D)
      .setTitle('🎵 MIYO Queue')
      .setDescription(lines.join('\n'))
  ]});
}

async function handleNowPlaying(interaction, g) {
  if (!g.current) {
    return interaction.reply({ content: '❌ Nothing is playing right now.', ephemeral: true });
  }

  const embed = buildNowPlayingEmbed(g.current);
  await interaction.reply({ embeds: [embed] });
}

// ═══════════════════════════════════════════════════════════════════════
// ── Core streaming logic ──
// ═══════════════════════════════════════════════════════════════════════

async function playAnimeById(interaction, g, animeId, episode, subdub) {
  if (!provider) throw new Error('Anime provider not loaded');

  // Fetch anime info & episodes
  const animeInfo = await provider.AnimeInfo(animeId);
  if (!animeInfo) throw new Error('Could not fetch anime info.');

  const animeTitle = animeInfo.title || animeInfo.name || 'Unknown Anime';
  const thumbnail = animeInfo.image || animeInfo.poster || null;

  // Fetch episode list
  let episodes;
  if (provider.fetchEpisode) {
    const epData = await provider.fetchEpisode(animeId, 1);
    episodes = epData?.episodes || epData?.results || [];
    // If there are more pages, fetch them
    if (epData?.hasNextPage) {
      let page = 2;
      while (page <= 10) { // cap at 10 pages
        try {
          const more = await provider.fetchEpisode(animeId, page);
          const moreEps = more?.episodes || more?.results || [];
          if (moreEps.length === 0) break;
          episodes = episodes.concat(moreEps);
          if (!more?.hasNextPage) break;
          page++;
        } catch { break; }
      }
    }
  } else {
    episodes = animeInfo.episodes || [];
  }

  if (!episodes || episodes.length === 0) {
    const msg = `❌ No episodes found for **${animeTitle}**`;
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(msg);
    }
    return interaction.reply(msg);
  }

  // Find the requested episode
  const epIndex = Math.max(0, Math.min(episode - 1, episodes.length - 1));
  const targetEp = episodes[epIndex];
  const episodeId = targetEp.id || targetEp.episodeId;
  const episodeNum = targetEp.number || targetEp.episode || episode;

  // Queue remaining episodes after the current one for auto-play
  g.queue = [];
  for (let i = epIndex + 1; i < episodes.length; i++) {
    const ep = episodes[i];
    g.queue.push({
      animeTitle,
      episodeNum: ep.number || ep.episode || (i + 1),
      episodeId: ep.id || ep.episodeId,
      subdub,
      provider: PROVIDER_NAME,
      thumbnail,
      animeId,
    });
  }

  // Now resolve and stream
  await resolveAndStream(interaction, g, {
    animeTitle,
    episodeNum,
    episodeId,
    subdub,
    provider: PROVIDER_NAME,
    thumbnail,
    animeId,
  });
}

async function resolveAndStream(interaction, g, trackInfo) {
  if (!provider?.fetchEpisodeSources) throw new Error('Provider does not support fetching sources');

  // Resolve the episode ID with sub/dub suffix
  let resolvedEp = trackInfo.episodeId;
  if (trackInfo.subdub && !resolvedEp.endsWith('-sub') && !resolvedEp.endsWith('-dub') && !resolvedEp.endsWith('-both')) {
    resolvedEp = `${resolvedEp}-${trackInfo.subdub}`;
  }

  const sourcesData = await provider.fetchEpisodeSources(resolvedEp);
  if (!sourcesData) throw new Error('Could not fetch episode sources');

  // Pick the best source
  const sources = sourcesData.sources || sourcesData.sub?.sources || sourcesData.dub?.sources || [];
  if (sources.length === 0) throw new Error('No streaming sources available for this episode');

  const source = sources[0]; // Use first available source
  const m3u8Url = source.url;
  const referer = source.headers?.Referer || '';
  const subtitles = sourcesData.subtitles || sourcesData.sub?.subtitles || [];

  if (!m3u8Url) throw new Error('No stream URL found');

  // ── Get voice channel ──
  const member = interaction.member || await interaction.guild.members.fetch(interaction.user.id);
  const voiceChannel = member?.voice?.channel;
  if (!voiceChannel) {
    const msg = '❌ You need to be in a voice channel!';
    if (interaction.deferred || interaction.replied) return interaction.editReply(msg);
    return interaction.reply({ content: msg, ephemeral: true });
  }

  // Stop any current playback
  stopPlayback(g, false);

  // ── Join voice channel ──
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: interaction.guildId,
    adapterCreator: interaction.guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  // Wait for connection to be ready
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
  } catch {
    connection.destroy();
    throw new Error('Failed to join voice channel (timeout)');
  }

  // ── Proxy the M3U8 through the MIYO server ──
  const serverPort = process.env.PORT || process.env.SERVER_PORT || 3005;
  const proxyUrl = `http://localhost:${serverPort}/api/proxy?url=${encodeURIComponent(m3u8Url)}&referer=${encodeURIComponent(referer)}`;

  // ── Spawn FFmpeg to transcode HLS → raw audio ──
  const ffmpegArgs = [
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', proxyUrl,
    '-vn',                    // no video
    '-acodec', 'libopus',     // Opus codec for Discord
    '-ar', '48000',           // 48kHz sample rate (Discord standard)
    '-ac', '2',               // stereo
    '-b:a', '128k',           // 128kbps bitrate
    '-f', 'opus',             // output format
    'pipe:1',                 // pipe to stdout
  ];

  const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  ffmpegProcess.stderr.on('data', (data) => {
    // Only log errors, not info lines
    const line = data.toString();
    if (line.includes('Error') || line.includes('error')) {
      console.error(`[MIYO-BOT] FFmpeg error: ${line.trim()}`);
    }
  });

  // ── Create audio resource and player ──
  const resource = createAudioResource(ffmpegProcess.stdout, {
    inputType: StreamType.OggOpus,
  });

  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play },
  });

  player.play(resource);
  connection.subscribe(player);

  // Save state
  g.current = {
    ...trackInfo,
    player,
    connection,
    ffmpeg: ffmpegProcess,
    startedAt: Date.now(),
    m3u8Url,
    subtitles,
  };

  // ── Update bot Rich Presence to show what's streaming ──
  updateBotPresence(g.current);

  // ── Build and send now-playing embed ──
  const embed = buildNowPlayingEmbed(g.current);
  const watchUrl = buildWatchUrl(trackInfo);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Watch on MIYO')
      .setStyle(ButtonStyle.Link)
      .setURL(watchUrl)
      .setEmoji('🎬'),
  );

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ embeds: [embed], components: [row] });
  } else {
    await interaction.reply({ embeds: [embed], components: [row] });
  }

  // ── Handle playback end ──
  player.on(AudioPlayerStatus.Idle, () => {
    onTrackEnd(g, interaction.guild);
  });

  player.on('error', (err) => {
    console.error('[MIYO-BOT] Player error:', err.message);
    onTrackEnd(g, interaction.guild);
  });

  ffmpegProcess.on('error', (err) => {
    console.error('[MIYO-BOT] FFmpeg process error:', err.message);
  });

  // Handle connection disconnect
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
      // Reconnecting...
    } catch {
      // Really disconnected
      stopPlayback(g);
    }
  });
}

// ── When a track ends ──
async function onTrackEnd(g, guild) {
  // Clean up current track
  if (g.current?.ffmpeg) {
    g.current.ffmpeg.kill('SIGKILL');
  }
  g.current = null;

  if (g.autoPlay && g.queue.length > 0) {
    // Auto-play next episode
    await playNextInQueue(g, guild);
    return;
  }

  if (g.queue.length > 0 && g.textChannel) {
    // Ask user if they want to play the next episode
    const next = g.queue[0];
    const embed = new EmbedBuilder()
      .setColor(0xFF6B9D)
      .setTitle('🎬 Episode Finished!')
      .setDescription(`**${next.animeTitle}** — Episode ${next.episodeNum} is up next.`)
      .setFooter({ text: 'Choose an option below' });

    if (next.thumbnail) embed.setThumbnail(next.thumbnail);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('miyo_next_ep')
        .setLabel('▶️ Next Episode')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('miyo_autoplay')
        .setLabel('🔁 Auto-Play All')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('miyo_stop')
        .setLabel('⏹️ Stop')
        .setStyle(ButtonStyle.Danger),
    );

    try {
      await g.textChannel.send({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('[MIYO-BOT] Failed to send next-episode prompt:', err.message);
    }
  } else {
    // No more episodes — disconnect after a delay
    setTimeout(() => {
      if (!g.current) {
        stopPlayback(g);
      }
    }, 30_000);
  }
}

async function playNextInQueue(g, guild) {
  if (g.queue.length === 0) return;

  const next = g.queue.shift();
  if (!provider?.fetchEpisodeSources) return;

  // We need a fake interaction to stream — use the text channel directly
  const fakeInteraction = {
    guildId: guild.id,
    guild: guild,
    member: null,
    deferred: true,
    replied: true,
    editReply: async (data) => {
      try { await g.textChannel.send(typeof data === 'string' ? { content: data } : data); } catch {}
    },
    reply: async (data) => {
      try { await g.textChannel.send(typeof data === 'string' ? { content: data } : data); } catch {}
    },
  };

  // We need a member in VC — find someone in the current VC
  if (g.current?.connection) {
    // Reuse existing connection's channel
    fakeInteraction.member = { voice: { channel: guild.channels.cache.get(g.current.connection.joinConfig.channelId) } };
  } else {
    // Find first member in any VC
    const voiceChannels = guild.channels.cache.filter(c => c.type === 2);
    for (const [, vc] of voiceChannels) {
      if (vc.members.size > 0) {
        const firstMember = vc.members.first();
        if (!firstMember.user.bot) {
          fakeInteraction.member = { voice: { channel: vc } };
          break;
        }
      }
    }
  }

  if (!fakeInteraction.member?.voice?.channel) {
    // No one in VC anymore
    stopPlayback(g);
    return;
  }

  try {
    await resolveAndStream(fakeInteraction, g, next);
  } catch (err) {
    console.error('[MIYO-BOT] Failed to play next in queue:', err.message);
    try {
      await g.textChannel.send(`❌ Failed to play **${next.animeTitle}** Episode ${next.episodeNum}: ${err.message}`);
    } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ── Helpers ──
// ═══════════════════════════════════════════════════════════════════════

function stopPlayback(g, disconnect = true) {
  if (g.current) {
    try { g.current.player?.stop(true); } catch {}
    try { g.current.ffmpeg?.kill('SIGKILL'); } catch {}
    if (disconnect) {
      try { g.current.connection?.destroy(); } catch {}
    }
    g.current = null;
  }
  // Reset bot Rich Presence to idle
  updateBotPresence();
}

function buildNowPlayingEmbed(track) {
  const embed = new EmbedBuilder()
    .setColor(0xFF6B9D)
    .setTitle('🎧 Now Playing')
    .setDescription([
      `**${track.animeTitle}**`,
      `Episode ${track.episodeNum} • ${track.subdub?.toUpperCase() || 'SUB'}`,
      '',
      `Provider: \`${track.provider}\``,
    ].join('\n'))
    .setFooter({ text: 'MIYO Stream • /stop to end • /skip for next' })
    .setTimestamp();

  if (track.thumbnail) embed.setThumbnail(track.thumbnail);

  if (track.subtitles?.length > 0) {
    const subLangs = track.subtitles.map(s => s.lang || 'Unknown').slice(0, 5).join(', ');
    embed.addFields({ name: '📝 Subtitles Available', value: subLangs, inline: true });
  }

  return embed;
}

function buildWatchUrl(track) {
  // Build a deep link to MIYO's web player
  const base = process.env.MIYO_URL || 'https://miyo-stream.cyber-winner.site';
  return `${base}/anime/${encodeURIComponent(track.animeId)}`;
}

// ═══════════════════════════════════════════════════════════════════════
// ── Rich Presence ──
// ═══════════════════════════════════════════════════════════════════════

/**
 * Update the bot's Rich Presence.
 * When a track is playing, shows "Streaming [Anime Name]" with a LIVE badge
 * and a clickable "Watch on MIYO" button.
 * When idle, shows "Listening to anime | /play".
 */
function updateBotPresence(currentTrack = null) {
  if (!botClient?.user) return;

  if (currentTrack) {
    // Streaming type gives a purple LIVE badge + clickable URL
    const miyoUrl = process.env.MIYO_URL || 'https://miyo-stream.cyber-winner.site';
    botClient.user.setPresence({
      status: 'online',
      activities: [{
        name: `${currentTrack.animeTitle} — Ep ${currentTrack.episodeNum}`,
        type: ActivityType.Streaming,
        url: `${miyoUrl}/anime/${encodeURIComponent(currentTrack.animeId)}`,
        details: `Episode ${currentTrack.episodeNum} • ${(currentTrack.subdub || 'sub').toUpperCase()}`,
        state: 'on MIYO Stream',
      }],
    });
  } else {
    // Count total active streams across all guilds
    let activeStreams = 0;
    for (const [, g] of guilds) {
      if (g.current) activeStreams++;
    }

    if (activeStreams > 0) {
      // Other guilds are still streaming — show generic status
      botClient.user.setPresence({
        status: 'online',
        activities: [{
          name: `anime in ${activeStreams} server${activeStreams > 1 ? 's' : ''}`,
          type: ActivityType.Streaming,
          url: process.env.MIYO_URL || 'https://miyo-stream.cyber-winner.site',
        }],
      });
    } else {
      // Idle
      botClient.user.setPresence({
        status: 'online',
        activities: [{
          name: 'anime | /play',
          type: ActivityType.Listening,
        }],
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ── /watch — Launch MIYO Activity inside Discord ──
// ═══════════════════════════════════════════════════════════════════════

async function handleWatch(interaction, g) {
  const animeName = interaction.options.getString('anime');

  // Check user is in a voice channel
  const member = interaction.member;
  const voiceChannel = member?.voice?.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: '❌ You need to be in a voice channel to launch an Activity!', ephemeral: true });
  }

  await interaction.deferReply();

  try {
    // Create an Activity invite for this voice channel
    const invite = await voiceChannel.createInvite({
      maxAge: 3600,
      maxUses: 0,
      targetType: 2, // Embedded Application
      targetApplication: APPLICATION_ID,
    });

    const embed = new EmbedBuilder()
      .setColor(0xFF6B9D)
      .setTitle('🎬 MIYO Watch Party')
      .setDescription([
        'Launch the MIYO player inside Discord!',
        '',
        'Everyone in the voice channel can watch anime together.',
        animeName ? `\n🔍 Search for: **${animeName}**` : '',
      ].join('\n'))
      .setFooter({ text: 'Click the button below to join the Activity' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🚀 Launch MIYO in Discord')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/invite/${invite.code}`),
      new ButtonBuilder()
        .setLabel('Open in Browser')
        .setStyle(ButtonStyle.Link)
        .setURL(process.env.MIYO_URL || 'https://miyo-stream.cyber-winner.site')
        .setEmoji('🌐'),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (err) {
    console.error('[MIYO-BOT] Activity launch error:', err);

    // Fallback: if Activity invites aren't supported, send a direct link
    const embed = new EmbedBuilder()
      .setColor(0xFF6B9D)
      .setTitle('🎬 Watch on MIYO')
      .setDescription([
        'Open MIYO to watch anime together!',
        '',
        '> **Tip:** To enable the embedded player inside Discord,',
        '> set up Activities in the [Developer Portal](https://discord.com/developers/applications).',
      ].join('\n'))
      .setFooter({ text: 'MIYO Stream' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Watch on MIYO')
        .setStyle(ButtonStyle.Link)
        .setURL(process.env.MIYO_URL || 'https://miyo-stream.cyber-winner.site')
        .setEmoji('🎬'),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}

export { providers, getGuild };
