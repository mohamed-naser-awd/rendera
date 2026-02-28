import { ProjectCard } from './ProjectCard';
import type { Project } from '../types';

interface ProjectListProps {
  projects: Project[];
  hasElectron: boolean;
  onOpen: (id: string) => void;
  onRecord: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ProjectList({
  projects,
  hasElectron,
  onOpen,
  onRecord,
  onDelete,
}: ProjectListProps) {
  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this project? This cannot be undone.')) return;
    onDelete(id);
  }

  return (
    <ul className="space-y-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          hasElectron={hasElectron}
          onOpen={onOpen}
          onRecord={onRecord}
          onDelete={handleDelete}
        />
      ))}
    </ul>
  );
}
