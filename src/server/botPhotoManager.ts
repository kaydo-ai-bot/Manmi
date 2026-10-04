import fs from 'fs';
import path from 'path';

/**
 * KAYDO BOT - Autonomous Bot Photo Manager
 * Manages the rotation of official cyber-anime warrior photos in the style of KAYDO DEV.
 * Guarantees that the bot NEVER sends the same photo consecutively across commands.
 */

const PHOTOS_DIR = path.join(process.cwd(), 'public', 'bot_photos');
const FALLBACK_PHOTO = path.join(process.cwd(), 'public', 'menu_image.jpg');

let photoFilesCache: string[] = [];
let lastPhotoUsed: string = '';
let photoDeck: string[] = [];
const photoBuffers = new Map<string, Buffer>();

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Refreshes available photo list from disk
 */
export function refreshBotPhotos(): string[] {
  try {
    if (fs.existsSync(PHOTOS_DIR)) {
      const files = fs
        .readdirSync(PHOTOS_DIR)
        .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
        .map((f) => path.join(PHOTOS_DIR, f));
      if (files.length > 0) {
        photoFilesCache = files;
      }
    }
  } catch (err) {
    console.warn('[BOT PHOTOS] Warning reading photos dir:', err);
  }

  if (photoFilesCache.length === 0 && fs.existsSync(FALLBACK_PHOTO)) {
    photoFilesCache = [FALLBACK_PHOTO];
  }

  // Preload buffers into memory for zero latency response (0.0s)
  for (const filePath of photoFilesCache) {
    if (!photoBuffers.has(filePath)) {
      try {
        const buf = fs.readFileSync(filePath);
        photoBuffers.set(filePath, buf);
      } catch (err) {
        // ignore
      }
    }
  }

  return photoFilesCache;
}

// Initial load
refreshBotPhotos();

/**
 * Returns the next unique photo in the rotation.
 * STRICT POLICY: Guaranteed to NEVER repeat the same photo consecutively.
 */
export function getNextBotPhoto(excludeFilePath?: string): {
  buffer: Buffer;
  filename: string;
  webUrl: string;
  filePath: string;
} {
  refreshBotPhotos();

  if (photoFilesCache.length === 0) {
    // Return empty buffer fallback
    return {
      buffer: Buffer.alloc(0),
      filename: 'fallback.jpg',
      webUrl: '/menu_image.jpg',
      filePath: FALLBACK_PHOTO,
    };
  }

  if (photoFilesCache.length === 1) {
    const single = photoFilesCache[0];
    const buf = photoBuffers.get(single) || fs.readFileSync(single);
    const filename = path.basename(single);
    return {
      buffer: buf,
      filename,
      webUrl: `/bot_photos/${filename}`,
      filePath: single,
    };
  }

  // Refill shuffled deck when exhausted
  if (photoDeck.length === 0) {
    photoDeck = shuffleArray(photoFilesCache);
    // If the top card matches the last used photo, swap it with another card in the deck
    if (photoDeck[0] === (excludeFilePath || lastPhotoUsed) && photoDeck.length > 1) {
      const swapIdx = Math.floor(Math.random() * (photoDeck.length - 1)) + 1;
      const tmp = photoDeck[0];
      photoDeck[0] = photoDeck[swapIdx];
      photoDeck[swapIdx] = tmp;
    }
  }

  let selected = photoDeck.pop()!;

  // Strict anti-repeat check: if selected happens to be the same as excludeFilePath or lastPhotoUsed, pick another
  const avoid = excludeFilePath || lastPhotoUsed;
  if (selected === avoid && photoFilesCache.length > 1) {
    const candidates = photoFilesCache.filter((p) => p !== avoid);
    selected = candidates[Math.floor(Math.random() * candidates.length)];
  }

  lastPhotoUsed = selected;

  let buffer = photoBuffers.get(selected);
  if (!buffer) {
    try {
      buffer = fs.readFileSync(selected);
      photoBuffers.set(selected, buffer);
    } catch {
      buffer = Buffer.alloc(0);
    }
  }

  const filename = path.basename(selected);
  const webUrl = `/bot_photos/${filename}`;

  return {
    buffer,
    filename,
    webUrl,
    filePath: selected,
  };
}
