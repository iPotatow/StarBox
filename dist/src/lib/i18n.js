import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext } from "react";
const I18nContext = createContext({
    language: "zh-CN",
    locale: "zh-CN",
    t: (zh) => zh,
});
export function I18nProvider({ language, children }) {
    const value = {
        language,
        locale: language === "en" ? "en-US" : "zh-CN",
        t: (zh, en) => language === "en" ? en : zh,
    };
    return _jsx(I18nContext.Provider, { value: value, children: children });
}
export function useI18n() {
    return useContext(I18nContext);
}
