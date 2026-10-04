import React from 'react';
import { X, Bell, CheckCircle2, AlertTriangle, Info, Check, Shield } from 'lucide-react';
import { SecurityNotification } from '../types';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: SecurityNotification[];
  onMarkAllRead: () => void;
  onViewAllSecurity: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onViewAllSecurity,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0f1422] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Système d&apos;Alertes Sécurisé</h3>
              <p className="text-[11px] text-slate-400">Compte officiel KAYDO BOT</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notifications List */}
        <div className="p-4 overflow-y-auto space-y-2.5 divide-y divide-slate-800/60 flex-1">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Aucune notification active.
            </div>
          ) : (
            notifications.map((notif) => (
              <div key={notif.id} className="pt-2.5 first:pt-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center space-x-2">
                    {notif.level === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : notif.level === 'warning' || notif.level === 'critical' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    )}
                    <h4 className="text-xs font-bold text-slate-200">{notif.title}</h4>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">{notif.timestamp}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed pl-5">{notif.message}</p>
                {notif.phone && (
                  <p className="text-[11px] text-emerald-400 font-mono pl-5 mt-1">
                    WhatsApp : +{notif.phone}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Actions Footer */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            onClick={onMarkAllRead}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center space-x-1.5 transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Tout marquer comme lu</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onViewAllSecurity();
            }}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center space-x-1.5"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Panneau Complet</span>
          </button>
        </div>
      </div>
    </div>
  );
};
