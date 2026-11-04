import React from 'react';
import { PairingCard } from '../components/PairingCard';
import { StatusBadge } from '../components/StatusBadge';
import { BotStats } from '../types';
import { Shield, Smartphone, Zap, Sparkles } from 'lucide-react';

interface PairPageProps {
  stats: BotStats | null;
  onNotificationTrigger?: () => void;
  onGoToSessions?: () => void;
  onGoToOwner?: () => void;
}

export const PairPage: React.FC<PairPageProps> = ({
  stats,
  onNotificationTrigger,
  onGoToOwner,
}) => {
  return (
    <div className="w-full flex flex-col items-center justify-center py-2 sm:py-6 pb-16 animate-in fade-in duration-300">
      {/* Top Floating Status Indicator matching Screenshot */}
      <div className="mb-4 sm:mb-6">
        <StatusBadge
          status="ONLINE"
          isSocketOpen={stats?.status === 'ONLINE' || true}
        />
      </div>

      {/* Main Pairing Portal Card (Mirroring Screenshot Layout & Colors) */}
      <div className="w-full flex justify-center">
        <PairingCard
          onNotificationTrigger={onNotificationTrigger}
          onGoToOwner={onGoToOwner}
          activeSessionsCount={stats?.activeSessionsCount || 0}
        />
      </div>

      {/* Subtle feature pills below the fold */}
      <div className="mt-8 max-w-xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-2.5 px-4 text-center">
        <div className="p-3 rounded-2xl bg-[#090a18]/70 border border-purple-900/30 text-slate-400 text-xs flex items-center justify-center gap-2">
          <Shield className="w-4 h-4 text-purple-400 shrink-0" />
          <span>Chiffrement E2EE Signal</span>
        </div>
        <div className="p-3 rounded-2xl bg-[#090a18]/70 border border-purple-900/30 text-slate-400 text-xs flex items-center justify-center gap-2">
          <Zap className="w-4 h-4 text-amber-400 shrink-0" />
          <span>300+ Commandes Actives</span>
        </div>
        <div className="p-3 rounded-2xl bg-[#090a18]/70 border border-purple-900/30 text-slate-400 text-xs flex items-center justify-center gap-2">
          <Smartphone className="w-4 h-4 text-blue-400 shrink-0" />
          <span>Android & iOS Prêt</span>
        </div>
      </div>
    </div>
  );
};
