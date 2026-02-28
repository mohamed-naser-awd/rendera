import { useRef } from 'react';

interface QuickActionsProps {
  creating: boolean;
  hasElectron: boolean;
  onNewProject: () => void;
  onNewFromTemplate: () => void;
  onOpenProjectFileSelect?: (file: File) => void;
  onRecordNew: () => void;
}

const actionClass =
  'flex flex-col items-center justify-center gap-3 w-28 h-24 rounded-lg bg-slate-200 dark:bg-[#383838] hover:bg-slate-300 dark:hover:bg-[#424242] text-slate-800 dark:text-white/90 hover:text-slate-900 dark:hover:text-white transition-all border border-slate-300 dark:border-white/5 hover:border-slate-400 dark:hover:border-white/10';

const PROJECT_FILE_ACCEPT = '.json,.rendera,application/json';

export function QuickActions({
  creating,
  hasElectron,
  onNewProject,
  onNewFromTemplate,
  onOpenProjectFileSelect,
  onRecordNew,
}: QuickActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleOpenProjectClick() {
    if (onOpenProjectFileSelect) {
      fileInputRef.current?.click();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onOpenProjectFileSelect) {
      onOpenProjectFileSelect(file);
    }
    e.target.value = '';
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
      <input
        ref={fileInputRef}
        type="file"
        accept={PROJECT_FILE_ACCEPT}
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={onNewProject}
        disabled={creating || !hasElectron}
        className={`${actionClass} shrink-0`}
        title="New Project"
      >
        <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-xs font-medium">New Project</span>
      </button>

      <button
        type="button"
        onClick={onNewFromTemplate}
        disabled={creating || !hasElectron}
        className={`${actionClass} shrink-0`}
        title="New From Template"
      >
        <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span className="text-xs font-medium">New From Template</span>
      </button>

      <button
        type="button"
        onClick={handleOpenProjectClick}
        disabled={!hasElectron || !onOpenProjectFileSelect}
        className={`${actionClass} shrink-0`}
        title="Open project from file (.json, .rendera)"
      >
        <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2 2H3a1 1 0 001-1v-8a1 1 0 011-1h2M5 19h14a2 2 0 002-2v-6a1 1 0 00-1-1h-2M5 19V5a2 2 0 012-2h2a1 1 0 011 1v3M9 19h6" />
        </svg>
        <span className="text-xs font-medium">Open Project</span>
      </button>

      <button
        type="button"
        onClick={onRecordNew}
        disabled={creating || !hasElectron}
        className={`${actionClass} shrink-0 relative border-rose-400 dark:border-rose-500/50 bg-rose-100 dark:bg-rose-500/10 hover:bg-rose-200 dark:hover:bg-rose-500/20`}
        title="New Recording"
      >
        <span className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center">
          <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="5" />
          </svg>
        </span>
        <span className="text-xs font-medium">New Recording</span>
      </button>

      <span className="shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-[#383838] flex items-center justify-center text-slate-500 dark:text-white/50 border border-slate-300 dark:border-white/5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </div>
  );
}
