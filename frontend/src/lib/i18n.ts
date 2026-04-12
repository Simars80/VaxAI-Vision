import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "@/locales/en/common.json";
import fr from "@/locales/fr/common.json";
import ar from "@/locales/ar/common.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" as const },
  { code: "fr", label: "Français", dir: "ltr" as const },
  { code: "ar", label: "العربية", dir: "rtl" as const },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export function getLanguageDir(lang: string): "ltr" | "rtl" {
  return SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.dir ?? "ltr";
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en },
      fr: { common: fr },
      ar: { common: ar },
    },
    defaultNS: "common",
    ns: ["common"],
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "vaxai_language",
      caches: ["localStorage"],
    },
  });

export default i18n;
