import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../stores/projectStore';
import type { TimelineNode } from '../stores/projectStore';
import { NodePalette, getDragNodeData } from './NodePalette';

export function TimelinePanel() {
  const { t } = useTranslation();
  const { project, addTimelineNode } = useProjectStore();
  const [dragOver, setDragOver] = useState(false);

  const items: TimelineNode[] = Array.isArray(project?.root?.items) ? project.root.items : [];

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const node = getDragNodeData(e.dataTransfer);
    if (node) addTimelineNode(node);
  }

  return (
    <aside className="w-80 min-h-[240px] flex flex-col flex-shrink-0 border-l border-slate-700 bg-slate-800/50">
      <div className="p-4 flex-shrink-0">
        <h2 className="text-sm font-medium text-slate-400 mb-2">{t('editor.timeline')}</h2>
        <NodePalette />
      </div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 min-h-[120px] p-4 rounded-t-lg border-t border-slate-700 transition-colors ${
          dragOver ? 'bg-emerald-900/30 border-emerald-500/50' : 'bg-slate-800/80'
        }`}
      >
        <div className="flex flex-wrap gap-2 content-start">
          {items.length === 0 && !dragOver ? (
            <p className="text-slate-500 text-sm py-4">Drop nodes here</p>
          ) : (
            items.map((node) => (
              <div
                key={node.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 text-sm"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{node.label ?? node.type}</span>
                <span className="text-slate-400 text-xs">{node.duration}s</span>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
