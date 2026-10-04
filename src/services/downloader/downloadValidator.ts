import { URL } from 'url';

export function validateAndSanitizeUrl(rawUrl: string): { isValid: boolean; parsedUrl?: URL; error?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, error: 'URL manquante ou invalide.' };
  }

  let cleaned = rawUrl.trim().replace(/^<|>$/g, '').trim();

  // URL Max Length check to prevent memory/CPU overload from malicious inputs
  if (cleaned.length > 2048) {
    return { isValid: false, error: 'URL trop longue (maximum 2048 caractères).' };
  }

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, error: 'Protocole URL non supporté (seuls HTTP et HTTPS sont autorisés).' };
    }

    // SSRF Protection: block private IPs, loopback, internal hosts
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.') ||
      hostname.startsWith('169.254.') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return { isValid: false, error: 'Accès interdit vers des hôtes locaux ou réseaux privés (sécurité SSRF).' };
    }

    return { isValid: true, parsedUrl: parsed };
  } catch {
    return { isValid: false, error: 'Format d\'URL malformé ou invalide.' };
  }
}
