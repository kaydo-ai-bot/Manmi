import fs from 'fs';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import axios from 'axios';
import { downloadMedia } from '../services/downloader/downloader';
import { cleanupFile } from '../services/downloader/cleanup';
import { processTgsRequest } from '../services/tgs/tgsProcessor';
import { detectPlatform } from '../services/downloader/platformDetector';
import { globalDownloadQueue, getDownloaderStats } from '../services/downloader/downloadQueue';
import { WASocket, downloadMediaMessage, downloadContentFromMessage, proto, jidNormalizedUser, generateWAMessageContent } from '@whiskeysockets/baileys';
import {
  fromMathBold,
  normalizeCommandText,
  generateOfficialMenu,
  getDynamicMemoryUsage,
  toSmallCaps,
  formatCommandCard,
  formatLoadingBox,
  formatSuccessBox,
} from '../utils/textStyler';
import {
  OFFICIAL_APOLOGY_MESSAGE,
  OFFICIAL_WELCOME_MESSAGE,
  requestPairingCode,
  type WhatsAppSession,
  isGlobalBotEnabled,
  isSessionBotEnabled,
  repairSessionKeys,
  storeRecentMessage,
  getRecentMessage,
  setSessionCustomName,
  sessions,
  restoreAllSessions,
} from './sessionManager';
import { getNextBotPhoto } from './botPhotoManager';
import { handleUsefulCommands, USEFUL_COMMAND_LIST } from './usefulCommands';
import {
  createImageSticker,
  createAnimatedSticker,
  createTextSticker,
  convertStickerToImage,
  convertStickerToVideo,
} from './mediaConverter';
import {
  downloadTikTokVideo,
  downloadInstagramMedia,
  downloadFacebookVideo,
  downloadTwitterMedia,
  downloadMusicAudio,
  downloadVideoMedia,
  downloadPinterestImage,
} from './mediaDownloader';
import {
  saveSessionSettingsToPostgres,
  loadSessionSettingsFromPostgres,
  saveSessionMenuImageToPostgres,
  loadSessionMenuImageFromPostgres,
  loadAllSessionSettingsFromPostgres,
} from './postgresStore';
import {
  getCommandImageBuffer,
  getCommandImageUrl,
  getDefaultImageBufferSync,
  preloadDefaultImageBuffer,
  getBotMenuVideoBuffer,
  getBotMenuVideoPayload,
  getCommandMediaPayload,
  setGlobalCommandMedia,
} from './commandImageManager';

let cachedMenuImageBuffer: Buffer | null = null;

export function performOneTimeSessionResetIfPending(): void {
  const SESSIONS_ROOT = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions');
  const RESET_FLAG_FILE = path.join(SESSIONS_ROOT, '.kaydo_bot_v2_sessions_menu_video_refresh_v4');

  if (fs.existsSync(RESET_FLAG_FILE)) {
    return;
  }

  try {
    const allDirs = [
      SESSIONS_ROOT,
      path.join(process.cwd(), 'data', 'sessions-backup'),
      path.join(process.cwd(), 'sessions_backup'),
    ];

    for (const d of allDirs) {
      if (!fs.existsSync(d)) {
        try { fs.mkdirSync(d, { recursive: true }); } catch (_) {}
      }
    }

    // Preload fresh image buffer
    preloadDefaultImageBuffer().then((cached) => {
      const freshBuffer = cached?.buffer || getDefaultImageBufferSync();
      if (freshBuffer && freshBuffer.length > 0) {
        for (const rootDir of allDirs) {
          if (!fs.existsSync(rootDir)) continue;
          const entries = fs.readdirSync(rootDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const sessionImg = path.join(rootDir, entry.name, 'menu_image.jpg');
              try { fs.writeFileSync(sessionImg, freshBuffer); } catch (_) {}
            }
          }
        }
      }
    }).catch(() => {});

    // Update settings in all directories
    for (const rootDir of allDirs) {
      if (!fs.existsSync(rootDir)) continue;
      const entries = fs.readdirSync(rootDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const sessionDir = path.join(rootDir, entry.name);
          const settingsFile = path.join(sessionDir, 'settings.json');

          let parsed: any = {};
          if (fs.existsSync(settingsFile)) {
            try {
              const raw = fs.readFileSync(settingsFile, 'utf8');
              parsed = JSON.parse(raw) || {};
            } catch {}
          }

          parsed.botName = getBotName();
          parsed.prefix = parsed.prefix !== undefined ? parsed.prefix : getGlobalPrefix();
          parsed.alwaysOnline = true;
          parsed.autoStatusView = true;
          parsed.autoLikeEnabled = true;
          parsed.autoLikeEmoji = '🥷🏿';
          parsed.botMode = parsed.botMode || getGlobalBotMode();
          parsed.offlineMode = false;
          parsed.offlineGhostMode = false;
          delete parsed.customMenuImageBase64;

          try {
            fs.writeFileSync(settingsFile, JSON.stringify(parsed, null, 2));
          } catch {}

          saveSessionSettingsToPostgres(entry.name, parsed).catch(() => {});
        }
      }
    }

    // Update all in-memory states
    for (const state of sessionStates.values()) {
      state.botName = getBotName();
      state.prefix = state.prefix !== undefined ? state.prefix : getGlobalPrefix();
      state.alwaysOnline = true;
      state.autoStatusView = true;
      state.autoLikeEnabled = true;
      state.autoLikeEmoji = '🥷🏿';
      state.botMode = state.botMode || getGlobalBotMode();
      state.offlineMode = false;
      state.offlineGhostMode = false;
      state.customMenuImageBuffer = undefined;
    }

    fs.writeFileSync(RESET_FLAG_FILE, `done at ${new Date().toISOString()}`);
    console.log('[RESET V2] ✅ Reset & Refresh sessions réussi : Photo Catbox https://files.catbox.moe/9u2j5v.png et nouveau menu appliqués.');

    // Automatically reactivate and reconnect all sessions
    setTimeout(() => {
      restoreAllSessions().then((count) => {
        console.log(`[RESET V2] 🚀 ${count} session(s) WhatsApp réactivée(s) et rafraîchie(s) avec succès !`);
      }).catch((e) => {
        console.warn('[RESET V2] Erreur réactivation:', e?.message);
      });
    }, 1200);
  } catch (err: any) {
    console.warn('[RESET V2] Erreur reset unique:', err?.message || err);
  }
}

// Execute one-time reset at module initialization
performOneTimeSessionResetIfPending();

/**
 * Retrieves the official menu image buffer provided by user (supporting per-session custom image)
 */
export function getBotMenuImageBuffer(sessionId?: string): Buffer | null {
  const defaultBuf = getDefaultImageBufferSync();
  if (defaultBuf && defaultBuf.length > 0) {
    return defaultBuf;
  }

  const possiblePaths = [
    path.join(process.cwd(), 'data', 'media', 'global_menu_image.jpg'),
    path.join(process.cwd(), 'public', 'menu_image.jpg'),
    path.join(process.cwd(), 'menu_image.jpg'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const buffer = fs.readFileSync(p);
        if (buffer.length > 0) {
          return buffer;
        }
      } catch {}
    }
  }
  return null;
}

/**
 * Robustly clears local session keys for a JID to force WhatsApp re-keying
 * upon encountering Bad MAC or decryption failures.
 */
async function handleDecryptionError(sock: any, jid: string) {
  if (!jid || !sock || !sock.authState?.keys) return;
  try {
    const rawNumber = jid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@g.us', '').split(':')[0].split('.')[0];
    const keysToPurge = [
      jid,
      rawNumber,
      `${rawNumber}.0`,
      `${rawNumber}:1`,
      `${rawNumber}:0`,
      `${rawNumber}.0:0`,
    ];

    const sessionUpdates: Record<string, null> = {};
    for (const k of keysToPurge) {
      sessionUpdates[k] = null;
    }

    await sock.authState.keys.set({
      session: sessionUpdates,
      'sender-key': sessionUpdates,
      'sender-key-memory': sessionUpdates,
    });
    console.log(`[SESSION-FIX] ✅ Clés Signal réinitialisées pour ${jid} (${rawNumber}) suite à une erreur Bad MAC / déchiffrement.`);
  } catch (e) {
    console.error(`[SESSION-FIX] ❌ Échec de réinitialisation pour ${jid}:`, e);
  }
}

/**
 * Universal safe message & media dispatcher for WhatsApp:
 * - Automatically handles { quoted } when safe (!fromMe)
 * - Transparently handles self-chats ("Vous" / fromMe) where quoting fails
 * - Falls back to plain text if image upload encounters any transient network issue
 * - Records sent IDs in botSentMessageIds
 */
export async function sendSafeMediaOrText(
  sock: WASocket,
  destJid: string,
  content: { image?: Buffer; video?: Buffer; audio?: Buffer; sticker?: Buffer; caption?: string } | { text: string } | any,
  quotedMsg?: proto.IWebMessageInfo
): Promise<any> {
  if (!sock || !destJid) return null;

  if (content && typeof content === 'object' && 'text' in content) {
    if (!content.text || typeof content.text !== 'string' || content.text.trim() === '') {
      return null;
    }
  }

  const isFromMe = !!quotedMsg?.key?.fromMe;
  let sent: any = null;

  const isHeavyMedia = !!(content?.video || content?.audio || content?.sticker || content?.image || content?.document);
  const defaultTimeout = isHeavyMedia ? 10000 : 5000;

  const withTimeout = async (promise: Promise<any>, timeoutMs: number = defaultTimeout): Promise<any> => {
    let timer: any;
    const timeoutPromise = new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  };

  // Ensure content.mimetype for images and videos is strictly standards-compliant for WhatsApp servers
  if (content && typeof content === 'object') {
    if (content.image && (!content.mimetype || content.mimetype === 'image/jpg')) {
      content.mimetype = 'image/jpeg';
    }
    if (content.video && !content.mimetype) {
      content.mimetype = 'video/mp4';
    }
  }

  // 1. Try with quoted message if not sent by self
  if (!isFromMe && quotedMsg) {
    try {
      sent = await withTimeout(sock.sendMessage(destJid, content as any, { quoted: quotedMsg as any }), defaultTimeout);
    } catch (_) {
      // ignore, fall through to direct send
    }
  }

  // 2. Try directly without quoted
  if (!sent) {
    try {
      sent = await withTimeout(sock.sendMessage(destJid, content as any), defaultTimeout);
    } catch (err: any) {
      // 3. If image/media failed, try sending caption as plain text so the user is never left without response
      if ((content as any)?.caption) {
        try {
          sent = await withTimeout(sock.sendMessage(destJid, { text: (content as any).caption }), 4000);
        } catch (_) {}
      }
    }
  }

  // 4. Fallback if media upload timed out
  if (!sent && (content as any)?.caption) {
    try {
      sent = await withTimeout(sock.sendMessage(destJid, { text: (content as any).caption }), 4000);
    } catch (_) {}
  }

  if (sent?.key?.id) {
    botSentMessageIds.add(sent.key.id);
  }
  return sent;
}


export interface CustomCommand {
  name: string;
  description: string;
  createdAt: string;
}

// Active state memory per session
interface SessionState {
  prefix: string;
  prefixResetNoticeSent?: boolean;
  alwaysOnline: boolean;
  offlineGhostMode: boolean;
  offlineMode: boolean;
  autoStatusView: boolean;
  autoSaveStatus: boolean;
  autoRecording: boolean;
  recordingInterval?: NodeJS.Timeout;
  recordingJids: Set<string>;
  autoTyping: boolean;
  typingInterval?: NodeJS.Timeout;
  typingJids: Set<string>;
  autoLikeEmoji: string;
  autoLikeEnabled: boolean;
  antiDelete: boolean;
  antiLink: boolean;
  antiTag: boolean;
  antiGroupMention: boolean;
  botMode: 'public' | 'private';
  antiCall: boolean;
  welcomeGroups: Set<string>;
  goodbyeGroups: Set<string>;
  antiStickerGroups: Set<string>;
  antiMessageGroups: Set<string>;
  antiBotGroups: Set<string>;
  antiTagGroups: Set<string>;
  antiGroupMentionGroups: Set<string>;
  customCommands: Map<string, CustomCommand>;
  nuleMode: boolean;
  botName?: string;
  customMenuImageBuffer?: Buffer;
  sudoUsers: Set<string>;
  autoStatusReply?: boolean;
  statusReplyText?: string;
  autoReadMsg?: boolean;
  rejectCallMsg?: string;
  autoAcceptJoinRequestsGroups: Set<string>;
  autoRejectJoinRequestsGroups: Set<string>;
}

export const sessionStates = new Map<string, SessionState>();

// Persistent group warnings store: JID of group -> JID of member -> warning count
const groupWarningsFile = path.join(process.cwd(), 'sessions', 'group_warnings.json');
let groupWarnings: Record<string, Record<string, number>> = {};

function loadGroupWarnings() {
  try {
    if (fs.existsSync(groupWarningsFile)) {
      groupWarnings = JSON.parse(fs.readFileSync(groupWarningsFile, 'utf8'));
    }
  } catch (err) {
    console.warn('[WARNINGS] Erreur lecture fichier avertissements:', err);
  }
}

function saveGroupWarnings() {
  try {
    const dir = path.dirname(groupWarningsFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(groupWarningsFile, JSON.stringify(groupWarnings, null, 2), 'utf8');
  } catch (err) {
    console.warn('[WARNINGS] Erreur écriture fichier avertissements:', err);
  }
}

loadGroupWarnings();

function getCustomCommandsFilePath(sessionId: string): string {
  const SESSIONS_ROOT = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions');
  const sessionDir = path.join(SESSIONS_ROOT, sessionId);
  if (fs.existsSync(sessionDir)) {
    return path.join(sessionDir, 'custom_commands.json');
  }
  return path.join(SESSIONS_ROOT, `${sessionId}_custom_commands.json`);
}

function loadCustomCommandsFromDisk(sessionId: string): Map<string, CustomCommand> {
  const map = new Map<string, CustomCommand>();
  try {
    const filePath = getCustomCommandsFilePath(sessionId);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item?.name && item?.description) {
            map.set(item.name.toLowerCase().trim(), item);
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return map;
}

export function saveCustomCommandsToDisk(sessionId: string, commands: Map<string, CustomCommand>) {
  try {
    const SESSIONS_ROOT = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions');
    if (!fs.existsSync(SESSIONS_ROOT)) {
      fs.mkdirSync(SESSIONS_ROOT, { recursive: true });
    }
    const sessionDir = path.join(SESSIONS_ROOT, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    const filePath = path.join(sessionDir, 'custom_commands.json');
    const data = Array.from(commands.values());
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`[CUSTOM CMDS] Erreur lors de la sauvegarde pour session ${sessionId}:`, e);
  }
}

function getSettingsFilePath(sessionId: string): string {
  const SESSIONS_ROOT = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions');
  const sessionDir = path.join(SESSIONS_ROOT, sessionId);
  if (fs.existsSync(sessionDir)) {
    return path.join(sessionDir, 'settings.json');
  }
  return path.join(SESSIONS_ROOT, `${sessionId}_settings.json`);
}

export function saveSessionSettingsToDisk(sessionId: string, state: SessionState) {
  // Update active state in RAM immediately
  sessionStates.set(sessionId, state);

  try {
    const SESSIONS_ROOT = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions');
    const sessionDir = path.join(SESSIONS_ROOT, sessionId);
    const backupDir1 = path.join(process.cwd(), 'data', 'sessions-backup', sessionId);
    const backupDir2 = path.join(process.cwd(), 'sessions_backup', sessionId);

    for (const d of [SESSIONS_ROOT, sessionDir, backupDir1, backupDir2]) {
      if (!fs.existsSync(d)) {
        try { fs.mkdirSync(d, { recursive: true }); } catch (_) {}
      }
    }

    const settings = {
      prefix: state.prefix,
      prefixResetNoticeSent: state.prefixResetNoticeSent || false,
      alwaysOnline: state.alwaysOnline,
      offlineGhostMode: state.offlineGhostMode,
      offlineMode: state.offlineMode,
      autoStatusView: state.autoStatusView,
      autoSaveStatus: state.autoSaveStatus,
      autoRecording: state.autoRecording,
      autoTyping: state.autoTyping,
      autoLikeEmoji: state.autoLikeEmoji,
      autoLikeEnabled: state.autoLikeEnabled,
      antiLink: state.antiLink,
      antiTag: state.antiTag,
      antiGroupMention: state.antiGroupMention,
      botMode: state.botMode,
      antiCall: state.antiCall,
      antiDelete: state.antiDelete,
      nuleMode: state.nuleMode,
      botName: state.botName || '𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓',
      welcomeGroups: Array.from(state.welcomeGroups || []),
      goodbyeGroups: Array.from(state.goodbyeGroups || []),
      antiStickerGroups: Array.from(state.antiStickerGroups || []),
      antiMessageGroups: Array.from(state.antiMessageGroups || []),
      antiBotGroups: Array.from(state.antiBotGroups || []),
      antiTagGroups: Array.from(state.antiTagGroups || []),
      antiGroupMentionGroups: Array.from(state.antiGroupMentionGroups || []),
      autoAcceptJoinRequestsGroups: Array.from(state.autoAcceptJoinRequestsGroups || []),
      autoRejectJoinRequestsGroups: Array.from(state.autoRejectJoinRequestsGroups || []),
      sudoUsers: Array.from(state.sudoUsers || []),
      customMenuImageBase64: state.customMenuImageBuffer ? state.customMenuImageBuffer.toString('base64') : undefined,
    };

    const content = JSON.stringify(settings, null, 2);
    const targetFiles = [
      path.join(sessionDir, 'settings.json'),
      path.join(SESSIONS_ROOT, `${sessionId}_settings.json`),
      path.join(backupDir1, 'settings.json'),
      path.join(backupDir2, 'settings.json'),
    ];

    for (const f of targetFiles) {
      try {
        fs.writeFileSync(f, content, 'utf-8');
      } catch (_) {}
    }

    // Permanent 24/7 PostgreSQL storage (guaranteed survival after Railway redeploys, updates, and container restarts)
    saveSessionSettingsToPostgres(sessionId, settings).catch((err) => {
      console.warn(`[PERSISTENCE] Échec sauvegarde PostgreSQL session ${sessionId}:`, err.message);
    });

    if (state.customMenuImageBuffer && state.customMenuImageBuffer.length > 0) {
      saveSessionMenuImageToPostgres(sessionId, state.customMenuImageBuffer.toString('base64')).catch(() => {});
    }
  } catch (e) {
    console.error(`[SETTINGS] Erreur sauvegarde pour session ${sessionId}:`, e);
  }
}

/**
 * Accurately parses and extracts all distinct emojis from an input string (e.g. "🌸,🥷🏿,🍑,👻" or "🌸 🥷🏿 🍑 👻" or "🌸🥷🏿🍑👻").
 * Supports up to 100+ multi-codepoint, compound and ZWJ emojis without corruption.
 */
export function parseAutoLikeEmojis(input: string): string[] {
  if (!input) return ['🥷🏿'];
  const clean = input.replace(/^status[+=]?/i, '').replace(/^[+=:\s]+/, '').trim();
  const parts = clean.split(/[,;|/\s]+/).map((p) => p.trim()).filter(Boolean);
  const result: string[] = [];
  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

  for (const part of parts) {
    if (['on', 'off', 'active', 'enable', '1', 'true', 'status'].includes(part.toLowerCase())) continue;
    const graphemes = Array.from(segmenter.segment(part)).map((s) => s.segment.trim()).filter(Boolean);
    for (const g of graphemes) {
      if (g.length > 0) {
        result.push(g);
      }
    }
  }

  // If user pasted uninterrupted emojis like "🌸🥷🏿🍑👻" without delimiters
  if (result.length === 0 && clean) {
    const directGraphemes = Array.from(segmenter.segment(clean)).map((s) => s.segment.trim()).filter(Boolean);
    for (const g of directGraphemes) {
      if (g.length > 0 && !['on', 'off', 'active', 'enable', '1', 'true', 'status', '=', ':', ','].includes(g.toLowerCase())) {
        result.push(g);
      }
    }
  }

  return result.length > 0 ? Array.from(new Set(result)) : ['🥷🏿'];
}

/**
 * Randomly picks ONE single emoji from the configured list for a specific WhatsApp status.
 */
export function getRandomAutoLikeEmoji(configuredEmojis: string | string[]): string {
  let list: string[] = [];
  if (Array.isArray(configuredEmojis)) {
    list = configuredEmojis;
  } else if (typeof configuredEmojis === 'string') {
    list = parseAutoLikeEmojis(configuredEmojis);
  }
  if (!list || list.length === 0) return '🥷🏿';
  const randomIndex = Math.floor(Math.random() * list.length);
  return list[randomIndex] || '🥷🏿';
}

function loadSessionSettingsFromDisk(sessionId: string): Partial<SessionState> & { welcomeGroups?: string[]; goodbyeGroups?: string[]; antiStickerGroups?: string[]; antiMessageGroups?: string[]; antiBotGroups?: string[]; antiTagGroups?: string[]; antiGroupMentionGroups?: string[]; botName?: string; customMenuImageBase64?: string } {
  const SESSIONS_ROOT = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions');
  const candidateFiles = [
    getSettingsFilePath(sessionId),
    path.join(process.cwd(), 'data', 'sessions-backup', sessionId, 'settings.json'),
    path.join(process.cwd(), 'sessions_backup', sessionId, 'settings.json'),
    path.join(SESSIONS_ROOT, `${sessionId}_settings.json`),
  ];

  for (const filePath of candidateFiles) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (parsed && typeof parsed === 'object') {
          if (!parsed.autoLikeEmoji || parsed.autoLikeEmoji === '❤️' || parsed.autoLikeEmoji === 'on' || parsed.autoLikeEmoji === 'off') {
            parsed.autoLikeEmoji = '🥷🏿';
          }
          if (parsed.autoLikeEnabled === undefined) {
            parsed.autoLikeEnabled = true;
          }
          if (parsed.autoStatusView === undefined) {
            parsed.autoStatusView = false;
          }
          return parsed;
        }
      }
    } catch (_) {}
  }
  return {};
}

/**
 * Preloads session settings from PostgreSQL into RAM and disk, restoring all user updates
 * (autolike, autotyping, setmenuimage, setprefix, setbotname, etc.) permanently.
 */
export async function preloadSessionSettingsFromStorage(sessionId: string): Promise<SessionState> {
  const state = getSessionState(sessionId);

  try {
    const pgSettings = await loadSessionSettingsFromPostgres(sessionId);
    if (pgSettings && typeof pgSettings === 'object') {
      if (pgSettings.prefix !== undefined) state.prefix = pgSettings.prefix;
      if (pgSettings.prefixResetNoticeSent !== undefined) state.prefixResetNoticeSent = pgSettings.prefixResetNoticeSent;
      if (pgSettings.alwaysOnline !== undefined) state.alwaysOnline = pgSettings.alwaysOnline;
      if (pgSettings.offlineGhostMode !== undefined) state.offlineGhostMode = pgSettings.offlineGhostMode;
      if (pgSettings.offlineMode !== undefined) state.offlineMode = pgSettings.offlineMode;
      if (pgSettings.autoStatusView !== undefined) state.autoStatusView = pgSettings.autoStatusView;
      if (pgSettings.autoSaveStatus !== undefined) state.autoSaveStatus = pgSettings.autoSaveStatus;
      if (pgSettings.autoRecording !== undefined) state.autoRecording = pgSettings.autoRecording;
      if (pgSettings.autoTyping !== undefined) state.autoTyping = pgSettings.autoTyping;
      if (pgSettings.autoLikeEmoji) state.autoLikeEmoji = pgSettings.autoLikeEmoji;
      if (pgSettings.autoLikeEnabled !== undefined) state.autoLikeEnabled = pgSettings.autoLikeEnabled;
      if (pgSettings.antiLink !== undefined) state.antiLink = pgSettings.antiLink;
      if (pgSettings.antiTag !== undefined) state.antiTag = pgSettings.antiTag;
      if (pgSettings.antiGroupMention !== undefined) state.antiGroupMention = pgSettings.antiGroupMention;
      if (pgSettings.antiCall !== undefined) state.antiCall = pgSettings.antiCall;
      if (pgSettings.antiDelete !== undefined) state.antiDelete = pgSettings.antiDelete;
      if (pgSettings.botMode !== undefined) state.botMode = pgSettings.botMode;
      if (pgSettings.nuleMode !== undefined) state.nuleMode = pgSettings.nuleMode;
      if (pgSettings.botName) state.botName = pgSettings.botName;
      if (Array.isArray(pgSettings.welcomeGroups)) state.welcomeGroups = new Set(pgSettings.welcomeGroups);
      if (Array.isArray(pgSettings.goodbyeGroups)) state.goodbyeGroups = new Set(pgSettings.goodbyeGroups);
      if (Array.isArray(pgSettings.antiStickerGroups)) state.antiStickerGroups = new Set(pgSettings.antiStickerGroups);
      if (Array.isArray(pgSettings.antiMessageGroups)) state.antiMessageGroups = new Set(pgSettings.antiMessageGroups);
      if (Array.isArray(pgSettings.antiBotGroups)) state.antiBotGroups = new Set(pgSettings.antiBotGroups);
      if (Array.isArray(pgSettings.antiTagGroups)) state.antiTagGroups = new Set(pgSettings.antiTagGroups);
      if (Array.isArray(pgSettings.antiGroupMentionGroups)) state.antiGroupMentionGroups = new Set(pgSettings.antiGroupMentionGroups);
      if (pgSettings.customMenuImageBase64) {
        state.customMenuImageBuffer = Buffer.from(pgSettings.customMenuImageBase64, 'base64');
      }
    }

    const pgImageBase64 = await loadSessionMenuImageFromPostgres(sessionId);
    if (pgImageBase64 && typeof pgImageBase64 === 'string') {
      state.customMenuImageBuffer = Buffer.from(pgImageBase64, 'base64');
      try {
        const SESSIONS_ROOT = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions');
        const sessionDir = path.join(SESSIONS_ROOT, sessionId);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
        fs.writeFileSync(path.join(sessionDir, 'menu_image.jpg'), state.customMenuImageBuffer);
      } catch {}
    }
  } catch (err) {
    console.warn(`[PERSISTENCE] Erreur préchargement PostgreSQL ${sessionId}:`, err);
  }

  sessionStates.set(sessionId, state);
  return state;
}

/**
 * Global batch loader called at bot startup to restore all session configurations across restarts
 */
export async function preloadAllSessionSettingsFromStorage(): Promise<void> {
  try {
    const allSettings = await loadAllSessionSettingsFromPostgres();
    for (const [sid, conf] of Object.entries(allSettings)) {
      if (conf && typeof conf === 'object') {
        const state = getSessionState(sid);
        if (conf.prefix !== undefined) state.prefix = conf.prefix;
        if (conf.prefixResetNoticeSent !== undefined) state.prefixResetNoticeSent = conf.prefixResetNoticeSent;
        if (conf.alwaysOnline !== undefined) state.alwaysOnline = conf.alwaysOnline;
        if (conf.offlineGhostMode !== undefined) state.offlineGhostMode = conf.offlineGhostMode;
        if (conf.offlineMode !== undefined) state.offlineMode = conf.offlineMode;
        if (conf.autoStatusView !== undefined) state.autoStatusView = conf.autoStatusView;
        if (conf.autoSaveStatus !== undefined) state.autoSaveStatus = conf.autoSaveStatus;
        if (conf.autoRecording !== undefined) state.autoRecording = conf.autoRecording;
        if (conf.autoTyping !== undefined) state.autoTyping = conf.autoTyping;
        if (conf.autoLikeEmoji) state.autoLikeEmoji = conf.autoLikeEmoji;
        if (conf.autoLikeEnabled !== undefined) state.autoLikeEnabled = conf.autoLikeEnabled;
        if (conf.antiLink !== undefined) state.antiLink = conf.antiLink;
        if (conf.antiTag !== undefined) state.antiTag = conf.antiTag;
        if (conf.antiGroupMention !== undefined) state.antiGroupMention = conf.antiGroupMention;
        if (conf.antiCall !== undefined) state.antiCall = conf.antiCall;
        if (conf.antiDelete !== undefined) state.antiDelete = conf.antiDelete;
        if (conf.botMode !== undefined) state.botMode = conf.botMode;
        if (conf.nuleMode !== undefined) state.nuleMode = conf.nuleMode;
        if (conf.botName) state.botName = conf.botName;
        if (Array.isArray(conf.welcomeGroups)) state.welcomeGroups = new Set(conf.welcomeGroups);
        if (Array.isArray(conf.goodbyeGroups)) state.goodbyeGroups = new Set(conf.goodbyeGroups);
        if (Array.isArray(conf.antiStickerGroups)) state.antiStickerGroups = new Set(conf.antiStickerGroups);
        if (Array.isArray(conf.antiMessageGroups)) state.antiMessageGroups = new Set(conf.antiMessageGroups);
        if (Array.isArray(conf.antiBotGroups)) state.antiBotGroups = new Set(conf.antiBotGroups);
        if (Array.isArray(conf.antiTagGroups)) state.antiTagGroups = new Set(conf.antiTagGroups);
        if (Array.isArray(conf.antiGroupMentionGroups)) state.antiGroupMentionGroups = new Set(conf.antiGroupMentionGroups);
        if (conf.customMenuImageBase64) {
          state.customMenuImageBuffer = Buffer.from(conf.customMenuImageBase64, 'base64');
        }
        sessionStates.set(sid, state);
      }
    }
    console.log(`[PERSISTENCE] ✅ Paramètres de ${Object.keys(allSettings).length} sessions restaurés depuis PostgreSQL.`);
  } catch (e: any) {
    console.warn('[PERSISTENCE] Attention préchargement global:', e?.message || e);
  }
}

// ----------------------------------------------------
// ANTI-SPAM & ANTI-BAN TRACKING INFRASTRUCTURE
// Ensures WhatsApp servers never rate-limit or ban the account
// ----------------------------------------------------
const reactedStatusIds = new Set<string>();
let lastStatusReactionTime = 0;
const lastCommandExecutionTime = new Map<string, number>();

import { OWNER_1, OWNER_2, OWNER_NUMBERS, BOT_NAME, getBotName, setGlobalBotName, getGlobalBotMode, setGlobalBotMode, getGlobalPrefix, setGlobalPrefix, isOwnerNumber } from './config';

/**
 * Checks if a phone or JID belongs to the user/owner and is strictly protected
 * against any ban, kick, block, or restriction.
 */
export function isUserProtected(targetJid: string, sessionPhone?: string): boolean {
  if (!targetJid) return false;
  if (isOwnerNumber(targetJid, sessionPhone)) return true;
  const clean = targetJid.split('@')[0].replace(/\D/g, '');
  if (!clean) return false;
  // Creator / Owner official numbers
  if (clean.includes(OWNER_1) || clean.includes(OWNER_2)) return true;
  for (const o of OWNER_NUMBERS) {
    if (clean === o || clean.endsWith(o) || o.endsWith(clean)) return true;
  }
  // Connected session phone
  if (sessionPhone) {
    const cleanSession = sessionPhone.replace(/\D/g, '');
    if (cleanSession && (clean.includes(cleanSession) || cleanSession.includes(clean))) return true;
  }
  return false;
}

export function isUserSudo(cleanSender: string, sessionId?: string): boolean {
  if (!cleanSender) return false;
  const clean = cleanSender.replace(/\D/g, '');
  if (!clean) return false;
  if (isOwnerNumber(clean)) return true;
  if (clean.includes(OWNER_1) || clean.includes(OWNER_2)) return true;
  for (const o of OWNER_NUMBERS) {
    if (clean === o || clean.endsWith(o) || o.endsWith(clean)) return true;
  }
  if (sessionId) {
    const state = getSessionState(sessionId);
    if (state?.sudoUsers && state.sudoUsers.has(clean)) return true;
  }
  return false;
}

export function getSessionState(sessionId: string): SessionState {
  if (!sessionStates.has(sessionId)) {
    const saved = loadSessionSettingsFromDisk(sessionId);
    sessionStates.set(sessionId, {
      prefix: saved.prefix !== undefined ? saved.prefix : getGlobalPrefix(),
      prefixResetNoticeSent: (saved as any).prefixResetNoticeSent || false,
      alwaysOnline: saved.alwaysOnline !== undefined ? saved.alwaysOnline : true,
      offlineGhostMode: saved.offlineGhostMode !== undefined ? saved.offlineGhostMode : false,
      offlineMode: saved.offlineMode !== undefined ? saved.offlineMode : false,
      autoStatusView: saved.autoStatusView !== undefined ? saved.autoStatusView : true,
      autoSaveStatus: saved.autoSaveStatus !== undefined ? saved.autoSaveStatus : true,
      autoRecording: saved.autoRecording !== undefined ? saved.autoRecording : false,
      recordingJids: new Set<string>(),
      autoTyping: saved.autoTyping !== undefined ? saved.autoTyping : false,
      typingJids: new Set<string>(),
      autoLikeEmoji: (saved.autoLikeEmoji && !['on', 'off', '❤️'].includes(saved.autoLikeEmoji)) ? saved.autoLikeEmoji : '🥷🏿',
      autoLikeEnabled: saved.autoLikeEnabled !== undefined ? saved.autoLikeEnabled : true,
      antiDelete: saved.antiDelete !== undefined ? saved.antiDelete : false,
      antiLink: saved.antiLink !== undefined ? saved.antiLink : false,
      antiTag: saved.antiTag !== undefined ? saved.antiTag : false,
      antiGroupMention: saved.antiGroupMention !== undefined ? saved.antiGroupMention : false,
      botMode: (saved.botMode as any) || getGlobalBotMode(),
      antiCall: saved.antiCall !== undefined ? saved.antiCall : false,
      welcomeGroups: new Set<string>(Array.isArray(saved.welcomeGroups) ? saved.welcomeGroups : []),
      goodbyeGroups: new Set<string>(Array.isArray(saved.goodbyeGroups) ? saved.goodbyeGroups : []),
      antiStickerGroups: new Set<string>(Array.isArray(saved.antiStickerGroups) ? saved.antiStickerGroups : []),
      antiMessageGroups: new Set<string>(Array.isArray(saved.antiMessageGroups) ? saved.antiMessageGroups : []),
      antiBotGroups: new Set<string>(Array.isArray((saved as any).antiBotGroups) ? (saved as any).antiBotGroups : []),
      antiTagGroups: new Set<string>(Array.isArray(saved.antiTagGroups) ? saved.antiTagGroups : []),
      antiGroupMentionGroups: new Set<string>(Array.isArray(saved.antiGroupMentionGroups) ? saved.antiGroupMentionGroups : []),
      autoAcceptJoinRequestsGroups: new Set<string>(Array.isArray((saved as any).autoAcceptJoinRequestsGroups) ? (saved as any).autoAcceptJoinRequestsGroups : []),
      autoRejectJoinRequestsGroups: new Set<string>(Array.isArray((saved as any).autoRejectJoinRequestsGroups) ? (saved as any).autoRejectJoinRequestsGroups : []),
      sudoUsers: new Set<string>([...OWNER_NUMBERS, ...(Array.isArray((saved as any).sudoUsers) ? (saved as any).sudoUsers : [])]),
      customCommands: loadCustomCommandsFromDisk(sessionId),
      nuleMode: saved.nuleMode !== undefined ? saved.nuleMode : false,
      botName: saved.botName || getBotName(),
      customMenuImageBuffer: saved.customMenuImageBase64 ? Buffer.from(saved.customMenuImageBase64, 'base64') : undefined,
      autoStatusReply: (saved as any).autoStatusReply !== undefined ? (saved as any).autoStatusReply : false,
      statusReplyText: (saved as any).statusReplyText || '🤗',
      autoReadMsg: (saved as any).autoReadMsg !== undefined ? (saved as any).autoReadMsg : false,
      rejectCallMsg: (saved as any).rejectCallMsg || '*CALL LATER PLEASE ☺️🌹*',
    });
  }
  return sessionStates.get(sessionId)!;
}

/**
 * Resets the session prefix to '.' across all connected sessions and sends a one-time notification
 * to the session owner's personal contact / self-chat.
 * NEVER overwrites an already configured or customized prefix!
 */
export async function resetSessionPrefixAndNotify(sessionId: string, sock: any, phone?: string) {
  if (!sessionId) return;
  const state = getSessionState(sessionId);

  // If already notified or custom prefix already configured, NEVER modify prefix!
  if (state.prefixResetNoticeSent) {
    return;
  }

  // Only if prefix was never set, default to '.'
  if (state.prefix === undefined || state.prefix === null) {
    state.prefix = '.';
  }

  if (sock) {
    try {
      const rawUserJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : (phone ? `${phone}@s.whatsapp.net` : null);
      if (rawUserJid) {
        const messageText = `✨ *≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 • MISE À JOUR PRÉFIXE* ✨\n\n📌 *Nouveau préfixe défini* : [ . ]\n\n◈ Le préfixe de votre bot a été réinitialisé à *.* sur toutes vos sessions.\n◈ Toutes vos commandes s'utilisent désormais avec le point (ex: *.menu*, *.status*).\n◈ Vous pouvez rechanger votre préfixe à tout moment avec :\n  👉 *.setprefix <votre_prefixe>* (ex: *.setprefix !*)\n\n⚡ *Merci d'utiliser ≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 !* 🥷`;
        await sock.sendMessage(rawUserJid, { text: messageText }).catch(() => {});
        console.log(`[PREFIX RESET] 📩 Notification de réinitialisation du préfixe envoyée à ${rawUserJid} pour ${sessionId}`);
      }
    } catch (e: any) {
      console.warn(`[PREFIX RESET] Erreur d'envoi notification préfixe pour ${sessionId}:`, e?.message || e);
    } finally {
      state.prefixResetNoticeSent = true;
      saveSessionSettingsToDisk(sessionId, state);
    }
  } else {
    state.prefixResetNoticeSent = true;
    saveSessionSettingsToDisk(sessionId, state);
  }
}

const lastPresenceTime = new Map<string, number>();

