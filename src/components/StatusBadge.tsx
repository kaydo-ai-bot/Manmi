import React from 'react';

interface StatusBadgeProps {
  status?: string;
  isSocketOpen?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'ONLINE',
  isSocketOpen = true,
  className = '',
}) => {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold tracking-wider uppercase backdrop-blur-md transition-all ${
        isSocketOpen
          ? 'bg-[#061613]/90 border border-emerald-500/50 text-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.3)]'
          : 'bg-[#18090d]/90 border border-rose-500/50 text-rose-400 shadow-[0_0_18px_rgba(244,63,94,0.25)]'
      } ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            isSocketOpen ? 'bg-emerald-400' : 'bg-rose-400'
          }`}
        />
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isSocketOpen ? 'bg-emerald-400' : 'bg-rose-400'
          }`}
        />
      </span>
      <span>{status}</span>
    </div>
  );
};
