import React, { useState, useEffect } from 'react';
import {
  Send,
  AlertTriangle,
  ShieldAlert,
  Smartphone,
  CheckCircle,
  Activity,
  Cpu,
  Clock,
  Radio,
  RefreshCw,
  Terminal,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { BotStats, DetailedSessionInfo, SystemEventLog } from '../types';

import { getMySessionIds, saveMySession } from '../utils/userSessions';

interface DashboardPageProps {
  stats: BotStats | null;
  onRefresh: () => void;
  onNavigateToConnection: () => void;
  onNavigateToLogs: () => void;
  onNavigateToSettings: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  stats,
  onRefresh,
  onNavigateToConnection,
  onNavigateToLogs,
  onNavigateToSettings,
}) => {
  const [sessions, setSessions] = useState<DetailedSessionInfo[]>([]);
  const [recentLogs, setRecentLogs] = useState<SystemEventLog[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setIsLoadingSessions(true);
    try {
      const myIds = getMySessionIds().join(',');
      const token = sessionStorage.getItem('kaydo_owner_token') || '';
      const [sessRes, logsRes] = await Promise.all([
        fetch(`/api/sessions/list?ids=${encodeURIComponent(myIds)}&all=true`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
        fetch('/api/bot/logs?limit=8'),
      ]);

      if (sessRes.ok) {
        const sessData = await sessRes.json();
        if (Array.isArray(sessData.sessions)) {
          setSessions(sessData.sessions);
        }
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        if (Array.isArray(logsData.logs)) {
          setRecentLogs(logsData.logs);
        }
      }
    } catch (e) {
      console.warn('Erreur chargement sessions dashboard:', e);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleRestartSession = async (sessionId: string) => {
    try {
      setActionMessage(`Redémarrage de la session ${sessionId}...`);
      const res = await fetch('/api/sessions/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      setActionMessage(data.message || 'Session redémarrée avec succès.');
      fetchDashboardData();
      onRefresh();
    } catch (err: any) {
      setActionMessage(`Échec du redémarrage: ${err.message}`);
    }
  };

  const metrics = stats?.metrics;
  const isCircuitBreaker = metrics?.isCircuitBreakerActive;

  return (
    <div className="space-y-6">
      {/* Action Notification Toast */}
      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-[#3478F6]/15 border border-[#3478F6]/30 text-xs sm:text-sm text-[#F5F7FF] flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#16D9E8]" />
            <span>{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs text-[#8E9EB5] hover:text-white underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Circuit Breaker Warning Banner if active */}
      {isCircuitBreaker && (
        <div className="p-4 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#F5F7FF] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-[#EF4444] shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-white">Circuit Breaker de Sécurité Activé</h4>
              <p className="text-xs text-[#8E9EB5]">
                Une restriction WhatsApp (429 ou 403) a été détectée. Le bot a suspendu temporairement les envois pour protéger votre numéro contre tout bannissement.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToSettings}
            className="px-3 py-1.5 rounded-xl bg-[#EF4444]/20 hover:bg-[#EF4444]/30 text-[#EF4444] text-xs font-semibold border border-[#EF4444]/30 whitespace-nowrap"
          >
            Vérifier Paramètres
          </button>
        </div>
      )}

      {/* KPI 6-Grid: Real Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. Messages Envoyés */}
        <div className="glass-card glass-card-hover p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[#8E9EB5] mb-2">
            <span>Envoyés</span>
            <div className="w-7 h-7 rounded-lg bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
              <Send className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#F5F7FF] font-mono tabular-nums">
            {metrics?.messagesSent || 0}
          </div>
          <div className="text-[11px] text-[#10B981] mt-1 flex items-center gap-1">
            <span>●</span> Transmis avec succès
          </div>
        </div>

        {/* 2. Messages Échoués */}
        <div className="glass-card glass-card-hover p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[#8E9EB5] mb-2">
            <span>Échecs</span>
            <div className="w-7 h-7 rounded-lg bg-[#EF4444]/15 text-[#EF4444] flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#F5F7FF] font-mono tabular-nums">
            {metrics?.messagesFailed || 0}
          </div>
          <div className="text-[11px] text-[#8E9EB5] mt-1">
            Erreurs d'envoi isolées
          </div>
        </div>

        {/* 3. Messages Bloqués Anti-Spam */}
        <div className="glass-card glass-card-hover p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[#8E9EB5] mb-2">
            <span>Anti-Spam</span>
            <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B] flex items-center justify-center">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#F5F7FF] font-mono tabular-nums">
            {metrics?.messagesBlocked || 0}
          </div>
          <div className="text-[11px] text-[#F59E0B] mt-1">
            Spams & Doublons bloqués
          </div>
        </div>

        {/* 4. Sessions Connectées */}
        <div className="glass-card glass-card-hover p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[#8E9EB5] mb-2">
            <span>Sessions</span>
            <div className="w-7 h-7 rounded-lg bg-[#3478F6]/15 text-[#3478F6] flex items-center justify-center">
              <Smartphone className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#F5F7FF] font-mono tabular-nums">
            {stats?.activeSessionsCount || 0}
          </div>
          <div className="text-[11px] text-[#16D9E8] mt-1 flex items-center gap-1">
            <Radio className="w-2.5 h-2.5 animate-pulse" /> Actives 24/7
          </div>
        </div>

        {/* 5. Erreurs Détectées */}
        <div className="glass-card glass-card-hover p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[#8E9EB5] mb-2">
            <span>Erreurs</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#F5F7FF] font-mono tabular-nums">
            {metrics?.errorsDetected || 0}
          </div>
          <div className="text-[11px] text-[#8E9EB5] mt-1">
            Capturées & gérées
          </div>
        </div>

        {/* 6. Santé Globale */}
        <div className="glass-card glass-card-hover p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[#8E9EB5] mb-2">
            <span>Santé</span>
            <div className="w-7 h-7 rounded-lg bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold text-[#10B981]">
            {isCircuitBreaker ? 'PAUSE' : metrics?.systemHealth || 'EXCELLENT'}
          </div>
          <div className="text-[11px] text-[#8E9EB5] mt-1">
            {metrics?.optOutCount || 0} désinscrit(s)
          </div>
        </div>
      </div>

      {/* Main Row: Bot Status Card + Realtime Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Bot Status & System Specs (1 col) */}
        <div className="glass-card p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#3478F6]/10">
            <h3 className="text-sm font-bold text-[#F5F7FF] flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#16D9E8]" />
              <span>État Général du Bot</span>
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-semibold">
              Opérationnel
            </span>
          </div>

          {/* Key Indicators */}
          <div className="space-y-3 text-xs">
            {/* Uptime */}
            <div className="p-3 rounded-xl bg-[#080F1F]/60 border border-[#3478F6]/10">
              <div className="flex items-center justify-between text-[#8E9EB5] mb-1">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#3478F6]" />
                  Temps d'Activité (Uptime)
                </span>
                <span className="text-[#10B981] font-semibold">24/7 Live</span>
              </div>
              <div className="text-sm font-bold text-[#F5F7FF] font-mono">
                {stats?.uptimeDHM || stats?.uptime || '0 Jour / 0 Heure / 0 Minute'}
              </div>
            </div>

            {/* Memory RAM */}
            <div className="p-3 rounded-xl bg-[#080F1F]/60 border border-[#3478F6]/10">
              <div className="flex items-center justify-between text-[#8E9EB5] mb-1">
                <span>Mémoire RAM Allouée</span>
                <span className="font-mono text-[#F5F7FF]">{stats?.memory || '180 MB'} / {stats?.totalMemory || '16384 MB'}</span>
              </div>
              <div className="w-full bg-[#111C32] rounded-full h-1.5 overflow-hidden">
                <div className="bg-gradient-to-r from-[#3478F6] to-[#16D9E8] h-1.5 rounded-full w-[4%]" />
              </div>
            </div>

            {/* Configurations */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-[#080F1F]/40 border border-[#3478F6]/10">
                <span className="text-[11px] text-[#8E9EB5] block">Mode Actif</span>
                <span className="font-semibold text-[#16D9E8] text-xs">
                  {stats?.botMode?.toUpperCase() || 'PUBLIC 🟢'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#080F1F]/40 border border-[#3478F6]/10">
                <span className="text-[11px] text-[#8E9EB5] block">Préfixe Actuel</span>
                <span className="font-mono font-bold text-white text-xs">{stats?.prefix || '.'}</span>
              </div>
            </div>

            {/* Watchdog Status */}
            <div className="p-3 rounded-xl bg-[#080F1F]/60 border border-[#3478F6]/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-[#F5F7FF] block">Watchdog Anti-Coupure</span>
                <span className="text-[11px] text-[#8E9EB5]">Auto-Restart actif (&lt; 2 min)</span>
              </div>
              <span className="text-[11px] font-semibold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full border border-[#10B981]/25">
                Surveillance 24/7
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Sessions Overview & Management (2 cols) */}
        <div className="glass-card p-5 rounded-2xl lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#3478F6]/10">
            <div>
              <h3 className="text-sm font-bold text-[#F5F7FF] flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#3478F6]" />
                <span>Sessions WhatsApp Actives</span>
              </h3>
              <p className="text-xs text-[#8E9EB5]">Comptes WhatsApp actuellement synchronisés</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchDashboardData}
                disabled={isLoadingSessions}
                className="p-1.5 rounded-lg text-[#8E9EB5] hover:text-white hover:bg-white/5 border border-[#3478F6]/15"
                title="Actualiser les sessions"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSessions ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onNavigateToConnection}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#3478F6]/15 text-[#16D9E8] border border-[#16D9E8]/30 hover:bg-[#3478F6]/25 transition-all flex items-center gap-1.5"
              >
                <span>Nouvelle Session</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Prominent New Session Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#3478F6]/20 via-[#111C32] to-[#16D9E8]/20 border border-[#16D9E8]/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shadow-[#3478F6]/10">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-[#3478F6]/20 text-[#16D9E8] flex items-center justify-center shrink-0 mx-auto sm:mx-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Créer ou Lier une Nouvelle Session WhatsApp</h4>
                <p className="text-xs text-[#8E9EB5]">Connectez un autre numéro instantanément avec le code de pairage (Pair Code).</p>
              </div>
            </div>
            <button
              onClick={onNavigateToConnection}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#3478F6] to-[#16D9E8] text-white text-xs font-bold shadow-md shadow-[#3478F6]/30 hover:brightness-110 active:scale-98 transition-all whitespace-nowrap w-full sm:w-auto text-center"
            >
              + Nouvelle Session WhatsApp
            </button>
          </div>

          {/* Session Cards or Empty */}
          {sessions.length === 0 ? (
            <div className="py-8 px-4 text-center space-y-4 bg-[#080F1F]/60 rounded-2xl border border-[#3478F6]/20">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3478F6] to-[#16D9E8] text-white mx-auto flex items-center justify-center shadow-lg shadow-[#3478F6]/30 animate-pulse">
                <Smartphone className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-base font-bold text-white">Aucun Numéro Connecté pour le Moment</h4>
                <p className="text-xs text-[#8E9EB5]">
                  Suivez ces 3 étapes simples pour lier votre WhatsApp et obtenir votre code de liaison :
                </p>
              </div>

              {/* Steps Guide */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-left max-w-xl mx-auto text-xs text-[#8E9EB5]">
                <div className="p-3 rounded-xl bg-[#111C32] border border-[#3478F6]/15 space-y-1">
                  <span className="font-bold text-[#16D9E8] block">Étape 1</span>
                  Cliquez sur le bouton ci-dessous pour ouvrir l'écran de liaison.
                </div>
                <div className="p-3 rounded-xl bg-[#111C32] border border-[#3478F6]/15 space-y-1">
                  <span className="font-bold text-[#16D9E8] block">Étape 2</span>
                  Entrez votre numéro WhatsApp (indicatif + numéro).
                </div>
                <div className="p-3 rounded-xl bg-[#111C32] border border-[#3478F6]/15 space-y-1">
                  <span className="font-bold text-[#16D9E8] block">Étape 3</span>
                  Copiez le code à 8 chiffres et entrez-le dans WhatsApp.
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onNavigateToConnection}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#3478F6] via-[#1e58c8] to-[#16D9E8] text-white text-sm font-bold shadow-xl shadow-[#3478F6]/40 hover:brightness-110 active:scale-98 transition-all flex items-center gap-2 mx-auto"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>📲 Entrer mon Numéro & Obtenir mon Code</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sessions.map((sess) => {
                const isOnline = sess.isSocketOpen || sess.status === 'paired';

                return (
                  <div
                    key={sess.sessionId}
                    className="p-3.5 rounded-xl bg-[#080F1F]/70 border border-[#3478F6]/15 flex items-center justify-between gap-3 hover:border-[#16D9E8]/30 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isOnline
                            ? 'bg-[#10B981]/15 text-[#10B981]'
                            : 'bg-[#EF4444]/15 text-[#EF4444]'
                        }`}
                      >
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-[#F5F7FF] truncate">
                            +{sess.phone}
                          </span>
                          {sess.customName && (
                            <span className="text-[10px] text-[#8E9EB5] bg-[#111C32] px-1.5 py-0.5 rounded border border-white/5 truncate">
                              {sess.customName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#8E9EB5]">
                          <span
                            className={`flex items-center gap-1 ${
                              isOnline ? 'text-[#10B981]' : 'text-[#EF4444]'
                            }`}
                          >
                            ● {isOnline ? 'En ligne' : sess.status}
                          </span>
                          <span>•</span>
                          <span className="font-mono">{sess.uptimeFormatted || '0m'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRestartSession(sess.sessionId)}
                        className="px-2.5 py-1 rounded-lg bg-[#111C32] hover:bg-white/10 text-[#8E9EB5] hover:text-white text-xs border border-[#3478F6]/20 transition-colors"
                      >
                        Redémarrer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Real-time Activity Logs (Recent 8 entries) */}
      <div className="glass-card p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#3478F6]/10">
          <div>
            <h3 className="text-sm font-bold text-[#F5F7FF] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#16D9E8]" />
              <span>Activité Récente & Sécurité Anti-Spam</span>
            </h3>
            <p className="text-xs text-[#8E9EB5]">Événements et contrôles en temps réel</p>
          </div>
          <button
            onClick={onNavigateToLogs}
            className="text-xs font-semibold text-[#16D9E8] hover:underline flex items-center gap-1"
          >
            <span>Voir tous les logs</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#8E9EB5]">
            Aucun événement récent enregistré. Le système tourne en régime nominal.
          </div>
        ) : (
          <div className="space-y-2">
            {recentLogs.map((log) => {
              const isError = log.level === 'error';
              const isWarn = log.level === 'warn';
              const isSpam = log.level === 'spam_blocked';
              const isSuccess = log.level === 'success';

              const badgeColor = isError
                ? 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30'
                : isSpam
                ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30'
                : isWarn
                ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30'
                : isSuccess
                ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                : 'bg-[#3478F6]/15 text-[#16D9E8] border-[#16D9E8]/30';

              return (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-[#080F1F]/60 border border-[#3478F6]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border shrink-0 ${badgeColor}`}
                    >
                      {log.category}
                    </span>
                    <span className="text-[#F5F7FF] truncate font-medium">{log.message}</span>
                  </div>

                  <div className="flex items-center gap-3 text-[#8E9EB5] shrink-0 text-[11px] font-mono">
                    {log.target && <span className="text-[#16D9E8]">+{log.target}</span>}
                    <span>{new Date(log.timestamp).toLocaleTimeString('fr-FR')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
