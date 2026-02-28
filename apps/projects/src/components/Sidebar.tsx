import { useSettingsStore } from '../stores/settingsStore';
import type { Language } from '../stores/settingsStore';

const navItems = [
  { id: 'home', label: 'Home', active: true },
  { id: 'learn', label: 'Learn', active: false },
  { id: 'support', label: 'Support', active: false },
  { id: 'whats-new', label: "What's New", active: false },
];

export function Sidebar() {
  const { theme, language, setLanguage, toggleTheme } = useSettingsStore();

  return (
    <aside className="flex flex-col w-56 shrink-0 bg-slate-200 dark:bg-[#2d2d2d] text-slate-900 dark:text-white">
      <nav className="flex-1 pt-8 px-4">
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.id}>
              <a
                href="#"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  item.active
                    ? 'bg-emerald-500 text-white'
                    : 'text-slate-700 dark:text-white/90 hover:bg-slate-300 dark:hover:bg-white/10'
                }`}
              >
                {item.active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                )}
                {!item.active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
                )}
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 mt-auto">
        <div className="rounded-lg bg-slate-300 dark:bg-[#252525] border border-slate-400 dark:border-white/5 overflow-hidden">
          <div className="p-4 bg-gradient-to-br from-slate-300 to-emerald-100 dark:from-[#252525] dark:to-emerald-900/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-400 dark:bg-[#383838] flex items-center justify-center text-slate-700 dark:text-white/80 text-sm font-medium">
                R
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">Rendera</p>
                <p className="text-xs text-slate-600 dark:text-white/60 truncate">Video projects</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full py-2 px-3 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
              >
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <div className="flex gap-1">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className="flex-1 py-2 px-2 rounded-md bg-slate-400/50 dark:bg-white/10 text-slate-900 dark:text-white text-xs border border-slate-400 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="en">EN</option>
                  <option value="ar">AR</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
