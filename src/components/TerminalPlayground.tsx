import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Send,
  Trash2,
  CheckCheck,
  Sparkles,
  Bot,
  User,
  Clock
} from 'lucide-react';
import { ConsoleMessage } from '../types';

interface TerminalPlaygroundProps {
  initialCommand?: string | null;
  onClearInitialCommand?: () => void;
  onNotificationTrigger?: () => void;
}

export const TerminalPlayground: React.FC<TerminalPlaygroundProps> = ({
  initialCommand,
  onClearInitialCommand,
  onNotificationTrigger,
}) => {
  const [messages, setMessages] = useState<ConsoleMessage[]>([
    {
      id: 'init-msg-1',
      sender: 'bot',
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      text: `*╭─━━━━━━━━━━━━━━━⊷❖*\n*┇*✦╭───────────────╮\n*┋✦┋. ʙᴏᴛ ɴᴀᴍᴇ:* 𝐙𝐋𝐊 𝐁𝐎𝐓 𓃶\n*┋✦┋. ᴏᴡɴᴇʀ:* 𝐊𝐀𝐘𝐃𝐎 𝐙𝐋𝐊 𓃶 & 𝐒𝐇𝐀𝐊𝐀 𝐙𝐋𝐊 𓃶\n*┋✦┋. ᴘʟᴀᴛғᴏʀᴍ:* Railway\n*┋✦┋. ᴍᴏᴅᴇ:* ᴘʀɪᴠᴇ́ 🔒\n*┇✦╰───────────────╯*\n*╰━━━━━━━━━━━━━━━━━❖*\n\nBienvenue dans la console WhatsApp de 𝐙𝐋𝐊 𝐁𝐎𝐓 𓃶 ! Tapez .menu pour tester le nouveau menu complet.`,
    },
  ]);

  const [inputCommand, setInputCommand] = useState('');
  const [executing, setExecuting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, executing]);

  // Handle triggered command from catalogue or hero
  useEffect(() => {
    if (initialCommand) {
      handleRunCommand(initialCommand.startsWith('.') ? initialCommand : `.${initialCommand}`);
      if (onClearInitialCommand) onClearInitialCommand();
    }
  }, [initialCommand]);

  const handleRunCommand = async (cmdString: string) => {
    const trimmed = cmdString.trim();
    if (!trimmed) return;

    const parts = trimmed.split(' ');
    const cmdName = parts[0];
    const args = parts.slice(1).join(' ');

    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // Add user message
    const userMsg: ConsoleMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      timestamp: now,
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputCommand('');
    setExecuting(true);

    try {
      const res = await fetch('/api/commands/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmdName, args }),
      });

      const data = await res.json();
      const botMsg: ConsoleMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        timestamp: data.timestamp || now,
        text: data.reply || `Commande ${cmdName} traitée.`,
      };

      setMessages((prev) => [...prev, botMsg]);
      if (onNotificationTrigger) onNotificationTrigger();
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          timestamp: now,
          text: `❌ Erreur lors de l'exécution : ${err.message || 'Serveur hors ligne'}`,
        },
      ]);
    } finally {
      setExecuting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleRunCommand(inputCommand);
  };

  const handleClear = () => {
    setMessages([]);
  };

  const QUICK_COMMANDS = [
    '.menu',
    'menu',
    '.excuse',
    '.vv',
    '.vv2',
    '.autolike ❤️',
    '.mode public',
    '.mode private',
    '.kickall',
    '.online',
    '.autorecording',
    '.autotyping=',
    '.ping',
    '.uptime',
    '.owner',
    '.ai Qui est Kaydo Scofield ?',
  ];

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Terminal className="w-5 h-5 text-amber-400" />
            Console Simulateur WhatsApp • KAYDO BOT
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Testez instantanément toutes les commandes (dont .vv2, .autolike, .online, .autorecording, .autotyping) et visualisez les réponses authentiques envoyées par le bot.
          </p>
        </div>

        <button
          onClick={handleClear}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-400 hover:text-red-400 transition-all flex items-center space-x-1.5 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Effacer l&apos;historique</span>
        </button>
      </div>

      {/* WhatsApp-styled Chat Container */}
      <div className="rounded-2xl border border-slate-800 overflow-hidden bg-[#0a0e17] flex flex-col h-[580px] shadow-2xl">
        {/* WhatsApp Chat Header */}
        <div className="px-4 py-3 bg-[#111827] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-bold text-base shadow-md ring-2 ring-emerald-500/30">
              👑
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-white">KAYDO BOT</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              </div>
              <p className="text-[11px] text-emerald-400">en ligne • Multi-Device Bot</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-[11px] text-emerald-300">
              Préfixe : .
            </span>
          </div>
        </div>

        {/* Messages Feed */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-radial from-[#0e1626]/60 via-[#0a0e17] to-[#070a10]">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs">
              Aucun message. Entrez une commande ci-dessous pour démarrer !
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 shadow-lg ${
                    msg.sender === 'user'
                      ? 'bg-emerald-700/90 text-white rounded-tr-none border border-emerald-500/30'
                      : 'bg-[#182234] text-slate-100 rounded-tl-none border border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      {msg.sender === 'user' ? 'Vous' : '👑 KAYDO BOT'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      {msg.timestamp}
                      {msg.sender === 'user' && <CheckCheck className="w-3 h-3 text-cyan-300" />}
                    </span>
                  </div>

                  <div className="font-mono text-xs whitespace-pre-wrap leading-relaxed select-text">
                    {msg.text}
                  </div>
                </div>
              </div>
            ))
          )}

          {executing && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-tl-none p-3 bg-[#182234] text-slate-400 text-xs flex items-center space-x-2 border border-slate-700/80">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>KAYDO BOT est en train d&apos;écrire...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Commands Shortcuts Bar */}
        <div className="px-3 py-2 bg-[#0f1422] border-t border-slate-800/80 flex items-center space-x-2 overflow-x-auto">
          <span className="text-[11px] text-slate-500 shrink-0 font-medium">Suggestions :</span>
          {QUICK_COMMANDS.map((qCmd) => (
            <button
              key={qCmd}
              onClick={() => handleRunCommand(qCmd)}
              className="px-2.5 py-1 rounded-md bg-slate-800/90 hover:bg-emerald-600/20 hover:border-emerald-500/40 text-[11px] font-mono text-slate-300 hover:text-emerald-300 border border-slate-700 shrink-0 transition-all cursor-pointer"
            >
              {qCmd}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSubmit} className="p-3 bg-[#111827] border-t border-slate-800 flex items-center space-x-2">
          <input
            type="text"
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            placeholder="Tapez votre commande (ex: .menu ou menu, .kickall, .autolike ❤️, .mode private...)..."
            className="flex-1 h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            disabled={executing}
          />
          <button
            type="submit"
            disabled={executing || !inputCommand.trim()}
            className="h-11 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-500/20"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Envoyer</span>
          </button>
        </form>
      </div>
    </div>
  );
};
