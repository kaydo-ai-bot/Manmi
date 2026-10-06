import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Sticker, createSticker, StickerTypes } from 'wa-sticker-formatter';

const execAsync = promisify(exec);

const DEFAULT_PACK_NAME = '𝑲𝑨𝒀𝑫𝑶 𝑩𝒁𝑲 🥷';
const DEFAULT_AUTHOR_NAME = '≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿 & 𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸';

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
      type: StickerTypes.CROPPED,
      categories: ['👹', '⚡', '👑'] as any,
      id: `kaydo_${Date.now()}`,
      quality: 85,
      background: 'transparent',
    });

    const buf = await sticker.toBuffer();
    if (buf && buf.length > 0) return buf;
  } catch (err) {
    console.warn('[STICKER] wa-sticker-formatter failed, falling back to sharp:', err);
  }

  // Fallback: Sharp conversion with 512x512 full-bleed cover with transparent background
  return await sharp(inputBuffer)
    .resize(512, 512, {
      fit: 'cover',
      position: 'center',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({
      quality: 85,
      alphaQuality: 100,
      lossless: false,
      effort: 4,
    })
    .toBuffer();
}

/**
 * Converts video buffer or animated GIF into an animated WhatsApp WebP sticker using ffmpeg + wa-sticker-formatter.
 * Renders full-screen without black bands and preserves transparent alpha channels.
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
      type: StickerTypes.CROPPED,
      categories: ['👹', '⚡', '👑'] as any,
      id: `kaydo_anim_${Date.now()}`,
      quality: 50,
      background: 'transparent',
    });

    const buf = await sticker.toBuffer();
    if (buf && buf.length > 0 && buf.length <= 950 * 1024) {
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

    // Full-screen crop without black bands and with yuva420p alpha transparency support
    const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -t 2.5 -vf "fps=10,scale=512:512:force_original_aspect_ratio=increase,crop=512:512" -pix_fmt yuva420p -vcodec libwebp -lossless 0 -compression_level 2 -q:v 35 -loop 0 -an "${outputPath}"`;

    await execAsync(ffmpegCmd, { timeout: 10000 });

    if (fs.existsSync(outputPath)) {
      const webpBuf = await fs.promises.readFile(outputPath);
      if (webpBuf.length <= 950 * 1024) {
        try {
          const sticker = new Sticker(webpBuf, {
            pack: packName || DEFAULT_PACK_NAME,
            author: authorName || DEFAULT_AUTHOR_NAME,
            type: StickerTypes.CROPPED,
            categories: ['👹', '⚡', '👑'] as any,
            id: `kaydo_anim_${Date.now()}`,
            background: 'transparent',
          });
          const out = await sticker.toBuffer();
          if (out && out.length <= 950 * 1024) {
            return out;
          }
        } catch (_) {}
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
      👑 𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸 👑
    </text>
  </svg>`;

  const pngBuf = await sharp(Buffer.from(svg)).png().toBuffer();
  return createImageSticker(pngBuf, packName, authorName);
}

/**
 * Converts any WebP sticker (animated or static) to a high quality MP4 video buffer.
 */
export async function convertStickerToVideo(webpBuffer: Buffer): Promise<Buffer> {
  const timestamp = Date.now();
  const inputPath = path.join(os.tmpdir(), `stk_in_${timestamp}.webp`);
  const pngPath = path.join(os.tmpdir(), `stk_frame_${timestamp}.png`);
  const gifPath = path.join(os.tmpdir(), `stk_anim_${timestamp}.gif`);
  const outputPath = path.join(os.tmpdir(), `stk_out_${timestamp}.mp4`);

  try {
    await fs.promises.writeFile(inputPath, webpBuffer);

    // Try 1: Direct FFmpeg conversion from WebP to MP4
    try {
      const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -vf "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2" -r 20 -pix_fmt yuv420p -c:v libx264 -preset ultrafast -movflags +faststart "${outputPath}"`;
      await execAsync(ffmpegCmd, { timeout: 15000 });
      if (fs.existsSync(outputPath) && (await fs.promises.stat(outputPath)).size > 500) {
        return await fs.promises.readFile(outputPath);
      }
    } catch (_) {}

    // Try 2: Convert via Sharp to animated GIF first then FFmpeg to MP4
    try {
      const gifBuffer = await sharp(webpBuffer, { animated: true }).gif().toBuffer().catch(() => null);
      if (gifBuffer && gifBuffer.length > 0) {
        await fs.promises.writeFile(gifPath, gifBuffer);
        const ffmpegGifCmd = `ffmpeg -y -i "${gifPath}" -vf "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2" -r 20 -pix_fmt yuv420p -c:v libx264 -preset ultrafast -movflags +faststart "${outputPath}"`;
        await execAsync(ffmpegGifCmd, { timeout: 15000 });
        if (fs.existsSync(outputPath) && (await fs.promises.stat(outputPath)).size > 500) {
          return await fs.promises.readFile(outputPath);
        }
      }
    } catch (_) {}

    // Try 3: Static sticker fallback (PNG frame looped for 3 seconds into MP4)
    const pngBuffer = await sharp(webpBuffer).png().toBuffer();
    await fs.promises.writeFile(pngPath, pngBuffer);
    const ffmpegStaticCmd = `ffmpeg -y -loop 1 -i "${pngPath}" -t 3 -vf "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2" -r 20 -pix_fmt yuv420p -c:v libx264 -preset ultrafast -movflags +faststart "${outputPath}"`;
    await execAsync(ffmpegStaticCmd, { timeout: 15000 });
    if (fs.existsSync(outputPath)) {
      return await fs.promises.readFile(outputPath);
    }

    throw new Error('Impossible de générer le fichier MP4 à partir du sticker.');
  } finally {
    try {
      if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath);
      if (fs.existsSync(pngPath)) await fs.promises.unlink(pngPath);
      if (fs.existsSync(gifPath)) await fs.promises.unlink(gifPath);
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


