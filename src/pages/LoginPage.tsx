import React, { useState } from 'react';
import { Lock, KeyRound, ShieldAlert, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface LoginPageProps {
  onSuccess: (token: string) => void;
  onCancel?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onCancel }) => {
  const { currentTheme } = useTheme();
  const [credential, setCredential] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential.trim()) {
      setError('Veuillez renseigner votre identifiant ou mot de passe propriétaire.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/owner/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: credential.trim(),
          password: credential.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Accès refusé. Clé propriétaire invalide.');
      }

      // Store in session storage
      sessionStorage.setItem('shado_owner_token', data.token);
      onSuccess(data.token);
    } catch (err: any) {
      setError(err?.message || 'Identifiant ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-8 px-4 animate-in fade-in duration-200">
      <div className={`p-6 sm:p-8 rounded-3xl bg-[#0a0b16]/95 border ${currentTheme.cardBorder} ${currentTheme.cardGlow} backdrop-blur-2xl shadow-2xl space-y-6 text-center`}>
        {/* Shield Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-purple-950/40 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-mono font-bold tracking-widest uppercase text-purple-400">
            ESPACE PROPRIÉTAIRE RESTREINT
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-mono text-white">
            SHADO BOT 𓃶
          </h2>
          <p className="text-xs text-slate-400">
            Seul le propriétaire vérifié peut accéder à la gestion des sessions, des numéros connectés et des statistiques privées.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <label
              htmlFor="owner-credential"
              className="block text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase"
            >
              Clé d'authentification / Téléphone
            </label>
            <div className="relative">
              <input
                id="owner-credential"
                type="password"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder="Numéro ou clé secrète..."
                autoComplete="current-password"
                className="w-full bg-[#111224] border border-slate-800 text-white font-mono text-sm rounded-xl px-4 py-3 placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
              />
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Accès réservé exclusivement au compte de DEV KAYDO (+509 3597 5863)
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 px-4 rounded-xl font-mono font-bold text-xs sm:text-sm text-white bg-gradient-to-r ${currentTheme.buttonGradient} ${currentTheme.buttonGlow} flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Vérification sécurisée...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>DÉVERROUILLER L'ACCÈS OWNER</span>
              </>
            )}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2 text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
            >
              ← Retour au portail public
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
