import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { BotStats, PairingResponse } from '../types';
import { saveMySession } from '../utils/userSessions';

interface ConnectionPageProps {
  stats: BotStats | null;
  onRefresh: () => void;
}

const COUNTRY_CODES = [
  { code: '509', country: 'Haïti', flag: '🇭🇹' },
  { code: '33', country: 'France', flag: '🇫🇷' },
  { code: '1', country: 'USA / Canada', flag: '🇺🇸' },
  { code: '225', country: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: '221', country: 'Sénégal', flag: '🇸🇳' },
  { code: '237', country: 'Cameroun', flag: '🇨🇲' },
  { code: '243', country: 'RDC', flag: '🇨🇩' },
  { code: '212', country: 'Maroc', flag: '🇲🇦' },
  { code: '213', country: 'Algérie', flag: '🇩🇿' },
  { code: '216', country: 'Tunisie', flag: '🇹🇳' },
  { code: '228', country: 'Togo', flag: '🇹🇬' },
  { code: '229', country: 'Bénin', flag: '🇧🇯' },
  { code: '226', country: 'Burkina Faso', flag: '🇧🇫' },
  { code: '223', country: 'Mali', flag: '🇲🇱' },
  { code: '224', country: 'Guinée', flag: '🇬🇳' },
  { code: '241', country: 'Gabon', flag: '🇬🇦' },
  { code: '242', country: 'Congo', flag: '🇨🇬' },
  { code: '261', country: 'Madagascar', flag: '🇲🇬' },
  { code: '32', country: 'Belgique', flag: '🇧🇪' },
  { code: '41', country: 'Suisse', flag: '🇨🇭' },
  { code: '44', country: 'Royaume-Uni', flag: '🇬🇧' },
];

