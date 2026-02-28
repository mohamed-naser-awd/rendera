import { useSettingsStore } from '../stores/settingsStore';
import type { Language } from '../stores/settingsStore';

interface CommandToolbarProps {
  creating: boolean;
  hasElectron: boolean;
  onNewProject: () => void;
  onRecordNew: () => void;
}

const toolbarSectionClass = 'flex items-center gap-2';
const btnClass =
  'flex items-center justify-center gap-2 py-4 px-6 rounded-xl border-2 border-dashed font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export function CommandToolbar({
  creating,
  hasElectron,
  onNewProject,
  onRecordNew,
}: CommandToolbarProps) {
  const { theme, language, setLanguage, toggleTheme } = useSettingsStore();

  return (
    <div
      className="flex flex-wrap items-center gap-4 py-3 px-4 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm"
      role="toolbar"
    >
      <div className={toolbarSectionClass}>
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">
          Project
        </span>
        <button
          type="button"
          onClick={onNewProject}
          disabled={creating || !hasElectron}
          className={`${btnClass} border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {creating ? 'Creating…' : 'New project'}
        </button>
        <button
          type="button"
          onClick={onRecordNew}
          disabled={creating || !hasElectron}
          className={`${btnClass} border-rose-400 dark:border-rose-600 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30`}
        >
          <span className="w-5 h-5 rounded-full bg-current" />
          {creating ? 'Creating…' : 'Record new'}
        </button>
      </div>
      <div className="h-6 w-px bg-slate-200 dark:bg-slate-600" />
      <div className={toolbarSectionClass}>
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">
          Configure
        </span>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm"
        >
          <option value="en">EN</option>
          <option value="ar">AR</option>
        </select>
        <button
          type="button"
          onClick={toggleTheme}
          className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-sm"
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </div>
  );
}
