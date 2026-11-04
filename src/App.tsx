import React, { useState, useEffect } from 'react';
import { BotStats, SecurityNotification } from './types';
import { Sidebar, AppTab } from './components/Sidebar';
import { DashboardHeader } from './components/DashboardHeader';
import { DashboardPage } from './pages/DashboardPage';
import { ConnectionPage } from './pages/ConnectionPage';
import { CommandsPage } from './pages/CommandsPage';
import { CustomCommandsPage } from './pages/CustomCommandsPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { SettingsPage } from './pages/SettingsPage';
import { LogsPage } from './pages/LogsPage';
import { NotificationModal } from './components/NotificationModal';

export default function App() {
  // Resolve initial tab from window URL location
  const getInitialTab = (): AppTab => {
    const path = window.location.pathname.toLowerCase().replace(/^\//, '');
    if (path === 'connection' || path === 'pair') return 'connection';
    if (path === 'commands') return 'commands';
    if (path === 'custom' || path === 'custom-commands' || path === 'custom_commands') return 'custom_commands';
    if (path === 'simulator' || path === 'terminal') return 'simulator';
    if (path === 'settings' || path === 'owner') return 'settings';
    if (path === 'logs' || path === 'security') return 'logs';
    return 'dashboard';
  };

  const [activeTab, setActiveTabState] = useState<AppTab>(getInitialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<BotStats | null>(null);
  const [notifications, setNotifications] = useState<SecurityNotification[]>([]);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [triggerCommand, setTriggerCommand] = useState<string | null>(null);

  const setActiveTab = (tab: AppTab) => {
    setActiveTabState(tab);
    const newPath = tab === 'dashboard' ? '/' : `/${tab}`;
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveTabState(getInitialTab());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch bot status and enterprise anti-spam metrics
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.warn('Statut indisponible temporairement:', err);
    }
  };

  // Fetch security notifications
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.notifications) {
          setNotifications(data.notifications);
        }
      }
    } catch (err) {
      console.warn('Notifications indisponibles:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchNotifications();

    const statusInterval = setInterval(fetchStatus, 5000);
    const notifInterval = setInterval(fetchNotifications, 8000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(notifInterval);
    };
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[#080F1F] text-[#F5F7FF] flex antialiased selection:bg-[#3478F6] selection:text-white overflow-x-hidden">
      {/* Subtle ambient lighting glows for high-tech aesthetic */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-[#3478F6]/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-[#16D9E8]/10 rounded-full blur-[160px] pointer-events-none -z-10" />

      {/* Modern Responsive Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
        activeSessionsCount={stats?.activeSessionsCount || 0}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-64">
        {/* Top Header */}
        <DashboardHeader
          activeTab={activeTab}
          stats={stats}
          unreadCount={unreadCount}
          onOpenNotifications={() => setIsNotifModalOpen(true)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardPage
              stats={stats}
              onNavigate={(tab) => setActiveTab(tab)}
              onRefresh={fetchStatus}
            />
          )}

          {activeTab === 'connection' && (
            <ConnectionPage stats={stats} onRefresh={fetchStatus} />
          )}

          {activeTab === 'commands' && (
            <CommandsPage
              onRunCommand={(cmd) => {
                setTriggerCommand(cmd);
                setActiveTab('simulator');
              }}
            />
          )}

          {activeTab === 'custom_commands' && (
            <CustomCommandsPage />
          )}

          {activeTab === 'simulator' && (
            <SimulatorPage
              initialCommand={triggerCommand}
              onClearInitialCommand={() => setTriggerCommand(null)}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage />
          )}

          {activeTab === 'logs' && (
            <LogsPage />
          )}
        </main>

        {/* Clean Tech Footer */}
        <footer className="border-t border-white/5 bg-[#080F1F]/80 backdrop-blur-md py-4 px-6 text-center text-xs text-[#8E9EB5]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>KAYDO BOT • Système Anti-Ban & Pacing Intelligent Baileys Actif</span>
            </div>
            <p className="text-[11px] text-[#8E9EB5]">
              Développé par <strong className="text-white">KAYDO DEV</strong> • Production-Ready SaaS
            </p>
          </div>
        </footer>
      </div>

      {/* Notifications Modal */}
      <NotificationModal
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        onViewAllSecurity={() => {
          setIsNotifModalOpen(false);
          setActiveTab('logs');
        }}
      />
    </div>
  );
}
