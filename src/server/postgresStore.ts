import { Pool, PoolConfig } from 'pg';
import { BufferJSON } from '@whiskeysockets/baileys';

// Masked safe string for logging without exposing passwords or tokens
export function maskDatabaseUrl(url?: string): string {
  if (!url) return 'non définie';
  try {
    const parsed = new URL(url);
    const auth = parsed.username ? `${parsed.username}:***@` : '';
    return `${parsed.protocol}//${auth}${parsed.host}${parsed.pathname}`;
  } catch {
    return '[PROTECTED DATABASE URL]';
  }
}

export function maskPhone(phone?: string): string {
  if (!phone) return '****';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  const prefix = digits.slice(0, 3);
  const masked = '*'.repeat(Math.max(4, digits.length - 3));
  return `+${prefix}${masked}`;
}

let pool: Pool | null = null;
let isConnected = false;

/**
 * Returns whether PostgreSQL external storage is currently active and reachable
 */
export function isPostgresAvailable(): boolean {
  return isConnected && pool !== null;
}

/**
 * Initializes PostgreSQL connection pool with automated table migration and retry backoff
 */
export async function initPostgresStore(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    console.log('[PERSISTENCE] Aucune DATABASE_URL configurée. Utilisation du stockage local fallback.');
    isConnected = false;
    return false;
  }

  const poolConfig: PoolConfig = {
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  };

  // Enable SSL for cloud hosting providers (Render, Supabase, Neon, etc.)
  const isCloudHost =
    databaseUrl.includes('render.com') ||
    databaseUrl.includes('supabase') ||
    databaseUrl.includes('neon.tech') ||
    databaseUrl.includes('sslmode=require') ||
    process.env.NODE_ENV === 'production';

  if (isCloudHost && !databaseUrl.includes('sslmode=disable')) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    console.error('[PERSISTENCE] Erreur inattendue sur le pool PostgreSQL (mode continu actif):', err.message);
  });

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        await client.query(`
          CREATE TABLE IF NOT EXISTS whatsapp_sessions (
            session_id VARCHAR(128) PRIMARY KEY,
            phone_number VARCHAR(64),
            auth_state JSONB,
            status VARCHAR(64) DEFAULT 'connecting',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS whatsapp_session_keys (
            session_id VARCHAR(128) NOT NULL,
            key_id VARCHAR(255) NOT NULL,
            key_data JSONB NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (session_id, key_id),
            CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES whatsapp_sessions(session_id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_whatsapp_session_keys_sid ON whatsapp_session_keys(session_id);

          CREATE TABLE IF NOT EXISTS whatsapp_metadata (
            key VARCHAR(128) PRIMARY KEY,
            value JSONB NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          
          CREATE TABLE IF NOT EXISTS leader_election (
            lock_name VARCHAR(128) PRIMARY KEY,
            instance_id VARCHAR(128) NOT NULL,
            last_heartbeat TIMESTAMPTZ NOT NULL
          );
        `);
      } finally {
        client.release();
      }

      isConnected = true;
      console.log('[PERSISTENCE] Connexion au stockage externe réussie.');
      return true;
    } catch (err: any) {
      console.warn(
        `[PERSISTENCE] ⚠️ Tentative ${attempt}/${maxRetries} de connexion à PostgreSQL échouée (${err.message})...`
      );
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      }
    }
  }

  console.warn('[PERSISTENCE] ⚠️ Impossible de joindre PostgreSQL. Le bot bascule en mode local cache.');
  isConnected = false;
  return false;
}

/**
 * Persists session credentials (auth_state) into PostgreSQL
 */
export async function saveSessionToPostgres(
  sessionId: string,
  phone: string,
  authState: any,
  status: string = 'paired'
): Promise<boolean> {
  if (!isConnected || !pool) return false;

  try {
    const serializedAuth = JSON.parse(JSON.stringify(authState, BufferJSON.replacer));
    const cleanPhone = phone ? phone.replace(/\D/g, '') : sessionId.replace(/^session_/, '');

    const query = `
      INSERT INTO whatsapp_sessions (session_id, phone_number, auth_state, status, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (session_id)
      DO UPDATE SET
        phone_number = COALESCE(EXCLUDED.phone_number, whatsapp_sessions.phone_number),
        auth_state = EXCLUDED.auth_state,
        status = EXCLUDED.status,
        updated_at = NOW();
    `;

    await pool.query(query, [sessionId, cleanPhone, serializedAuth, status]);
    return true;
  } catch (err: any) {
    console.error(`[PERSISTENCE] Erreur sauvegarde session ${sessionId} dans PostgreSQL:`, err.message);
    return false;
  }
}

/**
 * Batched update or deletion of Signal keys in PostgreSQL
 */
