import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { STRINGS, type Lang, type StringKey } from "../i18n/strings";

// Same localStorage key FloatingShapes' language-toggle shape reads and
// writes directly (see spawnLanguageToggle/toggleLanguage there) — both
// sides independently read it once on their own mount, which is why they
// start in sync with no prop-passing needed; the shape then just reports
// forward whenever it flips (onToggleLanguage), same pattern as the
// click-to-expand panel callbacks.
const STORAGE_KEY = "ditto-lang";

function readInitialLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing/storage disabled — the toggle still works for
      // this visit, it just won't be remembered next time.
    }
  }, []);

  const t = useCallback((key: StringKey) => STRINGS[lang][key], [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// The hook belongs next to its provider; not worth a second file for this.
// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
