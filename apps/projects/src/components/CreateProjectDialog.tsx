import { useState, useEffect } from 'react';
import { DEFAULT_PROJECT_NAME, DEFAULT_PROJECT_DESCRIPTION } from '../constants';

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
  creating: boolean;
}

export function CreateProjectDialog({
  open,
  onClose,
  onCreate,
  creating,
}: CreateProjectDialogProps) {
  const [name, setName] = useState(DEFAULT_PROJECT_NAME);
  const [description, setDescription] = useState(DEFAULT_PROJECT_DESCRIPTION);

  useEffect(() => {
    if (open) {
      setName(DEFAULT_PROJECT_NAME);
      setDescription(DEFAULT_PROJECT_DESCRIPTION);
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim() || DEFAULT_PROJECT_NAME;
    onCreate(trimmedName, description.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
          New project
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="project-name"
              className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Name
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={DEFAULT_PROJECT_NAME}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
          </div>
          <div>
            <label
              htmlFor="project-description"
              className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Description <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
