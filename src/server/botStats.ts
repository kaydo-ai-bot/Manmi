/**
 * KAYDO BOT - Centralized Statistics & Metrics Tracker
 * Tracks messages sent, failed, anti-spam blocked, opt-outs, errors, and bot status.
 */

import fs from 'fs';
import path from 'path';

interface BotStatsData {
  messagesSent: number;
  messagesFailed: number;
  messagesBlockedAntiSpam: number;
  errorsDetected: number;
  lastResetTime: string;
}

const STATS_FILE = path.join(process.cwd(), 'sessions', 'bot_stats_state.json');

let statsData: BotStatsData = {
  messagesSent: 0,
  messagesFailed: 0,
  messagesBlockedAntiSpam: 0,
  errorsDetected: 0,
  lastResetTime: new Date().toISOString(),
};

function loadStats(): void {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        statsData = {
          messagesSent: Number(parsed.messagesSent) || 0,
          messagesFailed: Number(parsed.messagesFailed) || 0,
          messagesBlockedAntiSpam: Number(parsed.messagesBlockedAntiSpam) || 0,
          errorsDetected: Number(parsed.errorsDetected) || 0,
          lastResetTime: parsed.lastResetTime || new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn('[BOT STATS] Erreur lecture stats:', err);
  }
}

function saveStats(): void {
  try {
    const dir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATS_FILE, JSON.stringify(statsData, null, 2), 'utf8');
  } catch (err) {
    console.warn('[BOT STATS] Erreur écriture stats:', err);
  }
}

// Load on init
loadStats();

export function recordMessageSent(): void {
  statsData.messagesSent++;
  saveStats();
}

export function recordMessageFailed(): void {
  statsData.messagesFailed++;
  statsData.errorsDetected++;
  saveStats();
}

export function recordMessageBlockedAntiSpam(): void {
  statsData.messagesBlockedAntiSpam++;
  saveStats();
}

export function recordErrorDetected(): void {
  statsData.errorsDetected++;
  saveStats();
}

export function getBotStatsSnapshot(activeSessionsCount: number, optOutCount: number) {
  return {
    messagesSent: statsData.messagesSent,
    messagesFailed: statsData.messagesFailed,
    messagesBlockedAntiSpam: statsData.messagesBlockedAntiSpam,
    errorsDetected: statsData.errorsDetected,
    sessionsConnected: activeSessionsCount,
    optOutListCount: optOutCount,
    botStatus: 'ONLINE & PROTECTED',
    lastResetTime: statsData.lastResetTime,
  };
}
