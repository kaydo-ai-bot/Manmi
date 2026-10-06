import React from 'react';
import { Shield, Bell, Terminal, Zap, BookOpen, Smartphone, Activity, RotateCcw, Crown, Globe } from 'lucide-react';
import { BotStats } from '../types';

interface HeaderProps {
  stats: BotStats | null;
  activeTab: 'pairing' | 'sessions' | 'commands' | 'terminal' | 'security' | 'owner';
  setActiveTab: (tab: 'pairing' | 'sessions' | 'commands' | 'terminal' | 'security' | 'owner') => void;
  unreadCount: number;
  onOpenNotifications: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  activeTab,
  setActiveTab,
  unreadCount,
  onOpenNotifications,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0b0f17]/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold text-lg ring-1 ring-white/20">
              👑
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white">
                  kaydo <span className="text-emerald-400">bot</span>
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  v4.5.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Bot WhatsApp & Telegram Officiel • ≛⃝🥷🏿 𝐊𝐀𝐘𝐃𝐎 ≛⃝🥷🏿 & 𝑺𝑨𝑹𝑨𝑯 𝑩𝒁𝑲 🌸
              </p>
            </div>
          </div>

          {/* Navigation tabs */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              id="nav-btn-pairing"
              onClick={() => setActiveTab('pairing')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                activeTab === 'pairing'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Jumelage</span>
            </button>

            <button
              id="nav-btn-sessions"
              onClick={() => setActiveTab('sessions')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                activeTab === 'sessions'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <RotateCcw className="w-4 h-4 text-teal-400" />
              <span>Sessions & Redémarrage</span>
            </button>

            <button
              id="nav-btn-commands"
              onClick={() => setActiveTab('commands')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                activeTab === 'commands'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span>294 Commandes</span>
            </button>

            <button
              id="nav-btn-terminal"
              onClick={() => setActiveTab('terminal')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                activeTab === 'terminal'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Terminal className="w-4 h-4 text-amber-400" />
              <span>Console Simulateur</span>
            </button>

            <button
              id="nav-btn-security"
              onClick={() => setActiveTab('security')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                activeTab === 'security'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Shield className="w-4 h-4 text-blue-400" />
              <span>Sécurité & Alertes</span>
            </button>

            {/* 👑 OWNER EXCLUSIVE HUB BUTTON */}
            <button
              id="nav-btn-owner"
              onClick={() => setActiveTab('owner')}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'owner'
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/60 shadow-lg shadow-amber-500/15'
                  : 'text-amber-400/90 hover:text-amber-200 hover:bg-amber-500/10 border border-amber-500/30'
              }`}
              title="Espace réservé exclusivement au propriétaire (+509 3597 5863)"
            >
              <Crown className="w-4 h-4 text-amber-400" />
              <span>👑 Espace Owner</span>
            </button>
          </nav>

          {/* Right Status Indicators & Notifications */}
          <div className="flex items-center space-x-2.5">
            {/* Quick Public URL Copy Button */}
            <button
              onClick={() => {
                const url = stats?.siteUrl || 'https://ais-pre-h52ibm424amwj4xvzv7rk6-366597369396.us-east1.run.app';
                navigator.clipboard.writeText(url);
                alert(`URL Publique copiée dans le presse-papier :\n${url}`);
              }}
              className="hidden xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-emerald-500/40 text-xs text-emerald-300 transition-colors cursor-pointer"
              title="Copier l'URL publique officielle 24/7"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>URL Public</span>
            </button>

            {/* Live Ping Indicator */}
            <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-xs font-mono text-emerald-400">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>{stats?.pingMs || 22}ms</span>
            </div>

            {/* Status Pill */}
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="font-semibold">WhatsApp Ready</span>
            </div>

            {/* Notification Bell Button */}
            <button
              id="btn-open-notifications"
              onClick={onOpenNotifications}
              className="relative p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Système de notifications sécurisé KAYDO BOT"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-red-500 text-white font-bold text-[10px] rounded-full ring-2 ring-[#0b0f17] animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-800/80 overflow-x-auto gap-1">
          <button
            onClick={() => setActiveTab('pairing')}
            className={`px-2 py-1.5 text-xs font-medium rounded-md shrink-0 ${
              activeTab === 'pairing' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'
            }`}
          >
            Jumelage
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-2 py-1.5 text-xs font-medium rounded-md shrink-0 ${
              activeTab === 'sessions' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'
            }`}
          >
            Sessions
          </button>
          <button
            onClick={() => setActiveTab('commands')}
            className={`px-2 py-1.5 text-xs font-medium rounded-md shrink-0 ${
              activeTab === 'commands' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'
            }`}
          >
            Commandes
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-2 py-1.5 text-xs font-medium rounded-md shrink-0 ${
              activeTab === 'terminal' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'
            }`}
          >
            Console
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-2 py-1.5 text-xs font-medium rounded-md shrink-0 ${
              activeTab === 'security' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'
            }`}
          >
            Sécurité
          </button>
          <button
            onClick={() => setActiveTab('owner')}
            className={`px-2 py-1.5 text-xs font-bold rounded-md shrink-0 flex items-center gap-1 ${
              activeTab === 'owner' ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40' : 'text-amber-400'
            }`}
          >
            👑 Owner
          </button>
        </div>
      </div>
    </header>
  );
};