export async function saveKeysToPostgres(
  sessionId: string,
  keyUpdates: Array<{ keyId: string; data: any | null }>
): Promise<boolean> {
  if (!isConnected || !pool || keyUpdates.length === 0) return false;

  let client: any = null;
  let hasError = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Hash session_id to a stable 32-bit integer for transaction-level advisory locking
    const lockId = Math.abs(sessionId.split('').reduce((acc, char) => {
      const hash = (acc << 5) - acc + char.charCodeAt(0);
      return hash | 0;
    }, 0));
    await client.query('SELECT pg_advisory_xact_lock($1)', [lockId]);

    const toInsertKeyIds: string[] = [];
    const toInsertKeyJsons: string[] = [];
    const toDelete: string[] = [];

    for (const update of keyUpdates) {
      if (update.data === null || update.data === undefined) {
        toDelete.push(update.keyId);
      } else {
        const serialized = JSON.parse(JSON.stringify(update.data, BufferJSON.replacer));
        toInsertKeyIds.push(update.keyId);
        toInsertKeyJsons.push(JSON.stringify(serialized));
      }
    }

    if (toDelete.length > 0) {
      await client.query(
        `DELETE FROM whatsapp_session_keys WHERE session_id = $1 AND key_id = ANY($2::text[])`,
        [sessionId, toDelete]
      );
    }

    if (toInsertKeyIds.length > 0) {
      await client.query(
        `INSERT INTO whatsapp_session_keys (session_id, key_id, key_data, updated_at)
         SELECT $1, u.k, u.d::jsonb, NOW()
         FROM UNNEST($2::text[], $3::text[]) AS u(k, d)
         ON CONFLICT (session_id, key_id)
         DO UPDATE SET key_data = EXCLUDED.key_data, updated_at = NOW()`,
        [sessionId, toInsertKeyIds, toInsertKeyJsons]
      );
    }

    await client.query('COMMIT');
    return true;
  } catch (err: any) {
    hasError = true;
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }
    console.error(`[PERSISTENCE] Erreur sauvegarde clés Signal pour ${sessionId}:`, err.message);
    return false;
  } finally {
    if (client) {
      client.release(hasError ? true : undefined);
    }
  }
}

/**
 * Loads a complete session state (credentials + Signal keys) from PostgreSQL
 */
export async function loadSessionFromPostgres(sessionId: string): Promise<{
  sessionId: string;
  phone: string;
  authState: any;
  status: string;
  keys: Map<string, any>;
} | null> {
  if (!isConnected || !pool) return null;

  try {
    const sessionRes = await pool.query(
      `SELECT session_id, phone_number, auth_state, status FROM whatsapp_sessions WHERE session_id = $1`,
      [sessionId]
    );

    if (sessionRes.rows.length === 0) return null;
    const row = sessionRes.rows[0];

    let revivedAuth: any = null;
    if (row.auth_state) {
      revivedAuth = JSON.parse(JSON.stringify(row.auth_state), BufferJSON.reviver);
    }

    const keysRes = await pool.query(
      `SELECT key_id, key_data FROM whatsapp_session_keys WHERE session_id = $1`,
      [sessionId]
    );

    const keysMap = new Map<string, any>();
    for (const kRow of keysRes.rows) {
      if (kRow.key_data) {
        const revivedKey = JSON.parse(JSON.stringify(kRow.key_data), BufferJSON.reviver);
        keysMap.set(kRow.key_id, revivedKey);
      }
    }

    return {
      sessionId: row.session_id,
      phone: row.phone_number || row.session_id.replace(/^session_/, ''),
      authState: revivedAuth,
      status: row.status || 'connecting',
      keys: keysMap,
    };
  } catch (err: any) {
    console.error(`[PERSISTENCE] Erreur chargement session ${sessionId} depuis PostgreSQL:`, err.message);
    return null;
  }
}

/**
 * Retrieves all saved WhatsApp sessions from PostgreSQL
 */
export async function loadAllSessionsFromPostgres(): Promise<
  Array<{
    sessionId: string;
    phone: string;
    authState: any;
    status: string;
    updatedAt: Date;
  }>
> {
  if (!isConnected || !pool) return [];

  try {
    const res = await pool.query(
      `SELECT session_id, phone_number, auth_state, status, updated_at
       FROM whatsapp_sessions
       ORDER BY updated_at DESC`
    );

    return res.rows.map((row) => {
      let revivedAuth: any = null;
      if (row.auth_state) {
        try {
          revivedAuth = JSON.parse(JSON.stringify(row.auth_state), BufferJSON.reviver);
        } catch {
          revivedAuth = row.auth_state;
        }
      }
      return {
        sessionId: row.session_id,
        phone: row.phone_number || row.session_id.replace(/^session_/, ''),
        authState: revivedAuth,
        status: row.status || 'connecting',
        updatedAt: row.updated_at,
      };
    });
  } catch (err: any) {
    console.error('[PERSISTENCE] Erreur récupération sessions depuis PostgreSQL:', err.message);
    return [];
  }
}

