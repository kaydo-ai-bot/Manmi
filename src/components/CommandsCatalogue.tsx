import React, { useState } from 'react';
import {
  Search,
  Copy,
  Check,
  Terminal,
  Sparkles,
  BookOpen,
  Filter,
  Shield,
  Crown,
  Music,
  Smile,
  Wrench,
  Ghost,
  Cpu,
  PenTool,
  Home,
  Eye,
  Heart,
  Wifi,
  Mic,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { BotCommand } from '../types';
import { COMMAND_CATEGORIES, BOT_COMMANDS } from '../data/commands';
import { generateOfficialMenu } from '../utils/textStyler';

interface CommandsCatalogueProps {
  onExecuteCommand: (cmdName: string) => void;
}

export const CommandsCatalogue: React.FC<CommandsCatalogueProps> = ({ onExecuteCommand }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [showStretchedMenu, setShowStretchedMenu] = useState<boolean>(false);

  const filteredCommands = BOT_COMMANDS.filter((cmd) => {
    const matchesCategory = selectedCategory === 'all' || cmd.category === selectedCategory;
    const matchesSearch =
      cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cmd.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cmd.usage.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCopy = (commandName: string) => {
    navigator.clipboard.writeText(`.${commandName}`);
    setCopiedCmd(commandName);
    setTimeout(() => setCopiedCmd(null), 1800);
  };

  const getCategoryIcon = (categoryId: string) => {
    switch (categoryId) {
      case 'main':
        return <Home className="w-3.5 h-3.5" />;
      case 'moderation':
        return <Shield className="w-3.5 h-3.5" />;
      case 'owner':
        return <Crown className="w-3.5 h-3.5" />;
      case 'media':
        return <Music className="w-3.5 h-3.5" />;
      case 'fun':
        return <Smile className="w-3.5 h-3.5" />;
      case 'anime':
        return <Ghost className="w-3.5 h-3.5" />;
      case 'textmaker':
        return <PenTool className="w-3.5 h-3.5" />;
      default:
        return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Spotlight: 4 New High-Priority Requested Commands */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-cyan-950/60 border border-emerald-500/40 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center space-x-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Nouveautés & Automatisations Exclusives
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Nouveau v4.5
            </span>
          </div>

          <button
            onClick={() => setShowStretchedMenu(!showStretchedMenu)}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{showStretchedMenu ? 'Masquer Menu Étiré' : 'Voir Menu Officiel Étiré'}</span>
            {showStretchedMenu ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* 5 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {/* 1. .vv & .vv2 */}
          <div className="bg-slate-950/80 border border-emerald-500/30 hover:border-emerald-400 rounded-xl p-3.5 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono font-extrabold text-sm text-emerald-400 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  .vv / .vv2
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300">
                  Anti-Vue Unique
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug mb-3">
                <strong>.vv</strong> : renvoie la vue unique dans le groupe/contact actuel. <strong>.vv2</strong> : l&apos;envoie discrètement en privé (DM).
              </p>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => handleCopy('vv')}
                className="flex-1 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-semibold text-slate-300 transition-all flex items-center justify-center space-x-1 border border-slate-700"
              >
                {copiedCmd === 'vv' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCmd === 'vv' ? 'Copié' : '.vv'}</span>
              </button>
              <button
                onClick={() => onExecuteCommand('vv2')}
                className="flex-1 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-[10px] font-semibold text-emerald-300 transition-all flex items-center justify-center space-x-1 border border-emerald-500/40"
              >
                <Terminal className="w-3 h-3" />
                <span>.vv2 (PV)</span>
              </button>
            </div>
          </div>

          {/* 2. .autolike */}
          <div className="bg-slate-950/80 border border-pink-500/30 hover:border-pink-400 rounded-xl p-3.5 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono font-extrabold text-sm text-pink-400 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-pink-400" />
                  .autolike
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-pink-500/20 text-pink-300">
                  Statut Emoji
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug mb-3">
                Like automatiquement les statuts WhatsApp de vos contacts dès leur publication avec l&apos;émoji voulu.
              </p>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => handleCopy('autolike ❤️')}
                className="flex-1 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-semibold text-slate-300 transition-all flex items-center justify-center space-x-1 border border-slate-700"
              >
                {copiedCmd === 'autolike ❤️' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCmd === 'autolike ❤️' ? 'Copié' : 'Copier'}</span>
              </button>
              <button
                onClick={() => onExecuteCommand('autolike ❤️')}
                className="flex-1 py-1 rounded bg-pink-600/30 hover:bg-pink-600/50 text-[10px] font-semibold text-pink-300 transition-all flex items-center justify-center space-x-1 border border-pink-500/40"
              >
                <Terminal className="w-3 h-3" />
                <span>Tester</span>
              </button>
            </div>
          </div>

          {/* 3. .online */}
          <div className="bg-slate-950/80 border border-cyan-500/30 hover:border-cyan-400 rounded-xl p-3.5 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono font-extrabold text-sm text-cyan-400 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                  .online
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300">
                  Always Online
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug mb-3">
                Même déconnecté ou téléphone éteint, quand quelqu&apos;un vous écrit, il voit que vous êtes en ligne 24/7.
              </p>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => handleCopy('online on')}
                className="flex-1 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-semibold text-slate-300 transition-all flex items-center justify-center space-x-1 border border-slate-700"
              >
                {copiedCmd === 'online on' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCmd === 'online on' ? 'Copié' : 'Copier'}</span>
              </button>
              <button
                onClick={() => onExecuteCommand('online on')}
                className="flex-1 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-[10px] font-semibold text-cyan-300 transition-all flex items-center justify-center space-x-1 border border-cyan-500/40"
              >
                <Terminal className="w-3 h-3" />
                <span>Tester</span>
              </button>
            </div>
          </div>

          {/* 4. .autorecording */}
          <div className="bg-slate-950/80 border border-amber-500/30 hover:border-amber-400 rounded-xl p-3.5 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono font-extrabold text-sm text-amber-400 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-amber-400" />
                  .autorecording
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300">
                  Vocal Fictif
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug mb-3">
                Affiche en direct &quot;En train d&apos;enregistrer un message vocal...&quot; dès qu&apos;un contact vous écrit.
              </p>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => handleCopy('autorecording on')}
                className="flex-1 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-semibold text-slate-300 transition-all flex items-center justify-center space-x-1 border border-slate-700"
              >
                {copiedCmd === 'autorecording on' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCmd === 'autorecording on' ? 'Copié' : 'Copier'}</span>
              </button>
              <button
                onClick={() => onExecuteCommand('autorecording on')}
                className="flex-1 py-1 rounded bg-amber-600/30 hover:bg-amber-600/50 text-[10px] font-semibold text-amber-300 transition-all flex items-center justify-center space-x-1 border border-amber-500/40"
              >
                <Terminal className="w-3 h-3" />
                <span>Tester</span>
              </button>
            </div>
          </div>

          {/* 5. .autotyping */}
          <div className="bg-slate-950/80 border border-purple-500/30 hover:border-purple-400 rounded-xl p-3.5 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono font-extrabold text-sm text-purple-400 flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-purple-400" />
                  .autotyping
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300">
                  Écriture 24/7
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug mb-3">
                Affiche &quot;En train d&apos;écrire...&quot; en continu permanent (durée à jamais) dès qu&apos;on vous écrit.
              </p>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => handleCopy('autotyping=')}
                className="flex-1 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-semibold text-slate-300 transition-all flex items-center justify-center space-x-1 border border-slate-700"
              >
                {copiedCmd === 'autotyping=' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCmd === 'autotyping=' ? 'Copié' : 'Copier'}</span>
              </button>
              <button
                onClick={() => onExecuteCommand('autotyping=')}
                className="flex-1 py-1 rounded bg-purple-600/30 hover:bg-purple-600/50 text-[10px] font-semibold text-purple-300 transition-all flex items-center justify-center space-x-1 border border-purple-500/40"
              >
                <Terminal className="w-3 h-3" />
                <span>Tester</span>
              </button>
            </div>
          </div>
        </div>

        {/* Expandable Stretched Menu (.menu) Display */}
        {showStretchedMenu && (
          <div className="mt-4 p-4 rounded-xl bg-black/80 border border-emerald-500/30 font-mono text-xs overflow-x-auto text-emerald-400">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800 text-slate-300 text-[11px]">
              <span className="font-bold flex items-center gap-1.5 text-emerald-300">
                <BookOpen className="w-3.5 h-3.5" />
                Rendu du Menu Officiel Étiré (.menu)
              </span>
              <a
                href="https://wa.me/50935975863"
                target="_blank"
                rel="noreferrer"
                className="flex items-center space-x-1 text-emerald-400 hover:underline"
              >
                <span>WhatsApp Owner: +509 3597 5863</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <pre className="whitespace-pre select-all text-[11px] leading-relaxed max-h-[500px] overflow-y-auto">
{generateOfficialMenu('Actif 24/7')}
            </pre>
          </div>
        )}
      </div>

      {/* Search & Category Filter Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              Catalogue des Commandes • KAYDO BOT (294)
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Explorez toutes les commandes intégrées avec préfixe officiel <code className="text-emerald-400 font-mono">.</code>
            </p>
          </div>

          {/* Search Bar */}
          <div className="w-full md:w-80 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une commande (.vv2, .autolike, .online)..."
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Category Pill Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 pt-1">
          {COMMAND_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center space-x-1.5 transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {getCategoryIcon(cat.id)}
              <span>{cat.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedCategory === cat.id ? 'bg-slate-900/40 text-slate-900' : 'bg-slate-800 text-slate-500'
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Commands Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredCommands.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 text-sm">
            Aucune commande ne correspond à votre recherche &quot;{searchQuery}&quot;.
          </div>
        ) : (
          filteredCommands.map((cmd) => (
            <div
              key={cmd.name}
              className={`bg-[#0f1422] border ${
                ['vv2', 'autolike', 'online', 'autorecording', 'autotyping'].includes(cmd.name)
                  ? 'border-emerald-500/50 ring-1 ring-emerald-500/20'
                  : 'border-slate-800/90'
              } hover:border-emerald-500/40 rounded-xl p-4 transition-all group flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-base text-emerald-400">
                      .{cmd.name}
                    </span>
                    {['vv2', 'autolike', 'online', 'autorecording', 'autotyping'].includes(cmd.name) && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Nouveau
                      </span>
                    )}
                    {cmd.adminOnly && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Admin
                      </span>
                    )}
                    {cmd.ownerOnly && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        Owner
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    {cmd.category}
                  </span>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2 mb-3">
                  {cmd.description}
                </p>
              </div>

              <div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 mb-3 font-mono text-[11px] text-slate-400 truncate">
                  <span className="text-emerald-500/70 mr-1">$</span>
                  {cmd.usage}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleCopy(cmd.name)}
                    className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white transition-all flex items-center justify-center space-x-1 border border-slate-700/60 cursor-pointer"
                  >
                    {copiedCmd === cmd.name ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copié</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copier</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => onExecuteCommand(cmd.name)}
                    className="flex-1 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-[11px] font-semibold text-emerald-300 transition-all flex items-center justify-center space-x-1 border border-emerald-500/30 cursor-pointer"
                  >
                    <Terminal className="w-3 h-3" />
                    <span>Tester</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
