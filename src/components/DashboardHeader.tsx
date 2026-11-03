import React from 'react';
import { Menu, RefreshCw, Smartphone, Shield, Zap } from 'lucide-react';
import { BotStats } from '../types';
import { AppPageTab } from './Sidebar';

interface DashboardHeaderProps {
  activeTab: AppPageTab;
  onOpenSidebar: () => void;
  stats: BotStats | null;
  onRefresh: () => void;
  onNavigateToConnection: () => void;
}

const tabTitles: Record<AppPageTab, { title: string; subtitle: string }> = {
  dashboard: { title: 'Tableau de Bord', subtitle: 'Statistiques & Surveillance en Direct' },
  connection: { title: 'Connexion WhatsApp', subtitle: 'Pairing Code & Scan QR Instantané' },
  commands: { title: 'Catalogue des Commandes', subtitle: 'Plus de 300 commandes disponibles' },
  custom_commands: { title: 'Commandes Personnalisées', subtitle: 'Création et Gestion des Raccourcis' },
  simulator: { title: 'Simulateur WhatsApp', subtitle: 'Test des Commandes en direct' },
  settings: { title: 'Paramètres & Sécurité', subtitle: 'Configuration Anti-Spam & Désinscription' },
  logs: { title: 'Journal des Événements', subtitle: 'Audit de Sécurité & Filtrage en Temps Réel' },
};

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  activeTab,
  onOpenSidebar,
  stats,
  onRefresh,
  onNavigateToConnection,
}) => {
  const current = tabTitles[activeTab] || tabTitles.dashboard;
  const isCircuitBreaker = stats?.metrics?.isCircuitBreakerActive;

  return (
    <header className="sticky top-0 z-30 bg-[#080F1F]/85 backdrop-blur-md border-b border-[#3478F6]/15 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
      {/* Left: Mobile Burger & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-xl text-[#8E9EB5] hover:text-[#F5F7FF] hover:bg-[#111C32] lg:hidden border border-[#3478F6]/15"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#16D9E8] uppercase tracking-wider hidden sm:inline">
              KAYDO BOT
            </span>
            <span className="text-xs text-[#8E9EB5] hidden sm:inline">/</span>
            <h2 className="text-base sm:text-lg font-bold text-[#F5F7FF] tracking-tight">
              {current.title}
            </h2>
          </div>
          <p className="text-xs text-[#8E9EB5] hidden md:block">{current.subtitle}</p>
        </div>
      </div>

      {/* Right: Actions & Live Status */}
      <div className="flex items-center gap-2.5">
        {/* Anti-Ban Health Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#111C32] border border-[#3478F6]/20 text-xs">
          <Shield className="w-3.5 h-3.5 text-[#16D9E8]" />
          <span className="text-[#8E9EB5]">Anti-Ban :</span>
          <span
            className={`font-semibold ${
              isCircuitBreaker
                ? 'text-[#EF4444]'
                : stats?.metrics?.systemHealth === 'RESTRICTED'
                ? 'text-[#EF4444]'
                : 'text-[#10B981]'
            }`}
          >
            {isCircuitBreaker ? 'Pause Sécurité' : 'Actif 🟢'}
          </span>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          title="Actualiser les statistiques"
          className="p-2 rounded-xl text-[#8E9EB5] hover:text-[#F5F7FF] hover:bg-[#111C32] border border-[#3478F6]/15 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Primary CTA Button */}
        {activeTab !== 'connection' && (
          <button
            onClick={onNavigateToConnection}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#3478F6] to-[#1e58c8] text-white text-xs sm:text-sm font-semibold shadow-md shadow-[#3478F6]/25 hover:brightness-110 active:scale-98 transition-all whitespace-nowrap"
          >
            <Smartphone className="w-4 h-4" />
            <span>Lier un Numéro</span>
          </button>
        )}
      </div>
    </header>
  );
};
