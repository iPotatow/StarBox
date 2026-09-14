import { createContext, useContext, type ReactNode } from "react";
import type { UiLanguage } from "../types";

type I18nValue = {
  language: UiLanguage;
  locale: "zh-CN" | "en-US";
  t: (zh: string, en: string) => string;
};

const I18nContext = createContext<I18nValue>({
  language: "zh-CN",
  locale: "zh-CN",
  t: (zh) => zh,
});

export function I18nProvider({ language, children }: { language: UiLanguage; children: ReactNode }) {
  const value: I18nValue = {
    language,
    locale: language === "en" ? "en-US" : "zh-CN",
    t: (zh, en) => language === "en" ? en : zh,
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
