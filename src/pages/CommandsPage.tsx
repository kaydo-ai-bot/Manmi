import React, { useState, useMemo } from 'react';
import {
  Search,
  Copy,
  Check,
  Terminal,
  Play,
  Filter,
  Shield,
  Crown,
  Sparkles,
} from 'lucide-react';
import { BOT_COMMANDS, COMMAND_CATEGORIES } from '../data/commands';
import { BotCommand } from '../types';

interface CommandsPageProps {
  onExecuteCommand: (commandName: string) => void;
  prefix?: string;
}

export const CommandsPage: React.FC<CommandsPageProps> = ({
  onExecuteCommand,
  prefix = '.',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const filteredCommands = useMemo(() => {
    return BOT_COMMANDS.filter((cmd) => {
      const matchesSearch =
        cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cmd.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cmd.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === 'all' || cmd.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const handleCopy = (cmd: BotCommand) => {
    const textToCopy = `${prefix}${cmd.name}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedCmd(cmd.name);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Search & Filter Bar */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8E9EB5] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une commande (.menu, .autolike, .kickall, .ping)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#080F1F] border border-[#3478F6]/20 text-[#F5F7FF] placeholder-[#8E9EB5]/50 text-xs sm:text-sm focus:outline-none focus:border-[#16D9E8] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-[#8E9EB5] hover:text-white absolute right-3 top-1/2 -translate-y-1/2"
              >
                Effacer
              </button>
            )}
          </div>

          {/* Counter Badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#080F1F] border border-[#3478F6]/15 text-xs text-[#8E9EB5] shrink-0 justify-between sm:justify-start">
            <span>Commandes trouvées :</span>
            <span className="font-mono font-bold text-[#16D9E8]">{filteredCommands.length}</span>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {COMMAND_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#3478F6] to-[#1e58c8] text-white shadow-md shadow-[#3478F6]/25 font-semibold'
                    : 'bg-[#080F1F] text-[#8E9EB5] hover:text-[#F5F7FF] hover:bg-[#111C32] border border-[#3478F6]/10'
                }`}
              >
                <span>{cat.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#111C32] text-[#8E9EB5]'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Commands Grid */}
      {filteredCommands.length === 0 ? (
        <div className="glass-card py-16 text-center rounded-2xl space-y-2">
          <Terminal className="w-10 h-10 text-[#8E9EB5] mx-auto opacity-50" />
          <h4 className="text-sm font-bold text-[#F5F7FF]">Aucune commande trouvée</h4>
          <p className="text-xs text-[#8E9EB5]">
            Essayez de modifier votre mot-clé de recherche ou sélectionnez une autre catégorie.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCommands.map((cmd) => {
            const isCopied = copiedCmd === cmd.name;

            return (
              <div
                key={cmd.name}
                className="glass-card glass-card-hover p-4 rounded-2xl flex flex-col justify-between space-y-3 group"
              >
                <div>
                  {/* Command Title & Badges */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#16D9E8] group-hover:text-white transition-colors">
                        {prefix}{cmd.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {cmd.adminOnly && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5" />
                          <span>Admin</span>
                        </span>
                      )}
                      {cmd.ownerOnly && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                          <Crown className="w-2.5 h-2.5" />
                          <span>Owner</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#8E9EB5] line-clamp-2 leading-relaxed">
                    {cmd.description}
                  </p>
                </div>

                {/* Usage Box & Actions */}
                <div className="space-y-2 pt-2 border-t border-[#3478F6]/10">
                  <div className="text-[11px] font-mono text-[#8E9EB5]/80 bg-[#080F1F] px-2.5 py-1 rounded-lg truncate border border-white/5">
                    {cmd.usage}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => handleCopy(cmd)}
                      className="flex-1 py-1.5 rounded-xl bg-[#080F1F] hover:bg-[#111C32] text-xs text-[#8E9EB5] hover:text-white border border-[#3478F6]/15 transition-all flex items-center justify-center gap-1.5"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#10B981]" />
                          <span className="text-[#10B981]">Copié !</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copier</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => onExecuteCommand(`${prefix}${cmd.name}`)}
                      className="flex-1 py-1.5 rounded-xl bg-[#3478F6]/15 hover:bg-[#3478F6]/25 text-xs font-semibold text-[#16D9E8] border border-[#16D9E8]/30 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Tester</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
