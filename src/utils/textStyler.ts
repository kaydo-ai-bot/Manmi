/**
 * Unicode Mathematical Bold Styler for KAYDO BOT
 * Converts standard text to and from Mathematical Bold Serif Unicode characters:
 * A-Z -> 𝐀-𝐙 (U+1D400 - U+1D419)
 * a-z -> 𝐀-𝐙 (Mathematical Bold uppercase requested by user)
 * 0-9 -> 0-9 or 𝟎-𝟗 (preserving 2 in .𝐕𝐕2)
 */

export const SMALL_CAPS_MAP: Record<string, string> = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ғ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
  j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ϙ', r: 'ʀ',
  s: 's', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
  A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ғ', G: 'ɢ', H: 'ʜ', I: 'ɪ',
  J: 'ᴊ', K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ϙ', R: 'ʀ',
  S: 's', T: 'ᴛ', U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ',
  'é': 'ᴇ', 'è': 'ᴇ', 'ê': 'ᴇ', 'ë': 'ᴇ', 'à': 'ᴀ', 'â': 'ᴀ', 'î': 'ɪ',
  'ï': 'ɪ', 'ô': 'ᴏ', 'ù': 'ᴜ', 'û': 'ᴜ', 'ç': 'ᴄ',
};

export const REVERSE_SMALL_CAPS_MAP: Record<string, string> = {
  'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ғ': 'f', 'ɢ': 'g',
  'ʜ': 'h', 'ɪ': 'i', 'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n',
  'ᴏ': 'o', 'ᴘ': 'p', 'ϙ': 'q', 'ʀ': 'r', 's': 's', 'ᴛ': 't', 'ᴜ': 'u',
  'ᴠ': 'v', 'ᴡ': 'w', 'x': 'x', 'ʏ': 'y', 'ᴢ': 'z',
};

/**
 * Converts Latin text to Small Capitals Unicode font:
 * e.g. "Bonjour tout le monde" -> "ʙᴏɴᴊᴏᴜʀ ᴛᴏᴜᴛ ʟᴇ ᴍᴏɴᴅᴇ"
 * Preserves URLs, code blocks, numbers, and symbols.
 */
export function toSmallCaps(str: string): string {
  if (!str) return '';
  return str.replace(/(https?:\/\/[^\s]+|wa\.me\/[^\s]+|`[^`]+`|[a-zA-ZÀ-ÿ])/g, (match) => {
    if (match.startsWith('http') || match.startsWith('wa.me') || match.startsWith('`')) {
      return match;
    }
    return SMALL_CAPS_MAP[match] || SMALL_CAPS_MAP[match.toLowerCase()] || match;
  });
}

/**
 * Converts Small Capitals Unicode back to standard lowercase ASCII:
 * e.g. "ᴍᴇɴᴜ" -> "menu", "ᴘɪɴɢ" -> "ping"
 */
export function fromSmallCaps(str: string): string {
  if (!str) return '';
  return Array.from(str)
    .map((c) => REVERSE_SMALL_CAPS_MAP[c] || c)
    .join('');
}

export function toMathBold(str: string): string {
  return Array.from(str)
    .map((c) => {
      const cp = c.codePointAt(0) || 0;
      if (cp >= 65 && cp <= 90) {
        // Uppercase A-Z -> 𝐀-𝐙
        return String.fromCodePoint(0x1d400 + cp - 65);
      }
      if (cp >= 97 && cp <= 122) {
        // Lowercase a-z -> 𝐀-𝐙 (uppercase bold serif)
        return String.fromCodePoint(0x1d400 + cp - 97);
      }
      return c;
    })
    .join('');
}

