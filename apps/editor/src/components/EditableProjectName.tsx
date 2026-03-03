import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';

export function EditableProjectName() {
  const { project, updateProject } = useProjectStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(project?.name ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(project?.name ?? '');
  }, [project?.name]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!project) return <span className="text-slate-500 dark:text-white/50">No project</span>;

  const currentName = project.name;

  function handleSave() {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== currentName) {
      updateProject({ name: trimmed });
    } else {
      setValue(currentName);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') {
            setValue(currentName);
            setEditing(false);
          }
        }}
        className="text-xl font-semibold bg-slate-100 dark:bg-[#383838] border border-slate-300 dark:border-white/10 rounded px-2 py-1 min-w-[8rem] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    );
  }

  return (
    <div
      className="flex items-center gap-2 group/name"
      onDoubleClick={() => setEditing(true)}
    >
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xl font-semibold text-left text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded px-2 py-1 -mx-2 truncate max-w-md"
        title="Click or double-click to edit name"
      >
        {project.name || 'Untitled Project'}
      </button>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="p-1 rounded opacity-0 group-hover/name:opacity-100 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-white/60 hover:text-slate-700 dark:hover:text-white flex-shrink-0"
        title="Edit name"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
    </div>
  );
}
