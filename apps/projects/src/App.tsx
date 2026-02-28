import { useState, useEffect } from 'react';
import { useProjects } from './hooks/useProjects';
import { useSettingsStore } from './stores/settingsStore';
import {
  PageHeader,
  CommandToolbar,
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

export default function App() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { theme, language } = useSettingsStore();
  const {
    projects,
    loading,
    error,
    creating,
    hasElectron,
    createProject,
    createAndRecord,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 text-slate-800 dark:text-slate-100">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <PageHeader />
        <div className="flex flex-col gap-4 mt-6">
          <CommandToolbar
            creating={creating}
            hasElectron={hasElectron}
            onNewProject={() => setShowCreateDialog(true)}
            onRecordNew={() => createAndRecord()}
          />
          <CreateProjectDialog
            open={showCreateDialog}
            onClose={() => setShowCreateDialog(false)}
            onCreate={handleCreate}
            creating={creating}
          />
          {error && <ErrorMessage message={error} />}
          {loading ? (
            <LoadingState />
          ) : projects.length === 0 ? (
            <EmptyState />
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
      </div>
    </div>
  );
}