export const ConnectionPage: React.FC<ConnectionPageProps> = ({ stats, onRefresh }) => {
  const [mode, setMode] = useState<'pairing' | 'qr'>('pairing');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pairingData, setPairingData] = useState<PairingResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [isLinkedSuccess, setIsLinkedSuccess] = useState(false);

  // Poll pairing status once active
  useEffect(() => {
    if (!pairingData?.sessionId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/pair/status/${pairingData.sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'paired') {
            setIsLinkedSuccess(true);
            setPairingData(null);
            onRefresh();
            clearInterval(interval);
          }
        }
      } catch (e) {
        // ignore polling err
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pairingData, onRefresh]);

  // Expiration countdown
  useEffect(() => {
    if (secondsRemaining === null || secondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev && prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  // Request Pairing Code
  const handleRequestPairing = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLinkedSuccess(false);

    const cleanInput = phoneNumber.replace(/\D/g, '');
    if (!cleanInput || cleanInput.length < 6) {
      setErrorMsg('Veuillez entrer un numéro de téléphone valide.');
      return;
    }

    const fullPhone = cleanInput.startsWith(selectedCountry.code)
      ? cleanInput
      : `${selectedCountry.code}${cleanInput}`;

    setIsLoading(true);

    try {
      const res = await fetch('/api/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Échec de la génération du code de liaison.');
      }

      setPairingData(data);
      if (data.sessionId) {
        saveMySession(data.sessionId, fullPhone);
      }
      setSecondsRemaining(data.expiresInSeconds || 180);
    } catch (err: any) {
      setErrorMsg(err.message || 'Impossible de joindre le serveur WhatsApp.');
    } finally {
      setIsLoading(false);
    }
  };

  // Request QR Code
  const handleRequestQr = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    setQrDataUrl(null);

    try {
      const res = await fetch('/api/pair-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Échec de la génération du QR code.');
      }

      setQrDataUrl(data.qrDataUrl);
      if (data.sessionId) {
        setPairingData({ success: true, sessionId: data.sessionId, status: 'connecting' });
        saveMySession(data.sessionId, data.sessionId);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la génération du QR Code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    const code = pairingData?.code || pairingData?.formattedCode;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Mode Selector Tabs */}
      <div className="flex items-center justify-center">
        <div className="p-1.5 rounded-2xl bg-[#111C32] border border-[#3478F6]/20 flex items-center gap-1">
          <button
            onClick={() => setMode('pairing')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              mode === 'pairing'
                ? 'bg-gradient-to-r from-[#3478F6] to-[#1e58c8] text-white shadow-md shadow-[#3478F6]/25'
                : 'text-[#8E9EB5] hover:text-white'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Pairing Code (Recommandé)</span>
          </button>
          <button
            onClick={() => {
              setMode('qr');
              if (!qrDataUrl) handleRequestQr();
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              mode === 'qr'
                ? 'bg-gradient-to-r from-[#3478F6] to-[#1e58c8] text-white shadow-md shadow-[#3478F6]/25'
                : 'text-[#8E9EB5] hover:text-white'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Scan QR Code</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {isLinkedSuccess && (
        <div className="p-5 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 text-center space-y-2 animate-in zoom-in-95 duration-200">
          <CheckCircle2 className="w-10 h-10 text-[#10B981] mx-auto" />
          <h3 className="text-base font-bold text-white">Appareil WhatsApp Lié avec Succès !</h3>
          <p className="text-xs text-[#8E9EB5]">
            Votre compte est désormais actif 24h/24 et 7j/7 avec KAYDO BOT. Toutes vos commandes sont opérationnelles.
          </p>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-xs sm:text-sm text-[#F5F7FF] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-[#EF4444] shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-xs text-[#8E9EB5] hover:text-white underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Main Connection Card */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl space-y-6">
        {mode === 'pairing' ? (
          /* PAIRING CODE FLOW */
          <div className="space-y-6">
            {!pairingData?.code ? (
              <form onSubmit={handleRequestPairing} className="space-y-5">
                <div className="text-center space-y-1.5 max-w-md mx-auto">
                  <h3 className="text-lg font-bold text-[#F5F7FF]">Liaison Directe par Code</h3>
                  <p className="text-xs text-[#8E9EB5]">
                    Entrez votre numéro WhatsApp pour recevoir votre code officiel à 8 caractères à saisir dans WhatsApp.
                  </p>
                </div>

                <div className="space-y-3 max-w-md mx-auto">
                  <label className="text-xs font-semibold text-[#8E9EB5] block">
                    Numéro de Téléphone WhatsApp
                  </label>

                  <div className="flex items-center gap-2">
                    {/* Country Code Dropdown */}
                    <select
                      value={selectedCountry.code}
                      onChange={(e) => {
                        const found = COUNTRY_CODES.find((c) => c.code === e.target.value);
                        if (found) setSelectedCountry(found);
                      }}
                      className="px-3 py-3 rounded-xl bg-[#080F1F] border border-[#3478F6]/25 text-xs text-[#F5F7FF] focus:outline-none focus:border-[#16D9E8] font-medium shrink-0 cursor-pointer"
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code} className="bg-[#111C32] text-white">
                          {c.flag} +{c.code} ({c.country})
                        </option>
                      ))}
                    </select>

                    {/* Phone Input */}
                    <div className="relative flex-1">
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="Ex: 35975863"
                        className="w-full px-4 py-3 rounded-xl bg-[#080F1F] border border-[#3478F6]/25 text-[#F5F7FF] placeholder-[#8E9EB5]/50 text-sm font-mono focus:outline-none focus:border-[#16D9E8] transition-colors"
                        autoFocus
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-[#8E9EB5]">
                    Numéro complet ciblé :{' '}
                    <span className="font-mono text-[#16D9E8]">
                      +{selectedCountry.code}
                      {phoneNumber.replace(/\D/g, '')}
                    </span>
                  </p>
                </div>

                <div className="max-w-md mx-auto pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#3478F6] to-[#16D9E8] text-white font-bold text-sm shadow-lg shadow-[#3478F6]/25 hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Génération en cours...</span>
                      </>
                    ) : (
                      <>
                        <span>Générer mon Code de Liaison</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* CODE DISPLAY STATE */
              <div className="text-center space-y-6 max-w-md mx-auto animate-in fade-in zoom-in-95 duration-200">
                <div className="space-y-1">
                  <span className="text-xs uppercase font-semibold text-[#16D9E8] tracking-widest">
                    Code de Jumelage Officiel
                  </span>
                  <h3 className="text-xl font-bold text-white">Entrez ce code dans WhatsApp</h3>
                </div>

                {/* Big Code Card */}
                <div className="p-6 rounded-2xl bg-[#080F1F] border-2 border-[#16D9E8]/40 shadow-xl shadow-[#16D9E8]/10 space-y-3">
                  <div className="text-3xl sm:text-4xl font-black text-white tracking-widest font-mono select-all">
                    {pairingData.formattedCode || pairingData.code}
                  </div>

                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-2 px-4 py-2 mx-auto rounded-xl bg-[#111C32] hover:bg-[#3478F6]/20 text-xs font-semibold text-[#16D9E8] border border-[#16D9E8]/30 transition-all"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#10B981]" />
                        <span className="text-[#10B981]">Copié dans le presse-papier !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copier le Code</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Countdown */}
                {secondsRemaining !== null && (
                  <div className="text-xs text-[#8E9EB5]">
                    Expire dans :{' '}
                    <span className="font-mono font-bold text-[#F59E0B]">{secondsRemaining}s</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setPairingData(null);
                      setPhoneNumber('');
                    }}
                    className="text-xs text-[#8E9EB5] hover:text-white underline"
                  >
                    Générer un autre code
                  </button>
                </div>
              </div>
            )}

            {/* Step-by-Step Instructions */}
            <div className="mt-8 pt-6 border-t border-[#3478F6]/15 max-w-xl mx-auto space-y-3">
              <h4 className="text-xs font-bold text-[#F5F7FF] uppercase tracking-wider flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#3478F6]" />
                <span>Instructions Pas-à-Pas WhatsApp</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#8E9EB5]">
                <div className="p-3 rounded-xl bg-[#080F1F]/50 border border-[#3478F6]/10">
                  <span className="font-bold text-[#16D9E8] block mb-1">1. Ouvrez WhatsApp</span>
                  Paramètres &gt; Appareils connectés &gt; Connecter un appareil.
                </div>
                <div className="p-3 rounded-xl bg-[#080F1F]/50 border border-[#3478F6]/10">
                  <span className="font-bold text-[#16D9E8] block mb-1">2. Liaison par Numéro</span>
                  Cliquez en bas sur <i>« Associer avec le numéro de téléphone »</i>.
                </div>
                <div className="p-3 rounded-xl bg-[#080F1F]/50 border border-[#3478F6]/10">
                  <span className="font-bold text-[#16D9E8] block mb-1">3. Saisissez le Code</span>
                  Entrez les 8 caractères affichés ci-dessus pour finaliser.
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* QR CODE FLOW */
          <div className="text-center space-y-6 max-w-md mx-auto">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Scannez le QR Code</h3>
              <p className="text-xs text-[#8E9EB5]">
                Ouvrez WhatsApp sur votre téléphone &gt; Appareils connectés &gt; Connecter un appareil, puis pointez la caméra.
              </p>
            </div>

            {/* QR Frame */}
            <div className="p-6 rounded-3xl bg-[#080F1F] border-2 border-[#3478F6]/30 inline-block shadow-xl shadow-[#3478F6]/10">
              {isLoading ? (
                <div className="w-64 h-64 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-[#16D9E8] animate-spin" />
                  <span className="text-xs text-[#8E9EB5]">Chargement du QR Code...</span>
                </div>
              ) : qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64 mx-auto rounded-xl bg-white p-2"
                />
              ) : (
                <div className="w-64 h-64 flex flex-col items-center justify-center gap-3">
                  <QrCode className="w-12 h-12 text-[#8E9EB5]" />
                  <span className="text-xs text-[#8E9EB5]">Aucun QR Code généré</span>
                </div>
              )}
            </div>

            <div>
              <button
                onClick={handleRequestQr}
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl bg-[#111C32] hover:bg-white/10 text-[#16D9E8] text-xs font-semibold border border-[#16D9E8]/30 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Actualiser le QR Code</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
