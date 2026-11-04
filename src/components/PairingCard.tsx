import React, { useState, useEffect } from 'react';
import {
  Zap,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Sparkles,
  QrCode,
  Smartphone,
  ShieldCheck,
  PowerOff,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { PairingResponse } from '../types';
import { saveMySession, getMySessions, removeMySession } from '../utils/userSessions';
import {
  BOT_NAME,
  BOT_DISPLAY_NAME,
  BOT_TAGLINE,
  BOT_SERVERS,
  BOT_OWNER,
} from '../utils/branding';

interface PairingCardProps {
  onNotificationTrigger?: () => void;
  onGoToOwner?: () => void;
  activeSessionsCount?: number;
}

export const PairingCard: React.FC<PairingCardProps> = ({
  onNotificationTrigger,
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
  const [mode, setMode] = useState<'code' | 'qr'>('code');

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
    if (!pairingData || (!pairingData.code && !pairingData.qrCodeUrl) || timeLeft <= 0 || pairedSuccess) return;
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
              saveMySession(pairingData.sessionId, phoneNumber || 'Session_WA');
            }
            if (onNotificationTrigger) onNotificationTrigger();
          }
        }
      } catch (err) {
        // ignore polling network hiccups
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
      setError("Veuillez renseigner un numéro WhatsApp valide avec l'indicatif pays (ex: 50935975863 ou 33612345678).");
      return;
    }

    setLoading(true);
    setLoadingStep('Connexion sécurisée aux serveurs officiels WhatsApp...');

    try {
      setTimeout(() => {
        setLoadingStep('Négociation du protocole Signal & génération du code...');
      }, 1100);

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

  const handleRequestQrCode = async () => {
    setError(null);
    setPairingData(null);
    setPairedSuccess(false);
    setLoading(true);
    setLoadingStep('Initialisation du socket WhatsApp Web & génération du QR code...');

    try {
      const res = await fetch('/api/pair-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la génération du QR code WhatsApp.');
      }
      setPairingData({
        success: true,
        qrCodeUrl: data.qrDataUrl,
        sessionId: data.sessionId,
        status: 'pending',
        expiresInSeconds: data.expiresInSeconds || 60,
      });
      if (data.sessionId) {
        saveMySession(data.sessionId, 'QR_Session');
      }
      setTimeLeft(data.expiresInSeconds || 60);
      if (onNotificationTrigger) onNotificationTrigger();
    } catch (err: any) {
      setError(err.message || 'Impossible de générer le QR code WhatsApp.');
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
        text: 'Veuillez saisir le numéro complet avec indicatif de la session à déconnecter.',
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
        text: `Session +${clean} déconnectée avec succès.`,
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

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'kaydomd.up.railway.app';

  return (
    <div className="w-full max-w-[440px] mx-auto">
      {/* Outer Card with Glowing Purple Neon Border matching Screenshot */}
      <div className="relative bg-[#080812]/95 backdrop-blur-3xl rounded-[32px] p-6 sm:p-8 border border-purple-600/40 shadow-[0_0_60px_rgba(147,51,234,0.18)] transition-all duration-300">
        {/* Subtle Ambient Glow behind the card */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-[80px] pointer-events-none bg-purple-600/20" />
        <div className="absolute -bottom-16 right-0 w-44 h-44 rounded-full blur-[90px] pointer-events-none bg-blue-600/15" />

        {/* Circular Avatar / Logo with Neon Ring matching Screenshot */}
        <div className="relative mx-auto mb-4 w-28 h-28 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full blur-md bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 opacity-80 animate-pulse" />
          <div className="relative w-28 h-28 rounded-full p-[3px] bg-gradient-to-tr from-purple-500 via-violet-500 to-blue-500 shadow-2xl overflow-hidden">
            <div className="w-full h-full rounded-full bg-[#07070e] overflow-hidden flex items-center justify-center">
              <img
                src="/kaydo.jpg"
                alt={BOT_NAME}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/kaydo_bot.png';
                }}
              />
            </div>
          </div>
        </div>

        {/* Header Titles */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-bold tracking-[0.2em] uppercase text-purple-300/95">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>PAIRING PORTAL</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            <span>{BOT_NAME}</span>
            <span className="text-purple-300 text-xl">𓃶</span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-300/90 font-medium pt-0.5">
            {BOT_TAGLINE}
          </p>
        </div>

        {/* Mode Selector Pill: Code de jumelage / QR Code */}
        <div className="mt-5 p-1 bg-[#0f1022] rounded-2xl border border-purple-900/40 flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setMode('code');
              setPairingData(null);
              setError(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'code'
                ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Code 8 chiffres</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('qr');
              setPairingData(null);
              setError(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'qr'
                ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR Code</span>
          </button>
        </div>

        {/* MODE: PAIRING CODE (Primary) */}
        {mode === 'code' && (
          <form onSubmit={handleRequestPairingCode} className="mt-5 space-y-4">
            {/* Server Selector Dropdown */}
            <div className="space-y-1.5">
              <div className="relative">
                <select
                  id="server-select"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  className="w-full appearance-none bg-[#0e0f22] border border-purple-900/50 hover:border-purple-600/60 text-slate-200 text-xs sm:text-sm rounded-2xl px-4 py-3.5 pr-10 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all cursor-pointer shadow-inner"
                >
                  {BOT_SERVERS.map((srv) => (
                    <option key={srv.id} value={srv.id} className="bg-[#0b0c1c] text-white py-1">
                      ● {srv.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-purple-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* WhatsApp Phone Input */}
            <div className="space-y-1.5">
              <label
                htmlFor="phone-input"
                className="block text-[11px] font-bold tracking-wider text-purple-300/80 uppercase"
              >
                NUMÉRO WHATSAPP (INDICATIF PAYS)
              </label>
              <div className="relative">
                <input
                  id="phone-input"
                  type="tel"
                  inputMode="numeric"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="509XXXXXXXX"
                  autoComplete="tel"
                  disabled={loading}
                  className="w-full bg-[#0e0f22] border border-purple-900/50 hover:border-purple-600/60 text-white font-mono text-base sm:text-lg rounded-2xl px-4 py-3.5 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/40 transition-all text-center tracking-widest shadow-inner disabled:opacity-50"
                />
              </div>
            </div>

            {/* Generate Code CTA Button with Vivid Violet/Blue Gradient matching Screenshot */}
            <button
              type="submit"
              disabled={loading}
              className="w-full relative group overflow-hidden py-4 px-6 rounded-2xl font-extrabold text-sm sm:text-base text-white bg-gradient-to-r from-[#9333ea] via-[#7c3aed] to-[#3b82f6] hover:from-[#a855f7] hover:to-[#60a5fa] shadow-[0_0_35px_rgba(147,51,234,0.45)] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-white" />
                  <span>GÉNÉRATION EN COURS...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300 -ml-1.5" />
                  <span>GÉNÉRER MON CODE</span>
                </>
              )}
            </button>

            {/* Subtext Note */}
            <p className="text-[11px] text-center text-slate-400/90 pt-1">
              Sans + ni espaces. Ex : <strong className="text-slate-200 font-mono">50935975863</strong>
            </p>
          </form>
        )}

        {/* MODE: QR CODE */}
        {mode === 'qr' && (
          <div className="mt-5 space-y-4">
            <button
              type="button"
              onClick={handleRequestQrCode}
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl font-extrabold text-sm sm:text-base text-white bg-gradient-to-r from-[#9333ea] via-[#7c3aed] to-[#3b82f6] hover:from-[#a855f7] hover:to-[#60a5fa] shadow-[0_0_35px_rgba(147,51,234,0.45)] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-white" />
                  <span>CHARGEMENT DU QR...</span>
                </>
              ) : (
                <>
                  <QrCode className="w-5 h-5" />
                  <span>AFFICHER LE QR CODE</span>
                </>
              )}
            </button>

            {pairingData?.qrCodeUrl && (
              <div className="p-4 rounded-2xl bg-white flex flex-col items-center justify-center space-y-2 shadow-2xl">
                <img
                  src={pairingData.qrCodeUrl}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64 object-contain"
                />
                <span className="text-xs font-mono text-slate-800 font-semibold">
                  Expire dans {formatTimer(timeLeft)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Step progress during request */}
        {loadingStep && (
          <div className="mt-4 p-3 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-center space-y-1 animate-pulse">
            <p className="text-xs text-purple-300 font-medium">{loadingStep}</p>
          </div>
        )}

        {/* Error message display */}
        {error && (
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5 shadow-lg">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-left">
              <span className="font-semibold text-rose-200">Erreur de jumelage :</span>
              <p className="text-rose-200/90 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Successful Pairing Code Display Card */}
        {pairingData?.code && (
          <div className="mt-5 p-4 rounded-2xl bg-[#0f1025] border border-purple-500/50 shadow-[0_0_30px_rgba(147,51,234,0.3)] space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Code Officiel WhatsApp
              </span>
              <span className="font-mono text-amber-400 font-bold">
                Expire : {formatTimer(timeLeft)}
              </span>
            </div>

            {/* Code Box with Copy Button */}
            <div className="relative p-3 sm:p-4 rounded-xl bg-black/80 border border-purple-500/40 flex items-center justify-between gap-2">
              <span className="font-mono text-2xl sm:text-3xl font-black tracking-[0.2em] text-white selection:bg-purple-600">
                {pairingData.formattedCode || pairingData.code}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Copié !</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copier</span>
                  </>
                )}
              </button>
            </div>

            {/* Step Instructions */}
            <div className="text-[11px] text-slate-300 space-y-1 bg-black/40 p-3 rounded-xl border border-purple-900/30 text-left">
              <p className="font-semibold text-purple-300">Comment associer dans WhatsApp :</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li>Ouvrez WhatsApp sur votre smartphone Android ou iPhone</li>
                <li>Appuyez sur <strong>Menu (⋮) ou Réglages &gt; Appareils connectés</strong></li>
                <li>Appuyez sur <strong>Connecter un appareil</strong></li>
                <li>Sélectionnez <strong>Lier avec le numéro de téléphone</strong></li>
                <li>Entrez ce code à 8 chiffres</li>
              </ol>
            </div>

            {/* Quick Open WhatsApp Link */}
            <a
              href="https://wa.me"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full block text-center py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all"
            >
              Ouvrir WhatsApp sur votre appareil ↗
            </a>
          </div>
        )}

        {/* Paired Success banner */}
        {pairedSuccess && (
          <div className="mt-5 p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-center space-y-2 animate-in zoom-in-95 shadow-xl">
            <div className="inline-flex p-2.5 rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-emerald-300">Jumelage {BOT_NAME} Réussi !</h4>
            <p className="text-xs text-emerald-200/90 leading-relaxed">
              Votre session WhatsApp est connectée 24h/24 et 7j/7. Tapez{' '}
              <strong className="text-white">.menu</strong> sur WhatsApp pour explorer toutes les commandes.
            </p>
          </div>
        )}

        {/* Railway / Domain Bottom Pill matching Screenshot */}
        <div className="mt-6 flex justify-center">
          <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-slate-200 dark:bg-white text-slate-900 font-mono text-xs font-bold shadow-lg">
            <span>{currentHost.includes('localhost') ? 'kaydomd.up.railway.app' : currentHost}</span>
          </div>
        </div>

        {/* Disconnect Option Drawer */}
        <div className="mt-5 pt-4 border-t border-purple-950/50">
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowDisconnect(!showDisconnect)}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-purple-400/90 hover:text-purple-300 transition-colors py-1 px-3 rounded-lg hover:bg-purple-950/30 cursor-pointer"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>🔌 Déconnecter une session existante</span>
            </button>
          </div>

          {showDisconnect && (
            <form onSubmit={handleDisconnectSession} className="mt-3 p-3.5 rounded-2xl bg-[#0d0e20] border border-purple-900/40 space-y-2.5 animate-in fade-in duration-150">
              <label htmlFor="disconnect-phone" className="block text-[10px] font-mono text-slate-400 uppercase text-left">
                Numéro de la session à fermer
              </label>
              <div className="flex gap-2">
                <input
                  id="disconnect-phone"
                  type="tel"
                  value={disconnectPhone}
                  onChange={(e) => setDisconnectPhone(e.target.value)}
                  placeholder="509XXXXXXXX"
                  className="flex-1 bg-black/60 border border-slate-700 text-white font-mono text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-rose-500"
                />
                <button
                  type="submit"
                  disabled={disconnectLoading}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-60 cursor-pointer flex items-center gap-1 shrink-0"
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

      {/* Footer Details under Card */}
      <div className="mt-5 flex flex-col items-center justify-center space-y-1.5 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-mono font-semibold text-emerald-400 tracking-wider">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span>{activeSessionsCount} session(s) WhatsApp active(s) 24/7</span>
        </div>

        <small className="text-[11px] font-mono tracking-widest text-slate-500 uppercase block">
          © {BOT_OWNER} • {BOT_DISPLAY_NAME}
        </small>
      </div>
    </div>
  );
};
