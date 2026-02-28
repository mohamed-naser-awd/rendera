import { useTranslation } from 'react-i18next';

export function LanguageSelect() {
  const { i18n } = useTranslation();

  return (
    <select
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="ml-auto bg-slate-700 rounded px-2 py-1 text-sm"
    >
      <option value="en">EN</option>
      <option value="ar">AR</option>
    </select>
  );
}
