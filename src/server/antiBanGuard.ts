/**
 * 🥷 KAYDO BOT 🌪️ - Enterprise Anti-Ban, Anti-Spam, Rate Limiting & Safety Engine
 * 
 * Strict protections to guarantee the bot NEVER spams WhatsApp accounts,
 * prevents bans and restrictions (403/429), handles opt-outs, deduplicates events,
 * throttles outgoing traffic, and maintains real-time system metrics.
 */

import fs from 'fs';
import path from 'path';

// ----------------------------------------------------
// 1. UPTIME & RUNTIME FORMATTER (Jour / Heure / Minute)
// ----------------------------------------------------
export function formatUptimeDHM(uptimeSec: number): string {
  const sec = Math.max(0, Math.floor(uptimeSec));
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);

  const dStr = `${days} Jour${days > 1 ? 's' : ''}`;
  const hStr = `${hours} Heure${hours > 1 ? 's' : ''}`;
  const mStr = `${minutes} Minute${minutes > 1 ? 's' : ''}`;

  return `${dStr} / ${hStr} / ${mStr}`;
}

export function formatUptimeDHMS(uptimeSec: number): string {
  const sec = Math.max(0, Math.floor(uptimeSec));
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  const dStr = `${days} Jour${days > 1 ? 's' : ''}`;
  const hStr = `${hours} Heure${hours > 1 ? 's' : ''}`;
  const mStr = `${minutes} Minute${minutes > 1 ? 's' : ''}`;

  return `${dStr} / ${hStr} / ${mStr} (${seconds}s)`;
}

// ----------------------------------------------------
// 2. REAL-TIME METRICS & TELEMETRY
// ----------------------------------------------------
export interface BotMetrics {
  messagesSent: number;
  messagesFailed: number;
  messagesBlocked: number;
  errorsDetected: number;
  circuitBreakerTrips: number;
  activeSessions: number;
  optOutCount: number;
  startTime: number;
  uptimeDHM: string;
  systemHealth: 'EXCELLENT' | 'NOMINAL' | 'CAUTION' | 'RESTRICTED';
  isCircuitBreakerActive: boolean;
  circuitBreakerCooldownRemainingMs: number;
}

export interface SystemEventLog {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'spam_blocked';
  category: 'ANTI_SPAM' | 'CONNECTION' | 'MESSAGE' | 'COMMAND' | 'OPT_OUT' | 'SECURITY';
  message: string;
  target?: string;
}

const metricsState = {
  messagesSent: 0,
  messagesFailed: 0,
  messagesBlocked: 0,
  errorsDetected: 0,
  circuitBreakerTrips: 0,
  startTime: Date.now(),
};

const recentEventLogs: SystemEventLog[] = [];
const MAX_LOGS = 200;

export function recordLogEvent(
  level: SystemEventLog['level'],
  category: SystemEventLog['category'],
  message: string,
  target?: string
) {
  const log: SystemEventLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    target,
  };
  recentEventLogs.unshift(log);
  if (recentEventLogs.length > MAX_LOGS) {
    recentEventLogs.pop();
  }
  return log;
}

export function recordMessageSent() {
  metricsState.messagesSent++;
}

export function recordMessageFailed(reason?: string, target?: string) {
  metricsState.messagesFailed++;
  metricsState.errorsDetected++;
  recordLogEvent('error', 'MESSAGE', `Échec d'envoi de message: ${reason || 'Inconnu'}`, target);
}

export function recordMessageBlocked(reason: string, target?: string) {
  metricsState.messagesBlocked++;
  recordLogEvent('spam_blocked', 'ANTI_SPAM', `Message bloqué par l'anti-spam: ${reason}`, target);
}

export function recordErrorDetected(errorMsg: string, category: SystemEventLog['category'] = 'SECURITY', target?: string) {
  metricsState.errorsDetected++;
  recordLogEvent('error', category, errorMsg, target);
}

