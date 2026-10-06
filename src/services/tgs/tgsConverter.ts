import zlib from 'zlib';
import sharp from 'sharp';
import { createImageSticker, createAnimatedSticker } from '../../server/mediaConverter';

/**
 * Converts a Telegram sticker file buffer (.tgs Lottie JSON, .webm video, .webp image, .png, .jpg)
 * into a WhatsApp-compatible WebP sticker buffer (512x512, transparent, <= 1MB).
 */
export async function convertStickerBufferToWhatsAppSticker(
  inputBuffer: Buffer,
  filePath: string = ''
): Promise<Buffer> {
  if (!inputBuffer || inputBuffer.length === 0) {
    throw new Error('Buffer sticker vide (0 octets).');
  }

  const isWebM = filePath.endsWith('.webm') || (inputBuffer[0] === 0x1a && inputBuffer[1] === 0x45 && inputBuffer[2] === 0xdf && inputBuffer[3] === 0xa3);
  const isGzipTgs = filePath.endsWith('.tgs') || (inputBuffer[0] === 0x1f && inputBuffer[1] === 0x8b);

  // 1. WebM Video Sticker -> Animated WhatsApp Sticker
  if (isWebM) {
    try {
      const animatedWebp = await createAnimatedSticker(inputBuffer, '𝑲𝑨𝒀𝑫𝑶 𝑩𝒁𝑲 🥷', '≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿 & 𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸');
      if (animatedWebp && animatedWebp.length > 0) {
        return animatedWebp;
      }
    } catch {
      // Fallback to static frame conversion if animated fails
    }
  }

  // 2. GZIP / Lottie .tgs Sticker -> Decompress and convert
  if (isGzipTgs) {
    try {
      const decompressed = zlib.gunzipSync(inputBuffer);
      // Try sharp conversion on decompressed PNG/SVG/WebP
      const converted = await createImageSticker(decompressed, '𝑲𝑨𝒀𝑫𝑶 𝑩𝒁𝑲 🥷', '≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿 & 𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸').catch(() => null);
      if (converted && converted.length > 0) {
        return converted;
      }
    } catch {
      // Fallback to raw buffer conversion
    }
  }

  // 3. Static WebP / PNG / JPG Sticker -> Image WhatsApp Sticker
  try {
    const webpSticker = await createImageSticker(inputBuffer, '𝑲𝑨𝒀𝑫𝑶 𝑩𝒁𝑲 🥷', '≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿 & 𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸');
    if (webpSticker && webpSticker.length > 0) {
      return webpSticker;
    }
  } catch {
    // Fallback to Sharp WebP containment
  }

  // 4. Hard fallback using Sharp (Full screen, transparent background, no black borders)
  return await sharp(inputBuffer)
    .resize(512, 512, {
      fit: 'cover',
      position: 'center',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 85, alphaQuality: 100 })
    .toBuffer();
}
