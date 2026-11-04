import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Info,
  ShieldAlert,
  Download,
  Copy,
  Check
} from 'lucide-react';
import { SystemEventLog } from '../types';

export const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<SystemEventLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'error' | 'warn' | 'antispam' | 'command'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/bot/logs?limit=100&filter=${selectedFilter}`);
      if (res.ok) {
        const data = await res.json();
        if (data.logs) {
          setLogs(data.logs);
        }
      }
    } catch (err) {
      console.error('Erreur chargement logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedFilter]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedFilter]);

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const lower = searchTerm.toLowerCase();
    return (
      log.message.toLowerCase().includes(lower) ||
      log.category.toLowerCase().includes(lower) ||
      log.level.toLowerCase().includes(lower) ||
      (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(lower))
    );
  });

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.category}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3" /> ERREUR
          </span>
        );
      case 'warn':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> ATTENTION
          </span>
        );
      case 'antispam':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <ShieldAlert className="w-3 h-3" /> ANTI-SPAM
          </span>
        );
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" /> SUCCÈS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#3478F6]/20 text-[#16D9E8] border border-[#3478F6]/30">
            <Info className="w-3 h-3" /> INFO
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-[#111C32]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#3478F6]/20 text-[#16D9E8] border border-[#3478F6]/30">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Journal des Événements & Sécurité</h2>
              <p className="text-xs text-[#8E9EB5]">
                Historique temps réel des exécutions, blocages anti-spam et connexions
              </p>
            </div>
          </div>
        </div>

        {/* Actions buttons */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[#8E9EB5] cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-[#080F1F] border-white/20 text-[#3478F6] focus:ring-0"
            />
            Auto-refresh (5s)
          </label>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 bg-[#080F1F] hover:bg-white/5 border border-white/10 rounded-xl text-white transition-all"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleCopyLogs}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#080F1F] hover:bg-white/5 border border-white/10 rounded-xl text-xs text-white transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copié' : 'Copier'}</span>
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-[#111C32] border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row gap-4 justify-between items-center">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#8E9EB5] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par message, catégorie..."
            className="w-full bg-[#080F1F] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-[#8E9EB5] focus:outline-none focus:border-[#3478F6]"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto no-scrollbar">
          {(
            [
              { id: 'all', label: 'Tous' },
              { id: 'error', label: 'Erreurs' },
              { id: 'antispam', label: 'Anti-Spam' },
              { id: 'command', label: 'Commandes' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                selectedFilter === f.id
                  ? 'bg-gradient-to-r from-[#3478F6] to-[#16D9E8] text-white shadow-md shadow-[#3478F6]/25'
                  : 'bg-[#080F1F] text-[#8E9EB5] hover:text-white border border-white/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[#111C32] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto no-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#080F1F] text-[#8E9EB5] uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-white/5">
              <tr>
                <th className="py-3 px-4">Heure</th>
                <th className="py-3 px-4">Niveau</th>
                <th className="py-3 px-4">Catégorie</th>
                <th className="py-3 px-4">Événement & Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-[#8E9EB5] font-sans">
                    Aucun événement correspondant aux critères de recherche.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-[#8E9EB5] whitespace-nowrap text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{getLevelBadge(log.level)}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-[11px] font-semibold text-[#16D9E8] bg-[#16D9E8]/10 px-2 py-0.5 rounded border border-[#16D9E8]/20">
                        {log.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-xs break-words">
                      <span className="text-[#F5F7FF]">{log.message}</span>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-1 text-[11px] font-mono text-[#8E9EB5] bg-[#080F1F] p-2 rounded-lg border border-white/5 overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
