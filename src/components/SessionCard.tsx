import React from 'react';
import { PowerOff, RefreshCw, Zap, Shield, Smartphone } from 'lucide-react';
import { DetailedSessionInfo } from '../types';

interface SessionCardProps {
  session: DetailedSessionInfo;
  onDisconnect: (sessionId: string, phone: string) => void;
  onPing?: (sessionId: string) => void;
  onRestart?: (sessionId: string) => void;
  isActionLoading?: boolean;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onDisconnect,
  onPing,
  onRestart,
  isActionLoading,
}) => {
  const isOnline = session.isSocketOpen || session.status === 'paired';

  return (
    <div className="p-4 rounded-2xl bg-[#0c0d1b] border border-slate-800/90 shadow-md space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-center text-purple-300">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="font-mono text-sm font-bold text-white tracking-wide">
              +{session.phone || session.sessionId.replace(/^session_/, '')}
            </div>
            {session.customName && (
              <span className="text-[11px] text-purple-400 font-medium truncate block">
                {session.customName}
              </span>
            )}
          </div>
        </div>

        {/* Status Pill */}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider uppercase ${
            isOnline
              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400'
              : 'bg-rose-950/60 border border-rose-500/40 text-rose-400'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          {isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
        </span>
      </div>

      {/* Grid of metadata */}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-black/40 p-2.5 rounded-xl border border-slate-850">
        <div>
          <span className="text-slate-500 block text-[10px]">SERVEUR</span>
          <span className="text-slate-300 font-semibold">Cluster 01 (Cloud)</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">UPTIME</span>
          <span className="text-slate-300">{session.uptimeFormatted || 'Actif 24/7'}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">LATENCE</span>
          <span className="text-emerald-400">{session.pingMs || 22}ms</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">MODE BOT</span>
          <span className="text-purple-300 capitalize">{session.botMode || 'Privé'}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        {onPing && (
          <button
            type="button"
            onClick={() => onPing(session.sessionId)}
            disabled={isActionLoading}
            className="flex-1 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono flex items-center justify-center gap-1.5 transition-all"
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Ping</span>
          </button>
        )}

        {onRestart && (
          <button
            type="button"
            onClick={() => onRestart(session.sessionId)}
            disabled={isActionLoading}
            className="flex-1 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono flex items-center justify-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-3 h-3 text-cyan-400" />
            <span>Relancer</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onDisconnect(session.sessionId, session.phone)}
          disabled={isActionLoading}
          className="flex-1 py-1.5 px-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all"
        >
          <PowerOff className="w-3 h-3" />
          <span>Déconnecter</span>
        </button>
      </div>
    </div>
  );
};
