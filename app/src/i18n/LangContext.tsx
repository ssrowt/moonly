import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import t, { type Lang, type Translations } from './translations';

interface LangContextValue {
  lang: Lang;
  T: Translations;
  toggle: () => void;
}

const LangContext = createContext<LangContextValue>(null!);

const STORAGE_KEY = 'moonly_lang';

function getInitialLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'ru' || saved === 'en') return saved;
  // Auto-detect from Telegram or browser
  const browserLang = navigator.language?.toLowerCase() ?? '';
  return browserLang.startsWith('ru') ? 'ru' : 'en';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(getInitialLang);

  const toggle = useCallback(() => {
    setLang(prev => {
      const next: Lang = prev === 'en' ? 'ru' : 'en';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <LangContext.Provider value={{ lang, T: t[lang] as Translations, toggle }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
