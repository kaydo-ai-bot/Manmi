import React, { createContext, useContext, useState, useEffect } from 'react';

export type AccentTheme = 'purple' | 'cyan' | 'orange' | 'green';

export interface ThemeConfig {
  id: AccentTheme;
  name: string;
  colorHex: string;
  buttonGradient: string;
  buttonGlow: string;
  cardBorder: string;
  cardGlow: string;
  textAccent: string;
  bgSubtle: string;
  badgeBorder: string;
  ringColor: string;
}

export const THEMES: Record<AccentTheme, ThemeConfig> = {
  purple: {
    id: 'purple',
    name: 'Violet Néon',
    colorHex: '#a855f7',
    buttonGradient: 'from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500',
    buttonGlow: 'shadow-[0_0_30px_rgba(168,85,247,0.45)]',
    cardBorder: 'border-purple-500/30 hover:border-purple-500/50',
    cardGlow: 'shadow-[0_0_40px_rgba(168,85,247,0.18)]',
    textAccent: 'text-purple-400',
    bgSubtle: 'bg-purple-950/30',
    badgeBorder: 'border-purple-500/40',
    ringColor: 'focus:ring-purple-500/50',
  },
  cyan: {
    id: 'cyan',
    name: 'Cyan Cyber',
    colorHex: '#06b6d4',
    buttonGradient: 'from-cyan-600 via-teal-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500',
    buttonGlow: 'shadow-[0_0_30px_rgba(6,182,212,0.45)]',
    cardBorder: 'border-cyan-500/30 hover:border-cyan-500/50',
    cardGlow: 'shadow-[0_0_40px_rgba(6,182,212,0.18)]',
    textAccent: 'text-cyan-400',
    bgSubtle: 'bg-cyan-950/30',
    badgeBorder: 'border-cyan-500/40',
    ringColor: 'focus:ring-cyan-500/50',
  },
  orange: {
    id: 'orange',
    name: 'Orange Plasma',
    colorHex: '#f97316',
    buttonGradient: 'from-orange-600 via-amber-600 to-red-600 hover:from-orange-500 hover:to-red-500',
    buttonGlow: 'shadow-[0_0_30px_rgba(249,115,22,0.45)]',
    cardBorder: 'border-orange-500/30 hover:border-orange-500/50',
    cardGlow: 'shadow-[0_0_40px_rgba(249,115,22,0.18)]',
    textAccent: 'text-orange-400',
    bgSubtle: 'bg-orange-950/30',
    badgeBorder: 'border-orange-500/40',
    ringColor: 'focus:ring-orange-500/50',
  },
  green: {
    id: 'green',
    name: 'Émeraude Matrix',
    colorHex: '#10b981',
    buttonGradient: 'from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500',
    buttonGlow: 'shadow-[0_0_30px_rgba(16,185,129,0.45)]',
    cardBorder: 'border-emerald-500/30 hover:border-emerald-500/50',
    cardGlow: 'shadow-[0_0_40px_rgba(16,185,129,0.18)]',
    textAccent: 'text-emerald-400',
    bgSubtle: 'bg-emerald-950/30',
    badgeBorder: 'border-emerald-500/40',
    ringColor: 'focus:ring-emerald-500/50',
  },
};

interface ThemeContextType {
  theme: AccentTheme;
  setTheme: (t: AccentTheme) => void;
  currentTheme: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'purple',
  setTheme: () => {},
  currentTheme: THEMES.purple,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AccentTheme>(() => {
    const saved = localStorage.getItem('shado_theme') as AccentTheme;
    return saved && THEMES[saved] ? saved : 'purple';
  });

  const setTheme = (t: AccentTheme) => {
    setThemeState(t);
    localStorage.setItem('shado_theme', t);
  };

  const currentTheme = THEMES[theme] || THEMES.purple;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, currentTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
