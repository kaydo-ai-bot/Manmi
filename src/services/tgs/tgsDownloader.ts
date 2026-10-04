import axios from 'axios';

const DEFAULT_FALLBACK_BOT_TOKEN = '8762632930:AAENGSAJMlP3COqDJ6FRdTBYJs52JDa384c';

export interface TelegramStickerMetadata {
  fileId: string;
  thumbFileId?: string;
  emoji?: string;
  isAnimated?: boolean;
  isVideo?: boolean;
  fileSize?: number;
}

export interface TelegramStickerSetResult {
  ok: boolean;
  title: string;
  name: string;
  isAnimated: boolean;
  isVideo: boolean;
  stickers: TelegramStickerMetadata[];
  error?: string;
}

export interface TelegramDownloadedFile {
  buffer: Buffer;
  filePath: string;
  ext: string;
}

/**
 * Retrieves Telegram Bot Token from environment or uses default verified public token
 */
export function getTelegramBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (token && token.length > 10 && token.includes(':')) {
    return token;
  }
  return DEFAULT_FALLBACK_BOT_TOKEN;
}

/**
 * Fetches the sticker set information and sticker metadata from Telegram Bot API in a single HTTP request (< 300ms)
 */
export async function fetchStickerSet(packName: string): Promise<TelegramStickerSetResult> {
  const token = getTelegramBotToken();
  const url = `https://api.telegram.org/bot${token}/getStickerSet?name=${encodeURIComponent(packName)}`;

  try {
    const res = await axios.get(url, { timeout: 15000 });
    const data = res.data;

    if (data && data.ok && data.result && Array.isArray(data.result.stickers)) {
      const result = data.result;
      const stickers: TelegramStickerMetadata[] = result.stickers
        .map((st: any) => ({
          fileId: st.file_id,
          thumbFileId: st.thumbnail?.file_id || st.thumb?.file_id,
          emoji: st.emoji || '📌',
          isAnimated: !!st.is_animated,
          isVideo: !!st.is_video,
          fileSize: st.file_size,
        }))
        .filter((st: TelegramStickerMetadata) => !!st.fileId);

      return {
        ok: true,
        title: result.title || packName,
        name: result.name || packName,
        isAnimated: !!result.is_animated,
        isVideo: !!result.is_video,
        stickers,
      };
    }

    const desc = data?.description || 'Pack Telegram introuvable ou privé.';
    return {
      ok: false,
      title: packName,
      name: packName,
      isAnimated: false,
      isVideo: false,
      stickers: [],
      error: `❌ Impossible d'accéder au pack "${packName}" : ${desc}`,
    };
  } catch (err: any) {
    const errMsg = err?.response?.data?.description || err?.message || 'Erreur de connexion à Telegram';
    return {
      ok: false,
      title: packName,
      name: packName,
      isAnimated: false,
      isVideo: false,
      stickers: [],
      error: `❌ Erreur API Telegram (${packName}) : ${errMsg}`,
    };
  }
}

/**
 * Calls `getFile` and downloads the sticker binary buffer from Telegram CDN
 */
export async function downloadStickerFile(
  fileId: string,
  thumbFileId?: string
): Promise<TelegramDownloadedFile> {
  const token = getTelegramBotToken();
  let targetFileId = fileId;
  let fileRes: any = null;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      fileRes = await axios.get(`https://api.telegram.org/bot${token}/getFile?file_id=${targetFileId}`, { timeout: 15000 });
      if (fileRes?.data?.ok && fileRes.data.result?.file_path) {
        break;
      }
    } catch (e: any) {
      const status = e.response?.status;
      if (status === 429) {
        const retryAfterSec = e.response?.data?.parameters?.retry_after || 2;
        await new Promise((r) => setTimeout(r, (retryAfterSec + 1) * 1000));
      } else if (attempt === 1 && thumbFileId && targetFileId === fileId) {
        targetFileId = thumbFileId;
        await new Promise((r) => setTimeout(r, 300));
      } else {
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
  }

  if (!fileRes?.data?.ok || !fileRes?.data?.result?.file_path) {
    if (thumbFileId && targetFileId !== thumbFileId) {
      try {
        targetFileId = thumbFileId;
        fileRes = await axios.get(`https://api.telegram.org/bot${token}/getFile?file_id=${targetFileId}`, { timeout: 12000 });
      } catch (_) {}
    }
  }

  if (!fileRes?.data?.ok || !fileRes?.data?.result?.file_path) {
    throw new Error('Telegram getFile API did not return a valid file_path.');
  }

  let filePath = fileRes.data.result.file_path;

  // If the file path is .tgs (Lottie vector) and a rendered image thumbnail exists, use the thumbnail
  if (filePath.endsWith('.tgs') && thumbFileId) {
    try {
      const thumbRes = await axios.get(`https://api.telegram.org/bot${token}/getFile?file_id=${thumbFileId}`, { timeout: 10000 });
      if (thumbRes?.data?.ok && thumbRes.data.result?.file_path) {
        filePath = thumbRes.data.result.file_path;
      }
    } catch (_) {}
  }

  const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

  let downloadRes: any = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      downloadRes = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 20000,
      });
      if (downloadRes?.data && downloadRes.data.byteLength > 0) break;
    } catch (err: any) {
      if (err.response?.status === 429) {
        const retryAfterSec = err.response?.data?.parameters?.retry_after || 2;
        await new Promise((r) => setTimeout(r, (retryAfterSec + 1) * 1000));
      } else {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }

  if (!downloadRes?.data || downloadRes.data.byteLength === 0) {
    throw new Error('Downloaded sticker binary buffer is empty.');
  }

  const buffer = Buffer.from(downloadRes.data);
  const ext = filePath.split('.').pop()?.toLowerCase() || 'webp';

  return {
    buffer,
    filePath,
    ext,
  };
}
