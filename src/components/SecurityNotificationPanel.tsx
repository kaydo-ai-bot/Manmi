import React, { useState } from 'react';
import {
  Shield,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  Send,
  Lock,
  Radio,
  Sliders,
  Check,
  RefreshCw,
  Trash2,
  Smartphone
} from 'lucide-react';
import { SecurityNotification } from '../types';

interface SecurityNotificationPanelProps {
  notifications: SecurityNotification[];
  onRefresh: () => void;
  onMarkAllRead: () => void;
  onSendTestNotification: (title: string, message: string, level: 'info' | 'success' | 'warning' | 'critical') => Promise<void>;
}

export const SecurityNotificationPanel: React.FC<SecurityNotificationPanelProps> = ({
  notifications,
  onRefresh,
  onMarkAllRead,
  onSendTestNotification,
}) => {
  const [filter, setFilter] = useState<'all' | 'success' | 'warning' | 'info'>('all');
  const [testTitle, setTestTitle] = useState('Alerte de Sécurité KAYDO BOT');
  const [testMessage, setTestMessage] = useState('Vérification de la passerelle de sécurité et du canal de notification WhatsApp.');
  const [testLevel, setTestLevel] = useState<'info' | 'success' | 'warning' | 'critical'>('warning');
  const [sendingTest, setSendingTest] = useState(false);
  const [testSentSuccess, setTestSentSuccess] = useState(false);

  // Configuration state for the KAYDO BOT account notification targets
  const [ownerPhone, setOwnerPhone] = useState('+509 3597 5863');
  const [autoAlertOnPair, setAutoAlertOnPair] = useState(true);
  const [autoAlertOnCommand, setAutoAlertOnCommand] = useState(true);
  const [savedSettings, setSavedSettings] = useState(false);

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'all') return true;
    return n.level === filter;
  });

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingTest(true);
    try {
      await onSendTestNotification(testTitle, testMessage, testLevel);
      setTestSentSuccess(true);
      setTimeout(() => setTestSentSuccess(false), 3000);
    } finally {
      setSendingTest(false);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSettings(true);
    setTimeout(() => setSavedSettings(false), 2500);
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'success':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Succès
          </span>
        );
      case 'warning':
      case 'critical':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Alerte
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
            <Info className="w-3 h-3" /> Info
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              Système de Notification Sécurisé • Compte KAYDO BOT
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Surveillance chiffrée en temps réel du compte bot WhatsApp KAYDO DEV. Réception instantanée des alertes de connexion, sessions suspectes et validation des clés de chiffrement Signal.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualiser</span>
            </button>
            <button
              onClick={onMarkAllRead}
              className="px-3 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-xs font-semibold text-blue-300 flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Tout marquer comme lu</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Live Security Notification Feed (8 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#0f1422] border border-slate-800 rounded-2xl p-5">
            {/* Filter pills */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Journal des Notifications ({filteredNotifications.length})
                </span>
              </div>

              <div className="flex items-center space-x-1">
                {(['all', 'success', 'warning', 'info'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setFilter(lvl)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      filter === lvl
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 bg-slate-900'
                    }`}
                  >
                    {lvl === 'all' ? 'Toutes' : lvl === 'success' ? 'Succès' : lvl === 'warning' ? 'Alertes' : 'Infos'}
                  </button>
                ))}
              </div>
            </div>

            {/* Notification items */}
            <div className="divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto mt-2 pr-1">
              {filteredNotifications.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Aucune notification dans cette catégorie.
                </div>
              ) : (
                filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`py-3.5 px-2.5 rounded-xl transition-all ${
                      notif.read ? 'opacity-80' : 'bg-slate-900/50 border border-slate-800/80 my-1'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center space-x-2">
                        {getLevelBadge(notif.level)}
                        <h4 className="text-xs font-bold text-slate-100">{notif.title}</h4>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">{notif.timestamp}</span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed pl-1">{notif.message}</p>

                    {notif.phone && (
                      <div className="mt-2 text-[11px] text-emerald-400 font-mono flex items-center gap-1.5 pl-1">
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Compte WhatsApp lié : +{notif.phone}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Dispatch Test Alert & Notification Settings (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Dispatch Test Alert Form */}
          <div className="bg-[#0f1422] border border-blue-500/20 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-400 animate-pulse" />
              Déclencher une Alerte Test Sécurisée
            </h3>

            <form onSubmit={handleSendTest} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Titre de l&apos;alerte</label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Niveau d&apos;importance</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['info', 'success', 'warning'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setTestLevel(lvl)}
                      className={`py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${
                        testLevel === lvl
                          ? 'bg-blue-600/30 border-blue-400 text-blue-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Message d&apos;alerte</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={sendingTest}
                className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-blue-600/20 disabled:opacity-50"
              >
                {sendingTest ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Diffuser l&apos;Alerte Test</span>
                  </>
                )}
              </button>

              {testSentSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Alerte enregistrée et transmise au journal avec succès !</span>
                </div>
              )}
            </form>
          </div>

          {/* Account Security Target Settings */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              Paramètres Compte KAYDO BOT
            </h3>

            <form onSubmit={handleSaveSettings} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Numéro WhatsApp Propriétaire (Owner Alert)
                </label>
                <input
                  type="text"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAlertOnPair}
                    onChange={(e) => setAutoAlertOnPair(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-0 bg-slate-950"
                  />
                  <span className="text-slate-300">Alerte immédiate en cas de nouvelle liaison WhatsApp</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAlertOnCommand}
                    onChange={(e) => setAutoAlertOnCommand(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-0 bg-slate-950"
                  />
                  <span className="text-slate-300">Journaliser les commandes exécutées dans l&apos;audit de sécurité</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-all"
              >
                {savedSettings ? 'Configuration sauvegardée !' : 'Enregistrer la configuration'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
