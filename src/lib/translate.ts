import type { UiLanguage } from "../types";

export type Translate = (zh: string, en: string, traditional: string) => string;

/** Translate UI copy only; interpolated repository and user content stays unchanged. */
export function translate(language: UiLanguage, zh: string, en: string, traditional = zh): string {
  return language === "en" ? en : language === "zh-TW" ? traditional : zh;
}

export function uiLocale(language: UiLanguage): "zh-CN" | "zh-TW" | "en-US" {
  return language === "en" ? "en-US" : language;
}
