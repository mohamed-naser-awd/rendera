import { useState } from 'react';

const assetTabs = [
  { id: 'featured', label: 'Featured Assets' },
  { id: 'free', label: 'Free Assets' },
  { id: 'premium', label: 'Premium Assets' },
] as const;

export function AssetsTabs() {
  const [active, setActive] = useState(assetTabs[0].id);

  return (
    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10">
      <div className="flex gap-6 border-b border-slate-200 dark:border-white/10">
        {assetTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              active === tab.id
                ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500'
                : 'text-slate-500 dark:text-white/60 border-transparent hover:text-slate-700 dark:hover:text-white/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-slate-500 dark:text-white/50 mt-3">Browse assets to add to your projects.</p>
    </div>
  );
}
