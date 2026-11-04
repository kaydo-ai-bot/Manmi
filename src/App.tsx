import React, { useState, useEffect } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { PairPage } from './pages/PairPage';
import { OwnerPage } from './pages/OwnerPage';
import { CommandImagesManager } from './components/CommandImagesManager';
import { CommandsCatalogue } from './components/CommandsCatalogue';
import { TerminalPlayground } from './components/TerminalPlayground';
import { SecurityNotificationPanel } from './components/SecurityNotificationPanel';
import { NotificationModal } from './components/NotificationModal';
import { Footer } from './components/Footer';
import { BotStats, SecurityNotification } from './types';

export default function App() {
  const getInitialTab = (): NavTab => {
    const path = window.location.pathname.toLowerCase().replace(/^\//, '');
    if (path === 'owner' || path === 'login') return 'owner';
    if (path === 'images' || path === 'media') return 'images';
    if (path === 'commands' || path === 'menu') return 'commands';
    if (path === 'terminal' || path === 'simulator') return 'terminal';
    if (path === 'security' || path === 'logs') return 'security';
    return 'pair';
  };

  const [activeTab, setActiveTabState] = useState<NavTab>(getInitialTab);
  const [stats, setStats] = useState<BotStats | null>(null);
  const [notifications, setNotifications] = useState<SecurityNotification[]>([]);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [terminalCommand, setTerminalCommand] = useState<string | null>(null);

  const setActiveTab = (tab: NavTab) => {
    setActiveTabState(tab);
    const newPath = tab === 'pair' ? '/' : `/${tab}`;
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

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.warn('Statut indisponible:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
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
    <div className="min-h-screen bg-[#06070d] text-slate-100 flex flex-col antialiased selection:bg-purple-600 selection:text-white relative overflow-x-hidden">
      {/* Dark Ambient Glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-purple-900/15 rounded-full blur-[160px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-900/15 rounded-full blur-[160px] pointer-events-none -z-10" />

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        unreadCount={unreadCount}
        onOpenNotifications={() => setIsNotifModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 pt-4 pb-12">
        {activeTab === 'pair' && (
          <PairPage
            stats={stats}
            onNotificationTrigger={() => setIsNotifModalOpen(true)}
            onGoToOwner={() => setActiveTab('owner')}
          />
        )}

        {activeTab === 'images' && (
          <CommandImagesManager />
        )}

        {activeTab === 'owner' && (
          <OwnerPage
            onNotificationTrigger={() => setIsNotifModalOpen(true)}
            onNavigateToPairing={() => setActiveTab('pair')}
          />
        )}

        {activeTab === 'commands' && (
          <CommandsCatalogue
            onRunCommand={(cmd) => {
              setTerminalCommand(cmd);
              setActiveTab('terminal');
            }}
          />
        )}

        {activeTab === 'terminal' && (
          <TerminalPlayground
            initialCommand={terminalCommand}
            onClearInitialCommand={() => setTerminalCommand(null)}
          />
        )}

        {activeTab === 'security' && (
          <SecurityNotificationPanel />
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Security Notification Modal */}
      <NotificationModal
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        onViewAllSecurity={() => {
          setIsNotifModalOpen(false);
          setActiveTab('security');
        }}
      />
    </div>
  );
}
