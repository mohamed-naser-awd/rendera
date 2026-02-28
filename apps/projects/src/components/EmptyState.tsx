interface EmptyStateProps {
  onQuickStart?: () => void;
}

export function EmptyState({ onQuickStart }: EmptyStateProps) {
  return (
    <div className="py-12 text-center rounded-xl bg-slate-50 dark:bg-[#252525] border border-slate-200 dark:border-white/5">
      <p className="font-medium text-slate-800 dark:text-white/90">No Recent Projects Found</p>
      <p className="text-sm mt-1 text-slate-500 dark:text-white/60">Create a new project or open one from the list</p>
      {onQuickStart && (
        <button
          type="button"
          onClick={onQuickStart}
          className="mt-6 px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
        >
          Quick Start Guide
        </button>
      )}
    </div>
  );
}
