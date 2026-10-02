import { createContext, useContext, useMemo, type ReactNode } from "react";
import { translate, uiLocale, type Translate } from "./translate";
import type { UiLanguage } from "../types";

type I18nValue = {
  language: UiLanguage;
  locale: ReturnType<typeof uiLocale>;
  t: Translate;
};

const I18nContext = createContext<I18nValue>({
  language: "zh-CN",
  locale: "zh-CN",
  t: (zh) => zh,
});

export function I18nProvider({ language, children }: { language: UiLanguage; children: ReactNode }) {
  const value = useMemo<I18nValue>(() => ({
    language,
    locale: uiLocale(language),
    t: (zh, en, traditional) => translate(language, zh, en, traditional),
  }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
