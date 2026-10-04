import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { detectPlatform, PlatformType } from './platformDetector';
import { executeMediaDownload, DownloadResult } from './downloader';
import { cleanupDirectory } from './cleanup';

export type JobStatus =
  | 'queued'
  | 'downloading'
  | 'processing'
  | 'sending'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DownloadJob {
  jobId: string;
  sessionId: string;
  chatId: string;
  sender: string;
  url: string;
  normalizedUrl: string;
  platform: PlatformType;
  status: JobStatus;
  attempt: number;
  maxAttempts: number;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  userMessage?: string;
  filePath?: string;
  fileSizeMb?: number;
  mimeType?: string;
  fileName?: string;
  jobDir?: string;
  sock: any;
  quotedMsg?: any;
  loadingMsgKey?: any;
  statusCallback?: (text: string) => Promise<any>;
}

export interface DownloaderStats {
  jobsReceived: number;
  jobsCompleted: number;
  jobsFailed: number;
  jobsPending: number;
  jobsActive: number;
  retriesCount: number;
  cancelledCount: number;
  sendErrorCount: number;
}

class ResilientDownloadQueue extends EventEmitter {
  private queue: DownloadJob[] = [];
  private globalActiveCount = 0;
  private sessionActiveCount = new Map<string, number>();

  // Rate Limiting & Anti-Spam state
  private userRequestTimes = new Map<string, number[]>();
  private chatRequestTimes = new Map<string, number[]>();
  private dedupCache = new Map<string, { jobId: string; expiresAt: number }>();

  // Monitoring stats
  private stats: DownloaderStats = {
    jobsReceived: 0,
    jobsCompleted: 0,
    jobsFailed: 0,
    jobsPending: 0,
    jobsActive: 0,
    retriesCount: 0,
    cancelledCount: 0,
    sendErrorCount: 0,
  };

  // Configurable limits with safe defaults
  private get globalMaxConcurrency(): number {
    return parseInt(process.env.DOWNLOAD_MAX_CONCURRENCY || process.env.DOWNLOAD_CONCURRENCY || '12', 10);
  }

  private get sessionMaxConcurrency(): number {
    return parseInt(process.env.DOWNLOAD_SESSION_CONCURRENCY || '8', 10);
  }

  private get userRateLimit(): number {
    return parseInt(process.env.DOWNLOAD_USER_RATE_LIMIT || '60', 10);
  }

  private get rateWindowMs(): number {
    return parseInt(process.env.DOWNLOAD_RATE_WINDOW_MS || '60000', 10);
  }

  private get dedupTtlMs(): number {
    return parseInt(process.env.DOWNLOAD_DEDUP_TTL_MS || '2000', 10);
  }

  private get maxRetries(): number {
    return parseInt(process.env.DOWNLOAD_MAX_RETRIES || '2', 10);
  }

  private get sendTimeoutMs(): number {
    return parseInt(process.env.DOWNLOAD_SEND_TIMEOUT_MS || '60000', 10);
  }

  constructor() {
    super();
    // Periodically clean up rate limit & dedup caches every 60 seconds
    setInterval(() => this.cleanCaches(), 60000);
  }

  /**
   * Normalizes a URL to prevent duplicate downloads of the same link
   */
  public normalizeUrl(rawUrl: string): string {
    try {
      const u = new URL(rawUrl.trim());
      u.hash = '';
      u.searchParams.delete('utm_source');
      u.searchParams.delete('utm_medium');
      u.searchParams.delete('utm_campaign');
      u.searchParams.delete('igsh');
      u.searchParams.delete('fbclid');
      u.searchParams.delete('t');
      u.searchParams.delete('s');
      u.searchParams.delete('ref');
      return u.toString().toLowerCase();
    } catch {
      return rawUrl.trim().toLowerCase();
    }
  }