export function getRecentEventLogs(limit: number = 50, filterLevel?: string): SystemEventLog[] {
  if (filterLevel && filterLevel !== 'all') {
    return recentEventLogs.filter((l) => l.level === filterLevel).slice(0, limit);
  }
  return recentEventLogs.slice(0, limit);
}

// ----------------------------------------------------
// 3. PERSISTENT DÉSINCRIPTION / OPT-OUT LIST
// ----------------------------------------------------
const OPT_OUT_FILE = path.join(process.cwd(), 'data', 'opt_out_list.json');

function loadOptOutList(): Set<string> {
  const set = new Set<string>();
  try {
    const dir = path.dirname(OPT_OUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(OPT_OUT_FILE)) {
      const raw = fs.readFileSync(OPT_OUT_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item) set.add(cleanJidOrPhone(String(item)));
        }
      }
    }
  } catch (err) {
    console.warn('[OPT-OUT] Attention chargement opt-out:', err);
  }
  return set;
}

function saveOptOutList(set: Set<string>) {
  try {
    const dir = path.dirname(OPT_OUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(OPT_OUT_FILE, JSON.stringify(Array.from(set), null, 2), 'utf8');
  } catch (err) {
    console.error('[OPT-OUT] Erreur sauvegarde opt-out:', err);
  }
}

function cleanJidOrPhone(input: string): string {
  if (!input) return '';
  return input.split('@')[0].split(':')[0].replace(/\D/g, '');
}

const optOutSet = loadOptOutList();

export function isUserOptedOut(jidOrPhone: string): boolean {
  if (!jidOrPhone) return false;
  const clean = cleanJidOrPhone(jidOrPhone);
  if (!clean || clean.length < 5) return false;
  return optOutSet.has(clean);
}

export function addOptOutUser(jidOrPhone: string, reason: string = 'User request (STOP)'): boolean {
  const clean = cleanJidOrPhone(jidOrPhone);
  if (!clean || clean.length < 5) return false;
  if (!optOutSet.has(clean)) {
    optOutSet.add(clean);
    saveOptOutList(optOutSet);
    recordLogEvent('info', 'OPT_OUT', `Numéro +${clean} ajouté à la liste de désinscription (${reason})`, clean);
    return true;
  }
  return false;
}

export function removeOptOutUser(jidOrPhone: string): boolean {
  const clean = cleanJidOrPhone(jidOrPhone);
  if (!clean) return false;
  if (optOutSet.has(clean)) {
    optOutSet.delete(clean);
    saveOptOutList(optOutSet);
    recordLogEvent('info', 'OPT_OUT', `Numéro +${clean} réactivé depuis la liste de désinscription`, clean);
    return true;
  }
  return false;
}

export function getAllOptOutList(): string[] {
  return Array.from(optOutSet);
}

// ----------------------------------------------------
// 4. CIRCUIT BREAKER FOR WHATSAPP RESTRICTION SIGNALS
// ----------------------------------------------------
let circuitBreakerUntil = 0;

export function tripCircuitBreaker(cooldownMs: number = 30000, reason: string = 'WhatsApp restriction detected (429/403)') {
  circuitBreakerUntil = Math.max(circuitBreakerUntil, Date.now() + cooldownMs);
  metricsState.circuitBreakerTrips++;
  metricsState.errorsDetected++;
  recordLogEvent('warn', 'SECURITY', `⚠️ Circuit breaker déclenché : pause de sécurité de ${Math.round(cooldownMs / 1000)}s (${reason})`);
  console.warn(`[CIRCUIT-BREAKER] 🛡️ Pause de sécurité globale de ${Math.round(cooldownMs / 1000)}s activée (${reason})`);
}

export function isCircuitBreakerActive(): boolean {
  return Date.now() < circuitBreakerUntil;
}

export function getCircuitBreakerCooldownRemaining(): number {
  return Math.max(0, circuitBreakerUntil - Date.now());
}

// ----------------------------------------------------
// 5. ANTI-BAN OUTGOING QUEUE & HUMAN-LIKE PACING
// ----------------------------------------------------
interface QueuedMessageTask {
  fn: () => Promise<any>;
  resolve: (val: any) => void;
  reject: (err: any) => void;
  destJid: string;
  queuedAt: number;
}

export class SessionOutgoingQueue {
  private queue: QueuedMessageTask[] = [];
  private isProcessing = false;
  private lastSentTime = 0;
  private jidMessageTimestamps = new Map<string, number[]>();
  private globalMessageTimestamps: number[] = [];

  constructor(private sessionId: string) {}

  public enqueue<T = any>(destJid: string, fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // 1. Protection contre les envois aux numéros désinscrits
      if (isUserOptedOut(destJid)) {
        recordMessageBlocked('Destinataire désinscrit (Opt-Out)', destJid);
        console.log(`[OPT-OUT] 🛑 Envoi bloqué pour ${destJid} : numéro dans la liste de désinscription.`);
        return resolve(null as any);
      }

      // 2. Sécurité mémoire : Évite l'accumulation de plus de 80 tâches en attente
      if (this.queue.length >= 80) {
        const dropped = this.queue.shift();
        dropped?.resolve(null);
        recordMessageBlocked('File d\'attente saturée (> 80 tâches)', destJid);
      }

      this.queue.push({
        fn,
        resolve,
        reject,
        destJid,
        queuedAt: Date.now(),
      });

      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing) return;
    if (this.queue.length === 0) return;

    this.isProcessing = true;
    const task = this.queue.shift();

    if (!task) {
      this.isProcessing = false;
      return;
    }

    try {
      // Double check opt-out before dispatching
      if (isUserOptedOut(task.destJid)) {
        recordMessageBlocked('Destinataire désinscrit (Opt-Out)', task.destJid);
        task.resolve(null);
        this.isProcessing = false;
        if (this.queue.length > 0) setTimeout(() => this.processNext(), 50);
        return;
      }

      // Check Circuit Breaker
      if (isCircuitBreakerActive()) {
        const remaining = getCircuitBreakerCooldownRemaining();
        console.warn(`[CIRCUIT-BREAKER] ⏳ Tâche retardée de ${remaining}ms pour protéger le numéro.`);
        await new Promise((r) => setTimeout(r, Math.min(remaining, 5000)));
      }

      const now = Date.now();

      // Clean old timestamps (older than 60s)
      this.globalMessageTimestamps = this.globalMessageTimestamps.filter((t) => now - t < 60000);
      const jidTimestamps = (this.jidMessageTimestamps.get(task.destJid) || []).filter(
        (t) => now - t < 20000
      );

      // Per-JID flood protection (max 5 messages per 20 seconds to same chat)
      if (jidTimestamps.length >= 5) {
        console.warn(`[ANTI-BAN] 🛡️ Throttle pour ${task.destJid} sur ${this.sessionId}: cadence ralentie.`);
        recordLogEvent('warn', 'ANTI_SPAM', `Throttle temporaire activé pour ${task.destJid} (cadence trop rapide)`, task.destJid);
        await new Promise((r) => setTimeout(r, 2200));
      }

      // Global session flood protection (max 25 messages per minute)
      if (this.globalMessageTimestamps.length >= 25) {
        console.warn(`[ANTI-BAN] 🛡️ Limite globale atteinte pour ${this.sessionId}. Pause de sécurité 3s.`);
        recordLogEvent('warn', 'ANTI_SPAM', `Limite globale atteinte pour la session ${this.sessionId}. Pause de 3s.`);
        await new Promise((r) => setTimeout(r, 3000));
      }

      // Enforce human-like delay between messages (minimum 850ms - 1350ms + jitter)
      const elapsedSinceLast = Date.now() - this.lastSentTime;
      const targetMinDelay = 850 + Math.floor(Math.random() * 500); // 850ms - 1350ms
      if (elapsedSinceLast < targetMinDelay) {
        const waitMs = targetMinDelay - elapsedSinceLast;
        await new Promise((r) => setTimeout(r, waitMs));
      }

      const res = await task.fn();
      this.lastSentTime = Date.now();
      this.globalMessageTimestamps.push(this.lastSentTime);

      jidTimestamps.push(this.lastSentTime);
      this.jidMessageTimestamps.set(task.destJid, jidTimestamps);

      recordMessageSent();
      task.resolve(res);
    } catch (err: any) {
      const errStr = String(err?.message || err);
      // Détection des restrictions WhatsApp (429 rate limit ou 403 interdit)
      if (errStr.includes('429') || errStr.includes('rate-overlimit') || errStr.includes('rate limit')) {
        tripCircuitBreaker(45000, 'WhatsApp 429 Rate Limit détecté');
      } else if (errStr.includes('403') || errStr.includes('Forbidden')) {
        tripCircuitBreaker(60000, 'WhatsApp 403 Forbidden/Restriction détectée');
      }

      recordMessageFailed(errStr, task.destJid);
      task.reject(err);
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        setTimeout(() => this.processNext(), 60);
      }
    }
  }
}

