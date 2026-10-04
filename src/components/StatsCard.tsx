import React from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  dotColor: 'green' | 'blue' | 'purple' | 'orange';
  icon?: React.ReactNode;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  subValue,
  dotColor,
  icon,
}) => {
  const colorMap = {
    green: {
      border: 'border-emerald-500/30',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.12)]',
      bg: 'bg-emerald-950/20',
      dot: 'bg-emerald-400',
      dotRing: 'border-emerald-500/50',
      text: 'text-emerald-400',
    },
    blue: {
      border: 'border-blue-500/30',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.12)]',
      bg: 'bg-blue-950/20',
      dot: 'bg-blue-400',
      dotRing: 'border-blue-500/50',
      text: 'text-blue-400',
    },
    purple: {
      border: 'border-purple-500/30',
      glow: 'shadow-[0_0_20px_rgba(168,85,247,0.12)]',
      bg: 'bg-purple-950/20',
      dot: 'bg-purple-400',
      dotRing: 'border-purple-500/50',
      text: 'text-purple-400',
    },
    orange: {
      border: 'border-amber-500/30',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.12)]',
      bg: 'bg-amber-950/20',
      dot: 'bg-amber-400',
      dotRing: 'border-amber-500/50',
      text: 'text-amber-400',
    },
  };

  const scheme = colorMap[dotColor];

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl bg-[#0c0d1a]/90 backdrop-blur-xl border ${scheme.border} ${scheme.glow} flex flex-col justify-between transition-all`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${scheme.dot} shadow-[0_0_8px_currentColor]`} />
          <span className="text-[11px] sm:text-xs font-bold tracking-wider text-slate-400 uppercase font-mono">
            {label}
          </span>
        </div>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>

      <div className="mt-3">
        <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${scheme.text} tabular-nums`}>
          {value}
        </div>
        {subValue && (
          <p className="text-[11px] text-slate-400 mt-1 font-mono truncate">
            {subValue}
          </p>
        )}
      </div>
    </div>
  );
};
