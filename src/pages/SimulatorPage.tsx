import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Trash2,
  CheckCheck,
  Sparkles,
  Bot,
  User,
  Shield,
  ShieldAlert,
  Smartphone,
  RefreshCw,
  Terminal,
  Activity,
  Zap
} from 'lucide-react';
import { ConsoleMessage } from '../types';

interface SimulatorPageProps {
  initialCommand?: string | null;
  onClearInitialCommand?: () => void;
}

export const SimulatorPage: React.FC<SimulatorPageProps> = ({
  initialCommand,
  onClearInitialCommand,
}) => {
  const [messages, setMessages] = useState<ConsoleMessage[]>([
    {
      id: 'init-msg-1',
      sender: 'bot',
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      text: `╭─━━━━━━━━━━━━━━━⊷❖\n┇✦╭───────────────╮\n┋✧┋. ʙᴏᴛ ɴᴀᴍᴇ: ᴋᴀʏᴅᴏ ᴍɪɴɪ ʙᴏᴛ\n┋✧┋. ᴄᴏᴍᴍᴀɴᴅs: 300+\n┋✧┋. ᴏᴡɴᴇʀ: ᴋᴀʏᴅᴏ ᴅᴇᴠ\n┋✧┋. ᴘʟᴀᴛғᴏʀᴍ: ɴᴏᴅᴇᴊs / ʙᴀɪʟᴇʏs\n┋✧┋. ᴍᴏᴅᴇ: ᴘᴜʙʟɪᴄ / ꜱᴇᴄᴜʀᴇ\n┇✧╰───────────────╯\n╰━━━━━━━━━━━━━━━━━❖\n\n🛡️ Simulateur WhatsApp Kaydo Bot actif.\nTapez .menu pour afficher le menu complet ou testez vos commandes ci-dessous.`,
    },
  ]);

  const [inputCommand, setInputCommand] = useState('');
  const [executing, setExecuting] = useState(false);
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'member'>('owner');
  const [latency, setLatency] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, executing]);

  useEffect(() => {
    if (initialCommand) {
      handleRunCommand(initialCommand.startsWith('.') ? initialCommand : `.${initialCommand}`);
      if (onClearInitialCommand) onClearInitialCommand();
    }
  }, [initialCommand]);

  const handleRunCommand = async (cmdString: string) => {
    const trimmed = cmdString.trim();
    if (!trimmed || executing) return;

    const parts = trimmed.split(' ');
    const cmdName = parts[0];
    const args = parts.slice(1).join(' ');

    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const userMsg: ConsoleMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      timestamp: now,
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputCommand('');
    setExecuting(true);

    const startTime = performance.now();

    try {
      const res = await fetch('/api/commands/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: cmdName,
          args,
          role: userRole,
          isOwner: userRole === 'owner',
          isAdmin: userRole === 'admin' || userRole === 'owner',
        }),
      });

      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTime);
      setLatency(elapsed);

      const botMsg: ConsoleMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        timestamp: data.timestamp || now,
        text: data.reply || `Commande ${cmdName} exécutée sans réponse.`,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const botMsg: ConsoleMessage = {
        id: `bot-err-${Date.now()}`,
        sender: 'bot',
        timestamp: now,
        text: `⚠️ Erreur d'exécution de la commande : ${err instanceof Error ? err.message : 'Serveur inaccessible'}`,
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setExecuting(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: `clr-${Date.now()}`,
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        text: '🧹 Historique de la simulation réinitialisé.',
      },
    ]);
  };

  const quickCommands = [
    { label: '.menu', cmd: '.menu' },
    { label: '.ping', cmd: '.ping' },
    { label: '.uptime', cmd: '.uptime' },
    { label: '.status', cmd: '.status' },
    { label: '.admins', cmd: '.admins' },
    { label: '.kickall', cmd: '.kickall' },
    { label: '.purge', cmd: '.purge' },
    { label: '.promoteall', cmd: '.promoteall' },
    { label: '.demoteall', cmd: '.demoteall' },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Top Banner & Role selector */}
      <div className="bg-[#111C32]/90 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#3478F6]/20 text-[#16D9E8] border border-[#3478F6]/30">
              <Smartphone className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Simulateur WhatsApp en Direct</h2>
              <p className="text-xs text-[#8E9EB5]">
                Testez en conditions réelles les commandes avec permissions groupe / propriétaire
              </p>
            </div>
          </div>
        </div>

        {/* Role toggle */}
        <div className="flex items-center gap-2 bg-[#080F1F] p-1.5 rounded-xl border border-white/5">
          <span className="text-xs text-[#8E9EB5] px-2 font-medium flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-[#3478F6]" /> Rôle :
          </span>
          {(['owner', 'admin', 'member'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setUserRole(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                userRole === r
                  ? 'bg-gradient-to-r from-[#3478F6] to-[#16D9E8] text-white shadow-md shadow-[#3478F6]/25'
                  : 'text-[#8E9EB5] hover:text-white hover:bg-white/5'
              }`}
            >
              {r === 'owner' ? '👑 Owner' : r === 'admin' ? '🛡️ Admin' : '👤 Membre'}
            </button>
          ))}
        </div>
      </div>

      {/* Simulator Device Screen */}
      <div className="bg-[#080F1F] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[650px] relative">
        {/* WhatsApp Chat Header */}
        <div className="bg-[#111C32] border-b border-white/10 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#3478F6] to-[#16D9E8] flex items-center justify-center text-white font-bold shadow-lg shadow-[#3478F6]/30">
                <Bot className="w-6 h-6" />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#111C32] rounded-full"></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-bold text-sm">KAYDO MINI BOT</h3>
                <span className="text-[10px] bg-[#3478F6]/20 text-[#16D9E8] border border-[#3478F6]/30 px-2 py-0.5 rounded-full font-medium">
                  Baileys v6
                </span>
              </div>
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                en ligne • temps réel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {latency !== null && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-[#8E9EB5] bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                {latency} ms
              </span>
            )}
            <button
              onClick={clearChat}
              className="p-2 text-[#8E9EB5] hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
              title="Vider la discussion"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Security E2E Notice */}
        <div className="bg-[#111C32]/40 text-center py-2 px-4 border-b border-white/5 text-[11px] text-[#8E9EB5] flex items-center justify-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-[#16D9E8]" />
          <span>Protection Anti-Spam activée • Pacing adaptatif & Anti-Ban actif</span>
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#111C32]/20 via-[#080F1F] to-[#080F1F]">
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-[#111C32] border border-[#3478F6]/40 flex items-center justify-center text-[#16D9E8] text-xs flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-lg transition-all ${
                    isUser
                      ? 'bg-gradient-to-r from-[#3478F6] to-[#2563EB] text-white rounded-br-none'
                      : 'bg-[#111C32] border border-white/10 text-[#F5F7FF] rounded-bl-none font-sans'
                  }`}
                >
                  {/* Message body */}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap font-mono break-words">
                    {m.text}
                  </div>

                  {/* Message timestamp and status */}
                  <div
                    className={`flex items-center justify-end gap-1.5 mt-2 text-[10px] ${
                      isUser ? 'text-white/70' : 'text-[#8E9EB5]'
                    }`}
                  >
                    <span>{m.timestamp}</span>
                    {isUser && <CheckCheck className="w-3.5 h-3.5 text-cyan-200" />}
                  </div>
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-full bg-[#3478F6] flex items-center justify-center text-white text-xs flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing indicator */}
          {executing && (
            <div className="flex items-center gap-2 text-[#8E9EB5] text-xs animate-pulse">
              <div className="w-7 h-7 rounded-full bg-[#111C32] border border-[#3478F6]/40 flex items-center justify-center text-[#16D9E8]">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-[#111C32] border border-white/10 rounded-2xl rounded-bl-none px-4 py-2.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#16D9E8] animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-[#3478F6] animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 rounded-full bg-[#16D9E8] animate-bounce [animation-delay:0.4s]"></span>
                <span className="text-xs text-[#8E9EB5] ml-2">Kaydo Bot réfléchit...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick command buttons bar */}
        <div className="bg-[#111C32]/80 border-t border-white/5 px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[10px] text-[#8E9EB5] uppercase font-bold tracking-wider mr-1 flex items-center gap-1 flex-shrink-0">
            <Sparkles className="w-3 h-3 text-[#16D9E8]" /> Rapide :
          </span>
          {quickCommands.map((q) => (
            <button
              key={q.cmd}
              onClick={() => handleRunCommand(q.cmd)}
              disabled={executing}
              className="px-2.5 py-1 text-xs font-mono rounded-lg bg-[#080F1F] border border-white/10 text-white hover:text-[#16D9E8] hover:border-[#16D9E8]/40 transition-all flex-shrink-0 disabled:opacity-50"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunCommand(inputCommand);
          }}
          className="bg-[#111C32] border-t border-white/10 p-3 sm:p-4 flex items-center gap-3"
        >
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8E9EB5]">
              <Terminal className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={inputCommand}
              onChange={(e) => setInputCommand(e.target.value)}
              placeholder="Tapez une commande (ex: .menu, .kickall, .ping)..."
              disabled={executing}
              className="w-full bg-[#080F1F] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-[#8E9EB5] focus:outline-none focus:border-[#3478F6] focus:ring-1 focus:ring-[#3478F6] transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={!inputCommand.trim() || executing}
            className="p-3 rounded-xl bg-gradient-to-r from-[#3478F6] to-[#16D9E8] text-white hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-lg shadow-[#3478F6]/25 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
