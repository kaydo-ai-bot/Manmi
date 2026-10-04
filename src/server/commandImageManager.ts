import fs from 'fs';
import path from 'path';
import axios from 'axios';

/**
 * SHADO BOT 𓃶 / KAYDO BOT - Autonomous Command Image Manager
 * Manages per-command image URLs and buffers for WhatsApp bot command replies.
 * 
 * - Single point of configuration for all bot command images.
 * - Live buffer caching with fast memory lookup.
 * - Safe fallback: if an image is unreachable, the bot sends pure text without error.
 * - Persistent storage across restarts.
 */

export const DEFAULT_GLOBAL_IMAGE_URL = 'https://files.catbox.moe/9u2j5v.png';
export const DEFAULT_APP_PHOTO_URL = 'https://files.catbox.moe/9u2j5v.png';

// Baseline default mapping for all bot commands
export const INITIAL_COMMAND_IMAGE_URLS: Record<string, string> = {
  // Main
  menu: 'https://files.catbox.moe/9u2j5v.png',
  ping: 'https://files.catbox.moe/9u2j5v.png',
  alive: 'https://files.catbox.moe/9u2j5v.png',
  help: 'https://files.catbox.moe/9u2j5v.png',
  allcmd: 'https://files.catbox.moe/9u2j5v.png',
  list: 'https://files.catbox.moe/9u2j5v.png',
  owner: 'https://files.catbox.moe/9u2j5v.png',
  owner1: 'https://files.catbox.moe/9u2j5v.png',
  owner2: 'https://files.catbox.moe/9u2j5v.png',
  dev1: 'https://files.catbox.moe/9u2j5v.png',
  dev2: 'https://files.catbox.moe/9u2j5v.png',
  info: 'https://files.catbox.moe/9u2j5v.png',
  botinfo: 'https://files.catbox.moe/9u2j5v.png',
  runtime: 'https://files.catbox.moe/9u2j5v.png',
  uptime: 'https://files.catbox.moe/9u2j5v.png',
  profile: 'https://files.catbox.moe/9u2j5v.png',
  qr: 'https://files.catbox.moe/9u2j5v.png',
  online: 'https://files.catbox.moe/9u2j5v.png',
  offline: 'https://files.catbox.moe/9u2j5v.png',
  autorecording: 'https://files.catbox.moe/9u2j5v.png',
  autotyping: 'https://files.catbox.moe/9u2j5v.png',
  autolike: 'https://files.catbox.moe/9u2j5v.png',
  autolikestatus: 'https://files.catbox.moe/9u2j5v.png',
  groupinfo: 'https://files.catbox.moe/9u2j5v.png',
  groupstats: 'https://files.catbox.moe/9u2j5v.png',
  groupstatus: 'https://files.catbox.moe/9u2j5v.png',
  status: 'https://files.catbox.moe/9u2j5v.png',
  restore: 'https://files.catbox.moe/9u2j5v.png',
  reconnect: 'https://files.catbox.moe/9u2j5v.png',

  // Moderation
  kick: 'https://files.catbox.moe/9u2j5v.png',
  kickall: 'https://files.catbox.moe/9u2j5v.png',
  purge: 'https://files.catbox.moe/9u2j5v.png',
  mute: 'https://files.catbox.moe/9u2j5v.png',
  unmute: 'https://files.catbox.moe/9u2j5v.png',
  promote: 'https://files.catbox.moe/9u2j5v.png',
  demote: 'https://files.catbox.moe/9u2j5v.png',
  admins: 'https://files.catbox.moe/9u2j5v.png',
  tagall: 'https://files.catbox.moe/9u2j5v.png',
  hidetag: 'https://files.catbox.moe/9u2j5v.png',
  antilink: 'https://files.catbox.moe/9u2j5v.png',
  antitag: 'https://files.catbox.moe/9u2j5v.png',
  antigroupmention: 'https://files.catbox.moe/9u2j5v.png',
  antisticker: 'https://files.catbox.moe/9u2j5v.png',
  antimessage: 'https://files.catbox.moe/9u2j5v.png',
  autosticker: 'https://files.catbox.moe/9u2j5v.png',
  warn: 'https://files.catbox.moe/9u2j5v.png',
  resetwarn: 'https://files.catbox.moe/9u2j5v.png',
  clean: 'https://files.catbox.moe/9u2j5v.png',
  delete: 'https://files.catbox.moe/9u2j5v.png',
  grouplink: 'https://files.catbox.moe/9u2j5v.png',
  welcome: 'https://files.catbox.moe/9u2j5v.png',
  goodbye: 'https://files.catbox.moe/9u2j5v.png',
  setwelcome: 'https://files.catbox.moe/9u2j5v.png',
  setgoodbye: 'https://files.catbox.moe/9u2j5v.png',

  // Owner
  mode: 'https://files.catbox.moe/9u2j5v.png',
  anticall: 'https://files.catbox.moe/9u2j5v.png',
  antidelete: 'https://files.catbox.moe/9u2j5v.png',
  broadcast: 'https://files.catbox.moe/9u2j5v.png',
  autoreact: 'https://files.catbox.moe/9u2j5v.png',
  setprefix: 'https://files.catbox.moe/9u2j5v.png',
  setbotname: 'https://files.catbox.moe/9u2j5v.png',
  setbotpp: 'https://files.catbox.moe/9u2j5v.png',
  setmenuimage: 'https://files.catbox.moe/9u2j5v.png',
  mycommands: 'https://files.catbox.moe/9u2j5v.png',
  newcommand: 'https://files.catbox.moe/9u2j5v.png',

  // Fun & Games
  joke: 'https://files.catbox.moe/9u2j5v.png',
  meme: 'https://files.catbox.moe/9u2j5v.png',
  memesearch: 'https://files.catbox.moe/9u2j5v.png',
  compliment: 'https://files.catbox.moe/9u2j5v.png',
  flirt: 'https://files.catbox.moe/9u2j5v.png',
  ship: 'https://files.catbox.moe/9u2j5v.png',
  insult: 'https://files.catbox.moe/9u2j5v.png',
  bomb: 'https://files.catbox.moe/9u2j5v.png',
  dare: 'https://files.catbox.moe/9u2j5v.png',
  truth: 'https://files.catbox.moe/9u2j5v.png',
  gayrate: 'https://files.catbox.moe/9u2j5v.png',
  pies: 'https://files.catbox.moe/9u2j5v.png',
  tictactoe: 'https://files.catbox.moe/9u2j5v.png',

  // Anime
  neko: 'https://files.catbox.moe/9u2j5v.png',
  waifu: 'https://files.catbox.moe/9u2j5v.png',
  loli: 'https://files.catbox.moe/9u2j5v.png',
  megumin: 'https://files.catbox.moe/9u2j5v.png',
  milf: 'https://files.catbox.moe/9u2j5v.png',
  random: 'https://files.catbox.moe/9u2j5v.png',
  konachan: 'https://files.catbox.moe/9u2j5v.png',
  hneko: 'https://files.catbox.moe/9u2j5v.png',
  hwaifu: 'https://files.catbox.moe/9u2j5v.png',

  // Useful & Utils
  time: 'https://files.catbox.moe/9u2j5v.png',
  date: 'https://files.catbox.moe/9u2j5v.png',
  calendar: 'https://files.catbox.moe/9u2j5v.png',
  countdown: 'https://files.catbox.moe/9u2j5v.png',
  age: 'https://files.catbox.moe/9u2j5v.png',
  moon: 'https://files.catbox.moe/9u2j5v.png',
  sun: 'https://files.catbox.moe/9u2j5v.png',
  leapyear: 'https://files.catbox.moe/9u2j5v.png',
  horoscope: 'https://files.catbox.moe/9u2j5v.png',
  tarot: 'https://files.catbox.moe/9u2j5v.png',
};

