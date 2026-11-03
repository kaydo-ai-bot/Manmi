import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Check,
  Play,
  RefreshCw,
  Terminal,
  HelpCircle,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { CustomCommand } from '../types';

interface CustomCommandsPageProps {
  onExecuteCommand: (commandName: string) => void;
  prefix?: string;
}

export const CustomCommandsPage: React.FC<CustomCommandsPageProps> = ({
  onExecuteCommand,
  prefix = '.',
}) => {
  const [commands, setCommands] = useState<CustomCommand[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [commandName, setCommandName] = useState('');
  const [commandText, setCommandText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const fetchCustomCommands = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/custom-commands');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.commands)) {
          setCommands(data.commands);
        }
      }
    } catch (e) {
      console.warn('Erreur chargement commandes perso:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomCommands();
  }, []);

  const handleCreateCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const cleanName = commandName.trim().toLowerCase().replace(/^\./, '');
    const cleanText = commandText.trim();

    if (!cleanName || cleanName.length < 2) {
      setFeedback({ type: 'error', message: 'Le nom de la commande doit comporter au moins 2 caractères.' });
      return;
    }
    if (!cleanText) {
      setFeedback({ type: 'error', message: 'Veuillez saisir le texte de réponse pour cette commande.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/custom-commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, description: cleanText }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Échec de création de la commande.');
      }

      setFeedback({ type: 'success', message: `Commande personnalisée .${cleanName} enregistrée avec succès !` });
      setCommandName('');
      setCommandText('');
      fetchCustomCommands();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erreur lors de l\'enregistrement.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCommand = async (name: string) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer la commande .${name} ?`)) return;

    try {
      const res = await fetch(`/api/custom-commands/${name}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setFeedback({ type: 'success', message: `Commande .${name} supprimée avec succès.` });
        fetchCustomCommands();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Échec de suppression de la commande.' });
    }
  };

  const handleCopy = (name: string) => {
    navigator.clipboard.writeText(`${prefix}${name}`);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-[#10B981]/15 border-[#10B981]/30 text-white'
              : 'bg-[#EF4444]/15 border-[#EF4444]/30 text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-[#10B981]" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#EF4444]" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs text-[#8E9EB5] hover:text-white underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Grid: Form (left) + List (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Create Command Form (5 cols) */}
        <div className="lg:col-span-5 glass-card p-6 rounded-2xl space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#3478F6]/10">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3478F6] to-[#16D9E8] flex items-center justify-center text-white">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#F5F7FF]">Nouvelle Commande</h3>
              <p className="text-xs text-[#8E9EB5]">Créez un raccourci ou réponse automatisée</p>
            </div>
          </div>

          <form onSubmit={handleCreateCommand} className="space-y-4">
            {/* Command Name */}
            <div>
              <label className="text-xs font-semibold text-[#8E9EB5] block mb-1.5">
                Nom de la commande
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono text-[#16D9E8] font-bold">
                  {prefix}
                </span>
                <input
                  type="text"
                  value={commandName}
                  onChange={(e) => setCommandName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="ex: regles, discord, vip, info"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-[#080F1F] border border-[#3478F6]/25 text-[#F5F7FF] placeholder-[#8E9EB5]/50 text-xs sm:text-sm font-mono focus:outline-none focus:border-[#16D9E8] transition-colors"
                  required
                />
              </div>
            </div>

            {/* Response Content */}
            <div>
              <label className="text-xs font-semibold text-[#8E9EB5] block mb-1.5">
                Texte de réponse automatique
              </label>
              <textarea
                value={commandText}
                onChange={(e) => setCommandText(e.target.value)}
                placeholder="Message à envoyer automatiquement quand quelqu'un tape cette commande..."
                rows={5}
                className="w-full px-4 py-3 rounded-xl bg-[#080F1F] border border-[#3478F6]/25 text-[#F5F7FF] placeholder-[#8E9EB5]/50 text-xs sm:text-sm focus:outline-none focus:border-[#16D9E8] transition-colors resize-none"
                required
              />
              <p className="text-[11px] text-[#8E9EB5] mt-1">
                Astuce : Vous pouvez utiliser du gras (*texte*), de l'italique (_texte_) ou des émojis.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#3478F6] to-[#16D9E8] text-white text-xs sm:text-sm font-bold shadow-md shadow-[#3478F6]/25 hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Créer la Commande</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Existing Commands List (7 cols) */}
        <div className="lg:col-span-7 glass-card p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#3478F6]/10">
            <div>
              <h3 className="text-sm font-bold text-[#F5F7FF] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#16D9E8]" />
                <span>Commandes Personnalisées Actives</span>
              </h3>
              <p className="text-xs text-[#8E9EB5]">Disponibles pour tous vos utilisateurs</p>
            </div>
            <button
              onClick={fetchCustomCommands}
              className="p-1.5 rounded-lg text-[#8E9EB5] hover:text-white hover:bg-white/5 border border-[#3478F6]/15"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {commands.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Terminal className="w-10 h-10 text-[#8E9EB5] mx-auto opacity-50" />
              <h4 className="text-sm font-bold text-[#F5F7FF]">Aucune commande personnalisée</h4>
              <p className="text-xs text-[#8E9EB5] max-w-sm mx-auto">
                Utilisez le formulaire à gauche pour créer votre première commande sur-mesure (ex: .{prefix}info, .{prefix}regles).
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {commands.map((cmd) => {
                const isCopied = copiedName === cmd.name;

                return (
                  <div
                    key={cmd.name}
                    className="p-4 rounded-xl bg-[#080F1F]/70 border border-[#3478F6]/15 space-y-2 hover:border-[#16D9E8]/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-[#16D9E8]">
                        {prefix}{cmd.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopy(cmd.name)}
                          className="p-1.5 rounded-lg bg-[#111C32] text-[#8E9EB5] hover:text-white border border-[#3478F6]/15"
                          title="Copier"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-[#10B981]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => onExecuteCommand(`${prefix}${cmd.name}`)}
                          className="p-1.5 rounded-lg bg-[#3478F6]/15 text-[#16D9E8] hover:bg-[#3478F6]/25 border border-[#16D9E8]/25"
                          title="Tester dans le simulateur"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCommand(cmd.name)}
                          className="p-1.5 rounded-lg bg-[#EF4444]/15 text-[#EF4444] hover:bg-[#EF4444]/25 border border-[#EF4444]/25"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#111C32] text-xs text-[#F5F7FF] whitespace-pre-wrap font-sans border border-white/5">
                      {cmd.description}
                    </div>

                    <div className="text-[11px] text-[#8E9EB5] text-right font-mono">
                      Créée le {new Date(cmd.createdAt || Date.now()).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