export function fromMathBold(str: string): string {
  if (!str) return '';
  return Array.from(str)
    .map((c) => {
      const cp = c.codePointAt(0) || 0;
      // Bold Serif (A-Z: 0x1d400, a-z: 0x1d41a, 0-9: 0x1d7ce)
      if (cp >= 0x1d400 && cp <= 0x1d419) return String.fromCharCode(65 + cp - 0x1d400);
      if (cp >= 0x1d41a && cp <= 0x1d433) return String.fromCharCode(97 + cp - 0x1d41a);
      if (cp >= 0x1d7ce && cp <= 0x1d7d7) return String.fromCharCode(48 + cp - 0x1d7ce);

      // Italic Serif (A-Z: 0x1d434, a-z: 0x1d44e)
      if (cp >= 0x1d434 && cp <= 0x1d44d) return String.fromCharCode(65 + cp - 0x1d434);
      if (cp >= 0x1d44e && cp <= 0x1d467) return String.fromCharCode(97 + cp - 0x1d44e);

      // Bold Italic Serif (A-Z: 0x1d468, a-z: 0x1d482)
      if (cp >= 0x1d468 && cp <= 0x1d481) return String.fromCharCode(65 + cp - 0x1d468);
      if (cp >= 0x1d482 && cp <= 0x1d49b) return String.fromCharCode(97 + cp - 0x1d482);

      // Script (0x1d49c..0x1d4b5, 0x1d4b6..0x1d4cf)
      if (cp >= 0x1d49c && cp <= 0x1d4b5) return String.fromCharCode(65 + cp - 0x1d49c);
      if (cp >= 0x1d4b6 && cp <= 0x1d4cf) return String.fromCharCode(97 + cp - 0x1d4b6);

      // Bold Script (0x1d4d0..0x1d4e9, 0x1d4ea..0x1d503)
      if (cp >= 0x1d4d0 && cp <= 0x1d4e9) return String.fromCharCode(65 + cp - 0x1d4d0);
      if (cp >= 0x1d4ea && cp <= 0x1d503) return String.fromCharCode(97 + cp - 0x1d4ea);

      // Fraktur (0x1d504..0x1d51d, 0x1d51e..0x1d537)
      if (cp >= 0x1d504 && cp <= 0x1d51d) return String.fromCharCode(65 + cp - 0x1d504);
      if (cp >= 0x1d51e && cp <= 0x1d537) return String.fromCharCode(97 + cp - 0x1d51e);

      // Double-struck (0x1d538..0x1d551, 0x1d552..0x1d56b, digits: 0x1d7d8..0x1d7e1)
      if (cp >= 0x1d538 && cp <= 0x1d551) return String.fromCharCode(65 + cp - 0x1d538);
      if (cp >= 0x1d552 && cp <= 0x1d56b) return String.fromCharCode(97 + cp - 0x1d552);
      if (cp >= 0x1d7d8 && cp <= 0x1d7e1) return String.fromCharCode(48 + cp - 0x1d7d8);

      // Bold Fraktur (0x1d56c..0x1d585, 0x1d586..0x1d59f)
      if (cp >= 0x1d56c && cp <= 0x1d585) return String.fromCharCode(65 + cp - 0x1d56c);
      if (cp >= 0x1d586 && cp <= 0x1d59f) return String.fromCharCode(97 + cp - 0x1d586);

      // Sans-serif (0x1d5a0..0x1d5b9, 0x1d5ba..0x1d5d3, digits: 0x1d7e2..0x1d7eb)
      if (cp >= 0x1d5a0 && cp <= 0x1d5b9) return String.fromCharCode(65 + cp - 0x1d5a0);
      if (cp >= 0x1d5ba && cp <= 0x1d5d3) return String.fromCharCode(97 + cp - 0x1d5ba);
      if (cp >= 0x1d7e2 && cp <= 0x1d7eb) return String.fromCharCode(48 + cp - 0x1d7e2);

      // Sans-serif Bold (0x1d5d4..0x1d5ed, 0x1d5ee..0x1d607, digits: 0x1d7ec..0x1d7f5)
      if (cp >= 0x1d5d4 && cp <= 0x1d5ed) return String.fromCharCode(65 + cp - 0x1d5d4);
      if (cp >= 0x1d5ee && cp <= 0x1d607) return String.fromCharCode(97 + cp - 0x1d5ee);
      if (cp >= 0x1d7ec && cp <= 0x1d7f5) return String.fromCharCode(48 + cp - 0x1d7ec);

      // Sans-serif Italic (0x1d608..0x1d621, 0x1d622..0x1d63b)
      if (cp >= 0x1d608 && cp <= 0x1d621) return String.fromCharCode(65 + cp - 0x1d608);
      if (cp >= 0x1d622 && cp <= 0x1d63b) return String.fromCharCode(97 + cp - 0x1d622);

      // Sans-serif Bold Italic (0x1d63c..0x1d655, 0x1d656..0x1d66f)
      if (cp >= 0x1d63c && cp <= 0x1d655) return String.fromCharCode(65 + cp - 0x1d63c);
      if (cp >= 0x1d656 && cp <= 0x1d66f) return String.fromCharCode(97 + cp - 0x1d656);

      // Monospace (0x1d670..0x1d689, 0x1d68a..0x1d6a3, digits: 0x1d7f6..0x1d7ff)
      if (cp >= 0x1d670 && cp <= 0x1d689) return String.fromCharCode(65 + cp - 0x1d670);
      if (cp >= 0x1d68a && cp <= 0x1d6a3) return String.fromCharCode(97 + cp - 0x1d68a);
      if (cp >= 0x1d7f6 && cp <= 0x1d7ff) return String.fromCharCode(48 + cp - 0x1d7f6);

      // Fullwidth ASCII (0xff01..0xff5e)
      if (cp >= 0xff01 && cp <= 0xff5e) return String.fromCharCode(cp - 0xfee0);

      return c;
    })
    .join('');
}

