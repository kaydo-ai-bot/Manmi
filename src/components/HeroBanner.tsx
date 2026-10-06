import React, { useState } from 'react';
import { Copy, Check, Terminal, ExternalLink, ShieldCheck, Cpu, HardDrive, Clock, Sparkles } from 'lucide-react';
import { BotStats } from '../types';
import { BOT_HEADER_ASCII } from '../data/commands';

interface HeroBannerProps {
  stats: BotStats | null;
  onQuickTest: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ stats, onQuickTest }) => {
  const [copied, setCopied] = useState(false);

  const dynamicAscii = stats
    ? `*╭─━━━━━━━━━━━━━━━⊷❖*
*┇*✦╭───────────────╮
*┋✦┋. ʙᴏᴛ ɴᴀᴍᴇ:* 𝑲𝑨𝒀𝑫𝑶 𝑩𝒁𝑲 🥷
*┋✦┋. ᴏᴡɴᴇʀ:* ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿 & 𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸
*┋✦┋. ᴘʟᴀᴛғᴏʀᴍ:* Railway / Cloud
*┋✦┋. ᴍᴏᴅᴇ:* ${stats.status === 'ONLINE' ? 'ᴘᴜʙʟɪᴄ 🟢' : 'ᴘʀɪᴠᴇ́ 🔒'}
*┋✦┋. ᴜᴘᴛɪᴍᴇ:* ${stats.uptime || '24/7'}
*┋✦┋. ᴘʀᴇғɪx:* [ ${stats.prefix || '.'} ]
*┋✦┋. ʀᴀᴍ:* ${stats.memory} / ${stats.totalMemory}
*┇✦╰───────────────╯*
*╰━━━━━━━━━━━━━━━━━❖*`
    : BOT_HEADER_ASCII;

  const handleCopy = () => {
    navigator.clipboard.writeText(dynamicAscii);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-[#0c121e]/90 border border-emerald-500/20 shadow-2xl p-4 sm:p-6 mb-8">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        {/* Top Header Row */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-5">
          <div className="flex items-center space-x-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-mono tracking-wider uppercase text-emerald-400 font-semibold">
              𝐙𝐋𝐊 𝐁𝐎𝐓 𓃶 • 2026
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Signal Protocol v3
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
              Autonomie 24/7
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold flex items-center gap-1">
              <span>⚡</span> Vitesse 0.0s Instantané
            </span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              id="btn-copy-ascii-header"
              onClick={handleCopy}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'Copié !' : 'Copier Bannière ASCII'}</span>
            </button>

            <button
              id="btn-quick-ping-test"
              onClick={onQuickTest}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-xs font-medium text-emerald-300 hover:text-emerald-200 transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tester .ping</span>
            </button>
          </div>
        </div>

        {/* Live ASCII Display Box */}
        <div className="relative group rounded-xl bg-[#070a10] border border-slate-800 p-3 sm:p-4 overflow-x-auto">
          <pre className="font-mono text-[11px] sm:text-[13px] leading-relaxed text-emerald-400 whitespace-pre select-all">
            {dynamicAscii}
          </pre>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Uptime Réel</p>
              <p className="text-xs sm:text-sm font-bold font-mono text-white">{stats?.uptime || '0h 57m 0s'}</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Mémoire Active</p>
              <p className="text-xs sm:text-sm font-bold font-mono text-white">
                {stats?.memory || '168 MB'} <span className="text-[11px] text-slate-500 font-normal">/ {stats?.totalMemory || '16384 MB'}</span>
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Commandes</p>
              <p className="text-xs sm:text-sm font-bold font-mono text-white">294 actives</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Chiffrement</p>
              <p className="text-xs sm:text-sm font-bold text-white">Signal Protocol</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
