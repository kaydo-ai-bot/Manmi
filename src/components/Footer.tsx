import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { BOT_NAME, BOT_OWNER, BOT_DEV_MOTTO } from '../utils/branding';

interface FooterProps {
  activeSessionsCount?: number;
}

export const Footer: React.FC<FooterProps> = ({ activeSessionsCount = 0 }) => {
  const { currentTheme } = useTheme();

  return (
    <footer className="mt-auto border-t border-purple-950/40 bg-[#05050b] py-8 text-center">
      <div className="max-w-4xl mx-auto px-4 space-y-3.5">
        {/* Dynamic Connected Sessions Indicator */}
        <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span>{activeSessionsCount} SESSIONS ACTIVES</span>
        </div>

        {/* Brand & Owner Signature */}
        <div className="space-y-1">
          <div className="text-base font-black font-mono tracking-wider text-white uppercase flex items-center justify-center gap-2">
            <span>{BOT_NAME}</span>
            <span className="text-purple-400 text-sm">𓃶</span>
          </div>
          <p className="text-xs font-mono tracking-widest text-purple-300/70 uppercase">
            &quot;OFFICIAL WHATSAPP MULTI-DEVICE CLOUD SYSTEM&quot;
          </p>
        </div>

        {/* Sub details */}
        <div className="pt-1 flex flex-wrap items-center justify-center gap-3 text-[11px] font-mono text-slate-500">
          <span className="flex items-center gap-1 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80" />
            <span>Protocole Signal E2EE Chiffré</span>
          </span>
          <span>•</span>
          <span className="text-slate-400">
            © {BOT_OWNER} 𓃶 • Déploiement 24/7
          </span>
        </div>
      </div>
    </footer>
  );
};