  /**
   * Submits a new download job to the queue with rate limiting and deduplication checks
   */
  public async enqueueJob(params: {
    sessionId: string;
    chatId: string;
    sender: string;
    url: string;
    platform?: PlatformType;
    sock: any;
    quotedMsg?: any;
    loadingMsgKey?: any;
    statusCallback?: (text: string) => Promise<any>;
  }): Promise<{ accepted: boolean; userMessage?: string; jobId?: string }> {
    const now = Date.now();
    const { sessionId, chatId, sender, url, sock, quotedMsg, loadingMsgKey, statusCallback } = params;

    // 1. Rate Limit Check per User
    const userTimes = (this.userRequestTimes.get(sender) || []).filter((t) => now - t < this.rateWindowMs);
    if (userTimes.length >= this.userRateLimit) {
      return {
        accepted: false,
        userMessage: '⏳ Trop de demandes de téléchargement. Veuillez patienter une minute avant de réessayer.',
      };
    }

    // 2. Rate Limit Check per Chat
    const chatTimes = (this.chatRequestTimes.get(chatId) || []).filter((t) => now - t < this.rateWindowMs);
    if (chatTimes.length >= 100) {
      return {
        accepted: false,
        userMessage: '⏳ Trop de téléchargements simultanés dans cette discussion. Réessayez dans un instant.',
      };
    }

    // 3. Deduplication Check
    const normUrl = this.normalizeUrl(url);
    const dedupKey = `${sender}_${normUrl}`;
    const existingDedup = this.dedupCache.get(dedupKey);
    if (existingDedup && now < existingDedup.expiresAt) {
      return {
        accepted: false,
        userMessage: '⏳ Ce lien est déjà en cours de traitement. Veuillez patienter.',
      };
    }

    // Record request timestamp & dedup cache
    userTimes.push(now);
    this.userRequestTimes.set(sender, userTimes);
    chatTimes.push(now);
    this.chatRequestTimes.set(chatId, chatTimes);

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.dedupCache.set(dedupKey, { jobId, expiresAt: now + this.dedupTtlMs });

    const detectedPlatform = params.platform || detectPlatform(normUrl);

    const job: DownloadJob = {
      jobId,
      sessionId,
      chatId,
      sender,
      url,
      normalizedUrl: normUrl,
      platform: detectedPlatform,
      status: 'queued',
      attempt: 0,
      maxAttempts: this.maxRetries,
      createdAt: now,
      sock,
      quotedMsg,
      loadingMsgKey,
      statusCallback,
    };

    this.queue.push(job);
    this.stats.jobsReceived++;
    this.stats.jobsPending = this.queue.length;

    console.log(`[DOWNLOADER] [JOB ${jobId}] [SESSION ${sessionId}] Job ajouté à la queue (Pos: ${this.queue.length})`);

    // Trigger processing
    setImmediate(() => this.processNext());

    return { accepted: true, jobId };
  }

  /**
   * Main non-blocking worker loop for processing queued download jobs
   */
  private processNext(): void {
    if (this.queue.length === 0 || this.globalActiveCount >= this.globalMaxConcurrency) {
      return;
    }

    // Multi-session fair scheduling: pick next job from a session that hasn't reached its session limit
    let jobIndex = -1;
    for (let i = 0; i < this.queue.length; i++) {
      const candidate = this.queue[i];
      const activeForSession = this.sessionActiveCount.get(candidate.sessionId) || 0;
      if (activeForSession < this.sessionMaxConcurrency) {
        jobIndex = i;
        break;
      }
    }

    if (jobIndex === -1) {
      // All queued jobs belong to sessions currently at their max session concurrency limit
      return;
    }

    const job = this.queue.splice(jobIndex, 1)[0];
    if (!job) return;

    this.globalActiveCount++;
    const currentSessionActive = this.sessionActiveCount.get(job.sessionId) || 0;
    this.sessionActiveCount.set(job.sessionId, currentSessionActive + 1);

    this.stats.jobsPending = this.queue.length;
    this.stats.jobsActive = this.globalActiveCount;

    // Execute job asynchronously in background (never blocks main loop)
    this.executeJobWithResilience(job).finally(() => {
      this.globalActiveCount = Math.max(0, this.globalActiveCount - 1);
      const updatedSessionActive = Math.max(0, (this.sessionActiveCount.get(job.sessionId) || 1) - 1);
      this.sessionActiveCount.set(job.sessionId, updatedSessionActive);

      this.stats.jobsPending = this.queue.length;
      this.stats.jobsActive = this.globalActiveCount;

      console.log(`[DOWNLOADER] [JOB ${job.jobId}] Libéré. Actifs globaux : ${this.globalActiveCount}`);

      // Continue to next job
      setImmediate(() => this.processNext());
    });
  }

