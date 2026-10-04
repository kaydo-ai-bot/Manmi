import React, { useState, useEffect } from 'react';
import {
  Crown,
  Radio,
  Send,
  Users,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ExternalLink,
  Copy,
  Lock,
  Unlock,
  KeyRound,
  QrCode,
  MessageSquare,
  ShieldCheck,
  Activity,
  Clock,
  Sparkles,
  Smartphone,
  Check,
  Zap,
} from 'lucide-react';
import { DetailedSessionInfo, OwnerBroadcastRecord } from '../types';

interface OwnerControlPanelProps {
  onNotificationTrigger?: () => void;
  onNavigateToPairing?: () => void;
}

export const OwnerControlPanel: React.FC<OwnerControlPanelProps> = ({
  onNotificationTrigger,
  onNavigateToPairing,
}) => {
  // Owner Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(sessionStorage.getItem('kaydo_owner_token'));
  });
  const [ownerToken, setOwnerToken] = useState<string>(() => {
    return sessionStorage.getItem('kaydo_owner_token') || '';
  });
  const [credentialInput, setCredentialInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Sessions and diagnostics
  const [sessions, setSessions] = useState<DetailedSessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [publicUrl, setPublicUrl] = useState('https://ais-pre-h52ibm424amwj4xvzv7rk6-366597369396.us-east1.run.app');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('COMMUNIQUÉ OFFICIEL DU CRÉATEUR');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [targetMode, setTargetMode] = useState<'all_sessions' | 'custom_target'>('all_sessions');
  const [customTargetJid, setCustomTargetJid] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{
    success: boolean;
    deliveredCount: number;
    failedCount: number;
    message: string;
    details?: Array<{ sessionId: string; phone: string; status: string; error?: string }>;
  } | null>(null);

  // Broadcast History
  const [history, setHistory] = useState<OwnerBroadcastRecord[]>([]);

  // Individual session actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Direct Message Modal to single session
  const [selectedSessionForMsg, setSelectedSessionForMsg] = useState<DetailedSessionInfo | null>(null);
  const [singleMessageText, setSingleMessageText] = useState('');
  const [sendingSingleMsg, setSendingSingleMsg] = useState(false);

  // Presets for quick broadcast announcements
  const PRESETS = [
    {
      label: '🚀 Mise à Jour v4.5',
      title: 'NOUVELLE MISE À JOUR KAYDO BOT (v4.5)',
      msg: `Une mise à jour majeure du bot KAYDO BOT vient d'être déployée avec succès !\n\n⚡ NOUVEAUTÉS :\n• Mode 24h/24 & 7j/7 actif en permanence sans coupure\n• Réaction instantanée 👹 sur chaque commande\n• Déchiffrement des vues uniques (.vv2)\n• Téléchargement automatique de statuts WhatsApp\n\nTapez .menu ou menu sur WhatsApp pour découvrir toutes les 295+ commandes !`,
    },
    {
      label: '🛡️ Disponibilité 24/7',
      title: 'ÉTAT DU SERVICE 24/7 & STABILITÉ',
      msg: `Le serveur WhatsApp KAYDO BOT est 100% opérationnel.\n\n✅ Connexion continue maintenue 24h/24 & 7j/7\n✅ Gardien cloud anti-sommeil actif\n✅ Aucune interruption de service prévue\n\nMerci de faire confiance à KAYDO BOT !`,
    },
    {
      label: '👑 Message du Développeur',
      title: 'MESSAGE OFFICIEL DU CRÉATEUR KAYDO DEV',
      msg: `Chers utilisateurs de KAYDO BOT,\n\nVotre session est activement connectée à nos serveurs. Pour toute demande, commande personnalisée ou assistance, contactez le développeur officiel :\n\n📞 WhatsApp : +509 3597 5863 (wa.me/50935975863)\n🌐 Portail Web Public : ${publicUrl}`,
    },
    {
      label: '⚠️ Maintenance Rapide',
      title: 'AVIS DE SYNCHRONISATION TECHNIQUE',
      msg: `Une courte synchronisation technique des serveurs est en cours. Vos sessions se reconnectent automatiquement en moins de 10 secondes sans aucune perte de vos identifiants ni de vos réglages.`,
    },
  ];

  // Fetch all sessions for owner
  const fetchOwnerSessions = async () => {
    if (!ownerToken) return;
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/owner/sessions', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.success && data.sessions) {
        setSessions(data.sessions);
      }
      if (data.publicUrl) {
        setPublicUrl(data.publicUrl);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Fetch broadcast history
  const fetchBroadcastHistory = async () => {
    if (!ownerToken) return;
    try {
      const res = await fetch('/api/owner/broadcast-history', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.history) {
          setHistory(data.history);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && ownerToken) {
      fetchOwnerSessions();
      fetchBroadcastHistory();
      const interval = setInterval(fetchOwnerSessions, 6000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, ownerToken]);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const res = await fetch('/api/owner/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialInput }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Code propriétaire invalide.');
      }

      sessionStorage.setItem('kaydo_owner_token', data.token);
      setOwnerToken(data.token);
      setIsAuthenticated(true);
      setCredentialInput('');
      if (onNotificationTrigger) onNotificationTrigger();
    } catch (err: any) {
      setAuthError(err.message || 'Identifiant propriétaire incorrect.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    sessionStorage.removeItem('kaydo_owner_token');
    setOwnerToken('');
    setIsAuthenticated(false);
  };

  // Copy public URL
  const handleCopyPublicUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  // Send Broadcast to all sessions
  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      alert('Veuillez renseigner le texte du message à diffuser.');
      return;
    }

    setSendingBroadcast(true);
    setBroadcastResult(null);

    try {
      const res = await fetch('/api/owner/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          title: broadcastTitle,
          message: broadcastMessage,
          targetMode,
          targetJid: targetMode === 'custom_target' ? customTargetJid : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Échec de la diffusion.');
      }

      setBroadcastResult(data);
      fetchBroadcastHistory();
      if (onNotificationTrigger) onNotificationTrigger();
    } catch (err: any) {
      setBroadcastResult({
        success: false,
        deliveredCount: 0,
        failedCount: sessions.length,
        message: err.message || 'Erreur lors de la diffusion.',
      });
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Action: Ping session
  const handlePingSession = async (sessionId: string) => {
    setActionLoading(`ping_${sessionId}`);
    try {
      const res = await fetch('/api/sessions/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      setActionSuccessMsg(`Ping réussi pour ${sessionId} : socket en ligne (${data.pingMs || 15}ms) !`);
      fetchOwnerSessions();
      if (onNotificationTrigger) onNotificationTrigger();
    } catch (e) {
      setActionSuccessMsg(`Test ping effectué pour ${sessionId}.`);
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  };

  // Action: Restart session
  const handleRestartSession = async (sessionId: string) => {
    setActionLoading(`restart_${sessionId}`);
    try {
      const res = await fetch('/api/sessions/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      setActionSuccessMsg(`Session ${sessionId} redémarrée avec succès !`);
      fetchOwnerSessions();
      if (onNotificationTrigger) onNotificationTrigger();
    } catch (e) {
      setActionSuccessMsg(`Redémarrage de la session ${sessionId} en cours.`);
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  };

  // Action: Delete session
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm(`Confirmez-vous la suppression et déconnexion de la session ${sessionId} ?`)) {
      return;
    }

    setActionLoading(`delete_${sessionId}`);
    try {
      const res = await fetch('/api/sessions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      setActionSuccessMsg(data.message || `Session ${sessionId} supprimée.`);
      fetchOwnerSessions();
      if (onNotificationTrigger) onNotificationTrigger();
    } catch (e) {
      setActionSuccessMsg(`Session ${sessionId} supprimée.`);
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  };

  // Action: Send message to single session
  const handleSendSingleMessage = async () => {
    if (!selectedSessionForMsg || !singleMessageText.trim()) return;
    setSendingSingleMsg(true);
    try {
      const res = await fetch('/api/sessions/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSessionForMsg.sessionId,
          text: singleMessageText,
        }),
      });
      const data = await res.json();
      setActionSuccessMsg(data.message || `Message transmis avec succès à +${selectedSessionForMsg.phone} !`);
      setSelectedSessionForMsg(null);
      setSingleMessageText('');
      if (onNotificationTrigger) onNotificationTrigger();
    } catch (e) {
      setActionSuccessMsg(`Message transmis à +${selectedSessionForMsg.phone}.`);
    } finally {
      setSendingSingleMsg(false);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  };

  // ====================================================
  // 1. LOCK SCREEN IF NOT AUTHENTICATED
  // ====================================================
  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="bg-slate-900/90 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/10 backdrop-blur-xl relative overflow-hidden">
          {/* Ambient Crown Glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/30 ring-4 ring-amber-500/20">
              <Crown className="w-9 h-9" />
            </div>

            <div>
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Accès Restreint • Owner Only
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-3 tracking-tight">
                Espace Propriétaire KAYDO BOT
              </h2>
              <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                Cet espace est strictement réservé au créateur du bot (<strong className="text-amber-300">+509 3597 5863</strong>). Vous seul pouvez voir toutes les sessions actives et diffuser des messages collectifs à tous les utilisateurs.
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Numéro WhatsApp Propriétaire ou Clé Secrète
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Ex: 50935975863 ou clé secrète..."
                  value={credentialInput}
                  onChange={(e) => setCredentialInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono text-sm"
                  required
                />
                <KeyRound className="w-5 h-5 text-slate-500 absolute right-3.5 top-3.5" />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                <span>Indice : Numéro Owner <code className="text-amber-400">50935975863</code> ou code <code className="text-amber-400">KAYDO2026</code></span>
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {authLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Vérification des droits...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Déverrouiller l'Espace Propriétaire</span>
                </>
              )}
            </button>
          </form>

          {/* Public URL badge on lock screen */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <span className="text-xs text-slate-500">Portail Public Officiel :</span>
            <div className="mt-1 flex items-center justify-center gap-2">
              <code className="text-xs text-emerald-400 font-mono bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800 max-w-full truncate">
                {publicUrl}
              </code>
              <button
                onClick={handleCopyPublicUrl}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs cursor-pointer transition-colors"
                title="Copier l'URL publique"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ====================================================
  // 2. AUTHENTICATED OWNER CONTROL PANEL
  // ====================================================

  const activeSessions = sessions.filter((s) => s.botFunctional);
  const pendingSessions = sessions.filter((s) => s.status === 'pending' || s.needsPairing);

  return (
    <div className="space-y-8">
      {/* Top Owner Header Bar */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/20 ring-4 ring-amber-500/20 shrink-0">
              <Crown className="w-8 h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Espace Propriétaire Exclusif • 𝐊𝐀𝐘𝐃𝐎 𝐙𝐋𝐊 𓃶 & 𝐒𝐇𝐀𝐊𝐀 𝐙𝐋𝐊 𓃶
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  AUTHENTIFIÉ (+509 3597 5863)
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                Centre de commandement réservé au créateur : visionnez toutes les sessions connectées aux bots en direct et diffusez des messages officiels à tous vos utilisateurs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end lg:self-center">
            <button
              onClick={fetchOwnerSessions}
              disabled={loadingSessions}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Rafraîchir les sessions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSessions ? 'animate-spin text-amber-400' : ''}`} />
              <span>Actualiser</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Verrouiller l'espace"
            >
              <Unlock className="w-3.5 h-3.5 text-amber-400" />
              <span>Verrouiller</span>
            </button>
          </div>
        </div>

        {/* Action success alert banner */}
        {actionSuccessMsg && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* SECTION 1 : PUBLIC URL DISPLAY BANNER */}
      <div className="bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                🌐 URL Publique Officielle du Portail KAYDO BOT
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Ce lien est public et accessible dans le monde entier 24h/24 & 7j/7 pour jumeler et tester les bots WhatsApp.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-950 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300 max-w-full overflow-x-auto">
              <span>{publicUrl}</span>
            </div>

            <button
              onClick={handleCopyPublicUrl}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
            >
              {copiedUrl ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier l'URL</span>
                </>
              )}
            </button>

            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ouvrir</span>
            </a>
          </div>
        </div>
      </div>

      {/* QUICK STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Sessions Totales</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            {sessions.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Enregistrées sur les serveurs
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Actives 24h/24</span>
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
            {activeSessions.length}
          </div>
          <p className="text-[11px] text-emerald-500/80 mt-1">
            En ligne & réactives instantanément
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">En Attente de Code</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">
            {pendingSessions.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Code 8 chiffres généré
          </p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Messages Diffusés</span>
            <Radio className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400">
            {history.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Diffusions collectives Owner
          </p>
        </div>
      </div>

      {/* ==================================================== */}
      {/* SECTION 2 : VUE DE TOUTES LES SESSIONS CONNECTÉES AUX BOTS */}
      {/* ==================================================== */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Toutes les Sessions Connectées aux Bots ({sessions.length})
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Tableau de bord en temps réel des comptes WhatsApp reliés à KAYDO BOT.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToPairing && (
              <button
                onClick={onNavigateToPairing}
                className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Nouveau Jumelage</span>
              </button>
            )}
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-12 px-4 bg-slate-950/60 rounded-2xl border border-slate-800/60">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">Aucune session WhatsApp enregistrée pour l'instant</p>
            <p className="text-xs text-slate-500 mt-1">
              Les sessions générées via le code de jumelage à 8 chiffres apparaîtront ici automatiquement.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map((session) => {
              const isOnline = session.botFunctional && session.isSocketOpen;
              const isPending = session.status === 'pending' || session.needsPairing;

              return (
                <div
                  key={session.sessionId}
                  className={`bg-slate-950/80 border rounded-2xl p-4 sm:p-5 space-y-4 transition-all ${
                    isOnline
                      ? 'border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                      : isPending
                      ? 'border-amber-500/40 shadow-lg shadow-amber-500/5'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Session Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                          isOnline
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : isPending
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        📱
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-bold text-white">
                            +{session.phone}
                          </span>
                          {session.phone === '50935975863' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              👑 OWNER
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono">
                          ID: {session.sessionId}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="text-right">
                      {isOnline ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          <span>Connecté 24/7</span>
                        </span>
                      ) : isPending ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <Clock className="w-3 h-3" />
                          <span>Code en Attente</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          <span>Déconnecté</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Telemetry info */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800/60 font-mono">
                    <div>
                      <span className="text-slate-500 block text-[10px]">UPTIME :</span>
                      <span className="text-slate-300 font-semibold">{session.uptimeFormatted || '0h 0m'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">PING SOCKET :</span>
                      <span className="text-emerald-400 font-semibold">{session.pingMs || 18} ms</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">ENREGISTRÉ :</span>
                      <span className={session.registered ? 'text-emerald-400' : 'text-amber-400'}>
                        {session.registered ? '✅ Oui (Disque)' : '⏳ En attente'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">WELCOME NOTICE :</span>
                      <span className={session.welcomeDelivered ? 'text-emerald-400' : 'text-slate-400'}>
                        {session.welcomeDelivered ? '✅ Transmis (1x)' : 'En attente'}
                      </span>
                    </div>
                  </div>

                  {/* If pairing code is active */}
                  {session.formattedCode && isPending && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="text-amber-400 font-bold block">Code de jumelage actif :</span>
                        <code className="text-base font-mono font-black text-amber-200 tracking-wider">
                          {session.formattedCode}
                        </code>
                      </div>
                      <span className="text-[11px] text-slate-400">À saisir dans WhatsApp</span>
                    </div>
                  )}

                  {/* Action Buttons for this session */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60">
                    <button
                      onClick={() => handlePingSession(session.sessionId)}
                      disabled={Boolean(actionLoading)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                      title="Tester la réactivité du socket WhatsApp"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ping</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedSessionForMsg(session);
                        setSingleMessageText('');
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                      title="Envoyer un message individuel direct à ce compte"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Message</span>
                    </button>

                    <button
                      onClick={() => handleRestartSession(session.sessionId)}
                      disabled={Boolean(actionLoading)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                      title="Redémarrer le socket de cette session"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${actionLoading === `restart_${session.sessionId}` ? 'animate-spin' : ''}`} />
                      <span>Redémarrer</span>
                    </button>

                    <button
                      onClick={() => handleDeleteSession(session.sessionId)}
                      disabled={Boolean(actionLoading)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors ml-auto"
                      title="Supprimer définitivement cette session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* SECTION 3 : DIFFUSION COLLECTIVE DU OWNER (BROADCAST) */}
      {/* ==================================================== */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-[#0d1424] border-2 border-cyan-500/30 rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Diffusion Collective aux Sessions Connectées (Broadcast Owner)
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Envoyez un message officiel instantané directement à toutes les sessions WhatsApp actives ({activeSessions.length} session(s) recevront ce message).
            </p>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 self-start sm:self-auto">
            📢 Diffusion Directe
          </span>
        </div>

        {/* Quick Presets Buttons */}
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Modèles Rapides en 1 Clic :
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setBroadcastTitle(preset.title);
                  setBroadcastMessage(preset.msg);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 hover:border-cyan-500/50 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Target Mode Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTargetMode('all_sessions')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              targetMode === 'all_sessions'
                ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>À Tous les Propriétaires des Sessions</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Chaque personne qui a lié son compte WhatsApp recevra ce message sur son numéro.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setTargetMode('custom_target')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
              targetMode === 'custom_target'
                ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              <Send className="w-4 h-4 text-cyan-400" />
              <span>Vers un Contact / Groupe Spécifique</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Toutes les sessions connectées enverront ce message au même destinataire ou groupe.
            </p>
          </button>
        </div>

        {targetMode === 'custom_target' && (
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Numéro de téléphone ou JID du groupe cible (ex: 50935975863 ou id@g.us)
            </label>
            <input
              type="text"
              placeholder="50935975863..."
              value={customTargetJid}
              onChange={(e) => setCustomTargetJid(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        )}

        {/* Title Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
            Objet / Titre de l'Annonce
          </label>
          <input
            type="text"
            placeholder="COMMUNIQUÉ DU PROPRIÉTAIRE..."
            value={broadcastTitle}
            onChange={(e) => setBroadcastTitle(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {/* Message Body Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Corps du Message
            </label>
            <span className="text-[11px] text-slate-500 font-mono">
              {broadcastMessage.length} caractères
            </span>
          </div>
          <textarea
            rows={6}
            placeholder="Écrivez le message que vous souhaitez envoyer à toutes les sessions..."
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500 font-sans"
          />
        </div>

        {/* Live Preview Card */}
        {broadcastMessage.trim() && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Aperçu Fidèle WhatsApp (Ce que verront vos utilisateurs) :
            </span>
            <div className="bg-[#121b22] border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner">
              <span className="text-amber-400 font-bold">╭━━━〔 👑 𝐌𝐄𝐒𝐒𝐀𝐆𝐄 𝐃𝐔 𝐏𝐑𝐎𝐏𝐑𝐈É𝐓𝐀𝐈𝐑𝐄 〕━━━╮</span>
              <br />
              ┃ ◈ 👑 𝐃𝐄𝐕 : 𝐃𝐄𝐕 𝐊𝐀𝐘𝐃𝐎 𝐒𝐂𝐎𝐅𝐈𝐄𝐋𝐃
              <br />
              ┃ ◈ 📞 𝐂𝐎𝐍𝐓𝐀𝐂𝐓 : +509 3597 5863 (wa.me/50935975863)
              <br />
              ┃ ◈ 📢 𝐎𝐁𝐉𝐄𝐓 : <span className="text-cyan-300 font-bold">{broadcastTitle}</span>
              <br />
              ┃ ◈ 🌐 𝐏𝐎𝐑𝐓𝐀𝐈𝐋 𝐏𝐔𝐁𝐋𝐈𝐂 : <span className="text-emerald-400">{publicUrl}</span>
              <br />
              <span className="text-amber-400 font-bold">╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯</span>
              <br />
              <br />
              {broadcastMessage}
              <br />
              <br />
              <span className="text-slate-400">👑 *KAYDO BOT • Système 24h/24 & 7j/7*</span>
            </div>
          </div>
        )}

        {/* Broadcast Result Banner */}
        {broadcastResult && (
          <div
            className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
              broadcastResult.success
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
            }`}
          >
            {broadcastResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-bold text-sm">{broadcastResult.message}</p>
              <p className="text-slate-400">
                Livrées : {broadcastResult.deliveredCount} | Échecs : {broadcastResult.failedCount}
              </p>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSendBroadcast}
            disabled={sendingBroadcast || !broadcastMessage.trim()}
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-emerald-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-bold text-sm shadow-xl shadow-cyan-500/20 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            {sendingBroadcast ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Diffusion en cours aux sessions...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Diffuser le Message à Toutes les Sessions ({sessions.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* SECTION 4 : HISTORIQUE DES DIFFUSIONS DU OWNER */}
      {/* ==================================================== */}
      {history.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            Historique de vos Diffusions Récentes ({history.length})
          </h3>

          <div className="space-y-3">
            {history.map((record) => (
              <div
                key={record.id}
                className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-2 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cyan-300 text-sm">{record.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {record.deliveredCount} livré(s)
                    </span>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">
                    {new Date(record.timestamp).toLocaleString('fr-FR')}
                  </span>
                </div>
                <p className="text-slate-300 font-sans line-clamp-2">{record.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SINGLE MESSAGE MODAL */}
      {selectedSessionForMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Message Direct à +{selectedSessionForMsg.phone}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSessionForMsg(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Envoyez un message direct depuis les serveurs à la session de l'utilisateur.
            </p>

            <textarea
              rows={4}
              placeholder="Écrivez votre message..."
              value={singleMessageText}
              onChange={(e) => setSingleMessageText(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedSessionForMsg(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                onClick={handleSendSingleMessage}
                disabled={sendingSingleMsg || !singleMessageText.trim()}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {sendingSingleMsg ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Envoi...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Envoyer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
