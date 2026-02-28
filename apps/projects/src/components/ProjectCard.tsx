import { formatDate } from '../utils/formatDate';
import type { Project } from '../types';

interface ProjectCardProps {
  project: Project;
  hasElectron: boolean;
  onOpen: (id: string) => void;
  onRecord: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export function ProjectCard({
  project,
  hasElectron,
  onOpen,
  onRecord,
  onDelete,
}: ProjectCardProps) {
  return (
    <li
      className="group flex items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-[#252525] border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition-all cursor-pointer"
      onClick={() => onOpen(project.id)}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 dark:text-white truncate">
          {project.name || 'Untitled'}
        </p>
        {project.description ? (
          <p className="text-sm text-slate-500 dark:text-white/60 truncate">
            {project.description}
          </p>
        ) : null}
        <p className="text-sm text-slate-500 dark:text-white/50">
          {project.resolution} · {project.fps} fps · {formatDate(project.updatedAt)}
        </p>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {hasElectron && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRecord(project.id);
              }}
              className="p-2 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-slate-700 dark:text-white"
              title="Record"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="6" />
              </svg>
            </button>
            <button
              onClick={(e) => onDelete(project.id, e)}
              className="p-2 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-700 dark:text-white"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        )}
      </div>
    </li>
  );
}
