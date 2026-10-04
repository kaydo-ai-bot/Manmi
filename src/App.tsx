import React, { useState, useEffect } from 'react';
import { BotStats, SecurityNotification } from './types';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Navbar, NavTab } from './components/Navbar';
import { PairPage } from './pages/PairPage';
import { OwnerPage } from './pages/OwnerPage';
import { CommandsCatalogue } from './components/CommandsCatalogue';
import { CommandImagesManager } from './components/CommandImagesManager';
import { TerminalPlayground } from './components/TerminalPlayground';
import { SecurityNotificationPanel } from './components/SecurityNotificationPanel';
import { NotificationModal } from './components/NotificationModal';
import { Footer } from './components/Footer';

function MainApp() {
  const { currentTheme } = useTheme();

  // Resolve initial tab from window location
  const getInitialTab = (): NavTab => {
    const path = window.location.pathname.toLowerCase().replace(/^\//, '');
    if (path === 'images' || path === 'photos' || path === 'variables') return 'images';
    if (path === 'owner' || path === 'login') return 'owner';
    if (path === 'commands') return 'commands';
    if (path === 'terminal') return 'terminal';
    if (path === 'security') return 'security';
    return 'pair';
  };

  const [activeTab, setActiveTabState] = useState<NavTab>(getInitialTab);
  const [stats, setStats] = useState<BotStats | null>(null);
  const [notifications, setNotifications] = useState<SecurityNotification[]>([]);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [triggerCommand, setTriggerCommand] = useState<string | null>(null);

  const setActiveTab = (tab: NavTab) => {
    setActiveTabState(tab);
    const newPath = tab === 'pair' ? '/' : `/${tab}`;
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  };

  // Listen to browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setActiveTabState(getInitialTab());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch bot status
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.warn('Bot status non disponible temporairement:', err);
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
      console.warn('Notifications non disponibles temporairement:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchNotifications();

    const statusInterval = setInterval(fetchStatus, 6000);
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

  const handleSendTestNotification = async (
    title: string,
    message: string,
    level: 'info' | 'success' | 'warning' | 'critical'
  ) => {
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, level }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.notification) {
          setNotifications((prev) => [data.notification, ...prev]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#05060b] text-slate-100 selection:bg-purple-600 selection:text-white relative overflow-x-hidden">
      {/* Background ambient lighting */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full blur-[140px] pointer-events-none opacity-20 -z-10 transition-colors duration-500"
        style={{ backgroundColor: currentTheme.colorHex }}
      />
      <div className="fixed bottom-0 right-0 w-[450px] h-[450px] rounded-full blur-[160px] bg-purple-950/20 pointer-events-none -z-10" />

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        unreadCount={unreadCount}
        onOpenNotifications={() => setIsNotifModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* TAB: PAIRING (Centered Futuristic Card matching the screenshot) */}
        {activeTab === 'pair' && (
          <PairPage
            stats={stats}
            onNotificationTrigger={fetchNotifications}
            onGoToOwner={() => setActiveTab('owner')}
          />
        )}

        {/* TAB: PHOTOS & VARIABLES MANAGER */}
        {activeTab === 'images' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            <CommandImagesManager />
          </div>
        )}

        {/* TAB: OWNER DASHBOARD (Securely verified server-side) */}
        {activeTab === 'owner' && (
          <OwnerPage
            onNotificationTrigger={fetchNotifications}
            onNavigateToPairing={() => setActiveTab('pair')}
          />
        )}

        {/* TAB: COMMANDS CATALOGUE */}
        {activeTab === 'commands' && (
          <div className="space-y-4">
            <CommandsCatalogue
              onExecuteCommand={(cmd) => {
                setTriggerCommand(cmd);
                setActiveTab('terminal');
              }}
            />
          </div>
        )}

        {/* TAB: TERMINAL SIMULATOR */}
        {activeTab === 'terminal' && (
          <div className="space-y-4">
            <TerminalPlayground
              initialCommand={triggerCommand}
              onClearInitialCommand={() => setTriggerCommand(null)}
              onNotificationTrigger={fetchNotifications}
            />
          </div>
        )}

        {/* TAB: SECURITY NOTIFICATIONS */}
        {activeTab === 'security' && (
          <div className="space-y-4">
            <SecurityNotificationPanel
              notifications={notifications}
              onRefresh={fetchNotifications}
              onMarkAllRead={handleMarkAllRead}
              onSendTestNotification={handleSendTestNotification}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <Footer activeSessionsCount={stats?.activeSessionsCount || 0} />

      {/* Quick Notifications Modal */}
      <NotificationModal
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        onViewAllSecurity={() => setActiveTab('security')}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}