export async function purgeSessionKeysFromPostgres(sessionId: string): Promise<boolean> {
  if (!isConnected || !pool) return false;
  try {
    await pool.query(
      `DELETE FROM whatsapp_session_keys
       WHERE session_id = $1
         AND (key_id LIKE 'session-%' OR key_id LIKE 'sender-key%')`,
      [sessionId]
    );
    return true;
  } catch (err: any) {
    console.error(`[PERSISTENCE] Erreur purge clés Signal pour ${sessionId}:`, err.message);
    return false;
  }
}

/**
 * Completely removes a session and its Signal keys from PostgreSQL
 */
export async function deleteSessionFromPostgres(sessionId: string): Promise<boolean> {
  if (!isConnected || !pool) return false;

  try {
    await pool.query('DELETE FROM whatsapp_sessions WHERE session_id = $1', [sessionId]);
    return true;
  } catch (err: any) {
    console.error(`[PERSISTENCE] Erreur suppression session ${sessionId} dans PostgreSQL:`, err.message);
    return false;
  }
}

/**
 * Generic persistent metadata storage in PostgreSQL (for welcome message registry, broadcast history, etc.)
 */
export async function getMetadataFromPostgres<T>(key: string, defaultValue: T): Promise<T> {
  if (!isConnected || !pool) return defaultValue;

  try {
    const res = await pool.query('SELECT value FROM whatsapp_metadata WHERE key = $1', [key]);
    if (res.rows.length > 0 && res.rows[0].value !== undefined) {
      return res.rows[0].value as T;
    }
  } catch (err: any) {
    console.warn(`[PERSISTENCE] Erreur lecture métadonnée ${key}:`, err.message);
  }
  return defaultValue;
}

