import { URL } from 'url';

export interface TgsValidationResult {
  isValid: boolean;
  packName?: string;
  error?: string;
}

/**
 * Extracts and validates the Telegram sticker pack name from a full URL or raw pack name string.
 * Examples:
 * - "https://t.me/addstickers/kang_1573962493video_by_Sticker_kang_robot" -> "kang_1573962493video_by_Sticker_kang_robot"
 * - "t.me/addstickers/AnimPack" -> "AnimPack"
 * - "AnimPack" -> "AnimPack"
 */
export function validateTgsUrl(rawInput: string): TgsValidationResult {
  if (!rawInput || typeof rawInput !== 'string') {
    return { isValid: false, error: 'Veuillez fournir un lien ou nom de pack Telegram valide.' };
  }

  const cleaned = rawInput.trim().replace(/^<|>$/g, '').trim();
  if (!cleaned) {
    return { isValid: false, error: 'Lien ou nom de pack vide.' };
  }

  // Case 1: Direct pack name without URL scheme or domain
  if (!cleaned.includes('/') && !cleaned.includes('.')) {
    return { isValid: true, packName: cleaned };
  }

  // Case 2: Full URL or t.me path
  try {
    const urlStr = cleaned.startsWith('http://') || cleaned.startsWith('https://') ? cleaned : `https://${cleaned}`;
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname.includes('t.me') || hostname.includes('telegram.dog') || hostname.includes('telegram.me')) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === 'addstickers' && parts[1]) {
        return { isValid: true, packName: parts[1].split('?')[0].split('#')[0] };
      }
      if (parts.length > 0) {
        return { isValid: true, packName: parts[parts.length - 1].split('?')[0].split('#')[0] };
      }
    }

    return { isValid: true, packName: cleaned.split('/').pop()?.split('?')[0] || cleaned };
  } catch {
    // Fallback: extract last segment after /
    const parts = cleaned.split('/');
    const lastPart = parts[parts.length - 1].split('?')[0];
    if (lastPart) {
      return { isValid: true, packName: lastPart };
    }
    return { isValid: false, error: 'Impossible de lire le nom du pack Telegram.' };
  }
}