  /**
   * Executes a single job with retries, timeout boundaries, and guaranteed cleanup
   */
  private async executeJobWithResilience(job: DownloadJob): Promise<void> {
    job.startedAt = Date.now();
    job.status = 'downloading';
    console.log(`[DOWNLOADER] [JOB ${job.jobId}] Démarrage du traitement...`);

    let lastResult: DownloadResult | null = null;

    while (job.attempt < job.maxAttempts) {
      job.attempt++;
      if (job.attempt > 1) {
        this.stats.retriesCount++;
        console.log(`[DOWNLOADER] [JOB ${job.jobId}] Retry ${job.attempt}/${job.maxAttempts}...`);
        await new Promise((res) => setTimeout(res, 1500 * job.attempt));
      }

      try {
        // Download step
        lastResult = await executeMediaDownload(job.url, job.sessionId, job.jobId, job.platform);

        if (!lastResult.success || !lastResult.filePath) {
          job.error = lastResult.error;
          job.userMessage = lastResult.userMessage;

          if (!lastResult.isTransientError) {
            // Non-transient error (e.g. invalid URL, size exceeded) -> Do not retry
            break;
          }
          continue; // Try next attempt if transient
        }

        // Verification step
        if (!fs.existsSync(lastResult.filePath)) {
          job.error = 'File missing after download';
          continue;
        }

        const stats = fs.statSync(lastResult.filePath);
        if (stats.size === 0) {
          job.error = 'Downloaded file is empty (0 bytes)';
          continue;
        }

        job.filePath = lastResult.filePath;
        job.jobDir = lastResult.jobDir;
        job.fileSizeMb = lastResult.fileSizeMb;
        job.mimeType = lastResult.mimeType;
        job.fileName = lastResult.fileName;

        // Sending step
        job.status = 'sending';
        const sendSuccess = await this.sendMediaWithTimeout(job);

        if (sendSuccess) {
          job.status = 'completed';
          job.finishedAt = Date.now();
          this.stats.jobsCompleted++;
          console.log(`[DOWNLOADER] [JOB ${job.jobId}] Succès total (Durée : ${((job.finishedAt - job.startedAt) / 1000).toFixed(1)}s)`);

          if (job.statusCallback) {
            await job.statusCallback(`✅ *Téléchargement réussi*\n📦 Format : ${job.platform.toUpperCase()}\n⚡ Média envoyé avec succès !`).catch(() => {});
          }
          return;
        } else {
          this.stats.sendErrorCount++;
          job.error = 'WhatsApp send failed';
        }
      } catch (err: any) {
        console.error(`[DOWNLOADER] [JOB ${job.jobId}] Exception durant la tentative ${job.attempt}:`, err?.message || err);
        job.error = err?.message || String(err);
      }
    }

    // If all retries failed or non-transient error occurred
    job.status = 'failed';
    job.finishedAt = Date.now();
    this.stats.jobsFailed++;

    const userFailMsg = job.userMessage || `❌ *Téléchargement échoué (${job.platform.toUpperCase()})*\n\nImpossible de récupérer le média. Vérifiez que le lien est valide et public, puis réessayez.`;

    let editSent = false;
    if (job.sock && job.chatId && job.loadingMsgKey) {
      const res = await job.sock.sendMessage(job.chatId, { text: userFailMsg, edit: job.loadingMsgKey }).catch(() => null);
      if (res) editSent = true;
    }

    if (!editSent && job.sock && job.chatId) {
      await job.sock.sendMessage(job.chatId, { text: userFailMsg }, { quoted: job.quotedMsg }).catch(() => {});
    }

    if (job.jobDir) {
      cleanupDirectory(job.jobDir);
    }
  }

