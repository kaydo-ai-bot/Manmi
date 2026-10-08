import React from 'react';
import { useTheme, AccentTheme } from '../context/ThemeContext';

export const ThemeSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, setTheme } = useTheme();

  const themes: Array<{ id: AccentTheme; label: string; color: string; ringColor: string }> = [
    { id: 'red', label: 'Rouge', color: 'bg-red-600', ringColor: 'ring-red-500' },
    { id: 'purple', label: 'Violet', color: 'bg-purple-500', ringColor: 'ring-purple-400' },
    { id: 'cyan', label: 'Cyan', color: 'bg-cyan-500', ringColor: 'ring-cyan-400' },
    { id: 'orange', label: 'Orange', color: 'bg-orange-500', ringColor: 'ring-orange-400' },
    { id: 'green', label: 'Émeraude', color: 'bg-emerald-500', ringColor: 'ring-emerald-400' },
  ];

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0d0d18]/90 border border-slate-800/80 backdrop-blur-md shadow-lg ${className}`}
      role="group"
      aria-label="Sélecteur de thème de couleur"
    >
      {themes.map((t) => {
        const isActive = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            title={`Thème ${t.label}`}
            aria-label={`Activer le thème ${t.label}`}
            className={`w-4 h-4 rounded-full transition-all transform ${t.color} ${
              isActive
                ? `scale-125 ring-2 ${t.ringColor} shadow-[0_0_12px_currentColor]`
                : 'opacity-60 hover:opacity-100 hover:scale-110'
            }`}
          />
        );
      })}
    </div>
  );
};
