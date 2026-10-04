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
  help: 'https://files.catbox.moe/9u2j5v.png',
  allcmd: 'https://files.catbox.moe/9u2j5v.png',
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
        if (parsed.menuVideoUrl && typeof parsed.menuVideoUrl === 'string') {
          menuVideoUrl = parsed.menuVideoUrl.trim();
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

let defaultImageBufferCache: { buffer: Buffer; mimeType: string; timestamp: number } | null = null;

// Preload the default image buffer immediately so it is instantly available in memory for all WhatsApp commands
export async function preloadDefaultImageBuffer(): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const url = defaultImageUrl || DEFAULT_GLOBAL_IMAGE_URL;
  if (!url || !url.startsWith('http')) return null;

  // Check if we already have fresh buffer
  if (defaultImageBufferCache && Date.now() - defaultImageBufferCache.timestamp < CACHE_TTL_MS) {
    return defaultImageBufferCache;
  }

  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
    if (res.status === 200 && res.data) {
      const buffer = Buffer.from(res.data);
      const mimeType = String(res.headers['content-type'] || 'image/png');
      
      defaultImageBufferCache = {
        buffer,
        mimeType,
        timestamp: Date.now(),
      };

      bufferCache.set(url, defaultImageBufferCache);
      bufferCache.set(DEFAULT_GLOBAL_IMAGE_URL, defaultImageBufferCache);
      bufferCache.set('menu', defaultImageBufferCache);
      bufferCache.set('default', defaultImageBufferCache);

      // Persist to local disk so menu is ALWAYS available even offline
      const diskTargets = [
        path.join(process.cwd(), 'public', 'menu_image.jpg'),
        path.join(process.cwd(), 'menu_image.jpg'),
        path.join(process.cwd(), 'sessions', 'global_menu_image.jpg'),
        path.join(process.cwd(), 'public', 'bot_photos', 'kaydo_bot_official.jpg'),
        path.join(process.cwd(), 'public', 'bot_photos', 'kaydo_mini_bot_menu.jpg'),
      ];

      for (const target of diskTargets) {
        try {
          const dir = path.dirname(target);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(target, buffer);
        } catch (_) {}
      }

      // Also copy to all active session dirs
      const SESSIONS_ROOT = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions');
      if (fs.existsSync(SESSIONS_ROOT)) {
        try {
          const entries = fs.readdirSync(SESSIONS_ROOT, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const sessionImgPath = path.join(SESSIONS_ROOT, entry.name, 'menu_image.jpg');
              try { fs.writeFileSync(sessionImgPath, buffer); } catch (_) {}
            }
          }
        } catch (_) {}
      }

      console.log(`[CMD IMAGES] ✅ Image officielle Catbox pré-chargée en mémoire (${(buffer.length / 1024).toFixed(1)} KB) pour 100% des commandes et sessions : ${url}`);
      return defaultImageBufferCache;
    }
  } catch (err: any) {
    console.warn(`[CMD IMAGES] Avertissement préchargement image (${url}):`, err?.message || err);
  }
  return null;
}

