export interface BotMetricsData {
  messagesSent: number;
  messagesFailed: number;
  messagesBlocked: number;
  errorsDetected: number;
  circuitBreakerTrips: number;
  systemHealth: 'EXCELLENT' | 'NOMINAL' | 'CAUTION' | 'RESTRICTED';
  optOutCount: number;
  isCircuitBreakerActive: boolean;
}

export interface BotStats {
  user: string;
  botName?: string;
  prefix: string;
  botMode?: 'public' | 'private';
  uptime: string;
  uptimeDHM?: string;
  memory: string;
  totalMemory: string;
  commandsCount: number;
  owner: string;
  siteUrl: string;
  pingMs: number;
  status: 'ONLINE' | 'STANDBY' | 'CONNECTING' | 'RESTRICTED';
  activeSessionsCount?: number;
  unreadNotifications?: number;
  metrics?: BotMetricsData;
  watchdog?: {
    status: 'ACTIVE' | 'HEALING' | 'STANDBY';
    autoRestartEnabled: boolean;
    reactiveThreshold: string;
    restartCount: number;
    lastHeartbeat: string;
    autonomyMode: string;
  };
}

export interface SystemEventLog {
  id: string;
  timestamp: string | number;
  level: 'info' | 'success' | 'warn' | 'error' | 'spam_blocked' | 'antispam';
  category: 'ANTI_SPAM' | 'CONNECTION' | 'MESSAGE' | 'COMMAND' | 'OPT_OUT' | 'SECURITY' | string;
  message: string;
  target?: string;
  metadata?: any;
}

export interface CustomCommand {
  name: string;
  response: string;
  description?: string;
  createdAt: string | number;
  createdBy?: string;
  updatedAt?: number;
}

export interface BotSettings {
  botName: string;
  botMode: 'public' | 'private';
  prefix: string;
  isGlobalEnabled: boolean;
  optOutCount: number;
}

export interface BotCommand {
  name: string;
  prefix: string;
  category: string;
  description: string;
  usage: string;
  example?: string;
  adminOnly?: boolean;
  ownerOnly?: boolean;
}

export interface SecurityNotification {
  id: string;
  timestamp: string;
  type: 'PAIRING_SUCCESS' | 'PAIRING_REQUEST' | 'AUTH_ALERT' | 'SECURITY_WARNING' | 'SYSTEM_INFO' | 'COMMAND_LOG' | 'STATUS_CHANGE' | 'SYSTEM_BOOT';
  level: 'info' | 'success' | 'warning' | 'critical';
  title: string;
  message: string;
  phone?: string;
  ipAddress?: string;
  read: boolean;
}

export interface PairingResponse {
  success: boolean;
  code?: string;
  formattedCode?: string;
  qrCodeUrl?: string;
  expiresInSeconds?: number;
  sessionId?: string;
  message?: string;
  status: 'pending' | 'connecting' | 'paired' | 'failed';
  error?: string;
}

export interface ConsoleMessage {
  id: string;
  sender: 'user' | 'bot' | 'system';
  timestamp: string;
  text: string;
  image?: string;
  isStatus?: boolean;
}

export interface DetailedSessionInfo {
  sessionId: string;
  phone: string;
  status: 'pending' | 'paired' | 'connecting' | 'reconnecting' | 'loggedOut' | 'failed' | 'offline';
  isSocketOpen: boolean;
  botFunctional: boolean;
  registered: boolean;
  needsPairing?: boolean;
  pairingCode?: string;
  formattedCode?: string;
  codeExpiresAt?: number;
  createdAt: number;
  lastHeartbeat: number;
  pingMs: number;
  uptimeFormatted: string;
  reconnectAttempts: number;
  mode: string;
  welcomeDelivered?: boolean;
  customName?: string;
  botEnabled?: boolean;
  globalBotEnabled?: boolean;
  botMode?: 'public' | 'private';
}

export interface OwnerBroadcastRecord {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  targetMode: 'all_sessions' | 'custom_target';
  totalSessions: number;
  deliveredCount: number;
  failedCount: number;
  details: Array<{
    sessionId: string;
    phone: string;
    status: 'delivered' | 'failed' | 'not_connected';
    error?: string;
  }>;
}

export interface OptOutRecord {
  phone: string;
  addedAt: string;
  reason: string;
}

