import React from 'react';
import { PairingSection } from '../components/PairingSection';
import { BotStats } from '../types';

interface PairPageProps {
  stats: BotStats | null;
  onNotificationTrigger?: () => void;
  onGoToSessions?: () => void;
  onGoToOwner?: () => void;
}

export const PairPage: React.FC<PairPageProps> = ({
  stats,
  onNotificationTrigger,
  onGoToSessions,
  onGoToOwner,
}) => {
  return (
    <div className="w-full space-y-6 pb-12 animate-in fade-in duration-200">
      <PairingSection
        onNotificationTrigger={onNotificationTrigger}
        onGoToSessions={onGoToSessions}
      />
    </div>
  );
};