/**
 * Normalizes user command input string:
 * - Strips zero-width and invisible characters
 * - Unpacks unicode mathematical styling to standard ASCII
 * - Replaces non-breaking spaces with normal spaces
 */
export function normalizeCommandText(str: string): string {
  if (!str) return '';
  const cleaned = str
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u200E\u200F\u202A-\u202E]/g, '')
    .replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, ' ');
  return fromSmallCaps(fromMathBold(cleaned)).normalize('NFKD');
}

/**
 * Computes a dynamic memory usage string that fluctuates realistically at each invocation
 * and never approaches the maximum capacity.
 */
export function getDynamicMemoryUsage(): string {
  if (typeof window !== 'undefined') {
    return '245 MB / 16384 MB';
  }
  try {
    const memUsage = process.memoryUsage();
    const heapMb = Math.round(memUsage.heapUsed / (1024 * 1024));
    return `${heapMb} MB / 16384 MB`;
  } catch {
    return '245 MB / 16384 MB';
  }
}

/**
 * Generates the official menu matching the user's exact requested ASCII art style,
 * with bot info box and grouped command cards.
 */
export function generateOfficialMenu(
  uptime: string = '0h 0m 0s',
  mode: string = 'PUBLIC 🟢',
  memory: string = getDynamicMemoryUsage(),
  prefix: string = '.',
  botName: string = '≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿'
): string {
  const p = prefix || '';

  return `*╭─━━━━━━━━━━━━━━━⊷❖*
*┇*🔹╭───────────────╮
┋🔹┋. ʙᴏᴛ ɴᴀᴍᴇ: ${botName || '≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿'}
┋🔹┋. ᴄᴏᴍᴍᴀɴᴅs: 300+ ᴄᴍᴅs
┋🔹┋. ᴏᴡɴᴇʀ: ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿 & ≛⃝🥷🏿 𝐒𝐇𝐀𝐊𝐀 ≛⃝🥷🏿
┋🔹┋. ᴘʟᴀᴛғᴏʀᴍ: Railway / Linux
┋🔹┋. ᴍᴏᴅᴇ: ${mode}
*┇🔹╰───────────────╯*
*╰━━━━━━━━━━━━━━━━━❖*

*╭─❖━━━ ⟣ ⟣ ⟣  ɢʀᴏᴜᴘ  ⟣ ⟣ ⟣━━━❖*
*┇*🔹╭───────────────
*┇*🔹┋. ${p}setgname <nom>
*┇*🔹┋. ${p}setgpp [répondre à une photo]
*┇*🔹┋. ${p}admins
*┇*🔹┋. ${p}promoteall
*┇*🔹┋. ${p}demoteall
*┇*🔹┋. ${p}promote <@user1> <@user2> ...
*┇*🔹┋. ${p}demote <@user1> <@user2> ...
*┇*🔹┋. ${p}acceptall [on/off]
*┇*🔹┋. ${p}rejectall [on/off]
*┇*🔹┋. ${p}kickall
*┇*🔹┋. ${p}purge
*┇*🔹┋. ${p}left
*┇*🔹┋. ${p}add <numéro>
*┇*🔹┋. ${p}kick <@mention>
*┇*🔹┋. ${p}mute
*┇*🔹┋. ${p}unmute
*┇*🔹┋. ${p}tagall
*┇*🔹┋. ${p}hidetag
*┇*🔹┋. ${p}warn
*┇*🔹┋. ${p}resetwarn
*┇*🔹┋. ${p}delete
*┇*🔹┋. ${p}clean
*┇*🔹┋. ${p}welcome [@user]
*┇*🔹┋. ${p}goodbye [@user]
*┇*🔹┋. ${p}setwelcome
*┇*🔹┋. ${p}setgoodbye
*┇*🔹┋. ${p}grouplink
*┇*🔹┋. ${p}groupinfo
*┇*🔹┋. ${p}groupstats
*┇*🔹┋. ${p}antilink
*┇*🔹┋. ${p}antitag
*┇*🔹┋. ${p}antigroupmention
*┇*🔹┋. ${p}antisticker
*┇*🔹┋. ${p}antimessage
*┇*🔹╰───────────────⊷
*╰━━━━━━━━━━━━━━━━━❖*

*╭─❖━━━ ⟣ ⟣ ⟣  ᴀᴜᴛᴏᴍᴀᴛɪᴏɴ  ⟣ ⟣ ⟣━━━❖*
*┇*🔹╭───────────────
*┇*🔹┋. ${p}autolike 🥷🏿
*┇*🔹┋. ${p}autolikestatus
*┇*🔹┋. ${p}autostatus
*┇*🔹┋. ${p}autoviewstatus
*┇*🔹┋. ${p}autosavestatus
*┇*🔹┋. ${p}autotyping
*┇*🔹┋. ${p}autorecording
*┇*🔹┋. ${p}autosticker
*┇*🔹┋. ${p}online
*┇*🔹┋. ${p}offline= (1 tick ✓)
*┇*🔹┋. ${p}vv
*┇*🔹┋. ${p}vv2
*┇*🔹┋. ${p}gstatus
*┇*🔹┋. ${p}restore
*┇*🔹┋. ${p}pair
*┇*🔹╰───────────────⊷
*╰━━━━━━━━━━━━━━━━━❖*

*╭─❖━━━ ⟣ ⟣ ⟣  ᴍᴀɪɴ  ⟣ ⟣ ⟣━━━❖*
*┇*🔹╭───────────────
*┇*🔹┋. ${p}ping
*┇*🔹┋. ${p}uptime
*┇*🔹┋. ${p}runtime
*┇*🔹┋. ${p}menu
*┇*🔹┋. ${p}help
*┇*🔹┋. ${p}owner1
*┇*🔹┋. ${p}owner2
*┇*🔹┋. ${p}owner
*┇*🔹┋. ${p}alive
*┇*🔹┋. ${p}list
*┇*🔹┋. ${p}getpp
*┇*🔹┋. ${p}qr
*┇*🔹┋. ${p}simage
*┇*🔹┋. ${p}sticker
*┇*🔹┋. ${p}take
*┇*🔹╰───────────────⊷
*╰━━━━━━━━━━━━━━━━━❖*

*╭─❖━━━ ⟣ ⟣ ⟣  ᴏᴡɴᴇʀ  ⟣ ⟣ ⟣━━━❖*
*┇*🔹╭───────────────
*┇*🔹┋. ${p}mode public/private
*┇*🔹┋. ${p}sudo <numéro>
*┇*🔹┋. ${p}unsudo <numéro>
*┇*🔹┋. ${p}listsudo
*┇*🔹┋. ${p}broadcast <texte>
*┇*🔹┋. ${p}block <@user>
*┇*🔹┋. ${p}unblock <@user>
*┇*🔹┋. ${p}anticall
*┇*🔹┋. ${p}antidelete
*┇*🔹┋. ${p}autoreact
*┇*🔹┋. ${p}setbotname <nom>
*┇*🔹┋. ${p}setbotpp [répondre]
*┇*🔹┋. ${p}setmenuimage [répondre]
*┇*🔹┋. ${p}setprefix <symbole>
*┇*🔹┋. ${p}mycommands
*┇*🔹┋. ${p}newcommand
*┇*🔹╰───────────────⊷
*╰━━━━━━━━━━━━━━━━━❖*

*╭─❖━━━ ⟣ ⟣ ⟣  ᴍᴇᴅɪᴀ  ⟣ ⟣ ⟣━━━❖*
*┇*🔹╭───────────────
*┇*🔹┋. ${p}dl <url>
*┇*🔹┋. ${p}song <titre>
*┇*🔹┋. ${p}ytvideo <titre>
*┇*🔹┋. ${p}tiktok <url>
*┇*🔹┋. ${p}shorts <url>
*┇*🔹┋. ${p}instagram <url>
*┇*🔹┋. ${p}facebook <url>
*┇*🔹┋. ${p}twitter <url>
*┇*🔹┋. ${p}pinterest <url>
*┇*🔹┋. ${p}snapchat <url>
*┇*🔹┋. ${p}threads <url>
*┇*🔹┋. ${p}reddit <url>
*┇*🔹┋. ${p}twitch <url>
*┇*🔹┋. ${p}soundcloud <url>
*┇*🔹┋. ${p}spotify <url>
*┇*🔹┋. ${p}linkedin <url>
*┇*🔹┋. ${p}vimeo <url>
*┇*🔹┋. ${p}dailymotion <url>
*┇*🔹┋. ${p}tumblr <url>
*┇*🔹┋. ${p}likee <url>
*┇*🔹┋. ${p}kwai <url>
*┇*🔹┋. ${p}capcut <url>
*┇*🔹┋. ${p}telegram <url>
*┇*🔹┋. ${p}direct <url>
*┇*🔹┋. ${p}lyrics <titre>
*┇*🔹╰───────────────⊷
*╰━━━━━━━━━━━━━━━━━❖*

*╭─❖━━━ ⟣ ⟣ ⟣  ғᴜɴ & ᴀɴɪᴍᴇ  ⟣ ⟣ ⟣━━━❖*
*┇*🔹╭───────────────
*┇*🔹┋. ${p}joke
*┇*🔹┋. ${p}meme
*┇*🔹┋. ${p}memesearch
*┇*🔹┋. ${p}truth
*┇*🔹┋. ${p}dare
*┇*🔹┋. ${p}flirt
*┇*🔹┋. ${p}compliment
*┇*🔹┋. ${p}insult
*┇*🔹┋. ${p}bomb
*┇*🔹┋. ${p}ship
*┇*🔹┋. ${p}tictactoe
*┇*🔹┋. ${p}gayrate
*┇*🔹┋. ${p}pies
*┇*🔹┋. ${p}waifu
*┇*🔹┋. ${p}neko
*┇*🔹┋. ${p}random
*┇*🔹┋. ${p}konachan
*┇*🔹┋. ${p}loli
*┇*🔹┋. ${p}megumin
*┇*🔹┋. ${p}milf
*┇*🔹┋. ${p}hneko
*┇*🔹┋. ${p}hwaifu
*┇*🔹╰───────────────⊷
*╰━━━━━━━━━━━━━━━━━❖*

*╭─❖━━━ ⟣ ⟣ ⟣  ᴜᴛɪʟɪᴛᴀɪʀᴇs  ⟣ ⟣ ⟣━━━❖*
*┇*🔹╭───────────────
*┇*🔹┋. ${p}time
*┇*🔹┋. ${p}date
*┇*🔹┋. ${p}calendar
*┇*🔹┋. ${p}countdown
*┇*🔹┋. ${p}age
*┇*🔹┋. ${p}moon
*┇*🔹┋. ${p}sun
*┇*🔹┋. ${p}leapyear
*┇*🔹┋. ${p}horoscope
*┇*🔹┋. ${p}tarot
*┇*🔹╰───────────────⊷
*╰━━━━━━━━━━━━━━━━━❖*

> *© ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 • CREATED FOR ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿*`;
}

