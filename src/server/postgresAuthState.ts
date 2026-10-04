import fs from 'fs';
import path from 'path';
import {
  useMultiFileAuthState,
  AuthenticationState,
  BufferJSON,
  proto,
} from '@whiskeysockets/baileys';
import {
  isPostgresAvailable,
  saveSessionToPostgres,
  saveKeysToPostgres,
  loadSessionFromPostgres,
} from './postgresStore';

export interface PostgresAuthStateResult {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  syncToPostgres: () => Promise<void>;
}

/**
 * Restores all files for a session from PostgreSQL into the local filesystem session directory.
 * If local files do not exist (e.g. after Render container restart), this recreates creds.json and all Signal key files.
 */
export async function restoreSessionFilesFromPostgres(
  sessionId: string,
  sessionDir: string
): Promise<boolean> {
  if (!isPostgresAvailable()) return false;

  try {
    const pgData = await loadSessionFromPostgres(sessionId);
    if (!pgData || !pgData.authState) return false;

    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Restore creds.json
    const credsPath = path.join(sessionDir, 'creds.json');
    fs.writeFileSync(
      credsPath,
      JSON.stringify(pgData.authState, BufferJSON.replacer, 2),
      'utf8'
    );

    // Restore all Signal keys
    for (const [keyId, keyData] of pgData.keys.entries()) {
      const fixedFileName = keyId.replace(/\//g, '__').replace(/:/g, '-');
      const keyFilePath = path.join(sessionDir, `${fixedFileName}.json`);
      fs.writeFileSync(
        keyFilePath,
        JSON.stringify(keyData, BufferJSON.replacer, 2),
        'utf8'
      );
    }

    return true;
  } catch (err: any) {
    console.error(`[PERSISTENCE] Erreur lors de la reconstruction des fichiers pour ${sessionId}:`, err.message);
    return false;
  }
}

/**
 * Initializes Baileys MultiFileAuthState with two-way synchronization to PostgreSQL.
 * Provides high-speed local filesystem & memory caching for Baileys while guaranteeing
 * full durability across Render container redeployments and restarts.
 */
export async function usePostgresAuthState(
  sessionId: string,
  sessionDir: string,
  phone?: string,
  forceFresh: boolean = false
): Promise<PostgresAuthStateResult> {
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // 1. If local creds.json does not exist or key files are missing, attempt to restore from PostgreSQL unless forceFresh is requested
  const credsPath = path.join(sessionDir, 'creds.json');
  if (!forceFresh) {
    const shouldRestore = !fs.existsSync(credsPath) || (fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length <= 2);
    if (shouldRestore) {
      await restoreSessionFilesFromPostgres(sessionId, sessionDir);
    }
  }

  // 2. Initialize Baileys file-based auth state (fast local cache)
  const { state, saveCreds: baseSaveCreds } = await useMultiFileAuthState(sessionDir);

  // Debounced key update batcher to avoid saturating PostgreSQL during heavy Noise handshakes
  let keyUpdateQueue: Array<{ keyId: string; data: any | null }> = [];
  let keyFlushTimeout: NodeJS.Timeout | null = null;

  const flushKeyQueue = async () => {
    if (keyUpdateQueue.length === 0) return;
    const batch = [...keyUpdateQueue];
    keyUpdateQueue = [];
    await saveKeysToPostgres(sessionId, batch);
  };

  const scheduleKeyFlush = () => {
    if (keyFlushTimeout) clearTimeout(keyFlushTimeout);
    keyFlushTimeout = setTimeout(() => {
      flushKeyQueue().catch((err) => {
        console.warn(`[PERSISTENCE] Erreur flush clés PostgreSQL pour ${sessionId}:`, err?.message);
      });
    }, 400);
  };

  // Intercept keys.set to replicate Signal keys to PostgreSQL
  const originalKeySet = state.keys.set;
  state.keys.set = async (data: any) => {
    // Perform standard local file write first
    await originalKeySet(data);

    // Queue updates for PostgreSQL
    if (isPostgresAvailable()) {
      for (const category in data) {
        for (const id in data[category]) {
          const value = data[category][id];
          const keyId = `${category}-${id}`;
          keyUpdateQueue.push({ keyId, data: value });
        }
      }
      scheduleKeyFlush();
    }
  };

  // Intercept saveCreds to persist to disk AND PostgreSQL simultaneously
  const saveCreds = async () => {
    await baseSaveCreds();
    if (isPostgresAvailable()) {
      const derivedPhone =
        phone ||
        state.creds?.me?.id?.split(':')[0]?.split('@')[0] ||
        sessionId.replace(/^session_/, '');

      const isRegistered = Boolean(state.creds?.registered);
      const currentStatus = isRegistered ? 'paired' : 'connecting';

      await saveSessionToPostgres(sessionId, derivedPhone, state.creds, currentStatus);
    }
  };

  const syncToPostgres = async () => {
    if (!isPostgresAvailable()) return;
    try {
      if (keyFlushTimeout) {
        clearTimeout(keyFlushTimeout);
        keyFlushTimeout = null;
      }
      await flushKeyQueue();
      await saveCreds();
    } catch (err: any) {
      console.warn(`[PERSISTENCE] Erreur sync globale pour ${sessionId}:`, err?.message);
    }
  };

  // If local creds exist but PostgreSQL does not have this session yet, perform initial sync
  if (isPostgresAvailable() && fs.existsSync(credsPath)) {
    saveCreds().catch(() => {});
  }

  return {
    state,
    saveCreds,
    syncToPostgres,
  };
}