export async function setMetadataInPostgres(key: string, value: any): Promise<boolean> {
  if (!isConnected || !pool) return false;

  try {
    await pool.query(
      `INSERT INTO whatsapp_metadata (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
    return true;
  } catch (err: any) {
    console.warn(`[PERSISTENCE] Erreur écriture métadonnée ${key}:`, err.message);
    return false;
  }
}

/**
 * Saves per-session configuration settings to PostgreSQL (permanently survives server restarts/updates)
 */
export async function saveSessionSettingsToPostgres(sessionId: string, settings: any): Promise<boolean> {
  return setMetadataInPostgres(`session_settings_${sessionId}`, settings);
}

/**
 * Loads per-session configuration settings from PostgreSQL
 */
export async function loadSessionSettingsFromPostgres(sessionId: string): Promise<any | null> {
  return getMetadataFromPostgres(`session_settings_${sessionId}`, null);
}

/**
 * Loads all session configuration settings in a single batch query for ultra-fast startup restoration
 */
export async function loadAllSessionSettingsFromPostgres(): Promise<Record<string, any>> {
  if (!isConnected || !pool) return {};
  try {
    const res = await pool.query(
      `SELECT key, value FROM whatsapp_metadata WHERE key LIKE 'session_settings_%'`
    );
    const result: Record<string, any> = {};
    for (const row of res.rows) {
      const sid = row.key.replace(/^session_settings_/, '');
      result[sid] = row.value;
    }
    return result;
  } catch (err: any) {
    console.warn('[PERSISTENCE] Erreur chargement global métadonnées sessions:', err.message);
    return {};
  }
}

/**
 * Persists custom menu image (base64) to PostgreSQL so it survives container restarts & updates
 */
export async function saveSessionMenuImageToPostgres(sessionId: string, imageBase64: string): Promise<boolean> {
  return setMetadataInPostgres(`session_menu_image_${sessionId}`, imageBase64);
}

/**
 * Loads custom menu image (base64) from PostgreSQL
 */
export async function loadSessionMenuImageFromPostgres(sessionId: string): Promise<string | null> {
  return getMetadataFromPostgres(`session_menu_image_${sessionId}`, null);
}

/**
 * Gracefully closes the PostgreSQL connection pool
 */
export async function closePostgresStore(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
      isConnected = false;
      pool = null;
      console.log('[PERSISTENCE] Connexion PostgreSQL clôturée proprement.');
    } catch (err: any) {
      console.warn('[PERSISTENCE] Erreur lors de la fermeture de PostgreSQL:', err.message);
    }
  }
}

import { randomUUID } from 'crypto';
export const INSTANCE_ID = process.env.INSTANCE_ID || randomUUID();

export async function acquireOrUpdateSessionLock(sessionId: string): Promise<boolean> {
  if (!isConnected || !pool) return true; // If no PG, always assume leader locally

  try {
    const lockName = `session_lock:${sessionId}`;
    const atomicQuery = `
      INSERT INTO leader_election (lock_name, instance_id, last_heartbeat)
      VALUES ($1, $2, NOW())
      ON CONFLICT (lock_name)
      DO UPDATE SET
        instance_id = CASE
          WHEN leader_election.instance_id = $2 OR EXTRACT(EPOCH FROM (NOW() - leader_election.last_heartbeat)) > 30
          THEN $2
          ELSE leader_election.instance_id
        END,
        last_heartbeat = CASE
          WHEN leader_election.instance_id = $2 OR EXTRACT(EPOCH FROM (NOW() - leader_election.last_heartbeat)) > 30
          THEN NOW()
          ELSE leader_election.last_heartbeat
        END
      RETURNING instance_id;
    `;

    const res = await pool.query(atomicQuery, [lockName, INSTANCE_ID]);
    const leaderId = res.rows[0]?.instance_id;
    return leaderId === INSTANCE_ID;
  } catch (err: any) {
    console.warn(`[SESSION LOCK] Attention connexion DB pour ${sessionId}:`, err?.message || err);
    return true; // Fail safe to avoid freezing sessions on temporary DB hiccups
  }
}

export async function releaseSessionLock(sessionId: string): Promise<void> {
  if (!isConnected || !pool) return;
  try {
    const lockName = `session_lock:${sessionId}`;
    await pool.query(
      `DELETE FROM leader_election WHERE lock_name = $1 AND instance_id = $2`,
      [lockName, INSTANCE_ID]
    );
  } catch (err: any) {
    console.error(`[SESSION LOCK] Échec libération lock pour ${sessionId}:`, err.message);
  }
}

let lastHeartbeatSuccessTime = 0;
let cachedLeadership = true;
let inFlightLeaderPromise: Promise<boolean> | null = null;

/**
 * Leader Election mechanism to prevent multiple deployments (e.g. AI Studio vs Render) 
 * from connecting to WhatsApp at the same time and causing 440 Conflicts and Bad MAC errors.
 * 
 * Features:
 * - Atomic single-round-trip PostgreSQL query (no race conditions)
 * - In-flight deduplication (multiple simultaneous sessions share 1 check)
 * - 15-second leadership caching (eliminates connection pool exhaustion)
 * - Quiet fail-open during transient network/connection timeouts if leadership was recently held
 */
export async function acquireOrUpdateLeaderLock(): Promise<boolean> {
  if (!isConnected || !pool) return true; // If no PG, assume we are leader locally

  const now = Date.now();
  // If we verified leadership within the last 15 seconds, reuse cached status to prevent pool starvation
  if (cachedLeadership && now - lastHeartbeatSuccessTime < 15000) {
    return true;
  }

  // Deduplicate concurrent calls so only one DB query runs at a time
  if (inFlightLeaderPromise) {
    return inFlightLeaderPromise;
  }

  inFlightLeaderPromise = (async () => {
    try {
      const atomicQuery = `
        INSERT INTO leader_election (lock_name, instance_id, last_heartbeat)
        VALUES ('global_whatsapp_lock', $1, NOW())
        ON CONFLICT (lock_name)
        DO UPDATE SET
          instance_id = CASE
            WHEN leader_election.instance_id = $1 OR EXTRACT(EPOCH FROM (NOW() - leader_election.last_heartbeat)) > 45
            THEN $1
            ELSE leader_election.instance_id
          END,
          last_heartbeat = CASE
            WHEN leader_election.instance_id = $1 OR EXTRACT(EPOCH FROM (NOW() - leader_election.last_heartbeat)) > 45
            THEN NOW()
            ELSE leader_election.last_heartbeat
          END
        RETURNING instance_id;
      `;

      const res = await pool.query(atomicQuery, [INSTANCE_ID]);
      const leaderId = res.rows[0]?.instance_id;
      const isLeader = leaderId === INSTANCE_ID;

      if (isLeader) {
        lastHeartbeatSuccessTime = Date.now();
        cachedLeadership = true;
      } else {
        cachedLeadership = false;
      }

      return isLeader;
    } catch (err: any) {
      // If error is timeout or network hiccup, and we held leadership recently (< 45s TTL), maintain leadership
      if (cachedLeadership && Date.now() - lastHeartbeatSuccessTime < 45000) {
        return true;
      }
      console.warn('[LEADER ELECTION] Attention connexion DB (maintien du statut leader):', err?.message || err);
      return true; // Fail open to keep bot running
    } finally {
      inFlightLeaderPromise = null;
    }
  })();

  return inFlightLeaderPromise;
}
