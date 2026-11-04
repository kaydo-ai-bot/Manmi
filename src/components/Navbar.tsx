import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Crown,
  BookOpen,
  Terminal,
  Shield,
  Bell,
  Menu,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { StatusBadge } from './StatusBadge';
import { ThemeSelector } from './ThemeSelector';
import { BotStats } from '../types';
import { BOT_NAME } from '../utils/branding';

export type NavTab = 'pair' | 'images' | 'owner' | 'commands' | 'terminal' | 'security';

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
  const [appPhotoUrl, setAppPhotoUrl] = useState('/kaydo.jpg');

  useEffect(() => {
    fetch('/api/command-images')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.appPhotoUrl) {
          setAppPhotoUrl(data.appPhotoUrl);
        }
      })
      .catch(() => {});
  }, []);

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'pair', label: 'Jumelage', icon: <Smartphone className="w-4 h-4" /> },
    { id: 'images', label: 'Photos & Variables', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'owner', label: 'Owner Panel', icon: <Crown className="w-4 h-4" /> },
    { id: 'commands', label: 'Commandes', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'terminal', label: 'Terminal', icon: <Terminal className="w-4 h-4" /> },
    { id: 'security', label: 'Sécurité', icon: <Shield className="w-4 h-4" /> },
  ];

  return (
    <nav className="sticky top-0 z-40 bg-[#06070e]/95 backdrop-blur-2xl border-b border-purple-950/40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Brand Logo Only - Circular Avatar with glowing neon border matching screenshot */}
          <button
            type="button"
            onClick={() => setActiveTab('pair')}
            className="flex items-center cursor-pointer group shrink-0"
            title={BOT_NAME}
            aria-label={`${BOT_NAME} Accueil`}
          >
            <div
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center p-0.5 border-2 shadow-[0_0_15px_rgba(147,51,234,0.35)] transition-all group-hover:scale-105 group-hover:shadow-[0_0_22px_rgba(147,51,234,0.6)] overflow-hidden"
              style={{
                borderColor: currentTheme.colorHex,
                backgroundColor: '#0c0d1b',
              }}
            >
              <img
                src={appPhotoUrl}
                alt={BOT_NAME}
                className="w-full h-full object-cover rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/kaydo.jpg';
                }}
              />
            </div>
          </button>

          {/* Center Slot on Mobile: ONLINE Pill with glowing green dot (as seen in screenshot top bar) */}
          <div className="flex md:hidden items-center justify-center">
            <StatusBadge
              status="ONLINE"
              isSocketOpen={stats?.status === 'ONLINE' || true}
            />
          </div>

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
                      ? `bg-purple-950/50 text-white border border-purple-500/50 shadow-[0_0_18px_rgba(147,51,234,0.25)]`
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                  }`}
                  style={
                    isActive
                      ? {
                          borderColor: `${currentTheme.colorHex}88`,
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

          {/* Right Area: ThemeSelector, StatusBadge (Desktop), Notifications & Mobile Hamburger */}
          <div className="flex items-center space-x-2 shrink-0">
            <div className="hidden sm:block">
              <ThemeSelector />
            </div>

            <StatusBadge
              status="ONLINE"
              isSocketOpen={stats?.status === 'ONLINE' || true}
              className="hidden md:inline-flex"
            />

            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                className="relative p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-purple-900/40 text-slate-300 hover:text-white transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Notifications système"
                aria-label="Ouvrir les notifications de sécurité"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-mono text-[9px] font-bold flex items-center justify-center animate-pulse shadow-sm">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* Mobile menu hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-purple-900/40 text-slate-300 transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Ouvrir le menu de navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-purple-950/60 space-y-3 animate-in slide-in-from-top-2">
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
                        ? 'bg-purple-950/70 text-white border border-purple-500/60 shadow-[0_0_15px_rgba(147,51,234,0.2)]'
                        : 'bg-[#0d0e1b] text-slate-300 border border-slate-800'
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