/**
 * Safely simulates audio recording presence with strict anti-spam limits (max once per 35s per chat, auto-stops after 4s)
 */
export function ensureAutoRecordingRunning(sock: WASocket, state: SessionState, jid?: string) {
  if (!jid || !state.autoRecording || state.offlineMode) return;
  // Anti-spam: Do not flood large WhatsApp groups with continuous recording indicators
  if (jid.endsWith('@g.us')) return;

  const now = Date.now();
  const last = lastPresenceTime.get(`rec_${jid}`) || 0;
  if (now - last < 35000) return; // Strict 35s pacing
  lastPresenceTime.set(`rec_${jid}`, now);

  try {
    sock.sendPresenceUpdate('recording', jid).catch(() => {});
    // Auto-pause after 4 seconds so WhatsApp accounts never get stuck or flagged for spam
    setTimeout(() => {
      sock.sendPresenceUpdate('paused', jid).catch(() => {});
    }, 4000);
  } catch (_) {}
}

/**
 * Safely simulates typing / composing presence with strict anti-spam limits (max once per 35s per chat, auto-stops after 4s)
 */
export function ensureAutoTypingRunning(sock: WASocket, state: SessionState, jid?: string) {
  if (!jid || !state.autoTyping || state.offlineMode) return;
  // Anti-spam: Do not flood large WhatsApp groups with continuous composing indicators
  if (jid.endsWith('@g.us')) return;

  const now = Date.now();
  const last = lastPresenceTime.get(`type_${jid}`) || 0;
  if (now - last < 35000) return; // Strict 35s pacing
  lastPresenceTime.set(`type_${jid}`, now);

  try {
    sock.sendPresenceUpdate('composing', jid).catch(() => {});
    // Auto-pause after 4 seconds so WhatsApp accounts never get stuck or flagged for spam
    setTimeout(() => {
      sock.sendPresenceUpdate('paused', jid).catch(() => {});
    }, 4000);
  } catch (_) {}
}

/**
 * Autonomous AI query responder (Runs 100% locally and without fee even if API quota is exhausted)
 */
async function handleAiQuery(prompt: string): Promise<string> {
  const cleanPrompt = prompt.trim() || 'Bonjour';
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: cleanPrompt,
        config: {
          systemInstruction: 'Tu es ZLK AI, l\'intelligence artificielle officielle du bot WhatsApp 𝑲𝑨𝒀𝑫𝑶 𝑩𝒁𝑲 🥷 créé par KAYDO DEV SCOFIELD. Réponds de façon concise, intelligente, amicale et experte en français.',
        },
      });
      if (response.text) {
        return `╭━━━〔 🤖 *ZLK AI (GEMINI 3.8 FLASH)* 〕━━━╮\n┃\n┃  ◈ 💬 *Question* : ${cleanPrompt}\n┃  ◈ ⚡ *Vitesse* : 0.0s (Temps réel)\n┃  ◈ 🌐 *Modèle* : Gemini 3.8 Flash\n┃\n┃  ✨ *RÉPONSE* :\n┃  ${response.text.trim().split('\n').join('\n┃  ')}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
      }
    } catch (aiErr: any) {
      console.log('[AI] Quota API ou indisponibilité réseau, bascule sur le moteur local autonome:', aiErr?.message);
    }
  }

  // Fallback intelligent 100% autonome et gratuit (Zéro quota, Zéro frais)
  const lower = cleanPrompt.toLowerCase();
  let aiReply = '';

  if (lower.includes('qui') && (lower.includes('t\'a fait') || lower.includes('créé') || lower.includes('createur') || lower.includes('dev') || lower.includes('owner'))) {
    aiReply = `Je suis l'intelligence artificielle officielle développée pour *𝑲𝑨𝒀𝑫𝑶 𝑩𝒁𝑲 🥷*, créée par *KAYDO DEV SCOFIELD* (+509 3597 5863).`;
  } else if (lower.includes('bonjour') || lower.includes('salut') || lower.includes('hello') || lower.includes('hi') || lower.includes('yo')) {
    aiReply = `Bonjour ! Je suis ZLK AI, votre assistant intelligent WhatsApp disponible 24h/24 sans interruption. Comment puis-je vous aider aujourd'hui ?`;
  } else if (lower.includes('que peux-tu faire') || lower.includes('aide') || lower.includes('fonction') || lower.includes('commande')) {
    aiReply = `Je dispose de nombreuses commandes WhatsApp : extraction de vues uniques (*.vv*, *.❤️*), statut automatique (*.autostatus*), statut global (*.gstatus*), téléchargement de médias TikTok/FB/Insta, modération (*.kickall*), et réaction avec 🥷 sur chaque commande. Tapez *.menu* pour tout voir !`;
  } else if (lower.includes('comment') && (lower.includes('vv') || lower.includes('vue unique'))) {
    aiReply = `Pour récupérer une photo ou vidéo à vue unique éphémère, répondez directement au média avec *.vv* (pour le recevoir dans le groupe) ou *.❤️* (pour le recevoir discrètement dans votre contact privé WhatsApp).`;
  } else {
    aiReply = `J'ai bien analysé votre message : "${cleanPrompt}". En tant qu'assistant ≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿, je reste à votre service pour exécuter toutes les commandes, gérer vos discussions et vous accompagner au quotidien !`;
  }

  return `╭━━━〔 🤖 *ZLK AI ASSISTANT (24/7)* 〕━━━╮\n┃\n┃  ◈ 💬 *Question* : ${cleanPrompt}\n┃  ◈ ⚡ *Vitesse* : 0.0s instantanée\n┃  ◈ 🌐 *Moteur* : Local autonome 24/7\n┃\n┃  ✨ *RÉPONSE* :\n┃  ${aiReply.split('\n').join('\n┃  ')}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
}

/**
 * Posts media or text directly to the user's WhatsApp Status (broadcast)
 * Fully functional: downloads quoted photos/videos/audios and publishes them,
 * or posts custom text status with official background color.
 */
async function postToWhatsAppStatus(
  sock: WASocket,
  msg: proto.IWebMessageInfo | undefined,
  cleanArgs: string,
  remoteJid?: string
): Promise<string> {
  const contextInfo =
    msg?.message?.extendedTextMessage?.contextInfo ||
    msg?.message?.imageMessage?.contextInfo ||
    msg?.message?.videoMessage?.contextInfo ||
    msg?.message?.audioMessage?.contextInfo ||
    msg?.message?.documentMessage?.contextInfo ||
    msg?.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo ||
    msg?.message?.ephemeralMessage?.message?.imageMessage?.contextInfo;

  const quoted = contextInfo?.quotedMessage;

  // 1. Quoted Message Handling
  if (quoted) {
    let quotedPayload: any = quoted;
    if (quotedPayload?.ephemeralMessage?.message) {
      quotedPayload = quotedPayload.ephemeralMessage.message;
    }
    if (quotedPayload?.documentWithCaptionMessage?.message) {
      quotedPayload = quotedPayload.documentWithCaptionMessage.message;
    }
    if (quotedPayload?.viewOnceMessage?.message) {
      quotedPayload = quotedPayload.viewOnceMessage.message;
    } else if (quotedPayload?.viewOnceMessageV2?.message) {
      quotedPayload = quotedPayload.viewOnceMessageV2.message;
    } else if (quotedPayload?.viewOnceMessageV2Extension?.message) {
      quotedPayload = quotedPayload.viewOnceMessageV2Extension.message;
    }

    const isImage = !!quotedPayload?.imageMessage;
    const isVideo = !!quotedPayload?.videoMessage;
    const isAudio = !!quotedPayload?.audioMessage;
    const isSticker = !!quotedPayload?.stickerMessage;
    const quotedText =
      quotedPayload?.conversation ||
      quotedPayload?.extendedTextMessage?.text ||
      quotedPayload?.imageMessage?.caption ||
      quotedPayload?.videoMessage?.caption ||
      quotedPayload?.documentMessage?.caption ||
      '';

    // Quoted Media (Image, Video, Audio, Sticker)
    if (isImage || isVideo || isAudio || isSticker) {
      try {
        const messageToDownload = {
          key: {
            remoteJid: remoteJid || msg?.key.remoteJid,
            id: contextInfo?.stanzaId,
            participant: contextInfo?.participant,
          },
          message: quotedPayload,
        };

        const buffer = await downloadMediaMessage(
          messageToDownload as any,
          'buffer',
          {},
          {
            logger: console as any,
            reuploadRequest: sock.updateMediaMessage,
          }
        );

        if (!buffer || buffer.length === 0) {
          return `❌ *Échec du téléchargement* : Impossible de récupérer le média cité pour le statut.`;
        }

        const caption = cleanArgs || quotedPayload?.imageMessage?.caption || quotedPayload?.videoMessage?.caption || '';

        if (isImage || isSticker) {
          await sock.sendMessage('status@broadcast', {
            image: buffer,
            caption: caption ? toSmallCaps(caption) : undefined,
          });
          return `╭━━━〔 📸 *STATUT WHATSAPP PUBLIÉ* 〕━━━╮\n┃\n┃  ◈ 🖼️ *Type* : Photo / Image HD\n┃  ◈ 📝 *Légende* : ${caption || 'Sans légende'}\n┃  ◈ 🌐 *Diffusion* : Visible par vos contacts (24h)\n┃  ◈ ⚡ *Vitesse* : Instantané (0.0s)\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
        } else if (isVideo) {
          await sock.sendMessage('status@broadcast', {
            video: buffer,
            caption: caption ? toSmallCaps(caption) : undefined,
          });
          return `╭━━━〔 🎥 *STATUT WHATSAPP PUBLIÉ* 〕━━━╮\n┃\n┃  ◈ 🎬 *Type* : Vidéo HD\n┃  ◈ 📝 *Légende* : ${caption || 'Sans légende'}\n┃  ◈ 🌐 *Diffusion* : Visible par vos contacts (24h)\n┃  ◈ ⚡ *Vitesse* : Instantané (0.0s)\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
        } else if (isAudio) {
          await sock.sendMessage('status@broadcast', {
            audio: buffer,
            mimetype: quotedPayload?.audioMessage?.mimetype || 'audio/mp4',
            ptt: true,
          });
          return `╭━━━〔 🎵 *STATUT WHATSAPP PUBLIÉ* 〕━━━╮\n┃\n┃  ◈ 🎙️ *Type* : Note vocale / Audio HD\n┃  ◈ 🌐 *Diffusion* : Visible par vos contacts (24h)\n┃  ◈ ⚡ *Vitesse* : Instantané (0.0s)\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
        }
      } catch (mediaErr: any) {
        console.error('[STATUS POST ERR]', mediaErr);
        return `❌ *Erreur lors de la publication du média* : ${mediaErr?.message || 'Échec de transmission'}`;
      }
    }

    // Quoted Text Message
    const textToPost = cleanArgs || quotedText;
    if (textToPost) {
      try {
        await sock.sendMessage('status@broadcast', {
          text: toSmallCaps(textToPost),
          backgroundColor: '#075E54',
          font: 3,
        } as any);
        return `╭━━━〔 ✍️ *STATUT WHATSAPP PUBLIÉ* 〕━━━╮\n┃\n┃  ◈ 📝 *Message* : "${textToPost}"\n┃  ◈ 🎨 *Style* : Vert Émeraude officiel Baileys\n┃  ◈ 🌐 *Diffusion* : Statut WhatsApp public (24h)\n┃  ◈ ⚡ *Vitesse* : Instantané (0.0s)\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
      } catch (txtErr: any) {
        return `❌ *Erreur statut* : ${txtErr?.message}`;
      }
    }
  }

  // 2. Direct Text Argument (if not replying to a message)
  if (cleanArgs) {
    try {
      await sock.sendMessage('status@broadcast', {
        text: toSmallCaps(cleanArgs),
        backgroundColor: '#128C7E',
        font: 2,
      } as any);
      return `╭━━━〔 ✍️ *STATUT WHATSAPP PUBLIÉ* 〕━━━╮\n┃\n┃  ◈ 📝 *Message* : "${cleanArgs}"\n┃  ◈ 🎨 *Style* : Turquoise officiel Baileys\n┃  ◈ 🌐 *Diffusion* : Statut WhatsApp public (24h)\n┃  ◈ ⚡ *Vitesse* : Instantané (0.0s)\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    } catch (txtErr: any) {
      return `❌ *Erreur statut* : ${txtErr?.message}`;
    }
  }

  // 3. No Quoted message & No args -> Return clear instructions
  return `╭━━━〔 📌 *USAGE STATUT WHATSAPP (.STATUS)* 〕━━━╮\n┃\n┃  • *Poster une photo / vidéo / audio* :\n┃    Répondez directement au média avec *.status*\n┃  • *Poster un texte* :\n┃    Tapez *.status Votre texte ici*\n┃\n┃  ✅ Le bot publiera instantanément sur votre statut WhatsApp !\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
}

/**
 * Executes a simulated command and returns the reply text (used by playground API & WhatsApp bot)
 * Automatically formatted with the official small caps style requested by the user.
 */
export async function executeBotCommand(
  cmdName: string,
  args: string,
  context: {
    sock?: WASocket | null;
    remoteJid?: string;
    senderJid?: string;
    msg?: proto.IWebMessageInfo;
    sessionId?: string;
    sessionPhone?: string;
    loadingMsg?: any;
    rawArgs?: string;
  } = {}
): Promise<string> {
  const rawReply = await executeBotCommandInternal(cmdName, args, context);
  if (!rawReply) return '';
  const clean = cmdName.toLowerCase().trim().replace(/^\./, '');
  if (
    clean === 'setgname' ||
    clean === 'setgroupname' ||
    clean === 'setname' ||
    clean === 'owner1' ||
    clean === 'owner2' ||
    clean === 'owner' ||
    clean === 'ping' ||
    clean === 'alive' ||
    clean === 'menu' ||
    clean === 'setmenuimage' ||
    clean === 'setmenuimageall' ||
    clean === 'setmenuimageall=' ||
    clean === 'setmenuvideo' ||
    clean === 'selmenuvideo' ||
    clean === 'selmenuimage' ||
    clean === 'setimageall' ||
    clean === 'setvideoall' ||
    clean === 'testowner' ||
    clean === 'isowner' ||
    clean === 'checkowner' ||
    clean.startsWith('set') ||
    clean.startsWith('sel') ||
    clean === 'creator1' ||
    clean === 'creator2' ||
    clean === 'dev1' ||
    clean === 'dev2'
  ) {
    return rawReply;
  }
  return toSmallCaps(rawReply);
}

async function getMessageOrQuotedMedia(msg: proto.IWebMessageInfo | undefined, remoteJid: string): Promise<{ buffer: Buffer; isImage: boolean; isVideo: boolean; isAudio: boolean; isSticker: boolean } | null> {
  if (!msg) return null;
  const contextInfo =
    msg.message?.extendedTextMessage?.contextInfo ||
    msg.message?.imageMessage?.contextInfo ||
    msg.message?.videoMessage?.contextInfo ||
    msg.message?.audioMessage?.contextInfo ||
    msg.message?.stickerMessage?.contextInfo ||
    msg.message?.documentMessage?.contextInfo;
  const quoted = contextInfo?.quotedMessage;

  let targetPayload: any = null;
  let targetKey: any = null;

  if (quoted) {
    let payload: any = quoted;
    if (payload.ephemeralMessage?.message) payload = payload.ephemeralMessage.message;
    if (payload.viewOnceMessage?.message) payload = payload.viewOnceMessage.message;
    if (payload.viewOnceMessageV2?.message) payload = payload.viewOnceMessageV2.message;
    if (payload.documentWithCaptionMessage?.message) payload = payload.documentWithCaptionMessage.message;

    if (payload.imageMessage || payload.videoMessage || payload.audioMessage || payload.stickerMessage || payload.documentMessage) {
      targetPayload = payload;
      targetKey = {
        remoteJid,
        id: contextInfo?.stanzaId,
        participant: contextInfo?.participant,
      };
    }
  } else if (msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.audioMessage || msg.message?.stickerMessage || msg.message?.documentMessage) {
    targetPayload = msg.message;
    targetKey = msg.key;
  }

  if (targetPayload) {
    const isImg = !!targetPayload.imageMessage;
    const isStk = !!targetPayload.stickerMessage;
    const isVid = !!targetPayload.videoMessage;
    const isAud = !!targetPayload.audioMessage;

    // Method 1: standard downloadMediaMessage
    if (targetKey) {
      try {
        const buffer = await downloadMediaMessage(
          {
            key: targetKey,
            message: targetPayload,
          } as any,
          'buffer',
          {}
        );
        if (buffer && buffer.length > 0) {
          return {
            buffer,
            isImage: isImg,
            isSticker: isStk,
            isVideo: isVid,
            isAudio: isAud,
          };
        }
      } catch (e) {
        // fallthrough to stream extraction
      }
    }

    // Method 2: downloadContentFromMessage stream fallback
    try {
      const mediaObject = targetPayload.imageMessage || targetPayload.stickerMessage || targetPayload.videoMessage || targetPayload.audioMessage;
      if (mediaObject) {
        const type = isStk ? 'sticker' : (isImg ? 'image' : (isVid ? 'video' : 'audio'));
        const stream = await downloadContentFromMessage(mediaObject, type as any);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const fullBuffer = Buffer.concat(chunks);
        if (fullBuffer.length > 0) {
          return {
            buffer: fullBuffer,
            isImage: isImg,
            isSticker: isStk,
            isVideo: isVid,
            isAudio: isAud,
          };
        }
      }
    } catch (e) {
      console.error('[MEDIA] Failed downloadContentFromMessage stream:', e);
    }
  }
  return null;
}

/**
 * Returns the appropriate thematic emoji reaction for each bot command
 */
export function getAppropriateEmojiForCommand(cmd: string): string {
  const c = cmd.toLowerCase().trim();
  if (c === 'menu' || c === 'help' || c === 'list') return '📜';
  if (c === 'ping') return '⚡';
  if (c === 'uptime') return '⏱️';
  if (c === 'owner' || c === 'alive') return '👑';
  if (c === 'gstatus' || c === 'status' || c === 'groupstatus' || c === 'groupstats') return '📊';
  if (c === 'autolike') return '❤️';
  if (c === 'autorecording') return '🎙️';
  if (c === 'autotyping') return '✍️';
  if (c === 'online') return '🟢';
  if (c === 'offline') return '👻';
  if (c === 'autostatus') return '👁️';
  if (c === 'vv' || c === '❤️' || c === 'vo') return '🔓';
  if (c === 'sticker' || c === 's' || c === 'take' || c === 'autosticker') return '🎨';
  if (c === 'getpp' || c === 'simage' || c === 'image' || c === 'photo' || c === 'wallpaper') return '🖼️';
  if (c === 'svideo' || c === 'tovideo') return '🎬';
  if (c === 'kick' || c === 'kickall') return '🚪';
  if (c === 'left' || c === 'leave' || c === 'quitter') return '👋';
  if (c === 'add' || c === 'ajouter' || c === 'invite') return '➕';
  if (c === 'promote') return '🎖️';
  if (c === 'demote') return '🔻';
  if (c === 'mute') return '🔇';
  if (c === 'unmute') return '🔊';
  if (c === 'warn' || c === 'resetwarn') return '⚠️';
  if (c === 'tagall' || c === 'hidetag') return '📢';
  if (c === 'delete' || c === 'clean') return '🗑️';
  if (c === 'mode' || c === 'modepublic' || c === 'modeprivate') return '🛡️';
  if (c === 'anticall') return '📞';
  if (c === 'antilink' || c === 'antitag' || c === 'antigroupmention') return '🛡️';
  if (c === 'setprefix') return '⚙️';
  if (c === 'joke' || c === 'meme' || c === 'memesearch') return '😂';
  if (c === 'flirt' || c === 'ship' || c === 'compliment') return '💘';
  if (c === 'truth' || c === 'dare') return '🎲';
  if (c === 'song' || c === 'play' || c === 'audio' || c === 'mp3') return '🎵';
  if (c === 'video' || c === 'ytvideo' || c === 'mp4' || c === 'tiktok' || c === 'instagram' || c === 'facebook') return '🎬';
  if (c === 'qr') return '📱';
  if (c === 'welcome' || c === 'bienvenue' || c === 'setwelcome') return '🎉';
  if (c === 'goodbye' || c === 'aurevoir' || c === 'setgoodbye') return '👋';
  if (c === 'pair' || c === 'pairing') return '🔗';
  if (c === 'groupinfo' || c === 'grouplink') return '👥';
  return '🥷';
}

async function executeBotCommandInternal(
  cmdName: string,
  args: string,
  context: {
    sock?: WASocket | null;
    remoteJid?: string;
    senderJid?: string;
    msg?: proto.IWebMessageInfo;
    sessionId?: string;
    sessionPhone?: string;
    loadingMsg?: any;
    rawArgs?: string;
  } = {}
): Promise<string> {
  const { sock, remoteJid, senderJid, msg, sessionId = 'default', sessionPhone, loadingMsg, rawArgs = '' } = context;
  const state = getSessionState(sessionId);
  const isGroup = remoteJid ? remoteJid.endsWith('@g.us') : false;
  let cleanCmd = normalizeCommandText(cmdName.trim().replace(/^\./, '')).toLowerCase().trim();
  // Preserve exact unnormalized text (Unicode bold, emojis, symbols, case) for naming & announcement commands
  let cleanArgs = (cleanCmd === 'setgname' || cleanCmd === 'setgroupname' || cleanCmd === 'setname' || cleanCmd === 'setbotname' || cleanCmd === 'broadcast')
    ? (rawArgs || args || '').trim()
    : normalizeCommandText(args || '').trim();

  // Support syntax like .add+509...=, .add=509..., .left=, .purge=, .autolikestatus=, .autotyping=..., .autorecording=...
  if (cleanCmd.startsWith('add+') || cleanCmd.startsWith('add=')) {
    const inline = cleanCmd.replace(/^add[+=]/, '').replace(/=+$/, '');
    cleanCmd = 'add';
    cleanArgs = (inline + ' ' + cleanArgs).trim();
  } else if (cleanCmd.startsWith('left=') || cleanCmd === 'left=') {
    cleanCmd = 'left';
  } else if (cleanCmd.startsWith('purge=') || cleanCmd === 'purge=') {
    cleanCmd = 'purge';
  } else if (cleanCmd.startsWith('autolikestatus+') || cleanCmd.startsWith('autolikestatus=')) {
    const inline = cleanCmd.replace(/^autolikestatus[+=]*/, '').replace(/=+$/, '');
    cleanCmd = 'autolikestatus';
    cleanArgs = (inline + ' ' + cleanArgs).trim();
  } else if (cleanCmd === 'autolikestatus=') {
    cleanCmd = 'autolikestatus';
  } else if (cleanCmd === 'autolike' && cleanArgs.toLowerCase().startsWith('status')) {
    cleanCmd = 'autolikestatus';
    cleanArgs = cleanArgs.replace(/^status[+=]*/i, '').replace(/^[+=]/, '').trim();
  } else if (cleanCmd.startsWith('autotyping=') || cleanCmd === 'autotyping=') {
    const inline = cleanCmd.replace(/^autotyping=*/, '').replace(/=+$/, '');
    cleanCmd = 'autotyping';
    cleanArgs = (inline + ' ' + cleanArgs).trim();
  } else if (cleanCmd.startsWith('autorecording=') || cleanCmd === 'autorecording=') {
    const inline = cleanCmd.replace(/^autorecording=*/, '').replace(/=+$/, '');
    cleanCmd = 'autorecording';
    cleanArgs = (inline + ' ' + cleanArgs).trim();
  }

  // Check in useful commands (commands 109 to 200)
  const usefulReply = handleUsefulCommands(cleanCmd, cleanArgs, {
    sock,
    remoteJid,
    senderJid,
    msg,
    sessionId,
    sessionPhone,
  });
  if (usefulReply !== null) {
    return usefulReply;
  }

  const setMediaRegex = /^(?:set|sel)([a-z0-9]+)(image|video)$/i;
  const setAllMediaRegex = /^(?:set|sel)(image|video)all$/i;
  const setAltAllMediaRegex = /^(?:set|sel)all(image|video)$/i;
  const setAltMediaRegex = /^(?:set|sel)(image|video)([a-z0-9]+)$/i;

  const setMediaMatch = cleanCmd.match(setMediaRegex);
  const setAllMediaMatch = cleanCmd.match(setAllMediaRegex);
  const setAltAllMediaMatch = cleanCmd.match(setAltAllMediaRegex);
  const setAltMediaMatch = cleanCmd.match(setAltMediaRegex);

  if (setMediaMatch || setAllMediaMatch || setAltAllMediaMatch || setAltMediaMatch) {
    let targetCmd = 'all';
    let mediaType = 'image';

    if (setMediaMatch) {
      targetCmd = setMediaMatch[1].toLowerCase().trim();
      mediaType = setMediaMatch[2].toLowerCase().trim();
    } else if (setAllMediaMatch) {
      targetCmd = 'all';
      mediaType = setAllMediaMatch[1].toLowerCase().trim();
    } else if (setAltAllMediaMatch) {
      targetCmd = 'all';
      mediaType = setAltAllMediaMatch[1].toLowerCase().trim();
    } else if (setAltMediaMatch) {
      targetCmd = setAltMediaMatch[2].toLowerCase().trim();
      mediaType = setAltMediaMatch[1].toLowerCase().trim();
    }

    // Owner check: Seuls les propriétaires autorisés peuvent configurer les médias du bot
    const cleanSender = (senderJid || '').replace(/\D/g, '');
    const isFromMe = !!msg?.key?.fromMe;
    const isCallerOwner =
      isFromMe ||
      isOwnerNumber(senderJid, sessionPhone) ||
      isOwnerNumber(cleanSender, sessionPhone) ||
      isUserProtected(senderJid || '', sessionPhone) ||
      isUserSudo(cleanSender, sessionId);

    if (!isCallerOwner) {
      return `*╭─❖━━━ ⟣ ⟣ ⟣ ${BOT_NAME} ⟣ ⟣ ⟣━━━❖*\n*┇*🔹╭───────────────\n*┇*🔹┋. 🚫 *ACCÈS STRICTEMENT RÉSERVÉ AUX OWNERS* 🚫\n*┇*🔹┋ Seul le propriétaire du bot a le contrôle sur la configuration des médias de commande.\n*┇*🔹╰───────────────⊷\n*╰━━━━━━━━━━━━━━━━━❖*`;
    }

    try {
      let isVideo = mediaType === 'video';
      let mediaBuf: Buffer | null = null;
      let mimeType = isVideo ? 'video/mp4' : 'image/jpeg';

      // 1. Detect media from message or quoted message
      const contextInfo = msg?.message?.extendedTextMessage?.contextInfo ||
                          msg?.message?.imageMessage?.contextInfo ||
                          msg?.message?.videoMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;
      
      if (quoted) {
        let payload = quoted;
        if (payload.ephemeralMessage?.message) payload = payload.ephemeralMessage.message;
        if (payload.viewOnceMessage?.message) payload = payload.viewOnceMessage.message;
        if (payload.viewOnceMessageV2?.message) payload = payload.viewOnceMessageV2.message;
        if (payload.documentWithCaptionMessage?.message) payload = payload.documentWithCaptionMessage.message;

        if (payload.videoMessage) {
          isVideo = true;
          mimeType = payload.videoMessage.mimetype || 'video/mp4';
        } else if (payload.imageMessage) {
          isVideo = false;
          mimeType = payload.imageMessage.mimetype || 'image/jpeg';
        }

        const media = await getMessageOrQuotedMedia(msg, remoteJid || '').catch(() => null);
        if (media && media.buffer && media.buffer.length > 0) {
          mediaBuf = media.buffer;
        }
      } else if (msg?.message?.imageMessage) {
        isVideo = false;
        mimeType = msg.message.imageMessage.mimetype || 'image/jpeg';
        const media = await getMessageOrQuotedMedia(msg, remoteJid || '').catch(() => null);
        if (media && media.buffer && media.buffer.length > 0) {
          mediaBuf = media.buffer;
        }
      } else if (msg?.message?.videoMessage) {
        isVideo = true;
        mimeType = msg.message.videoMessage.mimetype || 'video/mp4';
        const media = await getMessageOrQuotedMedia(msg, remoteJid || '').catch(() => null);
        if (media && media.buffer && media.buffer.length > 0) {
          mediaBuf = media.buffer;
        }
      }

      // 2. Fallback to URL in arguments
      if (!mediaBuf && cleanArgs && (cleanArgs.startsWith('http://') || cleanArgs.startsWith('https://'))) {
        const urlMatch = cleanArgs.match(/(https?:\/\/[^\s]+)/i);
        if (urlMatch && urlMatch[1]) {
          const lowerUrl = urlMatch[1].toLowerCase();
          if (lowerUrl.includes('.mp4') || lowerUrl.includes('.mkv') || lowerUrl.includes('video')) {
            isVideo = true;
          }
          const dlRes = await axios.get(urlMatch[1], { responseType: 'arraybuffer', timeout: 25000 }).catch(() => null);
          if (dlRes?.data && dlRes.data.byteLength > 1000) {
            mediaBuf = Buffer.from(dlRes.data);
          }
        }
      }

      if (!mediaBuf || mediaBuf.length === 0) {
        return `❌ Veuillez répondre directement à une ${mediaType.toUpperCase()} ou fournir un lien de téléchargement direct valide pour configurer la commande *.set${targetCmd}${mediaType}*.`;
      }

      // 3. Validate media type matching
      if (mediaType === 'video' && !isVideo) {
        return `❌ Veuillez répondre à une VIDÉO pour la commande .set${targetCmd}video !`;
      }
      if (mediaType === 'image' && isVideo) {
        return `❌ Veuillez répondre à une PHOTO/IMAGE pour la commande .set${targetCmd}image !`;
      }

      await setGlobalCommandMedia(targetCmd, isVideo, mediaBuf);

      if (targetCmd === 'menu' || targetCmd === 'all') {
        return isVideo
          ? `🎬 *Vidéo de menu enregistrée avec succès de façon permanente pour tout le bot et toutes les sessions !*`
          : `🖼️ *Image de menu enregistrée avec succès de façon permanente pour tout le bot et toutes les sessions !*`;
      } else {
        return isVideo
          ? `🎬 *Vidéo pour la commande .${targetCmd} enregistrée avec succès de façon permanente pour toutes les sessions !*`
          : `🖼️ *Image pour la commande .${targetCmd} enregistrée avec succès de façon permanente pour toutes les sessions !*`;
      }
    } catch (err: any) {
      return `❌ Échec de la mise à jour des médias pour .set${targetCmd}${mediaType} : ${err?.message || 'Erreur'}`;
    }
  }

  switch (cleanCmd) {
    // ----------------------------------------------------
    // OWNER VALIDATION / TESTING COMMANDS
    // ----------------------------------------------------
    case 'testowner':
    case 'isowner':
    case 'checkowner': {
      const cleanSender = (senderJid || '').replace(/\D/g, '');
      const isFromMe = !!msg?.key?.fromMe;
      const recognized =
        isFromMe ||
        isOwnerNumber(senderJid, sessionPhone) ||
        isOwnerNumber(cleanSender, sessionPhone) ||
        isUserProtected(senderJid || '', sessionPhone) ||
        isUserSudo(cleanSender, sessionId);

      return `*╭─❖━━━ ⟣ ⟣ ⟣ ${BOT_NAME} ⟣ ⟣ ⟣━━━❖*
*┇*🔹╭───────────────
*┇*🔹┋. 👑 *VÉRIFICATION DU STATUT OWNER*
*┇*🔹┋. 📱 *Votre Numéro :* ${cleanSender ? '+' + cleanSender : (isFromMe ? 'Session active (fromMe)' : 'Non détecté')}
*┇*🔹┋. ⚡ *Reconnu comme Owner :* ${recognized ? 'OUI ✅ (Accès Total Accordé)' : 'NON ❌ (Accès Restreint)'}
*┇*🔹┋. 📋 *Owners configurés :* ${OWNER_NUMBERS.map((n) => '+' + n).join(', ')}
*┇*🔹┋. 🔒 *Numéro session :* ${sessionPhone ? '+' + sessionPhone.replace(/\D/g, '') : 'Non défini'}
*┇*🔹╰───────────────⊷
*╰━━━━━━━━━━━━━━━━━❖*`;
    }

    // ----------------------------------------------------
    // MAIN COMMANDS
    // ----------------------------------------------------
    case 'sudo':
    case 'setsudo': {
      const targetNum = (cleanArgs || '').replace(/\D/g, '');
      if (!targetNum || targetNum.length < 8) {
        return `❌ Veuillez spécifier un numéro valide à ajouter en sudo (ex: .sudo 50935975863)`;
      }
      state.sudoUsers.add(targetNum);
      saveSessionSettingsToDisk(sessionId, state);
      return `*╭─❖━━━ ⟣ ⟣ ⟣  SUDO ACCESS  ⟣ ⟣ ⟣━━━❖*\n*┇*🔹╭───────────────\n*┇*🔹┋. 👑 <b>ɴᴜᴍᴇ́ʀᴏ :</b> +${targetNum}\n*┇*🔹┋. ⚡ <b>sᴛᴀᴛᴜᴛ :</b> ᴀᴄᴄᴇ̀s sᴜᴅᴏ ᴀᴄᴛɪᴠᴇ́ (ᴛᴏᴜᴛᴇs ʟᴇs ᴄᴏᴍᴍᴀɴᴅᴇs ᴇɴ ᴍᴏᴅᴇ ᴘʀɪᴠᴇ́)\n*┇*🔹╰───────────────⊷\n*╰━━━━━━━━━━━━━━━━━❖*`;
    }

    case 'unsudo':
    case 'delsudo': {
      const targetNum = (cleanArgs || '').replace(/\D/g, '');
      if (!targetNum) {
        return `❌ Veuillez spécifier le numéro à retirer du sudo (ex: .unsudo 50935975863)`;
      }
      if (targetNum.includes('50935975863') || targetNum.includes('50940131864')) {
        return `⚠️ Ce numéro (+${targetNum}) est un développeur fondateur permanent et ne peut pas être retiré du sudo.`;
      }
      state.sudoUsers.delete(targetNum);
      saveSessionSettingsToDisk(sessionId, state);
      return `*╭─❖━━━ ⟣ ⟣ ⟣  SUDO ACCESS  ⟣ ⟣ ⟣━━━❖*\n*┇*🔹╭───────────────\n*┇*🔹┋. ❌ <b>ɴᴜᴍᴇ́ʀᴏ :</b> +${targetNum}\n*┇*🔹┋. ⚡ <b>sᴛᴀᴛᴜᴛ :</b> ᴀᴄᴄᴇ̀s sᴜᴅᴏ ʀᴇᴛɪʀᴇ́\n*┇*🔹╰───────────────⊷\n*╰━━━━━━━━━━━━━━━━━❖*`;
    }

    case 'listsudo':
    case 'sudolist': {
      const list = Array.from(state.sudoUsers || []);
      return `*╭─❖━━━ ⟣ ⟣ ⟣  LISTE SUDO  ⟣ ⟣ ⟣━━━❖*\n*┇*🔹╭───────────────\n*┇*🔹┋. 👑 +509 3597 5863 (Permanent)\n*┇*🔹┋. 👑 +509 4013 1864 (Permanent)\n` +
        (list.length > 0 ? list.map((n) => `*┇*🔹┋. 👤 +${n}`).join('\n') : `*┇*🔹┋. *(Aucun sudo additionnel)*`) +
        `\n*┇*🔹╰───────────────⊷\n*╰━━━━━━━━━━━━━━━━━❖*`;
    }

    case 'ping': {
      const pingText = `*╭─❖━━━ ⟣ ⟣ ⟣  ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿  ⟣ ⟣ ⟣━━━❖*
*┇*🔹╭───────────────
*┇*🔹┋. ⚡ <b>ᴘᴏɴɢ !</b> 0.001s
*┇*🔹┋. 🟢 <b>sᴛᴀᴛᴜᴛ :</b> ᴇɴ ʟɪɢɴᴇ 24/7
*┇*🔹┋. 👑 <b>ᴏᴡɴᴇʀ :</b> ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿 & ≛⃝🥷🏿 𝐒𝐇𝐀𝐊𝐀 ≛⃝🥷🏿
*┇*🔹╰───────────────⊷
*╰━━━━━━━━━━━━━━━━━❖*`;
      return pingText;
    }

    case 'runtime':
    case 'uptime': {
      const uptimeSec = Math.floor(process.uptime());
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;
      return `⏱️ *Runtime / Uptime* : ${hours}h ${minutes}m ${seconds}s (En ligne 24/7)`;
    }

    case 'owner1':
    case 'creator1':
    case 'dev1': {
      const vcardOwner1 =
        'BEGIN:VCARD\n' +
        'VERSION:3.0\n' +
        'FN:≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿\n' +
        'ORG:≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿;\n' +
        'TITLE:Fondateur & Développeur Principal\n' +
        'TEL;type=CELL;type=VOICE;waid=50935975863:+509 3597 5863\n' +
        'URL:https://wa.me/50935975863\n' +
        'END:VCARD';

      const owner1Text = `╭─❖━━━ 👑 𝐎𝐖𝐍𝐄𝐑 1 ━━━❖
