import fs from 'fs';
import path from 'path';
import { Telegraf } from 'telegraf';

const BOT_NAME = '𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓';
const OWNER_1_NAME = '𝐊𝐀𝐘𝐃𝐎 𝐃𝐄𝐕 𓃶';
const OWNER_1_CONTACT = '50935975863';
const OWNER_2_NAME = '𝐒𝐇𝐀𝐊𝐀 𝐃𝐄𝐕 𓃶';
const OWNER_2_CONTACT = '50940131864';
const OWNER_NAME = '𝐊𝐀𝐘𝐃𝐎 𝐃𝐄𝐕 𓃶 & 𝐒𝐇𝐀𝐊𝐀 𝐃𝐄𝐕 𓃶';
const OWNER_CONTACT = '+509 3597 5863 / +509 4013 1864';

const NEW_OFFICIAL_PHOTO_PATH = path.join(process.cwd(), 'src', 'assets', 'images', 'kaydo_law_bot_official_1790678745856.jpg');
const OFFICIAL_PHOTO_PATH = path.join(process.cwd(), 'public', 'menu_image.jpg');
const FALLBACK_PHOTO_PATH = path.join(process.cwd(), 'menu_image.jpg');

function getPhotoSource(): string | { source: Buffer } {
  try {
    if (fs.existsSync(NEW_OFFICIAL_PHOTO_PATH)) {
      return NEW_OFFICIAL_PHOTO_PATH;
    }
    if (fs.existsSync(OFFICIAL_PHOTO_PATH)) {
      return OFFICIAL_PHOTO_PATH;
    }
    if (fs.existsSync(FALLBACK_PHOTO_PATH)) {
      return FALLBACK_PHOTO_PATH;
    }
  } catch (e) {
    console.warn('[TELEGRAM] Error reading photo path:', e);
  }
  return OFFICIAL_PHOTO_PATH;
}

