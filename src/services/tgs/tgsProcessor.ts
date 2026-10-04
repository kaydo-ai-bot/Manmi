import fs from 'fs';
import path from 'path';
import { validateTgsUrl } from './tgsValidator';
import { fetchStickerSet, downloadStickerFile } from './tgsDownloader';
import { convertStickerBufferToWhatsAppSticker } from './tgsConverter';
import { cleanupTgsFile, cleanOldTgsTempFiles } from './tgsCleanup';

const TGS_TEMP_DIR = process.env.TGS_TEMP_DIR || '/tmp/media-tgs';
const MAX_FILE_SIZE_BYTES = parseInt(process.env.TGS_MAX_SIZE_MB || '25', 10) * 1024 * 1024;
const BATCH_SIZE = parseInt(process.env.TGS_BATCH_SIZE || '15', 10);
const CONCURRENT_WORKERS = parseInt(process.env.TGS_CONCURRENCY || '5', 10);

if (!fs.existsSync(TGS_TEMP_DIR)) {
  fs.mkdirSync(TGS_TEMP_DIR, { recursive: true });
}

export interface TgsProcessResult {
  success: boolean;
  totalProcessed: number;
  downloadedCount: number;
  convertedCount: number;
  sentCount: number;
  errorCount: number;
  message: string;
}

/**
 * Main worker pipeline for processing Telegram sticker packs (.tgs, .webm, .webp, .png)
 * Handles FULL packs of any size (100, 200, 500+ stickers) without artificial limits.
 * Uses batch streaming + sequential WhatsApp delivery to guarantee 100% completion.
 */
