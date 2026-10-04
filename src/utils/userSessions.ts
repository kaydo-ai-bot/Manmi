// Storage utility to isolate and track sessions connected by the current user/browser
// This ensures that visitors to the public URL ONLY see the sessions THEY connected via the site,
// while the Owner (Dev Kaydo Scofield) can see all sessions from the Owner Panel.

export interface UserSessionEntry {
  sessionId: string;
  phone: string;
  connectedAt: number;
  lastSeen?: number;
}

const STORAGE_KEY = 'kaydo_user_sessions_v1';
const OWNER_STORAGE_KEY = 'kaydo_owner_token';

/**
 * Retrieves all session IDs and metadata connected via this browser
 */
export function getMySessions(): UserSessionEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn('[USER SESSIONS] Failed to load local sessions:', err);
  }
  return [];
}

/**
 * Saves or updates a session connected by the current user
 */
export function saveMySession(sessionId: string, phone: string): void {
  if (!sessionId) return;
  try {
    const current = getMySessions();
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const existingIndex = current.findIndex((s) => s.sessionId === sessionId || (cleanPhone && s.phone === cleanPhone));

    const updated: UserSessionEntry = {
      sessionId,
      phone: cleanPhone || phone || sessionId.replace(/^session_/, ''),
      connectedAt: existingIndex >= 0 ? current[existingIndex].connectedAt : Date.now(),
      lastSeen: Date.now(),
    };

    if (existingIndex >= 0) {
      current[existingIndex] = updated;
    } else {
      current.unshift(updated);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    // Dispatch storage event so other components update immediately
    window.dispatchEvent(new Event('kaydo_sessions_updated'));
  } catch (err) {
    console.warn('[USER SESSIONS] Failed to save session:', err);
  }
}

/**
 * Removes a session from this browser's tracking list
 */
export function removeMySession(sessionId: string): void {
  try {
    const current = getMySessions();
    const filtered = current.filter((s) => s.sessionId !== sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event('kaydo_sessions_updated'));
  } catch (err) {
    console.warn('[USER SESSIONS] Failed to remove session:', err);
  }
}

/**
 * Checks if a session belongs to this browser/device
 */
export function hasMySession(sessionId: string): boolean {
  const current = getMySessions();
  return current.some((s) => s.sessionId === sessionId);
}

/**
 * Returns an array of session ID strings for quick querying
 */
export function getMySessionIds(): string[] {
  return getMySessions().map((s) => s.sessionId);
}

/**
 * Returns true if the user has authenticated as Dev Kaydo (Owner)
 */
export function isOwnerAuthenticated(): boolean {
  try {
    return Boolean(sessionStorage.getItem(OWNER_STORAGE_KEY));
  } catch {
    return false;
  }
}

/**
 * Returns the Owner token from session storage if present
 */
export function getOwnerToken(): string | null {
  try {
    return sessionStorage.getItem(OWNER_STORAGE_KEY);
  } catch {
    return null;
  }
}
