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
  const dir3 = path.join(process.cwd(), 'data', 'media');
  for (const d of [dir1, dir2, dir3]) {
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
  // Check local disk image first
  const localCandidates = [
    path.join(process.cwd(), 'data', 'media', 'global_menu_image.jpg'),
    path.join(process.cwd(), 'public', 'menu_image.jpg'),
    path.join(process.cwd(), 'public', 'kaydo_bot.jpg'),
    path.join(process.cwd(), 'public', 'kaydo_bot.png'),
    path.join(process.cwd(), 'menu_image.jpg'),
  ];
  for (const lp of localCandidates) {
    if (fs.existsSync(lp)) {
      try {
        const buf = fs.readFileSync(lp);
        if (buf && buf.length > 0) {
          defaultImageBufferCache = {
            buffer: buf,
            mimeType: 'image/jpeg',
            timestamp: Date.now(),
          };
          return defaultImageBufferCache;
        }
      } catch (_) {}
    }
  }

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

    // 1. Wipe out ALL old menu videos AND old menu images from all locations so stale images are never sent
    const oldMediaFiles = [
      path.join(process.cwd(), 'data', 'media', 'global_menu_video.mp4'),
      path.join(process.cwd(), 'data', 'media', 'menu_video.mp4'),
      path.join(process.cwd(), 'data', 'media', 'command_media_menu.mp4'),
      path.join(process.cwd(), 'public', 'menu_video.mp4'),
      path.join(process.cwd(), 'public', 'command_media_menu.mp4'),
      path.join(process.cwd(), 'menu_video.mp4'),
      path.join(process.cwd(), 'command_media_menu.mp4'),
      path.join(process.cwd(), 'data', 'media', 'global_menu_image.jpg'),
      path.join(process.cwd(), 'data', 'media', 'global_menu_image.png'),
      path.join(process.cwd(), 'public', 'menu_image.jpg'),
      path.join(process.cwd(), 'public', 'menu_image.png'),
      path.join(process.cwd(), 'menu_image.jpg'),
      path.join(process.cwd(), 'menu_image.png'),
    ];
    for (const file of oldMediaFiles) {
      try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch {}
    }
    menuVideoUrl = '';

    const targetUrl = urlOrBase64.startsWith('http') ? urlOrBase64 : 'https://files.catbox.moe/9u2j5v.png';
    setDefaultImageUrl(targetUrl);
    setAppPhotoUrl(targetUrl);
    applyUrlToAllCommands(targetUrl);

    // 2. Save locally to all disk targets
    const diskTargets = [
      path.join(process.cwd(), 'data', 'media', 'global_menu_image.jpg'),
      path.join(process.cwd(), 'data', 'media', 'command_media_menu.jpg'),
      path.join(process.cwd(), 'public', 'menu_image.jpg'),
      path.join(process.cwd(), 'public', 'command_media_menu.jpg'),
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

    // 3. Save to all session directories & Clean per-session stale menu videos
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

    // 4. Update in-memory session states so all active sessions immediately serve the new image
    try {
      const { sessionStates } = await import('./commandHandler.js');
      for (const [, sState] of sessionStates.entries()) {
        sState.customMenuImageBuffer = buffer;
      }
    } catch (_) {}

    // Fully clear and override all session-specific custom menu configs/overrides
    await clearAllSessionCustomMenuOverrides().catch(() => {});
    bufferCache.clear();
    saveCommandImagesToDisk();

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
      // 1. Wipe out ALL old menu images across all locations so video takes 100% priority
      const oldImages = [
        path.join(process.cwd(), 'data', 'media', 'global_menu_image.jpg'),
        path.join(process.cwd(), 'data', 'media', 'menu_image.jpg'),
        path.join(process.cwd(), 'data', 'media', 'command_media_menu.jpg'),
        path.join(process.cwd(), 'public', 'menu_image.jpg'),
        path.join(process.cwd(), 'public', 'command_media_menu.jpg'),
        path.join(process.cwd(), 'menu_image.jpg'),
        path.join(process.cwd(), 'sessions', 'global_menu_image.jpg'),
      ];
      for (const img of oldImages) {
        try { if (fs.existsSync(img)) fs.unlinkSync(img); } catch {}
      }

      // 2. Save video to all disk targets
      const diskTargets = [
        path.join(process.cwd(), 'data', 'media', 'global_menu_video.mp4'),
        path.join(process.cwd(), 'data', 'media', 'command_media_menu.mp4'),
        path.join(process.cwd(), 'public', 'menu_video.mp4'),
        path.join(process.cwd(), 'public', 'command_media_menu.mp4'),
        path.join(process.cwd(), 'menu_video.mp4'),
      ];

      for (const t of diskTargets) {
        try {
          const dir = path.dirname(t);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(t, buffer);
        } catch (_) {}
      }

      // 3. Save to all session directories & Clean per-session stale menu images
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

      // 4. Update in-memory session states so all active sessions immediately serve the video
      try {
        const { sessionStates } = await import('./commandHandler.js');
        for (const [, sState] of sessionStates.entries()) {
          sState.customMenuImageBuffer = undefined;
        }
      } catch (_) {}

      // Fully clear and override all session-specific custom menu configs/overrides
      await clearAllSessionCustomMenuOverrides().catch(() => {});
      bufferCache.clear();
    }

    saveCommandImagesToDisk();
    console.log(`[CMD VIDEO] ✅ Vidéo du menu enregistrée avec succès (${menuVideoUrl || 'buffer local'}) !`);
    return true;
  } catch (err: any) {
    console.error('[CMD VIDEO] Erreur setGlobalMenuVideoFromUrlOrBuffer:', err?.message || err);
    return false;
  }
}

