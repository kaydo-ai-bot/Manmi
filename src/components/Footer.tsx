import React from 'react';
import { ShieldCheck, ExternalLink } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface FooterProps {
  activeSessionsCount?: number;
}

export const Footer: React.FC<FooterProps> = ({ activeSessionsCount = 0 }) => {
  const { currentTheme } = useTheme();

  return (
    <footer className="mt-auto border-t border-slate-900 bg-[#04050a] py-8 text-center">
      <div className="max-w-4xl mx-auto px-4 space-y-4">
        {/* Dynamic Connected Sessions Indicator */}
        <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span>{activeSessionsCount} SESSIONS CONNECTÉES</span>
        </div>

        {/* Brand & Owner Signature */}
        <div className="space-y-1">
          <div className="text-sm font-black font-mono tracking-wider text-white uppercase">
            𝑲𝑨𝒀𝑫𝑶 𝑩𝒁𝑲 🥷
          </div>
          <p className="text-xs font-mono tracking-widest text-slate-400 uppercase">
            &quot;CREATED FOR ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿 & 𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸&quot;
          </p>
        </div>

        {/* Sub details */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] font-mono text-slate-600">
          <span className="flex items-center gap-1 text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/80" />
            <span>Chiffrement E2EE • Baileys Signal Protocol</span>
          </span>
          <span>•</span>
          <span className="text-slate-500">
            © 𝐊𝐀𝐘𝐃𝐎 𝐃𝐄𝐕 𓃶 • Déploiement 24/7
          </span>
        </div>
      </div>
    </footer>
  );
};