const sessionQueues = new Map<string, SessionOutgoingQueue>();

export function getSessionOutgoingQueue(sessionId: string): SessionOutgoingQueue {
  let q = sessionQueues.get(sessionId);
  if (!q) {
    q = new SessionOutgoingQueue(sessionId);
    sessionQueues.set(sessionId, q);
  }
  return q;
}

// ----------------------------------------------------
// 6. ECHO LOOP & SELF-SPAM DETECTION
// ----------------------------------------------------
const knownBotOutputSignatures = [
  '*╭─━━━━━━━━━━━━━━━⊷❖*',
  '╭─━━━━━━━━━━━━━━━⊷❖',
  '*╭─❖━━━',
  '╭─❖━━━',
  '╭─❖━━━ ᴄᴏᴍᴍᴀɴᴅᴇ ━━━❖',
  '┇✦╭───────────────',
  '┇✦┋.',
  '┋✧┋. ʙᴏᴛ ɴᴀᴍᴇ:',
  '┋✧┋. ʙᴏᴛ:',
  '> *©',
  '⏱️ *Runtime / Uptime*',
  '⏱️ *ʀᴜɴᴛɪᴍᴇ / ᴜᴘᴛɪᴍᴇ*',
  '⚡ <b>ᴘᴏɴɢ !</b>',
  '⚡ *ᴘᴏɴɢ !*',
  '🥷 𝑲𝑨𝒀𝑫𝑶 𝑩𝒁𝑲 🌪️',
  '🥷𝑩𝒁𝑲 𝑩𝑶𝑻 🌪️',
  '≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿',
  '✨ *≛⃝🥷🏿',
  '╭━━━〔 🤖 *ZLK AI',
  '╭━━━〔',
];

