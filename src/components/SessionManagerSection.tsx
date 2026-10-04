import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Zap,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  Send,
  Sparkles,
  Smartphone,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  MessageSquare,
  X,
  Lock,
  Wifi,
  ExternalLink,
  Key,
  Copy,
  Check,
  Search,
  UserCheck,
  Crown,
  Edit3,
  Power,
  Globe
} from 'lucide-react';
import { DetailedSessionInfo } from '../types';
import {
  getMySessionIds,
  isOwnerAuthenticated,
  getOwnerToken,
  removeMySession,
  saveMySession
} from '../utils/userSessions';

interface SessionManagerSectionProps {
  onGoToPairing?: () => void;
  onNotificationTrigger?: () => void;
  onGoToOwner?: () => void;
}

export const SessionManagerSection: React.FC<SessionManagerSectionProps> = ({
  onGoToPairing,
  onNotificationTrigger,
  onGoToOwner,
}) => {
  const [sessions, setSessions] = useState<DetailedSessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestartingAll, setIsRestartingAll] = useState(false);
  const [isRestoringAll, setIsRestoringAll] = useState(false);
  const [restartingSessionId, setRestartingSessionId] = useState<string | null>(null);
  const [pingingSessionId, setPingingSessionId] = useState<string | null>(null);
  const [isSendingWelcome, setIsSendingWelcome] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [pingResults, setPingResults] = useState<Record<string, { ms: number; time: string; success: boolean }>>({});

  // Owner Mode State
  const [isOwner, setIsOwner] = useState(isOwnerAuthenticated());
  const [viewAllServerSessions, setViewAllServerSessions] = useState(false);

  // Phone Lookup State (to recover session across devices/browsers)
  const [lookupPhone, setLookupPhone] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupSuccess, setLookupSuccess] = useState<string | null>(null);
  const [showLookupBox, setShowLookupBox] = useState(false);

  // Message Sending Modal State
  const [messageModalSession, setMessageModalSession] = useState<DetailedSessionInfo | null>(null);
  const [messageTarget, setMessageTarget] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Deletion Modal State
  const [deleteModalSession, setDeleteModalSession] = useState<DetailedSessionInfo | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Pairing Modal State for direct phone association
  const [pairingModal, setPairingModal] = useState<{
    sessionId: string;
    phone: string;
    code: string;
    instructions?: string[];
  } | null>(null);
  const [isPairingSession, setIsPairingSession] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Global bot status & 24/7 keep-alive states
  const [globalBotEnabled, setGlobalBotEnabled] = useState(true);
  const [isTogglingGlobalBot, setIsTogglingGlobalBot] = useState(false);
  const [isActivatingKeepAlive, setIsActivatingKeepAlive] = useState(false);
  const [keepAliveStatus, setKeepAliveStatus] = useState<{ active: boolean; message: string; pingMs?: number } | null>(null);

  // Per-session name editing & per-session bot toggling states
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState<string>('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [togglingBotSessionId, setTogglingBotSessionId] = useState<string | null>(null);
  const [togglingModeSessionId, setTogglingModeSessionId] = useState<string | null>(null);

  // Fetch list of sessions strictly isolated to the user, or all for Owner
  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      const ownerStatus = isOwnerAuthenticated();
      setIsOwner(ownerStatus);
      const myIds = getMySessionIds();
      const ownerToken = getOwnerToken();

      let url = '/api/sessions/list';
      if (ownerStatus && viewAllServerSessions) {
        url += `?all=true&ownerToken=${encodeURIComponent(ownerToken || '')}`;
      } else if (myIds.length > 0) {
        url += `?ids=${encodeURIComponent(myIds.join(','))}`;
      } else if (!ownerStatus) {
        // Public visitor who has not connected any session yet:
        // Isolated empty view to guarantee privacy!
        setSessions([]);
        setIsLoading(false);
        return;
      }

      const res = await fetch(url);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.sessions) {
          setSessions(data.sessions);
        }
      }
    } catch (err) {
      console.warn('Erreur chargement des sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetch('/api/system/public-url')
      .then((r) => {
        const ct = r.headers.get('content-type') || '';
        return r.ok && ct.includes('application/json') ? r.json() : null;
      })
      .then((d) => {
        if (d?.publicUrl) setPublicUrl(d.publicUrl);
      })
      .catch(() => {});

    fetch('/api/bot/global-status')
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d.enabled === 'boolean') {
          setGlobalBotEnabled(d.enabled);
        }
      })
      .catch(() => {});

    const interval = setInterval(fetchSessions, 6000);

    const onSessionsUpdated = () => fetchSessions();
    window.addEventListener('kaydo_sessions_updated', onSessionsUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('kaydo_sessions_updated', onSessionsUpdated);
    };
  }, [viewAllServerSessions]);

  // Global bot toggle handler
  const handleGlobalBotToggle = async () => {
    try {
      setIsTogglingGlobalBot(true);
      const nextState = !globalBotEnabled;
      const res = await fetch('/api/bot/global-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGlobalBotEnabled(data.enabled);
        setStatusMessage({
          type: 'success',
          text: data.enabled
            ? '🟢 Bot Global ACTIVÉ : Toutes les sessions répondent désormais aux commandes.'
            : '🔴 Bot Global DÉSACTIVÉ : Toutes les sessions sont en pause (aucune réponse aux commandes).',
        });
        await fetchSessions();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Erreur lors du basculement global' });
    } finally {
      setIsTogglingGlobalBot(false);
    }
  };

  // 24/7 Keep-Alive 1-Click activation handler
  const handleActivateKeepAlive247 = async () => {
    try {
      setIsActivatingKeepAlive(true);
      const res = await fetch('/api/system/keepalive-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setKeepAliveStatus({
          active: true,
          message: 'Protection 24/24 7/7 activée avec succès ! Le bot reste en ligne sans interruption.',
          pingMs: data.pingMs,
        });
        setStatusMessage({
          type: 'success',
          text: `⚡ Mode En Ligne 24/24 7/7 garanti et actif ! Latence heartbeat : ${data.pingMs}ms.`,
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Échec de l\'activation 24/24' });
    } finally {
      setIsActivatingKeepAlive(false);
    }
  };

  // Session renaming handler
  const handleSaveSessionName = async (sessionId: string) => {
    try {
      setIsSavingName(true);
      const res = await fetch('/api/sessions/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, customName: editingSessionName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditingSessionId(null);
        setEditingSessionName('');
        setStatusMessage({
          type: 'success',
          text: `Nom de session modifié avec succès : "${data.customName || 'Par défaut'}"`,
        });
        await fetchSessions();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Erreur de renommage' });
    } finally {
      setIsSavingName(false);
    }
  };

  // Per-session bot ON/OFF toggle handler
  const handleToggleSessionBot = async (sessionId: string, currentEnabled: boolean) => {
    try {
      setTogglingBotSessionId(sessionId);
      const res = await fetch('/api/sessions/toggle-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, botEnabled: !currentEnabled }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({
          type: 'success',
          text: `Bot sur cette session : ${data.botEnabled ? 'ACTIVÉ 🟢' : 'DÉSACTIVÉ 🔴'}`,
        });
        await fetchSessions();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Erreur lors du basculement' });
    } finally {
      setTogglingBotSessionId(null);
    }
  };

  // Per-session bot mode (private / public) toggle handler
  const handleToggleSessionMode = async (sessionId: string, currentMode?: string) => {
    try {
      setTogglingModeSessionId(sessionId);
      const nextMode = currentMode === 'public' ? 'private' : 'public';
      const res = await fetch('/api/sessions/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, mode: nextMode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({
          type: 'success',
          text: `Mode de la session : ${data.botMode === 'private' ? 'PRIVÉ 🔒 (Propriétaire seul)' : 'PUBLIC 🌐 (Accessible à tous)'}`,
        });
        await fetchSessions();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Erreur lors du changement de mode' });
    } finally {
      setTogglingModeSessionId(null);
    }
  };

  // Lookup session by phone to restore on this device
  const handleLookupSession = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = lookupPhone.replace(/\D/g, '');
    if (!clean || clean.length < 8) {
      setLookupError("Veuillez saisir votre numéro complet avec l'indicatif (ex: 50935975863).");
      return;
    }

    try {
      setIsLookingUp(true);
      setLookupError(null);
      setLookupSuccess(null);

      const res = await fetch(`/api/sessions/lookup?phone=${encodeURIComponent(clean)}`);
      const data = await res.json();

      if (res.ok && data.success && data.session) {
        saveMySession(data.session.sessionId, data.session.phone || clean);
        setLookupSuccess(`Session +${data.session.phone || clean} retrouvée et rattachée à cet appareil avec succès !`);
        setLookupPhone('');
        await fetchSessions();
        if (onNotificationTrigger) onNotificationTrigger();
      } else {
        setLookupError(data.error || `Aucune session active n'a été trouvée pour le numéro +${clean} sur le serveur.`);
      }
    } catch (err: any) {
      setLookupError(err?.message || 'Erreur réseau lors de la recherche.');
    } finally {
      setIsLookingUp(false);
    }
  };

  // Global restore of all sessions across PostgreSQL and local storage
  const handleRestoreAllSessions = async () => {
    try {
      setIsRestoringAll(true);
      setStatusMessage(null);
      const res = await fetch('/api/sessions/restore-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMessage({
          type: 'success',
          text: data.message || `Restauration réussie ! ${data.restored || 0} session(s) WhatsApp reconnectée(s) et opérationnelle(s) 24/7.`,
        });
        if (onNotificationTrigger) onNotificationTrigger();
        await fetchSessions();
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || data.message || 'Erreur lors de la restauration des sessions.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Erreur réseau lors de la restauration.',
      });
    } finally {
      setIsRestoringAll(false);
    }
  };

  // Global restart of all sessions
  const handleRestartAll = async () => {
    try {
      setIsRestartingAll(true);
      setStatusMessage(null);
      const ownerToken = getOwnerToken();
      const res = await fetch('/api/sessions/restart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(ownerToken ? { Authorization: `Bearer ${ownerToken}` } : {}),
        },
        body: JSON.stringify({ sessionId: 'all', ownerToken }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: data.message || 'Le bot et toutes les sessions ont été redémarrés avec succès ! Le bot est 100% ré-actif.',
        });
        if (onNotificationTrigger) onNotificationTrigger();
        await fetchSessions();
      } else {
        // Fallback to restore-all
        await handleRestoreAllSessions();
      }
    } catch (err: any) {
      // Fallback to restore-all
      await handleRestoreAllSessions();
    } finally {
      setIsRestartingAll(false);
    }
  };

  // Restart a specific session of user's choice
  const handleRestartSession = async (sessionId: string) => {
    try {
      setRestartingSessionId(sessionId);
      setStatusMessage(null);
      const res = await fetch('/api/sessions/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.needsPairingCode && data.pairingCode) {
          setPairingModal({
            sessionId,
            phone: data.phone || sessionId.replace(/^session_/, ''),
            code: data.pairingCode,
            instructions: data.instructions,
          });
          setStatusMessage({
            type: 'warning',
            text: `🔑 Code d'association généré : ${data.pairingCode}. Associez ce code dans WhatsApp > Appareils connectés pour activer le bot en direct !`,
          });
        } else {
          setStatusMessage({
            type: 'success',
            text: data.message || `Session ${sessionId} redémarrée avec succès. Le bot est ré-actif 24/24 !`,
          });
        }
        if (onNotificationTrigger) onNotificationTrigger();
        await fetchSessions();
      } else {
        if (data.needsPairingCode) {
          setStatusMessage({
            type: 'warning',
            text: data.message || `Cette session n'est pas encore appairée à WhatsApp. Cliquez sur "Associer Code WhatsApp" ci-dessous.`,
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: data.message || `Échec du redémarrage pour la session ${sessionId}.`,
          });
        }
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Erreur réseau lors du redémarrage de la session.',
      });
    } finally {
      setRestartingSessionId(null);
    }
  };

  // Direct 1-Click WhatsApp pairing code generation for existing session
  const handlePairExistingSession = async (session: DetailedSessionInfo) => {
    try {
      setIsPairingSession(session.sessionId);
      setStatusMessage(null);
      const res = await fetch('/api/sessions/re-pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId, phone: session.phone }),
      });

      const data = await res.json();
      if (data.success && (data.formattedCode || data.code)) {
        const activeCode = data.formattedCode || data.code;
        setPairingModal({
          sessionId: session.sessionId,
          phone: session.phone,
          code: activeCode,
          instructions: data.instructions,
        });
        setStatusMessage({
          type: 'warning',
          text: `🔑 Code officiel WhatsApp généré : ${activeCode}. Entrez ce code dans WhatsApp > Appareils connectés pour activer le bot !`,
        });
        if (onNotificationTrigger) onNotificationTrigger();
        await fetchSessions();
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || data.message || 'Impossible de générer le code de jumelage.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || "Erreur réseau lors de l'obtention du code de jumelage.",
      });
    } finally {
      setIsPairingSession(null);
    }
  };

  // Delete a session permanently
  const handleDeleteSessionConfirm = async () => {
    if (!deleteModalSession) return;
    try {
      setIsDeletingSession(true);
      setStatusMessage(null);
      const res = await fetch('/api/sessions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: deleteModalSession.sessionId }),
      });

      const data = await res.json();
      if (data.success) {
        removeMySession(deleteModalSession.sessionId);
        setStatusMessage({
          type: 'success',
          text: `Session +${deleteModalSession.phone} supprimée et nettoyée avec succès.`,
        });
        setDeleteModalSession(null);
        if (onNotificationTrigger) onNotificationTrigger();
        await fetchSessions();
      } else {
        setStatusMessage({
          type: 'error',
          text: data.message || 'Erreur lors de la suppression de la session.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Erreur réseau lors de la suppression.',
      });
    } finally {
      setIsDeletingSession(false);
    }
  };

  // Send a custom WhatsApp message from a specific session
  const handleSendMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageModalSession || !messageText.trim()) return;

    try {
      setIsSendingMessage(true);
      setStatusMessage(null);
      const res = await fetch('/api/sessions/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: messageModalSession.sessionId,
          target: messageTarget.trim(),
          text: messageText.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `Message transmis avec succès depuis +${messageModalSession.phone} !`,
        });
        setMessageText('');
        setMessageModalSession(null);
        if (onNotificationTrigger) onNotificationTrigger();
      } else {
        setStatusMessage({
          type: 'error',
          text: data.message || "Erreur lors de l'envoi du message.",
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || "Erreur réseau lors de l'envoi du message.",
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Test live responsiveness (Ping) for a specific session
  const handlePingSession = async (sessionId: string) => {
    try {
      setPingingSessionId(sessionId);
      const res = await fetch('/api/sessions/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();
      const nowStr = new Date().toLocaleTimeString('fr-FR');

      if (data.success) {
        setPingResults((prev) => ({
          ...prev,
          [sessionId]: { ms: data.pingMs, time: nowStr, success: true },
        }));
        setStatusMessage({
          type: 'success',
          text: `✅ Test réussi pour ${sessionId} : Réponse instantanée en ${data.pingMs}ms. Le bot est 100% fonctionnel !`,
        });
      } else {
        setPingResults((prev) => ({
          ...prev,
          [sessionId]: { ms: 0, time: nowStr, success: false },
        }));
        setStatusMessage({
          type: 'error',
          text: `⚠️ Test échoué pour ${sessionId} : ${data.message}. Cliquez sur "Redémarrer" pour relancer la connexion.`,
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Erreur lors du test de réactivité.',
      });
    } finally {
      setPingingSessionId(null);
    }
  };

  // Trigger welcome message delivery
  const handleSendWelcome = async (sessionId?: string) => {
    try {
      setIsSendingWelcome(true);
      setStatusMessage(null);
      const res = await fetch('/api/whatsapp/send-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: data.message || 'Message de bienvenue officiel transmis avec succès sur WhatsApp !',
        });
        if (onNotificationTrigger) onNotificationTrigger();
      } else {
        setStatusMessage({
          type: 'error',
          text: data.message || "Impossible d'envoyer le message de bienvenue.",
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || "Erreur réseau lors de l'envoi du message de bienvenue.",
      });
    } finally {
      setIsSendingWelcome(false);
    }
  };

  const activeSessionsCount = sessions.filter((s) => s.botFunctional).length;

  return (
    <div id="session-manager-section" className="space-y-6">
      {/* Exclusive Owner Banner when Dev Kaydo Scofield is logged in */}
      {isOwner && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/60 border border-amber-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-amber-950/30">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-300 flex items-center gap-2 flex-wrap">
                <span>👑 Mode Propriétaire Actif</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                  𝐊𝐀𝐘𝐃𝐎 𝐙𝐋𝐊 𓃶 & 𝐒𝐇𝐀𝐊𝐀 𝐙𝐋𝐊 𓃶 (+509 3597 5863)
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Vous avez les droits administrateur complets pour superviser toutes les sessions WhatsApp du serveur.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewAllServerSessions(!viewAllServerSessions)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                viewAllServerSessions
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              {viewAllServerSessions ? '👁️ Vue Globale Serveur' : '🔒 Mes Sessions Seulement'}
            </button>

            {onGoToOwner && (
              <button
                type="button"
                onClick={onGoToOwner}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Espace Owner</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Banner & Control Deck */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-[#0e1626] to-slate-950 border border-emerald-500/30 p-6 sm:p-8 shadow-xl shadow-emerald-950/20">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>SUPERVISION 24H/24 • REDÉMARRAGE FORCÉ • GESTION MULTI-SESSION</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Gestionnaire des Sessions & Contrôle du Bot
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Consultez l&apos;état en direct de toutes vos sessions connectées. Vous pouvez{' '}
              <strong className="text-emerald-400">redémarrer tout le bot</strong> ou{' '}
              <strong className="text-cyan-400">la session de votre choix</strong>, envoyer un message WhatsApp personnalisé, ou supprimer définitivement une session.
            </p>
          </div>

          {/* Master Actions Buttons */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 shrink-0">
            {/* 1-Click 24/7 Keep-Alive Button */}
            <button
              id="btn-activate-keepalive-247"
              onClick={handleActivateKeepAlive247}
              disabled={isActivatingKeepAlive}
              className="px-5 py-3.5 rounded-xl font-extrabold text-xs sm:text-sm bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 shadow-lg shadow-cyan-500/25 transition-all transform active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
              title="Garantit que le bot ne s'arrête jamais sur Render ou tout serveur Cloud 24/24 7/7"
            >
              <Globe className={`w-4 h-4 ${isActivatingKeepAlive ? 'animate-spin' : ''}`} />
              <span>
                {isActivatingKeepAlive ? 'Activation 24/24...' : '⚡ METTRE EN LIGNE 24/24 7/7'}
              </span>
            </button>

            {/* Global Bot ON / OFF Toggle for all sessions */}
            <button
              id="btn-global-bot-toggle"
              onClick={handleGlobalBotToggle}
              disabled={isTogglingGlobalBot}
              className={`px-4 py-3.5 rounded-xl font-extrabold text-xs sm:text-sm border transition-all transform active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer shadow-md ${
                globalBotEnabled
                  ? 'bg-emerald-600/25 hover:bg-emerald-600/35 border-emerald-500/60 text-emerald-300'
                  : 'bg-rose-600/25 hover:bg-rose-600/35 border-rose-500/60 text-rose-300'
              }`}
              title="Active ou désactive le bot simultanément sur toutes les sessions"
            >
              <Power className={`w-4 h-4 ${isTogglingGlobalBot ? 'animate-spin' : ''}`} />
              <span>
                {isTogglingGlobalBot
                  ? 'Changement...'
                  : globalBotEnabled
                  ? '🤖 BOT GLOBAL : ON 🟢'
                  : '🤖 BOT GLOBAL : OFF 🔴'}
              </span>
            </button>

            <button
              id="btn-restart-all-bot"
              onClick={handleRestartAll}
              disabled={isRestartingAll}
              className="px-5 py-3.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/30 transition-all transform active:scale-95 flex items-center justify-center space-x-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <RotateCcw className={`w-4 h-4 ${isRestartingAll ? 'animate-spin' : ''}`} />
              <span>
                {isRestartingAll ? 'Redémarrage...' : '⚡ Redémarrer Tout'}
              </span>
            </button>

            <button
              id="btn-restore-all-sessions"
              onClick={handleRestoreAllSessions}
              disabled={isRestoringAll}
              className="px-5 py-3.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/30 transition-all transform active:scale-95 flex items-center justify-center space-x-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Restaure et reconnecte toutes les sessions WhatsApp enregistrées"
            >
              <RefreshCw className={`w-4 h-4 ${isRestoringAll ? 'animate-spin text-white' : 'text-blue-200'}`} />
              <span>
                {isRestoringAll ? 'Restauration...' : '🔄 Restaurer Les Sessions'}
              </span>
            </button>

            <button
              id="btn-refresh-sessions-list"
              onClick={fetchSessions}
              disabled={isLoading}
              className="px-4 py-3.5 rounded-xl text-sm font-semibold bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              title="Rafraîchir l'état des sessions"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>

            {onGoToPairing && (
              <button
                id="btn-add-session-link"
                onClick={onGoToPairing}
                className="px-4 py-3.5 rounded-xl text-sm font-semibold bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>+ Jumeler un Compte</span>
              </button>
            )}
          </div>
        </div>

        {/* Real-time Health Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Sessions Sauvegardées</div>
              <div className="text-lg font-bold text-white">{sessions.length}</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Connectées & Réactives</div>
              <div className="text-lg font-bold text-emerald-400">
                {activeSessionsCount} / {sessions.length || 1}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Disponibilité Bot</div>
              <div className="text-sm font-bold text-amber-300">24/24 & 7/7 Cloud</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Watchdog Autonome</div>
              <div className="text-sm font-bold text-purple-300">Actif &lt; 2 min</div>
            </div>
          </div>
        </div>

        {/* Public Portal Link & Anti-Spam / Anti-Ban Guarantees Banner */}
        <div className="mt-5 p-4 rounded-xl bg-slate-950/70 border border-emerald-500/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-white flex items-center space-x-2">
                <span>PORTAIL PUBLIC & PROTECTION ANTI-BAN ACTIVE</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ZÉRO SPAM • ZÉRO BAN
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Message de bienvenue transmis <strong className="text-emerald-300">1 seule fois</strong> par compte avec le lien public direct. Aucune restriction ni risque de ban.
              </p>
            </div>
          </div>

          {publicUrl && (
            <div className="flex items-center space-x-2 w-full md:w-auto bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-lg">
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-xs font-mono text-cyan-300 truncate max-w-xs">{publicUrl}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(publicUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="ml-auto text-xs px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center space-x-1 cursor-pointer"
                title="Copier le lien public"
              >
                {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                <span>{copiedLink ? 'Copié' : 'Copier'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live Feedback Alert Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-start justify-between gap-3 shadow-md animate-fadeIn ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
              : 'bg-blue-950/60 border-blue-500/40 text-blue-200'
          }`}
        >
          <div className="flex items-start space-x-3">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-semibold">
                {statusMessage.type === 'success' ? 'Action Réussie' : 'Information Système'}
              </div>
              <p className="text-xs opacity-90 leading-relaxed">{statusMessage.text}</p>
            </div>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs px-2 py-1 rounded bg-black/30 hover:bg-black/50 text-slate-400 hover:text-white cursor-pointer"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Recover / Lookup Session Drawer for users who changed device or cleared browser cache */}
      <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Changement d&apos;appareil ou cache vidé ? Retrouver ma session
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowLookupBox(!showLookupBox)}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer underline self-start sm:self-auto"
          >
            {showLookupBox ? 'Masquer la recherche' : 'Rechercher mon numéro'}
          </button>
        </div>

        {showLookupBox && (
          <form onSubmit={handleLookupSession} className="space-y-2 pt-2 border-t border-slate-800/80">
            <p className="text-xs text-slate-400">
              Saisissez le numéro WhatsApp utilisé lors de votre jumelage pour ré-attacher instantanément votre session à ce navigateur :
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="tel"
                value={lookupPhone}
                onChange={(e) => setLookupPhone(e.target.value)}
                placeholder="50935975863 (avec indicatif)"
                className="w-full sm:flex-1 h-10 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                disabled={isLookingUp}
              />
              <button
                type="submit"
                disabled={isLookingUp}
                className="w-full sm:w-auto h-10 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Search className={`w-3.5 h-3.5 ${isLookingUp ? 'animate-spin' : ''}`} />
                <span>{isLookingUp ? 'Recherche...' : 'Retrouver & Attacher'}</span>
              </button>
            </div>

            {lookupError && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5 pt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{lookupError}</span>
              </p>
            )}
            {lookupSuccess && (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{lookupSuccess}</span>
              </p>
            )}
          </form>
        )}
      </div>

      {/* Sessions List Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <h3 className="font-extrabold text-white text-lg">
              {isOwner && viewAllServerSessions
                ? `Toutes les Sessions du Serveur (${sessions.length})`
                : `Mes Sessions Connectées (${sessions.length})`}
            </h3>
            {!isOwner && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                🔒 Vue Privée
              </span>
            )}
          </div>
          <button
            onClick={fetchSessions}
            className="text-xs text-slate-400 hover:text-emerald-400 flex items-center space-x-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500 text-2xl">
              🔒
            </div>
            <div className="space-y-1">
              <div className="font-bold text-white text-base">
                Aucune session WhatsApp connectée sur cet appareil
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Pour protéger votre vie privée, seules les sessions WhatsApp que vous avez vous-même associées sur ce site sont affichées sur votre navigateur.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {onGoToPairing && (
                <button
                  type="button"
                  onClick={onGoToPairing}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all flex items-center space-x-2 cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>+ Connecter Mon WhatsApp</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowLookupBox(true)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center space-x-2 cursor-pointer"
              >
                <Search className="w-4 h-4 text-cyan-400" />
                <span>Retrouver un numéro existant</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {sessions.map((session) => {
              const ping = pingResults[session.sessionId];
              const isRestartingThis = restartingSessionId === session.sessionId;
              const isPingingThis = pingingSessionId === session.sessionId;

              return (
                <div
                  key={session.sessionId}
                  id={`session-card-${session.sessionId}`}
                  className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/90 hover:border-slate-700 transition-all space-y-4 shadow-lg shadow-black/40"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Phone & Status Info */}
                    <div className="flex items-start sm:items-center space-x-3.5">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold ring-1 shrink-0 ${
                          session.botFunctional
                            ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30'
                            : session.status === 'reconnecting'
                            ? 'bg-amber-500/15 text-amber-400 ring-amber-500/30'
                            : 'bg-rose-500/15 text-rose-400 ring-rose-500/30'
                        }`}
                      >
                        📱
                      </div>

                      <div className="space-y-1.5">
                        {/* Custom Name & Renaming Input */}
                        {editingSessionId === session.sessionId ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingSessionName}
                              onChange={(e) => setEditingSessionName(e.target.value)}
                              placeholder="Nom de la session (ex: Bot Perso)"
                              className="h-8 px-2.5 rounded-lg bg-slate-900 border border-emerald-500/60 text-white text-xs font-semibold focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveSessionName(session.sessionId)}
                              disabled={isSavingName}
                              className="h-8 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>{isSavingName ? '...' : 'Sauvegarder'}</span>
                            </button>
                            <button
                              onClick={() => { setEditingSessionId(null); setEditingSessionName(''); }}
                              className="h-8 px-2 rounded-lg bg-slate-800 text-slate-300 text-xs hover:text-white cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-base text-white tracking-wide">
                              {session.customName ? session.customName : `Session +${session.phone}`}
                            </span>
                            <button
                              onClick={() => {
                                setEditingSessionId(session.sessionId);
                                setEditingSessionName(session.customName || `Session +${session.phone}`);
                              }}
                              className="p-1 px-2 rounded-md bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 text-xs flex items-center gap-1 cursor-pointer transition-colors border border-slate-700"
                              title="Modifier le nom de cette session"
                            >
                              <Edit3 className="w-3 h-3 text-cyan-400" />
                              <span className="text-[10px] font-semibold">Changer le nom</span>
                            </button>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-400 font-mono">
                            +{session.phone}
                          </span>

                          {/* Live connection badge */}
                          {session.botFunctional || session.registered ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>EN LIGNE (24/24)</span>
                            </span>
                          ) : session.status === 'reconnecting' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center space-x-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-spin" />
                              <span>RECONNEXION AUTO (Watchdog)</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center space-x-1.5">
                              <span>HORS-LIGNE (Clés conservées)</span>
                            </span>
                          )}

                          {/* Functional verification badge */}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              session.botFunctional || session.registered
                                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            🤖 Bot Fonctionnel : {session.botFunctional || session.registered ? 'OUI (100% Opérationnel)' : 'NON (Relancer)'}
                          </span>

                          {/* Welcome message status badge */}
                          {session.welcomeDelivered ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Bienvenue envoyé 1x (Verrouillé)</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center space-x-1">
                              <span>Bienvenue en attente</span>
                            </span>
                          )}

                          {/* Anti-ban guarantee badge */}
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span>Anti-Ban & Zéro Restriction</span>
                          </span>

                          {/* Bot Mode Badge (Privé par défaut) */}
                          <button
                            onClick={() => handleToggleSessionMode(session.sessionId, session.botMode || 'private')}
                            disabled={togglingModeSessionId === session.sessionId}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center space-x-1 cursor-pointer transition-all ${
                              session.botMode === 'public'
                                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                            }`}
                            title="Cliquer pour basculer le mode entre Privé et Public"
                          >
                            <span>{session.botMode === 'public' ? '🌐 MODE PUBLIC' : '🔒 MODE PRIVÉ (Par défaut)'}</span>
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                          <span>Session ID : <code className="text-slate-300 font-mono">{session.sessionId}</code></span>
                          <span>•</span>
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Uptime : {session.uptimeFormatted}</span>
                          </span>
                          <span>•</span>
                          <span>Clés : <strong className="text-emerald-400">creds.json sauvegardé</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Action Controls for this specific session */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* Per-session Bot ON / OFF Toggle */}
                      <button
                        id={`btn-toggle-bot-${session.sessionId}`}
                        onClick={() => handleToggleSessionBot(session.sessionId, session.botEnabled !== false)}
                        disabled={togglingBotSessionId === session.sessionId}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 cursor-pointer ${
                          session.botEnabled !== false
                            ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950/20'
                            : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40'
                        }`}
                        title="Activer ou désactiver les réponses automatiques du bot sur cette session spécifique"
                      >
                        <Power className={`w-3.5 h-3.5 ${togglingBotSessionId === session.sessionId ? 'animate-spin' : ''}`} />
                        <span>
                          {togglingBotSessionId === session.sessionId
                            ? 'Modification...'
                            : session.botEnabled !== false
                            ? 'Bot : ON 🟢'
                            : 'Bot : OFF 🔴'}
                        </span>
                      </button>

                      {/* Per-session Mode Toggle */}
                      <button
                        id={`btn-toggle-mode-${session.sessionId}`}
                        onClick={() => handleToggleSessionMode(session.sessionId, session.botMode || 'private')}
                        disabled={togglingModeSessionId === session.sessionId}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 cursor-pointer ${
                          (session.botMode || 'private') === 'private'
                            ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                            : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-500/40'
                        }`}
                        title="Basculer entre Mode Privé (seul le propriétaire peut exécuter des commandes) et Public (accessible à tous)"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>
                          {togglingModeSessionId === session.sessionId
                            ? '...'
                            : (session.botMode || 'private') === 'private'
                            ? '🔒 Privé'
                            : '🌐 Public'}
                        </span>
                      </button>

                      {/* Pair / Link WhatsApp button if not functional */}
                      {!session.botFunctional && (
                        <button
                          id={`btn-pair-${session.sessionId}`}
                          onClick={() => handlePairExistingSession(session)}
                          disabled={isPairingSession === session.sessionId}
                          className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-amber-500/25 via-emerald-500/25 to-cyan-500/25 hover:from-amber-500/40 hover:to-emerald-500/40 border border-amber-500/50 text-amber-200 transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer shadow-md shadow-amber-950/20"
                          title="Générer un code officiel WhatsApp pour lier ce compte en 10 secondes"
                        >
                          <Key className={`w-3.5 h-3.5 ${isPairingSession === session.sessionId ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
                          <span>{isPairingSession === session.sessionId ? 'Génération...' : '🔑 Associer Code WhatsApp'}</span>
                        </button>
                      )}

                      {/* Live Ping button */}
                      <button
                        id={`btn-ping-${session.sessionId}`}
                        onClick={() => handlePingSession(session.sessionId)}
                        disabled={isPingingThis}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                        title="Tester la réponse en direct du bot pour ce compte"
                      >
                        <Zap className={`w-3.5 h-3.5 ${isPingingThis ? 'animate-bounce text-amber-400' : 'text-amber-400'}`} />
                        <span>{isPingingThis ? 'Test...' : 'Ping Live'}</span>
                      </button>

                      {/* Restart individual session of user's choice */}
                      <button
                        id={`btn-restart-${session.sessionId}`}
                        onClick={() => handleRestartSession(session.sessionId)}
                        disabled={isRestartingThis}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                        title="Redémarrer le bot sur cette session pour rétablir la connexion"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${isRestartingThis ? 'animate-spin' : ''}`} />
                        <span>{isRestartingThis ? 'Redémarrage...' : 'Redémarrer cette session'}</span>
                      </button>

                      {/* Send Custom Message button */}
                      <button
                        id={`btn-send-msg-${session.sessionId}`}
                        onClick={() => {
                          setMessageModalSession(session);
                          setMessageTarget('');
                          setMessageText('');
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 transition-all flex items-center space-x-1.5 cursor-pointer"
                        title="Envoyer un message WhatsApp depuis cette session"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Envoyer un Message</span>
                      </button>

                      {/* Welcome message trigger */}
                      <button
                        id={`btn-welcome-${session.sessionId}`}
                        onClick={() => handleSendWelcome(session.sessionId)}
                        disabled={isSendingWelcome}
                        className="px-2.5 py-2 rounded-xl text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 transition-all flex items-center space-x-1 cursor-pointer"
                        title="Transmettre le message officiel de bienvenue"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Bienvenue</span>
                      </button>

                      {/* Delete session button */}
                      <button
                        id={`btn-delete-${session.sessionId}`}
                        onClick={() => setDeleteModalSession(session)}
                        className="px-2.5 py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 transition-all flex items-center space-x-1 cursor-pointer"
                        title="Supprimer définitivement cette session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Pairing Code Box if active code is available */}
                  {(session.pairingCode || (pairingModal && pairingModal.sessionId === session.sessionId)) && (
                    <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-emerald-950/30 border border-amber-500/40 space-y-3 shadow-lg shadow-amber-950/20">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                          <span className="text-xs font-extrabold text-amber-300 uppercase tracking-wider">
                            🔑 Code de Jumelage WhatsApp Actif (Socket Ouvert)
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Numéro : +{session.phone}
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-slate-950/90 p-3 rounded-xl border border-amber-500/40">
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-slate-400 font-medium">Code Officiel :</span>
                          <span className="text-xl sm:text-2xl font-mono font-black text-amber-300 tracking-widest selection:bg-amber-500 selection:text-black">
                            {session.formattedCode || session.pairingCode || pairingModal?.code}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            const codeToCopy = (session.formattedCode || session.pairingCode || pairingModal?.code || '').replace(/-/g, '');
                            navigator.clipboard.writeText(codeToCopy);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2000);
                          }}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center space-x-1.5 transition-colors cursor-pointer"
                        >
                          {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                          <span>{copiedCode ? 'Copié !' : 'Copier le code'}</span>
                        </button>
                      </div>

                      <div className="text-xs text-slate-300 space-y-1.5 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                        <p className="font-bold text-white text-[12px] flex items-center space-x-1.5">
                          <span>📲 Association en 10 secondes sur votre téléphone :</span>
                        </p>
                        <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px]">
                          <li>Ouvrez <strong>WhatsApp</strong> sur le téléphone <strong>+{session.phone}</strong>.</li>
                          <li>Allez dans <strong>Réglages &gt; Appareils connectés</strong> <em>(si une ancienne session y figure, touchez <strong>Déconnecter</strong>)</em>.</li>
                          <li>Touchez <strong>&quot;Connecter un appareil&quot;</strong> puis <strong>&quot;Associer avec le numéro de téléphone&quot;</strong> au bas de l&apos;écran.</li>
                          <li>Saisissez ce code à 8 chiffres : <strong className="text-amber-300 font-mono text-xs">{session.formattedCode || session.pairingCode || pairingModal?.code}</strong>.</li>
                        </ol>
                        <p className="text-[11px] text-emerald-400 font-semibold pt-1">
                          ⚡ Dès que vous entrez le code, le socket WhatsApp s&apos;active instantanément et le bot passe en statut EN LIGNE (24/24) !
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Ping test result bar if available */}
                  {ping && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
                        ping.success
                          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {ping.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span>
                          {ping.success
                            ? `Latence WhatsApp mesurée : ${ping.ms} ms • Le bot répond instantanément.`
                            : 'Aucune réponse du socket. Cliquez sur "Associer Code WhatsApp" ci-dessus ou sur "Redémarrer cette session".'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">Testé à {ping.time}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Safety Notice & 24/7 Guarantee */}
      <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 flex items-start space-x-3.5">
        <Activity className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <span className="font-bold text-slate-200 text-sm">
            Garantie de Disponibilité Permanente (KAYDO BOT • 24/7) :
          </span>
          <p className="leading-relaxed">
            Les sessions WhatsApp sont conservées de façon permanente sur disque dans le dossier chiffré des sessions. Même si votre téléphone est éteint, sans batterie ou hors réseau, le bot continue d&apos;exécuter les 295+ commandes de manière autonome sur nos serveurs Cloud. Si une coupure survient, le Watchdog autonome auto-rétablira le bot sous 2 minutes maximum.
          </p>
        </div>
      </div>

      {/* MODAL: Envoi de Message WhatsApp */}
      {messageModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-cyan-500/40 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-base">
                  Envoyer un Message WhatsApp
                </h3>
              </div>
              <button
                onClick={() => setMessageModalSession(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendMessageSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Session Émettrice
                </label>
                <div className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-emerald-400">
                  +{messageModalSession.phone} ({messageModalSession.sessionId})
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Destinataire (Numéro avec indicatif ou vide pour votre discussion &quot;Vous&quot;)
                </label>
                <input
                  type="text"
                  value={messageTarget}
                  onChange={(e) => setMessageTarget(e.target.value)}
                  placeholder="ex: 50912345678 (laisser vide pour votre contact personnel)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Si vide, le message sera envoyé directement dans votre discussion personnelle WhatsApp.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Message à envoyer
                </label>
                <textarea
                  rows={4}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Tapez le message à envoyer (il sera automatiquement stylisé avec le style officiel du bot)..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMessageModalSession(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSendingMessage || !messageText.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSendingMessage ? 'Envoi en cours...' : 'Envoyer le Message'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirmation de Suppression de Session */}
      {deleteModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-rose-500/40 shadow-2xl p-6 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-white text-base">
                  Supprimer la Session WhatsApp ?
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Êtes-vous sûr de vouloir supprimer la session du compte{' '}
                  <strong className="text-white font-mono">+{deleteModalSession.phone}</strong> (<code>{deleteModalSession.sessionId}</code>) ?
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300 space-y-1">
              <span className="font-semibold">Attention :</span>
              <p>
                Le socket WhatsApp sera immédiatement déconnecté et les identifiants de session enregistrés sur disque seront effacés. Pour reconnecter ce compte ultérieurement, un nouveau jumelage sera nécessaire.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalSession(null)}
                disabled={isDeletingSession}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteSessionConfirm}
                disabled={isDeletingSession}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingSession ? 'Suppression...' : 'Confirmer la Suppression'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Code de Jumelage WhatsApp & Instructions */}
      {pairingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-amber-500/50 shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base">
                    Associer WhatsApp au Bot (24/24)
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Compte : +{pairingModal.phone}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPairingModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  Votre Code de Jumelage :
                </span>
                <div className="text-3xl font-mono font-black text-amber-300 tracking-widest mt-0.5">
                  {pairingModal.code}
                </div>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pairingModal.code.replace(/-/g, ''));
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
                <span>{copiedCode ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-2">
              <span className="font-bold text-white flex items-center space-x-1.5">
                <span>📋 Procédure sur votre smartphone WhatsApp :</span>
              </span>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-xs">
                <li>Ouvrez WhatsApp sur le téléphone <strong>+{pairingModal.phone}</strong>.</li>
                <li>Allez dans <strong>Réglages &gt; Appareils connectés</strong>.</li>
                <li className="text-amber-300 font-medium">Si une session précédente apparaît, touchez-la puis choisissez <strong>&quot;Déconnecter&quot;</strong>.</li>
                <li>Touchez <strong>&quot;Connecter un appareil&quot;</strong> puis en bas : <strong>&quot;Associer avec le numéro de téléphone&quot;</strong>.</li>
                <li>Saisissez le code : <strong className="text-amber-300 font-mono text-sm">{pairingModal.code}</strong>.</li>
              </ol>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Socket actif en écoute directe...</span>
              </span>
              <button
                type="button"
                onClick={() => setPairingModal(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-all cursor-pointer"
              >
                J&apos;ai saisi le code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
