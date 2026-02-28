import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../stores/projectStore';

export function PreviewPanel() {
  const { t } = useTranslation();
  const { project } = useProjectStore();

  return (
    <section className="flex-1 min-h-0 flex flex-col p-4 border-r border-slate-700">
      <h2 className="text-sm font-medium text-slate-400 mb-2 flex-shrink-0">{t('editor.preview')}</h2>
      <div className="flex-1 min-h-[200px] aspect-video bg-slate-800 rounded flex items-center justify-center overflow-hidden">
        {project ? (
          <span className="text-slate-500">{project.name}</span>
        ) : (
          <span className="text-slate-500">{t('editor.noProject')}</span>
        )}
      </div>
    </section>
  );
}
