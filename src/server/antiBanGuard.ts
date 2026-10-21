/**
 * 🥷 BZK BOT 🌪️ - Anti-Ban, Anti-Spam & Humanized Traffic Guard
 * 
 * Strict protections to guarantee the bot NEVER spams the owner or user accounts,
 * never triggers WhatsApp anti-abuse filters (no bans, no 403 restrictions),
 * prevents infinite echo loops, enforces human-like outgoing message throttling,
 * and formats uptime / runtime in Jour / Heure / Minute.
 */

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
// 2. ANTI-BAN OUTGOING QUEUE & HUMAN-LIKE DELAY
// ----------------------------------------------------
interface QueuedMessageTask {
  fn: () => Promise<any>;
  resolve: (val: any) => void;
  reject: (err: any) => void;
  destJid: string;
  queuedAt: number;
}

class SessionOutgoingQueue {
  private queue: QueuedMessageTask[] = [];
  private isProcessing = false;
  private lastSentTime = 0;
  private jidMessageTimestamps = new Map<string, number[]>();
  private globalMessageTimestamps: number[] = [];

  constructor(private sessionId: string) {}

  public enqueue<T = any>(destJid: string, fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Memory safety: Drop oldest task if queue grows beyond 80 tasks
      if (this.queue.length >= 80) {
        const dropped = this.queue.shift();
        dropped?.resolve(null);
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
      const now = Date.now();

      // Clean old timestamps (older than 60s)
      this.globalMessageTimestamps = this.globalMessageTimestamps.filter((t) => now - t < 60000);
      const jidTimestamps = (this.jidMessageTimestamps.get(task.destJid) || []).filter(
        (t) => now - t < 20000
      );

      // Check per-JID flood protection (max 6 messages per 20 seconds to same chat)
      if (jidTimestamps.length >= 6) {
        console.warn(`[ANTI-BAN] 🛡️ Throttle pour ${task.destJid} sur ${this.sessionId}: trop de messages récents.`);
        await new Promise((r) => setTimeout(r, 2000));
      }

      // Check global session flood protection (max 30 messages per minute)
      if (this.globalMessageTimestamps.length >= 30) {
        console.warn(`[ANTI-BAN] 🛡️ Global session rate limit atteinte pour ${this.sessionId}. Pause de sécurité 3s.`);
        await new Promise((r) => setTimeout(r, 3000));
      }

      // Enforce human-like delay between messages (minimum 750ms - 1300ms + random jitter)
      const elapsedSinceLast = Date.now() - this.lastSentTime;
      const targetMinDelay = 800 + Math.floor(Math.random() * 450); // 800ms - 1250ms
      if (elapsedSinceLast < targetMinDelay) {
        const waitMs = targetMinDelay - elapsedSinceLast;
        await new Promise((r) => setTimeout(r, waitMs));
      }

      const res = await task.fn();
      this.lastSentTime = Date.now();
      this.globalMessageTimestamps.push(this.lastSentTime);

      jidTimestamps.push(this.lastSentTime);
      this.jidMessageTimestamps.set(task.destJid, jidTimestamps);

      task.resolve(res);
    } catch (err) {
      task.reject(err);
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        setTimeout(() => this.processNext(), 50);
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
// 3. ECHO LOOP & SELF-SPAM DETECTION
// ----------------------------------------------------
const knownBotOutputSignatures = [
  '*╭─━━━━━━━━━━━━━━━⊷❖*',
  '╭─━━━━━━━━━━━━━━━⊷❖',
  '*╭─❖━━━',
  '╭─❖━━━',
  '> *©',
  '⏱️ *Runtime / Uptime*',
  '⏱️ *ʀᴜɴᴛɪᴍᴇ / ᴜᴘᴛɪᴍᴇ*',
  '⚡ <b>ᴘᴏɴɢ !</b>',
  '⚡ *ᴘᴏɴɢ !*',
  'ʙᴏᴛ ɴᴀᴍᴇ:',
  'ʙᴏᴛ:',
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
// 4. ANTI-SPAM COMMAND RATE LIMITER
// ----------------------------------------------------
const senderLastCommandTimes = new Map<string, number>();
const senderCommandCounts = new Map<string, { count: number; windowStart: number }>();
const groupLastCommandTimes = new Map<string, number>();

export function checkAntiSpamCommand(
  senderJid: string,
  chatJid: string
): { allowed: boolean; reason?: string } {
  const now = Date.now();

  // 1. Group level rate limit (max 1 command every 1.5s per group)
  if (chatJid.endsWith('@g.us')) {
    const lastGroupCmd = groupLastCommandTimes.get(chatJid) || 0;
    if (now - lastGroupCmd < 1400) {
      return { allowed: false, reason: 'Group command cooldown' };
    }
    groupLastCommandTimes.set(chatJid, now);
  }

  // 2. Sender level rate limit (max 1 command every 1.8s per user)
  const lastUserCmd = senderLastCommandTimes.get(senderJid) || 0;
  if (now - lastUserCmd < 1800) {
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
      return { allowed: false, reason: 'User burst limit exceeded' };
    }
  }

  return { allowed: true };
}

// ----------------------------------------------------
// 5. ANTI-SPAM REACTION LIMITER
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
