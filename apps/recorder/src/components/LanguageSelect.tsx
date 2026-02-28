import { useTranslation } from 'react-i18next';

export function LanguageSelect() {
  const { i18n } = useTranslation();

  return (
    <select
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="ml-auto bg-[#383838] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
    >
      <option value="en">EN</option>
      <option value="ar">AR</option>
    </select>
  );
}