/**
 * Universal function to set media (photo or video) for ANY command (.setpingimage, .setuptimevideo, website uploads, etc.)
 * Permanently syncs across data/media/, public/, root, and all session folders.
 */
export async function setGlobalCommandMedia(cmd: string, isVideo: boolean, buffer: Buffer, customExt?: string): Promise<boolean> {
  const cleanCmd = cmd.toLowerCase().trim().replace(/^[.!\/#$]/, '');
  if (!cleanCmd || !buffer || buffer.length === 0) return false;

  bufferCache.clear();

  if (cleanCmd === 'menu' || cleanCmd === 'all') {
    if (isVideo) {
      return await setGlobalMenuVideoFromUrlOrBuffer(`data:video/mp4;base64,${buffer.toString('base64')}`);
    } else {
      return await setGlobalMenuPhotoFromUrlOrBuffer(`data:image/jpeg;base64,${buffer.toString('base64')}`);
    }
  }

  const extension = isVideo ? 'mp4' : (customExt || 'jpg');
  const SESSIONS_ROOT = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions');
  const mediaDir = path.join(process.cwd(), 'data', 'media');
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  // 1. Delete opposite media types across all folders
  const extensionsToDelete = isVideo
    ? ['jpg', 'jpeg', 'png', 'webp', 'gif']
    : ['mp4', 'mkv', 'mov', 'webm'];

  const targetDirs = [mediaDir, publicDir, process.cwd()];
  for (const dir of targetDirs) {
    for (const ext of extensionsToDelete) {
      const p = path.join(dir, `command_media_${cleanCmd}.${ext}`);
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
    }
  }

  // 2. Write to mediaDir, publicDir, process.cwd()
  const outFilename = `command_media_${cleanCmd}.${extension}`;
  for (const dir of targetDirs) {
    try {
      fs.writeFileSync(path.join(dir, outFilename), buffer);
    } catch (_) {}
  }

  // 3. Propagate to all sessions in sessions/
  if (fs.existsSync(SESSIONS_ROOT)) {
    try {
      const entries = fs.readdirSync(SESSIONS_ROOT, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const sDir = path.join(SESSIONS_ROOT, entry.name);
          for (const ext of extensionsToDelete) {
            const p = path.join(sDir, `command_media_${cleanCmd}.${ext}`);
            try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
          }
          try {
            fs.writeFileSync(path.join(sDir, outFilename), buffer);
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // 4. Update command image URL for web UI
  try {
    const { getPublicPortalUrl } = await import('./sessionManager.js');
    const portalUrl = getPublicPortalUrl();
    const mediaUrl = `${portalUrl}/public/${outFilename}`;
    setCommandImageUrl(cleanCmd, mediaUrl);
  } catch (_) {}

  return true;
}

export function getBotMenuVideoBuffer(): Buffer | null {
  const possiblePaths = [
    path.join(process.cwd(), 'data', 'media', 'global_menu_video.mp4'),
    path.join(process.cwd(), 'public', 'menu_video.mp4'),
    path.join(process.cwd(), 'menu_video.mp4'),
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

export function getBotMenuVideoPayload(): { video: Buffer | { url: string }; mimetype: string } | null {
  const possiblePaths = [
    path.join(process.cwd(), 'data', 'media', 'global_menu_video.mp4'),
    path.join(process.cwd(), 'public', 'menu_video.mp4'),
    path.join(process.cwd(), 'menu_video.mp4'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const buffer = fs.readFileSync(p);
        if (buffer && buffer.length > 0) {
          return { video: buffer, mimetype: 'video/mp4' };
        }
      } catch (err) {
        console.warn('[MENU VIDEO PAYLOAD] Error reading file:', err);
      }
    }
  }
  if (menuVideoUrl && menuVideoUrl.startsWith('http')) {
    return { video: { url: menuVideoUrl }, mimetype: 'video/mp4' };
  }
  return null;
}

export function getCommandMediaPayload(cmd: string): { video?: Buffer; image?: Buffer; mimeType: string } | null {
  const clean = cmd.toLowerCase().trim().replace(/^[.!\/#$]/, '');
  
  // 1. Check local persistent disk files first, then public and session disk files
  const searchDirs = [
    path.join(process.cwd(), 'data', 'media'),
    path.join(process.cwd(), 'public'),
    path.join(process.cwd(), 'sessions'),
    process.cwd(),
  ];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;

    const possibleVideoPath = path.join(dir, `command_media_${clean}.mp4`);
    if (fs.existsSync(possibleVideoPath)) {
      try {
        const buffer = fs.readFileSync(possibleVideoPath);
        if (buffer && buffer.length > 0) {
          return { video: buffer, mimeType: 'video/mp4' };
        }
      } catch (err) {
        console.warn('[CMD MEDIA PAYLOAD] Error reading video:', err);
      }
    }

    const possibleImgExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    for (const ext of possibleImgExtensions) {
      const possibleImgPath = path.join(dir, `command_media_${clean}.${ext}`);
      if (fs.existsSync(possibleImgPath)) {
        try {
          const buffer = fs.readFileSync(possibleImgPath);
          if (buffer && buffer.length > 0) {
            const mimeType = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;
            return { image: buffer, mimeType };
          }
        } catch (err) {
          console.warn('[CMD MEDIA PAYLOAD] Error reading image:', err);
        }
      }
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

export async function clearAllSessionCustomMenuOverrides(): Promise<void> {
  const SESSIONS_ROOT = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions');
  
  // 1. Clear PostgreSQL overrides & disk files for all found sessions
  try {
    const { setMetadataInPostgres } = await import('./postgresStore.js');
    if (fs.existsSync(SESSIONS_ROOT)) {
      const entries = fs.readdirSync(SESSIONS_ROOT, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const sId = entry.name;
          
          // Delete physical overrides
          const sessionImg = path.join(SESSIONS_ROOT, sId, 'menu_image.jpg');
          const sessionVid = path.join(SESSIONS_ROOT, sId, 'menu_video.mp4');
          try { if (fs.existsSync(sessionImg)) fs.unlinkSync(sessionImg); } catch {}
          try { if (fs.existsSync(sessionVid)) fs.unlinkSync(sessionVid); } catch {}

          // Remove base64 override from settings.json
          const settingsFile = path.join(SESSIONS_ROOT, sId, 'settings.json');
          if (fs.existsSync(settingsFile)) {
            try {
              const content = fs.readFileSync(settingsFile, 'utf8');
              const parsed = JSON.parse(content);
              if (parsed.customMenuImageBase64) {
                delete parsed.customMenuImageBase64;
                fs.writeFileSync(settingsFile, JSON.stringify(parsed, null, 2), 'utf8');
              }
            } catch {}
          }

          // Clear Postgres metadata override
          try {
            await setMetadataInPostgres(`session_menu_image_${sId}`, '');
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn('[OVERRIDE CLEANUP] Non-fatal error during Postgres/disk custom menu overrides cleanup:', err);
  }

  // 2. Clear in-memory buffers
  try {
    const { sessionStates, saveSessionSettingsToDisk } = await import('./commandHandler.js');
    const { sessions } = await import('./sessionManager.js');
    
    for (const [sId, sessState] of sessionStates.entries()) {
      sessState.customMenuImageBuffer = undefined;
      saveSessionSettingsToDisk(sId, sessState);
    }
    for (const [sId, sess] of sessions.entries()) {
      sess.customMenuImageBuffer = undefined;
    }
  } catch (importErr) {
    console.warn('[OVERRIDE CLEANUP] Non-fatal in-memory session overrides cleanup warning:', importErr);
  }
}