export function initTelegramBot(): Telegraf | null {
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;

  if (!token || token.trim() === '' || token === 'YOUR_TELEGRAM_BOT_TOKEN') {
    console.log('[TELEGRAM BOT] ℹ️ Aucun TELEGRAM_BOT_TOKEN configuré dans l\'environnement. Le bot Telegram reste en attente (standby) sans bloquer le serveur.');
    return null;
  }

  try {
    const bot = new Telegraf(token.trim());

    // Helper to send reply with the official Kaydo Bot photo
    const replyWithOfficialPhoto = async (ctx: any, caption: string, shouldReact: boolean = true) => {
      try {
        if (shouldReact && typeof ctx.react === 'function') {
          await ctx.react('🥷').catch(() => {});
        }
      } catch (e) {}

      const photoObj = getPhotoSource();
      if (!photoObj) {
        await ctx.reply(caption.replace(/<[^>]*>?/gm, '')).catch(() => {});
        return;
      }

      try {
        await ctx.replyWithPhoto(photoObj, {
          caption,
          parse_mode: 'HTML',
        });
      } catch (err) {
        console.warn('[TELEGRAM] Erreur envoi photo HTML, tentative sans HTML:', err);
        try {
          const plainCaption = caption.replace(/<[^>]*>?/gm, '');
          await ctx.replyWithPhoto(photoObj, {
            caption: plainCaption,
          });
        } catch (err2) {
          console.error('[TELEGRAM] Échec final envoi photo Telegram:', err2);
          await ctx.reply(caption.replace(/<[^>]*>?/gm, '')).catch(() => {});
        }
      }
    };

    // /start command
    bot.command('start', async (ctx) => {
      const caption = `╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✦┋. <b>ʙᴏᴛ ɴᴀᴍᴇ:</b> ${BOT_NAME}
┋✦┋. <b>ᴄᴏᴍᴍᴀɴᴅs:</b> 295+
┋✦┋. <b>ᴏᴡɴᴇʀ:</b> ${OWNER_NAME}
┋✦┋. <b>ᴘʟᴀᴛғᴏʀᴍ:</b> ᴛᴇʟᴇɢʀᴀᴍ & ᴡʜᴀᴛsᴀᴘᴘ
┋✦┋. <b>ᴍᴏᴅᴇ:</b> ᴘᴜʙʟɪᴄ 🟢
┋✦┋. <b>ᴜᴘᴛɪᴍᴇ:</b> 24/7 ᴄʟᴏᴜᴅ ᴅᴀᴇᴍᴏɴ
┇✦╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖
⚡ Bienvenue sur <b>${BOT_NAME}</b> !
Tapez /menu pour voir la liste des commandes.`;
      await replyWithOfficialPhoto(ctx, caption);
    });

    // /menu & /help
    bot.command(['menu', 'help', 'allcmd'], async (ctx) => {
      const caption = `╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✦┋. <b>ʙᴏᴛ ɴᴀᴍᴇ:</b> ${BOT_NAME}
┋✦┋. <b>ᴏᴡɴᴇʀ:</b> ${OWNER_NAME}
┋✦┋. <b>ᴘʟᴀᴛғᴏʀᴍ:</b> ᴛᴇʟᴇɢʀᴀᴍ
┋✦┋. <b>ᴍᴏᴅᴇ:</b> ᴘᴜʙʟɪᴄ 🟢
┋✦┋. <b>sᴛᴀᴛᴜs:</b> ᴏᴘᴇ́ʀᴀᴛɪᴏɴɴᴇʟ 24/7
┇✦╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖

╭─❖━━━ ɢʀᴏᴜᴘ ━━━❖
┇✦┋. /kickall
┇✦┋. /purge
┇✦┋. /left
┇✦┋. /add
┇✦┋. /kick
┇✦┋. /promote
┇✦┋. /demote
┇✦┋. /mute
┇✦┋. /unmute
┇✦┋. /tagall
┇✦┋. /hidetag
┇✦┋. /warn
┇✦┋. /resetwarn
┇✦┋. /delete
┇✦┋. /clean
┇✦┋. /welcome
┇✦┋. /goodbye
┇✦┋. /grouplink
┇✦┋. /groupinfo
┇✦┋. /groupstats
┇✦┋. /antilink
┇✦┋. /antitag
┇✦┋. /antigroupmention
┇✦┋. /antisticker
┇✦┋. /antimessage
╰━━━━━━━━━━━━━━━━━❖

╭─❖━━━ ᴀᴜᴛᴏᴍᴀᴛɪᴏɴ ━━━❖
┇✦┋. /autolikestatus
┇✦┋. /autostatus
┇✦┋. /autoviewstatus
┇✦┋. /autosavestatus
┇✦┋. /autotyping
┇✦┋. /autorecording
┇✦┋. /autosticker
┇✦┋. /online
┇✦┋. /offline
┇✦┋. /vv
┇✦┋. /vv2
┇✦┋. /gstatus
┇✦┋. /pair
╰━━━━━━━━━━━━━━━━━❖

╭─❖━━━ ᴍᴀɪɴ ━━━❖
┇✦┋. /ping
┇✦┋. /uptime
┇✦┋. /runtime
┇✦┋. /menu
┇✦┋. /owner
┇✦┋. /alive
┇✦┋. /list
┇✦┋. /getpp
┇✦┋. /qr
┇✦┋. /simage
┇✦┋. /sticker
┇✦┋. /take
╰━━━━━━━━━━━━━━━━━❖

╭─❖━━━ ᴍᴇᴅɪᴀ ━━━❖
┇✦┋. /dl <url>
┇✦┋. /song <titre>
┇✦┋. /ytvideo <titre>
┇✦┋. /tiktok <url>
┇✦┋. /shorts <url>
┇✦┋. /instagram <url>
┇✦┋. /facebook <url>
┇✦┋. /twitter <url>
┇✦┋. /pinterest <url>
┇✦┋. /snapchat <url>
┇✦┋. /threads <url>
┇✦┋. /reddit <url>
┇✦┋. /twitch <url>
┇✦┋. /soundcloud <url>
┇✦┋. /spotify <url>
┇✦┋. /linkedin <url>
┇✦┋. /vimeo <url>
┇✦┋. /dailymotion <url>
┇✦┋. /tumblr <url>
┇✦┋. /likee <url>
┇✦┋. /kwai <url>
┇✦┋. /capcut <url>
┇✦┋. /telegram <url>
┇✦┋. /direct <url>
┇✦┋. /lyrics
╰━━━━━━━━━━━━━━━━━❖

╭─❖━━━ ғᴜɴ & ᴀɴɪᴍᴇ ━━━❖
┇✦┋. /joke
┇✦┋. /meme
┇✦┋. /memesearch
┇✦┋. /truth
┇✦┋. /dare
┇✦┋. /flirt
┇✦┋. /compliment
┇✦┋. /insult
┇✦┋. /bomb
┇✦┋. /ship
┇✦┋. /tictactoe
┇✦┋. /gayrate
┇✦┋. /pies
┇✦┋. /waifu
┇✦┋. /neko
┇✦┋. /random
┇✦┋. /konachan
╰━━━━━━━━━━━━━━━━━❖

®2026 © MADE IN BY 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓`;
      await replyWithOfficialPhoto(ctx, caption);
    });

    // /ping
    bot.command('ping', async (ctx) => {
      const caption = `╭─❖━━━ ${BOT_NAME} ━━━❖
┇✦╭───────────────
┋✦┋. ⚡ <b>ᴘᴏɴɢ !</b> 0.001s
┋✦┋. 🟢 <b>sᴛᴀᴛᴜᴛ :</b> ᴇɴ ʟɪɢɴᴇ 24/7
┋✦┋. 👑 <b>ᴏᴡɴᴇʀ :</b> ${OWNER_NAME}
┇✦╰───────────────⊷
╰━━━━━━━━━━━━━━━━━❖`;
      await replyWithOfficialPhoto(ctx, caption);
    });

    // /alive
    bot.command('alive', async (ctx) => {
      const uptimeSec = Math.floor(process.uptime());
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;
      const caption = `╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✦┋. <b>ʙᴏᴛ ɴᴀᴍᴇ:</b> ${BOT_NAME}
┋✦┋. <b>ᴜᴘᴛɪᴍᴇ:</b> ${hours}h ${minutes}m ${seconds}s
┋✦┋. <b>ᴏᴡɴᴇʀ:</b> ${OWNER_NAME}
┋✦┋. <b>sᴛᴀᴛᴜᴛ:</b> 24/7 ᴀᴄᴛɪғ & ᴄᴏɴɴᴇᴄᴛᴇ́ ⚡
┇✦╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖`;
      await replyWithOfficialPhoto(ctx, caption);
    });

    // /owner1
    bot.command(['owner1', 'creator1', 'dev1'], async (ctx) => {
      const caption = `╭─❖━━━ 👑 𝐎𝐖𝐍𝐄𝐑 1 ━━━❖
┇✦╭───────────────
┋✦┋. 👑 <b>ᴏᴡɴᴇʀ 1 :</b> ${OWNER_1_NAME}
┋✦┋. 📞 <b>ɴᴜᴍᴇ́ʀᴏ :</b> ${OWNER_1_CONTACT}
┋✦┋. 💬 <b>ᴡʜᴀᴛsᴀᴘᴘ :</b> https://wa.me/50935975863
┋✦┋. ⚡ <b>sᴛᴀᴛᴜᴛ :</b> ᴅᴇ́ᴠᴇʟᴏᴘᴘᴇᴜʀ ᴘʀɪɴᴄɪᴘᴀʟ & ғᴏɴᴅᴀᴛᴇᴜʀ
┇✦╰───────────────⊷
╰━━━━━━━━━━━━━━━━━❖
> *© 𝐌𝐀𝐃𝐄 𝐈𝐍 𝐁𝐘 ${BOT_NAME}*`;
      await replyWithOfficialPhoto(ctx, caption);
    });

    // /owner2
    bot.command(['owner2', 'creator2', 'dev2'], async (ctx) => {
      const caption = `╭─❖━━━ 👑 𝐎𝐖𝐍𝐄𝐑 2 ━━━❖
┇✦╭───────────────
┋✦┋. 👑 <b>ᴏᴡɴᴇʀ 2 :</b> ${OWNER_2_NAME}
┋✦┋. 📞 <b>ɴᴜᴍᴇ́ʀᴏ :</b> ${OWNER_2_CONTACT}
┋✦┋. 💬 <b>ᴡʜᴀᴛsᴀᴘᴘ :</b> https://wa.me/50940131864
┋✦┋. ⚡ <b>sᴛᴀᴛᴜᴛ :</b> ᴄᴏ-ᴅᴇ́ᴠᴇʟᴏᴘᴘᴇᴜʀ & ғᴏɴᴅᴀᴛᴇᴜʀ
┇✦╰───────────────⊷
╰━━━━━━━━━━━━━━━━━❖
> *© 𝐌𝐀𝐃𝐄 𝐈𝐍 𝐁𝐘 ${BOT_NAME}*`;
      await replyWithOfficialPhoto(ctx, caption);
    });

    // /owner
    bot.command(['owner', 'creator', 'dev'], async (ctx) => {
      const caption = `╭─❖━━━ ${BOT_NAME} ━━━❖
┇✦╭───────────────
┋✦┋. 👑 <b>ᴏᴡɴᴇʀ 1 :</b> ${OWNER_1_NAME} (+509 3597 5863)
┋✦┋. 💬 <b>wa.me :</b> https://wa.me/50935975863
┋✦┋
┋✦┋. 👑 <b>ᴏᴡɴᴇʀ 2 :</b> ${OWNER_2_NAME} (+509 4013 1864)
┋✦┋. 💬 <b>wa.me :</b> https://wa.me/50940131864
┋✦┋
┋✦┋. 🌐 <b>ᴘᴏʀᴛᴀɪʟ :</b> ᴋᴀʏᴅᴏ ʙᴏᴛ ᴘᴏʀᴛᴀʟ
┇✦╰───────────────⊷
╰━━━━━━━━━━━━━━━━━❖
> *© 𝐌𝐀𝐃𝐄 𝐈𝐍 𝐁𝐘 ${BOT_NAME}*`;
      await replyWithOfficialPhoto(ctx, caption);
    });

    // /status
    bot.command('status', async (ctx) => {
      const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
      const caption = `╭─❖━━━ ${BOT_NAME} ━━━❖
┇✦╭───────────────
┋✦┋. 🤖 <b>ʙᴏᴛ:</b> ${BOT_NAME}
┋✦┋. 🧠 <b>ʀᴀᴍ:</b> ${mem} MB
┋✦┋. ⚡ <b>ᴍᴏᴅᴇ:</b> 24/7 ᴄʟᴏᴜᴅ ᴅᴀᴇᴍᴏɴ
┋✦┋. 👑 <b>ᴏᴡɴᴇʀ:</b> ${OWNER_NAME}
┇✦╰───────────────⊷
╰━━━━━━━━━━━━━━━━━❖`;
      await replyWithOfficialPhoto(ctx, caption);
    });

    // /tgs
    bot.command(['tgs', 'stickers'], async (ctx) => {
      const url = ctx.message.text.replace(/^\/(tgs|stickers)\s*/i, '').trim();
      if (!url) {
        return await ctx.reply(`📦 Usage : /tgs <lien ou nom du pack Telegram>\nExemple : /tgs https://t.me/addstickers/AnimPack`);
      }
      try {
        const { processTgsRequest } = await import('./src/services/tgs/tgsProcessor');
        const statusCallback = async (text: string) => {
          await ctx.reply(text).catch(() => {});
        };
        await processTgsRequest(url, ctx, '', null, statusCallback);
      } catch (e: any) {
        await ctx.reply(`❌ Erreur TGS : ${e?.message || 'Erreur'}`);
      }
    });

    // /sticker & /s
    bot.command(['sticker', 's'], async (ctx) => {
      const text = ctx.message.text.replace(/^\/(sticker|s)\s*/i, '').trim();
      try {
        const { createTextSticker } = await import('./src/server/mediaConverter');
        const stickerBuf = await createTextSticker(text || 'KAYDO BOT V1');
        await ctx.replyWithSticker({ source: stickerBuf });
      } catch (err: any) {
        await ctx.reply(`🎨 Envoyez une photo avec la légende /sticker ou tapez /sticker Votre Texte.`);
      }
    });

    // /song & /play
    bot.command(['song', 'play', 'audio', 'mp3'], async (ctx) => {
      const query = ctx.message.text.replace(/^\/(song|play|audio|mp3)\s*/i, '').trim() || 'Hit Song';
      try {
        await ctx.reply(`🎵 Recherche et téléchargement de "${query}" en cours...`);
        const { downloadMusicAudio } = await import('./src/server/mediaDownloader');
        const res = await downloadMusicAudio(query);
        if (res.success && res.buffer) {
          await ctx.replyWithAudio({ source: res.buffer, filename: `${query}.mp3` }, { caption: res.title });
        } else {
          await ctx.reply(res.error || `❌ Impossible de trouver l'audio pour "${query}".`);
        }
      } catch (e: any) {
        await ctx.reply(`❌ Erreur téléchargement audio : ${e?.message || 'Erreur'}`);
      }
    });

    // /video & /ytmp4
    bot.command(['video', 'ytvideo', 'ytmp4', 'mp4'], async (ctx) => {
      const query = ctx.message.text.replace(/^\/(video|ytvideo|ytmp4|mp4)\s*/i, '').trim() || 'Trending';
      try {
        await ctx.reply(`🎬 Téléchargement de la vidéo pour "${query}"...`);
        const { downloadVideoMedia } = await import('./src/server/mediaDownloader');
        const res = await downloadVideoMedia(query);
        if (res.success && res.buffer) {
          await ctx.replyWithVideo({ source: res.buffer }, { caption: res.title });
        } else {
          await ctx.reply(res.error || `❌ Impossible de télécharger la vidéo.`);
        }
      } catch (e: any) {
        await ctx.reply(`❌ Erreur téléchargement vidéo : ${e?.message || 'Erreur'}`);
      }
    });

    // /tiktok
    bot.command(['tiktok', 'tt'], async (ctx) => {
      const url = ctx.message.text.replace(/^\/(tiktok|tt)\s*/i, '').trim();
      if (!url) {
        return await ctx.reply(`🎬 Usage : /tiktok <lien TikTok>`);
      }
      try {
        await ctx.reply('🎬 Téléchargement TikTok (sans filigrane)...');
        const { downloadTikTokVideo } = await import('./src/server/mediaDownloader');
        const res = await downloadTikTokVideo(url);
        if (res.success && res.buffer) {
          await ctx.replyWithVideo({ source: res.buffer }, { caption: res.title });
        } else {
          await ctx.reply(res.error || `❌ Échec du téléchargement TikTok.`);
        }
      } catch (e: any) {
        await ctx.reply(`❌ Erreur : ${e?.message || 'Erreur'}`);
      }
    });

    // /instagram
    bot.command(['instagram', 'ig', 'igs'], async (ctx) => {
      const url = ctx.message.text.replace(/^\/(instagram|ig|igs)\s*/i, '').trim();
      if (!url) {
        return await ctx.reply(`📸 Usage : /instagram <lien Instagram Reel/Post>`);
      }
      try {
        await ctx.reply('📸 Téléchargement Instagram en cours...');
        const { downloadInstagramMedia } = await import('./src/server/mediaDownloader');
        const res = await downloadInstagramMedia(url);
        if (res.success && res.buffer) {
          if (res.type === 'video' || res.mimeType?.includes('video')) {
            await ctx.replyWithVideo({ source: res.buffer }, { caption: res.title });
          } else {
            await ctx.replyWithPhoto({ source: res.buffer }, { caption: res.title });
          }
        } else {
          await ctx.reply(res.error || `❌ Échec du téléchargement Instagram.`);
        }
      } catch (e: any) {
        await ctx.reply(`❌ Erreur : ${e?.message || 'Erreur'}`);
      }
    });

    // /pinterest
    bot.command('pinterest', async (ctx) => {
      const query = ctx.message.text.replace(/^\/pinterest\s*/i, '').trim() || 'anime wallpaper 4k';
      try {
        const { downloadPinterestImage } = await import('./src/server/mediaDownloader');
        const res = await downloadPinterestImage(query);
        if (res.success && res.buffer) {
          await ctx.replyWithPhoto({ source: res.buffer }, { caption: res.title });
        } else {
          await ctx.reply(res.error || `❌ Aucune image trouvée.`);
        }
      } catch (e: any) {
        await ctx.reply(`❌ Erreur Pinterest : ${e?.message || 'Erreur'}`);
      }
    });

    // Handle all other messages or text on Telegram with the official photo
    bot.on('message', async (ctx, next) => {
      const text = (ctx.message as any)?.text || '';
      if (text.startsWith('/')) {
        const cmd = text.split(' ')[0].toLowerCase();
        if (!['/start', '/menu', '/help', '/ping', '/alive', '/owner', '/owner1', '/owner2', '/creator', '/creator1', '/creator2', '/dev', '/dev1', '/dev2', '/status', '/sticker', '/s', '/song', '/play', '/audio', '/mp3', '/video', '/ytvideo', '/ytmp4', '/tiktok', '/tt', '/instagram', '/ig', '/igs', '/pinterest'].includes(cmd)) {
          const caption = `╭─❖━━━ ${BOT_NAME} ━━━❖
┇✦╭───────────────
┋✦┋. ⚡ <b>ᴄᴏᴍᴍᴀɴᴅᴇ :</b> ${cmd}
┋✦┋. 🤖 <b>ʙᴏᴛ :</b> ${BOT_NAME}
┋✦┋. 👑 <b>ᴏᴡɴᴇʀ :</b> ${OWNER_NAME}
┋✦┋. 💡 Tapez /menu pour la liste complète.
┇✦╰───────────────⊷
╰━━━━━━━━━━━━━━━━━❖`;
          await replyWithOfficialPhoto(ctx, caption);
          return;
        }
      } else if (text) {
        // Any regular text on Telegram also sends the official photo
        const caption = `╭─❖━━━ ${BOT_NAME} ━━━❖
┇✦╭───────────────
┋✦┋. 🤖 <b>ʙᴏᴛ :</b> ${BOT_NAME}
┋✦┋. 👑 <b>ᴏᴡɴᴇʀ :</b> ${OWNER_NAME}
┋✦┋. 💬 <b>ᴍᴇssᴀɢᴇ :</b> ${text.substring(0, 60)}
┋✦┋. 💡 Tapez /menu pour afficher les commandes.
┇✦╰───────────────⊷
╰━━━━━━━━━━━━━━━━━❖`;
        await replyWithOfficialPhoto(ctx, caption, false);
        return;
      }
      return next();
    });

    bot.catch((err: any) => {
      console.warn('[TELEGRAM BOT] Erreur capturée:', err?.message || err);
    });

    // Launch without blocking node process
    bot.launch().then(() => {
      console.log(`[TELEGRAM BOT] 🚀 ${BOT_NAME} démarré avec succès sur Telegram !`);
    }).catch((err) => {
      console.warn('[TELEGRAM BOT] Avertissement au démarrage:', err?.message || err);
    });

    // Graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return bot;
  } catch (err: any) {
    console.warn('[TELEGRAM BOT] Impossible d\'initialiser le bot Telegram:', err?.message || err);
    return null;
  }
}
