import React from 'react';
import { PowerOff, Zap, RefreshCw, Smartphone, ShieldCheck } from 'lucide-react';
import { DetailedSessionInfo } from '../types';
import { SessionCard } from './SessionCard';

interface SessionTableProps {
  sessions: DetailedSessionInfo[];
  onDisconnect: (sessionId: string, phone: string) => void;
  onPing?: (sessionId: string) => void;
  onRestart?: (sessionId: string) => void;
  actionLoading?: string | null;
}

export const SessionTable: React.FC<SessionTableProps> = ({
  sessions,
  onDisconnect,
  onPing,
  onRestart,
  actionLoading,
}) => {
  if (sessions.length === 0) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[#0c0d1b] border border-slate-800 text-slate-400 space-y-2">
        <Smartphone className="w-8 h-8 text-slate-600 mx-auto" />
        <p className="text-sm font-medium">Aucune session active enregistrée pour le moment.</p>
        <p className="text-xs text-slate-500">
          Les sessions jumelées via le portail apparaîtront ici avec toutes leurs données télémétriques.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Mobile Card List View (Visible on small screens < md to prevent any horizontal overflow on Android) */}
      <div className="block md:hidden space-y-3">
        {sessions.map((s) => (
          <SessionCard
            key={s.sessionId}
            session={s}
            onDisconnect={onDisconnect}
            onPing={onPing}
            onRestart={onRestart}
            isActionLoading={actionLoading === s.sessionId}
          />
        ))}
      </div>

      {/* Desktop Table View (Visible on md and up) */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-800 bg-[#0c0d1b]/90 backdrop-blur-xl shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#121324] border-b border-slate-800 text-slate-400 text-[10px] tracking-wider uppercase">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Numéro</th>
                <th className="py-3.5 px-4 font-semibold">Serveur</th>
                <th className="py-3.5 px-4 font-semibold">Statut</th>
                <th className="py-3.5 px-4 font-semibold">Connexion</th>
                <th className="py-3.5 px-4 font-semibold">Dernière activité</th>
                <th className="py-3.5 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {sessions.map((session) => {
                const isOnline = session.isSocketOpen || session.status === 'paired';
                const isLoadingThis = actionLoading === session.sessionId;

                return (
                  <tr key={session.sessionId} className="hover:bg-purple-950/15 transition-colors">
                    {/* Numéro */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                        <div>
                          <span className="font-bold text-white tracking-wide">
                            +{session.phone || session.sessionId.replace(/^session_/, '')}
                          </span>
                          {session.customName && (
                            <span className="text-[10px] text-purple-400 block font-normal">
                              {session.customName}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Serveur */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-400">
                      <span>Portail 01 (Cloud)</span>
                    </td>

                    {/* Statut */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                          isOnline
                            ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400'
                            : 'bg-rose-950/60 border border-rose-500/40 text-rose-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOnline ? 'bg-emerald-400' : 'bg-rose-400'
                          }`}
                        />
                        {isOnline ? 'ACTIF 24/7' : 'HORS LIGNE'}
                      </span>
                    </td>

                    {/* Connexion */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <span className="text-slate-300">
                          {session.uptimeFormatted || 'En ligne'}
                        </span>
                        <span className="text-[10px] text-emerald-400 block">
                          Latence: {session.pingMs || 22}ms
                        </span>
                      </div>
                    </td>

                    {/* Dernière activité */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                      {new Date(session.lastHeartbeat || Date.now()).toLocaleTimeString('fr-FR')}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {onPing && (
                          <button
                            type="button"
                            onClick={() => onPing(session.sessionId)}
                            disabled={isLoadingThis}
                            title="Tester le ping en direct"
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                          </button>
                        )}

                        {onRestart && (
                          <button
                            type="button"
                            onClick={() => onRestart(session.sessionId)}
                            disabled={isLoadingThis}
                            title="Redémarrer la session"
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onDisconnect(session.sessionId, session.phone)}
                          disabled={isLoadingThis}
                          title="Déconnecter cette session"
                          className="py-1 px-2.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 hover:text-white font-semibold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <PowerOff className="w-3 h-3" />
                          <span>Déconnecter</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
