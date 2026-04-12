import { createContext, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/index';

export const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const { t: i18nT, i18n: i18nInstance } = useTranslation();

  const lang = i18nInstance.language || 'ar';

  // Apply RTL/LTR + font on language change
  useEffect(() => {
    const isRTL = lang === 'ar';
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.classList.toggle('rtl', isRTL);
    document.documentElement.classList.toggle('ltr', !isRTL);
  }, [lang]);

  // Change language
  const setLang = useCallback((newLang) => {
    i18nInstance.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  }, [i18nInstance]);

  // Toggle between AR/EN
  const toggleLanguage = useCallback(() => {
    const newLang = lang === 'ar' ? 'en' : 'ar';
    setLang(newLang);
  }, [lang, setLang]);

  // Backward-compatible t() function
  // Supports both old {n} interpolation and new {{n}} interpolation
  const t = useCallback((key, params) => {
    if (params) {
      // Convert old-style params to i18next format
      return i18nT(key, params);
    }
    return i18nT(key);
  }, [i18nT]);

  return (
    <LanguageContext.Provider value={{
      lang,
      setLang,
      toggleLanguage,
      t,
      isAr: lang === 'ar',
      isEn: lang === 'en',
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      i18n: i18nInstance,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}