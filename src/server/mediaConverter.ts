import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Sticker, createSticker, StickerTypes } from 'wa-sticker-formatter';

const execAsync = promisify(exec);

const DEFAULT_PACK_NAME = '𝐙𝐋𝐊 𝐁𝐎𝐓 𓃶';
const DEFAULT_AUTHOR_NAME = '𝐊𝐀𝐘𝐃𝐎 𝐙𝐋𝐊 𓃶 & 𝐒𝐇𝐀𝐊𝐀 𝐙𝐋𝐊 𓃶';

/**
 * Converts any input image Buffer (JPG, PNG, GIF, BMP, WEBP, TIFF, SVG) into a high quality 512x512 WhatsApp WebP sticker
 * with full WhatsApp client compatibility (Android, iOS, Web) so it never fails to download.
 */
export async function createImageSticker(
  inputBuffer: Buffer,
  packName: string = DEFAULT_PACK_NAME,
  authorName: string = DEFAULT_AUTHOR_NAME
): Promise<Buffer> {
  try {
    const sticker = new Sticker(inputBuffer, {
      pack: packName || DEFAULT_PACK_NAME,
      author: authorName || DEFAULT_AUTHOR_NAME,
      type: StickerTypes.DEFAULT,
      categories: ['👹', '⚡', '👑'] as any,
      id: `kaydo_${Date.now()}`,
      quality: 80,
      background: 'transparent',
    });

    return await sticker.toBuffer();
  } catch (err) {
    console.warn('[STICKER] wa-sticker-formatter failed, falling back to sharp:', err);
    // Fallback: Sharp conversion with 512x512 transparent containment
    const resizedWebp = await sharp(inputBuffer)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({
        quality: 80,
        lossless: false,
        effort: 4,
      })
      .toBuffer();

    return resizedWebp;
  }
}

/**
 * Converts video buffer or animated GIF into an animated WhatsApp WebP sticker using ffmpeg + wa-sticker-formatter.
 */
export async function createAnimatedSticker(
  videoBuffer: Buffer,
  packName: string = DEFAULT_PACK_NAME,
  authorName: string = DEFAULT_AUTHOR_NAME
): Promise<Buffer> {
  try {
    const sticker = new Sticker(videoBuffer, {
      pack: packName || DEFAULT_PACK_NAME,
      author: authorName || DEFAULT_AUTHOR_NAME,
      type: StickerTypes.DEFAULT,
      categories: ['👹', '⚡', '👑'] as any,
      id: `kaydo_anim_${Date.now()}`,
      quality: 50,
      background: 'transparent',
    });

    const buf = await sticker.toBuffer();
    if (buf && buf.length > 0 && buf.length <= 900 * 1024) {
      return buf;
    }
  } catch (err) {
    console.warn('[STICKER] wa-sticker-formatter animated failed or oversized, falling back to ffmpeg:', err);
  }

  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `stk_in_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`);
  const outputPath = path.join(tmpDir, `stk_out_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`);

  try {
    await fs.promises.writeFile(inputPath, videoBuffer);

    // Fast animated WebP compression: max 2s, 8 fps, 280x280 scale, q:v 25, compression_level 1
    const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -t 2.0 -vf "fps=8,scale=280:280:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -vcodec libwebp -lossless 0 -compression_level 1 -q:v 25 -loop 0 -an "${outputPath}"`;

    await execAsync(ffmpegCmd, { timeout: 8000 });

    if (fs.existsSync(outputPath)) {
      const webpBuf = await fs.promises.readFile(outputPath);
      if (webpBuf.length <= 950 * 1024) {
        const sticker = new Sticker(webpBuf, {
          pack: packName || DEFAULT_PACK_NAME,
          author: authorName || DEFAULT_AUTHOR_NAME,
          type: StickerTypes.DEFAULT,
          categories: ['👹', '⚡', '👑'] as any,
          id: `kaydo_anim_${Date.now()}`,
        });
        const out = await sticker.toBuffer();
        if (out && out.length <= 950 * 1024) {
          return out;
        }
        return webpBuf;
      }
    }
    throw new Error('FFmpeg failed or output exceeds WhatsApp 1MB limit');
  } catch (e) {
    console.warn('[STICKER] Animated sticker fallback to static frame:', e);
    return createImageSticker(videoBuffer, packName, authorName);
  } finally {
    try {
      if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath);
      if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath);
    } catch {}
  }
}

/**
 * Converts a WebP sticker back to a PNG / JPEG image buffer.
 */
export async function convertStickerToImage(webpBuffer: Buffer): Promise<Buffer> {
  return await sharp(webpBuffer)
    .png({ quality: 95 })
    .toBuffer();
}

/**
 * Generates an official styled text sticker buffer formatted for WhatsApp.
 */
export async function createTextSticker(
  text: string,
  packName: string = DEFAULT_PACK_NAME,
  authorName: string = DEFAULT_AUTHOR_NAME
): Promise<Buffer> {
  const safeText = escapeXml(text.slice(0, 80));
  const svg = `
  <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:1" />
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.6"/>
      </filter>
    </defs>
    <rect width="472" height="472" x="20" y="20" rx="36" fill="#0f172a" stroke="url(#grad)" stroke-width="6" filter="url(#shadow)"/>
    <text x="256" y="260" text-anchor="middle" fill="#ffffff" font-size="32" font-family="sans-serif" font-weight="bold" filter="url(#shadow)">
      ${safeText}
    </text>
    <text x="256" y="450" text-anchor="middle" fill="#fca5a5" font-size="14" font-family="sans-serif" font-weight="bold" letter-spacing="2">
      👑 SHAKA ZLK 👑
    </text>
  </svg>`;

  const pngBuf = await sharp(Buffer.from(svg)).png().toBuffer();
  return createImageSticker(pngBuf, packName, authorName);
}

/**
 * Converts an animated WebP sticker to an MP4 video buffer.
 */
export async function convertStickerToVideo(webpBuffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `stk_in_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`);
  const outputPath = path.join(tmpDir, `stk_out_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`);

  try {
    await fs.promises.writeFile(inputPath, webpBuffer);
    const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -pix_fmt yuv420p -c:v libx264 -movflags +faststart "${outputPath}"`;
    await execAsync(ffmpegCmd, { timeout: 15000 });
    if (fs.existsSync(outputPath)) {
      return await fs.promises.readFile(outputPath);
    }
    throw new Error('FFmpeg failed to output MP4 video');
  } finally {
    try {
      if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath);
      if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath);
    } catch {}
  }
}

function escapeXml(str: string): string {
  return str.replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  }[c] || c));
}