  /**
   * Sends the prepared media to WhatsApp with socket validation and a hard send timeout
   */
  private async sendMediaWithTimeout(job: DownloadJob): Promise<boolean> {
    if (!job.sock || !job.chatId || !job.filePath || !fs.existsSync(job.filePath)) {
      console.warn(`[DOWNLOADER] [JOB ${job.jobId}] Échec envoi : socket ou fichier indisponible`);
      return false;
    }

    // Verify WhatsApp socket connection state before attempting to send
    const wsState = job.sock?.ws?.readyState;
    if (wsState !== undefined && wsState !== 1 /* OPEN */) {
      console.warn(`[DOWNLOADER] [JOB ${job.jobId}] Socket non connecté (readyState: ${wsState}), attente de reconnexion...`);
      await new Promise((res) => setTimeout(res, 2000));
      if (job.sock?.ws?.readyState !== 1) {
        console.error(`[DOWNLOADER] [JOB ${job.jobId}] Socket toujours déconnecté. Annulation envoi.`);
        return false;
      }
    }

    console.log(`[DOWNLOADER] [JOB ${job.jobId}] Envoi du média sur WhatsApp...`);

    const sendPromise = (async () => {
      const buffer = fs.readFileSync(job.filePath!);
      const isVideo = job.mimeType?.startsWith('video/');
      const isAudio = job.mimeType?.startsWith('audio/');
      const isImage = job.mimeType?.startsWith('image/');

      const captionText = `🎬 *KAYDO BOT* (${job.platform.toUpperCase()})\n⚡ Téléchargé avec succès (${(job.fileSizeMb || 0).toFixed(1)} MB)`;

      let contentPayload: any = {};
      if (isVideo) {
        contentPayload = {
          video: buffer,
          caption: captionText,
          mimetype: job.mimeType || 'video/mp4',
        };
      } else if (isAudio) {
        contentPayload = {
          audio: buffer,
          mimetype: job.mimeType || 'audio/mp4',
          ptt: false,
        };
      } else if (isImage) {
        contentPayload = {
          image: buffer,
          caption: `🖼️ *KAYDO BOT* (${job.platform.toUpperCase()})`,
        };
      } else {
        contentPayload = {
          document: buffer,
          fileName: job.fileName || `download.${job.filePath!.split('.').pop()}`,
          mimetype: job.mimeType || 'application/octet-stream',
          caption: captionText,
        };
      }

      // Safe sending with quoted message fallback
      let sentResult: any = null;
      if (job.quotedMsg && !job.quotedMsg.key?.fromMe) {
        sentResult = await job.sock.sendMessage(job.chatId, contentPayload, { quoted: job.quotedMsg }).catch(() => null);
      }
      if (!sentResult) {
        sentResult = await job.sock.sendMessage(job.chatId, contentPayload).catch(() => null);
      }

      return !!sentResult;
    })();

    // Timeout wrapper for sending media
    let timeoutTimer: any;
    const timeoutPromise = new Promise<boolean>((resolve) => {
      timeoutTimer = setTimeout(() => {
        console.warn(`[DOWNLOADER] [JOB ${job.jobId}] Timeout de l'envoi WhatsApp (> ${this.sendTimeoutMs / 1000}s)`);
        resolve(false);
      }, this.sendTimeoutMs);
    });

    try {
      return await Promise.race([sendPromise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutTimer);
      // Mandatory cleanup of job directory after send attempt
      if (job.jobDir) {
        cleanupDirectory(job.jobDir);
      }
    }
  }

  /**
   * Cleans stale entries from rate limits and dedup caches
   */
  private cleanCaches(): void {
    const now = Date.now();
    for (const [key, times] of this.userRequestTimes.entries()) {
      const validTimes = times.filter((t) => now - t < this.rateWindowMs);
      if (validTimes.length === 0) this.userRequestTimes.delete(key);
      else this.userRequestTimes.set(key, validTimes);
    }
    for (const [key, times] of this.chatRequestTimes.entries()) {
      const validTimes = times.filter((t) => now - t < this.rateWindowMs);
      if (validTimes.length === 0) this.chatRequestTimes.delete(key);
      else this.chatRequestTimes.set(key, validTimes);
    }
    for (const [key, item] of this.dedupCache.entries()) {
      if (now >= item.expiresAt) this.dedupCache.delete(key);
    }
  }

  /**
   * Returns monitoring metrics
   */
  public getStats(): DownloaderStats {
    return { ...this.stats };
  }
}

export const globalDownloadQueue = new ResilientDownloadQueue();
export function getDownloaderStats(): DownloaderStats {
  return globalDownloadQueue.getStats();
}
