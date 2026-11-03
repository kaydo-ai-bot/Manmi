import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Save,
  UserX,
  Plus,
  Trash2,
  RefreshCw,
  Power,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Hash,
  Globe
} from 'lucide-react';
import { OptOutRecord } from '../types';

export const SettingsPage: React.FC = () => {
  const [botName, setBotName] = useState('KAYDO MINI BOT');
  const [botMode, setBotMode] = useState<'public' | 'private'>('public');
  const [prefix, setPrefix] = useState('.');
  const [isGlobalEnabled, setIsGlobalEnabled] = useState(true);

  // Opt-out list
  const [optOutList, setOptOutList] = useState<OptOutRecord[]>([]);
  const [newOptOutPhone, setNewOptOutPhone] = useState('');
  const [newOptOutReason, setNewOptOutReason] = useState('Demande de désinscription');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Fetch current settings
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/bot/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.botName) setBotName(data.botName);
        if (data.botMode) setBotMode(data.botMode);
        if (data.prefix) setPrefix(data.prefix);
        if (typeof data.isGlobalEnabled === 'boolean') setIsGlobalEnabled(data.isGlobalEnabled);
      }
    } catch (err) {
      console.error('Erreur chargement paramètres:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch opt-out list
  const fetchOptOutList = async () => {
    try {
      const res = await fetch('/api/bot/optout');
      if (res.ok) {
        const data = await res.json();
        if (data.optOutList) {
          setOptOutList(data.optOutList);
        }
      }
    } catch (err) {
      console.error('Erreur chargement opt-out:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchOptOutList();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/bot/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botName,
          botMode,
          prefix,
          isGlobalEnabled,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({ text: 'Paramètres enregistrés et appliqués avec succès !', type: 'success' });
      } else {
        setStatusMessage({ text: data.message || 'Erreur lors de la sauvegarde.', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: 'Erreur réseau lors de la sauvegarde.', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleAddOptOut = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = newOptOutPhone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 6) {
      alert('Veuillez entrer un numéro de téléphone valide.');
      return;
    }

    try {
      const res = await fetch('/api/bot/optout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          phone: cleanPhone,
          reason: newOptOutReason,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNewOptOutPhone('');
        fetchOptOutList();
      }
    } catch (err) {
      alert('Erreur lors de l\'ajout du numéro.');
    }
  };

  const handleRemoveOptOut = async (phone: string) => {
    if (!confirm(`Retirer le numéro +${phone} de la liste de désinscription ?`)) return;

    try {
      const res = await fetch('/api/bot/optout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          phone,
        }),
      });

      const data = await res.json();
      if (data.success) {
        fetchOptOutList();
      }
    } catch (err) {
      alert('Erreur lors de la suppression.');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      {/* Header banner */}
      <div className="bg-[#111C32]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#3478F6]/20 text-[#16D9E8] border border-[#3478F6]/30">
              <Sliders className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Paramètres & Sécurité du Bot</h2>
              <p className="text-xs text-[#8E9EB5]">
                Configuration globale, protection anti-spam et registre de désinscription (Opt-Out)
              </p>
            </div>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: General Configuration Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveSettings} className="bg-[#111C32] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2 pb-3 border-b border-white/10">
              <Settings className="w-4 h-4 text-[#3478F6]" />
              Configuration Principale
            </h3>

            {/* Master Switch */}
            <div className="bg-[#080F1F] border border-white/5 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <Power className="w-4 h-4 text-emerald-400" />
                  État Général du Moteur (Master Switch)
                </p>
                <p className="text-xs text-[#8E9EB5] mt-0.5">
                  Si désactivé, le bot ne répondra à aucune commande publique ni message entrant.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsGlobalEnabled(!isGlobalEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isGlobalEnabled ? 'bg-gradient-to-r from-[#3478F6] to-[#16D9E8]' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isGlobalEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Bot Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#8E9EB5]">Nom du Bot</label>
                <input
                  type="text"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  className="w-full bg-[#080F1F] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#3478F6]"
                  required
                />
              </div>

              {/* Command Prefix */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#8E9EB5]">Préfixe des Commandes</label>
                <input
                  type="text"
                  value={prefix}
                  maxLength={2}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="w-full bg-[#080F1F] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-[#3478F6]"
                  required
                />
              </div>
            </div>

            {/* Mode selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#8E9EB5]">Mode de Fonctionnement</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBotMode('public')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    botMode === 'public'
                      ? 'bg-[#3478F6]/15 border-[#3478F6] text-white'
                      : 'bg-[#080F1F] border-white/5 text-[#8E9EB5] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-[#16D9E8]" /> Mode Public
                    </span>
                    {botMode === 'public' && <div className="w-2 h-2 rounded-full bg-[#16D9E8]"></div>}
                  </div>
                  <p className="text-[11px] text-[#8E9EB5]">
                    Accessible par tous les membres des groupes et en messages privés.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setBotMode('private')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    botMode === 'private'
                      ? 'bg-[#3478F6]/15 border-[#3478F6] text-white'
                      : 'bg-[#080F1F] border-white/5 text-[#8E9EB5] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-amber-400" /> Mode Privé
                    </span>
                    {botMode === 'private' && <div className="w-2 h-2 rounded-full bg-amber-400"></div>}
                  </div>
                  <p className="text-[11px] text-[#8E9EB5]">
                    Réservé exclusivement aux administrateurs et au propriétaire.
                  </p>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#3478F6] to-[#16D9E8] text-white font-semibold text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[#3478F6]/25 flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement...' : 'Enregistrer les Paramètres'}
              </button>
            </div>
          </form>

          {/* Opt-Out Registry Table & Form */}
          <div className="bg-[#111C32] border border-white/10 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserX className="w-4 h-4 text-rose-400" />
                Registre de Protection & Désinscription ({optOutList.length})
              </h3>
              <button
                onClick={fetchOptOutList}
                className="p-1.5 text-[#8E9EB5] hover:text-white rounded-lg hover:bg-white/5"
                title="Actualiser la liste"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-[#8E9EB5] leading-relaxed">
              Les numéros figurant sur cette liste ne recevront <strong className="text-white">jamais</strong> aucun message automatique, diffusion, ou rappel. Les commandes STOP / ARRET par les utilisateurs les ajoutent également de façon autonome.
            </p>

            {/* Add Number Form */}
            <form onSubmit={handleAddOptOut} className="bg-[#080F1F] border border-white/5 rounded-xl p-3 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Numéro WhatsApp (ex: 22501020304)"
                value={newOptOutPhone}
                onChange={(e) => setNewOptOutPhone(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-[#8E9EB5] focus:outline-none focus:border-[#3478F6]"
                required
              />
              <input
                type="text"
                placeholder="Motif (optionnel)"
                value={newOptOutReason}
                onChange={(e) => setNewOptOutReason(e.target.value)}
                className="sm:w-48 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-[#8E9EB5] focus:outline-none focus:border-[#3478F6]"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </button>
            </form>

            {/* Table of Opt-Outs */}
            <div className="overflow-x-auto max-h-60 overflow-y-auto no-scrollbar rounded-xl border border-white/5">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#080F1F] text-[#8E9EB5] uppercase text-[10px] tracking-wider sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Numéro</th>
                    <th className="py-2.5 px-3">Motif</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white">
                  {optOutList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[#8E9EB5]">
                        Aucun numéro désinscrit pour le moment.
                      </td>
                    </tr>
                  ) : (
                    optOutList.map((item) => (
                      <tr key={item.phone} className="hover:bg-white/[0.02]">
                        <td className="py-2 px-3 font-mono text-emerald-400">+{item.phone}</td>
                        <td className="py-2 px-3 text-[#8E9EB5] max-w-[140px] truncate">{item.reason}</td>
                        <td className="py-2 px-3 text-[#8E9EB5]">{item.addedAt?.substring(0, 10)}</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleRemoveOptOut(item.phone)}
                            className="p-1 text-[#8E9EB5] hover:text-rose-400 transition-colors"
                            title="Retirer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Active Anti-Ban & Engine Rules */}
        <div className="space-y-6">
          <div className="bg-[#111C32] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 pb-3 border-b border-white/10">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Garde Anti-Ban & Spécifications
            </h3>

            <div className="space-y-3 text-xs">
              <div className="bg-[#080F1F] p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-[#8E9EB5] font-medium">Délai d'envoi humain (Pacing) :</span>
                <p className="text-white font-mono font-semibold">850 ms à 1 350 ms aléatoire</p>
                <p className="text-[10px] text-[#8E9EB5]">Simule la vitesse de frappe humaine sur mobile.</p>
              </div>

              <div className="bg-[#080F1F] p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-[#8E9EB5] font-medium">Limiteur de Débit (Per-JID Flood) :</span>
                <p className="text-white font-mono font-semibold">Max 3 msgs / 5 secondes</p>
                <p className="text-[10px] text-[#8E9EB5]">Empêche les boucles et les rafales vers un même contact.</p>
              </div>

              <div className="bg-[#080F1F] p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-[#8E9EB5] font-medium">Débit Global (Global Throttle) :</span>
                <p className="text-white font-mono font-semibold">Max 12 msgs / 5 secondes</p>
                <p className="text-[10px] text-[#8E9EB5]">Plafond global de sécurité pour l'ensemble des sessions.</p>
              </div>

              <div className="bg-[#080F1F] p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-[#8E9EB5] font-medium">Déduplication d'Événements :</span>
                <p className="text-white font-mono font-semibold">Mémoire cache TTL 45 secondes</p>
                <p className="text-[10px] text-[#8E9EB5]">Supprime les doubles réceptions causées par Baileys MD.</p>
              </div>

              <div className="bg-[#080F1F] p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-[#8E9EB5] font-medium">Disjoncteur WhatsApp (Circuit Breaker) :</span>
                <p className="text-emerald-400 font-mono font-semibold">Actif (3 min cooldown)</p>
                <p className="text-[10px] text-[#8E9EB5]">Interrompt les envois dès détection d'une réponse 429 ou 403.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