// Storage file paths
const CONFIG_FILE = path.join(process.cwd(), 'data', 'command_images.json');
const BACKUP_CONFIG_FILE = path.join(process.cwd(), 'data', 'sessions-backup', 'command_images.json');

// In-memory active store
let defaultImageUrl: string = DEFAULT_GLOBAL_IMAGE_URL;
let appPhotoUrl: string = DEFAULT_APP_PHOTO_URL;
let commandImageUrls: Record<string, string> = { ...INITIAL_COMMAND_IMAGE_URLS };

// Memory buffer cache to avoid downloading the same image repeatedly
interface CachedBuffer {
  buffer: Buffer;
  mimeType: string;
  timestamp: number;
}
const bufferCache = new Map<string, CachedBuffer>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache

function ensureDataDir(): void {
  const dir1 = path.join(process.cwd(), 'data');
  const dir2 = path.join(process.cwd(), 'data', 'sessions-backup');
  for (const d of [dir1, dir2]) {
    if (!fs.existsSync(d)) {
      try {
        fs.mkdirSync(d, { recursive: true });
      } catch (_) {}
    }
  }
}

/**
 * Loads configured image URLs from disk
 */
export function loadCommandImagesFromDisk(): void {
  try {
    ensureDataDir();
    const candidate = [CONFIG_FILE, BACKUP_CONFIG_FILE].find((f) => fs.existsSync(f));
    if (candidate) {
      const raw = fs.readFileSync(candidate, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.defaultUrl && typeof parsed.defaultUrl === 'string') {
          defaultImageUrl = parsed.defaultUrl.trim();
        }
        if (parsed.appPhotoUrl && typeof parsed.appPhotoUrl === 'string') {
          appPhotoUrl = parsed.appPhotoUrl.trim();
        }
        if (parsed.urls && typeof parsed.urls === 'object') {
          commandImageUrls = {
            ...INITIAL_COMMAND_IMAGE_URLS,
            ...parsed.urls,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[CMD IMAGES] Warning loading command images from disk:', err);
  }
}

// Initial load on import
loadCommandImagesFromDisk();

// Preload the default image buffer immediately so it is instantly available in memory for all WhatsApp commands
export async function preloadDefaultImageBuffer(): Promise<void> {
  const url = defaultImageUrl || DEFAULT_GLOBAL_IMAGE_URL;
  if (!url || !url.startsWith('http')) return;
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
    if (res.status === 200 && res.data) {
      const buffer = Buffer.from(res.data);
      const mimeType = String(res.headers['content-type'] || 'image/png');
      bufferCache.set(url, {
        buffer,
        mimeType,
        timestamp: Date.now() + 86400000, // 24h cache
      });
      bufferCache.set(DEFAULT_GLOBAL_IMAGE_URL, {
        buffer,
        mimeType,
        timestamp: Date.now() + 86400000,
      });
      console.log(`[CMD IMAGES] ✅ Image officielle pré-chargée en mémoire (${(buffer.length / 1024).toFixed(1)} KB) pour toutes les commandes WhatsApp : ${url}`);
    }
  } catch (err: any) {
    console.warn(`[CMD IMAGES] Avertissement préchargement image (${url}):`, err?.message || err);
  }
}

// Trigger preload immediately in background
preloadDefaultImageBuffer();

/**
 * Saves current configuration to disk
 */
export function saveCommandImagesToDisk(): void {
  try {
    ensureDataDir();
    const payload = {
      defaultUrl: defaultImageUrl,
      appPhotoUrl: appPhotoUrl,
      urls: commandImageUrls,
      updatedAt: new Date().toISOString(),
    };
    const content = JSON.stringify(payload, null, 2);
    fs.writeFileSync(CONFIG_FILE, content, 'utf-8');
    try {
      fs.writeFileSync(BACKUP_CONFIG_FILE, content, 'utf-8');
    } catch (_) {}
  } catch (err) {
    console.error('[CMD IMAGES] Erreur de sauvegarde command images:', err);
  }
}

/**
 * Returns the configured image URL for a given command name (falls back to defaultImageUrl)
 */
export function getCommandImageUrl(cmd: string): string {
  const clean = cmd.toLowerCase().trim().replace(/^[.!\/#$]/, '');
  if (commandImageUrls[clean] && commandImageUrls[clean].trim()) {
    return commandImageUrls[clean].trim();
  }
  return defaultImageUrl || DEFAULT_GLOBAL_IMAGE_URL;
}

/**
 * Fetches and caches the image buffer for a command.
 * Returns null if the URL is unreachable or invalid (so text can be sent without error).
 */
export async function getCommandImageBuffer(cmd: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const url = getCommandImageUrl(cmd);
  if (!url || !url.startsWith('http')) {
    return null;
  }

  // 1. Check memory cache
  const cached = bufferCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { buffer: cached.buffer, mimeType: cached.mimeType };
  }

  // 2. Fetch with short timeout (3.5s) to never delay command execution
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 3500,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (res.status === 200 && res.data) {
      const buffer = Buffer.from(res.data);
      const mimeType = String(res.headers['content-type'] || 'image/png');
      
      // Store in cache
      bufferCache.set(url, {
        buffer,
        mimeType,
        timestamp: Date.now(),
      });

      return { buffer, mimeType };
    }
  } catch (err: any) {
    console.warn(`[CMD IMAGES] Impossible de charger l'image pour .${cmd} (${url}):`, err.message || err);
  }

  return null;
}

/**
 * Sets the image URL for a specific command
 */
export function setCommandImageUrl(cmd: string, url: string): void {
  const clean = cmd.toLowerCase().trim().replace(/^[.!\/#$]/, '');
  if (!clean) return;
  
  const cleanUrl = url.trim();
  if (cleanUrl) {
    commandImageUrls[clean] = cleanUrl;
  } else {
    delete commandImageUrls[clean];
  }
  
  // Invalidate buffer cache for old url if modified
  bufferCache.delete(cleanUrl);
  saveCommandImagesToDisk();
}

/**
 * Sets multiple command image URLs at once
 */
export function setMultipleCommandImageUrls(urls: Record<string, string>): void {
  for (const [cmd, url] of Object.entries(urls)) {
    const clean = cmd.toLowerCase().trim().replace(/^[.!\/#$]/, '');
    if (clean && typeof url === 'string') {
      if (url.trim()) {
        commandImageUrls[clean] = url.trim();
      } else {
        delete commandImageUrls[clean];
      }
    }
  }
  saveCommandImagesToDisk();
}

/**
 * Updates the global default image URL
 */
export function setDefaultImageUrl(url: string): void {
  const cleanUrl = url.trim();
  if (cleanUrl) {
    defaultImageUrl = cleanUrl;
    bufferCache.delete(cleanUrl);
    saveCommandImagesToDisk();
  }
}

/**
 * Gets the configured application photo URL
 */
export function getAppPhotoUrl(): string {
  return appPhotoUrl || DEFAULT_APP_PHOTO_URL;
}

/**
 * Sets the application photo URL
 */
export function setAppPhotoUrl(url: string): void {
  const cleanUrl = url.trim();
  if (cleanUrl) {
    appPhotoUrl = cleanUrl;
    bufferCache.delete(cleanUrl);
    saveCommandImagesToDisk();
  }
}

/**
 * Applies a single image URL to ALL commands and the application globally
 */
export function applyUrlToAllCommands(url: string): void {
  const cleanUrl = url.trim() || DEFAULT_GLOBAL_IMAGE_URL;
  defaultImageUrl = cleanUrl;
  appPhotoUrl = cleanUrl;
  for (const cmd of Object.keys(commandImageUrls)) {
    commandImageUrls[cmd] = cleanUrl;
  }
  bufferCache.clear();
  saveCommandImagesToDisk();
}

/**
 * Returns all configured command images and the default URL
 */
export function getAllCommandImageUrls(): {
  defaultUrl: string;
  appPhotoUrl: string;
  urls: Record<string, string>;
  totalCommands: number;
} {
  return {
    defaultUrl: defaultImageUrl,
    appPhotoUrl: appPhotoUrl,
    urls: { ...commandImageUrls },
    totalCommands: Object.keys(commandImageUrls).length,
  };
}

/**
 * Resets all command images to the initial preset
 */
export function resetToDefaultCommandImages(): void {
  defaultImageUrl = DEFAULT_GLOBAL_IMAGE_URL;
  appPhotoUrl = DEFAULT_APP_PHOTO_URL;
  commandImageUrls = { ...INITIAL_COMMAND_IMAGE_URLS };
  bufferCache.clear();
  saveCommandImagesToDisk();
}
