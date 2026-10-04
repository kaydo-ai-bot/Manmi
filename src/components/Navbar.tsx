import React, { useState } from 'react';
import {
  Smartphone,
  Crown,
  BookOpen,
  Terminal,
  Shield,
  Bell,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { StatusBadge } from './StatusBadge';
import { ThemeSelector } from './ThemeSelector';
import { BotStats } from '../types';

export type NavTab = 'pair' | 'owner' | 'commands' | 'terminal' | 'security';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  stats?: BotStats | null;
  unreadCount?: number;
  onOpenNotifications?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  stats,
  unreadCount = 0,
  onOpenNotifications,
}) => {
  const { currentTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'pair', label: 'Jumelage', icon: <Smartphone className="w-4 h-4" /> },
    { id: 'owner', label: 'Owner Panel', icon: <Crown className="w-4 h-4" /> },
    { id: 'commands', label: 'Commandes', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'terminal', label: 'Terminal', icon: <Terminal className="w-4 h-4" /> },
    { id: 'security', label: 'Sécurité', icon: <Shield className="w-4 h-4" /> },
  ];

  return (
    <nav className="sticky top-0 z-40 bg-[#06070e]/90 backdrop-blur-xl border-b border-slate-850/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <button
            type="button"
            onClick={() => setActiveTab('pair')}
            className="flex items-center space-x-3 cursor-pointer group text-left"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center p-0.5 border shadow-md transition-all group-hover:scale-105"
              style={{
                borderColor: currentTheme.colorHex,
                backgroundColor: '#0c0d1b',
              }}
            >
              <img
                src="/shado_bot_avatar.jpg"
                alt="SHADO BOT"
                className="w-full h-full object-cover rounded-lg"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="font-black text-sm select-none">𓃶</span>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white font-mono uppercase">
                  SHADO BOT <span style={{ color: currentTheme.colorHex }}>𓃶</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
                KAYDO 𓃶 • CLOUD 24/7
              </p>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? `bg-purple-950/40 text-white border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.2)]`
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                  }`}
                  style={
                    isActive
                      ? {
                          borderColor: `${currentTheme.colorHex}66`,
                          color: '#ffffff',
                        }
                      : {}
                  }
                >
                  <span style={isActive ? { color: currentTheme.colorHex } : {}}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Area: StatusBadge, Notifications & Mobile Toggle */}
          <div className="flex items-center space-x-2.5">
            <div className="hidden sm:block">
              <ThemeSelector />
            </div>

            <StatusBadge
              status="ONLINE"
              isSocketOpen={stats?.status === 'ONLINE' || true}
              className="hidden lg:inline-flex"
            />

            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                className="relative p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Notifications système"
                aria-label="Ouvrir les notifications de sécurité"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* Mobile menu hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Ouvrir le menu de navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-800/80 space-y-2 animate-in slide-in-from-top-2">
            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`p-3 rounded-xl text-xs font-mono font-semibold flex items-center gap-2.5 transition-all min-h-[48px] ${
                      isActive
                        ? 'bg-purple-950/60 text-white border border-purple-500/50'
                        : 'bg-[#0d0e1b] text-slate-300 border border-slate-850'
                    }`}
                  >
                    <span style={{ color: currentTheme.colorHex }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <ThemeSelector />
              <StatusBadge status="ONLINE" isSocketOpen={true} />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
