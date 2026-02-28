import { EditableProjectName } from './EditableProjectName';
import { useProjectStore } from '../stores/projectStore';
import { useClipboardActions } from '../hooks/useClipboardActions';

export function EditorHeader() {
  const { project, isDirty, saveProject, undo, redo, undoStack, redoStack } = useProjectStore();
  const { copy, cut, paste, deleteSelected, canCopy, canPaste, canDelete } = useClipboardActions();

  return (
    <header className="flex items-center justify-between gap-4 px-4 py-2 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#2d2d2d] shrink-0">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
          aria-label="Record"
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Record
        </button>
        <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />
        <button
          type="button"
          onClick={() => undo()}
          disabled={undoStack.length === 0}
          className="p-2 rounded-lg text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
        </button>
        <button
          type="button"
          onClick={() => redo()}
          disabled={redoStack.length === 0}
          className="p-2 rounded-lg text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
        </button>
        <button
          type="button"
          onClick={() => cut()}
          disabled={!canCopy}
          className="p-2 rounded-lg text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
          aria-label="Cut"
          title="Cut (Ctrl+X)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" /></svg>
        </button>
        <button
          type="button"
          onClick={() => copy()}
          disabled={!canCopy}
          className="p-2 rounded-lg text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
          aria-label="Copy"
          title="Copy (Ctrl+C)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </button>
        <button
          type="button"
          onClick={() => paste()}
          disabled={!canPaste}
          className="p-2 rounded-lg text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
          aria-label="Paste"
          title="Paste (Ctrl+V)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        </button>
        <button
          type="button"
          onClick={() => deleteSelected()}
          disabled={!canDelete}
          className="p-2 rounded-lg text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
          aria-label="Delete"
          title="Delete (Backspace)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4m1 4h.01M12 4h.01M17 4v.01M7 4v.01" /></svg>
        </button>
      </div>
      <div className="flex items-center gap-2">
        <EditableProjectName />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500 dark:text-white/50">100%</span>
        <button type="button" className="p-2 rounded-lg text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Zoom out">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
        </button>
        <button type="button" className="p-2 rounded-lg text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Zoom in">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" /></svg>
        </button>
        <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />
        {project && (
          <button
            type="button"
            onClick={() => saveProject()}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
              isDirty
                ? 'bg-amber-500 hover:bg-amber-400 text-white'
                : 'bg-slate-200 dark:bg-[#383838] text-slate-600 dark:text-white/70 hover:bg-slate-300 dark:hover:bg-[#424242]'
            }`}
            aria-label="Save"
            title={isDirty ? 'Unsaved changes (Ctrl+S)' : 'Saved'}
          >
            {isDirty ? 'Save' : 'Saved'}
          </button>
        )}
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
          aria-label="Share"
        >
          Share
        </button>
      </div>
    </header>
  );
}
