import fs from 'fs';
import path from 'path';

/**
 * Configuration des Propriétaires et Identité de ≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿
 * Modifiable directement via les variables d'environnement dans .env :
 * OWNER_1, OWNER_2, OWNER_NUMBERS, BOT_NAME
 */

export const OWNER_1 = (process.env.OWNER_1 || process.env.OWNER_NUMBER || '').replace(/\D/g, '');
export const OWNER_2 = (process.env.OWNER_2 || '').replace(/\D/g, '');

const envOwnerList = (process.env.OWNER_NUMBERS || '')
  .split(',')
  .map((n) => n.trim().replace(/\D/g, ''))
  .filter(Boolean);

export const OWNER_NUMBERS: string[] = Array.from(
  new Set([OWNER_1, OWNER_2, ...envOwnerList].filter((n) => n.length >= 7))
);

const BOT_NAME_FILE = path.join(process.cwd(), 'data', 'bot_name.txt');
const BOT_MODE_FILE = path.join(process.cwd(), 'data', 'bot_mode.txt');
const BOT_PREFIX_FILE = path.join(process.cwd(), 'data', 'bot_prefix.txt');

function loadPersistedBotName(): string {
  try {
    if (fs.existsSync(BOT_NAME_FILE)) {
      const name = fs.readFileSync(BOT_NAME_FILE, 'utf-8').trim();
      if (name) return name;
    }
  } catch {}
  return process.env.BOT_NAME || '🥷𝑩𝒁𝑲 𝑩𝑶𝑻 🌪️';
}

function loadPersistedBotMode(): 'public' | 'private' {
  try {
    if (fs.existsSync(BOT_MODE_FILE)) {
      const mode = fs.readFileSync(BOT_MODE_FILE, 'utf-8').trim().toLowerCase();
      if (mode === 'public' || mode === 'private') return mode;
    }
  } catch {}
  return (process.env.BOT_MODE as 'public' | 'private') || 'public';
}

function loadPersistedPrefix(): string {
  try {
    if (fs.existsSync(BOT_PREFIX_FILE)) {
      const p = fs.readFileSync(BOT_PREFIX_FILE, 'utf-8').trim();
      return p;
    }
  } catch {}
  return process.env.PREFIX !== undefined ? process.env.PREFIX : '.';
}

let activeBotName = loadPersistedBotName();
let activeBotMode: 'public' | 'private' = loadPersistedBotMode();
let activePrefix = loadPersistedPrefix();

export function getBotName(): string {
  return activeBotName;
}

export function setGlobalBotName(newName: string): void {
  const trimmed = newName.trim();
  if (!trimmed) return;
  activeBotName = trimmed;
  BOT_NAME = trimmed;
  process.env.BOT_NAME = trimmed;
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(BOT_NAME_FILE, trimmed, 'utf-8');
  } catch (err) {
    console.warn('[BOT_NAME] Error saving bot name to disk:', err);
  }
}

export function getGlobalBotMode(): 'public' | 'private' {
  return activeBotMode;
}

export function setGlobalBotMode(newMode: 'public' | 'private'): void {
  activeBotMode = newMode;
  process.env.BOT_MODE = newMode;
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(BOT_MODE_FILE, newMode, 'utf-8');
  } catch (err) {
    console.warn('[BOT_MODE] Error saving bot mode to disk:', err);
  }
}

export function getGlobalPrefix(): string {
  return activePrefix;
}

export function setGlobalPrefix(newPrefix: string): void {
  activePrefix = newPrefix;
  process.env.PREFIX = newPrefix;
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(BOT_PREFIX_FILE, newPrefix, 'utf-8');
  } catch (err) {
    console.warn('[BOT_PREFIX] Error saving prefix to disk:', err);
  }
}

export let BOT_NAME = activeBotName;

/**
 * Vérifie avec précision si un JID, numéro ou appelant est l'un des propriétaires officiels.
 * Gère les formats internationaux (+509...), les JID WhatsApp (@s.whatsapp.net, @lid, etc.),
 * les suffixes de multi-device (:0, :1, :2) et le numéro de la session connectée.
 */
export function isOwnerNumber(phoneOrJid?: string | null, sessionPhone?: string | null): boolean {
  if (!phoneOrJid) return false;

  // Extraction propre des chiffres
  const clean = phoneOrJid
    .split('@')[0]
    .split(':')[0]
    .replace(/\D/g, '');

  if (!clean) return false;

  // 1. Vérification contre les numéros Owner configurés (OWNER_1, OWNER_2, etc.)
  for (const owner of OWNER_NUMBERS) {
    if (clean === owner || clean.endsWith(owner) || owner.endsWith(clean)) {
      return true;
    }
    // Si le numéro a au moins 8 chiffres et correspond au suffixe
    if (clean.length >= 8 && owner.includes(clean)) {
      return true;
    }
  }

  // 2. Vérification contre le numéro du téléphone connecté à la session active
  if (sessionPhone) {
    const cleanSession = sessionPhone
      .split('@')[0]
      .split(':')[0]
      .replace(/\D/g, '');
    if (cleanSession && (clean === cleanSession || clean.endsWith(cleanSession) || cleanSession.endsWith(clean))) {
      return true;
    }
  }

  return false;
}
