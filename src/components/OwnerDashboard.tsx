import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Send,
  RefreshCw,
  LogOut,
  PowerOff,
  Zap,
  Radio,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Server,
  Activity,
  Image as ImageIcon,
  Layers,
} from 'lucide-react';
import { DetailedSessionInfo, OwnerBroadcastRecord } from '../types';
import { StatsCard } from './StatsCard';
import { SessionTable } from './SessionTable';
import { CommandImagesManager } from './CommandImagesManager';
import { useTheme } from '../context/ThemeContext';

interface OwnerDashboardProps {
  ownerToken: string;
  onLogout: () => void;
  onNotificationTrigger?: () => void;
  onNavigateToPairing?: () => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  ownerToken,
  onLogout,
  onNotificationTrigger,
  onNavigateToPairing,
}) => {
  const { currentTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'sessions' | 'images' | 'broadcast'>('sessions');
  const [sessions, setSessions] = useState<DetailedSessionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('COMMUNIQUÉ DU CRÉATEUR');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [showBroadcastDrawer, setShowBroadcastDrawer] = useState(false);

  const showToast = (text: string, isError: boolean = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Fetch full sessions list from protected server endpoint
  const fetchOwnerSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/owner/sessions', {
        headers: {
          Authorization: `Bearer ${ownerToken}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        onLogout();
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur de chargement');
      }

      setSessions(data.sessions || []);
    } catch (err: any) {
      setError(err?.message || 'Impossible de charger les données privées.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOwnerSessions();
    const interval = setInterval(fetchOwnerSessions, 10000);
    return () => clearInterval(interval);
  }, [ownerToken]);

  // Disconnect session handler
  const handleDisconnect = async (sessionId: string, phone: string) => {
    if (!window.confirm(`Confirmez-vous la déconnexion et suppression de la session +${phone || sessionId} ?`)) {
      return;
    }

    setActionLoading(sessionId);
    try {
      const res = await fetch('/api/sessions/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({ sessionId, phone }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Session +${phone || sessionId} déconnectée avec succès.`);
        setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
        if (onNotificationTrigger) onNotificationTrigger();
      } else {
        throw new Error(data.error || data.message || 'Échec de la déconnexion');
      }
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la déconnexion.', true);
    } finally {
      setActionLoading(null);
    }
  };

  // Ping single session
  const handlePing = async (sessionId: string) => {
    setActionLoading(sessionId);
    try {
      const res = await fetch('/api/sessions/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Latence socket: ${data.pingMs}ms. Session réactive !`);
      } else {
        showToast(data.message || 'Échec du ping.', true);
      }
    } catch (e: any) {
      showToast('Erreur socket WhatsApp.', true);
    } finally {
      setActionLoading(null);
    }
  };

  // Restart single session
  const handleRestart = async (sessionId: string) => {
    setActionLoading(sessionId);
    try {
      const res = await fetch('/api/sessions/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Session ${sessionId} reconnectée avec succès !`);
        fetchOwnerSessions();
      } else {
        showToast(data.message || 'Erreur de redémarrage.', true);
      }
    } catch (e: any) {
      showToast('Erreur de communication.', true);
    } finally {
      setActionLoading(null);
    }
  };

  // Send Broadcast to all sessions
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    setSendingBroadcast(true);
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
          targetMode: 'all_sessions',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Diffusion transmise à ${data.deliveredCount} session(s) WhatsApp !`);
        setBroadcastMessage('');
        setShowBroadcastDrawer(false);
        if (onNotificationTrigger) onNotificationTrigger();
      } else {
        throw new Error(data.error || 'Erreur lors de la diffusion collective');
      }
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la diffusion.', true);
    } finally {
      setSendingBroadcast(false);
    }
  };

  const activeSessionsCount = sessions.filter((s) => s.botFunctional || s.isSocketOpen).length;
  const totalSessionsCount = sessions.length;

  return (
    <div className="space-y-6 pb-12">
      {/* Toast feedback */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl border text-xs font-mono font-semibold flex items-center gap-2 max-w-sm animate-in slide-in-from-top-2 ${
            toastMessage.isError
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
              : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
          }`}
        >
          {toastMessage.isError ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header : ≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿 / OWNER PANEL */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-[#0a0b16]/90 border border-slate-800/90 backdrop-blur-2xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold tracking-widest uppercase text-purple-400">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span>ACCÈS EXCLUSIF SÉCURISÉ</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white flex items-center gap-2">
            <span>≛⃝🥷🏿𝐊𝐀𝐘𝐃𝐎 𝐁𝐎𝐓 ≛⃝🥷🏿</span>
            <span className="text-slate-500 text-lg font-normal">/</span>
            <span style={{ color: currentTheme.colorHex }}>OWNER PANEL</span>
          </h1>
          <p className="text-xs text-slate-400">
            Connecté en tant que propriétaire vérifié • Portée complète sur l'infrastructure WhatsApp
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={fetchOwnerSessions}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Rafraîchir les sessions"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowBroadcastDrawer(!showBroadcastDrawer)}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/40 text-purple-300 font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Radio className="w-4 h-4" />
            <span>Diffuser une annonce</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="p-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-500/40 text-rose-400 hover:text-rose-200 transition-all cursor-pointer"
            title="Verrouiller et déconnecter"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 Cards: SESSIONS ACTIVES, TOTAL SESSIONS, SERVEURS, STATUT DU BOT */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 🟢 SESSIONS ACTIVES */}
        <StatsCard
          label="SESSIONS ACTIVES"
          value={activeSessionsCount}
          subValue="Connectées 24/7 au cluster"
          dotColor="green"
          icon={<Activity className="w-4 h-4 text-emerald-400" />}
        />

        {/* 🔵 TOTAL SESSIONS */}
        <StatsCard
          label="TOTAL SESSIONS"
          value={totalSessionsCount}
          subValue="Enregistrées dans la base"
          dotColor="blue"
          icon={<Server className="w-4 h-4 text-blue-400" />}
        />

        {/* 🟣 SERVEURS */}
        <StatsCard
          label="SERVEURS"
          value="3 ACTIFS"
          subValue="Portail 01 • Cloud 24/7"
          dotColor="purple"
          icon={<Zap className="w-4 h-4 text-purple-400" />}
        />

        {/* 🟠 STATUT DU BOT */}
        <StatsCard
          label="STATUT DU BOT"
          value="EN LIGNE"
          subValue="Garde autonome actif"
          dotColor="orange"
          icon={<ShieldAlert className="w-4 h-4 text-amber-400" />}
        />
      </div>

      {/* Tabs Selector Navigation */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#090b16] border border-slate-800/80 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'sessions'
              ? 'bg-purple-600/30 border border-purple-500/80 text-purple-200 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Sessions Connectées ({activeSessionsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('images')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'images'
              ? 'bg-purple-600/30 border border-purple-500/80 text-purple-200 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Images des Commandes Bot</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('broadcast')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer shrink-0 ${
            activeTab === 'broadcast'
              ? 'bg-purple-600/30 border border-purple-500/80 text-purple-200 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Diffusion Collective</span>
        </button>
      </div>

      {/* TAB CONTENT: Command Images Manager */}
      {activeTab === 'images' && (
        <div className="animate-in fade-in-50 duration-200">
          <CommandImagesManager />
        </div>
      )}

      {/* TAB CONTENT: Broadcast Section */}
      {activeTab === 'broadcast' && (
        <form
          onSubmit={handleSendBroadcast}
          className="p-6 rounded-3xl bg-[#0d0e1d] border border-purple-500/40 shadow-2xl space-y-4 animate-in fade-in-50 duration-200"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Radio className="w-5 h-5 text-purple-400" />
              <span>Diffusion Collective à TOUTES les Sessions WhatsApp</span>
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                Titre du message
              </label>
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="COMMUNIQUÉ DU CRÉATEUR"
                className="w-full bg-black/60 border border-slate-700 text-white font-mono text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                Texte de l'annonce à transmettre
              </label>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Écrivez le message officiel ici..."
                rows={4}
                className="w-full bg-black/60 border border-slate-700 text-white font-mono text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-500"
              />
            </div>

            <button
              type="submit"
              disabled={sendingBroadcast || !broadcastMessage.trim()}
              className="w-full py-3 rounded-xl font-bold font-mono text-xs sm:text-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {sendingBroadcast ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Envoi en cours à {totalSessionsCount} sessions...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Transmettre la diffusion officielle</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB CONTENT: Sessions List */}
      {activeTab === 'sessions' && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {/* Broadcast Quick Drawer */}
          {showBroadcastDrawer && (
            <form
              onSubmit={handleSendBroadcast}
              className="p-5 sm:p-6 rounded-3xl bg-[#0d0e1d] border border-purple-500/40 shadow-2xl space-y-4 animate-in slide-in-from-top-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-bold text-white font-mono flex items-center gap-2">
                  <Radio className="w-4 h-4 text-purple-400" />
                  <span>Diffusion Rapide aux Sessions</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowBroadcastDrawer(false)}
                  className="text-xs text-slate-500 hover:text-slate-300 font-mono"
                >
                  Fermer ✕
                </button>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="COMMUNIQUÉ DU CRÉATEUR"
                  className="w-full bg-black/60 border border-slate-700 text-white font-mono text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-500"
                />
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Écrivez le message officiel ici..."
                  rows={3}
                  className="w-full bg-black/60 border border-slate-700 text-white font-mono text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  disabled={sendingBroadcast || !broadcastMessage.trim()}
                  className="w-full py-3 rounded-xl font-bold font-mono text-xs sm:text-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>Diffuser</span>
                </button>
              </div>
            </form>
          )}

          {/* Main Section: Session Management Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-mono tracking-tight">
                  Liste des Sessions Connectées ({sessions.length})
                </h2>
              </div>

              {onNavigateToPairing && (
                <button
                  type="button"
                  onClick={onNavigateToPairing}
                  className="text-xs font-mono text-purple-400 hover:text-purple-300 font-semibold"
                >
                  + Jumeler un nouveau compte
                </button>
              )}
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <SessionTable
              sessions={sessions}
              onDisconnect={handleDisconnect}
              onPing={handlePing}
              onRestart={handleRestart}
              actionLoading={actionLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
};