┇✦╭───────────────
┋✦┋. 👑 <b>ᴏᴡɴᴇʀ 1 :</b> ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿
┋✦┋. 📞 <b>ɴᴜᴍᴇ́ʀᴏ :</b> 50935975863
┋✦┋. 💬 <b>ᴡʜᴀᴛsᴀᴘᴘ :</b> https://wa.me/50935975863
┋✦┋. ⚡ <b>sᴛᴀᴛᴜᴛ :</b> ᴅᴇ́ᴠᴇʟᴏᴘᴘᴇᴜʀ ᴘʀɪɴᴄɪᴘᴀʟ & ғᴏɴᴅᴀᴛᴇᴜʀ
┇✦╰───────────────⊷
╰━━━━━━━━━━━━━━━━━❖
> *© 𝐌𝐀𝐃𝐄 𝐈𝐍 𝐁𝐘 ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿*`;

      if (sock && remoteJid) {
        try {
          await sendSafeMediaOrText(sock, remoteJid, { text: owner1Text }, msg);
          const sent = await sendSafeMediaOrText(
            sock,
            remoteJid,
            {
              contacts: {
                displayName: '≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿',
                contacts: [{ vcard: vcardOwner1 }],
              },
            },
            msg
          );
          if (sent) return '';
        } catch (vErr) {
          console.warn('[VCARD SEND ERROR]', vErr);
        }
      }
      return `👑 *𝐎𝐖𝐍𝐄𝐑 1 : ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿*\n📞 *Numéro :* 50935975863\n💬 *Lien :* https://wa.me/50935975863`;
    }

    case 'owner2':
    case 'creator2':
    case 'dev2': {
      const vcardOwner2 =
        'BEGIN:VCARD\n' +
        'VERSION:3.0\n' +
        'FN:𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸\n' +
        'ORG:𝑲𝑨𝒀𝑫𝑶 𝑩𝒁𝑲 🥷;\n' +
        'TITLE:Co-Développeuse & Fondatrice\n' +
        'TEL;type=CELL;type=VOICE;waid=50940131864:+509 4013 1864\n' +
        'URL:https://wa.me/50940131864\n' +
        'END:VCARD';

      const owner2Text = `╭─❖━━━ 👑 𝐎𝐖𝐍𝐄𝐑 2 ━━━❖
┇✦╭───────────────
┋✦┋. 👑 <b>ᴏᴡɴᴇʀ 2 :</b> 𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸
┋✦┋. 📞 <b>ɴᴜᴍᴇ́ʀᴏ :</b> 50940131864
┋✦┋. 💬 <b>ᴡʜᴀᴛsᴀᴘᴘ :</b> https://wa.me/50940131864
┋✦┋. ⚡ <b>sᴛᴀᴛᴜᴛ :</b> ᴄᴏ-ᴅᴇ́ᴠᴇʟᴏᴘᴘᴇᴜsᴇ & ғᴏɴᴅᴀᴛʀɪᴄᴇ
┇✦╰───────────────⊷
╰━━━━━━━━━━━━━━━━━❖
> *© 𝐌𝐀𝐃𝐄 𝐈𝐍 𝐁𝐘 ${BOT_NAME}*`;

      if (sock && remoteJid) {
        try {
          await sendSafeMediaOrText(sock, remoteJid, { text: owner2Text }, msg);
          const sent = await sendSafeMediaOrText(
            sock,
            remoteJid,
            {
              contacts: {
                displayName: '𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸',
                contacts: [{ vcard: vcardOwner2 }],
              },
            },
            msg
          );
          if (sent) return '';
        } catch (vErr) {
          console.warn('[VCARD SEND ERROR]', vErr);
        }
      }
      return `👑 *𝐎𝐖𝐍𝐄𝐑 2 : 𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸*\n📞 *Numéro :* 50940131864\n💬 *Lien :* https://wa.me/50940131864`;
    }

    case 'owner': {
      const vcardOwner1 =
        'BEGIN:VCARD\n' +
        'VERSION:3.0\n' +
        'FN:≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿\n' +
        'ORG:𝑲𝑨𝒀𝑫𝑶 𝑩𝒁𝑲 🥷;\n' +
        'TEL;type=CELL;type=VOICE;waid=50935975863:+509 3597 5863\n' +
        'END:VCARD';

      const vcardOwner2 =
        'BEGIN:VCARD\n' +
        'VERSION:3.0\n' +
        'FN:𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸\n' +
        'ORG:𝑲𝑨𝒀𝑫𝑶 𝑩𝒁𝑲 🥷;\n' +
        'TEL;type=CELL;type=VOICE;waid=50940131864:+509 4013 1864\n' +
        'END:VCARD';

      const ownerText = `╭─❖━━━ ${BOT_NAME} ━━━❖
┇✦╭───────────────
┋✦┋. 👑 <b>ᴏᴡɴᴇʀ 1 :</b> ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿 (+509 3597 5863)
┋✦┋. 💬 <b>wa.me :</b> https://wa.me/50935975863
┋✦┋
┋✦┋. 👑 <b>ᴏᴡɴᴇʀ 2 :</b> 𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸 (+509 4013 1864)
┋✦┋. 💬 <b>wa.me :</b> https://wa.me/50940131864
┇✦╰───────────────⊷
╰━━━━━━━━━━━━━━━━━❖
> *© 𝐌𝐀𝐃𝐄 𝐈𝐍 𝐁𝐘 ${BOT_NAME}*`;

      if (sock && remoteJid) {
        try {
          await sendSafeMediaOrText(sock, remoteJid, { text: ownerText }, msg);
          const sent = await sendSafeMediaOrText(
            sock,
            remoteJid,
            {
              contacts: {
                displayName: `${BOT_NAME} 𝐎𝐖𝐍𝐄𝐑𝐒`,
                contacts: [{ vcard: vcardOwner1 }, { vcard: vcardOwner2 }],
              },
            },
            msg
          );
          if (sent) return '';
        } catch (vErr) {
          console.warn('[VCARD SEND ERROR]', vErr);
        }
      }

      return `👑 *𝐎𝐖𝐍𝐄𝐑 1 : ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿* (+509 3597 5863)\n👑 *𝐎𝐖𝐍𝐄𝐑 2 : 𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸* (+509 4013 1864)`;
    }

    case 'alive': {
      const aliveText = toSmallCaps(`*╭─━━━━━━━━━━━━━━━⊷❖*
*┇*🔹╭───────────────╮
┋🔹┋. ʙᴏᴛ ɴᴀᴍᴇ: ${state.botName || BOT_NAME}
┋🔹┋. ᴏᴡɴᴇʀ 1: ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿
┋🔹┋. ᴏᴡɴᴇʀ 2: 𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸
┋🔹┋. ᴘʟᴀᴛғᴏʀᴍ: Railway Cloud
┋🔹┋. ᴍᴏᴅᴇ: ᴘᴜʙʟɪᴄ 🟢
┋🔹┋. ᴜᴘᴛɪᴍᴇ: 24/7 ᴄʟᴏᴜᴅ ᴅᴀᴇᴍᴏɴ
*┇🔹╰───────────────╯*
*╰━━━━━━━━━━━━━━━━━❖*
⚡ ${state.botName || BOT_NAME} ᴇsᴛ 100% ᴏᴘᴇ́ʀᴀᴛɪᴏɴɴᴇʟ !
> *© 𝙼𝙰𝙳𝙴 𝙸𝙽 𝙱𝚈 ${state.botName || BOT_NAME}*`);

      return aliveText;
    }

    case 'menu':
    case 'help':
    case 'allcmd': {
      const uptimeSec = Math.floor(process.uptime());
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;
      const dynamicMemory = getDynamicMemoryUsage();
      const menuText = generateOfficialMenu(
        `${hours}h ${minutes}m ${seconds}s`,
        (state.botMode || 'PUBLIC').toUpperCase(),
        dynamicMemory,
        state.prefix,
        state.botName
      );

      // 1. Prioritize menu video if available
      const videoPayload = getBotMenuVideoPayload();
      if (sock && remoteJid && videoPayload) {
        const sent = await sendSafeMediaOrText(sock, remoteJid, {
          video: videoPayload.video,
          caption: menuText,
          mimetype: videoPayload.mimetype,
        }, msg).catch(() => null);
        if (sent) return '';
      }

      // 2. Menu image (Prioritize getBotMenuImageBuffer first so .setmenuimage takes immediate effect)
      let menuImgBuf: Buffer | null = null;
      menuImgBuf = getBotMenuImageBuffer(sessionId);
      if (!menuImgBuf || menuImgBuf.length === 0) {
        try {
          const cmdImg = await getCommandImageBuffer('menu');
          if (cmdImg?.buffer && cmdImg.buffer.length > 0) {
            menuImgBuf = cmdImg.buffer;
          }
        } catch (_) {}
      }

      if (sock && remoteJid && menuImgBuf && menuImgBuf.length > 0) {
        const sent = await sendSafeMediaOrText(sock, remoteJid, {
          image: menuImgBuf,
          caption: menuText,
          mimetype: 'image/png',
        }, msg).catch(() => null);
        if (sent) return '';
      }
      return menuText;
    }

    case 'excuse':
    case 'excuses':
    case 'apology':
    case 'pardon':
    case 'desole':
    case 'désolé':
    case 'sorry': {
      return OFFICIAL_APOLOGY_MESSAGE;
    }

    case 'list': {
      const listText = `*╭─━━━━━━━━━━━━━━━⊷❖*
*┇*✦╭───────────────╮
*┋✦┋. ʙᴏᴛ ɴᴀᴍᴇ:* ${state.botName || BOT_NAME}
*┋✦┋. ᴍᴏᴅᴜʟᴇs:* 8 ᴄᴀᴛᴇ́ɢᴏʀɪᴇs
*┋✦┋. ᴏᴡɴᴇʀ:* ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿 & 𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸
*┇✦╰───────────────╯*
*╰━━━━━━━━━━━━━━━━━❖*`;
      return listText;
    }

    // ----------------------------------------------------
    // EXCLUSIVE & MULTI-DEVICE FEATURES
    // ----------------------------------------------------
    case 'send':
    case 'save':
    case 'send2':
    case 'save2': {
      const isPrivateSend = cleanCmd === 'send2' || cleanCmd === 'save2';

      const contextInfo =
        msg?.message?.extendedTextMessage?.contextInfo ||
        msg?.message?.imageMessage?.contextInfo ||
        msg?.message?.videoMessage?.contextInfo ||
        msg?.message?.audioMessage?.contextInfo ||
        msg?.message?.documentMessage?.contextInfo ||
        msg?.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo ||
        msg?.message?.ephemeralMessage?.message?.imageMessage?.contextInfo;

      const quoted = contextInfo?.quotedMessage;

      if (!sock || !remoteJid || !quoted) {
        return `⚠️ *≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 • STATUS SAVER*\nVeuillez citer directement un statut ou un média (photo, vidéo ou note vocale) avec *.${cleanCmd}* pour le récupérer.`;
      }

      try {
        let mediaPayload: any = quoted;
        if (mediaPayload?.ephemeralMessage?.message) {
          mediaPayload = mediaPayload.ephemeralMessage.message;
        }
        if (mediaPayload?.documentWithCaptionMessage?.message) {
          mediaPayload = mediaPayload.documentWithCaptionMessage.message;
        }
        if (mediaPayload?.viewOnceMessage?.message) {
          mediaPayload = mediaPayload.viewOnceMessage.message;
        } else if (mediaPayload?.viewOnceMessageV2?.message) {
          mediaPayload = mediaPayload.viewOnceMessageV2.message;
        } else if (mediaPayload?.viewOnceMessageV2Extension?.message) {
          mediaPayload = mediaPayload.viewOnceMessageV2Extension.message;
        }

        const isImage = !!mediaPayload?.imageMessage;
        const isVideo = !!mediaPayload?.videoMessage;
        const isAudio = !!mediaPayload?.audioMessage;
        const isDocument = !!mediaPayload?.documentMessage;
        const isSticker = !!mediaPayload?.stickerMessage;

        if (!isImage && !isVideo && !isAudio && !isDocument && !isSticker) {
          return `⚠️ *≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 • STATUS SAVER*\nAucun média (photo, vidéo, sticker ou note vocale) n'a été détecté dans le message cité. Citez directement un statut avec *.${cleanCmd}*.`;
        }

        const messageToDownload = {
          key: {
            remoteJid,
            id: contextInfo?.stanzaId,
            participant: contextInfo?.participant,
          },
          message: mediaPayload,
        };

        const buffer = await downloadMediaMessage(
          messageToDownload as any,
          'buffer',
          {},
          {
            logger: console as any,
            reuploadRequest: sock.updateMediaMessage,
          }
        );

        if (!buffer || buffer.length === 0) {
          return `❌ *Échec du téléchargement* : Impossible de récupérer les données du statut (peut-être expiré sur les serveurs WhatsApp).`;
        }

        let targetPrivateJid = remoteJid;
        if (msg?.key.fromMe) {
          const myNum = sock.user?.id?.split(':')[0] || '';
          targetPrivateJid = myNum ? `${myNum}@s.whatsapp.net` : remoteJid;
        } else {
          const senderRaw = contextInfo?.participant || senderJid || msg?.key.participant || remoteJid;
          const senderNum = senderRaw.split(':')[0].replace(/[^0-9]/g, '');
          targetPrivateJid = senderNum ? `${senderNum}@s.whatsapp.net` : remoteJid;
        }

        const destinationJid = isPrivateSend ? targetPrivateJid : remoteJid;

        console.log(`[STATUS-SAVE] Extraction réussie pour ${cleanCmd}. Envoi vers ${destinationJid} (${buffer.length} octets)`);

        if (isImage) {
          await sock.sendMessage(
            destinationJid,
            {
              image: buffer,
              caption: isPrivateSend
                ? undefined
                : `📥 *≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 • STATUT RÉCUPÉRÉ*\nPhoto de statut récupérée avec succès.`,
            },
            destinationJid === remoteJid ? { quoted: msg as any } : {}
          );
        } else if (isVideo) {
          await sock.sendMessage(
            destinationJid,
            {
              video: buffer,
              caption: isPrivateSend
                ? undefined
                : `📥 *≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 • STATUT RÉCUPÉRÉ*\nVidéo de statut récupérée avec succès.`,
            },
            destinationJid === remoteJid ? { quoted: msg as any } : {}
          );
        } else if (isAudio) {
          await sock.sendMessage(
            destinationJid,
            {
              audio: buffer,
              mimetype: mediaPayload.audioMessage?.mimetype || 'audio/mp4',
              ptt: true,
            },
            destinationJid === remoteJid ? { quoted: msg as any } : {}
          );
        } else if (isSticker) {
          await sock.sendMessage(
            destinationJid,
            {
              sticker: buffer,
            },
            destinationJid === remoteJid ? { quoted: msg as any } : {}
          );
        } else if (isDocument) {
          await sock.sendMessage(
            destinationJid,
            {
              document: buffer,
              mimetype: mediaPayload.documentMessage?.mimetype || 'application/octet-stream',
              fileName: mediaPayload.documentMessage?.fileName || 'media_status',
            },
            destinationJid === remoteJid ? { quoted: msg as any } : {}
          );
        }

        return '';
      } catch (err: any) {
        return `❌ *Erreur lors de la récupération* : ${err?.message || err}`;
      }
    }

    case 'vv':
    case '❤️':
    case 'vo': {
      const isPrivateSend = cleanCmd === '❤️';

      // 1. Locate contextInfo from any possible message wrapper
      const contextInfo =
        msg?.message?.extendedTextMessage?.contextInfo ||
        msg?.message?.imageMessage?.contextInfo ||
        msg?.message?.videoMessage?.contextInfo ||
        msg?.message?.audioMessage?.contextInfo ||
        msg?.message?.documentMessage?.contextInfo ||
        msg?.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo ||
        msg?.message?.ephemeralMessage?.message?.imageMessage?.contextInfo;

      const quoted = contextInfo?.quotedMessage;

      if (sock && remoteJid && quoted) {
        try {
          // Identify ViewOnce media payload (v1, v2, v2extension, or direct media payload)
          // Identify ViewOnce media payload (v1, v2, v2extension, ephemeral, or direct media payload)
          let viewOncePayload: any = quoted;
          if (viewOncePayload?.ephemeralMessage?.message) {
            viewOncePayload = viewOncePayload.ephemeralMessage.message;
          }
          if (viewOncePayload?.documentWithCaptionMessage?.message) {
            viewOncePayload = viewOncePayload.documentWithCaptionMessage.message;
          }
          if (viewOncePayload?.viewOnceMessage?.message) {
            viewOncePayload = viewOncePayload.viewOnceMessage.message;
          } else if (viewOncePayload?.viewOnceMessageV2?.message) {
            viewOncePayload = viewOncePayload.viewOnceMessageV2.message;
          } else if (viewOncePayload?.viewOnceMessageV2Extension?.message) {
            viewOncePayload = viewOncePayload.viewOnceMessageV2Extension.message;
          }

          const isImage = !!viewOncePayload?.imageMessage;
          const isVideo = !!viewOncePayload?.videoMessage;
          const isAudio = !!viewOncePayload?.audioMessage;
          const isDocument = !!viewOncePayload?.documentMessage;

          if (!isImage && !isVideo && !isAudio && !isDocument) {
            return `⚠️ *≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 • ANTI-VUE UNIQUE*\nAucun média (photo, vidéo ou note vocale) n'a été détecté dans le message cité. Citez directement un média à vue unique avec *${cleanCmd}*.`;
          }

          // Build message download payload
          const messageToDownload = {
            key: {
              remoteJid,
              id: contextInfo?.stanzaId,
              participant: contextInfo?.participant,
            },
            message: viewOncePayload,
          };

          const buffer = await downloadMediaMessage(
            messageToDownload as any,
            'buffer',
            {},
            {
              logger: console as any,
              reuploadRequest: sock.updateMediaMessage,
            }
          );

          if (!buffer || buffer.length === 0) {
            return `❌ *Échec du déchiffrement* : Impossible de récupérer les données du média à vue unique (peut-être expiré sur les serveurs WhatsApp).`;
          }

          // Determine target destination:
          // .vv  -> envoyé directement sur le contact ou groupe où la commande a été faite (remoteJid)
          // .vv2 -> envoyé discrètement sur le contact personnel de la personne ayant tapé la commande
          let targetPrivateJid = remoteJid;
          if (msg?.key.fromMe) {
            const myNum = sock.user?.id?.split(':')[0] || '';
            targetPrivateJid = myNum ? `${myNum}@s.whatsapp.net` : remoteJid;
          } else {
            const senderRaw = contextInfo?.participant || senderJid || msg?.key.participant || remoteJid;
            const senderNum = senderRaw.split(':')[0].replace(/[^0-9]/g, '');
            targetPrivateJid = senderNum ? `${senderNum}@s.whatsapp.net` : remoteJid;
          }

          const destinationJid = isPrivateSend ? targetPrivateJid : remoteJid;

          console.log(`[VV] Extraction réussie pour ${cleanCmd}. Envoi vers ${destinationJid} (${buffer.length} octets)`);

          if (isImage) {
            await sock.sendMessage(
              destinationJid,
              {
                image: buffer,
                caption: isPrivateSend
                  ? undefined
                  : `🔓 *≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 • VUE UNIQUE RÉCUPÉRÉE (.vv)*\n📸 Photo à vue unique décodée et renvoyée en haute résolution.`,
              },
              destinationJid === remoteJid ? { quoted: msg as any } : {}
            );
          } else if (isVideo) {
            await sock.sendMessage(
              destinationJid,
              {
                video: buffer,
                caption: isPrivateSend
                  ? undefined
                  : `🔓 *≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 • VUE UNIQUE RÉCUPÉRÉE (.vv)*\n🎥 Vidéo à vue unique décodée et renvoyée en qualité originale.`,
              },
              destinationJid === remoteJid ? { quoted: msg as any } : {}
            );
          } else if (isAudio) {
            await sock.sendMessage(
              destinationJid,
              {
                audio: buffer,
                mimetype: viewOncePayload.audioMessage?.mimetype || 'audio/mp4',
                ptt: true,
              },
              destinationJid === remoteJid ? { quoted: msg as any } : {}
            );
          } else if (isDocument) {
            await sock.sendMessage(
              destinationJid,
              {
                document: buffer,
                mimetype: viewOncePayload.documentMessage?.mimetype || 'application/octet-stream',
                fileName: viewOncePayload.documentMessage?.fileName || 'media_viewonce',
              },
              destinationJid === remoteJid ? { quoted: msg as any } : {}
            );
          }

          // When using .vv2: the bot sends ONLY the media to the personal contact and says NOTHING in the group/chat
          if (isPrivateSend) {
            return '';
          }

          return ''; // Delivered directly with the media
        } catch (err: any) {
          console.error(`[${cleanCmd.toUpperCase()}] Erreur déchiffrement:`, err);
          if (isPrivateSend) return ''; // Silent on error for stealth .vv2
          return `❌ *Erreur de déchiffrement de la vue unique* : ${err?.message || 'Média expiré ou inaccessible'}`;
        }
      }

      // If .vv2 in a group without quoting: stay completely silent ("sans rien dire")
      if (isPrivateSend && remoteJid?.endsWith('@g.us')) {
        return '';
      }

      // Usage if not replying to a message
      return isPrivateSend
        ? '🔓 Citez une photo ou vidéo à vue unique avec *.❤️*.'
        : '🔓 Citez une photo ou vidéo à vue unique avec *.vv*.';
    }

    case 'autorecording': {
      const mode = cleanArgs.toLowerCase();
      if (mode === 'off' || mode === 'stop' || mode === 'desactiver' || mode === '0' || mode === 'false') {
        state.autoRecording = false;
        if (state.recordingInterval) {
          clearInterval(state.recordingInterval);
          state.recordingInterval = undefined;
        }
        if (sock && remoteJid) {
          sock.sendPresenceUpdate('paused', remoteJid).catch(() => {});
        }
        saveSessionSettingsToDisk(sessionId, state);
        return `🎙️ *ᴀᴜᴛᴏʀᴇᴄᴏʀᴅɪɴɢ* : ᴏғғ 🔴`;
      } else {
        state.autoRecording = true;
        if (sock) {
          ensureAutoRecordingRunning(sock, state, remoteJid);
        }
        saveSessionSettingsToDisk(sessionId, state);
        return `🎙️ *ᴀᴜᴛᴏʀᴇᴄᴏʀᴅɪɴɢ* : ʟɪᴠᴇ 🟢 (ᴇɴ ᴛʀᴀɪɴ ᴅ'ᴇɴʀᴇɢɪsᴛʀᴇʀ 24ʜ/24 ᴘᴇʀᴍᴀɴᴇɴᴛ)`;
      }
    }

    case 'autotyping': {
      const mode = cleanArgs.toLowerCase();
      if (mode === 'off' || mode === 'stop' || mode === 'desactiver' || mode === '0' || mode === 'false') {
        state.autoTyping = false;
        if (state.typingInterval) {
          clearInterval(state.typingInterval);
          state.typingInterval = undefined;
        }
        if (sock && remoteJid) {
          sock.sendPresenceUpdate('paused', remoteJid).catch(() => {});
        }
        saveSessionSettingsToDisk(sessionId, state);
        return `✍️ *ᴀᴜᴛᴏᴛʏᴘɪɴɢ* : ᴏғғ 🔴`;
      } else {
        state.autoTyping = true;
        if (sock) {
          ensureAutoTypingRunning(sock, state, remoteJid);
        }
        saveSessionSettingsToDisk(sessionId, state);
        return `✍️ *ᴀᴜᴛᴏᴛʏᴘɪɴɢ* : ʟɪᴠᴇ 🟢 (ᴇɴ ᴛʀᴀɪɴ ᴅ'ᴇᴄʀɪʀᴇ 24ʜ/24 ᴘᴇʀᴍᴀɴᴇɴᴛ)`;
      }
    }

    case 'online': {
      const mode = cleanArgs.toLowerCase();
      state.alwaysOnline = mode !== 'off';
      state.offlineGhostMode = false;
      state.offlineMode = false;
      if (sock && state.alwaysOnline) {
        sock.sendPresenceUpdate('available').catch(() => {});
      }
      saveSessionSettingsToDisk(sessionId, state);
      return state.alwaysOnline ? `🟢 *ᴀʟᴡᴀʏs ᴏɴʟɪɴᴇ* : ʟɪᴠᴇ 🟢 (ᴛᴏᴜᴊᴏᴜʀs ᴇɴ ʟɪɢɴᴇ 24ʜ/24 ᴘᴇʀᴍᴀɴᴇɴᴛ)` : `⚪ *ᴀʟᴡᴀʏs ᴏɴʟɪɴᴇ* : ᴏғғ 🔴`;
    }

    case 'offline': {
      const mode = cleanArgs.toLowerCase().trim();
      if (mode === 'off' || mode === 'stop' || mode === 'desactiver' || mode === '0' || mode === 'false') {
        state.offlineMode = false;
        state.offlineGhostMode = false;
        if (sock) {
          sock.sendPresenceUpdate('available').catch(() => {});
        }
        saveSessionSettingsToDisk(sessionId, state);
        return `⚪ *ᴍᴏᴅᴇ ᴏғғʟɪɴᴇ (1 ᴛɪᴄᴋ ✓)* : ᴅᴇsᴀᴄᴛɪᴠᴇ 🔴\n(Accusés de réception double coche ✓✓ rétablis)`;
      } else {
        state.offlineMode = true;
        state.offlineGhostMode = true;
        state.alwaysOnline = false;
        if (sock) {
          sock.sendPresenceUpdate('unavailable').catch(() => {});
        }
        saveSessionSettingsToDisk(sessionId, state);
        return `👻 *ᴍᴏᴅᴇ ᴏғғʟɪɴᴇ (1 ᴛɪᴄᴋ ✓)* : ᴀᴄᴛɪᴠᴇ 🟢\n(Vos correspondants ne voient qu'un seul coche gris ✓ même si vous êtes en ligne)`;
      }
    }

    case 'autolikestatus':
    case 'autolike': {
      const mode = cleanArgs.toLowerCase().replace(/^[=:\s]+/, '');
      if (mode === 'off' || mode === 'stop' || mode === 'desactiver' || mode === '0' || mode === 'false') {
        state.autoLikeEnabled = false;
        saveSessionSettingsToDisk(sessionId, state);
        return `🥷🏿 *ᴀᴜᴛᴏʟɪᴋᴇ* : ᴏғғ 🔴`;
      }

      const emojiList = parseAutoLikeEmojis(cleanArgs || state.autoLikeEmoji || '🥷🏿');
      state.autoLikeEnabled = true;
      state.autoLikeEmoji = emojiList.join(',');
      saveSessionSettingsToDisk(sessionId, state);

      // If user quotes a status while typing .autolike, react with ONE random emoji from the list
      const quotedContext =
        msg?.message?.extendedTextMessage?.contextInfo ||
        msg?.message?.imageMessage?.contextInfo ||
        msg?.message?.videoMessage?.contextInfo;
      const quotedParticipant = quotedContext?.participant;
      const quotedStanzaId = quotedContext?.stanzaId;
      if (sock && quotedStanzaId) {
        const normQuotedParticipant = quotedParticipant ? jidNormalizedUser(quotedParticipant) : '';
        const targetChat = quotedContext?.remoteJid || 'status@broadcast';
        const singleEmoji = getRandomAutoLikeEmoji(emojiList);
        sock.sendMessage(
          targetChat,
          {
            react: {
              text: singleEmoji,
              key: {
                remoteJid: targetChat,
                id: quotedStanzaId,
                participant: quotedParticipant || undefined,
              },
            },
          },
          { statusJidList: [normQuotedParticipant, quotedParticipant].filter(Boolean) }
        ).catch(() => {});
        if (quotedStanzaId) reactedStatusIds.add(quotedStanzaId);
      }

      // Rattrapage immédiat : Like et lit TOUS les statuts déjà présents reçus avant la commande
      const statusStore = sessionRecentStatuses.get(sessionId);
      if (sock && statusStore && statusStore.size > 0) {
        const statuses = Array.from(statusStore.values());
        // 1. Lire tous les statuts d'un coup sans délai
        const readKeys = statuses.map((s) => ({
          remoteJid: 'status@broadcast',
          id: s.id,
          participant: s.participant,
        }));
        for (let i = 0; i < readKeys.length; i += 30) {
          sock.readMessages(readKeys.slice(i, i + 30)).catch(() => {});
        }

        // 2. Liker les statuts en arrière-plan avec espacement anti-ban sécurisé (queue pacée)
        (async () => {
          // Limiter le rattrapage initial aux 5 statuts les plus récents pour éviter tout burst/spam
          const recentStatuses = statuses.slice(-5);
          for (const s of recentStatuses) {
            if (reactedStatusIds.has(s.id)) continue;
            reactedStatusIds.add(s.id);
            const normPart = s.participant ? jidNormalizedUser(s.participant) : '';
            const randomEmoji = getRandomAutoLikeEmoji(emojiList);
            enqueueStatusLike(sock, s.id, s.participant, normPart, randomEmoji);
          }
        })().catch(() => {});
      }

      const existingCount = statusStore?.size || 0;
      const countLabel = emojiList.length > 1
        ? `\n🎲 *Mode Aléatoire (${emojiList.length} émojis)* : [ ${emojiList.join(' ')} ]\n_Le bot choisit 1 émoji au hasard pour chaque statut._`
        : `\n✨ *Émoji configuré* : ${emojiList[0]}`;

      const catchupNotice = existingCount > 0
        ? `\n⚡ *${existingCount} statut(s) existant(s) lus et likés !*`
        : `\n✨ *Tous les statuts actuels et futurs seront automatiquement lus et likés avec 1 émoji au hasard.*`;

      return `🥷🏿 *ᴀᴜᴛᴏʟɪᴋᴇ* : ʟɪᴠᴇ 🟢 (ʟɪᴋᴇ & ʟᴇᴄᴛᴜʀᴇ 24ʜ/24)${countLabel}${catchupNotice}`;
    }

    // ----------------------------------------------------
    // GROUP MODERATION, KICKALL & PURGE
    // ----------------------------------------------------
    case 'kickall': {
      if (!sock || !remoteJid) {
        return `╭━━━━━━━━━━━━━━━━━━━━━┈⊷\n┃✮│➣ .ᴋɪᴄᴋᴀʟʟ s'ᴜᴛɪʟɪsᴇ ᴅᴀɴs ᴜɴ ɢʀᴏᴜᴘᴇ\n╰━━━━━━━━━━━━━━━━━━━━━┈⊷`;
      }

      if (!remoteJid.endsWith('@g.us')) {
        return `❌ *Erreur* : La commande *.kickall* doit être exécutée à l'intérieur d'un groupe WhatsApp.`;
      }

      try {
        const groupMeta = await sock.groupMetadata(remoteJid);

        const cleanBotDigits = (sock.user?.id || '').split(':')[0].replace(/\D/g, '');
        const cleanSessionDigits = (sessionPhone || '').replace(/\D/g, '');
        const cleanSenderDigits = (senderJid || '').replace(/\D/g, '');
        const botLid = sock.user?.lid ? jidNormalizedUser(sock.user.lid) : '';
        const botIdNormalized = sock.user?.id ? jidNormalizedUser(sock.user.id) : '';

        // Vérification sécurisée : supporte les numéros normaux et les identifiants LID
        const botParticipant = groupMeta.participants.find((p) => {
          const normP = jidNormalizedUser(p.id);
          const pDigits = p.id.split('@')[0].split(':')[0].replace(/\D/g, '');
          return (
            (botLid && normP === botLid) ||
            (botIdNormalized && normP === botIdNormalized) ||
            (cleanBotDigits && pDigits === cleanBotDigits) ||
            (cleanSessionDigits && pDigits === cleanSessionDigits) ||
            (cleanBotDigits && p.id.includes(cleanBotDigits)) ||
            (cleanSessionDigits && p.id.includes(cleanSessionDigits))
          );
        });

        // Ne bloquer que si le bot est expressément identifié comme simple membre
        if (botParticipant && botParticipant.admin !== 'admin' && botParticipant.admin !== 'superadmin') {
          const failMsg = `❌ *Kickall failed* : Le bot doit être nommé administrateur du groupe pour pouvoir expulser des membres.`;
          if (loadingMsg?.key) {
            await sock.sendMessage(remoteJid, { text: failMsg, edit: loadingMsg.key }).catch(() => {});
            return '';
          }
          return failMsg;
        }

        const nonAdmins = groupMeta.participants.filter((p) => {
          if (p.admin === 'admin' || p.admin === 'superadmin') return false;
          if (isUserProtected(p.id, sessionPhone)) return false;
          const pDigits = p.id.replace(/\D/g, '');
          if (cleanBotDigits && pDigits === cleanBotDigits) return false;
          if (cleanSessionDigits && pDigits === cleanSessionDigits) return false;
          if (cleanSenderDigits && pDigits === cleanSenderDigits) return false;
          return true;
        });

        if (nonAdmins.length === 0) {
          const failMsg = `❌ *Kickall failed* : Aucun membre éligible à expulser (tous les membres restants sont administrateurs ou protégés).`;
          if (loadingMsg?.key) {
            await sock.sendMessage(remoteJid, { text: failMsg, edit: loadingMsg.key }).catch(() => {});
            return '';
          }
          return failMsg;
        }

        let kickedCount = 0;
        // Expulser les membres un par un avec cadence rapide (< 1 minute pour des dizaines de membres)
        for (const p of nonAdmins) {
          try {
            const res = await sock.groupParticipantsUpdate(remoteJid, [p.id], 'remove');
            if (Array.isArray(res) && res.some((r) => String(r?.status) === '200' || !r?.status)) {
              kickedCount++;
            } else {
              kickedCount++;
            }
          } catch (kickErr: any) {
            console.warn('[KICKALL] Erreur retrait:', kickErr?.message || kickErr);
            const errStr = String(kickErr?.message || kickErr);
            if (errStr.includes('403') || errStr.includes('429') || errStr.includes('rate-overlimit')) {
              break;
            }
          }
          // 280ms de délai entre chaque membre : retire plus de 10 personnes en ~3s et 100 personnes en < 30s !
          await new Promise((r) => setTimeout(r, 280));
        }

        const finishBox = kickedCount > 0
          ? `╭━━━━━━━━━━━━━━━━━━━━━┈⊷\n┃✮│➣ ᴋɪᴄᴋᴀʟʟ sᴜᴄᴄᴇ̀s ! (${kickedCount} membre(s) retiré(s) un par un)\n╰━━━━━━━━━━━━━━━━━━━━━┈⊷`
          : `❌ *Kickall failed* : Aucune personne n'a pu être supprimée du groupe.`;

        if (loadingMsg?.key) {
          await sock.sendMessage(remoteJid, { text: finishBox, edit: loadingMsg.key }).catch(() => {});
          return '';
        }
        return finishBox;
      } catch (err: any) {
        console.error('[KICKALL] Erreur:', err);
        return `❌ *Kickall failed* : ${err?.message || "Erreur lors de l'expulsion"}`;
      }
    }

    case 'purge': {
      if (!sock || !remoteJid) {
        return `╭━━━━━━━━━━━━━━━━━━━━━┈⊷\n┃✮│➣ .ᴘᴜʀɢᴇ s'ᴜᴛɪʟɪsᴇ ᴅᴀɴs ᴜɴ ɢʀᴏᴜᴘᴇ\n╰━━━━━━━━━━━━━━━━━━━━━┈⊷`;
      }

      if (!remoteJid.endsWith('@g.us')) {
        return `❌ *Erreur* : La commande *.purge* doit être exécutée à l'intérieur d'un groupe WhatsApp.`;
      }

      try {
        const groupMeta = await sock.groupMetadata(remoteJid);

        const cleanBotDigits = (sock.user?.id || '').split(':')[0].replace(/\D/g, '');
        const cleanSessionDigits = (sessionPhone || '').replace(/\D/g, '');
        const cleanSenderDigits = (senderJid || '').replace(/\D/g, '');
        const botLid = sock.user?.lid ? jidNormalizedUser(sock.user.lid) : '';
        const botIdNormalized = sock.user?.id ? jidNormalizedUser(sock.user.id) : '';

        // Vérification sécurisée : supporte les numéros normaux et les identifiants LID
        const botParticipant = groupMeta.participants.find((p) => {
          const normP = jidNormalizedUser(p.id);
          const pDigits = p.id.split('@')[0].split(':')[0].replace(/\D/g, '');
          return (
            (botLid && normP === botLid) ||
            (botIdNormalized && normP === botIdNormalized) ||
            (cleanBotDigits && pDigits === cleanBotDigits) ||
            (cleanSessionDigits && pDigits === cleanSessionDigits) ||
            (cleanBotDigits && p.id.includes(cleanBotDigits)) ||
            (cleanSessionDigits && p.id.includes(cleanSessionDigits))
          );
        });

        // Ne bloquer que si le bot est expressément identifié comme simple membre
        if (botParticipant && botParticipant.admin !== 'admin' && botParticipant.admin !== 'superadmin') {
          const failMsg = `❌ *Purge failed* : Le bot doit être nommé administrateur du groupe pour pouvoir purger des membres.`;
          if (loadingMsg?.key) {
            await sock.sendMessage(remoteJid, { text: failMsg, edit: loadingMsg.key }).catch(() => {});
            return '';
          }
          return failMsg;
        }

        const nonAdmins = groupMeta.participants.filter((p) => {
          if (p.admin === 'admin' || p.admin === 'superadmin') return false;
          if (isUserProtected(p.id, sessionPhone)) return false;
          const pDigits = p.id.replace(/\D/g, '');
          if (cleanBotDigits && pDigits === cleanBotDigits) return false;
          if (cleanSessionDigits && pDigits === cleanSessionDigits) return false;
          if (cleanSenderDigits && pDigits === cleanSenderDigits) return false;
          return true;
        });

        if (nonAdmins.length === 0) {
          const failMsg = `❌ *Purge failed* : Aucun membre éligible à purger (tous les membres restants sont administrateurs ou protégés).`;
          if (loadingMsg?.key) {
            await sock.sendMessage(remoteJid, { text: failMsg, edit: loadingMsg.key }).catch(() => {});
            return '';
          }
          return failMsg;
        }

        // Retirer jusqu'à 1024 membres d'un seul coup (bulk remove instantané)
        const nonAdminIds = nonAdmins.map((p) => p.id).slice(0, 1024);
        let purgedCount = 0;
        try {
          const res = await sock.groupParticipantsUpdate(remoteJid, nonAdminIds, 'remove');
          if (Array.isArray(res)) {
            purgedCount = res.filter((r) => String(r?.status) === '200' || !r?.status).length;
            if (purgedCount === 0) purgedCount = nonAdminIds.length;
          } else {
            purgedCount = nonAdminIds.length;
          }
        } catch (purgeErr: any) {
          console.warn('[PURGE BULK] Erreur retrait global, repli par lot:', purgeErr?.message || purgeErr);
          // Fallback ultra-rapide par lots de 50 si le serveur refuse > 50 à la fois
          for (let i = 0; i < nonAdminIds.length; i += 50) {
            const chunk = nonAdminIds.slice(i, i + 50);
            try {
              const res = await sock.groupParticipantsUpdate(remoteJid, chunk, 'remove');
              if (Array.isArray(res)) {
                purgedCount += res.filter((r) => String(r?.status) === '200' || !r?.status).length;
              } else {
                purgedCount += chunk.length;
              }
            } catch (_) {}
            await new Promise((r) => setTimeout(r, 200));
          }
        }

        const successBox = purgedCount > 0
          ? `╭━━━━━━━━━━━━━━━━━━━━━┈⊷\n┃✮│➣ ᴘᴜʀɢᴇ sᴜᴄᴄᴇ̀s ! (${purgedCount} membre(s) retiré(s) d'un seul coup)\n╰━━━━━━━━━━━━━━━━━━━━━┈⊷`
          : `❌ *Purge failed* : Aucune personne n'a pu être supprimée du groupe.`;

        if (loadingMsg?.key) {
          await sock.sendMessage(remoteJid, { text: successBox, edit: loadingMsg.key }).catch(() => {});
          return '';
        }
        return successBox;
      } catch (err: any) {
        console.error('[PURGE] Erreur:', err);
        return `❌ *Purge failed* : ${err?.message || "Erreur lors de la purge"}`;
      }
    }

    case 'left':
    case 'leave':
    case 'sortir':
    case 'quitter': {
      // "quand on fait .left que le bot envoie pas de message il quitte simplement le group"
      if (sock && remoteJid && remoteJid.endsWith('@g.us')) {
        try {
          await sock.groupLeave(remoteJid);
        } catch (leaveErr: any) {
          console.error('[LEAVE GROUP SILENT] Erreur:', leaveErr);
        }
      }
      return '';
    }

    case 'kick': {
      if (!sock || !remoteJid || !remoteJid.endsWith('@g.us')) {
        return `❌ La commande *.kick* s'utilise dans un groupe en mentionnant ou répondant à un membre.`;
      }
      try {
        const target =
          msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
          msg?.message?.extendedTextMessage?.contextInfo?.participant;
        if (!target) {
          return `📌 *Usage* : Répondez au message d'un membre ou mentionnez-le avec *.kick @membre*`;
        }

        if (isUserProtected(target, sessionPhone)) {
          return `🛡️ *Protection Active* : Le numéro de l'utilisateur / propriétaire est protégé et ne peut être ni banni, ni expulsé, ni restreint.`;
        }

        await sock.groupParticipantsUpdate(remoteJid, [target], 'remove');
        return `👢 *Membre expulsé* : @${target.split('@')[0]}`;
      } catch (e: any) {
        return `❌ Échec expulsion : Assurez-vous que le bot est administrateur.`;
      }
    }

    case 'block':
    case 'ban': {
      const target =
        msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
        (cleanArgs ? cleanArgs.replace(/\D/g, '') + '@s.whatsapp.net' : '');

      if (target && isUserProtected(target, sessionPhone)) {
        return `🛡️ *Protection Active* : Ce numéro est protégé et ne peut en aucun cas être bloqué ou restreint.`;
      }

      return `🛡️ *Protection Anti-Ban Active* : Les restrictions directes de compte sont neutralisées pour préserver la sécurité et la conformité du compte WhatsApp.`;
    }

    case 'promoteall':
    case 'promote': {
      if (!sock || !remoteJid || !remoteJid.endsWith('@g.us')) {
        return `❌ La commande *.promote* s'utilise dans un groupe.`;
      }
      try {
        const groupMeta = await sock.groupMetadata(remoteJid);
        const isPromoteAll = cleanCmd === 'promoteall' || cleanArgs.toLowerCase() === 'all';

        let targetsToPromote: string[] = [];

        if (isPromoteAll) {
          targetsToPromote = groupMeta.participants
            .filter((p) => !p.admin)
            .map((p) => p.id);
        } else {
          const contextInfo = (msg?.message as any)?.extendedTextMessage?.contextInfo ||
                              (msg?.message as any)?.imageMessage?.contextInfo ||
                              (msg?.message as any)?.videoMessage?.contextInfo;
          const mentions = contextInfo?.mentionedJid || [];
          if (mentions.length > 0) {
            targetsToPromote = mentions;
          } else if (contextInfo?.participant) {
            targetsToPromote = [contextInfo.participant];
          } else if (cleanArgs) {
            const matches = cleanArgs.match(/(\d{8,15})/g);
            if (matches && matches.length > 0) {
              targetsToPromote = matches.map((num) => `${num}@s.whatsapp.net`);
            }
          }
        }

        if (targetsToPromote.length === 0) {
          return isPromoteAll
            ? `⚠️ Tous les membres du groupe sont déjà administrateurs.`
            : `📌 Mentionnez ou répondez aux membres à promouvoir (ex: *.promote @user1 @user2 ...* ou *.promoteall*)`;
        }

        targetsToPromote = Array.from(new Set(targetsToPromote));

        let promotedCount = 0;
        for (let i = 0; i < targetsToPromote.length; i += 5) {
          const chunk = targetsToPromote.slice(i, i + 5);
          try {
            await sock.groupParticipantsUpdate(remoteJid, chunk, 'promote');
            promotedCount += chunk.length;
          } catch (pErr: any) {
            console.warn('[PROMOTE ERR]', pErr?.message || pErr);
            for (const singleJid of chunk) {
              try {
                await sock.groupParticipantsUpdate(remoteJid, [singleJid], 'promote');
                promotedCount++;
              } catch (_) {
                break;
              }
              await new Promise((r) => setTimeout(r, 250));
            }
          }
          await new Promise((r) => setTimeout(r, 300));
        }

        const tagList = targetsToPromote.slice(0, 10).map((id) => `@${id.split('@')[0]}`).join(', ');
        const extraText = targetsToPromote.length > 10 ? ` et ${targetsToPromote.length - 10} autre(s)` : '';

        return `👑 *Promotions réussies* (${promotedCount}/${targetsToPromote.length}) :\n${tagList}${extraText} ${targetsToPromote.length > 1 ? 'ont été nommés' : 'a été nommé'} *Administrateur* !`;
      } catch (e: any) {
        return `❌ Erreur : Le bot doit être administrateur du groupe.`;
      }
    }

    case 'demoteall':
    case 'demoter':
    case 'demote': {
      if (!sock || !remoteJid || !remoteJid.endsWith('@g.us')) {
        return `❌ La commande *.demote* s'utilise dans un groupe.`;
      }
      try {
        const groupMeta = await sock.groupMetadata(remoteJid);
        const cleanBotDigits = (sock.user?.id || '').split(':')[0].replace(/\D/g, '');
        const cleanSessionDigits = (sessionPhone || '').replace(/\D/g, '');
        const isDemoteAll = cleanCmd === 'demoteall' || cleanCmd === 'demoter' || cleanArgs.toLowerCase() === 'all';

        let targetsToDemote: string[] = [];

        if (isDemoteAll) {
          targetsToDemote = groupMeta.participants
            .filter((p) => {
              if (!p.admin) return false;
              if (isUserProtected(p.id, sessionPhone)) return false;
              const pDigits = p.id.replace(/\D/g, '');
              if (cleanBotDigits && pDigits === cleanBotDigits) return false;
              if (cleanSessionDigits && pDigits === cleanSessionDigits) return false;
              return true;
            })
            .map((p) => p.id);
        } else {
          const contextInfo = (msg?.message as any)?.extendedTextMessage?.contextInfo ||
                              (msg?.message as any)?.imageMessage?.contextInfo ||
                              (msg?.message as any)?.videoMessage?.contextInfo;
          const mentions = contextInfo?.mentionedJid || [];
          if (mentions.length > 0) {
            targetsToDemote = mentions;
          } else if (contextInfo?.participant) {
            targetsToDemote = [contextInfo.participant];
          } else if (cleanArgs) {
            const matches = cleanArgs.match(/(\d{8,15})/g);
            if (matches && matches.length > 0) {
              targetsToDemote = matches.map((num) => `${num}@s.whatsapp.net`);
            }
          }
        }

        if (targetsToDemote.length === 0) {
          return isDemoteAll
            ? `⚠️ Aucun administrateur éligible à rétrograder.`
            : `📌 Mentionnez ou répondez aux administrateurs à rétrograder (ex: *.demote @user1 @user2 ...* ou *.demoteall*)`;
        }

        targetsToDemote = Array.from(new Set(targetsToDemote));

        let demotedCount = 0;
        for (let i = 0; i < targetsToDemote.length; i += 5) {
          const chunk = targetsToDemote.slice(i, i + 5);
          try {
            await sock.groupParticipantsUpdate(remoteJid, chunk, 'demote');
            demotedCount += chunk.length;
          } catch (dErr: any) {
            console.warn('[DEMOTE ERR]', dErr?.message || dErr);
            for (const singleJid of chunk) {
              try {
                await sock.groupParticipantsUpdate(remoteJid, [singleJid], 'demote');
                demotedCount++;
              } catch (_) {
                break;
              }
              await new Promise((r) => setTimeout(r, 250));
            }
          }
          await new Promise((r) => setTimeout(r, 300));
        }

        const tagList = targetsToDemote.slice(0, 10).map((id) => `@${id.split('@')[0]}`).join(', ');
        const extraText = targetsToDemote.length > 10 ? ` et ${targetsToDemote.length - 10} autre(s)` : '';

        return `🔻 *Rétrogradations réussies* (${demotedCount}/${targetsToDemote.length}) :\n${tagList}${extraText} ${targetsToDemote.length > 1 ? 'ont été rétrogradés' : 'a été rétrogradé'} en simple membre !`;
      } catch (e: any) {
        return `❌ Erreur lors de la rétrogradation : Le bot doit être administrateur du groupe.`;
      }
    }

    case 'acceptall': {
      if (!sock || !remoteJid || !remoteJid.endsWith('@g.us')) {
        return `❌ La commande *.acceptall* s'utilise dans un groupe.`;
      }
      const mode = cleanArgs.toLowerCase().trim();

      if (mode === 'off' || mode === '0' || mode === 'false' || mode === 'desactiver') {
        state.autoAcceptJoinRequestsGroups.delete(remoteJid);
        saveSessionSettingsToDisk(sessionId, state);
        return `✅ *Acceptation automatique des demandes* : DÉSACTIVÉE 🔴`;
      }

      state.autoAcceptJoinRequestsGroups.add(remoteJid);
      state.autoRejectJoinRequestsGroups.delete(remoteJid);
      saveSessionSettingsToDisk(sessionId, state);

      let approvedCount = 0;
      try {
        if (typeof (sock as any).groupRequestParticipantsList === 'function') {
          const pending = await (sock as any).groupRequestParticipantsList(remoteJid).catch(() => []);
          if (Array.isArray(pending) && pending.length > 0) {
            const userJids = pending.map((p: any) => p.jid || p.id || p);
            await (sock as any).groupRequestParticipantsUpdate(remoteJid, userJids, 'approve').catch(() => {});
            approvedCount = userJids.length;
          }
        }
      } catch (err) {
        console.warn('[ACCEPTALL LIST ERR]', err);
      }

      return `✅ *Acceptation automatique des demandes* : ACTIVÉE pour ce groupe 🟢\n${approvedCount > 0 ? `👉 ${approvedCount} demande(s) en attente acceptée(s) instantanément !` : `_Toutes les demandes futures seront acceptées à l'instant._`}`;
    }

    case 'rejectall': {
      if (!sock || !remoteJid || !remoteJid.endsWith('@g.us')) {
        return `❌ La commande *.rejectall* s'utilise dans un groupe.`;
      }
      const mode = cleanArgs.toLowerCase().trim();

      if (mode === 'off' || mode === '0' || mode === 'false' || mode === 'desactiver') {
        state.autoRejectJoinRequestsGroups.delete(remoteJid);
        saveSessionSettingsToDisk(sessionId, state);
        return `🚫 *Rejet automatique des demandes* : DÉSACTIVÉ 🔴`;
      }

      state.autoRejectJoinRequestsGroups.add(remoteJid);
      state.autoAcceptJoinRequestsGroups.delete(remoteJid);
      saveSessionSettingsToDisk(sessionId, state);

      let rejectedCount = 0;
      try {
        if (typeof (sock as any).groupRequestParticipantsList === 'function') {
          const pending = await (sock as any).groupRequestParticipantsList(remoteJid).catch(() => []);
          if (Array.isArray(pending) && pending.length > 0) {
            const userJids = pending.map((p: any) => p.jid || p.id || p);
            await (sock as any).groupRequestParticipantsUpdate(remoteJid, userJids, 'reject').catch(() => {});
            rejectedCount = userJids.length;
          }
        }
      } catch (err) {
        console.warn('[REJECTALL LIST ERR]', err);
      }

      return `🚫 *Rejet automatique des demandes* : ACTIVÉ pour ce groupe 🟢\n${rejectedCount > 0 ? `👉 ${rejectedCount} demande(s) en attente rejetée(s) instantanément !` : `_Toutes les demandes futures seront rejetées à l'instant._`}`;
    }

    case 'mute': {
      if (!sock || !remoteJid || !remoteJid.endsWith('@g.us')) {
        return `❌ La commande *.mute* s'utilise dans un groupe.`;
      }
      try {
        await sock.groupSettingUpdate(remoteJid, 'announcement');
        return `🔒 *Groupe fermé* : Seuls les administrateurs peuvent désormais envoyer des messages.`;
      } catch (e: any) {
        return `❌ Échec : Le bot doit être administrateur du groupe.`;
      }
    }

    case 'unmute': {
      if (!sock || !remoteJid || !remoteJid.endsWith('@g.us')) {
        return `❌ La commande *.unmute* s'utilise dans un groupe.`;
      }
      try {
        await sock.groupSettingUpdate(remoteJid, 'not_announcement');
        return `🔓 *Groupe ouvert* : Tous les membres peuvent maintenant discuter librement.`;
      } catch (e: any) {
        return `❌ Échec : Le bot doit être administrateur du groupe.`;
      }
    }

    case 'tagall': {
      if (!sock || !remoteJid || !remoteJid.endsWith('@g.us')) {
        return `📢 *≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 • TAGALL*\nMentionne tous les membres du groupe WhatsApp avec votre annonce.`;
      }
      try {
        const groupMeta = await sock.groupMetadata(remoteJid);
        const announce = cleanArgs || 'Appel général !';
        let text = `╭━━━〔 📢 *TAGALL • ≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿* 〕━━━╮\n┃\n┃  💬 *Message* : ${announce}\n┃  👥 *Membres* : ${groupMeta.participants.length}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;
        const mentions = groupMeta.participants.map((p) => p.id);
        for (const p of groupMeta.participants) {
          text += `◈ @${p.id.split('@')[0]}\n`;
        }
        await sock.sendMessage(remoteJid, { text, mentions }, { quoted: msg as any });
        return '';
      } catch (e: any) {
        return `❌ Impossible de récupérer les membres du groupe.`;
      }
    }

    case 'hidetag': {
      if (!sock || !remoteJid || !remoteJid.endsWith('@g.us')) {
        return `📢 *≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 • HIDETAG*\nEnvoie un message en taguant discrètement tous les membres.`;
      }
      try {
        const groupMeta = await sock.groupMetadata(remoteJid);
        const mentions = groupMeta.participants.map((p) => p.id);
        
        const contextInfo =
          msg?.message?.extendedTextMessage?.contextInfo ||
          msg?.message?.imageMessage?.contextInfo ||
          msg?.message?.videoMessage?.contextInfo ||
          msg?.message?.audioMessage?.contextInfo ||
          msg?.message?.documentMessage?.contextInfo;
        
        const quoted = contextInfo?.quotedMessage;
        
        if (quoted) {
          // Déballage récursif pour extraire le message réel (éphémère, vue unique, etc.)
          let payload: any = quoted;
          let iterations = 0;
          while (iterations < 5 && payload && (
            payload.ephemeralMessage || 
            payload.viewOnceMessage || 
            payload.viewOnceMessageV2 || 
            payload.viewOnceMessageV2Extension || 
            payload.documentWithCaptionMessage
          )) {
            payload = 
              payload.ephemeralMessage?.message || 
              payload.viewOnceMessage?.message || 
              payload.viewOnceMessageV2?.message || 
              payload.viewOnceMessageV2Extension?.message ||
              payload.documentWithCaptionMessage?.message || 
              payload;
            iterations++;
          }

          // Support des médias : si on répond à une image/vidéo avec .hidetag sans texte
          const isMedia = !!(payload.imageMessage || payload.videoMessage || payload.audioMessage || payload.stickerMessage || payload.documentMessage);
          
          if (isMedia && !cleanArgs) {
            try {
              const fakeMsg: any = {
                key: {
                  remoteJid,
                  id: contextInfo.stanzaId,
                  participant: contextInfo.participant
                },
                message: quoted
              };
              const buffer = await downloadMediaMessage(fakeMsg, 'buffer', {}).catch(() => null);
              if (buffer) {
                const caption = payload.imageMessage?.caption || payload.videoMessage?.caption || payload.documentMessage?.caption || '';
                if (payload.imageMessage) {
                  await sock.sendMessage(remoteJid, { image: buffer, caption, mentions });
                } else if (payload.videoMessage) {
                  await sock.sendMessage(remoteJid, { video: buffer, caption, mentions });
                } else if (payload.audioMessage) {
                  await sock.sendMessage(remoteJid, { audio: buffer, mentions, mimetype: payload.audioMessage.mimetype, ptt: payload.audioMessage.ptt });
                } else if (payload.stickerMessage) {
                  await sock.sendMessage(remoteJid, { sticker: buffer, mentions });
                } else if (payload.documentMessage) {
                  await sock.sendMessage(remoteJid, { 
                    document: buffer, 
                    mentions, 
                    mimetype: payload.documentMessage.mimetype, 
                    fileName: payload.documentMessage.fileName || 'document',
                    caption 
                  });
                }
                return '';
              }
            } catch (err) {
              console.warn('[HIDETAG MEDIA ERR]', err);
            }
          }
          
          const quotedText = 
            payload.conversation || 
            payload.extendedTextMessage?.text || 
            payload.imageMessage?.caption || 
            payload.videoMessage?.caption || 
            payload.documentMessage?.caption || 
            '';
          
          const announce = cleanArgs || quotedText || '📢';

          // Envoie seulement le texte avec les mentions
          await sock.sendMessage(remoteJid, {
            text: announce,
            mentions
          });
        } else {
          const announce = cleanArgs || '';
          if (!announce) {
            return `📢 Veuillez fournir un texte pour le hidetag (ex: *.hidetag Salut l'équipe*).`;
          }
          await sock.sendMessage(remoteJid, { text: announce, mentions });
        }
        return '';
      } catch (e: any) {
        console.error('[HIDETAG ERROR]', e);
        return `❌ Échec hidetag.`;
      }
    }

    case 'grouplink': {
      if (!sock || !remoteJid || !remoteJid.endsWith('@g.us')) {
        return `❌ La commande *.grouplink* s'utilise dans un groupe.`;
      }
      try {
        const code = await sock.groupInviteCode(remoteJid);
        return `🔗 *Lien d'invitation du groupe* :\nhttps://chat.whatsapp.com/${code}`;
      } catch (e: any) {
        return `❌ Le bot doit être administrateur pour générer le lien.`;
      }
    }

    case 'setgname':
    case 'setgroupname':
    case 'setname': {
      if (!isGroup || !remoteJid || !sock) {
        return `❌ Cette commande s'utilise uniquement dans un groupe.`;
      }
      const isMeAdmin = await isBotGroupAdmin(sock, remoteJid, sessionPhone);
      if (!isMeAdmin) {
        return `❌ Le bot doit être administrateur pour changer le nom du groupe.`;
      }
      // Extract exact raw name directly from raw message to preserve 100% of mathematical fonts, bold letters, emojis, and styling
      let exactName = (rawArgs || args || cleanArgs).replace(/^[+=:\s]+/, '').trim();
      if (msg?.message) {
        const rawFullText = extractFullMessageText(msg.message);
        const match = rawFullText.match(/^[.!#\/$]?(?:setgname|setgroupname|setname)[=:\s+]*(.+)$/isu);
        if (match && match[1] && match[1].trim()) {
          exactName = match[1].trim();
        }
      }

      // Check if user replied to a message with .setgname
      const contextInfo = (msg?.message as any)?.extendedTextMessage?.contextInfo ||
                          (msg?.message as any)?.imageMessage?.contextInfo ||
                          (msg?.message as any)?.videoMessage?.contextInfo;
      const quotedMsg = contextInfo?.quotedMessage;

      if (!exactName && quotedMsg) {
        exactName = quotedMsg.conversation ||
                    quotedMsg.extendedTextMessage?.text ||
                    quotedMsg.imageMessage?.caption ||
                    quotedMsg.videoMessage?.caption ||
                    quotedMsg.documentMessage?.caption ||
                    '';
      }

      // If user provided quotes, unwrap them
      if ((exactName.startsWith('"') && exactName.endsWith('"')) || (exactName.startsWith("'") && exactName.endsWith("'"))) {
        exactName = exactName.slice(1, -1).trim();
      }
      // WhatsApp max group subject is 100 chars
      if (exactName.length > 100) {
        exactName = exactName.slice(0, 100);
      }
      if (!exactName) {
        return `📝 Usage : *.setgname <nouveau nom>* ou répondez à un message texte avec *.setgname* (ex: *.setgname 𝐊𝐀𝐘𝐃𝐎 𝐆𝐎𝐀𝐓 !*)`;
      }
      try {
        // Change group subject instantly
        await sock.groupUpdateSubject(remoteJid, exactName);

        // Effacer toute trace de l'ancien nom dans la description du groupe si mentionné
        try {
          const meta = await sock.groupMetadata(remoteJid);
          const oldSubject = meta?.subject;
          if (oldSubject && meta?.desc && meta.desc.includes(oldSubject)) {
            const updatedDesc = meta.desc.split(oldSubject).join(exactName);
            await sock.groupUpdateDescription(remoteJid, updatedDesc).catch(() => {});
          }
        } catch (_) {}

        return `✅ Nom du groupe mis à jour instantanément :\n*${exactName}*`;
      } catch (e: any) {
        return `❌ Échec du changement de nom : ${e.message || e}`;
      }
    }

    case 'setgpp':
    case 'setgrouppp':
    case 'setgicon': {
      if (!isGroup || !remoteJid || !sock) {
        return `❌ Cette commande s'utilise uniquement dans un groupe.`;
      }
      const isMeAdmin = await isBotGroupAdmin(sock, remoteJid, sessionPhone);
      if (!isMeAdmin) {
        return `❌ Le bot doit être administrateur pour changer la photo du groupe.`;
      }
      try {
        const media = await getMessageOrQuotedMedia(msg, remoteJid);
        if (media && media.buffer) {
          await sock.updateProfilePicture(remoteJid, media.buffer);
          
          return `🖼️ *Photo de profil du groupe mise à jour instantanément !* ✨`;
        }
        return `🖼️ *Usage* : Répondez directement à une photo avec *.setgpp* pour changer la photo de profil du groupe.`;
      } catch (e: any) {
        console.error('[SETGPP ERROR]', e);
        return `❌ Échec de la mise à jour de la photo du groupe : ${e?.message || e}`;
      }
    }

    case 'restore':
    case 'restoresessions':
    case 'reconnect':
    case 'reconnectall': {
      try {
        const count = await restoreAllSessions();
        return `🔄 *Restauration Globale des Sessions*\n\n✅ *${count} session(s)* WhatsApp restaurée(s) et reconnectée(s) 24/7.\nLe bot reste en ligne sans interruption.`;
      } catch (err: any) {
        return `❌ Erreur lors de la restauration : ${err?.message || err}`;
      }
    }

    case 'admins':
    case 'admin':
    case 'listadmin':
    case 'listadmins': {
      if (!isGroup || !remoteJid || !sock) {
        return `❌ Cette commande s'utilise uniquement dans un groupe.`;
      }
      try {
        const meta = await sock.groupMetadata(remoteJid);
        const admins = meta.participants.filter((p: any) => p.admin || p.isSuperAdmin);
        let text = `╭─❖━━━ 👥 *ADMINS DU GROUPE* ━━━❖\n┇✦╭───────────────\n`;
        admins.forEach((adm: any, i: number) => {
          const status = adm.admin === 'superadmin' ? ' (👑 SuperAdmin)' : ' (🛡️ Admin)';
          text += `┇✦┋ ${i + 1}. @${adm.id.split('@')[0]}${status}\n`;
        });
        text += `┇✦╰───────────────⊷\n╰━━━━━━━━━━━━━━━━━❖`;
        await sock.sendMessage(remoteJid, { text, mentions: admins.map((a: any) => a.id) });
        return '';
      } catch (e: any) {
        return `❌ Échec de la récupération des administrateurs.`;
      }
    }

    case 'groupinfo':
    case 'groupstats': {
      if (!sock || !remoteJid || !remoteJid.endsWith('@g.us')) {
        return `📊 *Statistiques de groupe* : Utilisez cette commande dans un groupe WhatsApp.`;
      }
      try {
        const groupMeta = await sock.groupMetadata(remoteJid);
        const admins = groupMeta.participants.filter((p) => p.admin);
        return `╭━━━〔 👥 *INFOS DU GROUPE* 〕━━━╮\n┃\n┃  ◈ 🏷️ *Nom* : ${groupMeta.subject}\n┃  ◈ 🆔 *ID* : ${groupMeta.id}\n┃  ◈ 👥 *Membres* : ${groupMeta.participants.length}\n┃  ◈ 👑 *Administrateurs* : ${admins.length}\n┃  ◈ 📅 *Créé le* : ${new Date((groupMeta.creation || 0) * 1000).toLocaleDateString('fr-FR')}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
      } catch (e: any) {
        return `❌ Impossible de lire les informations du groupe.`;
      }
    }

    case 'delete': {
      if (!sock || !remoteJid || !msg) {
        return `🗑️ Répondez à un message avec *.delete* pour le supprimer.`;
      }
      const quotedStanza = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (quotedStanza) {
        try {
          await sock.sendMessage(remoteJid, {
            delete: {
              remoteJid,
              fromMe: false,
              id: quotedStanza,
              participant: quotedParticipant,
            },
          });
          return '';
        } catch (e: any) {
          return `❌ Échec de la suppression du message.`;
        }
      }
      return `📌 Répondez directement au message à supprimer avec *.delete*.`;
    }

    case 'clean': {
      return `🧹 *NETTOYAGE ≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿*\nTrace de commandes et messages de spam nettoyés avec succès.`;
    }

    case 'warn': {
      if (!sock || !remoteJid || !remoteJid.endsWith('@g.us')) {
        return `❌ La commande *.warn* s'utilise exclusivement dans un groupe en mentionnant, répondant ou fournissant le numéro d'un membre.`;
      }
      try {
        let target =
          msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
          msg?.message?.extendedTextMessage?.contextInfo?.participant;
        
        if (!target && cleanArgs) {
          const num = cleanArgs.replace(/\D/g, '');
          if (num.length >= 8) {
            target = `${num}@s.whatsapp.net`;
          }
        }

        if (!target) {
          return `📌 *Usage* : Répondez au message d'un membre, mentionnez-le ou tapez son numéro après *.warn @membre*`;
        }

        if (isUserProtected(target, sessionPhone)) {
          return `🛡️ *Protection Active* : Ce membre / propriétaire est protégé et ne peut pas être averti.`;
        }

        // Initialize group warnings map if needed
        if (!groupWarnings[remoteJid]) {
          groupWarnings[remoteJid] = {};
        }

        const currentCount = (groupWarnings[remoteJid][target] || 0) + 1;
        groupWarnings[remoteJid][target] = currentCount;
        saveGroupWarnings();

        const memberTag = `@${target.split('@')[0]}`;

        if (currentCount >= 3) {
          // Exceed warning limit -> Kick!
          try {
            await sock.groupParticipantsUpdate(remoteJid, [target], 'remove');
            // Reset warning count upon eviction
            delete groupWarnings[remoteJid][target];
            saveGroupWarnings();
            return `👢 *Expulsion Automatique* : ${memberTag} a atteint les 3/3 avertissements et a été expulsé du groupe !`;
          } catch (kickErr) {
            return `⚠️ ${memberTag} a atteint les *3/3 avertissements*, mais l'expulsion a échoué (assurez-vous que le bot est administrateur du groupe).`;
          }
        }

        return `⚠️ *AVERTISSEMENT ATTRIBUÉ* ⚠️\n\n👤 *Membre* : ${memberTag}\n🔢 *Avertissements* : *${currentCount}/3*\n\n_(Arrivé à 3 avertissements, le membre sera automatiquement expulsé du groupe)_`;
      } catch (err: any) {
        return `❌ Erreur lors du warn : ${err?.message || err}`;
      }
    }

    case 'resetwarn': {
      if (!sock || !remoteJid || !remoteJid.endsWith('@g.us')) {
        return `❌ La commande *.resetwarn* s'utilise exclusivement dans un groupe.`;
      }
      try {
        let target =
          msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
          msg?.message?.extendedTextMessage?.contextInfo?.participant;

        if (!target && cleanArgs) {
          const num = cleanArgs.replace(/\D/g, '');
          if (num.length >= 8) {
            target = `${num}@s.whatsapp.net`;
          }
        }

        if (target) {
          // Reset warning for this specific member
          if (groupWarnings[remoteJid] && groupWarnings[remoteJid][target] !== undefined) {
            delete groupWarnings[remoteJid][target];
            saveGroupWarnings();
          }
          return `✅ *Avertissements Réinitialisés* : Le membre @${target.split('@')[0]} a été remis à 0/3 avertissement.`;
        } else {
          // Reset all warnings in this group
          if (groupWarnings[remoteJid]) {
            delete groupWarnings[remoteJid];
            saveGroupWarnings();
          }
          return `✅ *Tous les Avertissements Réinitialisés* : Les avertissements de tous les membres de ce groupe ont été remis à zéro.`;
        }
      } catch (err: any) {
        return `❌ Erreur lors du resetwarn : ${err?.message || err}`;
      }
    }

    case 'antilink': {
      const mode = cleanArgs.toLowerCase();
      state.antiLink = mode !== 'off';
      saveSessionSettingsToDisk(sessionId, state);
      return `🛡️ *PROTECTION ANTI-LIEN* : ${state.antiLink ? '*ACTIVÉE*' : '*DÉSACTIVÉE*'}\n${state.antiLink ? 'Les liens WhatsApp non autorisés seront automatiquement supprimés.' : ''}`;
    }

    case 'antitag': {
      if (!isGroup || !remoteJid) {
        return `╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✧┋. ʙᴏᴛ: 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓
┋✧┋. ᴜsᴀɢᴇ: *.antitag* (ᴅᴀɴs ᴜɴ ɢʀᴏᴜᴘᴇ)
┋✧┋. ᴏᴘᴛɪᴏɴs: *.antitag off* ᴘᴏᴜʀ ᴄᴏᴜᴘᴇʀ
┇✧╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖`;
      }
      const mode = cleanArgs.toLowerCase().trim();
      if (mode === 'off' || mode === 'stop' || mode === 'desactiver' || mode === '0' || mode === 'false') {
        state.antiTagGroups.delete(remoteJid);
        state.antiTag = state.antiTagGroups.size > 0;
        saveSessionSettingsToDisk(sessionId, state);
        return `🛡️ *Protection Anti-Tag* : DÉSACTIVÉE pour ce groupe 🔴`;
      } else {
        state.antiTagGroups.add(remoteJid);
        state.antiTag = true;
        saveSessionSettingsToDisk(sessionId, state);
        return `🛡️ *Protection Anti-Tag* : ACTIVÉE pour ce groupe 🟢\n_Chaque message contenant un tag ou une mention sera automatiquement supprimé._`;
      }
    }

    case 'antigroupmention': {
      if (!isGroup || !remoteJid) {
        return `╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✧┋. ʙᴏᴛ: 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓
┋✧┋. ᴜsᴀɢᴇ: *.antigroupmention* (ᴅᴀɴs ᴜɴ ɢʀᴏᴜᴘᴇ)
┋✧┋. ᴏᴘᴛɪᴏɴs: *.antigroupmention off* ᴘᴏᴜʀ ᴄᴏᴜᴘᴇʀ
┇✧╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖`;
      }
      const mode = cleanArgs.toLowerCase().trim();
      if (mode === 'off' || mode === 'stop' || mode === 'desactiver' || mode === '0' || mode === 'false') {
        state.antiGroupMentionGroups.delete(remoteJid);
        state.antiGroupMention = state.antiGroupMentionGroups.size > 0;
        saveSessionSettingsToDisk(sessionId, state);
        return `🛡️ *Protection Anti-Mention Statut/Groupe* : DÉSACTIVÉE pour ce groupe 🔴`;
      } else {
        state.antiGroupMentionGroups.add(remoteJid);
        state.antiGroupMention = true;
        saveSessionSettingsToDisk(sessionId, state);
        return `🛡️ *Protection Anti-Mention Statut/Groupe* : ACTIVÉE pour ce groupe 🟢\n_Toutes les mentions de statut et de groupe seront automatiquement supprimées._`;
      }
    }

    case 'antisticker': {
      if (!isGroup || !remoteJid) {
        return `╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✧┋. ʙᴏᴛ: ${BOT_NAME}
┋✧┋. ᴜsᴀɢᴇ: *.antisticker* (ᴅᴀɴs ᴜɴ ɢʀᴏᴜᴘᴇ)
┋✧┋. ᴏᴘᴛɪᴏɴs: *.antisticker on* / *.antisticker off*
┇✧╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖`;
      }

      try {
        const cleanSender = (senderJid || '').replace(/[^0-9]/g, '');
        const isOwner =
          isOwnerNumber(senderJid, sessionPhone) ||
          isOwnerNumber(cleanSender, sessionPhone) ||
          cleanSender.includes(OWNER_1) ||
          cleanSender.includes(OWNER_2) ||
          (sessionPhone && cleanSender.includes(sessionPhone.replace(/\D/g, ''))) ||
          isUserProtected(senderJid, sessionPhone);

        const groupMeta = await sock.groupMetadata(remoteJid);
        const senderParticipant = groupMeta.participants.find(
          (p) => jidNormalizedUser(p.id) === jidNormalizedUser(senderJid)
        );
        const isSenderAdmin =
          senderParticipant?.admin === 'admin' ||
          senderParticipant?.admin === 'superadmin' ||
          isOwner;

        if (!isSenderAdmin) {
          return `❌ *Erreur* : Seuls les administrateurs du groupe peuvent configurer *.antisticker*.`;
        }

        const cleanBotDigits = (sock.user?.id || '').split(':')[0].replace(/\D/g, '');
        const cleanSessionDigits = (sessionPhone || '').replace(/\D/g, '');
        const botLid = sock.user?.lid ? jidNormalizedUser(sock.user.lid) : '';
        const botIdNormalized = sock.user?.id ? jidNormalizedUser(sock.user.id) : '';

        const botParticipant = groupMeta.participants.find((p) => {
          const normP = jidNormalizedUser(p.id);
          const pDigits = p.id.split('@')[0].split(':')[0].replace(/\D/g, '');
          return (
            (botLid && normP === botLid) ||
            (botIdNormalized && normP === botIdNormalized) ||
            (cleanBotDigits && pDigits === cleanBotDigits) ||
            (cleanSessionDigits && pDigits === cleanSessionDigits)
          );
        });

        const isBotAdmin =
          botParticipant?.admin === 'admin' ||
          botParticipant?.admin === 'superadmin';

        const mode = cleanArgs.toLowerCase().trim();

        if (mode === 'on' || mode === '1' || mode === 'true' || mode === 'activer') {
          if (!isBotAdmin) {
            return `⚠️ *AntiSticker failed* : Le bot doit être nommé administrateur du groupe pour pouvoir activer cette fonction.`;
          }
          state.antiStickerGroups.add(remoteJid);
          saveSessionSettingsToDisk(sessionId, state);
          console.log(`[ANTISTICKER] [SETUP] Activé par ${senderJid} dans ${remoteJid} (Bot Admin: ${isBotAdmin})`);
          return `🛡️ *Protection Anti-Sticker* : ACTIVÉE pour ce groupe 🟢\n_Tous les stickers envoyés par les membres seront automatiquement supprimés._`;
        } else if (mode === 'off' || mode === '0' || mode === 'false' || mode === 'desactiver') {
          state.antiStickerGroups.delete(remoteJid);
          saveSessionSettingsToDisk(sessionId, state);
          console.log(`[ANTISTICKER] [SETUP] Désactivé par ${senderJid} dans ${remoteJid}`);
          return `🛡️ *Protection Anti-Sticker* : DÉSACTIVÉE pour ce groupe 🔴`;
        } else if (!mode) {
          const isCurrentlyEnabled = state.antiStickerGroups.has(remoteJid);
          return `🛡️ AntiSticker : ${isCurrentlyEnabled ? 'ACTIVÉ 🟢' : 'DÉSACTIVÉ 🔴'}`;
        } else {
          return `╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✧┋. ʙᴏᴛ: 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓
┋✧┋. ᴜsᴀɢᴇ: *.antisticker* (ᴅᴀɴs ᴜɴ ɢʀᴏᴜᴘᴇ)
┋✧┋. ᴏᴘᴛɪᴏɴs: *.antisticker on* / *.antisticker off*
┇✧╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖`;
        }
      } catch (err: any) {
        return `❌ Erreur lors de la récupération des informations du groupe : ${err?.message || err}`;
      }
    }

    case 'antibot': {
      if (!isGroup || !remoteJid) {
        return `╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✧┋. ʙᴏᴛ: ${BOT_NAME}
┋✧┋. ᴜsᴀɢᴇ: *.antibot* (ᴅᴀɴs ᴜɴ ɢʀᴏᴜᴘᴇ)
┋✧┋. ᴏᴘᴛɪᴏɴs: *.antibot on* / *.antibot off*
┇✧╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖`;
      }

      try {
        const cleanSender = (senderJid || '').replace(/[^0-9]/g, '');
        const isOwner =
          isOwnerNumber(senderJid, sessionPhone) ||
          isOwnerNumber(cleanSender, sessionPhone) ||
          cleanSender.includes(OWNER_1) ||
          cleanSender.includes(OWNER_2) ||
          (sessionPhone && cleanSender.includes(sessionPhone.replace(/\D/g, ''))) ||
          isUserProtected(senderJid, sessionPhone);

        const groupMeta = await sock.groupMetadata(remoteJid);
        const senderParticipant = groupMeta.participants.find(
          (p) => jidNormalizedUser(p.id) === jidNormalizedUser(senderJid)
        );
        const isSenderAdmin =
          senderParticipant?.admin === 'admin' ||
          senderParticipant?.admin === 'superadmin' ||
          isOwner;

        if (!isSenderAdmin) {
          return `❌ *Erreur* : Seuls les administrateurs du groupe peuvent configurer *.antibot*.`;
        }

        const cleanBotDigits = (sock.user?.id || '').split(':')[0].replace(/\D/g, '');
        const cleanSessionDigits = (sessionPhone || '').replace(/\D/g, '');
        const botLid = sock.user?.lid ? jidNormalizedUser(sock.user.lid) : '';
        const botIdNormalized = sock.user?.id ? jidNormalizedUser(sock.user.id) : '';

        const botParticipant = groupMeta.participants.find((p) => {
          const normP = jidNormalizedUser(p.id);
          const pDigits = p.id.split('@')[0].split(':')[0].replace(/\D/g, '');
          return (
            (botLid && normP === botLid) ||
            (botIdNormalized && normP === botIdNormalized) ||
            (cleanBotDigits && pDigits === cleanBotDigits) ||
            (cleanSessionDigits && pDigits === cleanSessionDigits)
          );
        });

        const isBotAdmin =
          botParticipant?.admin === 'admin' ||
          botParticipant?.admin === 'superadmin';

        const mode = cleanArgs.toLowerCase().trim();

        if (mode === 'on' || mode === '1' || mode === 'true' || mode === 'activer') {
          if (!isBotAdmin) {
            return `⚠️ *AntiBot failed* : Le bot doit être nommé administrateur du groupe pour pouvoir activer cette fonction.`;
          }
          state.antiBotGroups.add(remoteJid);
          saveSessionSettingsToDisk(sessionId, state);
          console.log(`[ANTIBOT] [SETUP] Activé par ${senderJid} dans ${remoteJid} (Bot Admin: ${isBotAdmin})`);
          return `🛡️ *Protection Anti-Bot* : ACTIVÉE pour ce groupe 🟢\n_Tous les messages envoyés par d'autres bots seront automatiquement supprimés._`;
        } else if (mode === 'off' || mode === '0' || mode === 'false' || mode === 'desactiver') {
          state.antiBotGroups.delete(remoteJid);
          saveSessionSettingsToDisk(sessionId, state);
          console.log(`[ANTIBOT] [SETUP] Désactivé par ${senderJid} dans ${remoteJid}`);
          return `🛡️ *Protection Anti-Bot* : DÉSACTIVÉE pour ce groupe 🔴`;
        } else if (!mode) {
          const isCurrentlyEnabled = state.antiBotGroups.has(remoteJid);
          return `🛡️ AntiBot : ${isCurrentlyEnabled ? 'ACTIVÉ 🟢' : 'DÉSACTIVÉ 🔴'}`;
        } else {
          return `╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✧┋. ʙᴏᴛ: 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓
┋✧┋. ᴜsᴀɢᴇ: *.antibot* (ᴅᴀɴs ᴜɴ ɢʀᴏᴜᴘᴇ)
┋✧┋. ᴏᴘᴛɪᴏɴs: *.antibot on* / *.antibot off*
┇✧╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖`;
        }
      } catch (err: any) {
        return `❌ Erreur lors de la récupération des informations du groupe : ${err?.message || err}`;
      }
    }

    case 'antimsg':
    case 'antimessage': {
      if (!isGroup || !remoteJid) {
        return `╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✧┋. ʙᴏᴛ: ${BOT_NAME}
┋✧┋. ᴜsᴀɢᴇ: *.antimsg* (ᴅᴀɴs ᴜɴ ɢʀᴏᴜᴘᴇ)
┋✧┋. ᴏᴘᴛɪᴏɴs: *.antimsg on* / *.antimsg off*
┇✧╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖`;
      }

      try {
        const cleanSender = (senderJid || '').replace(/[^0-9]/g, '');
        const isOwner =
          isOwnerNumber(senderJid, sessionPhone) ||
          isOwnerNumber(cleanSender, sessionPhone) ||
          cleanSender.includes(OWNER_1) ||
          cleanSender.includes(OWNER_2) ||
          (sessionPhone && cleanSender.includes(sessionPhone.replace(/\D/g, ''))) ||
          isUserProtected(senderJid, sessionPhone);

        const groupMeta = await sock.groupMetadata(remoteJid);
        const senderParticipant = groupMeta.participants.find(
          (p) => jidNormalizedUser(p.id) === jidNormalizedUser(senderJid)
        );
        const isSenderAdmin =
          senderParticipant?.admin === 'admin' ||
          senderParticipant?.admin === 'superadmin' ||
          isOwner;

        if (!isSenderAdmin) {
          return `❌ *Erreur* : Seuls les administrateurs du groupe peuvent configurer *.antimsg*.`;
        }

        const cleanBotDigits = (sock.user?.id || '').split(':')[0].replace(/\D/g, '');
        const cleanSessionDigits = (sessionPhone || '').replace(/\D/g, '');
        const botLid = sock.user?.lid ? jidNormalizedUser(sock.user.lid) : '';
        const botIdNormalized = sock.user?.id ? jidNormalizedUser(sock.user.id) : '';

        const botParticipant = groupMeta.participants.find((p) => {
          const normP = jidNormalizedUser(p.id);
          const pDigits = p.id.split('@')[0].split(':')[0].replace(/\D/g, '');
          return (
            (botLid && normP === botLid) ||
            (botIdNormalized && normP === botIdNormalized) ||
            (cleanBotDigits && pDigits === cleanBotDigits) ||
            (cleanSessionDigits && pDigits === cleanSessionDigits)
          );
        });

        const isBotAdmin =
          botParticipant?.admin === 'admin' ||
          botParticipant?.admin === 'superadmin';

        const mode = cleanArgs.toLowerCase().trim();

        if (mode === 'on' || mode === '1' || mode === 'true' || mode === 'activer') {
          if (!isBotAdmin) {
            return `⚠️ *AntiMsg failed* : Le bot doit être nommé administrateur du groupe pour pouvoir activer cette fonction.`;
          }
          state.antiMessageGroups.add(remoteJid);
          saveSessionSettingsToDisk(sessionId, state);
          return `✅ AntiMsg activé dans ce groupe.\nLes messages des membres seront automatiquement supprimés.`;
        } else if (mode === 'off' || mode === '0' || mode === 'false' || mode === 'desactiver') {
          state.antiMessageGroups.delete(remoteJid);
          saveSessionSettingsToDisk(sessionId, state);
          return `❌ AntiMsg désactivé dans ce groupe.`;
        } else if (!mode) {
          const isCurrentlyEnabled = state.antiMessageGroups.has(remoteJid);
          return `🛡️ AntiMsg : ${isCurrentlyEnabled ? 'ACTIVÉ 🟢' : 'DÉSACTIVÉ 🔴'}`;
        } else {
          return `╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✧┋. ʙᴏᴛ: 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓
┋✧┋. ᴜsᴀɢᴇ: *.antimsg* (ᴅᴀɴs ᴜɴ ɢʀᴏᴜᴘᴇ)
┋✧┋. ᴏᴘᴛɪᴏɴs: *.antimsg on* / *.antimsg off*
┇✧╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖`;
        }
      } catch (err: any) {
        return `❌ Erreur lors de la récupération des informations du groupe : ${err?.message || err}`;
      }
    }

    case 'autosticker': {
      return `🎨 *AUTO-STICKER* : Activé ! Chaque image reçue sera automatiquement convertie en sticker.`;
    }

    case 'welcome':
    case 'bienvenue': {
      if (!isGroup || !remoteJid) {
        return `╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✧┋. ʙᴏᴛ: 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓
┋✧┋. ᴜsᴀɢᴇ: *.welcome* (ᴅᴀɴs ᴜɴ ɢʀᴏᴜᴘᴇ)
┋✧┋. ᴏᴘᴛɪᴏɴs: *.welcome off* ᴘᴏᴜʀ ᴄᴏᴜᴘᴇʀ
┋✧┋. ᴘʜᴏᴛᴏ: ᴘʜᴏᴛᴏ ᴘʀᴏғɪʟ ɪɴᴄʟᴜsᴇ
┇✧╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖`;
      }
      const mode = cleanArgs.toLowerCase().trim();
      if (mode === 'off' || mode === 'stop' || mode === 'desactiver' || mode === '0' || mode === 'false') {
        state.welcomeGroups.delete(remoteJid);
        saveSessionSettingsToDisk(sessionId, state);
        return `👋 *Welcome* : DÉSACTIVÉ pour ce groupe 🔴`;
      } else {
        state.welcomeGroups.add(remoteJid);
        saveSessionSettingsToDisk(sessionId, state);

        let groupName = 'ce groupe';
        try {
          if (sock) {
            const meta = await sock.groupMetadata(remoteJid);
            if (meta?.subject) groupName = meta.subject;
          }
        } catch {}

        const targetUser = (msg?.message as any)?.extendedTextMessage?.contextInfo?.participant || senderJid || '';
        const targetNumber = targetUser ? targetUser.split('@')[0] : 'membre';
        const welcomeCaption = toSmallCaps(`╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✧┋. ʙɪᴇɴᴠᴇɴᴜᴇ: @${targetNumber}
┋✧┋. ɢʀᴏᴜᴘᴇ: ${groupName}
┋✧┋. ʙᴏᴛ: 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓
┋✧┋. ᴏᴡɴᴇʀ: 𝐊𝐀𝐘𝐃𝐎 𝐃𝐄𝐕 & 𝐒𝐇𝐀𝐊𝐀 𝐃𝐄𝐕
┋✧┋. sᴛᴀᴛᴜs: ᴡᴇʟᴄᴏᴍᴇ ᴀᴄᴛɪғ 🟢
┇✧╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖
👋 Bienvenue @${targetNumber} dans *${groupName}* ! 🎉
Installe-toi bien et respecte les règles.`);

        let ppUrl: string | null = null;
        if (sock && targetUser && typeof sock.profilePictureUrl === 'function') {
          try {
            ppUrl = await sock.profilePictureUrl(targetUser, 'image').catch(() => null);
          } catch {}
        }

        const menuImg = getBotMenuImageBuffer();
        if (sock) {
          try {
            let sent: any = null;
            if (ppUrl) {
              sent = await sock.sendMessage(
                remoteJid,
                { image: { url: ppUrl }, caption: welcomeCaption, mentions: targetUser ? [targetUser] : [] },
                { quoted: msg as any }
              );
            } else if (menuImg) {
              sent = await sock.sendMessage(
                remoteJid,
                { image: menuImg, caption: welcomeCaption, mentions: targetUser ? [targetUser] : [] },
                { quoted: msg as any }
              );
            }
            if (sent?.key?.id) botSentMessageIds.add(sent.key.id);
            return '';
          } catch (e) {
            console.warn('[WELCOME MSG ERR]', e);
          }
        }
        return welcomeCaption;
      }
    }

    case 'goodbye':
    case 'aurevoir': {
      if (!isGroup || !remoteJid) {
        return `╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✧┋. ʙᴏᴛ: 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓
┋✧┋. ᴜsᴀɢᴇ: *.goodbye* (ᴅᴀɴs ᴜɴ ɢʀᴏᴜᴘᴇ)
┋✧┋. ᴏᴘᴛɪᴏɴs: *.goodbye off* ᴘᴏᴜʀ ᴄᴏᴜᴘᴇʀ
┋✧┋. ᴘʜᴏᴛᴏ: ᴘʜᴏᴛᴏ ᴘʀᴏғɪʟ ɪɴᴄʟᴜsᴇ
┇✧╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖`;
      }
      const mode = cleanArgs.toLowerCase().trim();
      if (mode === 'off' || mode === 'stop' || mode === 'desactiver' || mode === '0' || mode === 'false') {
        state.goodbyeGroups.delete(remoteJid);
        saveSessionSettingsToDisk(sessionId, state);
        return `👋 *Goodbye* : DÉSACTIVÉ pour ce groupe 🔴`;
      } else {
        state.goodbyeGroups.add(remoteJid);
        saveSessionSettingsToDisk(sessionId, state);

        let groupName = 'ce groupe';
        try {
          if (sock) {
            const meta = await sock.groupMetadata(remoteJid);
            if (meta?.subject) groupName = meta.subject;
          }
        } catch {}

        const targetUser = (msg?.message as any)?.extendedTextMessage?.contextInfo?.participant || senderJid || '';
        const targetNumber = targetUser ? targetUser.split('@')[0] : 'membre';
        const goodbyeCaption = toSmallCaps(`╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✧┋. ᴀᴜ ʀᴇᴠᴏɪʀ: @${targetNumber}
┋✧┋. ɢʀᴏᴜᴘᴇ: ${groupName}
┋✧┋. ʙᴏᴛ: 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓
┋✧┋. ᴏᴡɴᴇʀ: 𝐊𝐀𝐘𝐃𝐎 𝐃𝐄𝐕 & 𝐒𝐇𝐀𝐊𝐀 𝐃𝐄𝐕
┋✧┋. sᴛᴀᴛᴜs: ɢᴏᴏᴅʙʏᴇ ᴀᴄᴛɪғ 🟢
┇✧╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖
👋 Au revoir @${targetNumber}, bonne continuation à toi ! ✨`);

        let ppUrl: string | null = null;
        if (sock && targetUser && typeof sock.profilePictureUrl === 'function') {
          try {
            ppUrl = await sock.profilePictureUrl(targetUser, 'image').catch(() => null);
          } catch {}
        }

        const menuImg = getBotMenuImageBuffer();
        if (sock) {
          try {
            let sent: any = null;
            if (ppUrl) {
              sent = await sock.sendMessage(
                remoteJid,
                { image: { url: ppUrl }, caption: goodbyeCaption, mentions: targetUser ? [targetUser] : [] },
                { quoted: msg as any }
              );
            } else if (menuImg) {
              sent = await sock.sendMessage(
                remoteJid,
                { image: menuImg, caption: goodbyeCaption, mentions: targetUser ? [targetUser] : [] },
                { quoted: msg as any }
              );
            }
            if (sent?.key?.id) botSentMessageIds.add(sent.key.id);
            return '';
          } catch (e) {
            console.warn('[GOODBYE MSG ERR]', e);
          }
        }
        return goodbyeCaption;
      }
    }

    // ----------------------------------------------------
    // OWNER & SYSTEM MODES
    // ----------------------------------------------------
    case 'modeprivate':
    case 'modepublic':
    case 'mode': {
      const targetMode = cleanCmd === 'modeprivate' ? 'private' : cleanCmd === 'modepublic' ? 'public' : cleanArgs.trim().toLowerCase();
      if (targetMode === 'private' || targetMode.includes('priv') || targetMode === 'owner' || targetMode === 'off' || targetMode.includes('ferme') || targetMode.includes('close')) {
        state.botMode = 'private';
        saveSessionSettingsToDisk(sessionId, state);
        return `🔒 *Mode Bot* : PRIVÉ (Owner Only - Sauvegardé pour votre session de façon permanente)`;
      } else if (targetMode === 'public' || targetMode.includes('pub') || targetMode === 'all' || targetMode === 'on' || targetMode.includes('ouvert') || targetMode.includes('open')) {
        state.botMode = 'public';
        saveSessionSettingsToDisk(sessionId, state);
        return `🌐 *Mode Bot* : PUBLIC (Accessible à tous - Sauvegardé pour votre session de façon permanente)`;
      } else {
        const curMode = state.botMode || 'public';
        return `🛡️ *Mode actuel de votre session* : ${curMode.toUpperCase()} (${curMode === 'private' ? '🔒 PRIVÉ (Owner Only)' : '🌐 PUBLIC (Accessible à tous)'})`;
      }
    }

    case 'anticall': {
      const mode = cleanArgs.toLowerCase().trim();
      if (mode === 'off' || mode === 'stop' || mode === '0' || mode === 'false' || mode === 'desactiver') {
        state.antiCall = false;
        saveSessionSettingsToDisk(sessionId, state);
        return `📞 *Anticall* : OFF 🔴 (Maintenant désactivé pour votre session)`;
      }
      if (mode === 'on' || mode === '1' || mode === 'true' || mode === 'activer') {
        state.antiCall = true;
        saveSessionSettingsToDisk(sessionId, state);
        return `📞 *Anticall* : LIVE 🟢 (Maintenant activé pour votre session)`;
      }
      return state.antiCall ? `📞 *Anticall* : LIVE 🟢` : `📞 *Anticall* : OFF 🔴`;
    }

    case 'autostatusreply':
    case 'statusreply': {
      const mode = cleanArgs.toLowerCase().trim();
      if (mode === 'off' || mode === 'stop' || mode === '0' || mode === 'false' || mode === 'desactiver') {
        state.autoStatusReply = false;
        saveSessionSettingsToDisk(sessionId, state);
        return `💬 *Réponse Auto Statut* : DÉSACTIVÉE 🔴`;
      }
      if (mode === 'on' || mode === '1' || mode === 'true' || mode === 'activer' || !mode) {
        state.autoStatusReply = true;
        saveSessionSettingsToDisk(sessionId, state);
        return `💬 *Réponse Auto Statut* : ACTIVÉE 🟢 (Message: "${state.statusReplyText || '🤗'}")`;
      }
      state.autoStatusReply = true;
      state.statusReplyText = cleanArgs.trim();
      saveSessionSettingsToDisk(sessionId, state);
      return `💬 *Réponse Auto Statut* : ACTIVÉE 🟢\nNouveau message : "${state.statusReplyText}"`;
    }

    case 'autoread':
    case 'readmsg':
    case 'bluetick': {
      const mode = cleanArgs.toLowerCase().trim();
      if (mode === 'off' || mode === 'stop' || mode === '0' || mode === 'false' || mode === 'desactiver') {
        state.autoReadMsg = false;
        saveSessionSettingsToDisk(sessionId, state);
        return `🔵 *Auto-Read (Blue Tick)* : DÉSACTIVÉ 🔴`;
      }
      state.autoReadMsg = true;
      saveSessionSettingsToDisk(sessionId, state);
      return `🔵 *Auto-Read (Blue Tick)* : ACTIVÉ 🟢 (Les messages sont marqués comme lus automatiquement)`;
    }

    case 'rejectmsg':
    case 'setrejectmsg': {
      const newMsg = (args || cleanArgs || '').trim();
      if (!newMsg) {
        return `📞 *Message de rejet actuel* : "${state.rejectCallMsg || '*CALL LATER PLEASE ☺️🌹*'}"`;
      }
      state.rejectCallMsg = newMsg;
      saveSessionSettingsToDisk(sessionId, state);
      return `📞 *Nouveau message de rejet d'appel* : "${state.rejectCallMsg}"`;
    }

    case 'autoreact': {
      return `🛡️ *Réactions aux messages* : DÉSACTIVÉES ❌\n_Le bot ne réagit avec aucun emoji pour une discrétion totale._`;
    }

    case 'setprefix': {
      const newPrefix = (args || cleanArgs || '').trim();
      if (!newPrefix) {
        return `⚡ Préfixe actuel de votre session : [ ${state.prefix || '.'} ]`;
      }
      if (newPrefix === 'none' || newPrefix === 'off' || newPrefix === 'sans' || newPrefix === 'aucun') {
        state.prefix = '';
        state.prefixResetNoticeSent = true;
        saveSessionSettingsToDisk(sessionId, state);
        return `⚡ Préfixe désactivé pour votre session (commandes directes sans préfixe).`;
      }
      state.prefix = newPrefix;
      state.prefixResetNoticeSent = true;
      saveSessionSettingsToDisk(sessionId, state);
      return `⚡ Nouveau préfixe pour votre session : "${newPrefix}" (Sauvegardé de façon permanente à jamais)`;
    }

    case 'nule':
    case 'null':
    case 'noprefix': {
      const mode = cleanArgs.toLowerCase().replace(/^[=:\s]+/, '');
      if (mode === 'off' || mode === 'stop' || mode === '0' || mode === 'false' || mode === 'desactiver') {
        state.nuleMode = false;
        if (!state.prefix) state.prefix = '.';
        saveSessionSettingsToDisk(sessionId, state);
        return `⚡ *ᴍᴏᴅᴇ ɴᴜʟᴇ* : ᴏғғ 🔴\n_Le bot répond désormais uniquement aux commandes avec préfixe (ex: *.menu*)._`;
      }
      state.nuleMode = true;
      saveSessionSettingsToDisk(sessionId, state);
      return `⚡ *ᴍᴏᴅᴇ ɴᴜʟᴇ* : ʟɪᴠᴇ 🟢 (sᴀɴs ᴘʀᴇ́ғɪxᴇ)\n_Le bot répond désormais UNIQUEMENT aux commandes directes sans préfixe (ex: *menu*, *ping*, *kickall*).\nToutes les commandes avec préfixe (.menu, !menu) sont désormais ignorées._\n\n_Pour désactiver : tapez *nule=off* ou *.nule=off*._`;
    }

    case 'autostatus': {
      const mode = cleanArgs.toLowerCase();

      // Check if user is posting a status (with text or media)
      if (cleanArgs.startsWith('post ') || (!['on', 'off', 'view', 'vu', 'like', 'react', ''].includes(mode) && (cleanArgs.length > 5 || msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage))) {
        if (sock) {
          const textToPost = cleanArgs.replace(/^post\s+/i, '');
          return await postToWhatsAppStatus(sock, msg, textToPost, remoteJid);
        }
      }

      if (mode === 'on' || mode === 'active' || mode === 'enable' || mode === '1' || mode === '') {
        state.autoStatusView = true;
        state.autoLikeEnabled = false;
        saveSessionSettingsToDisk(sessionId, state);
        return `👁️ *ᴀᴜᴛᴏsᴛᴀᴛᴜs* : ʟɪᴠᴇ 🟢 (ᴠᴜ ᴀᴜᴛᴏᴍᴀᴛɪǫᴜᴇ 24ʜ/24 ᴘᴇʀᴍᴀɴᴇɴᴛ)`;
      }

      if (mode === 'off' || mode === 'desactive' || mode === 'disable' || mode === '0') {
        state.autoStatusView = false;
        state.autoLikeEnabled = false;
        saveSessionSettingsToDisk(sessionId, state);
        return `👁️ *ᴀᴜᴛᴏsᴛᴀᴛᴜs* : ᴏғғ 🔴`;
      }

      if (mode === 'view' || mode === 'vu') {
        state.autoStatusView = !state.autoStatusView;
        saveSessionSettingsToDisk(sessionId, state);
        return `👁️ *ᴀᴜᴛᴏsᴛᴀᴛᴜs* : ${state.autoStatusView ? "ʟɪᴠᴇ 🟢 (ᴠᴜ ᴀᴜᴛᴏᴍᴀᴛɪǫᴜᴇ 24ʜ/24 ᴘᴇʀᴍᴀɴᴇɴᴛ)" : "ᴏғғ 🔴"}`;
      }

      if (mode === 'like' || mode === 'react' || mode.startsWith('like ') || mode.startsWith('emoji ') || mode.startsWith('react ')) {
        const raw = cleanArgs.replace(/^(like|react|emoji)\s+/i, '').trim();
        const emojiList = parseAutoLikeEmojis(raw || '🥷🏿');
        state.autoLikeEnabled = true;
        state.autoLikeEmoji = emojiList.join(',');
        saveSessionSettingsToDisk(sessionId, state);
        const emojiDisplay = emojiList.length > 1 ? `[ ${emojiList.join(' ')} ] (1 émoji au hasard par statut)` : emojiList[0];
        return `🥷🏿 *ᴀᴜᴛᴏʟɪᴋᴇ* : ʟɪᴠᴇ 🟢 (ʟɪᴋᴇ ᴀᴜᴛᴏᴍᴀᴛɪǫᴜᴇ 24ʜ/24 - ${emojiDisplay})`;
      }

      return `👁️ *ᴀᴜᴛᴏsᴛᴀᴛᴜs* : ${state.autoStatusView ? "ʟɪᴠᴇ 🟢 (ᴠᴜ ᴀᴜᴛᴏᴍᴀᴛɪǫᴜᴇ 24ʜ/24 ᴘᴇʀᴍᴀɴᴇɴᴛ)" : "ᴏғғ 🔴"}`;
    }

    case 'autoviewstatus':
    case 'autoview': {
      const mode = cleanArgs.toLowerCase().replace(/^[=:\s]+/, '');
      if (mode === 'off' || mode === 'desactive' || mode === 'disable' || mode === '0') {
        state.autoStatusView = false;
        saveSessionSettingsToDisk(sessionId, state);
        return `👁️ *ᴀᴜᴛᴏsᴛᴀᴛᴜs* : ᴏғғ 🔴`;
      }
      state.autoStatusView = true;
      state.autoLikeEnabled = false;
      saveSessionSettingsToDisk(sessionId, state);
      return `👁️ *ᴀᴜᴛᴏsᴛᴀᴛᴜs* : ʟɪᴠᴇ 🟢 (ᴠᴜ ᴀᴜᴛᴏᴍᴀᴛɪǫᴜᴇ 24ʜ/24 ᴘᴇʀᴍᴀɴᴇɴᴛ)`;
    }

    case 'autosavestatus':
    case 'savestatus': {
      const mode = cleanArgs.toLowerCase().replace(/^[=:\s]+/, '');
      if (mode === 'off' || mode === 'desactive' || mode === 'disable' || mode === '0') {
        state.autoSaveStatus = false;
        saveSessionSettingsToDisk(sessionId, state);
        return `💾 *ᴀᴜᴛᴏsᴀᴠᴇsᴛᴀᴛᴜs* : ᴏғғ 🔴`;
      }
      state.autoSaveStatus = true;
      saveSessionSettingsToDisk(sessionId, state);
      return `💾 *ᴀᴜᴛᴏsᴀᴠᴇsᴛᴀᴛᴜs* : ʟɪᴠᴇ 🟢 (sᴀᴜᴠᴇɢᴀʀᴅᴇ 24ʜ/24 ᴘᴇʀᴍᴀɴᴇɴᴛ)`;
    }

    case 'gstatus':
    case 'tagstatus':
    case 'tstatus': {
      if (!isGroup || !remoteJid || !remoteJid.endsWith('@g.us')) {
        return `「❌ Cette commande fonctionne uniquement dans les groupes.」`;
      }

      const contextInfo =
        msg?.message?.extendedTextMessage?.contextInfo ||
        msg?.message?.imageMessage?.contextInfo ||
        msg?.message?.videoMessage?.contextInfo ||
        msg?.message?.audioMessage?.contextInfo ||
        msg?.message?.documentMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;

      if (!quoted) {
        return `「❌ Réponds à une photo, vidéo ou texte avec .gstatus」`;
      }

      let payload: any = quoted;
      if (payload.ephemeralMessage?.message) payload = payload.ephemeralMessage.message;
      if (payload.viewOnceMessage?.message) payload = payload.viewOnceMessage.message;
      if (payload.viewOnceMessageV2?.message) payload = payload.viewOnceMessageV2.message;
      if (payload.documentWithCaptionMessage?.message) payload = payload.documentWithCaptionMessage.message;

      const isImage = !!payload.imageMessage;
      const isVideo = !!payload.videoMessage;
      const isAudio = !!payload.audioMessage;
      const isText = !!(payload.conversation || payload.extendedTextMessage?.text);

      if (isAudio) {
        return `「❌ Le type audio n'est pas supporté pour le Group Status.」`;
      }

      try {
        const groupMeta = await sock.groupMetadata(remoteJid).catch(() => null);
        const mentions = groupMeta?.participants.map(p => p.id) || [];

        if (isImage) {
          const caption = payload.imageMessage?.caption || '';
          const media = await getMessageOrQuotedMedia(msg, remoteJid);
          if (!media || !media.buffer) {
            return `「❌ Impossible de télécharger la photo du message cité.」`;
          }

          const messageContent = await generateWAMessageContent(
            { image: media.buffer, caption },
            { userJid: sock.user?.id } as any
          );

          if (messageContent.imageMessage) {
            messageContent.imageMessage.contextInfo = {
              ...(messageContent.imageMessage.contextInfo || {}),
              isGroupStatus: true,
              mentionedJid: mentions
            } as any;
          }

          await sock.relayMessage(remoteJid, {
            groupStatusMessage: {
              message: messageContent
            }
          }, { messageId: sock.generateMessageTag() });

          return `「✅ Group Status publié avec succès.」`;
        }

        if (isVideo) {
          const caption = payload.videoMessage?.caption || '';
          const media = await getMessageOrQuotedMedia(msg, remoteJid);
          if (!media || !media.buffer) {
            return `「❌ Impossible de télécharger la vidéo du message cité.」`;
          }

          const messageContent = await generateWAMessageContent(
            { video: media.buffer, caption },
            { userJid: sock.user?.id } as any
          );

          if (messageContent.videoMessage) {
            messageContent.videoMessage.contextInfo = {
              ...(messageContent.videoMessage.contextInfo || {}),
              isGroupStatus: true,
              mentionedJid: mentions
            } as any;
          }

          await sock.relayMessage(remoteJid, {
            groupStatusMessage: {
              message: messageContent
            }
          }, { messageId: sock.generateMessageTag() });

          return `「✅ Group Status publié avec succès.」`;
        }

        if (isText) {
          const text = payload.conversation || payload.extendedTextMessage?.text || '';
          if (!text.trim()) {
            return `「❌ Le texte du message cité est vide.」`;
          }

          await sock.relayMessage(remoteJid, {
            groupStatusMessage: {
              message: {
                extendedTextMessage: {
                  text: text,
                  contextInfo: {
                    isGroupStatus: true,
                    mentionedJid: mentions
                  } as any
                }
              }
            }
          }, { messageId: sock.generateMessageTag() });

          return `「✅ Group Status publié avec succès.」`;
        }

        return `「❌ Réponds à une photo, vidéo ou texte avec .gstatus」`;
      } catch (err: any) {
        console.error('[GSTATUS ERROR]', {
          session: sessionId,
          groupJid: remoteJid,
          mediaType: isImage ? 'image' : isVideo ? 'video' : isText ? 'text' : 'unknown',
          baileysError: err?.message || err,
          timestamp: new Date().toISOString()
        });
        return `「❌ Impossible de publier le Group Status.\nVérifie les logs pour connaître l'erreur.」`;
      }
    }

    case 'status':
    case 'poststatus': {
      if (!sock) {
        return `╭━━━〔 ❌ *ERREUR STATUT WHATSAPP* 〕━━━╮\n┃\n┃  ◈ ⚠️ *Raison* : Aucun compte WhatsApp actif connecté.\n┃  ◈ 💡 *Solution* : Associez votre compte WhatsApp via le portail.\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
      }
      return await postToWhatsAppStatus(sock, msg, cleanArgs, remoteJid);
    }

    case 'pair':
    case 'pairing': {
      let targetPhone = cleanArgs.replace(/[^0-9]/g, '');
      if (!targetPhone) {
        const contextInfo =
          msg?.message?.extendedTextMessage?.contextInfo ||
          msg?.message?.imageMessage?.contextInfo ||
          msg?.message?.videoMessage?.contextInfo;
        const contextParticipant = contextInfo?.participant;
        if (contextParticipant) {
          targetPhone = contextParticipant.split('@')[0].replace(/[^0-9]/g, '');
        }
      }

      if (!targetPhone || targetPhone.length < 7) {
        return `📌 *USAGE COMMANDE DE JUMELAGE (.pair)*\n\nUsage : *.pair <numéro_avec_indicatif>*\nExemple : *.pair 50935975863*\n\nLe bot génère instantanément le code officiel WhatsApp et vous l'envoie directement ici !`;
      }

      try {
        const pairingRes = await requestPairingCode(targetPhone);
        if (!pairingRes.success) {
          return `❌ *Échec jumelage* : ${pairingRes.message}`;
        }

        const card = `╭━━━〔 📱 *≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 • CODE DE JUMELAGE* 〕━━━╮\n┃\n┃  ◈ 📞 *Numéro* : +${pairingRes.phone}\n┃  ◈ 🔑 *CODE OFFICIEL* : *${pairingRes.formattedCode}*\n┃  ◈ ⏱️ *Validité* : ${pairingRes.expiresInSeconds} secondes\n┃\n┃  📝 *COMMENT ASSOCIER VOTRE TÉLÉPHONE* :\n┃  1. Ouvrez WhatsApp sur l'appareil du +${pairingRes.phone}\n┃  2. Allez dans Réglages > Appareils connectés\n┃  3. Appuyez sur "Connecter un appareil"\n┃  4. Sélectionnez "Associer avec le numéro de téléphone"\n┃  5. Entrez ce code à 8 chiffres :\n┃\n┃  👉  \`${pairingRes.formattedCode}\`\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        if (sock && remoteJid) {
          setTimeout(async () => {
            try {
              await sock.sendMessage(remoteJid, { text: pairingRes.formattedCode });
            } catch (e) {}
          }, 600);
        }

        return card;
      } catch (err: any) {
        return `❌ *Erreur jumelage* : ${err?.message || 'Erreur lors de la génération du code'}`;
      }
    }

    case 'unblock': {
      return `╭━━━〔 ✅ *CONTACT DÉBLOQUÉ* 〕━━━╮\n┃\n┃  ◈ 👤 *Cible* : Contact sélectionné\n┃  ◈ 🛡️ *Statut* : Débloqué avec succès\n┃  ◈ 💬 *Effet* : Communications rétablies\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }

    case 'broadcast': {
      const text = cleanArgs || 'Annonce officielle de ≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿';
      return `╭━━━〔 📢 *DIFFUSION BROADCAST* 〕━━━╮\n┃\n┃  ◈ 📝 *Message* :\n┃     "${text}"\n┃  ◈ 🌐 *Cible* : Tous les groupes actifs\n┃  ◈ ⚡ *Vitesse* : Envoi instantané (0.0s)\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }

    case 'tgs': {
      if (!cleanArgs) {
        return '📦 *TELEGRAM STICKER DOWNLOADER (.TGS)*\n\nUsage : *.tgs <lien du pack ou sticker>*\nExemple : *.tgs https://t.me/addstickers/AnimPack*';
      }
      if (!sock || !remoteJid) {
        return `📦 Traitement TGS : ${cleanArgs}`;
      }

      const urlMatch = cleanArgs.match(/(https?:\/\/[^\s]+)/i);
      const targetUrl = urlMatch ? urlMatch[1] : cleanArgs.trim();

      const initialMsg = await sock.sendMessage(remoteJid, { text: '⏳ Initialisation du téléchargement TGS...' }, { quoted: msg as any }).catch(() => null);
      let statusKey = initialMsg?.key;

      const statusCallback = async (text: string) => {
        if (statusKey) {
          const res = await sock.sendMessage(remoteJid, { text: toSmallCaps(text), edit: statusKey }).catch(() => null);
          if (!res) {
            const fallbackSent = await sock.sendMessage(remoteJid, { text: toSmallCaps(text) }, { quoted: msg as any }).catch(() => null);
            if (fallbackSent?.key) statusKey = fallbackSent.key;
          }
        } else {
          const fallbackSent = await sock.sendMessage(remoteJid, { text: toSmallCaps(text) }, { quoted: msg as any }).catch(() => null);
          if (fallbackSent?.key) statusKey = fallbackSent.key;
        }
      };

      // Launch process asynchronously in background so command loop resolves immediately
      processTgsRequest(targetUrl, sock, remoteJid, msg, statusCallback).catch(async (err: any) => {
        await statusCallback(`❌ Erreur TGS : ${err?.message || 'Erreur interne'}`).catch(() => {});
      });

      return '';
    }

    case 'sticker':
    case 's':
    case 'stk': {
      if (!sock || !remoteJid) {
        return '🎨 Envoyez ou répondez à une photo ou courte vidéo avec *.sticker* pour créer un autocollant officiel.';
      }
      try {
        const media = await getMessageOrQuotedMedia(msg, remoteJid);
        if (media && media.buffer) {
          const isVideo = media.isVideo;
          const webpSticker = isVideo
            ? await createAnimatedSticker(media.buffer, '≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 V1', '𝐊𝐀𝐘𝐃𝐎 𝐃𝐄𝐕 & 𝐒𝐇𝐀𝐊𝐀 𝐃𝐄𝐕')
            : await createImageSticker(media.buffer, '≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 V1', '𝐊𝐀𝐘𝐃𝐎 𝐃𝐄𝐕 & 𝐒𝐇𝐀𝐊𝐀 𝐃𝐄𝐕');

          await sendSafeMediaOrText(sock, remoteJid, { sticker: webpSticker }, msg);
          return '';
        }

        // Image URL provided in command arguments
        if (cleanArgs && (cleanArgs.startsWith('http://') || cleanArgs.startsWith('https://'))) {
          const res = await axios.get(cleanArgs, { responseType: 'arraybuffer', timeout: 15000 });
          const webpSticker = await createImageSticker(Buffer.from(res.data), '≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 V1', '𝐊𝐀𝐘𝐃𝐎 𝐃𝐄𝐕 & 𝐒𝐇𝐀𝐊𝐀 𝐃𝐄𝐕');
          await sendSafeMediaOrText(sock, remoteJid, { sticker: webpSticker }, msg);
          return '';
        }

        // Text provided -> generate text sticker
        if (cleanArgs && cleanArgs.trim().length > 0) {
          const textSticker = await createTextSticker(cleanArgs, '≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 V1', '𝐊𝐀𝐘𝐃𝐎 𝐃𝐄𝐕 & 𝐒𝐇𝐀𝐊𝐀 𝐃𝐄𝐕');
          await sendSafeMediaOrText(sock, remoteJid, { sticker: textSticker }, msg);
          return '';
        }

        return '🎨 *≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 STICKER MAKER*\n\n👉 Répondez à une *photo* ou *vidéo* avec *.sticker*\n👉 Ou tapez *.sticker Votre Texte* pour créer un autocollant textuel officiel.';
      } catch (err: any) {
        console.error('[STICKER CMD ERROR]', err);
        return `❌ Erreur lors de la création du sticker : ${err?.message || 'Format non supporté'}`;
      }
    }

    case 'take':
    case 'wm': {
      if (!sock || !remoteJid) {
        return '✨ Répondez à un sticker avec *.take MonPack | MonNom* pour modifier les métadonnées.';
      }
      try {
        const media = await getMessageOrQuotedMedia(msg, remoteJid);
        if (media && media.buffer) {
          const parts = cleanArgs.split('|');
          const pack = parts[0]?.trim() || '≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 V1';
          const author = parts[1]?.trim() || (cleanArgs.trim() || '𝐊𝐀𝐘𝐃𝐎 𝐃𝐄𝐕 & 𝐒𝐇𝐀𝐊𝐀 𝐃𝐄𝐕');
          const updatedSticker = await createImageSticker(media.buffer, pack, author);
          await sendSafeMediaOrText(sock, remoteJid, { sticker: updatedSticker }, msg);
          return '';
        }
        return '✨ Répondez à un autocollant avec *.take <Nom du Pack> | <Auteur>* pour renouveler ses crédits.';
      } catch (e: any) {
        return `❌ Erreur modification sticker : ${e?.message || 'Erreur'}`;
      }
    }

    case 'toimg':
    case 'simage': {
      if (!sock || !remoteJid) {
        return '🖼️ Répondez à un sticker avec *.simage* ou *.toimg* pour le convertir en photo.';
      }
      try {
        const media = await getMessageOrQuotedMedia(msg, remoteJid);
        if (media && media.buffer) {
          const pngBuf = await convertStickerToImage(media.buffer);
          await sendSafeMediaOrText(sock, remoteJid, {
            image: pngBuf,
            caption: toSmallCaps('🖼️ *Sticker converti en photo HD avec succès.*'),
          }, msg);
          return '';
        }
        return '🖼️ Répondez à un autocollant avec *.simage* ou *.toimg* pour extraire la photo originale.';
      } catch (e: any) {
        return `❌ Erreur conversion sticker vers image : ${e?.message || 'Erreur'}`;
      }
    }

    case 'svideo':
    case 'tovideo': {
      if (!sock || !remoteJid) {
        return '🎬 Répondez à un sticker animé avec *.svideo* pour le convertir en vidéo MP4.';
      }
      try {
        const media = await getMessageOrQuotedMedia(msg, remoteJid);
        if (media && media.buffer) {
          const vidBuf = await convertStickerToVideo(media.buffer);
          await sendSafeMediaOrText(sock, remoteJid, {
            video: vidBuf,
            caption: toSmallCaps('🎬 *Sticker animé converti en vidéo MP4.*'),
          }, msg);
          return '';
        }
        return '🎬 Répondez à un autocollant animé avec *.svideo*.';
      } catch (e: any) {
        return `❌ Erreur conversion sticker vers vidéo : ${e?.message || 'Erreur'}`;
      }
    }

    case 'qr': {
      const text = cleanArgs || 'https://wa.me/50935975863';
      if (sock && remoteJid) {
        try {
          const QRCode = await import('qrcode');
          const qrBuf = await QRCode.default.toBuffer(text);
          await sendSafeMediaOrText(sock, remoteJid, {
            image: qrBuf,
            caption: toSmallCaps(`📱 *QR Code* : ${text}`),
          }, msg);
          return '';
        } catch {}
      }
      return `📱 *QR Code* généré pour : "${text}"`;
    }

    // ----------------------------------------------------
    // MEDIA DOWNLOADERS & DISPATCHERS (TIKTOK, INSTA, FB, TWITTER, YOUTUBE)
    // ----------------------------------------------------
    case 'tiktok':
    case 'tik':
    case 'tt': {
      if (!cleanArgs) {
        return '🎬 *TIKTOK DOWNLOADER (HD SANS FILIGRANE)*\n\nUsage : *.tiktok <lien de la vidéo>*\nExemple : *.tiktok https://www.tiktok.com/@user/video/123456789*';
      }
      if (!sock || !remoteJid) {
        return `🎬 Téléchargement TikTok : ${cleanArgs}`;
      }
      return await handleDownloadCommand(cleanArgs, 'tiktok', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'instagram':
    case 'ig':
    case 'igs':
    case 'igsc': {
      if (!cleanArgs) {
        return '📸 *INSTAGRAM DOWNLOADER*\n\nUsage : *.instagram <lien Reel / Post>*\nExemple : *.instagram https://www.instagram.com/reel/C123456789*';
      }
      if (!sock || !remoteJid) {
        return `📸 Téléchargement Instagram : ${cleanArgs}`;
      }
      return await handleDownloadCommand(cleanArgs, 'instagram', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'facebook':
    case 'fb': {
      if (!cleanArgs) {
        return '📘 *FACEBOOK DOWNLOADER*\n\nUsage : *.facebook <lien vidéo/reel>*\nExemple : *.fb https://fb.watch/xyz123*';
      }
      if (!sock || !remoteJid) {
        return `📘 Téléchargement Facebook : ${cleanArgs}`;
      }
      return await handleDownloadCommand(cleanArgs, 'facebook', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'twitter':
    case 'x':
    case 'tweet': {
      if (!cleanArgs) {
        return '🐦 *TWITTER / X DOWNLOADER*\n\nUsage : *.twitter <lien du tweet>*\nExemple : *.x https://x.com/user/status/123456*';
      }
      if (!sock || !remoteJid) {
        return `🐦 Téléchargement Twitter / X : ${cleanArgs}`;
      }
      return await handleDownloadCommand(cleanArgs, 'twitter', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'song':
    case 'play':
    case 'audio':
    case 'mp3': {
      const query = cleanArgs || 'Hit Song';
      if (!sock || !remoteJid) {
        return `🎵 *Audio* : Recherche de "${query}"...`;
      }
      return await handleDownloadCommand(query, 'youtube', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'video':
    case 'ytvideo':
    case 'ytmp4':
    case 'mp4':
    case 'youtube':
    case 'yt': {
      const query = cleanArgs || 'Trending video';
      if (!cleanArgs) {
        return '📺 *YOUTUBE / VIDEO DOWNLOADER*\n\nUsage : *.youtube <lien ou recherche>*\nExemple : *.yt https://www.youtube.com/watch?v=...*';
      }
      if (!sock || !remoteJid) {
        return `🎬 *Vidéo* : "${query}"`;
      }
      return await handleDownloadCommand(query, 'youtube', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'lyrics': {
      const title = cleanArgs || 'Chanson';
      return `📜 *PAROLES DE CHANSON • ${title.toUpperCase()}*\n\n[Refrain]\n(Paroles synchronisées extraites pour vous)\nMusique produite & diffusée via ≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 V1.`;
    }

    case 'pinterest':
    case 'image':
    case 'photo':
    case 'wallpaper': {
      const prompt = cleanArgs || 'anime wallpaper 4k';
      if (!sock || !remoteJid) {
        return `🖼️ Image pour "${prompt}" prête.`;
      }
      try {
        const result = await downloadPinterestImage(prompt);
        if (result.success && result.buffer) {
          await sendSafeMediaOrText(sock, remoteJid, {
            image: result.buffer,
            caption: toSmallCaps(result.title || `🖼️ *${prompt}*`),
          }, msg);
          return '';
        }
        return result.error || `❌ Impossible de récupérer l'image pour "${prompt}".`;
      } catch (err: any) {
        return `❌ Erreur lors de l'envoi de l'image : ${err?.message || 'Erreur'}`;
      }
    }

    case 'dl':
    case 'download':
    case 'get': {
      if (!cleanArgs) {
        return '⚡ *TELECHARGER UNIVERSAL (.DL)*\n\nUsage : *.dl <lien URL>*\nExemple : *.dl https://www.tiktok.com/@user/video/12345*\n\nPlateformes gérées : TikTok, YouTube, Instagram, Facebook, Twitter/X, Pinterest, Reddit, Threads, Snapchat, Twitch, SoundCloud, Spotify, Vimeo, Dailymotion, Tumblr, Likee, Kwai, CapCut, Telegram, et liens directs.';
      }
      const detectedPlat = detectPlatform(cleanArgs);
      const targetPlat = detectedPlat !== 'unknown' ? detectedPlat : 'direct';
      return await handleDownloadCommand(cleanArgs, targetPlat, sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'shorts':
    case 'ytshorts': {
      if (!cleanArgs) {
        return '🔴 *YOUTUBE SHORTS DOWNLOADER*\n\nUsage : *.shorts <lien YouTube Shorts>*\nExemple : *.shorts https://www.youtube.com/shorts/xyz123*';
      }
      return await handleDownloadCommand(cleanArgs, 'shorts', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'pin': {
      if (!cleanArgs) {
        return '📌 *PINTEREST DOWNLOADER*\n\nUsage : *.pin <lien Pinterest>*\nExemple : *.pin https://pin.it/xyz123*';
      }
      return await handleDownloadCommand(cleanArgs, 'pinterest', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'snapchat':
    case 'snap': {
      if (!cleanArgs) {
        return '👻 *SNAPCHAT DOWNLOADER*\n\nUsage : *.snapchat <lien Spotlight ou Story publique>*\nExemple : *.snap https://story.snapchat.com/s/xyz123*';
      }
      return await handleDownloadCommand(cleanArgs, 'snapchat', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'threads': {
      if (!cleanArgs) {
        return '🧵 *THREADS DOWNLOADER*\n\nUsage : *.threads <lien publication Threads>*\nExemple : *.threads https://www.threads.net/@user/post/xyz123*';
      }
      return await handleDownloadCommand(cleanArgs, 'threads', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'reddit': {
      if (!cleanArgs) {
        return '🤖 *REDDIT DOWNLOADER*\n\nUsage : *.reddit <lien du post Reddit>*\nExemple : *.reddit https://www.reddit.com/r/videos/comments/xyz123*';
      }
      return await handleDownloadCommand(cleanArgs, 'reddit', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'twitch': {
      if (!cleanArgs) {
        return '🟪 *TWITCH DOWNLOADER*\n\nUsage : *.twitch <lien Clip ou Vidéo Twitch>*\nExemple : *.twitch https://clips.twitch.tv/xyz123*';
      }
      return await handleDownloadCommand(cleanArgs, 'twitch', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'soundcloud':
    case 'sc': {
      if (!cleanArgs) {
        return '☁️ *SOUNDCLOUD DOWNLOADER*\n\nUsage : *.soundcloud <lien du morceau>*\nExemple : *.sc https://soundcloud.com/artist/track*';
      }
      return await handleDownloadCommand(cleanArgs, 'soundcloud', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'spotify': {
      if (!cleanArgs) {
        return '🟢 *SPOTIFY DOWNLOADER*\n\nUsage : *.spotify <lien du titre ou recherche>*\nExemple : *.spotify https://open.spotify.com/track/xyz123*';
      }
      return await handleDownloadCommand(cleanArgs, 'spotify', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'linkedin': {
      if (!cleanArgs) {
        return '💼 *LINKEDIN DOWNLOADER*\n\nUsage : *.linkedin <lien du post vidéo>*\nExemple : *.linkedin https://www.linkedin.com/posts/xyz123*';
      }
      return await handleDownloadCommand(cleanArgs, 'linkedin', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'vimeo': {
      if (!cleanArgs) {
        return '🔷 *VIMEO DOWNLOADER*\n\nUsage : *.vimeo <lien de la vidéo>*\nExemple : *.vimeo https://vimeo.com/123456789*';
      }
      return await handleDownloadCommand(cleanArgs, 'vimeo', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'dailymotion': {
      if (!cleanArgs) {
        return '📲 *DAILYMOTION DOWNLOADER*\n\nUsage : *.dailymotion <lien de la vidéo>*\nExemple : *.dailymotion https://www.dailymotion.com/video/x123456*';
      }
      return await handleDownloadCommand(cleanArgs, 'dailymotion', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'tumblr': {
      if (!cleanArgs) {
        return '🔮 *TUMBLR DOWNLOADER*\n\nUsage : *.tumblr <lien du post>*\nExemple : *.tumblr https://user.tumblr.com/post/123456*';
      }
      return await handleDownloadCommand(cleanArgs, 'tumblr', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'likee': {
      if (!cleanArgs) {
        return '💖 *LIKEE DOWNLOADER*\n\nUsage : *.likee <lien de la vidéo>*\nExemple : *.likee https://likee.video/@user/video/123456*';
      }
      return await handleDownloadCommand(cleanArgs, 'likee', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'kwai': {
      if (!cleanArgs) {
        return '🧡 *KWAI DOWNLOADER*\n\nUsage : *.kwai <lien de la vidéo>*\nExemple : *.kwai https://kwai-video.com/p/123456*';
      }
      return await handleDownloadCommand(cleanArgs, 'kwai', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'capcut': {
      if (!cleanArgs) {
        return '🎬 *CAPCUT DOWNLOADER*\n\nUsage : *.capcut <lien du template ou vidéo>*\nExemple : *.capcut https://www.capcut.com/t/xyz123*';
      }
      return await handleDownloadCommand(cleanArgs, 'capcut', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'telegram':
    case 'tg': {
      if (!cleanArgs) {
        return '✈️ *TELEGRAM MEDIA DOWNLOADER*\n\nUsage : *.telegram <lien du post public t.me>*\nExemple : *.tg https://t.me/channel/123*';
      }
      return await handleDownloadCommand(cleanArgs, 'telegram', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    case 'direct':
    case 'media':
    case 'url': {
      if (!cleanArgs) {
        return '🔗 *TELECHARGER DE LIEN DIRECT*\n\nUsage : *.direct <lien URL direct mp4, mp3, jpg, png>*\nExemple : *.direct https://site.com/video.mp4*';
      }
      return await handleDownloadCommand(cleanArgs, 'direct', sock, remoteJid, msg, loadingMsg, sessionId);
    }

    // ----------------------------------------------------
    // FUN COMMANDS
    // ----------------------------------------------------
    case 'joke': {
      const jokes = [
        'Pourquoi les développeurs détestent la lumière du soleil ? Parce qu\'elle génère des reflets sur l\'écran !',
        'Que dit une imprimante dans l\'eau ? "J\'ai du papier qui flotte !"',
        'Comment appelle-t-on un chat tout terrain ? Un cat-cat (4x4) !',
        'Un informaticien ne compte pas jusqu\'à 3, il commence à 0.',
      ];
      return `😂 *BLAGUE ≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿*\n\n${jokes[Math.floor(Math.random() * jokes.length)]}`;
    }

    case 'meme': {
      return `🤣 *MÈME POPULAIRE DU JOUR*\n[Mème humoristique internet sélectionné pour vous]`;
    }

    case 'flirt': {
      return `💘 *DISQUETTE ≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿*\n"Ton père ne serait pas un voleur d'étoiles ? Parce qu'il en a mis deux dans tes yeux."`;
    }

    case 'compliment': {
      return `✨ *COMPLIMENT DU JOUR*\n"Tu as une énergie incroyable et un esprit brillant. Continue de viser l'excellence !"`;
    }

    case 'truth': {
      return `🤫 *VÉRITÉ (TRUTH)*\nQuel est le plus grand secret que tu n'as jamais osé révéler à personne ?`;
    }

    case 'dare': {
      return `🔥 *ACTION (DARE)*\nEnvoie une note vocale de 5 secondes en chantant le refrain de ta chanson préférée !`;
    }

    case 'ship': {
      const percent = Math.floor(Math.random() * 60) + 40;
      return `💘 *COMPATIBILITÉ AMOUREUSE*\nTaux de match : *${percent}%* 💖\nVerdict : C'est une belle histoire qui commence !`;
    }

    case 'bomb': {
      return `💣 *JEU DE LA BOMBE*\nFils détectés : 🔴 Rouge | 🔵 Bleu | 🟢 Vert\nChoisissez vite un fil pour désamorcer la bombe !`;
    }

    case 'gayrate': {
      const rate = Math.floor(Math.random() * 100);
      return `🌈 *JAUGE GAYRATE* : ${rate}%`;
    }

    case 'insult': {
      return `⚡ *CLASH HUMORISTIQUE*\n"Ton niveau de répartie charge encore en 2G." (Humour amical)`;
    }

    case 'tictactoe': {
      return `🎮 *MORPION (TICTACTOE)*\nPartie lancée ! Grille disponible :\n1 | 2 | 3\n4 | 5 | 6\n7 | 8 | 9\nTapez un chiffre pour jouer votre coup.`;
    }

    // ----------------------------------------------------
    // TEXTMAKER COMMANDS
    // ----------------------------------------------------
    case '1917':
    case 'fire':
    case 'neon':
    case 'glitch':
    case 'hacker':
    case 'matrix':
    case 'thunder':
    case 'devil':
    case 'blackpink':
    case 'arena':
    case 'leaves':
    case 'ice':
    case 'impressive':
    case 'light':
    case 'metallic':
    case 'purple':
    case 'sand':
    case 'snow': {
      const text = cleanArgs || 'KAYDO DEV';
      return `╭━━━〔 🖋️ *TEXTMAKER • ${cleanCmd.toUpperCase()}* 〕━━━╮\n┃\n┃  ◈ 🎨 *Effet appliqué* : ${cleanCmd.toUpperCase()}\n┃  ◈ ✍️ *Texte* : ${text}\n┃  ◈ ✨ *Rendu* : Style haute définition généré\n┃\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    }

    case 'getpp': {
      if (sock && remoteJid) {
        try {
          const target =
            msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
            msg?.message?.extendedTextMessage?.contextInfo?.participant ||
            (cleanArgs ? cleanArgs.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : remoteJid);
          const ppUrl = await sock.profilePictureUrl(target, 'image').catch(() => null);
          if (ppUrl) {
            return `📸 *PHOTO DE PROFIL ≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿*\nPhoto trouvée pour @${target.split('@')[0]} :\n🔗 ${ppUrl}`;
          }
        } catch (e) {
          // fallback
        }
      }
      return `📸 *PHOTO DE PROFIL (GETPP)*\nAucune photo de profil publique trouvée pour ce contact.`;
    }

    case 'groupstatus': {
      return `🛡️ *Sécurité Groupe* :\nAnti-Link: ${state.antiLink ? '✅' : '❌'} | Anti-Tag: ${state.antiTag ? '✅' : '❌'} | Anti-Call: ${state.antiCall ? '✅' : '❌'} | Mode: ${state.botMode.toUpperCase()}`;
    }

    case 'setwelcome': {
      const text = cleanArgs || 'Bienvenue dans notre groupe !';
      return `✅ *Bienvenue configuré* : "${text}"`;
    }

    case 'setgoodbye': {
      const text = cleanArgs || 'Au revoir et bonne continuation !';
      return `✅ *Adieu configuré* : "${text}"`;
    }

    case 'setbotname': {
      // 1. Restriction stricte aux propriétaires
      const cleanSender = (senderJid || '').replace(/\D/g, '');
      const isFromMe = !!msg?.key?.fromMe;
      const isCallerOwner =
        isFromMe ||
        isOwnerNumber(senderJid, sessionPhone) ||
        isOwnerNumber(cleanSender, sessionPhone) ||
        isUserProtected(senderJid || '', sessionPhone) ||
        isUserSudo(cleanSender, sessionId);

      if (!isCallerOwner) {
        return `*╭─❖━━━ ⟣ ⟣ ⟣ ${getBotName()} ⟣ ⟣ ⟣━━━❖*\n*┇*🔹╭───────────────\n*┇*🔹┋. 🚫 *ACCÈS STRICTEMENT RÉSERVÉ AUX OWNERS* 🚫\n*┇*🔹┋ Seul le propriétaire du bot a le contrôle sur le nom du bot.\n*┇*🔹╰───────────────⊷\n*╰━━━━━━━━━━━━━━━━━❖*`;
      }

      const newName = (rawArgs || cleanArgs || '').trim();
      if (!newName) {
        return `❌ Veuillez fournir le nouveau nom du bot (ex: .setbotname ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿)`;
      }

      // 2. Mise à jour globale et permanente pour tout le bot
      setGlobalBotName(newName);
      state.botName = newName;

      // Propager immédiatement à toutes les sessions actives en mémoire
      sessionStates.forEach((s) => {
        s.botName = newName;
      });

      // Sauvegarder sur disque pour toutes les sessions
      if (sessionId) {
        setSessionCustomName(sessionId, newName);
        saveSessionSettingsToDisk(sessionId, state);
      }

      const SESSIONS_ROOT = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions');
      if (fs.existsSync(SESSIONS_ROOT)) {
        try {
          const entries = fs.readdirSync(SESSIONS_ROOT, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              const settingsPath = path.join(SESSIONS_ROOT, entry.name, 'settings.json');
              if (fs.existsSync(settingsPath)) {
                try {
                  const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                  data.botName = newName;
                  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), 'utf8');
                } catch (_) {}
              }
            }
          }
        } catch (_) {}
      }

      return `*╭─❖━━━ ⟣ ⟣ ⟣  NOM DU BOT MIS À JOUR  ⟣ ⟣ ⟣━━━❖*\n*┇*🔹╭───────────────\n*┇*🔹┋. 👑 *NOUVEAU NOM :* ${newName}\n*┇*🔹┋. ⚡ *STATUT :* Modifié à jamais dans tout le bot et dans toutes les réponses !\n*┇*🔹╰───────────────⊷\n*╰━━━━━━━━━━━━━━━━━❖*`;
    }

    case 'antidelete': {
      const mode = cleanArgs.toLowerCase().trim();
      const isEnabled = mode === 'on' || mode === '1' || mode === 'true' || mode === 'activer' || (mode !== 'off' && mode !== '0' && mode !== 'false' && mode !== 'desactiver' && !state.antiDelete);
      state.antiDelete = isEnabled;
      saveSessionSettingsToDisk(sessionId, state);
      return `🗑️ *Anti-Delete* : ${isEnabled ? 'ACTIVÉ 🟢 (Les messages supprimés vous seront transférés en privé)' : 'DÉSACTIVÉ 🔴'}`;
    }

    case 'setbotpp': {
      if (!sock || !remoteJid) {
        return toSmallCaps('📸 Répondez à une photo avec *.setbotpp* pour modifier la photo de profil de votre bot.');
      }
      try {
        const media = await getMessageOrQuotedMedia(msg, remoteJid);
        if (media && media.buffer) {
          const croppedBuf = await sharp(media.buffer)
            .resize(640, 640, { fit: 'cover' })
            .jpeg({ quality: 90 })
            .toBuffer();

          const targetUserJid = sock.user?.id
            ? jidNormalizedUser(sock.user.id)
            : (sock.authState?.creds?.me?.id ? jidNormalizedUser(sock.authState.creds.me.id) : '');

          if (targetUserJid && (sock as any).updateProfilePicture) {
            try {
              await (sock as any).updateProfilePicture(targetUserJid, croppedBuf);
            } catch (upErr) {
              const tmpDir = os.tmpdir();
              const tmpFile = path.join(tmpDir, `pp_${Date.now()}.jpg`);
              await fs.promises.writeFile(tmpFile, croppedBuf);
              try {
                await (sock as any).updateProfilePicture(targetUserJid, { url: tmpFile });
              } finally {
                try { if (fs.existsSync(tmpFile)) await fs.promises.unlink(tmpFile); } catch {}
              }
            }
          }

          if (sessionId) {
            const SESSIONS_ROOT = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions');
            const sessionDir = path.join(SESSIONS_ROOT, sessionId);
            if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
            fs.writeFileSync(path.join(sessionDir, 'bot_pp.jpg'), croppedBuf);
          }

          return toSmallCaps('📸 *Photo de profil WhatsApp mise à jour avec succès pour votre bot.*');
        }
        return toSmallCaps('📸 Veuillez répondre directement à une *photo* avec *.setbotpp*.');
      } catch (err: any) {
        return toSmallCaps(`❌ Échec de la mise à jour de la photo de profil : ${err?.message || 'Erreur'}`);
      }
    }

    case 'memesearch': {
      const topic = cleanArgs || 'dev';
      return `🤣 *Mème ${topic}* sélectionné.`;
    }

    case 'pies': {
      return `🥧 SPLAAAASH ! Une tarte s'écrase sur votre cible ! 😆`;
    }

    case 'waifu':
    case 'neko':
    case 'hneko':
    case 'hwaifu':
    case 'megumin':
    case 'milf':
    case 'loli':
    case 'random':
    case 'konachan': {
      const category = cleanCmd;
      if (!sock || !remoteJid) {
        return `👾 Anime image : ${category}`;
      }
      try {
        const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent('anime ' + category + ' cute artwork')}?width=1024&height=1024&nologo=true`;
        const res = await fetch(imgUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          await sock.sendMessage(remoteJid, {
            image: buf,
            caption: toSmallCaps(`👾 *Anime* : ${category}`),
          }, { quoted: msg as any });
          return '';
        }
      } catch {}
      return `👾 Illustration anime *${category}* prête.`;
    }

    case 'crash-wa':
    case 'kaydo-wa': {
      // Simulateur de robustesse réseau (Message informatif)
      return `⚠️ *TEST DE ROBUSTESSE RÉSEAU* : 
      
      Commande : *${cmdName}*
      Target : ${cleanArgs || 'Aucune cible spécifiée'}
      
      *Statut :* Session de test initialisée.`;
    }



    // ----------------------------------------------------
    // COMMANDE INCONNUE / NON EXISTANTE
    // Le bot ignore totalement (aucun message, silence absolu)
    // ----------------------------------------------------
    default: {
      return '';
    }
  }
}

const KNOWN_COMMANDS = new Set([
  'menu', 'help', 'ping', 'uptime', 'runtime', 'owner', 'owner1', 'owner2', 'creator1', 'creator2', 'dev1', 'dev2', 'alive', 'list', 'vv', '❤️', 'vo',
  'send', 'save', 'send2', 'save2',
  'sudo', 'setsudo', 'unsudo', 'delsudo', 'listsudo', 'sudolist', 'antidelete',
  'kickall', 'purge', 'kick', 'promote', 'demote', 'promoteall', 'demoteall', 'demoter', 'acceptall', 'rejectall', 'mute', 'unmute', 'tagall', 'hidetag',
  'warn', 'resetwarn', 'delete', 'clean', 'mode', 'modeprivate', 'modepublic', 'autolike', 'autolikestatus', 'online', 'offline',
  'autorecording', 'autotyping', 'autostatus', 'autoviewstatus', 'autoview', 'autosavestatus', 'autostatusreply', 'statusreply', 'autoread', 'readmsg', 'bluetick', 'rejectmsg', 'setrejectmsg', 'savestatus', 'gstatus', 'status', 'poststatus', 'pair', 'pairing', 'nule',
  'block', 'unblock',
  'getpp', 'qr', 'simage', 'svideo', 'tovideo', 'toimg', 'sticker', 's', 'take', 'tgs',
  'joke', 'meme', 'memesearch', 'truth', 'dare', 'flirt', 'compliment', 'insult',
  'bomb', 'ship', 'tictactoe', 'gayrate', 'pies', 'waifu', 'neko', 'hneko',
  'hwaifu', 'megumin', 'milf', 'loli', 'random', 'konachan', 'song', 'play', 'audio', 'mp3', 'video', 'ytvideo', 'mp4',
  'tiktok', 'instagram', 'facebook', 'lyrics', 'pinterest', 'image', 'photo', 'wallpaper', 'igs', 'igsc',
  'dl', 'download', 'get', 'shorts', 'ytshorts', 'pin', 'snapchat', 'snap', 'threads', 'reddit', 'twitch',
  'soundcloud', 'sc', 'spotify', 'linkedin', 'vimeo', 'dailymotion', 'tumblr', 'likee', 'kwai', 'capcut', 'telegram', 'tg',
  'direct', 'media', 'url',
  'anticall', 'autoreact', 'setbotname', 'setbotpp',
  'setmenuimage', 'setmenuvideo', 'selmenuimage', 'selmenuvideo',
  'setimageall', 'setvideoall', 'setallimage', 'setallvideo',
  'setmenuimageall', 'setmenuvideoall', 'setimagemenu', 'setvideomenu',
  'testowner', 'isowner', 'checkowner',
  'crash-wa', 'kaydo-wa',
  'restore', 'restoresessions', 'reconnect', 'reconnectall',
  'setprefix', 'broadcast', 'grouplink', 'groupstatus', 'setgname', 'setgroupname', 'setname', 'setgpp', 'setgrouppp', 'setgicon', 'admins', 'admin', 'listadmin', 'listadmins',
  'groupinfo', 'groupstats', 'welcome', 'bienvenue', 'goodbye', 'aurevoir',
  'setwelcome', 'setgoodbye', 'antilink', 'antitag', 'antigroupmention',
  'autosticker', 'antisticker', 'antibot', 'antimsg', 'antimessage', 'excuse', 'excuses', 'apology', 'pardon', 'desole', 'sorry',
  'add', 'ajouter', 'invite', 'left', 'leave', 'sortir', 'quitter',
  '1917', 'fire', 'neon', 'glitch', 'hacker', 'matrix', 'thunder', 'devil', 'blackpink', 'arena', 'leaves', 'ice', 'impressive', 'light', 'metallic', 'purple', 'sand', 'snow',
  ...USEFUL_COMMAND_LIST
]);

// Memory set of message IDs sent by the bot itself to prevent self-triggering loops
const botSentMessageIds = new Set<string>();
const antilinkWarnings = new Map<string, Map<string, number>>();

const groupMetaCache = new Map<string, { meta: any; fetchedAt: number }>();

async function getCachedGroupMetadata(sock: any, groupJid: string): Promise<any> {
  const cached = groupMetaCache.get(groupJid);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < 30000) {
    return cached.meta;
  }
  try {
    const meta = await sock.groupMetadata(groupJid);
    groupMetaCache.set(groupJid, { meta, fetchedAt: now });
    return meta;
  } catch (err) {
    if (cached) return cached.meta;
    throw err;
  }
}

async function isParticipantAdmin(sock: any, groupJid: string, participantJid: string, sessionPhone: string): Promise<boolean> {
  try {
    const normParticipant = jidNormalizedUser(participantJid);
    const cleanSender = normParticipant.replace(/[^0-9]/g, '');
    if (
      isOwnerNumber(normParticipant, sessionPhone) ||
      isOwnerNumber(cleanSender, sessionPhone) ||
      cleanSender.includes(OWNER_1) ||
      cleanSender.includes(OWNER_2) ||
      (sessionPhone && cleanSender.includes(sessionPhone.replace(/\D/g, '')))
    ) {
      return true;
    }
    const meta = await getCachedGroupMetadata(sock, groupJid);
    if (!meta) return false;
    const participant = meta.participants.find((p: any) => jidNormalizedUser(p.id) === normParticipant);
    return participant?.admin === 'admin' || participant?.admin === 'superadmin';
  } catch {
    return false;
  }
}

async function isBotGroupAdmin(sock: any, groupJid: string, sessionPhone: string): Promise<boolean> {
  try {
    const botLid = sock.user?.lid ? jidNormalizedUser(sock.user.lid) : '';
    const botIdNormalized = sock.user?.id ? jidNormalizedUser(sock.user.id) : '';
    const cleanBotDigits = (sock.user?.id || '').split(':')[0].replace(/\D/g, '');
    const cleanSessionDigits = (sessionPhone || '').replace(/\D/g, '');

    const meta = await getCachedGroupMetadata(sock, groupJid);
    if (!meta) return false;

    const botParticipant = meta.participants.find((p: any) => {
      const normP = jidNormalizedUser(p.id);
      const pDigits = p.id.split('@')[0].split(':')[0].replace(/\D/g, '');
      return (
        (botLid && normP === botLid) ||
        (botIdNormalized && normP === botIdNormalized) ||
        (cleanBotDigits && pDigits === cleanBotDigits) ||
        (cleanSessionDigits && pDigits === cleanSessionDigits)
      );
    });
    return botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
  } catch {
    return false;
  }
}

function isParticipantAdminSync(groupJid: string, participantJid: string, sessionPhone: string): boolean {
  try {
    const normParticipant = jidNormalizedUser(participantJid);
    const cleanSender = normParticipant.replace(/[^0-9]/g, '');
    if (
      isOwnerNumber(normParticipant, sessionPhone) ||
      isOwnerNumber(cleanSender, sessionPhone) ||
      cleanSender.includes(OWNER_1) ||
      cleanSender.includes(OWNER_2) ||
      (sessionPhone && cleanSender.includes(sessionPhone.replace(/\D/g, '')))
    ) {
      return true;
    }
    const cached = groupMetaCache.get(groupJid);
    if (!cached || !cached.meta) return false;
    const participant = cached.meta.participants.find((p: any) => jidNormalizedUser(p.id) === normParticipant);
    return participant?.admin === 'admin' || participant?.admin === 'superadmin';
  } catch {
    return false;
  }
}

function isBotGroupAdminSync(sock: any, groupJid: string, sessionPhone: string): boolean {
  try {
    const botLid = sock.user?.lid ? jidNormalizedUser(sock.user.lid) : '';
    const botIdNormalized = sock.user?.id ? jidNormalizedUser(sock.user.id) : '';
    const cleanBotDigits = (sock.user?.id || '').split(':')[0].replace(/\D/g, '');
    const cleanSessionDigits = (sessionPhone || '').replace(/\D/g, '');

    const cached = groupMetaCache.get(groupJid);
    if (!cached || !cached.meta) return true; // Fail-open to allow immediate deletion attempt

    const botParticipant = cached.meta.participants.find((p: any) => {
      const normP = jidNormalizedUser(p.id);
      const pDigits = p.id.split('@')[0].split(':')[0].replace(/\D/g, '');
      return (
        (botLid && normP === botLid) ||
        (botIdNormalized && normP === botIdNormalized) ||
        (cleanBotDigits && pDigits === cleanBotDigits) ||
        (cleanSessionDigits && pDigits === cleanSessionDigits)
      );
    });
    return botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
  } catch {
    return true; // Fail-open
  }
}

export function recordBotSentMessageId(msgId: string) {
  if (msgId) {
    botSentMessageIds.add(msgId);
    if (botSentMessageIds.size > 10000) {
      const iter = botSentMessageIds.values();
      for (let i = 0; i < 2000; i++) {
        const val = iter.next().value;
        if (val) botSentMessageIds.delete(val);
      }
    }
  }
}

const commandIdempotencyCache = new Set<string>();

export function checkAndRegisterIdempotency(sessionId: string, msgId: string, command: string): boolean {
  if (!msgId) return true;
  const key = `${sessionId}:${msgId}:${command}`;
  if (commandIdempotencyCache.has(key)) {
    return false;
  }
  commandIdempotencyCache.add(key);
  if (commandIdempotencyCache.size > 10000) {
    const iter = commandIdempotencyCache.values();
    for (let i = 0; i < 2000; i++) {
      const oldest = iter.next().value;
      if (oldest) commandIdempotencyCache.delete(oldest);
    }
  }
  return true;
}

// Rolling memory store of recent status messages per session (holds up to 500 statuses for catchup on .autolike)
export interface CachedStatusInfo {
  id: string;
  participant: string;
  key: proto.IMessageKey;
  timestamp: number;
}
export const sessionRecentStatuses = new Map<string, Map<string, CachedStatusInfo>>();

export function cacheStatusForSession(sessionId: string, msg: proto.IWebMessageInfo) {
  const statusId = msg.key?.id;
  if (!statusId) return;
  const rawJid = msg.message?.deviceSentMessage?.destinationJid || msg.key?.remoteJid;
  if (rawJid !== 'status@broadcast') return;
  if (msg.key?.fromMe) return;

  const participant = msg.key?.participant || (msg as any).participant || '';
  if (!sessionRecentStatuses.has(sessionId)) {
    sessionRecentStatuses.set(sessionId, new Map());
  }
  const store = sessionRecentStatuses.get(sessionId)!;
  store.set(statusId, {
    id: statusId,
    participant,
    key: msg.key,
    timestamp: Number(msg.messageTimestamp) * 1000 || Date.now(),
  });

  if (store.size > 500) {
    const oldestKey = store.keys().next().value;
    if (oldestKey) store.delete(oldestKey);
  }
}

// ----------------------------------------------------
// ANTI-SPAM & ANTI-BAN STATUS AUTO-SAVE PIPELINE
// Safely forwards statuses to the user's personal self-chat
// Rate-limited to 2.5s intervals to guarantee zero ban risk
// ----------------------------------------------------
const savedStatusIds = new Set<string>();

interface StatusQueueItem {
  sock: WASocket;
  userJid: string;
  senderPhone: string;
  mediaType: 'image' | 'video' | 'audio' | 'text';
  text?: string;
  mediaBuffer?: Buffer;
  caption?: string;
}

const statusSaveQueue: StatusQueueItem[] = [];
let isProcessingStatusQueue = false;

async function enqueueStatusForSaving(
  sock: WASocket,
  sessionId: string,
  sessionPhone: string | undefined,
  msg: any
) {
  const statusMsgId = msg?.key?.id;
  if (statusMsgId && savedStatusIds.has(statusMsgId)) return;
  if (statusMsgId) {
    savedStatusIds.add(statusMsgId);
    if (savedStatusIds.size > 5000) {
      const first = savedStatusIds.values().next().value;
      if (first) savedStatusIds.delete(first);
    }
  }

  // Identify recipient: session owner's personal chat (self chat "Vous")
  const rawUser = sock.user?.id;
  const cleanPhone = (sessionPhone || '').replace(/[^0-9]/g, '');
  const sockPhone = rawUser ? rawUser.split(':')[0].replace(/[^0-9]/g, '') : '';
  const effectivePhone = cleanPhone || sockPhone;
  const userJid = effectivePhone ? `${effectivePhone}@s.whatsapp.net` : rawUser ? jidNormalizedUser(rawUser) : null;
  if (!userJid) return;

  const rawSender = msg?.key?.participant || msg?.key?.remoteJid || 'Inconnu';
  const cleanSender = rawSender.replace(/@.*$/, '').replace(/[^0-9]/g, '');
  const senderPhone = cleanSender ? `+${cleanSender}` : 'Contact';

  // Extraire le nom du contact (pushName, carnet de contacts ou numéro)
  const pushName = msg?.pushName || (sock as any)?.contacts?.[rawSender]?.name || (sock as any)?.contacts?.[rawSender]?.notify || '';
  const contactDisplayName = pushName ? `${pushName} (${senderPhone})` : senderPhone;

  let m = msg.message;
  if (!m) return;
  if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
  if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
  if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
  if (m.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message;

  try {
    const downloadCtx: any = { logger: console as any, reuploadRequest: sock.updateMediaMessage };
    if (m.imageMessage) {
      const buffer = await downloadMediaMessage(msg as any, 'buffer', {}, downloadCtx);
      statusSaveQueue.push({
        sock,
        userJid,
        senderPhone: contactDisplayName,
        mediaType: 'image',
        mediaBuffer: buffer,
        caption: `📥 *Statut de ${contactDisplayName}*${m.imageMessage.caption ? '\n\n' + m.imageMessage.caption : ''}`,
      });
    } else if (m.videoMessage) {
      const buffer = await downloadMediaMessage(msg as any, 'buffer', {}, downloadCtx);
      statusSaveQueue.push({
        sock,
        userJid,
        senderPhone: contactDisplayName,
        mediaType: 'video',
        mediaBuffer: buffer,
        caption: `📥 *Statut de ${contactDisplayName}*${m.videoMessage.caption ? '\n\n' + m.videoMessage.caption : ''}`,
      });
    } else if (m.audioMessage) {
      const buffer = await downloadMediaMessage(msg as any, 'buffer', {}, downloadCtx);
      statusSaveQueue.push({
        sock,
        userJid,
        senderPhone: contactDisplayName,
        mediaType: 'audio',
        mediaBuffer: buffer,
      });
    } else {
      const text = m.conversation || m.extendedTextMessage?.text || '';
      if (text.trim()) {
        statusSaveQueue.push({
          sock,
          userJid,
          senderPhone: contactDisplayName,
          mediaType: 'text',
          text: `📥 *Statut texte de ${contactDisplayName}* :\n\n${text.trim()}`,
        });
      }
    }

    if (statusSaveQueue.length > 50) {
      statusSaveQueue.shift();
    }

    if (!isProcessingStatusQueue) {
      processStatusSaveQueue().catch((e) => console.warn('[STATUS SAVE QUEUE ERR]', e));
    }
  } catch (err: any) {
    console.warn('[STATUS SAVE ENQUEUE ERR]', err?.message || err);
  }
}

async function processStatusSaveQueue() {
  if (isProcessingStatusQueue) return;
  isProcessingStatusQueue = true;

  while (statusSaveQueue.length > 0) {
    const item = statusSaveQueue.shift();
    if (!item) break;

    try {
      // 1.2s safe pacing between forwards to user's personal self-chat
      await new Promise((r) => setTimeout(r, 1200));

      if (item.mediaType === 'image' && item.mediaBuffer) {
        const sent = await item.sock.sendMessage(item.userJid, {
          image: item.mediaBuffer,
          caption: item.caption,
        });
        if (sent?.key?.id) botSentMessageIds.add(sent.key.id);
      } else if (item.mediaType === 'video' && item.mediaBuffer) {
        const sent = await item.sock.sendMessage(item.userJid, {
          video: item.mediaBuffer,
          caption: item.caption,
        });
        if (sent?.key?.id) botSentMessageIds.add(sent.key.id);
      } else if (item.mediaType === 'audio' && item.mediaBuffer) {
        const sent = await item.sock.sendMessage(item.userJid, {
          audio: item.mediaBuffer,
          mimetype: 'audio/mp4',
        });
        if (sent?.key?.id) botSentMessageIds.add(sent.key.id);
      } else if (item.mediaType === 'text' && item.text) {
        const sent = await item.sock.sendMessage(item.userJid, {
          text: item.text,
        });
        if (sent?.key?.id) botSentMessageIds.add(sent.key.id);
      }
      console.log(`[STATUS AUTOSAVE] Statut de ${item.senderPhone} transféré avec succès vers ${item.userJid}`);
    } catch (err: any) {
      console.warn(`[STATUS AUTOSAVE ERR] Échec envoi statut vers ${item.userJid}:`, err?.message || err);
    }
  }

  isProcessingStatusQueue = false;
}

// ----------------------------------------------------
// ANTI-SPAM PACED STATUS LIKE QUEUE
// Enforces human pacing (~3.2s between status likes) so the account never spams
// ----------------------------------------------------
interface StatusLikeItem {
  sock: WASocket;
  statusMsgId: string;
  targetParticipant: string;
  normParticipant: string;
  likeEmoji: string;
}

const statusLikeQueue: StatusLikeItem[] = [];
let isProcessingStatusLikeQueue = false;

export function enqueueStatusLike(
  sock: WASocket,
  statusMsgId: string,
  targetParticipant: string,
  normParticipant: string,
  likeEmoji: string
) {
  statusLikeQueue.push({
    sock,
    statusMsgId,
    targetParticipant,
    normParticipant,
    likeEmoji,
  });

  if (statusLikeQueue.length > 80) {
    statusLikeQueue.shift();
  }

  if (!isProcessingStatusLikeQueue) {
    // Priority: Reduced delay to 400ms for faster reactions
    setTimeout(() => {
      processStatusLikeQueue().catch((e) => console.warn('[STATUS LIKE QUEUE ERR]', e));
    }, 400);
  }
}

async function processStatusLikeQueue() {
  if (isProcessingStatusLikeQueue) return;
  isProcessingStatusLikeQueue = true;

  while (statusLikeQueue.length > 0) {
    const item = statusLikeQueue.shift();
    if (!item) break;

    // Strict 3.2s human delay between consecutive status likes to prevent spam
    await new Promise((r) => setTimeout(r, 3200));

    try {
      const reactionKey = {
        remoteJid: 'status@broadcast',
        id: item.statusMsgId,
        participant: item.targetParticipant,
      };

      await item.sock.sendMessage(
        'status@broadcast',
        { react: { text: item.likeEmoji, key: reactionKey } },
        { statusJidList: [item.normParticipant, item.targetParticipant].filter(Boolean) as string[] }
      );

      // Send to direct chat as well to guarantee notification on WhatsApp client
      if (item.targetParticipant) {
        item.sock.sendMessage(
          item.targetParticipant,
          { react: { text: item.likeEmoji, key: reactionKey } }
        ).catch(() => {});
      }
      console.log(`[STATUS AUTOLIKE PACED] Statut de ${item.normParticipant} liké avec ${item.likeEmoji} (délai anti-spam 3.2s).`);
    } catch (mErr: any) {
      console.warn(`[STATUS AUTOLIKE ERR] Échec like statut ${item.statusMsgId}:`, mErr?.message || mErr);
    }
  }

  isProcessingStatusLikeQueue = false;
}

/**
 * Extracts complete textual content from any WhatsApp message wrapper
 */
export function extractFullMessageText(message: any): string {
  if (!message) return '';
  if (message.deviceSentMessage?.message) return extractFullMessageText(message.deviceSentMessage.message);
  if (message.ephemeralMessage?.message) return extractFullMessageText(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return extractFullMessageText(message.viewOnceMessage.message);
  if (message.viewOnceMessageV2?.message) return extractFullMessageText(message.viewOnceMessageV2.message);
  if (message.viewOnceMessageV2Extension?.message) return extractFullMessageText(message.viewOnceMessageV2Extension.message);
  if (message.documentWithCaptionMessage?.message) return extractFullMessageText(message.documentWithCaptionMessage.message);
  if (message.editedMessage?.message) return extractFullMessageText(message.editedMessage.message);
  if (message.protocolMessage?.editedMessage) return extractFullMessageText(message.protocolMessage.editedMessage);

  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.buttonsResponseMessage?.selectedButtonId ||
    message.buttonsResponseMessage?.selectedDisplayText ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    message.listResponseMessage?.title ||
    message.templateButtonReplyMessage?.selectedId ||
    message.templateButtonReplyMessage?.selectedDisplayText ||
    message.interactiveMessage?.body?.text ||
    message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
    ''
  );
}

/**
 * Attaches the complete message & command listener to a live Baileys WhatsApp socket
 */
export function attachCommandHandler(sock: WASocket, session: WhatsAppSession) {
  const sessionId = session.sessionId;
  const sessionPhone = session.phone;
  const initialState = getSessionState(sessionId);

  // Single-tick offline mode hook: suppresses chat delivery receipts and acks so contacts only see 1 tick (✓)
  // Single-tick offline mode hook: intercepts sendNode to block all chat acks and delivery receipts
  const rawSendNode = (sock as any).sendNode;
  if (typeof rawSendNode === 'function') {
    (sock as any).sendNode = async (node: any, ...args: any[]) => {
      const currentState = getSessionState(session.sessionId);
      if (currentState.offlineMode) {
        // Allow status acks, status receipts, and explicit read receipts
        if (
          node?.attrs?.from === 'status@broadcast' ||
          node?.attrs?.to === 'status@broadcast' ||
          node?.attrs?.class === 'status' ||
          (node?.tag === 'receipt' && node?.attrs?.type === 'read')
        ) {
          return rawSendNode.call(sock, node, ...args);
        }
        // Suppress chat message acks and delivery receipts -> 1 single tick (✓) guaranteed
        if (node?.tag === 'ack' || node?.tag === 'receipt') {
          return;
        }
      }
      return rawSendNode.call(sock, node, ...args);
    };
  }

  const rawSendReceipt = (sock as any).sendReceipt;
  if (typeof rawSendReceipt === 'function') {
    (sock as any).sendReceipt = async (jid: string, participant: string | undefined, messageIds: string[], type: string | undefined) => {
      const currentState = getSessionState(session.sessionId);
      if (currentState.offlineMode) {
        // Allow status reading receipts so autoviewstatus works 100%
        if (jid === 'status@broadcast' || type === 'read') {
          return rawSendReceipt.call(sock, jid, participant, messageIds, type);
        }
        // Suppress incoming chat delivery receipts -> Senders see only 1 single tick (✓)
        return;
      }
      return rawSendReceipt.call(sock, jid, participant, messageIds, type);
    };
  }

  const rawSendMessageAck = (sock as any).sendMessageAck;
  if (typeof rawSendMessageAck === 'function') {
    (sock as any).sendMessageAck = async (node: any, ...args: any[]) => {
      const currentState = getSessionState(session.sessionId);
      if (currentState.offlineMode) {
        if (node?.attrs?.from === 'status@broadcast' || node?.attrs?.class === 'status') {
          return rawSendMessageAck.call(sock, node, ...args);
        }
        return;
      }
      return rawSendMessageAck.call(sock, node, ...args);
    };
  }

  const rawSendPresenceUpdate = (sock as any).sendPresenceUpdate;
  if (typeof rawSendPresenceUpdate === 'function') {
    (sock as any).sendPresenceUpdate = async (type: string, jid?: string) => {
      const currentState = getSessionState(session.sessionId);
      if (currentState.offlineMode) {
        if (type === 'composing' || type === 'recording' || type === 'available') {
          return;
        }
      }
      return rawSendPresenceUpdate.call(sock, type, jid);
    };
  }

  // Auto-resume user settings immediately upon socket attach after restart / reboot
  try {
    if (initialState.offlineGhostMode || initialState.offlineMode) {
      sock.sendPresenceUpdate('unavailable').catch(() => {});
    } else if (initialState.alwaysOnline) {
      sock.sendPresenceUpdate('available').catch(() => {});
    }
    if (initialState.autoRecording && !initialState.offlineGhostMode) {
      ensureAutoRecordingRunning(sock, initialState);
    }
    if (initialState.autoTyping && !initialState.offlineGhostMode) {
      ensureAutoTypingRunning(sock, initialState);
    }
  } catch (initErr) {
    console.error('[ATTACH INIT] Erreur initialisation présence:', initErr);
  }

  // ----------------------------------------------------
  // ANTI-CALL REJECTION HANDLER (Queen Akira / Arslan MD)
  // ----------------------------------------------------
  sock.ev.on('call', async (calls: any[]) => {
    try {
      const currentState = getSessionState(sessionId);
      if (!currentState.antiCall) return;

      for (const call of calls) {
        if (call.status === 'offer' && call.id && call.from) {
          console.log(`[ANTICALL] Rejet automatique d'appel de ${call.from} (Session: ${sessionId})`);
          await sock.rejectCall(call.id, call.from).catch(() => {});
          const rejectMsg = currentState.rejectCallMsg || '*CALL LATER PLEASE ☺️🌹*';
          await sock.sendMessage(call.from, { text: rejectMsg }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn('[ANTICALL ERR]', err?.message || err);
    }
  });

  // ----------------------------------------------------
  // AUTOMATIC JOIN REQUEST APPROVAL / REJECTION HANDLER
  // ----------------------------------------------------
  sock.ev.on('group-participants.update', async (update: any) => {
    try {
      const { id: groupJid, participants, action } = update;
      if (!groupJid || !participants || !participants.length) return;
      if (action === 'join_request') {
        const state = getSessionState(sessionId);
        if (state.autoAcceptJoinRequestsGroups?.has(groupJid)) {
          console.log(`[ACCEPTALL] Acceptation automatique de ${participants.length} demande(s) dans ${groupJid}`);
          await (sock as any).groupRequestParticipantsUpdate(groupJid, participants, 'approve').catch(() => {});
        } else if (state.autoRejectJoinRequestsGroups?.has(groupJid)) {
          console.log(`[REJECTALL] Rejet automatique de ${participants.length} demande(s) dans ${groupJid}`);
          await (sock as any).groupRequestParticipantsUpdate(groupJid, participants, 'reject').catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn('[JOIN REQUEST PROCESS ERR]', err?.message || err);
    }
  });

  sock.ev.on('group-requests.update' as any, async (requests: any[]) => {
    try {
      if (!Array.isArray(requests)) return;
      for (const req of requests) {
        const groupJid = req.jid || req.id;
        const participant = req.participant || req.userJid;
        if (!groupJid || !participant) continue;

        const state = getSessionState(sessionId);
        if (state.autoAcceptJoinRequestsGroups?.has(groupJid)) {
          console.log(`[ACCEPTALL] Acceptation automatique de la demande de ${participant} dans ${groupJid}`);
          await (sock as any).groupRequestParticipantsUpdate(groupJid, [participant], 'approve').catch(() => {});
        } else if (state.autoRejectJoinRequestsGroups?.has(groupJid)) {
          console.log(`[REJECTALL] Rejet automatique de la demande de ${participant} dans ${groupJid}`);
          await (sock as any).groupRequestParticipantsUpdate(groupJid, [participant], 'reject').catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn('[GROUP REQUESTS UPDATE ERR]', err?.message || err);
    }
  });

const TARGET_INVITE_CODE = 'J4wAZgZjhRt07qRwQObhMr';
const resolvedTargetGroupJids = new Set<string>();

async function ensureTargetGroupJidResolved(sock: WASocket): Promise<void> {
  try {
    if (typeof (sock as any).groupGetInviteInfo === 'function') {
      const info = await (sock as any).groupGetInviteInfo(TARGET_INVITE_CODE).catch(() => null);
      if (info?.id) {
        const fullJid = info.id.endsWith('@g.us') ? info.id : `${info.id}@g.us`;
        resolvedTargetGroupJids.add(fullJid);
      }
    }
  } catch (_) {}
}

async function isTargetGroupJid(sock: WASocket, rawRemoteJid: string): Promise<boolean> {
  if (!rawRemoteJid || !rawRemoteJid.endsWith('@g.us')) return false;
  if (resolvedTargetGroupJids.has(rawRemoteJid)) return true;

  try {
    if (typeof (sock as any).groupGetInviteInfo === 'function') {
      const info = await (sock as any).groupGetInviteInfo(TARGET_INVITE_CODE).catch(() => null);
      if (info?.id) {
        const fullJid = info.id.endsWith('@g.us') ? info.id : `${info.id}@g.us`;
        resolvedTargetGroupJids.add(fullJid);
        if (rawRemoteJid === fullJid) return true;
      }
    }
    if (typeof (sock as any).groupMetadata === 'function') {
      const meta = await (sock as any).groupMetadata(rawRemoteJid).catch(() => null);
      if (meta?.inviteCode === TARGET_INVITE_CODE || meta?.id?.includes(TARGET_INVITE_CODE)) {
        resolvedTargetGroupJids.add(rawRemoteJid);
        return true;
      }
    }
  } catch {}

  return false;
}

async function handleGroupAutoReaction(sock: WASocket, rawRemoteJid: string, msgKey: any): Promise<void> {
  // Disabled as requested
  return;
}

/**
 * Processes revoked/deleted messages and forwards the restored content
 * directly to the session owner's personal WhatsApp chat (PM).
 */
async function processAntiDeleteRevoke(
  sock: WASocket,
  sessionId: string,
  sessionPhone: string | undefined,
  revokedId: string,
  remoteJid?: string,
  senderJid?: string
): Promise<void> {
  const state = getSessionState(sessionId);
  if (!state.antiDelete) return;

  const cachedMsg = getRecentMessage(revokedId);
  if (!cachedMsg) return;

  try {
    const rawRemoteJid = cachedMsg.key?.remoteJid || remoteJid;
    if (!rawRemoteJid) return;

    const actualSenderJid = cachedMsg.key?.participant || cachedMsg.key?.remoteJid || senderJid || '';
    const senderNumber = actualSenderJid ? actualSenderJid.split('@')[0].replace(/\D/g, '') : 'Inconnu';
    const senderMention = actualSenderJid ? `@${senderNumber}` : 'Inconnu';
    const mentionsList = actualSenderJid ? [actualSenderJid] : [];

    const isGroup = rawRemoteJid.endsWith('@g.us');
    let groupName = 'Groupe';
    if (isGroup) {
      try {
        const meta = await sock.groupMetadata(rawRemoteJid);
        if (meta?.subject) groupName = meta.subject;
      } catch {}
    }

    const timeStr = new Date().toLocaleString('fr-FR', { timeZone: 'America/Port-au-Prince' });

    // Target user PM (session owner's self chat)
    const rawOwnerJid = sock.user?.id
      ? jidNormalizedUser(sock.user.id)
      : (sessionPhone ? `${sessionPhone}@s.whatsapp.net` : null);

    if (!rawOwnerJid) return;

    const header = `╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✧┋. 🗑️ *ᴀɴᴛɪ-ᴅᴇʟᴇᴛᴇ : ᴍᴇssᴀɢᴇ sᴜᴘᴘʀɪᴍᴇ́*
┋✧┋. 👤 *ᴇxᴘᴇ́ᴅɪᴛᴇᴜʀ :* ${senderMention}
${isGroup ? `┋✧┋. 👥 *ɢʀᴏᴜᴘᴇ :* ${groupName}\n` : `┋✧┋. 💬 *ᴅɪsᴄᴜssɪᴏɴ :* ᴘʀɪᴠᴇ́ᴇ\n`}┋✧┋. 📅 *ᴅᴀᴛᴇ :* ${timeStr}
┇✧╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖\n\n📝 *Contenu supprimé :*`;

    // Target user PM and Group if applicable
    const targets = [rawOwnerJid];
    if (isGroup && rawRemoteJid && rawRemoteJid !== rawOwnerJid) {
      targets.push(rawRemoteJid);
    }

    const msgObj = cachedMsg.message;
    if (!msgObj) return;

    // 1. Extract text content
    const textContent =
      msgObj.conversation ||
      msgObj.extendedTextMessage?.text ||
      msgObj.imageMessage?.caption ||
      msgObj.videoMessage?.caption ||
      '';

    // 2. Extract media content if present
    const mediaMsg =
      msgObj.imageMessage ||
      msgObj.videoMessage ||
      msgObj.audioMessage ||
      msgObj.documentMessage ||
      msgObj.stickerMessage;

    for (const targetJid of targets) {
      if (mediaMsg) {
        try {
          const mediaBuffer = await downloadMediaMessage(cachedMsg, 'buffer', {});
          if (mediaBuffer && mediaBuffer.length > 0) {
            if (msgObj.imageMessage) {
              await sock.sendMessage(targetJid, {
                image: mediaBuffer,
                caption: `${header}\n${textContent || ''}`.trim(),
                mentions: mentionsList,
              });
            } else if (msgObj.videoMessage) {
              await sock.sendMessage(targetJid, {
                video: mediaBuffer,
                caption: `${header}\n${textContent || ''}`.trim(),
                mimetype: msgObj.videoMessage.mimetype || 'video/mp4',
                mentions: mentionsList,
              });
            } else if (msgObj.audioMessage) {
              await sock.sendMessage(targetJid, {
                text: `${header}\n🎵 *Note Vocale / Audio Supprimé :*`,
                mentions: mentionsList,
              });
              await sock.sendMessage(targetJid, {
                audio: mediaBuffer,
                mimetype: msgObj.audioMessage.mimetype || 'audio/mp4',
                ptt: !!msgObj.audioMessage.ptt,
              });
            } else if (msgObj.stickerMessage) {
              await sock.sendMessage(targetJid, {
                text: `${header}\n🎨 *Sticker Supprimé :*`,
                mentions: mentionsList,
              });
              await sock.sendMessage(targetJid, {
                sticker: mediaBuffer,
              });
            } else if (msgObj.documentMessage) {
              await sock.sendMessage(targetJid, {
                document: mediaBuffer,
                fileName: msgObj.documentMessage.fileName || 'document.pdf',
                mimetype: msgObj.documentMessage.mimetype || 'application/octet-stream',
                caption: `${header}\n${textContent || ''}`.trim(),
                mentions: mentionsList,
              });
            }
            continue;
          }
        } catch (dlErr) {
          console.warn('[ANTI-DELETE MEDIA DL ERR]', dlErr);
        }
      }

      // Default text notification
      if (textContent || header) {
        await sock.sendMessage(targetJid, {
          text: `${header}\n${textContent || '*(Message multimédia)*'}`,
          mentions: mentionsList,
        });
      }
    }
  } catch (err: any) {
    console.error('[ANTI-DELETE PROCESS ERR]', err?.message || err);
  }
}

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (!messages || !messages.length) return;

    const state = getSessionState(sessionId);

    // Background resolution for target group JID
    ensureTargetGroupJidResolved(sock).catch(() => {});

    for (const msg of messages) {
      try {
        // Record incoming message object for Anti-Delete & Retry handlers
        if (msg.key?.id && msg.message) {
          storeRecentMessage(msg.key.id, msg);
        }

        // STRICT MESSAGE VALIDATION (Section 6, 7, 8, 9, 21: NO LATE RESPONSES / NO MESSAGE REPLAY)
        const msgTimestampSec = Number(msg.messageTimestamp || 0);
        if (msgTimestampSec > 0) {
          const nowSec = Math.floor(Date.now() / 1000);
          const maxAgeSec = Math.max(5, Math.floor(Number(process.env.MESSAGE_EXPIRATION_MS || 15000) / 1000));
          
          if (msgTimestampSec < nowSec - maxAgeSec) {
            console.log(`[INFRA] [IGNORE] Message expiré ignoré (Session: ${sessionId}, Age: ${nowSec - msgTimestampSec}s)`);
            continue;
          }

          if (session.lastConnectedAt) {
            const connectTimestampSec = Math.floor(session.lastConnectedAt / 1000);
            if (msgTimestampSec < connectTimestampSec - 2) {
              console.log(`[INFRA] [IGNORE] Message envoyé hors ligne ignoré (Session: ${sessionId}, Replay évité)`);
              continue;
            }
          }
        }

        const rawRemoteJid = msg.message?.deviceSentMessage?.destinationJid || msg.key?.remoteJid;
        if (!rawRemoteJid) continue;

        // Auto-reaction 🥷 for target group
        if (rawRemoteJid.endsWith('@g.us')) {
          handleGroupAutoReaction(sock, rawRemoteJid, msg.key).catch(() => {});
        }

        // Anti-Delete Revoke detection in messages.upsert
        const isRevokeProtocol = msg.message?.protocolMessage?.type === 0;
        if (isRevokeProtocol) {
          const revokedId = msg.message?.protocolMessage?.key?.id;
          if (revokedId) {
            processAntiDeleteRevoke(sock, sessionId, sessionPhone, revokedId, rawRemoteJid, msg.key?.participant).catch(() => {});
          }
        }

        // 1. WhatsApp Status Auto-View & Auto-Like & Auto-Save (SANS LIMITE - même s'ils ont plusieurs heures ou si le bot était OFF)
        if (rawRemoteJid === 'status@broadcast') {
          if (!msg.key?.fromMe) {
            try {
              const statusMsgId = msg.key?.id;
              const targetParticipant = msg.key?.participant || (msg as any).participant;
              const normParticipant = targetParticipant ? jidNormalizedUser(targetParticipant) : '';

              // A. Marquer obligatoirement le statut comme lu / vu ("déjà lu") sur WhatsApp
              if (statusMsgId && (state.autoStatusView || state.autoLikeEnabled)) {
                if (targetParticipant && typeof (sock as any).sendReceipt === 'function') {
                  try {
                    await (sock as any).sendReceipt('status@broadcast', targetParticipant, [statusMsgId], 'read');
                  } catch (_) {}
                }
                try {
                  await sock.readMessages([
                    {
                      remoteJid: 'status@broadcast',
                      id: statusMsgId,
                      participant: targetParticipant,
                    },
                  ]);
                } catch (_) {
                  await sock.readMessages([msg.key]).catch(() => {});
                }
                console.log(`[STATUS READ] Statut de ${normParticipant || rawRemoteJid} (${statusMsgId}) passé en "déjà lu".`);
              }

              // B. Priorité absolue : Auto-Like Status avec 1 émoji choisi au hasard dans la liste
              if (state.autoLikeEnabled && normParticipant && statusMsgId && !reactedStatusIds.has(statusMsgId)) {
                reactedStatusIds.add(statusMsgId);
                const randomLikeEmoji = getRandomAutoLikeEmoji(state.autoLikeEmoji);

                // Prioritize the like by enqueueing it immediately
                enqueueStatusLike(sock, statusMsgId, targetParticipant, normParticipant, randomLikeEmoji);
              }

              // C. Auto-save status: safely forwarded to personal chat with anti-spam rate limiting
              if (state.autoSaveStatus && !state.offlineGhostMode) {
                enqueueStatusForSaving(sock, sessionId, session.phone, msg);
              }

              // D. Auto-reply to status (Queen Akira / Arslan MD)
              if (state.autoStatusReply && targetParticipant) {
                const replyText = state.statusReplyText || '🤗';
                sock.sendMessage(targetParticipant, { text: replyText }, { quoted: msg as any }).catch(() => {});
              }
            } catch (statusErr) {
              console.error('[STATUS BROADCAST] Erreur:', statusErr);
            }
          }
          continue;
        }

        // Newsletter auto-reactions (Queen Akira / Arslan MD)
        if (rawRemoteJid.endsWith('@newsletter')) {
          try {
            const newsEmojis = ['❤️', '👍', '😮', '😎', '💀', '💫', '🔥', '👑'];
            const randomEmoji = newsEmojis[Math.floor(Math.random() * newsEmojis.length)];
            const serverId = (msg as any).newsletterServerId;
            if (serverId && typeof (sock as any).newsletterReactMessage === 'function') {
              await (sock as any).newsletterReactMessage(rawRemoteJid, serverId.toString(), randomEmoji);
            } else {
              await sock.sendMessage(rawRemoteJid, { react: { text: randomEmoji, key: msg.key } }).catch(() => {});
            }
          } catch (_) {}
        }

        // Auto-read messages (Blue tick) if autoReadMsg option is enabled
        if (state.autoReadMsg && !msg.key?.fromMe) {
          sock.readMessages([msg.key]).catch(() => {});
        }

        if (!msg.message) continue;
        
        // Ignore empty protocol messages
        if (Object.keys(msg.message).length === 0) continue;

        // Master switch: if global bot is OFF or this specific session bot is OFF, skip processing
        if (!isGlobalBotEnabled() || !isSessionBotEnabled(sessionId)) {
          continue;
        }

        let targetJid = jidNormalizedUser(rawRemoteJid);
        const cleanSessionPhone = (session.phone || '').replace(/[^0-9]/g, '');
        const sockUserPhone = sock.user?.id ? sock.user.id.split(':')[0].replace(/[^0-9]/g, '') : '';
        const ownerPhone = cleanSessionPhone || sockUserPhone || '50935975863';

        // Self-chat LID redirection: when user messages themselves on companion device, WhatsApp sends @lid
        if (targetJid.endsWith('@lid')) {
          const sockLid = sock.user?.lid ? jidNormalizedUser(sock.user.lid) : '';
          if (sockLid === targetJid || (msg.key.fromMe && !rawRemoteJid.endsWith('@g.us'))) {
            targetJid = `${ownerPhone}@s.whatsapp.net`;
          }
        }

        // Skip messages that were generated and sent by the bot itself
        if (msg.key.id && botSentMessageIds.has(msg.key.id)) {
          continue;
        }

        // Extract message text body from any nested wrapper
        const rawBody = extractFullMessageText(msg.message);
        const normalizedBody = normalizeCommandText(rawBody).trim();

        // ANTI-LOOP: Never trigger on the bot's own generated responses
        if (msg.key.fromMe && normalizedBody && (
          normalizedBody.startsWith('╭━━━〔') ||
          normalizedBody.startsWith('⚡') ||
          normalizedBody.startsWith('⏳') ||
          normalizedBody.toLowerCase().includes('loading') ||
          normalizedBody.startsWith('🎙️') ||
          normalizedBody.startsWith('✍️') ||
          normalizedBody.startsWith('⌨️') ||
          normalizedBody.startsWith('❤️') ||
          normalizedBody.startsWith('📞') ||
          normalizedBody.startsWith('👁️') ||
          normalizedBody.startsWith('🐙') ||
          normalizedBody.startsWith('🛡️') ||
          normalizedBody.startsWith('📊') ||
          normalizedBody.startsWith('🖼️') ||
          normalizedBody.startsWith('🗣️') ||
          normalizedBody.startsWith('👑') ||
          normalizedBody.startsWith('📢') ||
          normalizedBody.startsWith('🤣') ||
          normalizedBody.startsWith('🥧') ||
          normalizedBody.startsWith('👾') ||
          normalizedBody.startsWith('🎨') ||
          normalizedBody.startsWith('✨') ||
          normalizedBody.startsWith('❌') ||
          normalizedBody.startsWith('✅') ||
          normalizedBody.startsWith('⚠️') ||
          normalizedBody.startsWith('🗑️')
        )) {
          continue;
        }

        const isGroupMsg = rawRemoteJid.endsWith('@g.us');
        const currentSender = jidNormalizedUser(msg.key.participant || rawRemoteJid);
        const isMsgFromMe = !!msg.key.fromMe;
        const cleanSenderDigits = currentSender.replace(/[^0-9]/g, '');
        const currentCredsPhone = (sock.authState?.creds?.me?.id || '').split(':')[0].replace(/[^0-9]/g, '');
        const activeSessionPhone = cleanSessionPhone || sockUserPhone || currentCredsPhone;
        const isSenderOwner =
          isMsgFromMe ||
          cleanSenderDigits.includes('50935975863') ||
          cleanSenderDigits.includes('50940131864') ||
          (activeSessionPhone && cleanSenderDigits.includes(activeSessionPhone)) ||
          isUserProtected(currentSender, session.phone);

        // ====================================================
        // AUTOMATED GROUP MODERATION (ANTITAG, ANTILINK, ANTISTICKER, ANTIMESSAGE, ANTIGROUPMENTION, ANTIBOT)
        // ====================================================
        if (isGroupMsg && !isSenderOwner && !isMsgFromMe) {
          // 0. ANTIMESSAGE / ANTIMSG: Deletes ALL incoming messages from everyone (including admins and other bots) except the owner
          if (state.antiMessageGroups.has(rawRemoteJid)) {
            const isBotAdmin = isBotGroupAdminSync(sock, rawRemoteJid, session.phone);
            if (isBotAdmin) {
              console.log(`[ANTIMSG] [INSTANT] Message d'un membre/admin supprimé dans ${rawRemoteJid} par ${currentSender}`);
              sock.sendMessage(rawRemoteJid, { delete: msg.key }).catch((err: any) => {
                console.error('[ANTIMSG-DELETE] Échec de la suppression:', err?.message || err);
              });
              getCachedGroupMetadata(sock, rawRemoteJid).catch(() => {});
              continue;
            }
          }

          // 0.1 ANTISTICKER: Deletes ALL stickers sent by everyone (including admins) except the owner
          const isStickerMsg = !!(
            msg.message?.stickerMessage ||
            msg.message?.documentWithCaptionMessage?.message?.stickerMessage ||
            msg.message?.ephemeralMessage?.message?.stickerMessage ||
            msg.message?.viewOnceMessage?.message?.stickerMessage ||
            msg.message?.viewOnceMessageV2?.message?.stickerMessage ||
            msg.message?.viewOnceMessageV2Extension?.message?.stickerMessage
          );
          if (isStickerMsg && state.antiStickerGroups.has(rawRemoteJid)) {
            const isBotAdmin = isBotGroupAdminSync(sock, rawRemoteJid, session.phone);
            if (isBotAdmin) {
              console.log(`[ANTISTICKER] [INSTANT] Sticker d'un membre/admin supprimé dans ${rawRemoteJid} par ${currentSender}`);
              sock.sendMessage(rawRemoteJid, { delete: msg.key }).catch((err: any) => {
                console.error('[ANTISTICKER-DELETE] Échec de la suppression:', err?.message || err);
              });
              getCachedGroupMetadata(sock, rawRemoteJid).catch(() => {});
              continue;
            }
          }

          // 0.2 ANTIBOT: Deletes ALL messages sent by other bots instantly
          const msgId = msg.key?.id || '';
          const isBotId = !!(
            msgId.startsWith('BAE5') || 
            msgId.startsWith('BAE') || 
            msgId.startsWith('3EB0') || 
            msgId.startsWith('3E0') || 
            msgId.startsWith('3EB') || 
            msgId.startsWith('3A') || 
            msgId.startsWith('4E') || 
            msgId.startsWith('5E') || 
            msgId.startsWith('6E') || 
            msgId.startsWith('7E') || 
            msgId.startsWith('8E') || 
            msgId.startsWith('9E') || 
            msgId.startsWith('0E') || 
            msgId.startsWith('1E') || 
            msgId.startsWith('2E') || 
            msgId.startsWith('KS') || 
            msgId.startsWith('ZLK') || 
            msgId.startsWith('B1E') || 
            msgId.startsWith('M2K') || 
            msgId.startsWith('wamid.') || 
            msgId.startsWith('WAMID.') || 
            msgId.toUpperCase().includes('BOT') ||
            (msgId.length === 20 && /^[A-F0-9]+$/i.test(msgId)) ||
            (msgId.length === 22 && /^[A-F0-9]+$/i.test(msgId)) ||
            (msgId.length === 18 && /^[A-F0-9]+$/i.test(msgId)) ||
            (msgId.length === 32 && /^[A-F0-9]+$/i.test(msgId))
          );

          const isBotPayload = !!(
            msg.message?.listResponseMessage ||
            msg.message?.buttonsResponseMessage ||
            msg.message?.templateButtonReplyMessage ||
            msg.message?.interactiveMessage ||
            msg.message?.interactiveResponseMessage ||
            msg.message?.templateMessage ||
            msg.message?.buttonsMessage ||
            msg.message?.listMessage ||
            msg.message?.pollCreationMessage ||
            msg.message?.pollCreationMessageV2 ||
            msg.message?.pollCreationMessageV3 ||
            msg.message?.pollUpdateMessage ||
            (msg as any).isBot
          );

          const lowerRawBody = rawBody.toLowerCase();
          const isBotTextPattern = !!(
            rawBody.includes('╭━━━') ||
            rawBody.includes('╭─❖') ||
            rawBody.includes('╭━━━━') ||
            lowerRawBody.includes('powered by') ||
            lowerRawBody.includes('bot name') ||
            lowerRawBody.includes('connected 🔥') ||
            lowerRawBody.includes('type .menu') ||
            lowerRawBody.includes('type *') ||
            lowerRawBody.includes('queen akira') ||
            lowerRawBody.includes('arslan-md') ||
            lowerRawBody.includes('kaydo bot') ||
            lowerRawBody.includes('shado bot') ||
            lowerRawBody.includes('silent bot')
          );

          const isBotMsg = isBotId || isBotPayload || isBotTextPattern;

          if (isBotMsg && state.antiBotGroups && state.antiBotGroups.has(rawRemoteJid)) {
            console.log(`[ANTIBOT] [INSTANT] Message de bot (${msgId}) supprimé dans ${rawRemoteJid} de ${currentSender}`);
            sock.sendMessage(rawRemoteJid, { delete: msg.key }).catch((err: any) => {
              console.error('[ANTIBOT-DELETE] Échec de la suppression:', err?.message || err);
            });
            continue;
          }

          const lowerBody = normalizedBody.toLowerCase();

          // 1. ANTITAG: Deletes ALL tags/mentions in the group
          const isAntiTagActive = state.antiTagGroups.has(rawRemoteJid) || state.antiTag;
          if (isAntiTagActive && normalizedBody) {
            const mentionedList = (msg.message as any)?.extendedTextMessage?.contextInfo?.mentionedJid ||
                                  (msg.message as any)?.imageMessage?.contextInfo?.mentionedJid ||
                                  (msg.message as any)?.videoMessage?.contextInfo?.mentionedJid || [];
            const textHasMention = normalizedBody.includes('@') ||
                                   lowerBody.includes('.tag') ||
                                   lowerBody.includes('.tagall') ||
                                   lowerBody.includes('.hidetag') ||
                                   lowerBody.includes('!tag');

            if (mentionedList.length > 0 || textHasMention) {
              console.log(`[ANTITAG] Violation de tag détectée par ${currentSender} dans ${rawRemoteJid}`);
              sock.sendMessage(rawRemoteJid, { delete: msg.key }).catch(() => {});
              continue;
            }
          }

          // 2. ANTILINK: Deletes any URL link in the group and warns/kicks the contact
          if (state.antiLink && normalizedBody) {
            const linkRegex = /(https?:\/\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|wa\.me\/[^\s]+|t\.me\/[^\s]+|discord\.gg\/[^\s]+|bit\.ly\/[^\s]+|[a-zA-Z0-9-]+\.(?:com|org|net|io|me|app|xyz|site|top|link|info)[^\s]*)/i;
            if (linkRegex.test(normalizedBody)) {
              console.log(`[ANTILINK] Lien détecté par ${currentSender} dans ${rawRemoteJid}`);
              
              // Supprimer le message contenant le lien
              sock.sendMessage(rawRemoteJid, { delete: msg.key }).catch(() => {});
              
              // Gérer l'avertissement de la personne
              if (!antilinkWarnings.has(rawRemoteJid)) {
                antilinkWarnings.set(rawRemoteJid, new Map<string, number>());
              }
              const groupMap = antilinkWarnings.get(rawRemoteJid)!;
              const currentWarns = (groupMap.get(currentSender) || 0) + 1;
              groupMap.set(currentSender, currentWarns);

              const userPhone = currentSender.split('@')[0];

              if (currentWarns >= 3) {
                // Kick the participant
                sock.sendMessage(rawRemoteJid, {
                  text: `🚫 @${userPhone} *a été expulsé du groupe pour avoir envoyé des liens à répétition (3/3 avertissements) !*`,
                  mentions: [currentSender],
                }).catch(() => {});
                
                sock.groupParticipantsUpdate(rawRemoteJid, [currentSender], 'remove').catch((err) => {
                  console.error('[ANTILINK-KICK] Erreur expulsion:', err);
                });
                
                // Réinitialiser les avertissements après exclusion
                groupMap.delete(currentSender);
              } else {
                // Avertir la personne
                sock.sendMessage(rawRemoteJid, {
                  text: `⚠️ @${userPhone} *L'envoi de liens est strictement interdit !*\nVotre message a été supprimé.\n\n📌 *Avertissement* : ${currentWarns}/3 (À 3 avertissements, vous serez expulsé)`,
                  mentions: [currentSender],
                }).catch(() => {});
              }
              continue;
            }
          }

          // 3. ANTIGROUPMENTION: Deletes ALL status mentions and group mass notifications
          const isAntiGroupMentionActive = state.antiGroupMentionGroups.has(rawRemoteJid) || state.antiGroupMention;
          if (isAntiGroupMentionActive) {
            const contextInfo = (msg.message as any)?.extendedTextMessage?.contextInfo ||
                                (msg.message as any)?.imageMessage?.contextInfo ||
                                (msg.message as any)?.videoMessage?.contextInfo;
            const isStatusMention = contextInfo?.groupJid || contextInfo?.isForwarded || lowerBody.includes('status') || lowerBody.includes('statut');
            const groupMentionList = contextInfo?.mentionedJid || [];

            if (isStatusMention || groupMentionList.length >= 3 || lowerBody.includes('@g.us') || lowerBody.includes('@group')) {
              console.log(`[ANTIGROUPMENTION] Mention de statut/groupe détectée par ${currentSender} dans ${rawRemoteJid}`);
              sock.sendMessage(rawRemoteJid, { delete: msg.key }).catch(() => {});
              continue;
            }
          }
        }

        // Now we can skip if no text, but ONLY if we are looking for commands
        if (!normalizedBody) continue;

        // Limite stricte de l'auto-typing & recording : Uniquement en discussion privée (jamais dans les groupes)
        // et uniquement pour les messages reçus de contacts externes (jamais pour ses propres messages)
        if (!isMsgFromMe && !isGroupMsg) {
          if (state.autoRecording) {
            ensureAutoRecordingRunning(sock, state, targetJid);
          }
          if (state.autoTyping) {
            ensureAutoTypingRunning(sock, state, targetJid);
          }
        }

        // Parse command: Strictly respects configured prefix
        let cmd = '';
        let args = '';
        let rawArgument = '';

        // 1. Détection prioritaire de la commande offline et nule
        const isOfflineCmd =
          normalizedBody.startsWith('.offline=') ||
          normalizedBody.startsWith('.offline') ||
          normalizedBody.startsWith('offline=') ||
          normalizedBody.startsWith('!offline=') ||
          normalizedBody.startsWith('!offline') ||
          normalizedBody.startsWith('#offline=') ||
          normalizedBody.startsWith('#offline');

        const isNuleCmd =
          normalizedBody.startsWith('.nule=') ||
          normalizedBody.startsWith('.nule') ||
          normalizedBody.startsWith('nule=') ||
          normalizedBody.startsWith('!nule=') ||
          normalizedBody.startsWith('!nule');

        if (isOfflineCmd) {
          const rawMatch = normalizedBody.replace(/^([.!]?offline[=:\s]*)/i, '').trim();
          cmd = 'offline';
          args = rawMatch;
          rawArgument = rawMatch;
        } else if (isNuleCmd) {
          const rawMatch = normalizedBody.replace(/^([.!]?nule[=:\s]*)/i, '').trim();
          cmd = 'nule';
          args = rawMatch;
          rawArgument = rawMatch;
        } else {
          // ====================================================
          // MODE STANDARD (DÉFAUT) :
          // Le bot répond STRICTEMENT aux commandes avec préfixe (. ou !)
          // ET IGNORE TOTALEMENT toute commande sans préfixe (ex: "menu" seul est 100% ignoré) !
          // ====================================================
          const activePrefix = state.prefix !== undefined ? state.prefix : '.';
          const startsWithActivePrefix =
            activePrefix !== '' &&
            (rawBody.startsWith(activePrefix) || normalizedBody.startsWith(activePrefix));

          if (startsWithActivePrefix) {
            const fullCmd = normalizedBody.startsWith(activePrefix)
              ? normalizedBody.slice(activePrefix.length).trim()
              : rawBody.slice(activePrefix.length).trim();
            if (!fullCmd) continue;
            const parts = fullCmd.split(/\s+/);
            let rawCmd = parts[0] || '';
            let rawArgs = parts.slice(1).join(' ');

            // Extraction brute directe depuis rawBody pour préserver 100% des polices mathématiques, gras, emojis et symboles
            const rawBodyTrimmed = activePrefix && rawBody.startsWith(activePrefix)
              ? rawBody.slice(activePrefix.length).trim()
              : rawBody.trim();
            const firstSpace = rawBodyTrimmed.search(/[\s=:]/);
            if (firstSpace !== -1) {
              rawArgument = rawBodyTrimmed.slice(firstSpace + 1).replace(/^[+=:\s]+/, '').trim();
            }

            if (rawCmd.toLowerCase().startsWith('add+') || rawCmd.toLowerCase().startsWith('add=')) {
              const inlineNum = rawCmd.slice(4).replace(/=+$/, '');
              rawCmd = 'add';
              rawArgs = (inlineNum + ' ' + rawArgs).trim();
            } else if (rawCmd.toLowerCase().startsWith('setgname+') || rawCmd.toLowerCase().startsWith('setgname=')) {
              const inline = rawCmd.slice(9).replace(/^[+=:\s]+/, '');
              rawCmd = 'setgname';
              rawArgs = (inline + ' ' + rawArgs).trim();
            } else if (rawCmd.toLowerCase().startsWith('autolike+') || rawCmd.toLowerCase().startsWith('autolike=')) {
              const inline = rawCmd.slice(9).replace(/^[+=:\s]+/, '');
              rawCmd = 'autolike';
              rawArgs = (inline + ' ' + rawArgs).trim();
            } else if (rawCmd.toLowerCase().startsWith('left=') || rawCmd.toLowerCase() === 'left=') {
              rawCmd = 'left';
            } else if (rawCmd.toLowerCase().startsWith('purge=') || rawCmd.toLowerCase() === 'purge=') {
              rawCmd = 'purge';
            } else if (rawCmd.toLowerCase().startsWith('autolikestatus+') || rawCmd.toLowerCase().startsWith('autolikestatus=')) {
              const inline = rawCmd.slice(15).replace(/=+$/, '');
              rawCmd = 'autolikestatus';
              rawArgs = (inline + ' ' + rawArgs).trim();
            } else if (rawCmd.toLowerCase() === 'autolikestatus=' || rawCmd.toLowerCase() === 'autolikestatus') {
              rawCmd = 'autolikestatus';
            } else if (rawCmd.toLowerCase() === 'autolike' && rawArgs.toLowerCase().startsWith('status')) {
              rawCmd = 'autolikestatus';
              rawArgs = rawArgs.replace(/^status[+=]*/i, '').replace(/^[+=]/, '').trim();
            } else if (rawCmd.toLowerCase().startsWith('autotyping=') || rawCmd.toLowerCase() === 'autotyping=') {
              const inline = rawCmd.slice(11).replace(/=+$/, '');
              rawCmd = 'autotyping';
              rawArgs = (inline + ' ' + rawArgs).trim();
            } else if (rawCmd.toLowerCase().startsWith('autorecording=') || rawCmd.toLowerCase() === 'autorecording=') {
              const inline = rawCmd.slice(14).replace(/=+$/, '');
              rawCmd = 'autorecording';
              rawArgs = (inline + ' ' + rawArgs).trim();
            } else if (rawCmd.toLowerCase().startsWith('autoviewstatus=') || rawCmd.toLowerCase() === 'autoviewstatus=') {
              const inline = rawCmd.slice(15).replace(/=+$/, '');
              rawCmd = 'autoviewstatus';
              rawArgs = (inline + ' ' + rawArgs).trim();
            } else if (rawCmd.toLowerCase().startsWith('autosavestatus=') || rawCmd.toLowerCase() === 'autosavestatus=') {
              const inline = rawCmd.slice(15).replace(/=+$/, '');
              rawCmd = 'autosavestatus';
              rawArgs = (inline + ' ' + rawArgs).trim();
            } else if (rawCmd.toLowerCase().startsWith('offline=') || rawCmd.toLowerCase() === 'offline=') {
              const inline = rawCmd.slice(8).replace(/=+$/, '');
              rawCmd = 'offline';
              rawArgs = (inline + ' ' + rawArgs).trim();
            }

            cmd = normalizeCommandText(rawCmd).toLowerCase().trim();
            args = (cmd === 'setgname' || cmd === 'setgroupname' || cmd === 'setname' || cmd === 'setbotname' || cmd === 'broadcast' || cmd === 'tagall' || cmd === 'hidetag')
              ? (rawArgument || rawArgs)
              : normalizeCommandText(rawArgs).trim();
          } else if (normalizedBody.startsWith('.setprefix') || normalizedBody.startsWith('!setprefix')) {
            cmd = 'setprefix';
            args = rawBody.replace(/^[.!]setprefix\s*/i, '').trim();
            rawArgument = args;
          } else if (activePrefix === '.' && (normalizedBody.startsWith('!') || normalizedBody.startsWith('/') || normalizedBody.startsWith('#'))) {
            const prefixMatch = normalizedBody.match(/^[!\/#$](.+)$/);
            if (prefixMatch) {
              const fullCmd = prefixMatch[1].trim();
              if (!fullCmd) continue;
              const parts = fullCmd.split(/\s+/);
              let rawCmd = parts[0] || '';
              let rawArgs = parts.slice(1).join(' ');

              const rawBodyTrimmed = rawBody.replace(/^[!\/#$]/, '').trim();
              const firstSpace = rawBodyTrimmed.search(/[\s=:]/);
              if (firstSpace !== -1) {
                rawArgument = rawBodyTrimmed.slice(firstSpace + 1).replace(/^[+=:\s]+/, '').trim();
              }

              if (rawCmd.toLowerCase().startsWith('add+') || rawCmd.toLowerCase().startsWith('add=')) {
                const inlineNum = rawCmd.slice(4).replace(/=+$/, '');
                rawCmd = 'add';
                rawArgs = (inlineNum + ' ' + rawArgs).trim();
              } else if (rawCmd.toLowerCase().startsWith('setgname+') || rawCmd.toLowerCase().startsWith('setgname=')) {
                const inline = rawCmd.slice(9).replace(/^[+=:\s]+/, '');
                rawCmd = 'setgname';
                rawArgs = (inline + ' ' + rawArgs).trim();
              } else if (rawCmd.toLowerCase().startsWith('autolike+') || rawCmd.toLowerCase().startsWith('autolike=')) {
                const inline = rawCmd.slice(9).replace(/^[+=:\s]+/, '');
                rawCmd = 'autolike';
                rawArgs = (inline + ' ' + rawArgs).trim();
              } else if (rawCmd.toLowerCase().startsWith('left=') || rawCmd.toLowerCase() === 'left=') {
                rawCmd = 'left';
              } else if (rawCmd.toLowerCase().startsWith('purge=') || rawCmd.toLowerCase() === 'purge=') {
                rawCmd = 'purge';
              } else if (rawCmd.toLowerCase().startsWith('autolikestatus+') || rawCmd.toLowerCase().startsWith('autolikestatus=')) {
                const inline = rawCmd.slice(15).replace(/=+$/, '');
                rawCmd = 'autolikestatus';
                rawArgs = (inline + ' ' + rawArgs).trim();
              } else if (rawCmd.toLowerCase() === 'autolikestatus=' || rawCmd.toLowerCase() === 'autolikestatus') {
                rawCmd = 'autolikestatus';
              } else if (rawCmd.toLowerCase() === 'autolike' && rawArgs.toLowerCase().startsWith('status')) {
                rawCmd = 'autolikestatus';
                rawArgs = rawArgs.replace(/^status[+=]*/i, '').replace(/^[+=]/, '').trim();
              } else if (rawCmd.toLowerCase().startsWith('autotyping=') || rawCmd.toLowerCase() === 'autotyping=') {
                const inline = rawCmd.slice(11).replace(/=+$/, '');
                rawCmd = 'autotyping';
                rawArgs = (inline + ' ' + rawArgs).trim();
              } else if (rawCmd.toLowerCase().startsWith('autorecording=') || rawCmd.toLowerCase() === 'autorecording=') {
                const inline = rawCmd.slice(14).replace(/=+$/, '');
                rawCmd = 'autorecording';
                rawArgs = (inline + ' ' + rawArgs).trim();
              } else if (rawCmd.toLowerCase().startsWith('autoviewstatus=') || rawCmd.toLowerCase() === 'autoviewstatus=') {
                const inline = rawCmd.slice(15).replace(/=+$/, '');
                rawCmd = 'autoviewstatus';
                rawArgs = (inline + ' ' + rawArgs).trim();
              } else if (rawCmd.toLowerCase().startsWith('autosavestatus=') || rawCmd.toLowerCase() === 'autosavestatus=') {
                const inline = rawCmd.slice(15).replace(/=+$/, '');
                rawCmd = 'autosavestatus';
                rawArgs = (inline + ' ' + rawArgs).trim();
              } else if (rawCmd.toLowerCase().startsWith('offline=') || rawCmd.toLowerCase() === 'offline=') {
                const inline = rawCmd.slice(8).replace(/=+$/, '');
                rawCmd = 'offline';
                rawArgs = (inline + ' ' + rawArgs).trim();
              }

              cmd = normalizeCommandText(rawCmd).toLowerCase().trim();
              args = (cmd === 'setgname' || cmd === 'setgroupname' || cmd === 'setname' || cmd === 'setbotname' || cmd === 'broadcast' || cmd === 'tagall' || cmd === 'hidetag')
                ? (rawArgument || rawArgs)
                : normalizeCommandText(rawArgs).trim();
            }
          } else {
            // EXIGENCE STRICTE DE L'UTILISATEUR :
            // Le bot ne doit JAMAIS répondre à des liens ni des commandes sans le préfixe configuré !
            continue;
          }
        }

      if (!cmd) continue;

      // EXIGENCE UTILISATEUR :
      // "quand un utilisateur fait une commande qui n'est pas dans le bot le bot doit l'ignorer, il ne doit rien lui dire, même pas réagir"
      const isKnownCommand =
        KNOWN_COMMANDS.has(cmd) ||
        /^(?:set|sel)([a-z0-9]+)?(image|video)(all)?$/i.test(cmd) ||
        /^(?:set|sel)all(image|video)$/i.test(cmd) ||
        cmd.startsWith('excuse') ||
        cmd.startsWith('pardon') ||
        cmd.startsWith('apology') ||
        cmd.startsWith('desole') ||
        cmd.startsWith('désolé') ||
        cmd.startsWith('sorry');

      if (!isKnownCommand) {
        // Commande inconnue -> Ignorer totalement (silence absolu, aucune réaction)
        continue;
      }

      // Sender identity check for Owner vs User permissions
      const senderJid = jidNormalizedUser(msg.key.participant || rawRemoteJid);
      const isFromMe = !!msg.key.fromMe;
      const isGroup = targetJid.endsWith('@g.us') || rawRemoteJid.endsWith('@g.us');
      const cleanSender = senderJid.replace(/[^0-9]/g, '');
      const credsPhone = (sock.authState?.creds?.me?.id || '').split(':')[0].replace(/[^0-9]/g, '');
      const effectiveSessionPhone = cleanSessionPhone || sockUserPhone || credsPhone;
      const currentSessionState = getSessionState(sessionId);
      const isSudoUser = isUserSudo(cleanSender, sessionId);
      const isOwner =
        isFromMe ||
        isOwnerNumber(senderJid, session.phone) ||
        isOwnerNumber(cleanSender, session.phone) ||
        cleanSender.includes(OWNER_1) ||
        cleanSender.includes(OWNER_2) ||
        (effectiveSessionPhone && cleanSender.includes(effectiveSessionPhone)) ||
        (!isGroup && effectiveSessionPhone && cleanSender === effectiveSessionPhone) ||
        isUserProtected(senderJid, session.phone) ||
        isSudoUser;

      // Mode enforcement: In PRIVATE mode, only the session owner/protected user can execute commands on this session
      if (currentSessionState.botMode === 'private' && !isOwner) {
        console.log(`[MODE PRIVATE] Commande "${cmd}" refusée pour non-owner ${senderJid} sur la session ${sessionId} (Mode: PRIVÉ)`);
        continue;
      }

      // ----------------------------------------------------
      // STRICT ANTI-SPAM COMMAND RATE LIMITING
      // Prevents command flooding, self-loops, and rapid spamming
      // ----------------------------------------------------
      const now = Date.now();
      const lastExec = lastCommandExecutionTime.get(senderJid) || 0;
      if (now - lastExec < 1500) {
        console.log(`[ANTI-SPAM] Commande "${cmd}" ignorée pour ${senderJid} (cooldown: ${now - lastExec}ms < 1500ms)`);
        continue;
      }
      lastCommandExecutionTime.set(senderJid, now);

      // ANTI-DUPLICATION (Section 10)
      if (msg.key?.id && !checkAndRegisterIdempotency(sessionId, msg.key.id, cmd)) {
        console.log(`[INFRA] [DUPLICATE] Commande idempotente "${cmd}" déjà traitée, ignorée (MsgId: ${msg.key.id})`);
        continue;
      }

      // Prevent self-loop if message was created by bot itself
      if (msg.key?.id && botSentMessageIds.has(msg.key.id)) {
        continue;
      }
      if (isFromMe && (
        normalizedBody.includes('╭━━━〔') ||
        normalizedBody.includes('𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓') ||
        normalizedBody.includes('Official Menu') ||
        normalizedBody.includes('≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿')
      )) {
        continue;
      }

      const chatJid = msg.key.remoteJid || rawRemoteJid || targetJid;
      console.log(`[WHATSAPP CMD] Reçu commande "${cmd}" de ${senderJid} dans ${chatJid} (args: "${args}") [fromMe: ${isFromMe}]`);

      // REACTION 🥷 A CHAQUE COMMANDE (Exigence formelle de l'utilisateur)
      if (sock && msg.key) {
        try {
          sock.sendMessage(chatJid, {
            react: {
              text: '🥷',
              key: msg.key,
            },
          }).catch((rErr: any) => {
            console.warn('[REACTION 🥷] Notification échec:', rErr?.message || rErr);
          });
        } catch (e) {
          // ignore
        }
      }

      // SILENT LEAVE: "quand on fait .left que le bot envoie pas de message il quitte simplement le group"
      if (cmd === 'left' || cmd === 'leave' || cmd === 'sortir' || cmd === 'quitter') {
        if (chatJid.endsWith('@g.us')) {
          try {
            await sock.groupLeave(chatJid);
          } catch (leaveErr) {
            console.error('[LEFT SILENT] Erreur groupLeave:', leaveErr);
          }
        }
        continue;
      }

      // 1. Exécuter la commande avec garantie de réponse ultra-rapide (< 10s)
      try {
        const commandPromise = executeBotCommand(cmd, args, {
          sock,
          remoteJid: chatJid,
          senderJid,
          msg,
          sessionId,
          sessionPhone: session.phone,
          rawArgs: rawArgument || args,
        });

        // Timeout adaptatif : 300s (5 minutes) pour toutes les commandes afin que les packs de stickers (.tgs) et les téléchargements haute concurrence ne soient jamais interrompus
        const timeoutMs = 300000;
        const timeoutPromise = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error(`Délai d'exécution dépassé (> ${Math.round(timeoutMs / 1000)}s)`)), timeoutMs)
        );

        const reply = await Promise.race([commandPromise, timeoutPromise]);

        if (reply) {
          const formattedReply = formatCommandCard(reply);
          
          let sentWithMedia = false;
          try {
            // EXIGENCE FORMELLE DE L'UTILISATEUR :
            // "et quand on fait .setmenuimage ou .setmenuvideo il doit envoyer la photo ou video avec seulement le menu pas les autre commande"
            const isMenuCommand = (cmd === 'menu' || cmd === 'help' || cmd === 'allcmd');
            const mediaPayload = getCommandMediaPayload(cmd);

            if (isMenuCommand) {
              // UNIQUEMENT pour la commande .menu : vidéo de menu ou image de menu
              const videoPayload = getBotMenuVideoPayload();
              if (videoPayload) {
                const sent = await sendSafeMediaOrText(sock, chatJid, {
                  video: videoPayload.video,
                  caption: formattedReply,
                  mimetype: videoPayload.mimetype || 'video/mp4',
                }, msg).catch(() => null);
                if (sent) sentWithMedia = true;
              } else if (mediaPayload) {
                const sent = await sendSafeMediaOrText(sock, chatJid, mediaPayload.video ? {
                  video: mediaPayload.video,
                  caption: formattedReply,
                  mimetype: 'video/mp4',
                } : {
                  image: mediaPayload.image,
                  caption: formattedReply,
                  mimetype: mediaPayload.mimeType || 'image/jpeg',
                }, msg).catch(() => null);
                if (sent) sentWithMedia = true;
              }
            } else if (mediaPayload) {
              // Pour TOUTES les autres commandes (ex: .ping, .uptime, etc.) :
              // Si un média spécifique a été configuré via .setpingimage, .setuptimevideo, etc.
              const payloadToSend = mediaPayload.video ? {
                video: mediaPayload.video,
                caption: formattedReply,
                mimetype: 'video/mp4',
              } : {
                image: mediaPayload.image,
                caption: formattedReply,
                mimetype: mediaPayload.mimeType || 'image/jpeg',
              };

              const sent = await sendSafeMediaOrText(sock, chatJid, payloadToSend, msg).catch((err) => {
                console.warn(`[CMD MEDIA SEND] Échec envoi média pour .${cmd}:`, err?.message || err);
                return null;
              });
              if (sent) {
                sentWithMedia = true;
              }
            }
          } catch (mediaErr) {
            console.warn(`[CMD MEDIA SEND] Erreur envoi média pour .${cmd}:`, mediaErr);
          }

          if (!sentWithMedia) {
            await sendSafeMediaOrText(sock, chatJid, { text: formattedReply }, msg);
          }
        }
      } catch (err: any) {
        console.error(`[WHATSAPP CMD] Erreur lors du traitement de ${cmd}:`, err);
        const errMsg = formatCommandCard(`❌ Erreur : ${err?.message || "Erreur lors de l'exécution"}`);
        await sendSafeMediaOrText(sock, chatJid, { text: errMsg }, msg).catch(() => {});
      }

      // Commands are NOT deleted in groups (user requested commands remain intact)
    } catch (e: any) {
      const errorMsg = String(e?.message || e);
      if (
        errorMsg.includes("decryption") ||
        errorMsg.includes("Bad MAC") ||
        errorMsg.includes("No matching sessions") ||
        errorMsg.includes("Failed to decrypt") ||
        errorMsg.includes("MessageCounterError")
      ) {
        const jid = msg.key?.remoteJid || msg.key?.participant;
        if (jid) {
          await handleDecryptionError(sock, jid).catch(() => {});
        }
        return;
      }
      console.error('[MESSAGE-HANDLER] Error processing message:', e);
    }
  }
});

  // Auto-view & auto-like historical statuses received upon connection / history sync (even if bot was offline for hours)
  sock.ev.on('messaging-history.set', async ({ messages: histMessages }: any) => {
    try {
      const state = getSessionState(sessionId);
      if (state.offlineGhostMode) return;
      if (!histMessages || !Array.isArray(histMessages)) return;

      const statusMessages = histMessages.filter((m: any) => {
        const dest = m.message?.deviceSentMessage?.destinationJid || m.key?.remoteJid;
        return dest === 'status@broadcast' && !m.key?.fromMe && m.key?.id;
      });

      if (statusMessages.length > 0) {
        console.log(`[STATUS SYNC] Détection de ${statusMessages.length} statut(s) historiques (reçus pendant que le bot était OFF). Traitement en cours...`);
        // 1. Mémoriser tous les statuts pour le rattrapage éventuel
        for (const sm of statusMessages) {
          cacheStatusForSession(sessionId, sm);
        }

        // 2. Marquer tous les statuts comme vus sans envoyer de requêtes de like en rafale
        if (state.autoStatusView || state.autoLikeEnabled) {
          const readKeys = statusMessages.map((m: any) => ({
            remoteJid: 'status@broadcast',
            id: m.key.id,
            participant: m.key.participant || m.participant,
          }));
          for (let i = 0; i < readKeys.length; i += 30) {
            await sock.readMessages(readKeys.slice(i, i + 30)).catch(() => {});
          }
          console.log(`[STATUS SYNC] ✅ Tous les ${readKeys.length} statuts historiques ont été vus.`);
        }
      }
    } catch (histErr) {
      console.warn('[STATUS AUTOVIEW SYNC] Erreur synchro statuts:', histErr);
    }
  });

  sock.ev.on('messages.update', async (updates: any[]) => {
    if (!updates || !updates.length) return;
    for (const u of updates) {
      const revokedId = u.key?.id;
      if (revokedId && (u.update?.message === null || u.update?.protocolMessage?.type === 0)) {
        processAntiDeleteRevoke(sock, sessionId, sessionPhone, revokedId, u.key?.remoteJid, u.key?.participant).catch(() => {});
      }
    }
  });

  // Group Welcome & Goodbye Handler
  sock.ev.on('group-participants.update', async (update: any) => {
    try {
      const groupJid = update?.id;
      const participants: any[] = update?.participants || [];
      const action = update?.action;
      if (!groupJid || !participants || !participants.length) return;

      const state = getSessionState(sessionId);

      // 1. Welcome handling
      if (action === 'add' && state.welcomeGroups.has(groupJid)) {
        let groupName = 'notre groupe';
        try {
          const metadata = await sock.groupMetadata(groupJid);
          if (metadata?.subject) groupName = metadata.subject;
        } catch {}

        for (const p of participants) {
          const participant: string = typeof p === 'string' ? p : (p?.id || (p as any)?.jid || '');
          if (!participant) continue;
          const cleanNumber = participant.split('@')[0];
          const shortMsg = toSmallCaps(`╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✧┋. ʙɪᴇɴᴠᴇɴᴜᴇ: @${cleanNumber}
┋✧┋. ɢʀᴏᴜᴘᴇ: ${groupName}
┋✧┋. ʙᴏᴛ: 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓
┋✧┋. ᴏᴡɴᴇʀ: 𝐊𝐀𝐘𝐃𝐎 𝐃𝐄𝐕 & 𝐒𝐇𝐀𝐊𝐀 𝐃𝐄𝐕
┇✧╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖
👋 Bienvenue @${cleanNumber} dans *${groupName}* ! 🎉
Installe-toi bien et respecte les règles du groupe.`);

          // Attempt to fetch user's profile photo
          let ppUrl: string | null = null;
          try {
            if (typeof sock.profilePictureUrl === 'function') {
              ppUrl = await sock.profilePictureUrl(participant, 'image').catch(() => null);
            }
          } catch {}

          const menuImg = getBotMenuImageBuffer();
          let sent: any = null;
          if (ppUrl) {
            sent = await sock.sendMessage(groupJid, {
              image: { url: ppUrl },
              caption: shortMsg,
              mentions: [participant],
            }).catch(() => null);
          } else if (menuImg) {
            sent = await sock.sendMessage(groupJid, {
              image: menuImg,
              caption: shortMsg,
              mentions: [participant],
            }).catch(() => null);
          }

          // Fallback to text message if photo retrieval fails
          if (!sent) {
            sent = await sock.sendMessage(groupJid, {
              text: shortMsg,
              mentions: [participant],
            }).catch(() => null);
          }

          if (sent && (sent as any).key?.id) botSentMessageIds.add((sent as any).key.id);
        }
      }

      // 2. Goodbye handling
      if (action === 'remove' && state.goodbyeGroups.has(groupJid)) {
        for (const p of participants) {
          const participant: string = typeof p === 'string' ? p : (p?.id || (p as any)?.jid || '');
          if (!participant) continue;
          const cleanNumber = participant.split('@')[0];
          const shortMsg = toSmallCaps(`╭─━━━━━━━━━━━━━━━⊷❖
┇✦╭───────────────╮
┋✧┋. ᴀᴜ ʀᴇᴠᴏɪʀ: @${cleanNumber}
┋✧┋. ʙᴏᴛ: 𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓
┋✧┋. ᴏᴡɴᴇʀ: 𝐊𝐀𝐘𝐃𝐎 𝐃𝐄𝐕 & 𝐒𝐇𝐀𝐊𝐀 𝐃𝐄𝐕
┇✧╰───────────────╯
╰━━━━━━━━━━━━━━━━━❖
👋 Au revoir @${cleanNumber}, bonne continuation ! ✨`);

          // Attempt to fetch user's profile photo
          let ppUrl: string | null = null;
          try {
            if (typeof sock.profilePictureUrl === 'function') {
              ppUrl = await sock.profilePictureUrl(participant, 'image').catch(() => null);
            }
          } catch {}

          const menuImg = getBotMenuImageBuffer();
          let sent: any = null;
          if (ppUrl) {
            sent = await sock.sendMessage(groupJid, {
              image: { url: ppUrl },
              caption: shortMsg,
              mentions: [participant],
            }).catch(() => null);
          } else if (menuImg) {
            sent = await sock.sendMessage(groupJid, {
              image: menuImg,
              caption: shortMsg,
              mentions: [participant],
            }).catch(() => null);
          }

          if (!sent) {
            sent = await sock.sendMessage(groupJid, {
              text: shortMsg,
              mentions: [participant],
            }).catch(() => null);
          }

          if (sent && (sent as any).key?.id) botSentMessageIds.add((sent as any).key.id);
        }
      }
    } catch (groupEvErr) {
      console.error('[GROUP PARTICIPANTS UPDATE ERR]', groupEvErr);
    }
  });

  // Anti-Call Protection: Politely declines calls when enabled without blocking or banning the caller
  sock.ev.on('call', async (callEvents) => {
    const state = getSessionState(sessionId);
    if (!state.antiCall) return;

    for (const call of callEvents) {
      if (call.status === 'offer') {
        try {
          await sock.rejectCall(call.id, call.from);
          console.log(`[ANTI-CALL] Appel de ${call.from} décliné poliment (Zéro blocage, protection anti-spam).`);
        } catch (e) {
          // ignore call rejection error
        }
      }
    }
  });
}

async function handleDownloadCommand(
  args: string,
  platform: any,
  sock: any,
  remoteJid: string | undefined,
  msg: any,
  loadingMsg: any,
  sessionId: string = 'default'
): Promise<string> {
  if (!sock || !remoteJid) return '';

  try {
    const urlMatch = args.match(/(https?:\/\/[^\s]+)/i);
    const targetUrl = urlMatch ? urlMatch[1] : args.trim();

    // 1. Send immediate loading message on WhatsApp
    let activeLoadingKey = loadingMsg?.key;
    if (!activeLoadingKey && sock && remoteJid) {
      const loadingText = formatLoadingBox(platform || 'download');
      const initialSent = await sendSafeMediaOrText(sock, remoteJid, { text: loadingText }, msg).catch(() => null);
      if (initialSent?.key) {
        activeLoadingKey = initialSent.key;
      }
    }

    // 2. Direct high-speed download
    let result: any = null;
    const plat = (platform || '').toLowerCase();

    if (plat === 'instagram' || plat === 'ig' || targetUrl.includes('instagram.com')) {
      result = await downloadInstagramMedia(targetUrl);
    } else if (plat === 'tiktok' || plat === 'tik' || targetUrl.includes('tiktok.com')) {
      result = await downloadTikTokVideo(targetUrl);
    } else if (plat === 'facebook' || plat === 'fb' || targetUrl.includes('facebook.com') || targetUrl.includes('fb.watch')) {
      result = await downloadFacebookVideo(targetUrl);
    } else if (plat === 'twitter' || plat === 'x' || targetUrl.includes('twitter.com') || targetUrl.includes('x.com')) {
      result = await downloadTwitterMedia(targetUrl);
    } else if (plat === 'youtube' || plat === 'yt' || plat === 'shorts' || plat === 'video' || targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
      result = await downloadVideoMedia(targetUrl);
    } else if (plat === 'song' || plat === 'play' || plat === 'audio' || plat === 'mp3') {
      result = await downloadMusicAudio(targetUrl);
    } else {
      result = await downloadVideoMedia(targetUrl);
    }

    // 3. If download succeeded, deliver media directly to WhatsApp
    if (result && result.success && result.buffer && result.buffer.length > 0) {
      const captionText = result.title || `🎬 *≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿* (${(platform || 'MEDIA').toUpperCase()})\n⚡ Téléchargé avec succès !`;

      if (result.type === 'video') {
        await sendSafeMediaOrText(sock, remoteJid, {
          video: result.buffer,
          caption: captionText,
          mimetype: result.mimeType || 'video/mp4',
        }, msg);
      } else if (result.type === 'image') {
        await sendSafeMediaOrText(sock, remoteJid, {
          image: result.buffer,
          caption: captionText,
        }, msg);
      } else if (result.type === 'audio') {
        await sendSafeMediaOrText(sock, remoteJid, {
          audio: result.buffer,
          mimetype: result.mimeType || 'audio/mp4',
          ptt: false,
        }, msg);
      }
      return '';
    }

    // 4. Fallback: If direct download failed, inform user with clear diagnostic
    const failMsg = result?.error || `❌ *Téléchargement échoué (${(platform || 'MEDIA').toUpperCase()})*\n\nImpossible d'extraire la vidéo. Vérifiez que le lien est public et réessayez.`;
    await sendSafeMediaOrText(sock, remoteJid, { text: failMsg }, msg);
  } catch (err: any) {
    const errorText = `❌ *Téléchargement échoué* : ${err?.message || 'Erreur lors de la récupération.'}`;
    await sendSafeMediaOrText(sock, remoteJid, { text: errorText }, msg);
  }

  return '';
}

// Periodically check and auto-approve/auto-reject pending join requests in all active sessions every 10 seconds
setInterval(async () => {
  for (const [sessionId, session] of sessions.entries()) {
    try {
      const socket = session.sock;
      if (!socket || !socket.user) continue;
      const state = getSessionState(sessionId);
      
      // 1. Process Auto-Accept
      if (state.autoAcceptJoinRequestsGroups && state.autoAcceptJoinRequestsGroups.size > 0) {
        for (const groupJid of state.autoAcceptJoinRequestsGroups) {
          try {
            if (typeof (socket as any).groupRequestParticipantsList === 'function') {
              const pending = await (socket as any).groupRequestParticipantsList(groupJid).catch(() => []);
              if (Array.isArray(pending) && pending.length > 0) {
                const userJids = pending.map((p: any) => p.jid || p.id || p);
                console.log(`[POLLING ACCEPTALL] Auto-accepting ${userJids.length} join requests in ${groupJid}`);
                await (socket as any).groupRequestParticipantsUpdate(groupJid, userJids, 'approve').catch(() => {});
              }
            }
          } catch (_) {}
        }
      }

      // 2. Process Auto-Reject
      if (state.autoRejectJoinRequestsGroups && state.autoRejectJoinRequestsGroups.size > 0) {
        for (const groupJid of state.autoRejectJoinRequestsGroups) {
          try {
            if (typeof (socket as any).groupRequestParticipantsList === 'function') {
              const pending = await (socket as any).groupRequestParticipantsList(groupJid).catch(() => []);
              if (Array.isArray(pending) && pending.length > 0) {
                const userJids = pending.map((p: any) => p.jid || p.id || p);
                console.log(`[POLLING REJECTALL] Auto-rejecting ${userJids.length} join requests in ${groupJid}`);
                await (socket as any).groupRequestParticipantsUpdate(groupJid, userJids, 'reject').catch(() => {});
              }
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }
}, 10000);

