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
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase backdrop-blur-md transition-all ${
        isSocketOpen
          ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
          : 'bg-rose-950/60 border border-rose-500/40 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
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
