import React, { useState, useEffect, useMemo } from 'react';
import {
  Image as ImageIcon,
  Search,
  Save,
  RotateCcw,
  Check,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Zap,
  Globe,
  Sliders,
  CheckCircle2,
  Filter,
  RefreshCw,
  Eye,
  Layers,
  Smartphone,
  Wand2,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { BOT_COMMANDS, COMMAND_CATEGORIES } from '../data/commands';

export const CommandImagesManager: React.FC = () => {
  const { currentTheme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [appPhotoUrl, setAppPhotoUrl] = useState('https://files.catbox.moe/9u2j5v.png');
  const [defaultUrl, setDefaultUrl] = useState('https://files.catbox.moe/9u2j5v.png');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [testStatus, setTestStatus] = useState<Record<string, { loading?: boolean; valid?: boolean; message?: string }>>({});
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [quickMenuUrl, setQuickMenuUrl] = useState('https://files.catbox.moe/9u2j5v.png');

  const showToast = (text: string, isError: boolean = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleSetQuickMenuPhoto = async (urlToSet: string) => {
    if (!urlToSet) return;
    setSaving(true);
    try {
      const res = await fetch('/api/command-images/set-menu-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToSet }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Photo du menu et des commandes mise à jour et appliquée à toutes les sessions !');
        fetchImages();
      } else {
        throw new Error(data.message || 'Échec');
      }
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la mise à jour de la photo', true);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setSaving(true);
        try {
          const res = await fetch('/api/command-images/set-menu-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Image: base64 }),
          });
          const data = await res.json();
          if (data.success) {
            showToast('✅ Fichier photo exporté et appliqué avec succès à 100% des sessions et menus !');
            fetchImages();
          } else {
            throw new Error(data.message || 'Échec upload');
          }
        } catch (err: any) {
          showToast(err.message || "Erreur lors de l'exportation du fichier", true);
        } finally {
          setSaving(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Load from API
  const fetchImages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/command-images');
      const data = await res.json();
      if (data.success) {
        setAppPhotoUrl(data.appPhotoUrl || 'https://files.catbox.moe/9u2j5v.png');
        setDefaultUrl(data.defaultUrl || 'https://files.catbox.moe/9u2j5v.png');
        setUrls(data.urls || {});
      }
    } catch (err: any) {
      showToast('Erreur lors du chargement des images', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  // Test an individual URL
  const testUrl = async (key: string, urlToTest: string) => {
    if (!urlToTest || !urlToTest.startsWith('http')) {
      setTestStatus((prev) => ({
        ...prev,
        [key]: { valid: false, message: 'URL invalide (doit commencer par http:// ou https://)' },
      }));
      return;
    }

    setTestStatus((prev) => ({
      ...prev,
      [key]: { loading: true },
    }));

    try {
      const res = await fetch('/api/command-images/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToTest }),
      });
      const data = await res.json();
      setTestStatus((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          valid: data.valid,
          message: data.valid ? `Image valide (${(data.sizeBytes / 1024).toFixed(1)} KB)` : (data.error || 'Non accessible'),
        },
      }));
    } catch (err: any) {
      setTestStatus((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          valid: false,
          message: 'Erreur de connexion',
        },
      }));
    }
  };

  // Save all changes
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/command-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appPhotoUrl,
          defaultUrl,
          urls,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Toutes les images et variables ont été enregistrées avec succès !');
        setAppPhotoUrl(data.appPhotoUrl);
        setDefaultUrl(data.defaultUrl);
        setUrls(data.urls);
      } else {
        throw new Error(data.error || 'Erreur lors de la sauvegarde');
      }
    } catch (err: any) {
      showToast(err.message || 'Échec de la sauvegarde', true);
    } finally {
      setSaving(false);
    }
  };

  // Apply a single URL to EVERYTHING in the bot
  const handleApplyToAll = async (targetUrlToApply: string) => {
    if (!targetUrlToApply || !targetUrlToApply.startsWith('http')) {
      showToast('Veuillez entrer une URL valide commençant par https://', true);
      return;
    }
    if (!window.confirm(`Confirmez-vous l'application de cette photo à TOUTE l'application (Logo, Menu, Ping, Alive et toutes les commandes) ?\n\nURL: ${targetUrlToApply}`)) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/command-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applyAllUrl: targetUrlToApply,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Photo appliquée avec succès à TOUT le système (Application + Commandes) !');
        setAppPhotoUrl(data.appPhotoUrl);
        setDefaultUrl(data.defaultUrl);
        setUrls(data.urls);
      }
    } catch (err: any) {
      showToast('Erreur lors de l\'application globale', true);
    } finally {
      setSaving(false);
    }
  };

  // Reset to default
  const handleReset = async () => {
    if (!window.confirm('Voulez-vous vraiment réinitialiser toutes les URLs des images de commandes aux valeurs standard ?')) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/command-images/reset', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        showToast('Images réinitialisées au modèle standard.');
        setAppPhotoUrl(data.appPhotoUrl);
        setDefaultUrl(data.defaultUrl);
        setUrls(data.urls);
      }
    } catch (err: any) {
      showToast('Erreur lors de la réinitialisation', true);
    } finally {
      setSaving(false);
    }
  };

  // Build full list of all available commands
  const allCommandsList = useMemo(() => {
    const map = new Map<string, { name: string; category: string; description: string }>();

    // From BOT_COMMANDS
    for (const cmd of BOT_COMMANDS) {
      map.set(cmd.name.toLowerCase(), {
        name: cmd.name.toLowerCase(),
        category: cmd.category || 'main',
        description: cmd.description || '',
      });
    }

    // Include explicitly configured URLs that might not be in BOT_COMMANDS
    for (const cmdName of Object.keys(urls)) {
      if (!map.has(cmdName)) {
        map.set(cmdName, {
          name: cmdName,
          category: 'other',
          description: `Commande ${cmdName}`,
        });
      }
    }

    return Array.from(map.values());
  }, [urls]);

  // Filtered list
  const filteredCommands = useMemo(() => {
    return allCommandsList.filter((cmd) => {
      const matchesSearch =
        cmd.name.includes(searchQuery.toLowerCase()) ||
        cmd.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === 'all' || cmd.category.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [allCommandsList, searchQuery, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-2xl border text-xs font-mono font-semibold flex items-center gap-2 max-w-sm animate-in slide-in-from-top-2 backdrop-blur-xl ${
            toastMessage.isError
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
              : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
          }`}
        >
          {toastMessage.isError ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Quick Menu Photo URL & Export Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-950/40 via-[#0b0d1b] to-indigo-950/40 border border-purple-500/30 backdrop-blur-2xl relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black font-mono text-white">📸 Photo Officielle du Menu & des Commandes</h3>
              <p className="text-xs text-slate-400">Mettez le lien de votre photo ou exportez/uploadez directement un fichier image depuis votre appareil.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Option 1: URL Link */}
            <div className="space-y-2 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <label className="text-xs font-mono font-bold text-slate-300 block flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-purple-400" />
                <span>Lien URL de la photo (ex: Catbox, Imgur...)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={quickMenuUrl}
                  onChange={(e) => setQuickMenuUrl(e.target.value)}
                  placeholder="https://files.catbox.moe/9u2j5v.png"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => handleSetQuickMenuPhoto(quickMenuUrl)}
                  disabled={saving || loading}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-bold transition-all shadow-md cursor-pointer shrink-0 disabled:opacity-50"
                >
                  Appliquer le Lien
                </button>
              </div>
            </div>

            {/* Option 2: File Upload / Export */}
            <div className="space-y-2 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <label className="text-xs font-mono font-bold text-slate-300 block flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exporter / Importer une photo (Fichier local)</span>
              </label>
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-mono font-bold transition-all cursor-pointer shadow-md">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <span>Choisir un fichier image...</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header Info Banner */}
      <div className="p-6 rounded-3xl bg-[#0b0d1b]/90 border border-slate-800/90 backdrop-blur-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-300 text-xs font-mono font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>GESTION DES VARIABLES ET LIENS PHOTOS</span>
            </div>
            <h2 className="text-2xl font-black font-mono text-white tracking-tight flex items-center gap-2">
              <ImageIcon className="w-7 h-7 text-purple-400" />
              <span>Photos de l'Application & des Commandes</span>
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Configurez ici les liens des photos du bot (Photo de l'application, menu, ping, alive et toutes les commandes).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleApplyToAll('https://files.catbox.moe/9u2j5v.png')}
              disabled={saving || loading}
              className="px-4 py-2.5 rounded-2xl bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
              title="Appliquer https://files.catbox.moe/9u2j5v.png à tout"
            >
              <Wand2 className="w-4 h-4 text-indigo-400" />
              <span>Appliquer Catbox à TOUT</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={saving || loading}
              className="px-4 py-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white text-xs font-mono font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
              <span>Réinitialiser</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || loading}
              className="px-6 py-2.5 rounded-2xl text-white text-xs font-mono font-bold flex items-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-50"
              style={{
                background: currentTheme.buttonGradient,
                boxShadow: `0 0 24px ${currentTheme.glowHex}`,
              }}
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'Enregistrement...' : 'Enregistrer Tout'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* TOP CONFIGURATION: 2 MAIN PHOTO VARIABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Variable 1: Photo de l'Application / Logo */}
        <div className="p-6 rounded-3xl bg-[#0d0f22]/90 border border-purple-500/30 shadow-[0_0_25px_rgba(168,85,247,0.1)] flex flex-col justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0 group">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-950 border-2 border-purple-500/60 p-1 shadow-lg flex items-center justify-center">
                <img
                  src={appPhotoUrl || 'https://files.catbox.moe/9u2j5v.png'}
                  alt="Logo Application"
                  className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://files.catbox.moe/9u2j5v.png';
                  }}
                />
              </div>
              <span className="absolute -bottom-2 -right-1 px-2 py-0.5 rounded-md bg-purple-600 text-[9px] font-mono font-bold text-white shadow">
                LOGO
              </span>
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black font-mono text-white tracking-wide">
                  PHOTO DE L'APPLICATION
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/40 text-[9px] font-mono text-purple-300">
                  GLOBAL LOGO
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Photo affichée dans la barre du haut (Navbar), le portail de jumelage et l'identité du bot.
              </p>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={appPhotoUrl}
                onChange={(e) => setAppPhotoUrl(e.target.value)}
                placeholder="https://files.catbox.moe/9u2j5v.png"
                className="flex-1 px-3.5 py-2 rounded-xl bg-black/70 border border-slate-700 text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={() => testUrl('__app_photo__', appPhotoUrl)}
                disabled={testStatus['__app_photo__']?.loading}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                {testStatus['__app_photo__']?.loading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-purple-400" />
                )}
                <span>Tester</span>
              </button>
            </div>

            {testStatus['__app_photo__']?.message && (
              <p
                className={`text-[10px] font-mono flex items-center gap-1.5 ${
                  testStatus['__app_photo__']?.valid ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {testStatus['__app_photo__']?.valid ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                <span>{testStatus['__app_photo__']?.message}</span>
              </p>
            )}
          </div>
        </div>

        {/* Variable 2: Photo Globale par Défaut (Commands Default Fallback) */}
        <div className="p-6 rounded-3xl bg-[#0d0f22]/90 border border-purple-500/30 shadow-[0_0_25px_rgba(168,85,247,0.1)] flex flex-col justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0 group">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-950 border-2 border-indigo-500/60 p-1 shadow-lg flex items-center justify-center">
                <img
                  src={defaultUrl || 'https://files.catbox.moe/9u2j5v.png'}
                  alt="Image par défaut"
                  className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://files.catbox.moe/9u2j5v.png';
                  }}
                />
              </div>
              <span className="absolute -bottom-2 -right-1 px-2 py-0.5 rounded-md bg-indigo-600 text-[9px] font-mono font-bold text-white shadow">
                DÉFAUT
              </span>
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black font-mono text-white tracking-wide">
                  PHOTO DE SECOURS GLOBALE
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-500/40 text-[9px] font-mono text-indigo-300">
                  COMMANDS FALLBACK
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Photo envoyée sur WhatsApp pour chaque commande sans image personnalisée.
              </p>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={defaultUrl}
                onChange={(e) => setDefaultUrl(e.target.value)}
                placeholder="https://files.catbox.moe/9u2j5v.png"
                className="flex-1 px-3.5 py-2 rounded-xl bg-black/70 border border-slate-700 text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => testUrl('__default__', defaultUrl)}
                disabled={testStatus['__default__']?.loading}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                {testStatus['__default__']?.loading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span>Tester</span>
              </button>
            </div>

            {testStatus['__default__']?.message && (
              <p
                className={`text-[10px] font-mono flex items-center gap-1.5 ${
                  testStatus['__default__']?.valid ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {testStatus['__default__']?.valid ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                <span>{testStatus['__default__']?.message}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-[#0a0c18]/80 border border-slate-800/80">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une commande (ex: menu, ping, alive, owner)..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/70"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-purple-600/30 border border-purple-500 text-purple-200'
                : 'bg-slate-900/60 border border-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            Toutes ({allCommandsList.length})
          </button>
          {COMMAND_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer shrink-0 ${
                selectedCategory === cat.id
                  ? 'bg-purple-600/30 border border-purple-500 text-purple-200'
                  : 'bg-slate-900/60 border border-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Commands Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCommands.map((cmd) => {
          const currentUrl = urls[cmd.name] || '';
          const effectiveUrl = currentUrl || defaultUrl || 'https://files.catbox.moe/9u2j5v.png';
          const status = testStatus[cmd.name];

          return (
            <div
              key={cmd.name}
              className="p-4 rounded-2xl bg-[#090a16]/90 border border-slate-800/90 hover:border-purple-500/40 transition-all flex flex-col justify-between gap-3 group"
            >
              <div className="flex items-start gap-3.5">
                {/* Image Preview Thumbnail */}
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-black/60 border border-slate-800 shrink-0 relative group-hover:border-purple-500/50 transition-colors">
                  <img
                    src={effectiveUrl}
                    alt={cmd.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = defaultUrl || 'https://files.catbox.moe/9u2j5v.png';
                    }}
                  />
                  {currentUrl ? (
                    <span className="absolute bottom-0 right-0 left-0 bg-purple-950/80 text-[8px] font-mono text-center text-purple-300 py-0.5">
                      CUSTOM
                    </span>
                  ) : (
                    <span className="absolute bottom-0 right-0 left-0 bg-slate-950/80 text-[8px] font-mono text-center text-slate-400 py-0.5">
                      DÉFAUT
                    </span>
                  )}
                </div>

                {/* Command Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black font-mono text-white tracking-wide">
                      .{cmd.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400 uppercase">
                      {cmd.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                    {cmd.description || `Commande bot .${cmd.name}`}
                  </p>
                </div>
              </div>

              {/* URL Input & Controls */}
              <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={currentUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUrls((prev) => ({
                        ...prev,
                        [cmd.name]: val,
                      }));
                    }}
                    placeholder={`Hérité du défaut (${defaultUrl.slice(0, 24)}...)`}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-black/80 border border-slate-800 text-white placeholder-slate-600 text-xs font-mono focus:outline-none focus:border-purple-500"
                  />

                  {currentUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setUrls((prev) => {
                          const next = { ...prev };
                          delete next[cmd.name];
                          return next;
                        });
                      }}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 text-[10px] font-mono transition-colors"
                      title="Revenir à l'image par défaut"
                    >
                      Défaut
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => testUrl(cmd.name, effectiveUrl)}
                    disabled={status?.loading}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {status?.loading ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Eye className="w-3 h-3 text-purple-400" />
                    )}
                    <span>Test</span>
                  </button>
                </div>

                {status?.message && (
                  <p
                    className={`text-[10px] font-mono flex items-center gap-1 ${
                      status.valid ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {status.valid ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    <span>{status.message}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredCommands.length === 0 && (
        <div className="p-12 text-center rounded-3xl bg-slate-950/60 border border-slate-800">
          <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-mono text-slate-400">Aucune commande trouvée pour "{searchQuery}".</p>
        </div>
      )}
    </div>
  );
};