export function isBotSelfReplyOrEcho(text: string | undefined): boolean {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  for (const sig of knownBotOutputSignatures) {
    if (t.includes(sig)) {
      return true;
    }
  }
  return false;
}

// ----------------------------------------------------
// 7. DUPLICATE MESSAGE & EVENT DEDUPLICATION (LRU)
// ----------------------------------------------------
const processedMessageIds = new Map<string, number>();
const MAX_PROCESSED_CACHE = 10000;
const TTL_PROCESSED_MS = 5 * 60 * 1000; // 5 minutes

export function isDuplicateEventOrMessage(messageId: string): boolean {
  if (!messageId) return false;
  const now = Date.now();
  const existing = processedMessageIds.get(messageId);
  if (existing && now - existing < TTL_PROCESSED_MS) {
    recordMessageBlocked(`Message/Événement dupliqué (${messageId})`);
    return true;
  }

  // Trim cache if too large
  if (processedMessageIds.size > MAX_PROCESSED_CACHE) {
    const oldestKey = processedMessageIds.keys().next().value;
    if (oldestKey) processedMessageIds.delete(oldestKey);
  }

  processedMessageIds.set(messageId, now);
  return false;
}

// ----------------------------------------------------
// 8. ANTI-SPAM COMMAND RATE LIMITER
// ----------------------------------------------------
const senderLastCommandTimes = new Map<string, number>();
const senderCommandCounts = new Map<string, { count: number; windowStart: number }>();
const groupLastCommandTimes = new Map<string, number>();

