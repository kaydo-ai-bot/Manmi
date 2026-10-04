import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { detectPlatform, verifyPlatformMatch, PlatformType } from './platformDetector';
import { validateAndSanitizeUrl } from './downloadValidator';
import { cleanupDirectory, cleanOldTempFiles } from './cleanup';
import {
  downloadTikTokVideo,
  downloadInstagramMedia,
  downloadFacebookVideo,
  downloadTwitterMedia,
  downloadVideoMedia,
  downloadThreadsMedia,
  downloadRedditMedia,
  downloadDirectMedia,
} from '../../server/mediaDownloader';

const TEMP_BASE_DIR = process.env.DOWNLOAD_TEMP_DIR || '/tmp/kaydo-downloads';
const MAX_SIZE_MB = parseInt(process.env.DOWNLOAD_MAX_FILE_SIZE_MB || process.env.DOWNLOAD_MAX_SIZE_MB || '50', 10);
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const YTDLP_PATH = '/tmp/yt-dlp';

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  jobDir?: string;
  mimeType?: string;
  fileName?: string;
  fileSizeMb?: number;
  platform?: PlatformType;
  error?: string;
  userMessage?: string;
  isTransientError?: boolean;
}

export async function executeMediaDownload(
  rawUrl: string,
  sessionId: string,
  jobId: string,
  expectedPlatform?: PlatformType
): Promise<DownloadResult> {
  cleanOldTempFiles();
  const logPrefix = `[DOWNLOADER] [JOB ${jobId}] [SESSION ${sessionId}]`;

  // 1. Validate URL & SSRF
  const validation = validateAndSanitizeUrl(rawUrl);
  if (!validation.isValid || !validation.parsedUrl) {
    console.warn(`${logPrefix} URL invalide: ${validation.error}`);
    return {
      success: false,
      error: validation.error || 'URL invalide',
      userMessage: `❌ Lien invalide ou non sécurisé.\n\n${validation.error || 'Vérifiez l\'URL.'}`,
      isTransientError: false,
    };
  }

  const urlStr = validation.parsedUrl.toString();

  // 2. Detect platform
  const detected = detectPlatform(urlStr);
  console.log(`${logPrefix} URL détectée (${detected}): ${urlStr}`);

  if (detected === 'unknown') {
    return {
      success: false,
      error: 'Unsupported platform',
      userMessage: `❌ Plateforme non supportée.\n\nPlateformes gérées : Instagram, TikTok, YouTube, Facebook, X (Twitter).`,
      isTransientError: false,
    };
  }

  if (expectedPlatform && expectedPlatform !== 'unknown' && !verifyPlatformMatch(expectedPlatform, detected)) {
    return {
      success: false,
      error: `Platform mismatch: expected ${expectedPlatform}, got ${detected}`,
      userMessage: `❌ Ce lien ne correspond pas à la commande .${expectedPlatform}.`,
      isTransientError: false,
    };
  }

  // Create isolated job directory
  const jobDir = path.join(TEMP_BASE_DIR, sessionId || 'default', jobId);
  if (!fs.existsSync(jobDir)) {
    fs.mkdirSync(jobDir, { recursive: true });
  }

  // ENGINE 1: Dedicated Scraping APIs (High speed, direct buffer)
  try {
    console.log(`${logPrefix} Tentative via Moteur 1 (API Directe)...`);
    let apiResult: any = null;

    if (detected === 'tiktok') {
      apiResult = await downloadTikTokVideo(urlStr);
    } else if (detected === 'instagram') {
      apiResult = await downloadInstagramMedia(urlStr);
    } else if (detected === 'facebook') {
      apiResult = await downloadFacebookVideo(urlStr);
    } else if (detected === 'twitter') {
      apiResult = await downloadTwitterMedia(urlStr);
    } else if (detected === 'youtube' || detected === 'shorts') {
      apiResult = await downloadVideoMedia(urlStr);
    } else if (detected === 'threads') {
      apiResult = await downloadThreadsMedia(urlStr);
    } else if (detected === 'reddit') {
      apiResult = await downloadRedditMedia(urlStr);
    } else if (detected === 'direct') {
      apiResult = await downloadDirectMedia(urlStr);
    }

    if (apiResult && apiResult.success && apiResult.buffer && apiResult.buffer.length > 0) {
      const ext = apiResult.type === 'image' ? 'jpg' : 'mp4';
      const fileName = `media_${jobId}.${ext}`;
      const filePath = path.join(jobDir, fileName);

      fs.writeFileSync(filePath, apiResult.buffer);

      const fileSizeMb = apiResult.buffer.length / (1024 * 1024);
      console.log(`${logPrefix} Moteur 1 réussi ! Fichier créé : ${fileName} (${fileSizeMb.toFixed(2)} MB)`);

      if (apiResult.buffer.length > MAX_SIZE_BYTES) {
        cleanupDirectory(jobDir);
        return {
          success: false,
          platform: detected,
          error: 'File size exceeds limit',
          userMessage: `❌ Le fichier téléchargé est trop volumineux (${fileSizeMb.toFixed(1)} MB).\n\nLimite autorisée : ${MAX_SIZE_MB} MB.`,
          isTransientError: false,
        };
      }

      return {
        success: true,
        filePath,
        jobDir,
        fileName,
        mimeType: apiResult.mimeType || (apiResult.type === 'image' ? 'image/jpeg' : 'video/mp4'),
        fileSizeMb,
        platform: detected,
      };
    }
  } catch (apiErr: any) {
    console.warn(`${logPrefix} Moteur 1 en échec, basculement vers Moteur 2 (yt-dlp) : ${apiErr?.message || apiErr}`);
  }

  // ENGINE 2: yt-dlp Subprocess Fallback
  console.log(`${logPrefix} Téléchargement commencé via Moteur 2 (yt-dlp)...`);
  const outputTemplate = path.join(jobDir, `media_${jobId}.%(ext)s`);

  return new Promise<DownloadResult>((resolve) => {
    const timeoutMs = parseInt(process.env.DOWNLOAD_TIMEOUT_MS || '120000', 10);
    const args = [
      urlStr,
      '-o', outputTemplate,
      '--no-playlist',
      '--max-filesize', `${MAX_SIZE_MB}M`,
      '--format', 'best[filesize<50M]/best',
      '--no-warnings',
      '--prefer-free-formats',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    ];

    const binary = fs.existsSync(YTDLP_PATH) ? YTDLP_PATH : 'yt-dlp';
    const child = spawn(binary, args);
    let stderrOutput = '';

    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {}
      console.warn(`${logPrefix} Timeout du sous-processus yt-dlp (> ${timeoutMs / 1000}s)`);
      resolve({
        success: false,
        platform: detected,
        error: 'Download process timeout',
        userMessage: formatUserErrorMessage(detected, 'Délai d\'attente dépassé lors du téléchargement.'),
        isTransientError: true,
      });
    }, timeoutMs);

    child.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        console.error(`${logPrefix} yt-dlp s'est terminé avec le code ${code}. Stderr: ${stderrOutput.substring(0, 200)}`);
        const isNetworkErr = stderrOutput.includes('HTTP Error') || stderrOutput.includes('Timed out') || stderrOutput.includes('Connection refused');
        resolve({
          success: false,
          platform: detected,
          error: stderrOutput || `Exit code ${code}`,
          userMessage: formatUserErrorMessage(detected, 'Impossible d\'extraire ou de télécharger ce contenu.'),
          isTransientError: isNetworkErr,
        });
        return;
      }

      try {
        if (!fs.existsSync(jobDir)) {
          resolve({
            success: false,
            platform: detected,
            error: 'Job directory removed',
            userMessage: formatUserErrorMessage(detected, 'Dossier de travail introuvable.'),
            isTransientError: false,
          });
          return;
        }

        const files = fs.readdirSync(jobDir);
        const downloadedFile = files.find((f) => f.startsWith(`media_${jobId}`));

        if (!downloadedFile) {
          resolve({
            success: false,
            platform: detected,
            error: 'File not found after yt-dlp download',
            userMessage: formatUserErrorMessage(detected, 'Fichier introuvable après le téléchargement.'),
            isTransientError: false,
          });
          return;
        }

        const filePath = path.join(jobDir, downloadedFile);
        const stats = fs.statSync(filePath);
        const fileSizeMb = stats.size / (1024 * 1024);

        console.log(`${logPrefix} Moteur 2 réussi ! Fichier vérifié: ${downloadedFile} (${fileSizeMb.toFixed(2)} MB)`);

        if (stats.size > MAX_SIZE_BYTES) {
          cleanupDirectory(jobDir);
          resolve({
            success: false,
            platform: detected,
            error: 'File size exceeds limit',
            userMessage: `❌ Le fichier est trop volumineux (${fileSizeMb.toFixed(1)} MB).\n\nLa limite maximale autorisée est de ${MAX_SIZE_MB} MB.`,
            isTransientError: false,
          });
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        let mimeType = 'video/mp4';
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          mimeType = 'image/jpeg';
        } else if (['.mp3', '.m4a', '.ogg', '.wav'].includes(ext)) {
          mimeType = 'audio/mp4';
        }

        resolve({
          success: true,
          filePath,
          jobDir,
          fileName: downloadedFile,
          mimeType,
          fileSizeMb,
          platform: detected,
        });
      } catch (err: any) {
        console.error(`${logPrefix} Erreur de vérification du fichier:`, err);
        resolve({
          success: false,
          platform: detected,
          error: err?.message || String(err),
          userMessage: formatUserErrorMessage(detected, 'Erreur lors du traitement du fichier.'),
          isTransientError: false,
        });
      }
    });
  });
}

function formatUserErrorMessage(platform: PlatformType, detail: string): string {
  const name = platform.charAt(0).toUpperCase() + platform.slice(1);
  return `❌ Impossible de télécharger ce contenu ${name}.\n\nRaisons possibles :\n• Le lien est privé, expiré ou supprimé\n• ${name} restreint temporairement l'accès\n• ${detail}\n\n👉 Vérifiez que le lien est public et réessayez.`;
}

export async function downloadMedia(rawUrl: string, expectedPlatform?: PlatformType): Promise<DownloadResult> {
  const jobId = `legacy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  return executeMediaDownload(rawUrl, 'default', jobId, expectedPlatform);
}
