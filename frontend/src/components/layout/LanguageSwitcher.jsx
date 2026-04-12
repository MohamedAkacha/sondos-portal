import { useLanguage } from '@/hooks/useLanguage';

export default function LanguageSwitcher() {
  const { lang, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                 bg-white/5 hover:bg-white/10 border border-white/10
                 transition-colors duration-200"
      title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      <span className="text-base">🌐</span>
      <span className="font-medium">
        {lang === 'ar' ? 'EN' : 'عربي'}
      </span>
    </button>
  );
}