export function getDefaultImageBufferSync(): Buffer | null {
  if (defaultImageBufferCache?.buffer && defaultImageBufferCache.buffer.length > 0) {
    return defaultImageBufferCache.buffer;
  }
  const diskTargets = [
    path.join(process.cwd(), 'public', 'menu_image.jpg'),
    path.join(process.cwd(), 'menu_image.jpg'),
    path.join(process.cwd(), 'sessions', 'global_menu_image.jpg'),
  ];
  for (const t of diskTargets) {
    if (fs.existsSync(t)) {
      try {
        const b = fs.readFileSync(t);
        if (b.length > 0) return b;
      } catch (_) {}
    }
  }
  return null;
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
      menuVideoUrl: menuVideoUrl,
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
export function getCommandImageUrl(cmd: string): string | null {
  const clean = cmd.toLowerCase().trim().replace(/^[.!\/#$]/, '');
  if (commandImageUrls[clean] && commandImageUrls[clean].trim()) {
    return commandImageUrls[clean].trim();
  }
  if (clean === 'menu' || clean === 'help' || clean === 'allcmd' || clean === 'menuall') {
    return defaultImageUrl || DEFAULT_GLOBAL_IMAGE_URL;
  }
  return null;
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

export async function setGlobalMenuPhotoFromUrlOrBuffer(urlOrBase64: string): Promise<boolean> {
  let buffer: Buffer | null = null;
  let mimeType = 'image/jpeg';

  if (!urlOrBase64) return false;

  try {
    if (urlOrBase64.startsWith('data:image/')) {
      const matches = urlOrBase64.match(/^data:(image\/[a-zA-Z+-]+);base64,(.+)$/);
      if (matches && matches[2]) {
        mimeType = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      }
    } else if (urlOrBase64.startsWith('http')) {
      const res = await axios.get(urlOrBase64, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/*',
        },
      });
      if (res.status === 200 && res.data) {
        buffer = Buffer.from(res.data);
        mimeType = String(res.headers['content-type'] || 'image/jpeg');
      }
    }

    if (!buffer || buffer.length === 0) return false;

    const targetUrl = urlOrBase64.startsWith('http') ? urlOrBase64 : 'https://files.catbox.moe/9u2j5v.png';
    setDefaultImageUrl(targetUrl);
    setAppPhotoUrl(targetUrl);
    applyUrlToAllCommands(targetUrl);

    // Save locally to disk targets
    const diskTargets = [
      path.join(process.cwd(), 'public', 'menu_image.jpg'),
      path.join(process.cwd(), 'menu_image.jpg'),
      path.join(process.cwd(), 'sessions', 'global_menu_image.jpg'),
      path.join(process.cwd(), 'public', 'bot_photos', 'kaydo_bot_official.jpg'),
    ];

    for (const t of diskTargets) {
      try {
        const dir = path.dirname(t);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(t, buffer);
      } catch (_) {}
    }

    // Save to all session directories & Clean per-session stale menu videos
    const SESSIONS_ROOT = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions');
    if (fs.existsSync(SESSIONS_ROOT)) {
      try {
        const entries = fs.readdirSync(SESSIONS_ROOT, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const sessionImg = path.join(SESSIONS_ROOT, entry.name, 'menu_image.jpg');
            const sessionVid = path.join(SESSIONS_ROOT, entry.name, 'menu_video.mp4');
            try { fs.writeFileSync(sessionImg, buffer); } catch (_) {}
            try { if (fs.existsSync(sessionVid)) fs.unlinkSync(sessionVid); } catch {}
          }
        }
      } catch (_) {}
    }

    // Clean old video menu background to ensure image priority
    const oldVideos = [
      path.join(process.cwd(), 'public', 'menu_video.mp4'),
      path.join(process.cwd(), 'menu_video.mp4'),
      path.join(process.cwd(), 'sessions', 'global_menu_video.mp4'),
    ];
    for (const vid of oldVideos) {
      try { if (fs.existsSync(vid)) fs.unlinkSync(vid); } catch {}
    }

    try {
      const { sessionStates, saveSessionSettingsToDisk } = require('./commandHandler');
      const { sessions } = require('./sessionManager');
      for (const [sId, sessState] of sessionStates.entries()) {
        sessState.customMenuImageBuffer = undefined;
        saveSessionSettingsToDisk(sId, sessState);
      }
      for (const [sId, sess] of sessions.entries()) {
        sess.customMenuImageBuffer = undefined;
      }
    } catch (importErr) {
      console.warn('[CMD IMAGES] Non-fatal import warning during session image overrides cleanup:', importErr);
    }

    // Remove reset flags so sessions pick up the new photo immediately
    const flagFiles = [
      path.join(SESSIONS_ROOT, '.kaydo_bot_v2_sessions_catbox_refresh'),
      path.join(SESSIONS_ROOT, '.kaydo_bot_v2_sessions_reset'),
    ];
    for (const f of flagFiles) {
      if (fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch {}
      }
    }

    console.log(`[CMD IMAGES] ✅ Nouvelle photo officielle configurée et exportée sur ${diskTargets.length} emplacements et sessions !`);
    return true;
  } catch (err: any) {
    console.error('[CMD IMAGES] Erreur setGlobalMenuPhotoFromUrlOrBuffer:', err?.message || err);
    return false;
  }
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

let menuVideoUrl = '';

export function getMenuVideoUrl(): string {
  return menuVideoUrl;
}

export function setMenuVideoUrl(url: string): void {
  menuVideoUrl = url.trim();
  saveCommandImagesToDisk();
}

export async function setGlobalMenuVideoFromUrlOrBuffer(urlOrBase64: string): Promise<boolean> {
  if (!urlOrBase64) return false;
  let buffer: Buffer | null = null;

  try {
    if (urlOrBase64.startsWith('http')) {
      menuVideoUrl = urlOrBase64.trim();
      saveCommandImagesToDisk();

      try {
        const res = await axios.get(menuVideoUrl, {
          responseType: 'arraybuffer',
          timeout: 25000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'video/*',
          },
        });
        if (res.status === 200 && res.data) {
          buffer = Buffer.from(res.data);
        }
      } catch (dlErr: any) {
        console.warn('[CMD VIDEO] Warning downloading video buffer:', dlErr?.message || dlErr);
      }
    } else if (urlOrBase64.startsWith('data:video/') || urlOrBase64.startsWith('data:application/')) {
      const matches = urlOrBase64.match(/^data:([a-zA-Z0-9\/\-+]+);base64,(.+)$/);
      if (matches && matches[2]) {
        buffer = Buffer.from(matches[2], 'base64');
      }
    }

    if (buffer && buffer.length > 0) {
      const diskTargets = [
        path.join(process.cwd(), 'public', 'menu_video.mp4'),
        path.join(process.cwd(), 'menu_video.mp4'),
        path.join(process.cwd(), 'sessions', 'global_menu_video.mp4'),
      ];

      for (const t of diskTargets) {
        try {
          const dir = path.dirname(t);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(t, buffer);
        } catch (_) {}
      }

      const SESSIONS_ROOT = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions');
      if (fs.existsSync(SESSIONS_ROOT)) {
        try {
          const entries = fs.readdirSync(SESSIONS_ROOT, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const sessionVid = path.join(SESSIONS_ROOT, entry.name, 'menu_video.mp4');
              const sessionImg = path.join(SESSIONS_ROOT, entry.name, 'menu_image.jpg');
              try { fs.writeFileSync(sessionVid, buffer); } catch (_) {}
              try { if (fs.existsSync(sessionImg)) fs.unlinkSync(sessionImg); } catch {}
            }
          }
        } catch (_) {}
      }

      // Clean old image menu background to ensure video priority
      const oldImages = [
        path.join(process.cwd(), 'public', 'menu_image.jpg'),
        path.join(process.cwd(), 'menu_image.jpg'),
        path.join(process.cwd(), 'sessions', 'global_menu_image.jpg'),
      ];
      for (const img of oldImages) {
        try { if (fs.existsSync(img)) fs.unlinkSync(img); } catch {}
      }

      try {
        const { sessionStates, saveSessionSettingsToDisk } = require('./commandHandler');
        const { sessions } = require('./sessionManager');
        for (const [sId, sessState] of sessionStates.entries()) {
          sessState.customMenuImageBuffer = undefined;
          saveSessionSettingsToDisk(sId, sessState);
        }
        for (const [sId, sess] of sessions.entries()) {
          sess.customMenuImageBuffer = undefined;
        }
      } catch (importErr) {
        console.warn('[CMD VIDEO] Non-fatal import warning during session overrides cleanup:', importErr);
      }
    }

    saveCommandImagesToDisk();
    console.log(`[CMD VIDEO] ✅ Vidéo du menu enregistrée avec succès (${menuVideoUrl || 'buffer local'}) !`);
    return true;
  } catch (err: any) {
    console.error('[CMD VIDEO] Erreur setGlobalMenuVideoFromUrlOrBuffer:', err?.message || err);
    return false;
  }
}

export function getBotMenuVideoBuffer(): Buffer | null {
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'menu_video.mp4'),
    path.join(process.cwd(), 'menu_video.mp4'),
    path.join(process.cwd(), 'sessions', 'global_menu_video.mp4'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const buf = fs.readFileSync(p);
        if (buf.length > 0) return buf;
      } catch {}
    }
  }
  return null;
}

export function getBotMenuVideoPayload(): { video: { url: string }; mimetype: string } | null {
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'menu_video.mp4'),
    path.join(process.cwd(), 'menu_video.mp4'),
    path.join(process.cwd(), 'sessions', 'global_menu_video.mp4'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return { video: { url: p }, mimetype: 'video/mp4' };
    }
  }
  if (menuVideoUrl && menuVideoUrl.startsWith('http')) {
    return { video: { url: menuVideoUrl }, mimetype: 'video/mp4' };
  }
  return null;
}

export function getCommandMediaPayload(cmd: string): { video?: { url: string }; image?: { url: string }; mimeType: string } | null {
  const clean = cmd.toLowerCase().trim().replace(/^[.!\/#$]/, '');
  
  // 1. Check local public disk files first
  const publicDir = path.join(process.cwd(), 'public');
  const possibleVideoPath = path.join(publicDir, `command_media_${clean}.mp4`);
  if (fs.existsSync(possibleVideoPath)) {
    return { video: { url: possibleVideoPath }, mimeType: 'video/mp4' };
  }

  const possibleImgExtensions = ['jpg', 'jpeg', 'png', 'gif'];
  for (const ext of possibleImgExtensions) {
    const possibleImgPath = path.join(publicDir, `command_media_${clean}.${ext}`);
    if (fs.existsSync(possibleImgPath)) {
      return { image: { url: possibleImgPath }, mimeType: `image/${ext}` };
    }
  }

  // 2. Check configured URLs
  const url = getCommandImageUrl(clean);
  if (url && url.startsWith('http')) {
    const isVid = url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('.mkv') || url.toLowerCase().includes('video');
    if (isVid) {
      return { video: { url }, mimeType: 'video/mp4' };
    } else {
      return { image: { url }, mimeType: 'image/jpeg' };
    }
  }

  return null;
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