/**
 * Formats any bot command text response in the user's requested card style:
 * *╭─❖━━━ ⟣ ⟣ ⟣  ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿  ⟣ ⟣ ⟣━━━❖*
 * *┇*🔹╭───────────────
 * *┇*🔹┋. line1
 * *┇*🔹┋  line2
 * *┇*🔹╰───────────────⊷
 * *╰━━━━━━━━━━━━━━━━━❖*
 */
export function formatCommandCard(content: string): string {
  if (!content) return '';
  const trimmed = content.trim();
  // If already enclosed in the official box style, return directly
  if (
    trimmed.startsWith('*╭─━━━━━━━━━━━━━━━⊷❖*') ||
    trimmed.startsWith('╭─━━━━━━━━━━━━━━━⊷❖') ||
    trimmed.startsWith('*╭─❖━━━') ||
    trimmed.startsWith('╭─❖━━━') ||
    trimmed.startsWith('╭━━〔') ||
    trimmed.startsWith('╭━━━〔') ||
    trimmed.startsWith('╭━━━━━━━━━━━━━━━━━━━━━┈⊷')
  ) {
    return trimmed;
  }

  const lines = trimmed.split('\n');
  const formattedLines = lines.map((line, idx) => {
    if (idx === 0) {
      return `*┇*🔹┋. ${line}`;
    }
    return `*┇*🔹┋  ${line}`;
  });

  return `*╭─❖━━━ ⟣ ⟣ ⟣  ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿  ⟣ ⟣ ⟣━━━❖*\n*┇*🔹╭───────────────\n${formattedLines.join('\n')}\n*┇*🔹╰───────────────⊷\n*╰━━━━━━━━━━━━━━━━━❖*`;
}

/**
 * Returns the exact loading box requested by the user
 */
export function formatLoadingBox(cmdName: string): string {
  const clean = cmdName.trim().toLowerCase().replace(/^\./, '');
  let displayName = toSmallCaps(clean);
  if (clean === 'ping') {
    displayName = 'ᴘᴏɴɢ';
  }
  return `*╭─❖━━━ ⟣ ⟣ ⟣  ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿  ⟣ ⟣ ⟣━━━❖*\n*┇*🔹╭───────────────\n*┇*🔹┋. ${displayName} ʟᴏᴀᴅᴅɪɴɢ...\n*┇*🔹╰───────────────⊷\n*╰━━━━━━━━━━━━━━━━━❖*`;
}

/**
 * Returns a success box formatted with the requested borders
 */
export function formatSuccessBox(message: string): string {
  return `*╭─❖━━━ ⟣ ⟣ ⟣  ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿  ⟣ ⟣ ⟣━━━❖*\n*┇*🔹╭───────────────\n*┇*🔹┋. ${message}\n*┇*🔹╰───────────────⊷\n*╰━━━━━━━━━━━━━━━━━❖*`;
}