export function checkAntiSpamCommand(
  senderJid: string,
  chatJid: string
): { allowed: boolean; reason?: string } {
  const now = Date.now();

  // 0. Check circuit breaker
  if (isCircuitBreakerActive()) {
    recordMessageBlocked('Circuit breaker de sécurité actif suite à restriction WhatsApp', senderJid);
    return { allowed: false, reason: 'Circuit breaker active (Safety pause)' };
  }

  // 1. Group level rate limit (max 1 command every 1.4s per group)
  if (chatJid.endsWith('@g.us')) {
    const lastGroupCmd = groupLastCommandTimes.get(chatJid) || 0;
    if (now - lastGroupCmd < 1400) {
      recordMessageBlocked('Délai anti-flood de groupe (1.4s)', chatJid);
      return { allowed: false, reason: 'Group command cooldown' };
    }
    groupLastCommandTimes.set(chatJid, now);
  }

  // 2. Sender level rate limit (max 1 command every 1.6s per user)
  const lastUserCmd = senderLastCommandTimes.get(senderJid) || 0;
  if (now - lastUserCmd < 1600) {
    recordMessageBlocked('Délai anti-spam individuel (1.6s)', senderJid);
    return { allowed: false, reason: 'User command cooldown' };
  }
  senderLastCommandTimes.set(senderJid, now);

  // 3. Sender burst check (max 5 commands in 10s)
  let tracker = senderCommandCounts.get(senderJid);
  if (!tracker || now - tracker.windowStart > 10000) {
    tracker = { count: 1, windowStart: now };
    senderCommandCounts.set(senderJid, tracker);
  } else {
    tracker.count++;
    if (tracker.count > 5) {
      recordMessageBlocked('Dépassement du quota de rafale (5 cmd / 10s)', senderJid);
      return { allowed: false, reason: 'User burst limit exceeded' };
    }
  }

  return { allowed: true };
}

// ----------------------------------------------------
// 9. ANTI-SPAM REACTION LIMITER
// ----------------------------------------------------
const chatLastReactionTimes = new Map<string, number>();

export function canSendReaction(chatJid: string): boolean {
  const now = Date.now();
  const last = chatLastReactionTimes.get(chatJid) || 0;
  if (now - last < 2000) {
    return false; // Skip reaction to avoid spamming WhatsApp stanzas
  }
  chatLastReactionTimes.set(chatJid, now);
  return true;
}

// ----------------------------------------------------
// 10. SYSTEM METRICS AGGREGATOR FOR DASHBOARD
// ----------------------------------------------------
export function getBotMetrics(activeSessionsCount: number = 0): BotMetrics {
  const uptimeSec = Math.floor(process.uptime());
  const remainingCircuit = getCircuitBreakerCooldownRemaining();

  let health: BotMetrics['systemHealth'] = 'EXCELLENT';
  if (remainingCircuit > 0) {
    health = 'RESTRICTED';
  } else if (metricsState.errorsDetected > 20) {
    health = 'CAUTION';
  } else if (metricsState.messagesFailed > 10) {
    health = 'NOMINAL';
  }

  return {
    messagesSent: metricsState.messagesSent,
    messagesFailed: metricsState.messagesFailed,
    messagesBlocked: metricsState.messagesBlocked,
    errorsDetected: metricsState.errorsDetected,
    circuitBreakerTrips: metricsState.circuitBreakerTrips,
    activeSessions: activeSessionsCount,
    optOutCount: optOutSet.size,
    startTime: metricsState.startTime,
    uptimeDHM: formatUptimeDHM(uptimeSec),
    systemHealth: health,
    isCircuitBreakerActive: remainingCircuit > 0,
    circuitBreakerCooldownRemainingMs: remainingCircuit,
  };
}
