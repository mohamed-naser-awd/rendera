import { ReactNode } from 'react';

type TabId = 'recent' | 'templates';

interface ContentTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: ReactNode;
}

export function ContentTabs({ activeTab, onTabChange, children }: ContentTabsProps) {
  return (
    <div>
      <div className="flex gap-6 border-b border-slate-200 dark:border-white/10 mb-4">
        <button
          type="button"
          onClick={() => onTabChange('recent')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'recent'
              ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500'
              : 'text-slate-500 dark:text-white/70 border-transparent hover:text-slate-700 dark:hover:text-white/90'
          }`}
        >
          Recent Projects
        </button>
        <button
          type="button"
          onClick={() => onTabChange('templates')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'templates'
              ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500'
              : 'text-slate-500 dark:text-white/70 border-transparent hover:text-slate-700 dark:hover:text-white/90'
          }`}
        >
          Templates
        </button>
      </div>
      {children}
    </div>
  );
}