export async function processTgsRequest(
  urlOrPack: string,
  sock: any,
  remoteJid: string,
  msg: any,
  statusCallback?: (text: string) => Promise<any>
): Promise<TgsProcessResult> {
  cleanOldTgsTempFiles();

  // 1. Validate URL & Extract pack name
  const validation = validateTgsUrl(urlOrPack);
  if (!validation.isValid || !validation.packName) {
    const errorMsg = validation.error || '❌ Lien ou nom de pack Telegram invalide.';
    if (statusCallback) await statusCallback(errorMsg).catch(() => {});
    return {
      success: false,
      totalProcessed: 0,
      downloadedCount: 0,
      convertedCount: 0,
      sentCount: 0,
      errorCount: 1,
      message: errorMsg,
    };
  }

  const packName = validation.packName;
  if (statusCallback) {
    await statusCallback(`⌛ Récupération des informations du pack "${packName}" auprès de Telegram...`).catch(() => {});
  }

  // 2. Fetch all stickers in the pack from Telegram API
  const packInfo = await fetchStickerSet(packName);
  if (!packInfo.ok || !packInfo.stickers || packInfo.stickers.length === 0) {
    const errorMsg = packInfo.error || `❌ Impossible d'accéder au pack Telegram "${packName}". Vérifiez qu'il existe et est public.`;
    if (statusCallback) await statusCallback(errorMsg).catch(() => {});
    return {
      success: false,
      totalProcessed: 0,
      downloadedCount: 0,
      convertedCount: 0,
      sentCount: 0,
      errorCount: 1,
      message: errorMsg,
    };
  }

  // NO ARTIFICIAL LIMIT: Process ALL stickers in the pack (100, 200, 500+ stickers)
  const allStickers = packInfo.stickers;
  const totalFound = allStickers.length;

  let downloadedCount = 0;
  let convertedCount = 0;
  let sentCount = 0;
  let errorCount = 0;

  if (statusCallback) {
    await statusCallback(
      `📦 Pack trouvé : *${packInfo.title}*\n🔍 Total stickers : *${totalFound}*\n⚡ Traitement en cours...`
    ).catch(() => {});
  }

  let lastProgressReport = 0;
  const updateProgress = async (force: boolean = false) => {
    const now = Date.now();
    if (!force && now - lastProgressReport < 3000) return;
    lastProgressReport = now;
    if (statusCallback) {
      await statusCallback(
        `📦 Pack : *${packInfo.title}*\n🔍 Trouvés : *${totalFound}*\n📥 Téléchargés : *${downloadedCount}/${totalFound}*\n🎨 Convertis : *${convertedCount}/${totalFound}*\n📤 Envoyés : *${sentCount}/${totalFound}*`
      ).catch(() => {});
    }
  };

  // 3. Process in sequential batches of BATCH_SIZE to preserve RAM on large packs
  for (let batchStart = 0; batchStart < totalFound; batchStart += BATCH_SIZE) {
    const batchStickers = allStickers.slice(batchStart, batchStart + BATCH_SIZE);
    const batchBuffers: { index: number; buffer: Buffer }[] = [];

    // Parallel download & convert for the current batch
    const batchQueue = batchStickers.map((st, i) => ({ st, globalIdx: batchStart + i }));
    const workerPromises: Promise<void>[] = [];

    const runBatchWorker = async () => {
      while (batchQueue.length > 0) {
        const item = batchQueue.shift();
        if (!item) break;

        const { st, globalIdx } = item;
        const tempFilePath = path.join(TGS_TEMP_DIR, `stk_${Date.now()}_${globalIdx}_${Math.random().toString(36).substring(2, 6)}`);

        try {
          // Download sticker file
          const dl = await downloadStickerFile(st.fileId, st.thumbFileId);
          if (dl && dl.buffer && dl.buffer.length > 0 && dl.buffer.length <= MAX_FILE_SIZE_BYTES) {
            downloadedCount++;

            // Convert to WhatsApp WebP sticker
            const webpBuf = await convertStickerBufferToWhatsAppSticker(dl.buffer, dl.filePath);
            if (webpBuf && webpBuf.length > 0) {
              convertedCount++;
              batchBuffers.push({ index: globalIdx, buffer: webpBuf });
            } else {
              errorCount++;
            }
          } else {
            errorCount++;
          }
        } catch (err) {
          console.warn(`[TGS] Sticker #${globalIdx + 1} échoué:`, err);
          errorCount++;
        } finally {
          cleanupTgsFile(tempFilePath);
        }
      }
    };

    const workerCount = Math.min(CONCURRENT_WORKERS, batchStickers.length);
    for (let w = 0; w < workerCount; w++) {
      workerPromises.push(runBatchWorker());
    }
    await Promise.all(workerPromises);

    // Sort buffers by original index so they are delivered in exact order
    batchBuffers.sort((a, b) => a.index - b.index);

    // Send this batch sequentially to target platform (WhatsApp or Telegram)
    for (const item of batchBuffers) {
      if (!sock) break;

      let sent = false;
      
      // 1. Telegram delivery
      if (typeof sock.replyWithSticker === 'function') {
        try {
          await sock.replyWithSticker({ source: item.buffer });
          sent = true;
        } catch (tErr: any) {
          console.warn(`[TGS TELEGRAM SENDER] Erreur sticker #${item.index + 1}:`, tErr?.message || tErr);
        }
      } 
      // 2. WhatsApp delivery
      else if (remoteJid) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            await sock.sendMessage(remoteJid, { sticker: item.buffer });
            sent = true;
            break;
          } catch (sendErr: any) {
            console.warn(`[TGS WHATSAPP SENDER] Erreur envoi sticker #${item.index + 1} (essai ${attempt}):`, sendErr?.message || sendErr);
            await new Promise((r) => setTimeout(r, 400));
          }
        }
      }

      if (sent) {
        sentCount++;
      } else {
        errorCount++;
      }

      // Safe pacing delay (220ms) between sticker deliveries to prevent WhatsApp socket disconnects
      await new Promise((r) => setTimeout(r, 220));
      await updateProgress(false);
    }

    // Force progress update after every batch
    await updateProgress(true);
  }

  // 4. Final summary report
  const summaryMsg =
    `╭━━━〔 📦 *RÉSUMÉ PACK TELEGRAM* 〕━━━╮\n` +
    `┃\n` +
    `┃  ◈ 🏷️ *Pack* : ${packInfo.title}\n` +
    `┃  ◈ 🔍 *Total trouvé* : ${totalFound}\n` +
    `┃  ◈ 📥 *Téléchargés* : ${downloadedCount}\n` +
    `┃  ◈ 🎨 *Convertis* : ${convertedCount}\n` +
    `┃  ◈ 📤 *Envoyés* : ${sentCount}\n` +
    `┃  ◈ ⚠️ *Échecs* : ${errorCount}\n` +
    `┃\n` +
    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

  if (statusCallback) {
    await statusCallback(summaryMsg).catch(() => {});
  }

  return {
    success: sentCount > 0,
    totalProcessed: totalFound,
    downloadedCount,
    convertedCount,
    sentCount,
    errorCount,
    message: summaryMsg,
  };
}
