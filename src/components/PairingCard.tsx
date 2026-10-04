import React, { useState, useEffect } from 'react';
import {
  Zap,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  PowerOff,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { PairingResponse } from '../types';
import { saveMySession, getMySessions, removeMySession } from '../utils/userSessions';

interface PairingCardProps {
  onNotificationTrigger?: () => void;
  onGoToOwner?: () => void;
  activeSessionsCount?: number;
}

export const PairingCard: React.FC<PairingCardProps> = ({
  onNotificationTrigger,
  onGoToOwner,
  activeSessionsCount = 0,
}) => {
  const { currentTheme } = useTheme();

  const [server, setServer] = useState('srv-1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pairingData, setPairingData] = useState<PairingResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [pairedSuccess, setPairedSuccess] = useState(false);

  // Disconnect session state
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [disconnectPhone, setDisconnectPhone] = useState('');
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [disconnectMessage, setDisconnectMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Pre-fill disconnect phone if user has saved sessions
  useEffect(() => {
    const saved = getMySessions();
    if (saved.length > 0 && !disconnectPhone) {
      setDisconnectPhone(saved[0].phone || saved[0].sessionId.replace(/^session_/, ''));
    }
  }, [disconnectPhone]);

  // Timer countdown
  useEffect(() => {
    if (!pairingData || !pairingData.code || timeLeft <= 0 || pairedSuccess) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pairingData, timeLeft, pairedSuccess]);

  // Status polling to check if user verified code on WhatsApp
  useEffect(() => {
    if (!pairingData?.sessionId || pairedSuccess) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pair/status/${pairingData.sessionId}`);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.status === 'paired') {
            setPairedSuccess(true);
            clearInterval(interval);
            if (pairingData.sessionId) {
              saveMySession(pairingData.sessionId, phoneNumber);
            }
            if (onNotificationTrigger) onNotificationTrigger();
          }
        }
      } catch (err) {
        // ignore polling hiccups
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pairingData, pairedSuccess, phoneNumber, onNotificationTrigger]);

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPairingData(null);
    setPairedSuccess(false);

    const cleanInput = phoneNumber.replace(/[^0-9]/g, '');
    if (!cleanInput || cleanInput.length < 8 || cleanInput.length > 15) {
      setError("Veuillez renseigner un numéro WhatsApp valide avec l'indicatif pays (ex: 509XXXXXXXX).");
      return;
    }

    setLoading(true);
    setLoadingStep('Connexion sécurisée au cluster WhatsApp...');

    try {
      setTimeout(() => {
        setLoadingStep('Génération de la clé de liaison E2EE...');
      }, 1200);

      const res = await fetch('/api/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanInput }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'WhatsApp a refusé la demande. Vérifiez le numéro.');
      }

      setPairingData({
        success: true,
        code: data.code,
        formattedCode: data.formattedCode || data.code,
        sessionId: data.sessionId,
        status: 'pending',
        expiresInSeconds: data.expiresInSeconds || 300,
        message: data.message,
      });

      if (data.sessionId) {
        saveMySession(data.sessionId, cleanInput);
      }
      setTimeLeft(data.expiresInSeconds || 300);
      if (onNotificationTrigger) onNotificationTrigger();
    } catch (err: any) {
      setError(err.message || 'Échec de connexion aux serveurs WhatsApp.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleCopyCode = () => {
    if (!pairingData?.code) return;
    navigator.clipboard.writeText(pairingData.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDisconnectSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisconnectMessage(null);
    const clean = disconnectPhone.replace(/\D/g, '');
    if (!clean || clean.length < 8) {
      setDisconnectMessage({
        text: 'Veuillez saisir le numéro de la session à déconnecter (ex: 50935975863).',
        isError: true,
      });
      return;
    }

    setDisconnectLoading(true);
    try {
      const res = await fetch('/api/sessions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean, sessionId: `session_${clean}` }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Erreur lors de la déconnexion.');
      }

      removeMySession(`session_${clean}`);
      setDisconnectMessage({
        text: `Session +${clean} déconnectée et nettoyée avec succès.`,
        isError: false,
      });
      if (onNotificationTrigger) onNotificationTrigger();
    } catch (err: any) {
      setDisconnectMessage({
        text: err?.message || 'Impossible de déconnecter cette session.',
        isError: true,
      });
    } finally {
      setDisconnectLoading(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full max-w-[430px] mx-auto">
      {/* Outer Card with glowing neon border */}
      <div
        className={`relative bg-[#090a12]/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-7 border ${currentTheme.cardBorder} ${currentTheme.cardGlow} transition-all duration-300`}
      >
        {/* Top Glow Accent Orb */}
        <div
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-44 h-44 rounded-full blur-3xl pointer-events-none opacity-25"
          style={{ backgroundColor: currentTheme.colorHex }}
        />

        {/* Circular Avatar / Logo */}
        <div className="relative mx-auto mb-5 w-24 h-24 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full blur-md opacity-70 animate-pulse"
            style={{ backgroundColor: currentTheme.colorHex }}
          />
          <div
            className="relative w-24 h-24 rounded-full p-1 border-2 shadow-xl bg-[#0b0c16] overflow-hidden"
            style={{ borderColor: currentTheme.colorHex }}
          >
            <img
              src="https://files.catbox.moe/9u2j5v.png"
              alt="KAYDO BOT V2"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://files.catbox.moe/9u2j5v.png';
              }}
            />
          </div>
        </div>

        {/* Subtitle kicker */}
        <div className="text-center space-y-1">
          <div
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.25em] uppercase"
            style={{ color: currentTheme.colorHex }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>PAIRING PORTAL</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-mono uppercase">
            KAYDO BOT V2 <span style={{ color: currentTheme.colorHex }}>𓃶</span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Connectez votre WhatsApp en un éclair
          </p>
        </div>

        {/* Form Container */}
        <form onSubmit={handleRequestPairingCode} className="mt-6 space-y-4">
          {/* Server Selector Dropdown */}
          <div className="space-y-1.5">
            <div className="relative">
              <select
                id="server-select"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                className="w-full appearance-none bg-[#111222] border border-slate-800 text-slate-200 text-xs sm:text-sm rounded-xl px-4 py-3 pr-10 focus:outline-none focus:border-slate-600 transition-colors cursor-pointer"
              >
                <option value="srv-1">● Serveur 01 • Port Principal (Haute Vitesse)</option>
                <option value="srv-2">● Serveur 02 • Cluster Cloud 24/7 (Multi-Device)</option>
                <option value="srv-3">● Serveur 03 • Passerelle Baileys Basse Latence</option>
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* WhatsApp Phone Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="phone-input"
              className="block text-[10px] font-bold tracking-widest text-slate-400 uppercase"
            >
              NUMÉRO WHATSAPP (INDICATIF PAYS)
            </label>
            <div className="relative">
              <input
                id="phone-input"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="509XXXXXXXX"
                autoComplete="tel"
                disabled={loading}
                className="w-full bg-[#111222] border border-slate-800 text-white font-mono text-base sm:text-lg rounded-xl px-4 py-3.5 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-center tracking-wider"
              />
            </div>
          </div>

          {/* Generate Code CTA Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full relative group overflow-hidden py-3.5 px-6 rounded-2xl font-bold text-sm sm:text-base text-white bg-gradient-to-r ${currentTheme.buttonGradient} ${currentTheme.buttonGlow} active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Génération en cours...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                <span className="tracking-wide">⚡ GÉNÉRER MON CODE</span>
              </>
            )}
          </button>

          {/* Micro Helper Note */}
          <p className="text-[11px] text-center text-slate-500">
            Sans + ni espaces. Ex : <span className="font-mono text-slate-400">50935975863</span>
          </p>
        </form>

        {/* Step progress during request */}
        {loadingStep && (
          <div className="mt-4 p-3 rounded-xl bg-purple-950/40 border border-purple-500/20 text-center space-y-1 animate-pulse">
            <p className="text-xs text-purple-300 font-medium">{loadingStep}</p>
          </div>
        )}

        {/* Error message display */}
        {error && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold">Erreur de jumelage :</span>
              <p className="text-rose-200/90 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Successful Pairing Code Display Card */}
        {pairingData?.code && (
          <div className="mt-5 p-4 rounded-2xl bg-[#111222] border border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.2)] space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Code Officiel Reçu
              </span>
              <span className="font-mono text-amber-400 font-bold">
                Expire dans : {formatTimer(timeLeft)}
              </span>
            </div>

            {/* Code Box */}
            <div className="relative p-3.5 rounded-xl bg-black/60 border border-purple-500/40 flex items-center justify-between">
              <span className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-white selection:bg-purple-600">
                {pairingData.formattedCode || pairingData.code}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copié !</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copier</span>
                  </>
                )}
              </button>
            </div>

            {/* Step Instructions */}
            <div className="text-[11px] text-slate-300 space-y-1 bg-black/30 p-2.5 rounded-lg border border-slate-800">
              <p className="font-semibold text-slate-200">Comment associer :</p>
              <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
                <li>Ouvrez WhatsApp sur votre téléphone</li>
                <li>Allez dans <strong>Appareils connectés &gt; Connecter un appareil</strong></li>
                <li>Choisissez <strong>Associer avec un numéro de téléphone</strong></li>
                <li>Collez le code à 8 caractères</li>
              </ol>
            </div>

            {/* Quick Open WhatsApp Link */}
            <a
              href="https://wa.me"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full block text-center py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-all"
            >
              Ouvrir WhatsApp directement ↗
            </a>
          </div>
        )}

        {/* Paired Success banner */}
        {pairedSuccess && (
          <div className="mt-5 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-center space-y-2 animate-in zoom-in-95">
            <div className="inline-flex p-2 rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-emerald-300">Jumelage WhatsApp Réussi !</h4>
            <p className="text-xs text-emerald-200/80">
              Votre session SHADO BOT est maintenant connectée 24h/24 et 7j/7. Tapez{' '}
              <strong className="text-white">.menu</strong> sur WhatsApp pour voir toutes les commandes.
            </p>
          </div>
        )}

        {/* Section: Déconnecter une session */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowDisconnect(!showDisconnect)}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-purple-400/90 hover:text-purple-300 transition-colors py-1 px-3 rounded-lg hover:bg-purple-950/30"
            >
              <PowerOff className="w-3.5 h-3.5 text-purple-400" />
              <span>🔌 Déconnecter une session</span>
            </button>
          </div>

          {/* Disconnect Panel Drawer */}
          {showDisconnect && (
            <form onSubmit={handleDisconnectSession} className="mt-3 p-3.5 rounded-xl bg-[#111222] border border-slate-800 space-y-2.5 animate-in fade-in duration-150">
              <label htmlFor="disconnect-phone" className="block text-[10px] font-mono text-slate-400 uppercase">
                Numéro de la session à fermer
              </label>
              <div className="flex gap-2">
                <input
                  id="disconnect-phone"
                  type="tel"
                  value={disconnectPhone}
                  onChange={(e) => setDisconnectPhone(e.target.value)}
                  placeholder="509XXXXXXXX"
                  className="flex-1 bg-black/60 border border-slate-700 text-white font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-rose-500"
                />
                <button
                  type="submit"
                  disabled={disconnectLoading}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-60 cursor-pointer flex items-center gap-1"
                >
                  {disconnectLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Déconnecter</span>
                  )}
                </button>
              </div>

              {disconnectMessage && (
                <p
                  className={`text-xs ${
                    disconnectMessage.isError ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {disconnectMessage.text}
                </p>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Dynamic Connected Sessions Indicator */}
      <div className="mt-6 flex flex-col items-center justify-center space-y-2 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-emerald-400 tracking-wider">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
          </span>
          <span>{activeSessionsCount} sessions connectées</span>
        </div>

        <p className="text-[11px] font-mono tracking-widest text-slate-500 uppercase">
          CREATED FOR KAYDO
        </p>
      </div>
    </div>
  );
};
