/**
 * KAYDO BOT - Opt-Out & Unsubscribe Registry
 * Manages blacklisted numbers and detects user opt-out keywords (STOP, ARRÊT, DESABONNER, UNSUBSCRIBE).
 */

import fs from 'fs';
import path from 'path';

export interface OptOutRecord {
  phone: string;
  timestamp: string;
  reason?: string;
}

const OPT_OUT_FILE = path.join(process.cwd(), 'sessions', 'unsubscribe_list.json');

let optOutMap = new Map<string, OptOutRecord>();

function loadOptOutList(): void {
  try {
    const dir = path.dirname(OPT_OUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(OPT_OUT_FILE)) {
      const data = JSON.parse(fs.readFileSync(OPT_OUT_FILE, 'utf8'));
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && item.phone) {
            const clean = String(item.phone).replace(/\D/g, '');
            if (clean) {
              optOutMap.set(clean, {
                phone: clean,
                timestamp: item.timestamp || new Date().toISOString(),
                reason: item.reason || 'User opt-out',
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[OPT-OUT] Erreur lecture liste désinscription:', err);
  }
}

function saveOptOutList(): void {
  try {
    const dir = path.dirname(OPT_OUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const list = Array.from(optOutMap.values());
    fs.writeFileSync(OPT_OUT_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.warn('[OPT-OUT] Erreur écriture liste désinscription:', err);
  }
}

// Load on init
loadOptOutList();

export function normalizePhoneKey(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

export function isOptedOut(phone: string): boolean {
  const clean = normalizePhoneKey(phone);
  if (!clean) return false;
  return optOutMap.has(clean);
}

export function addOptOut(phone: string, reason: string = 'Keyword opt-out'): void {
  const clean = normalizePhoneKey(phone);
  if (!clean) return;
  optOutMap.set(clean, {
    phone: clean,
    timestamp: new Date().toISOString(),
    reason,
  });
  saveOptOutList();
  console.log(`[OPT-OUT] 🛑 Numéro +${clean} ajouté à la liste de désinscription (${reason}). Aucun message ne lui sera envoyé.`);
}

export function removeOptOut(phone: string): boolean {
  const clean = normalizePhoneKey(phone);
  if (!clean) return false;
  const existed = optOutMap.delete(clean);
  if (existed) {
    saveOptOutList();
    console.log(`[OPT-OUT] ✅ Numéro +${clean} retiré de la liste de désinscription.`);
  }
  return existed;
}

export function getOptOutList(): OptOutRecord[] {
  return Array.from(optOutMap.values());
}

export function getOptOutCount(): number {
  return optOutMap.size;
}

const OPT_OUT_KEYWORDS = [
  'stop',
  'arret',
  'arrêt',
  'desabonner',
  'désabonner',
  'désabonnement',
  'desabonnement',
  'unsubscribe',
  'quit',
  'pause',
  'ne plus m\'ecrire',
  'ne plus m ecrire',
  'ne plus ecrire',
];

export function checkAndProcessOptOutMessage(messageText: string, senderPhone: string): boolean {
  if (!messageText || typeof messageText !== 'string') return false;
  const lower = messageText.trim().toLowerCase();
  
  const isMatch = OPT_OUT_KEYWORDS.some((kw) => lower === kw || lower.startsWith(kw + ' ') || lower.includes(' ' + kw));
  if (isMatch) {
    addOptOut(senderPhone, `Message: "${messageText.trim()}"`);
    return true;
  }
  return false;
}
