import React from 'react';
import {
  LayoutDashboard,
  QrCode,
  Terminal,
  Sparkles,
  Sliders,
  FileText,
  ShieldCheck,
  ChevronRight,
  Activity,
  X,
  Radio,
} from 'lucide-react';
import { BotStats } from '../types';

export type AppPageTab =
  | 'dashboard'
  | 'connection'
  | 'commands'
  | 'custom_commands'
  | 'simulator'
  | 'settings'
  | 'logs';

export type AppTab = AppPageTab;

interface SidebarProps {
  activeTab: AppPageTab;
  setActiveTab: (tab: AppPageTab) => void;
  stats?: BotStats | null;
  isOpen?: boolean;
  mobileOpen?: boolean;
  onClose?: () => void;
  setMobileOpen?: (open: boolean) => void;
  activeSessionsCount?: number;
}

interface NavItem {
  id: AppPageTab;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'connection', label: 'Connexion WhatsApp', icon: QrCode, badge: 'Live' },
  { id: 'commands', label: 'Commandes', icon: Terminal, badge: '300+' },
  { id: 'custom_commands', label: 'Commandes Perso', icon: Sparkles },
  { id: 'simulator', label: 'Simulateur', icon: Activity },
  { id: 'settings', label: 'Paramètres', icon: Sliders },
  { id: 'logs', label: 'Logs & Sécurité', icon: FileText },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  stats,
  isOpen,
  mobileOpen,
  onClose,
  setMobileOpen,
}) => {
  const open = isOpen ?? mobileOpen ?? false;
  const handleClose = () => {
    if (onClose) onClose();
    if (setMobileOpen) setMobileOpen(false);
  };
  const isCircuitBreaker = stats?.metrics?.isCircuitBreakerActive;

  return (
    <>
      {/* Mobile Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-[#080F1F]/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={handleClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-[#0c1427] border-r border-[#3478F6]/15 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-[#3478F6]/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3478F6] to-[#16D9E8] flex items-center justify-center shadow-lg shadow-[#3478F6]/25">
              <span className="text-xl font-black text-white tracking-tighter">K</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#F5F7FF] tracking-tight">KAYDO BOT</h1>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-[#3478F6]/20 text-[#16D9E8] border border-[#16D9E8]/30">
                  v3.8
                </span>
              </div>
              <p className="text-xs text-[#8E9EB5]">Tableau de Bord Officiel</p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-[#8E9EB5] hover:text-white hover:bg-white/5 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* System Health Status Strip */}
        <div className="px-4 py-3 mx-4 my-3 rounded-xl bg-[#111C32] border border-[#3478F6]/15 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isCircuitBreaker
                    ? 'bg-[#EF4444]'
                    : stats?.status === 'ONLINE'
                    ? 'bg-[#10B981]'
                    : 'bg-[#F59E0B]'
                }`}
              />
              <span
                className={`absolute w-2.5 h-2.5 rounded-full animate-ping opacity-75 ${
                  isCircuitBreaker
                    ? 'bg-[#EF4444]'
                    : stats?.status === 'ONLINE'
                    ? 'bg-[#10B981]'
                    : 'bg-[#F59E0B]'
                }`}
              />
            </div>
            <div className="text-xs">
              <div className="font-semibold text-[#F5F7FF]">
                {isCircuitBreaker ? 'Pause Sécurité' : stats?.status === 'ONLINE' ? 'Système Actif' : 'En Attente'}
              </div>
              <div className="text-[11px] text-[#8E9EB5]">Anti-Ban & Opt-Out OK</div>
            </div>
          </div>
          <ShieldCheck className="w-4 h-4 text-[#16D9E8]" />
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  handleClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-[#3478F6] to-[#1e58c8] text-white shadow-md shadow-[#3478F6]/25 font-semibold'
                    : 'text-[#8E9EB5] hover:text-[#F5F7FF] hover:bg-[#111C32]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-white' : 'text-[#8E9EB5] group-hover:text-[#16D9E8]'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-[#111C32] text-[#16D9E8] border border-[#16D9E8]/20'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/80" />}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer / Account Info */}
        <div className="p-4 border-t border-[#3478F6]/10 bg-[#091022]">
          <div className="flex items-center justify-between text-xs text-[#8E9EB5]">
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-[#10B981]" />
              <span>{stats?.activeSessionsCount || 0} session(s) active(s)</span>
            </div>
            <span className="font-mono text-[11px] text-[#16D9E8]">{stats?.pingMs || 22}ms</span>
          </div>
          <div className="mt-2 text-[11px] text-[#8E9EB5]/70 text-center">
            KAYDO DEV © 2026 • Tous droits réservés
          </div>
        </div>
      </aside>
    </>
  );
};
