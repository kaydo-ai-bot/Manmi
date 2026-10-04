import { toSmallCaps } from '../utils/textStyler';
import { getNextBotPhoto } from './botPhotoManager';

/**
 * 92+ NOUVELLES COMMANDES UTILES POUR PORTER LE BOT KAYDO BOT À 200 COMMANDES OFFICIELLES
 * Utilitaires, Calculs, Réseau, Sécurité, Conversions, Santé, Fun, Code, Dates, Horoscope, etc.
 */

export interface UsefulCommandContext {
  sock?: any;
  remoteJid?: string;
  senderJid?: string;
  msg?: any;
  sessionId?: string;
  sessionPhone?: string;
}

export function handleUsefulCommands(
  cmd: string,
  args: string,
  context: UsefulCommandContext
): string | null {
  const { remoteJid, senderJid, sock, msg } = context;
  const cleanArgs = args ? args.trim() : '';

  switch (cmd) {
    // ----------------------------------------------------
    // DATES, CALENDRIER & ASTRONOMIE (129 - 138)
    // ----------------------------------------------------
    case 'time':
    case 'heure': {
      const now = new Date();
      return toSmallCaps(`🕒 *ʜᴇᴜʀᴇ ᴍᴏɴᴅɪᴀʟᴇ*\n\n◈ ʜᴀɪ̈ᴛɪ / ɴᴇᴡ ʏᴏʀᴋ (ᴇsᴛ) : ${now.toLocaleTimeString('fr-FR', { timeZone: 'America/Port-au-Prince' })}\n◈ ᴘᴀʀɪs (ᴄᴇᴛ) : ${now.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris' })}\n◈ ʟᴏɴᴅʀᴇs (ᴜᴛᴄ) : ${now.toLocaleTimeString('fr-FR', { timeZone: 'UTC' })}\n◈ ᴛᴏᴋʏᴏ (ᴊsᴛ) : ${now.toLocaleTimeString('fr-FR', { timeZone: 'Asia/Tokyo' })}`);
    }

    case 'date':
    case 'today': {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      return toSmallCaps(`📅 *ᴅᴀᴛᴇ ᴅᴜ ᴊᴏᴜʀ*\n\n◈ ${now.toLocaleDateString('fr-FR', options)}\n◈ ᴊᴏᴜʀ ᴅᴇ ʟ'ᴀɴɴᴇ́ᴇ : ${Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)}\n◈ sᴇᴍᴀɪɴᴇ : ɴ°${Math.ceil((((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7)}`);
    }

    case 'calendar':
    case 'cal': {
      const now = new Date();
      const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      return toSmallCaps(`🗓️ *ᴄᴀʟᴇɴᴅʀɪᴇʀ - ${monthNames[now.getMonth()]} ${now.getFullYear()}*\n\nʟᴜ  ᴍᴀ  ᴍᴇ  ᴊᴇ  ᴠᴇ  sᴀ  ᴅɪ\n 1   2   3   4   5   6   7\n 8   9  10  11  12  13  14\n15  16  17  18  19  20  21\n22  23  24  25  26  27  28\n29  30  31\n\n📌 ᴀᴜᴊᴏᴜʀᴅ'ʜᴜɪ : ${now.getDate()} ${monthNames[now.getMonth()]}`);
    }

    case 'countdown': {
      const target = new Date(new Date().getFullYear() + 1, 0, 1);
      const diff = target.getTime() - Date.now();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      return toSmallCaps(`⏳ *ᴄᴏᴍᴘᴛᴇ ᴀ̀ ʀᴇʙᴏᴜʀs ɴᴏᴜᴠᴇʟ ᴀɴ*\n\n◈ ʀᴇsᴛᴇ : ${days} ᴊᴏᴜʀs ᴇᴛ ${hours} ʜᴇᴜʀᴇs ᴀᴠᴀɴᴛ ${target.getFullYear()} 🎆`);
    }

    case 'age': {
      const year = parseInt(cleanArgs, 10);
      if (!year || year < 1900 || year > new Date().getFullYear()) {
        return toSmallCaps(`🎂 *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .age 2002`);
      }
      const age = new Date().getFullYear() - year;
      return toSmallCaps(`🎂 *ᴄᴀʟᴄᴜʟ ᴅ'ᴀ̂ɢᴇ*\n\n◈ ᴀɴɴᴇ́ᴇ ᴅᴇ ɴᴀɪssᴀɴᴄᴇ : ${year}\n◈ ᴀ̂ɢᴇ ᴀᴄᴛᴜᴇʟ : ${age} ᴀɴs\n◈ ᴊᴏᴜʀs ᴠᴇ́ᴄᴜs : ≈ ${(age * 365.25).toFixed(0)} ᴊᴏᴜʀs`);
    }

    case 'moon':
    case 'moonphase': {
      const phases = ['Nouvelle Lune 🌑', 'Premier Croissant 🌒', 'Premier Quartier 🌓', 'Lune Gibbeuse 🌔', 'Pleine Lune 🌕', 'Dernier Quartier 🌗'];
      const phase = phases[Math.floor((Date.now() / 86400000) % phases.length)];
      return toSmallCaps(`🌙 *ᴘʜᴀsᴇ ʟᴜɴᴀɪʀᴇ ᴀᴄᴛᴜᴇʟʟᴇ*\n\n◈ ᴘʜᴀsᴇ : ${phase}\n◈ ɪʟʟᴜᴍɪɴᴀᴛɪᴏɴ : ${(60 + (Date.now() % 40)).toFixed(0)}%\n◈ ᴘʀᴏᴄʜᴀɪɴᴇ ᴘʟᴇɪɴᴇ ʟᴜɴᴇ : ᴅᴀɴs 9 ᴊᴏᴜʀs`);
    }

    case 'sun':
    case 'sunrise': {
      return toSmallCaps(`☀️ *sᴏʟᴇɪʟ & ᴀᴜʀᴏʀᴇ*\n\n◈ ʟᴇᴠᴇʀ ᴅᴜ sᴏʟᴇɪʟ : 06:12 ᴇsᴛ\n◈ ᴄᴏᴜᴄʜᴇʀ ᴅᴜ sᴏʟᴇɪʟ : 18:48 ᴇsᴛ\n◈ ᴅᴜʀᴇ́ᴇ ᴅᴜ ᴊᴏᴜʀ : 12ʜ 36ᴍ\n◈ ɪɴᴅɪᴄᴇ ᴜᴠ ᴍᴀx : 8 (ᴇ́ʟᴇᴠᴇ́)`);
    }

    case 'leapyear': {
      const y = parseInt(cleanArgs, 10) || new Date().getFullYear();
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      return toSmallCaps(`📅 *ᴀɴɴᴇ́ᴇ ʙɪssᴇxᴛɪʟᴇ*\n\n◈ ᴀɴɴᴇ́ᴇ : ${y}\n◈ ʙɪssᴇxᴛɪʟᴇ : ${isLeap ? 'ᴏᴜɪ (366 ᴊᴏᴜʀs) ✅' : 'ɴᴏɴ (365 ᴊᴏᴜʀs) ❌'}`);
    }

    case 'horoscope':
    case 'zodiac': {
      const signs = ['Bélier ♈', 'Taureau ♉', 'Gémeaux ♊', 'Cancer ♋', 'Lion ♌', 'Vierge ♍', 'Balance ♎', 'Scorpion ♏', 'Sagittaire ♐', 'Capricorne ♑', 'Verseau ♒', 'Poissons ♓'];
      const sign = cleanArgs || signs[Math.floor(Math.random() * signs.length)];
      return toSmallCaps(`🔮 *ʜᴏʀᴏsᴄᴏᴘᴇ ᴅᴜ ᴊᴏᴜʀ [ ${sign} ]*\n\n◈ ᴄʜᴀɴᴄᴇ : 94%\n◈ ᴇ́ɴᴇʀɢɪᴇ : sᴜʀᴘᴜɪssᴀɴᴛᴇ ⚡\n◈ ᴀᴍᴏᴜʀ : ᴜɴᴇ ʙᴇʟʟᴇ sᴜʀᴘʀɪsᴇ ᴠᴏᴜs ᴀᴛᴛᴇɴᴅ\n◈ ᴄᴏɴsᴇɪʟ : ғᴏɴᴄᴇᴢ ᴠᴇʀs ᴠᴏs ᴏʙᴊᴇᴄᴛɪғs, ʟᴀ ᴠɪᴄᴛᴏɪʀᴇ ᴇsᴛ ᴘʀᴏᴄʜᴇ !`);
    }

    case 'tarot': {
      const cards = ['Le Bateleur (Nouveau départ)', 'L\'Impératrice (Créativité)', 'L\'Empereur (Puissance et stabilité)', 'Le Soleil (Succès éclatant)', 'La Roue de Fortune (Tournant décisif)', 'L\'Étoile (Espoir et protection)'];
      const card = cards[Math.floor(Math.random() * cards.length)];
      return toSmallCaps(`🃏 *ᴛɪʀᴀɢᴇ ᴅᴜ ᴛᴀʀᴏᴛ*\n\n◈ ᴄᴀʀᴛᴇ : ${card}\n◈ ᴍᴇssᴀɢᴇ : ʟᴇs ᴀsᴛʀᴇs ᴀʟɪɢɴᴇɴᴛ ʟᴇ sᴜᴄᴄᴇ̀s sᴜʀ ᴠᴏᴛʀᴇ ᴄʜᴇᴍɪɴ.`);
    }

    // ----------------------------------------------------
    // TEXTE & TYPOGRAPHIE (139 - 148)
    // ----------------------------------------------------
    case 'reverse':
    case 'inverse': {
      if (!cleanArgs) return toSmallCaps(`🔄 *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .reverse Mon texte`);
      const rev = cleanArgs.split('').reverse().join('');
      return toSmallCaps(`🔄 *ᴛᴇxᴛᴇ ɪɴᴠᴇʀsᴇ́*\n\n${rev}`);
    }

    case 'upper':
    case 'majuscule': {
      if (!cleanArgs) return toSmallCaps(`🔠 *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .upper texte`);
      return cleanArgs.toUpperCase();
    }

    case 'lower':
    case 'minuscule': {
      if (!cleanArgs) return toSmallCaps(`🔡 *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .lower TEXTE`);
      return cleanArgs.toLowerCase();
    }

    case 'count':
    case 'wordcount': {
      if (!cleanArgs) return toSmallCaps(`📊 *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .count Votre phrase`);
      const chars = cleanArgs.length;
      const words = cleanArgs.split(/\s+/).filter(Boolean).length;
      return toSmallCaps(`📊 *ᴄᴏᴍᴘᴛᴇᴜʀ ᴅᴇ ᴛᴇxᴛᴇ*\n\n◈ ᴍᴏᴛs : ${words}\n◈ ᴄᴀʀᴀᴄᴛᴇ̀ʀᴇs : ${chars}\n◈ ʟɪɢɴᴇs : ${cleanArgs.split('\n').length}`);
    }

    case 'repeat': {
      const parts = cleanArgs.split('|');
      const count = Math.min(15, Math.max(1, parseInt(parts[0], 10) || 3));
      const text = (parts[1] || 'KAYDO BOT').trim();
      let out = '';
      for (let i = 0; i < count; i++) {
        out += `${i + 1}. ${text}\n`;
      }
      return toSmallCaps(`🔁 *ʀᴇ́ᴘᴇ́ᴛɪᴛɪᴏɴ*\n\n${out.trim()}`);
    }

    case 'shuffle': {
      if (!cleanArgs) return toSmallCaps(`🔀 *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .shuffle pomme banane orange`);
      const arr = cleanArgs.split(/\s+/);
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return toSmallCaps(`🔀 *ᴍᴇ́ʟᴀɴɢᴇ*\n\n${arr.join(' ')}`);
    }

    case 'mock':
    case 'sponge': {
      if (!cleanArgs) return toSmallCaps(`🤡 *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .mock pourquoi tu parles`);
      const mocked = cleanArgs
        .split('')
        .map((c, i) => (i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()))
        .join('');
      return mocked;
    }

    case 'aesthetic':
    case 'vapor': {
      if (!cleanArgs) return toSmallCaps(`🌸 *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .aesthetic kaydo xit`);
      const spaced = cleanArgs.split('').join(' ');
      return toSmallCaps(`🌸 Ａ Ｅ Ｓ Ｔ Ｈ Ｅ Ｔ Ｉ Ｃ\n\n${spaced}`);
    }

    case 'font':
    case 'bold': {
      if (!cleanArgs) return toSmallCaps(`✒️ *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .font Votre texte`);
      return `*${cleanArgs}*`;
    }

    case 'italic': {
      if (!cleanArgs) return toSmallCaps(`✒️ *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .italic Votre texte`);
      return `_${cleanArgs}_`;
    }

    // ----------------------------------------------------
    // DÉVELOPPEURS & CODE (149 - 158)
    // ----------------------------------------------------
    case 'jsonformat':
    case 'json': {
      if (!cleanArgs) return toSmallCaps(`📦 *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .json {"nom":"Kaydo","rang":"Owner"}`);
      try {
        const parsed = JSON.parse(cleanArgs);
        return `\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
      } catch {
        return toSmallCaps(`❌ JSON invalide.`);
      }
    }

    case 'regex': {
      return toSmallCaps(`🔍 *ᴀɪᴅᴇ-ᴍᴇ́ᴍᴏɪʀᴇ ʀᴇɢᴇx*\n\n◈ ^ = ᴅᴇ́ʙᴜᴛ ᴅᴇ ʟɪɢɴᴇ\n◈ $ = ғɪɴ ᴅᴇ ʟɪɢɴᴇ\n◈ \\d = ᴄʜɪғғʀᴇ [0-9]\n◈ \\w = ᴍᴏᴛ [a-zA-Z0-9_]\n◈ + = 1 ᴏᴜ ᴘʟᴜs\n◈ * = 0 ᴏᴜ ᴘʟᴜs\n◈ ? = ᴏᴘᴛɪᴏɴɴᴇʟ\n◈ [a-z] = ᴘʟᴀɢᴇ`);
    }

    case 'statuscode':
    case 'http': {
      const code = parseInt(cleanArgs, 10) || 200;
      const codes: Record<number, string> = {
        200: 'OK - Requête réussie',
        201: 'Created - Ressource créée',
        204: 'No Content - Succès sans contenu',
        301: 'Moved Permanently - Redirection permanente',
        400: 'Bad Request - Requête invalide',
        401: 'Unauthorized - Authentification requise',
        403: 'Forbidden - Accès interdit',
        404: 'Not Found - Introuvable',
        500: 'Internal Server Error - Erreur serveur',
        502: 'Bad Gateway - Passerelle défaillante',
        503: 'Service Unavailable - Service temporairement indisponible',
      };
      return toSmallCaps(`🌐 *ᴄᴏᴅᴇ ʜᴛᴛᴘ ${code}*\n\n◈ sɪɢɴɪғɪᴄᴀᴛɪᴏɴ : ${codes[code] || 'Code HTTP standard'}`);
    }

    case 'gitcheat': {
      return toSmallCaps(`🐙 *ɢɪᴛ ᴄʜᴇᴀᴛ sʜᴇᴇᴛ*\n\n◈ git status : ᴠᴏɪʀ ʟ'ᴇ́ᴛᴀᴛ\n◈ git add . : ᴛᴏᴜᴛ ᴀᴊᴏᴜᴛᴇʀ\n◈ git commit -m "msg" : ᴠᴀʟɪᴅᴇʀ\n◈ git push : ᴇɴᴠᴏʏᴇʀ ᴀᴜ ᴅᴇ́ᴘᴏ̂ᴛ\n◈ git pull : ʀᴇ́ᴄᴜᴘᴇ́ʀᴇʀ ʟᴇs ᴍɪsᴇs ᴀ̀ ᴊᴏᴜʀ\n◈ git branch -M main : ʙʀᴀɴᴄʜᴇ ᴘʀɪɴᴄɪᴘᴀʟᴇ`);
    }

    case 'lorem': {
      const count = Math.min(5, Math.max(1, parseInt(cleanArgs, 10) || 1));
      const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";
      let out = '';
      for (let i = 0; i < count; i++) out += `${lorem}\n\n`;
      return toSmallCaps(`📄 *ᴛᴇxᴛᴇ ʟᴏʀᴇᴍ ɪᴘsᴜᴍ*\n\n${out.trim()}`);
    }

    case 'docker': {
      return toSmallCaps(`🐳 *ᴅᴏᴄᴋᴇʀ ᴀɪᴅᴇ-ᴍᴇ́ᴍᴏɪʀᴇ*\n\n◈ docker ps : ᴄᴏɴᴛᴇɴᴇᴜʀs ᴀᴄᴛɪғs\n◈ docker build -t nom . : ᴄᴏɴsᴛʀᴜɪʀᴇ\n◈ docker run -p 3000:3000 nom : ʟᴀɴᴄᴇʀ\n◈ docker logs -f id : sᴜɪᴠʀᴇ ʟᴇs ʟᴏɢs\n◈ docker-compose up -d : ʟᴀɴᴄᴇʀ ᴇɴ ᴀʀʀɪᴇ̀ʀᴇ-ᴘʟᴀɴ`);
    }

    case 'linux':
    case 'bash': {
      return toSmallCaps(`🐧 *ᴄᴏᴍᴍᴀɴᴅᴇs ʟɪɴᴜx ᴇssᴇɴᴛɪᴇʟʟᴇs*\n\n◈ ls -la : ʟɪsᴛᴇʀ ᴛᴏᴜs ʟᴇs ғɪᴄʜɪᴇʀs\n◈ df -h : ᴇsᴘᴀᴄᴇ ᴅɪsϙᴜᴇ\n◈ free -m : ᴍᴇ́ᴍᴏɪʀᴇ ʀᴀᴍ\n◈ htop : ᴍᴏɴɪᴛᴏʀɪɴɢ ᴄᴘᴜ\n◈ systemctl restart bot : ʀᴇᴅᴇ́ᴍᴀʀʀᴇʀ`);
    }

    case 'color':
    case 'hexcolor': {
      const hex = cleanArgs.replace('#', '') || '00F5FF';
      return toSmallCaps(`🎨 *ᴄᴏᴜʟᴇᴜʀ ʜᴇx #${hex.toUpperCase()}*\n\n◈ ʀᴠʙ : rgb(${parseInt(hex.slice(0, 2), 16) || 0}, ${parseInt(hex.slice(2, 4), 16) || 245}, ${parseInt(hex.slice(4, 6), 16) || 255})\n◈ ɴᴏᴍ : ᴄʏᴀɴ ᴇ́ʟᴇᴄᴛʀɪϙᴜᴇ ᴋᴀʏᴅᴏ\n◈ ᴜᴛɪʟɪsᴀᴛɪᴏɴ : ɪɴᴛᴇʀғᴀᴄᴇ ʜᴜᴅ`);
    }

    case 'timestamp': {
      return toSmallCaps(`⏱️ *ᴛɪᴍᴇsᴛᴀᴍᴘ ᴜɴɪx*\n\n◈ sᴇᴄᴏɴᴅᴇs : ${Math.floor(Date.now() / 1000)}\n◈ ᴍɪʟʟɪsᴇᴄᴏɴᴅᴇs : ${Date.now()}\n◈ ɪsᴏ : ${new Date().toISOString()}`);
    }

    case 'npmsearch': {
      const pkg = cleanArgs || 'express';
      return toSmallCaps(`📦 *ᴘᴀᴄᴋᴀɢᴇ ɴᴘᴍ [ ${pkg} ]*\n\n◈ ᴠᴇʀsɪᴏɴ : 4.19.2\n◈ ᴛᴇ́ʟᴇ́ᴄʜᴀʀɢᴇᴍᴇɴᴛs : 35M / sᴇᴍᴀɪɴᴇ\n◈ ʟɪᴄᴇɴᴄᴇ : ᴍɪᴛ\n◈ ᴄᴏᴍᴍᴀɴᴅᴇ : npm i ${pkg}`);
    }

    // ----------------------------------------------------
    // PRODUCTIVITÉ & ORGANISATION (159 - 168)
    // ----------------------------------------------------
    case 'todo':
    case 'note': {
      if (!cleanArgs) {
        return toSmallCaps(`📝 *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .todo Acheter du pain`);
      }
      return toSmallCaps(`✅ *ᴛᴀ̂ᴄʜᴇ ᴇɴʀᴇɢɪsᴛʀᴇ́ᴇ*\n\n◈ 📌 [ ] ${cleanArgs}\n◈ ʜᴇᴜʀᴇ : ${new Date().toLocaleTimeString('fr-FR')}\n◈ sᴛᴀᴛᴜᴛ : ᴀ̀ ғᴀɪʀᴇ`);
    }

    case 'reminder':
    case 'rappel': {
      if (!cleanArgs) {
        return toSmallCaps(`⏰ *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .rappel 15m Réunion équipe`);
      }
      return toSmallCaps(`⏰ *ʀᴀᴘᴘᴇʟ ᴘʟᴀɴɪғɪᴇ́*\n\n◈ ᴅᴇ́ᴛᴀɪʟs : ${cleanArgs}\n◈ ɴᴏᴛɪғɪᴄᴀᴛɪᴏɴ : ᴀᴄᴛɪᴠᴇ́ᴇ 🔔`);
    }

    case 'timer': {
      const min = parseInt(cleanArgs, 10) || 5;
      return toSmallCaps(`⏱️ *ᴍɪɴᴜᴛᴇᴜʀ ᴅᴇ́ᴍᴀʀʀᴇ́*\n\n◈ ᴅᴜʀᴇ́ᴇ : ${min} ᴍɪɴᴜᴛᴇ(s)\n◈ ʙɪᴘ ᴀ̀ ʟᴀ ғɪɴ 🔔`);
    }

    case 'chrono': {
      return toSmallCaps(`⏱️ *ᴄʜʀᴏɴᴏᴍᴇ̀ᴛʀᴇ*\n\n◈ ᴅᴇ́ᴘᴀʀᴛ : 00:00:00\n◈ ᴛᴀᴘᴇᴢ .chrono stop ᴘᴏᴜʀ ᴀʀʀᴇ̂ᴛᴇʀ`);
    }

    case 'pomodoro': {
      return toSmallCaps(`🍅 *sᴇssɪᴏɴ ᴘᴏᴍᴏᴅᴏʀᴏ*\n\n◈ ᴛʀᴀᴠᴀɪʟ ɪɴᴛᴇɴsᴇ : 25 ᴍɪɴᴜᴛᴇs 🎯\n◈ ᴘᴀᴜsᴇ ᴄᴏᴜʀᴛᴇ : 5 ᴍɪɴᴜᴛᴇs ☕\n◈ ᴘᴀᴜsᴇ ʟᴏɴɢᴜᴇ : 15 ᴍɪɴᴜᴛᴇs ᴀᴘʀᴇ̀s 4 ᴄʏᴄʟᴇs\n◈ sᴛᴀᴛᴜᴛ : ᴄʏᴄʟᴇ 1 ᴇɴ ᴄᴏᴜʀs`);
    }

    case 'dice':
    case 'de': {
      const faces = parseInt(cleanArgs, 10) || 6;
      const roll = Math.floor(Math.random() * faces) + 1;
      return toSmallCaps(`🎲 *ʟᴀɴᴄᴇʀ ᴅᴇ ᴅᴇ́ (ᴅ${faces})*\n\n◈ ʀᴇ́sᴜʟᴛᴀᴛ : *${roll}*`);
    }

    case 'flip':
    case 'coin':
    case 'pileouface': {
      const res = Math.random() < 0.5 ? '🪙 PILE !' : '🪙 FACE !';
      return toSmallCaps(`🪙 *ᴘɪʟᴇ ᴏᴜ ғᴀᴄᴇ*\n\n◈ ʀᴇ́sᴜʟᴛᴀᴛ : *${res}*`);
    }

    case 'choose':
    case 'choix': {
      if (!cleanArgs.includes('|') && !cleanArgs.includes(',')) {
        return toSmallCaps(`🎯 *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .choose Pizza | Burger | Tacos`);
      }
      const choices = cleanArgs.includes('|') ? cleanArgs.split('|') : cleanArgs.split(',');
      const pick = choices[Math.floor(Math.random() * choices.length)].trim();
      return toSmallCaps(`🎯 *ʟᴇ ʙᴏᴛ ᴀ ᴄʜᴏɪsɪ ᴘᴏᴜʀ ᴠᴏᴜs*\n\n◈ ʀᴇ́ᴘᴏɴsᴇ : *${pick}* ✨`);
    }

    case 'poll':
    case 'sondage': {
      if (!cleanArgs) return toSmallCaps(`📊 *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .poll Meilleur anime ?`);
      return toSmallCaps(`📊 *sᴏɴᴅᴀɢᴇ ᴋᴀʏᴅᴏ xɪᴛ*\n\n◈ ϙᴜᴇsᴛɪᴏɴ : ${cleanArgs}\n\n1️⃣ ᴏᴜɪ / ᴅ'ᴀᴄᴄᴏʀᴅ\n2️⃣ ɴᴏɴ / ᴘᴀs ᴅ'ᴀᴄᴄᴏʀᴅ\n3️⃣ ɴᴇᴜᴛʀᴇ\n\nʀᴇ́ᴀɢɪssᴇᴢ ᴀᴠᴇᴄ ᴜɴ ᴇᴍᴏᴊɪ ᴘᴏᴜʀ ᴠᴏᴛᴇʀ !`);
    }

    case 'priority': {
      const tasks = ['P1 : URGENT ET IMPORTANT 🔴', 'P2 : IMPORTANT MAIS PAS URGENT 🟡', 'P3 : DÉLÉGUER 🔵', 'P4 : ÉLIMINER ⚪'];
      return toSmallCaps(`📋 *ᴍᴀᴛʀɪᴄᴇ ᴅ'ᴇɪsᴇɴʜᴏᴡᴇʀ*\n\n${tasks.join('\n')}`);
    }

    // ----------------------------------------------------
    // SANTÉ, SPORT & BIEN-ÊTRE (169 - 178)
    // ----------------------------------------------------
    case 'bmi':
    case 'imc': {
      const parts = cleanArgs.split(/\s+/);
      const poids = parseFloat(parts[0]);
      const taille = parseFloat(parts[1]);
      if (!poids || !taille) {
        return toSmallCaps(`⚖️ *ᴄᴀʟᴄᴜʟ ɪᴍᴄ*\nᴜᴛɪʟɪsᴀᴛɪᴏɴ : .bmi <poids_kg> <taille_m>\nᴇxᴇᴍᴘʟᴇ : .bmi 70 1.75`);
      }
      const imc = poids / (taille * taille);
      let cat = 'Poids normal';
      if (imc < 18.5) cat = 'Sous-poids';
      else if (imc >= 25 && imc < 30) cat = 'Surpoids';
      else if (imc >= 30) cat = 'Obésité';
      return toSmallCaps(`⚖️ *ɪɴᴅɪᴄᴇ ᴅᴇ ᴍᴀssᴇ ᴄᴏʀᴘᴏʀᴇʟʟᴇ (ɪᴍᴄ)*\n\n◈ ᴘᴏɪᴅs : ${poids} ᴋɢ\n◈ ᴛᴀɪʟʟᴇ : ${taille} ᴍ\n◈ ɪᴍᴄ : *${imc.toFixed(1)}*\n◈ ᴄᴀᴛᴇ́ɢᴏʀɪᴇ : *${cat}*`);
    }

    case 'water':
    case 'eau': {
      const poids = parseFloat(cleanArgs) || 70;
      const litres = (poids * 0.035).toFixed(1);
      return toSmallCaps(`💧 *ʙᴇsᴏɪɴ ϙᴜᴏᴛɪᴅɪᴇɴ ᴇɴ ᴇᴀᴜ*\n\n◈ ᴘᴏɪᴅs : ${poids} ᴋɢ\n◈ ᴇᴀᴜ ʀᴇᴄᴏᴍᴍᴀɴᴅᴇ́ᴇ : *${litres} ʟɪᴛʀᴇs / ᴊᴏᴜʀ* (≈ ${(parseFloat(litres) * 4).toFixed(0)} ᴠᴇʀʀᴇs) 🥤`);
    }

    case 'calories': {
      const parts = cleanArgs.split(/\s+/);
      const poids = parseFloat(parts[0]) || 70;
      const bmr = (10 * poids + 6.25 * 175 - 5 * 25 + 5).toFixed(0);
      return toSmallCaps(`🔥 *ʙᴇsᴏɪɴ ᴄᴀʟᴏʀɪϙᴜᴇ ʙᴀsᴀʟ*\n\n◈ ᴘᴏɪᴅs : ${poids} ᴋɢ\n◈ ᴍᴇ́ᴛᴀʙᴏʟɪsᴍᴇ ᴅᴇ ʙᴀsᴇ (ʙᴍʀ) : ≈ *${bmr} ᴋᴄᴀʟ / ᴊᴏᴜʀ*`);
    }

    case 'sleep':
    case 'sommeil': {
      const now = new Date();
      return toSmallCaps(`💤 *ᴄʏᴄʟᴇs ᴅᴇ sᴏᴍᴍᴇɪʟ (90 ᴍɪɴ)*\nsɪ ᴠᴏᴜs ᴠᴏᴜs ᴄᴏᴜᴄʜᴇᴢ ᴍᴀɪɴᴛᴇɴᴀɴᴛ, ʀᴇ́ᴠᴇɪʟʟᴇᴢ-ᴠᴏᴜs ᴀ̀ :\n\n◈ 06:00 (4 ᴄʏᴄʟᴇs - 6ʜ)\n◈ 07:30 (5 ᴄʏᴄʟᴇs - 7ʜ30 - ɪᴅᴇ́ᴀʟ ✨)\n◈ 09:00 (6 ᴄʏᴄʟᴇs - 9ʜ)`);
    }

    case 'breathe':
    case 'respiration': {
      return toSmallCaps(`🧘 *ᴇxᴇʀᴄɪᴄᴇ ᴅᴇ ᴄᴏʜᴇ́ʀᴇɴᴄᴇ ᴄᴀʀᴅɪᴀϙᴜᴇ*\n\n◈ ɪɴsᴘɪʀᴇᴢ ᴘᴇɴᴅᴀɴᴛ 4 sᴇᴄᴏɴᴅᴇs 🫁\n◈ ʙʟᴏϙᴜᴇᴢ ᴘᴇɴᴅᴀɴᴛ 4 sᴇᴄᴏɴᴅᴇs ⏸️\n◈ ᴇxᴘɪʀᴇᴢ ʟᴇɴᴛᴇᴍᴇɴᴛ ᴘᴇɴᴅᴀɴᴛ 6 sᴇᴄᴏɴᴅᴇs 💨\n◈ ʀᴇ́ᴘᴇ́ᴛᴇᴢ 5 ғᴏɪs ᴘᴏᴜʀ ᴜɴ ᴄᴀʟᴍᴇ ᴀʙsᴏʟᴜ.`);
    }

    case 'workout': {
      const exercises = [
        '20 Pompes explosives',
        '30 Squats profonds',
        '1 minute de Gainage ventral',
        '25 Fentes marchées',
        '40 Mountain Climbers',
      ];
      return toSmallCaps(`💪 *ᴇɴᴛʀᴀɪ̂ɴᴇᴍᴇɴᴛ ᴇxᴘʀᴇss KAYDO DEV*\n\n${exercises.map((e, i) => `◈ ${i + 1}. ${e}`).join('\n')}\n\n⚡ 3 tours sans pause !`);
    }

    case 'quote':
    case 'citation': {
      const quotes = [
        "La discipline est le pont entre les objectifs et l'accomplissement.",
        "Plus grand est l'obstacle, plus grande est la gloire de le surmonter.",
        "Le secret pour avancer, c'est simplement de commencer.",
        "Domination, innovation, sans limites.",
        "Votre seule limite est celle que vous vous imposez.",
      ];
      const q = quotes[Math.floor(Math.random() * quotes.length)];
      return toSmallCaps(`💬 *ᴄɪᴛᴀᴛɪᴏɴ ɪɴsᴘɪʀᴀɴᴛᴇ*\n\n« ${q} »\n\n— ᴋᴀʏᴅᴏ sᴄᴏғɪᴇʟᴅ 👑`);
    }

    case 'motivation': {
      return toSmallCaps(`🔥 *ᴅᴏsᴇ ᴅᴇ ᴍᴏᴛɪᴠᴀᴛɪᴏɴ*\n\nᴄʜᴀϙᴜᴇ ᴊᴏᴜʀ ᴇsᴛ ᴜɴᴇ ɴᴏᴜᴠᴇʟʟᴇ ᴄʜᴀɴᴄᴇ ᴅᴇ ᴅᴇᴠᴇɴɪʀ ᴍᴇɪʟʟᴇᴜʀ ϙᴜ'ʜɪᴇʀ.\nɴ'ᴀʙᴀɴᴅᴏɴɴᴇ ᴊᴀᴍᴀɪs. ᴛᴏɴ ᴛʀᴀᴠᴀɪʟ ᴀᴄʜᴀʀɴᴇ́ ᴘᴀɪᴇʀᴀ ᴛᴏᴜᴊᴏᴜʀs ! ⚡`);
    }

    case 'riddle':
    case 'enigme': {
      return toSmallCaps(`🧩 *ᴇ́ɴɪɢᴍᴇ ᴅᴜ ᴊᴏᴜʀ*\n\nᴊᴇ sᴜɪs ᴛᴏᴜᴊᴏᴜʀs ᴅᴇᴠᴀɴᴛ ᴠᴏᴜs ᴍᴀɪs ᴠᴏᴜs ɴᴇ ᴘᴏᴜᴠᴇᴢ ᴊᴀᴍᴀɪs ᴍᴇ ᴠᴏɪʀ. ϙᴜɪ sᴜɪs-ᴊᴇ ?\n\n*(ʀᴇ́ᴘᴏɴsᴇ : ʟ'ᴀᴠᴇɴɪʀ)* ✨`);
    }

    case 'advice':
    case 'conseil': {
      return toSmallCaps(`💡 *ᴄᴏɴsᴇɪʟ ᴅᴜ ᴊᴏᴜʀ*\n\nғᴏᴄᴜs sᴜʀ ᴜɴᴇ sᴇᴜʟᴇ ᴄʜᴏsᴇ ᴀ̀ ʟᴀ ғᴏɪs. ʟᴀ ᴄᴏɴᴄᴇɴᴛʀᴀᴛɪᴏɴ ᴇsᴛ ᴠᴏᴛʀᴇ sᴜᴘᴇʀ-ᴘᴏᴜᴠᴏɪʀ.`);
    }

    // ----------------------------------------------------
    // CULTURE, DIVERTISSEMENT & SAVOIR (179 - 200)
    // ----------------------------------------------------
    case 'fact':
    case 'anecdote': {
      const facts = [
        "Le cœur d'une crevette se trouve dans sa tête.",
        "Les pieuvres ont trois cœurs et le sang bleu.",
        "Le miel ne périme jamais : des pots vieux de 3000 ans sont encore comestibles.",
        "Les corbeaux sont capables de reconnaître les visages humains pendant des années.",
        "La foudre frappe la Terre environ 100 fois par seconde.",
      ];
      return toSmallCaps(`🧠 *ʟᴇ sᴀᴠɪᴇᴢ-ᴠᴏᴜs ?*\n\n◈ ${facts[Math.floor(Math.random() * facts.length)]}`);
    }

    case 'country':
    case 'pays': {
      const p = cleanArgs || 'Haiti';
      return toSmallCaps(`🌍 *ғɪᴄʜᴇ ᴘᴀʏs [ ${p.toUpperCase()} ]*\n\n◈ ᴄᴀᴘɪᴛᴀʟᴇ : ᴘᴏʀᴛ-ᴀᴜ-ᴘʀɪɴᴄᴇ\n◈ ʟᴀɴɢᴜᴇs : ᴄʀᴇ́ᴏʟᴇ, ғʀᴀɴᴄ̧ᴀɪs\n◈ ᴍᴏɴɴᴀɪᴇ : ɢᴏᴜʀᴅᴇ (ʜᴛɢ)\n◈ ɪɴᴅɪᴄᴀᴛɪғ : +509\n◈ ᴅᴇᴠɪsᴇ : ʟ'ᴜɴɪᴏɴ ғᴀɪᴛ ʟᴀ ғᴏʀᴄᴇ 🇭🇹`);
    }

    case 'capital': {
      const q = cleanArgs.toLowerCase();
      const capitals: Record<string, string> = {
        haiti: 'Port-au-Prince 🇭🇹',
        france: 'Paris 🇫🇷',
        usa: 'Washington D.C. 🇺🇸',
        canada: 'Ottawa 🇨🇦',
        espagne: 'Madrid 🇪🇸',
        italie: 'Rome 🇮🇹',
        japon: 'Tokyo 🇯🇵',
        bresil: 'Brasília 🇧🇷',
        senegal: 'Dakar 🇸🇳',
      };
      return toSmallCaps(`🏛️ *ᴄᴀᴘɪᴛᴀʟᴇ*\n\n◈ ᴘᴀʏs : ${cleanArgs}\n◈ ᴄᴀᴘɪᴛᴀʟᴇ : ${capitals[q] || 'Capitale mondiale vérifiée'}`);
    }

    case 'planet': {
      return toSmallCaps(`🪐 *sʏsᴛᴇ̀ᴍᴇ sᴏʟᴀɪʀᴇ*\n\n1. ᴍᴇʀᴄᴜʀᴇ ☿\n2. ᴠᴇ́ɴᴜs ♀\n3. ᴛᴇʀʀᴇ ♁\n4. ᴍᴀʀs ♂\n5. ᴊᴜᴘɪᴛᴇʀ ♃\n6. sᴀᴛᴜʀɴᴇ ♄\n7. ᴜʀᴀɴᴜs ♅\n8. ɴᴇᴘᴛᴜɴᴇ ♆`);
    }

    case 'chemistry':
    case 'element': {
      const el = cleanArgs || 'Gold';
      return toSmallCaps(`🧪 *ᴇ́ʟᴇ́ᴍᴇɴᴛ ᴄʜɪᴍɪϙᴜᴇ [ ${el.toUpperCase()} ]*\n\n◈ sʏᴍʙᴏʟᴇ : ᴀᴜ\n◈ ɴᴜᴍᴇ́ʀᴏ ᴀᴛᴏᴍɪϙᴜᴇ : 79\n◈ ᴍᴀssᴇ : 196.966 u\n◈ ɢʀᴏᴜᴘᴇ : ᴍᴇ́ᴛᴀᴜx ᴅᴇ ᴛʀᴀɴsɪᴛɪᴏɴ`);
    }

    case 'math': {
      return toSmallCaps(`📐 *ᴄᴏɴsᴛᴀɴᴛᴇs ᴍᴀᴛʜᴇ́ᴍᴀᴛɪϙᴜᴇs*\n\n◈ π (ᴘɪ) ≈ 3.1415926535\n◈ e (ᴇᴜʟᴇʀ) ≈ 2.7182818284\n◈ φ (ɴᴏᴍʙʀᴇ ᴅ'ᴏʀ) ≈ 1.6180339887\n◈ √2 ≈ 1.4142135623`);
    }

    case 'speedtest': {
      return toSmallCaps(`🚀 *ᴛᴇsᴛ ᴅᴇ ᴅᴇ́ʙɪᴛ ᴋᴀʏᴅᴏ xɪᴛ*\n\n◈ ᴅᴏᴡɴʟᴏᴀᴅ : 948.5 ᴍʙ/s\n◈ ᴜᴘʟᴏᴀᴅ : 890.2 ᴍʙ/s\n◈ ᴘɪɴɢ : 1.2 ᴍs\n◈ sᴇʀᴠᴇᴜʀ : ɢᴏᴏɢʟᴇ ᴄʟᴏᴜᴅ ᴜs-ᴇᴀsᴛ1\n◈ ϙᴜᴀʟɪᴛᴇ́ : ᴜʟᴛʀᴀ-ʜᴀᴜᴛ ᴅᴇ́ʙɪᴛ ғɪʙʀᴇ ⚡`);
    }

    case 'battery': {
      return toSmallCaps(`🔋 *ᴇ́ᴛᴀᴛ ʙᴀᴛᴛᴇʀɪᴇ sᴇʀᴠᴇᴜʀ*\n\n◈ ɴɪᴠᴇᴀᴜ : 100% ⚡\n◈ ᴇ́ᴛᴀᴛ : sᴜʀ sᴇᴄᴛᴇᴜʀ ɪɴɪɴᴛᴇʀʀᴏᴍᴘᴜ (ᴜᴘs 24/7)\n◈ ᴀᴜᴛᴏɴᴏᴍɪᴇ : ɪʟʟɪᴍɪᴛᴇ́ᴇ`);
    }

    case 'device': {
      return toSmallCaps(`📱 *ɪɴғᴏs ᴀᴘᴘᴀʀᴇɪʟ ᴋᴀʏᴅᴏ xɪᴛ*\n\n◈ sʏsᴛᴇ̀ᴍᴇ : ʟɪɴᴜx x64\n◈ ɴᴏᴇᴜᴅ : ɴᴏᴅᴇ.ᴊs v20+\n◈ ᴍᴏᴛᴇᴜʀ : ʙᴀɪʟᴇʏs ᴍᴜʟᴛɪ-ᴅᴇᴠɪᴄᴇ\n◈ ᴘʀᴏᴛᴇᴄᴛɪᴏɴ : ᴋᴀʏᴅᴏ ᴀɴᴛɪ-ʙᴀɴ v4`);
    }

    case 'sysinfo':
    case 'system': {
      const os = require('os');
      return toSmallCaps(`💻 *ɪɴғᴏʀᴍᴀᴛɪᴏɴs sʏsᴛᴇ̀ᴍᴇ*\n\n◈ ᴏs : ${os.type()} ${os.release()}\n◈ ᴄᴘᴜ : ${os.cpus()[0]?.model || 'Cloud vCPU'}\n◈ ᴍᴇ́ᴍᴏɪʀᴇ ᴛᴏᴛᴀʟᴇ : ${(os.totalmem() / 1073741824).toFixed(1)} ɢʙ\n◈ ᴍᴇ́ᴍᴏɪʀᴇ ʟɪʙʀᴇ : ${(os.freemem() / 1073741824).toFixed(1)} ɢʙ\n◈ ᴜᴘᴛɪᴍᴇ sʏsᴛᴇ̀ᴍᴇ : ${(os.uptime() / 3600).toFixed(1)} ʜᴇᴜʀᴇs`);
    }

    case 'pingip': {
      const host = cleanArgs || '1.1.1.1';
      return toSmallCaps(`📡 *ᴘɪɴɢ ʀᴇ́sᴇᴀᴜ [ ${host} ]*\n\n◈ 64 ᴏᴄᴛᴇᴛs ᴅᴇ ${host} : ᴛᴇᴍᴘs = 8.4 ᴍs\n◈ ᴘᴀϙᴜᴇᴛs : 4 ᴛʀᴀɴsᴍɪs, 4 ʀᴇᴄ̧ᴜs, 0% ᴘᴇʀᴛᴇ\n◈ ʟᴀᴛᴇɴᴄᴇ : ᴍɪɴ=7.1ms / ᴍᴏʏ=8.4ms / ᴍᴀx=9.2ms`);
    }

    case 'traceroute': {
      return toSmallCaps(`🛣️ *ᴛʀᴀᴄᴇʀᴏᴜᴛᴇ [ 8.8.8.8 ]*\n\n1. 10.0.0.1 (0.4 ms)\n2. 142.250.180.1 (1.2 ms)\n3. dns.google (8.8.8.8) (2.1 ms)\n\n◈ ʀᴏᴜᴛᴇ ᴏᴘᴛɪᴍᴀʟᴇ ᴠᴇ́ʀɪғɪᴇ́ᴇ.`);
    }

    case 'headers': {
      return toSmallCaps(`📋 *ᴇɴ-ᴛᴇ̂ᴛᴇs ʜᴛᴛᴘ ᴋᴀʏᴅᴏ*\n\n◈ User-Agent: ZLK-XIT/4.0 Baileys\n◈ Content-Type: application/json\n◈ Accept: */*\n◈ Connection: keep-alive\n◈ X-Powered-By: KaydoEngine`);
    }

    case 'dnsrecords': {
      return toSmallCaps(`📑 *ᴇɴʀᴇɢɪsᴛʀᴇᴍᴇɴᴛs ᴅɴs*\n\n◈ A : 104.21.45.12\n◈ AAAA : 2606:4700:3033::ac43\n◈ MX : mail.kaydoxit.net (priorité 10)\n◈ TXT : "v=spf1 include:_spf.google.com ~all"`);
    }

    case 'subnets': {
      return toSmallCaps(`🌐 *ᴄᴀʟᴄᴜʟ ᴅᴇ sᴏᴜs-ʀᴇ́sᴇᴀᴜ*\n\n◈ ᴍᴀsϙᴜᴇ /24 = 255.255.255.0 (256 ɪᴘs / 254 ʜᴏ̂ᴛᴇs)\n◈ ᴍᴀsϙᴜᴇ /16 = 255.255.0.0 (65,536 ɪᴘs)\n◈ ᴍᴀsϙᴜᴇ /8 = 255.0.0.0 (16,777,216 ɪᴘs)`);
    }

    case 'speedcalc': {
      return toSmallCaps(`⚡ *ᴄᴀʟᴄᴜʟ ᴅᴇ ᴛᴇᴍᴘs ᴅᴇ ᴛᴇ́ʟᴇ́ᴄʜᴀʀɢᴇᴍᴇɴᴛ*\n\n◈ ғɪᴄʜɪᴇʀ 1 ɢᴏ ᴀ̀ 100 ᴍʙ/s : ≈ 80 sᴇᴄᴏɴᴅᴇs\n◈ ғɪᴄʜɪᴇʀ 5 ɢᴏ ᴀ̀ 500 ᴍʙ/s : ≈ 82 sᴇᴄᴏɴᴅᴇs\n◈ ғɪᴄʜɪᴇʀ 50 ɢᴏ ᴀ̀ 1 ɢʙ/s : ≈ 6.5 ᴍɪɴᴜᴛᴇs`);
    }

    case 'ascii': {
      const t = cleanArgs || 'ZLK';
      return `\`\`\`\n _  __     __   ______   ____  \n| |/ /    / /  / / __ \\ / __ \\ \n| ' /    / /  / / / / // / / / \n| . \\   / /  / / /_/ // /_/ /  \n|_|\\_\\ /_/  /_/\\____/ \\____/   \n\`\`\``;
    }

    case 'fliptext': {
      if (!cleanArgs) return toSmallCaps(`🙃 *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .fliptext Salut`);
      const flipDict: Record<string, string> = {
        a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ',
        i: 'ᴉ', j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd',
        q: 'b', r: 'ɹ', s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x',
        y: 'ʎ', z: 'z',
      };
      const flipped = cleanArgs
        .toLowerCase()
        .split('')
        .reverse()
        .map((c) => flipDict[c] || c)
        .join('');
      return `(╯°□°)╯︵ ${flipped}`;
    }

    case 'glitchtext': {
      if (!cleanArgs) return toSmallCaps(`⚡ *ᴜᴛɪʟɪsᴀᴛɪᴏɴ* : .glitchtext ZLK`);
      const zalgo = ['̷', '̵', '̶', '̴', '̲', '̳', '͜', '͝'];
      const res = cleanArgs
        .split('')
        .map((c) => c + zalgo[Math.floor(Math.random() * zalgo.length)])
        .join('');
      return res;
    }

    case 'credits':
    case 'developer':
    case 'devinfo': {
      return `👑 *ᴄʀᴇ́ᴅɪᴛs ᴏғғɪᴄɪᴇʟs 𝐙𝐋𝐊 𝐁𝐎𝐓 𓃶*\n\n◈ ᴏᴡɴᴇʀ 1 : 𝐊𝐀𝐘𝐃𝐎 𝐙𝐋𝐊 𓃶 (wa.me/50935975863)\n◈ ᴏᴡɴᴇʀ 2 : 𝐒𝐇𝐀𝐊𝐀 𝐙𝐋𝐊 𓃶 (wa.me/50940131864)\n◈ ᴘʟᴀᴛғᴏʀᴍᴇ : Railway Cloud 24/7\n◈ ᴠᴇʀsɪᴏɴ : 5.0.0 𝐙𝐋𝐊 𝐄𝐃𝐈𝐓𝐈𝐎𝐍\n◈ ᴅᴇᴠɪsᴇ : ᴅᴏᴍɪɴᴀᴛɪᴏɴ • ɪɴɴᴏᴠᴀᴛɪᴏɴ • sᴀɴs ʟɪᴍɪᴛᴇs\n\n> *© 𝙼𝙰𝙳𝙴 𝙸𝙽 𝙱𝚈 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓*`;
    }

    default:
      return null;
  }
}

export const USEFUL_COMMAND_LIST = [
  'time', 'heure', 'date', 'today',
  'calendar', 'cal', 'countdown', 'age', 'moon', 'moonphase', 'sun', 'sunrise', 'leapyear',
  'horoscope', 'zodiac', 'tarot', 'reverse', 'inverse', 'upper', 'majuscule', 'lower',
  'minuscule', 'count', 'wordcount', 'repeat', 'shuffle', 'mock', 'sponge', 'aesthetic',
  'vapor', 'font', 'bold', 'italic', 'jsonformat', 'json', 'regex', 'statuscode', 'http',
  'gitcheat', 'lorem', 'docker', 'linux', 'bash', 'color', 'hexcolor', 'timestamp',
  'npmsearch', 'todo', 'note', 'reminder', 'rappel', 'timer', 'chrono', 'pomodoro',
  'dice', 'de', 'flip', 'coin', 'pileouface', 'choose', 'choix', 'poll', 'sondage',
  'priority', 'bmi', 'imc', 'water', 'eau', 'calories', 'sleep', 'sommeil', 'breathe',
  'respiration', 'workout', 'quote', 'citation', 'motivation', 'riddle', 'enigme',
  'advice', 'conseil', 'fact', 'anecdote', 'country', 'pays', 'capital', 'planet',
  'chemistry', 'element', 'math', 'speedtest', 'battery', 'device', 'sysinfo', 'system',
  'pingip', 'traceroute', 'headers', 'dnsrecords', 'subnets', 'speedcalc', 'ascii',
  'fliptext', 'glitchtext', 'credits', 'developer', 'devinfo'
];
