import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore, getActiveTimeline } from '../stores/projectStore';
import { useTimelineSelectionStore } from '../stores/timelineSelectionStore';
import { ItemConfigurationPanel } from './ItemConfigurationPanel';
import { VideoConfigurationPanel } from './VideoConfigurationPanel';

const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED_WIDTH = 40;

export function RightSidebar() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const { project } = useProjectStore();
  const { selectedIds } = useTimelineSelectionStore();

  const root = project?.root;
  const activeTimeline = root ? getActiveTimeline(root) : null;
  const items = activeTimeline?.items ?? [];
  const blocks = items.map((node, idx) => ({
    ...node,
    start: node.startTime ?? (idx === 0 ? 0 : items.slice(0, idx).reduce((s, n) => s + n.duration, 0)),
  }));
  const selectedBlock = selectedIds.length === 1 ? blocks.find((b) => b.id === selectedIds[0]) : null;

  return (
    <aside
      className="flex-shrink-0 flex border-l border-slate-200 dark:border-white/10 bg-white dark:bg-[#2d2d2d] transition-[width] duration-200"
      style={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="w-full flex flex-col items-center justify-center py-4 text-slate-500 dark:text-white/60 hover:text-slate-700 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/5"
          aria-label={t('editor.sidebar.expandSidebar', 'Expand sidebar')}
          title={t('editor.sidebar.expandSidebar', 'Expand sidebar')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      ) : (
        <>
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-white/10 flex-shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="p-1.5 rounded-lg text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10"
                aria-label={t('editor.sidebar.collapseSidebar', 'Collapse sidebar')}
                title={t('editor.sidebar.collapseSidebar', 'Collapse sidebar')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <h2 className="text-sm font-medium text-slate-700 dark:text-white/80 flex-1 min-w-0 truncate">
                {selectedBlock
                  ? t('editor.item.configuration', 'Item configuration')
                  : t('editor.item.videoConfiguration', 'Video configuration')}
              </h2>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-3">
              {selectedBlock ? (
                <ItemConfigurationPanel
                  block={selectedBlock}
                  onCloseCrop={() => {}}
                />
              ) : (
                <VideoConfigurationPanel />
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
