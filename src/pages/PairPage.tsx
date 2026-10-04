import React from 'react';
import { PairingCard } from '../components/PairingCard';
import { StatusBadge } from '../components/StatusBadge';
import { ThemeSelector } from '../components/ThemeSelector';
import { BotStats } from '../types';

interface PairPageProps {
  stats: BotStats | null;
  onNotificationTrigger?: () => void;
  onGoToOwner?: () => void;
}

export const PairPage: React.FC<PairPageProps> = ({
  stats,
  onNotificationTrigger,
  onGoToOwner,
}) => {
  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[calc(100vh-160px)] px-3 py-6 sm:py-10">
      {/* Top Floating Status Indicator (matching screenshot) */}
      <div className="w-full max-w-[430px] flex justify-end mb-4 pr-1">
        <StatusBadge status="ONLINE" isSocketOpen={stats?.status === 'ONLINE' || true} />
      </div>

      {/* Main Centered Pairing Card */}
      <PairingCard
        onNotificationTrigger={onNotificationTrigger}
        onGoToOwner={onGoToOwner}
        activeSessionsCount={stats?.activeSessionsCount || 0}
      />

      {/* Bottom Floating Control Bar (Theme Selector on left, Action icon on right) */}
      <div className="w-full max-w-[430px] flex items-center justify-between mt-6 px-1">
        {/* Left: Theme color circles (Cyan, Purple, Orange, Green) */}
        <ThemeSelector />

        {/* Right: Quick action / audio indicator */}
        <button
          type="button"
          onClick={onGoToOwner}
          className="w-10 h-10 rounded-full bg-[#0d0d18]/90 border border-slate-850 flex items-center justify-center text-purple-400 hover:text-white hover:border-purple-500/50 transition-all shadow-lg active:scale-95 cursor-pointer"
          title="Accès rapide Propriétaire (Owner)"
        >
          <span className="font-mono text-sm font-bold">𓃶</span>
        </button>
      </div>
    </div>
  );
};
