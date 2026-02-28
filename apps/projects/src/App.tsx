import { useState, useEffect, useCallback } from 'react';
import { useProjects } from './hooks/useProjects';
import { useSettingsStore } from './stores/settingsStore';
import {
  Sidebar,
  QuickActions,
  ContentTabs,
  AssetsTabs,
  CreateProjectDialog,
  ErrorMessage,
  LoadingState,
  EmptyState,
  ProjectList,
} from './components';

function applySettingsToDocument(theme: 'light' | 'dark', language: string) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
}

type ContentTab = 'recent' | 'templates';

export default function App() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [contentTab, setContentTab] = useState<ContentTab>('recent');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const { theme, language } = useSettingsStore();
  const {
    projects,
    loading,
    error,
    creating,
    hasElectron,
    createProject,
    createAndRecord,
    importProjectFromFile,
    deleteProject,
    openProject,
    recordProject,
  } = useProjects();

  useEffect(() => {
    applySettingsToDocument(theme, language);
  }, [theme, language]);

  function handleCreate(name: string, description: string) {
    createProject(name, description);
    setShowCreateDialog(false);
  }

  const PROJECT_FILE_EXT = /\.(json|rendera)$/i;
  const isProjectFile = (f: File) => PROJECT_FILE_EXT.test(f.name) || f.type === 'application/json';

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
      const files = Array.from(e.dataTransfer.files).filter(isProjectFile);
      if (files.length > 0) importProjectFromFile(files[0]);
    },
    [importProjectFromFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const hasProjectFile = Array.from(e.dataTransfer.items).some(
      (item) => item.kind === 'file' && PROJECT_FILE_EXT.test(item.getAsFile()?.name ?? '')
    );
    setIsDraggingOver(hasProjectFile);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingOver(false);
  }, []);

  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-[#1e1e1e] text-slate-900 dark:text-white">
      <Sidebar />

      <main
        className={`flex-1 flex flex-col min-w-0 bg-white dark:bg-[#252525] overflow-auto relative border-l border-slate-200 dark:border-white/10 ${isDraggingOver ? 'ring-2 ring-emerald-500 ring-inset' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {isDraggingOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 dark:bg-[#252525]/90 pointer-events-none">
            <div className="rounded-xl border-2 border-dashed border-emerald-500 px-8 py-6 bg-slate-50 dark:bg-[#2d2d2d]/95">
              <p className="text-emerald-600 dark:text-emerald-400 font-medium">Drop project file (.json, .rendera)</p>
              <p className="text-slate-500 dark:text-white/60 text-sm mt-1">Release to import and open</p>
            </div>
          </div>
        )}
        <div className="px-8 py-8 max-w-4xl">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6 text-center">
            Welcome to Rendera!
          </h1>

          <QuickActions
            creating={creating}
            hasElectron={hasElectron}
            onNewProject={() => setShowCreateDialog(true)}
            onNewFromTemplate={() => setShowCreateDialog(true)}
            onOpenProjectFileSelect={importProjectFromFile}
            onRecordNew={() => createAndRecord()}
          />

          <div className="mt-8">
            <ContentTabs activeTab={contentTab} onTabChange={setContentTab}>
              {contentTab === 'recent' && (
                <div id="recent-projects-section">
                  {error && (
                    <div className="mb-4">
                      <ErrorMessage message={error} />
                    </div>
                  )}
                  {loading ? (
                    <LoadingState />
                  ) : projects.length === 0 ? (
                    <EmptyState onQuickStart={() => setShowCreateDialog(true)} />
                  ) : (
                    <ProjectList
                      projects={projects}
                      hasElectron={hasElectron}
                      onOpen={openProject}
                      onRecord={recordProject}
                      onDelete={deleteProject}
                    />
                  )}
                </div>
              )}
              {contentTab === 'templates' && (
                <div className="py-12 text-center rounded-xl bg-slate-50 dark:bg-[#252525] border border-slate-200 dark:border-white/5">
                  <p className="font-medium text-slate-800 dark:text-white/90">No templates yet</p>
                  <p className="text-sm mt-1 text-slate-500 dark:text-white/60">
                    Create a project and save as template (coming soon)
                  </p>
                </div>
              )}
            </ContentTabs>
          </div>

          <AssetsTabs />
        </div>
      </main>

      <CreateProjectDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreate}
        creating={creating}
      />
    </div>
  );
}
