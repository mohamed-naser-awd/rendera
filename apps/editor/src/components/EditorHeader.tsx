import { EditableProjectName } from './EditableProjectName';

export function EditorHeader() {
  return (
    <header className="flex items-center px-4 py-2 border-b border-slate-700 bg-slate-800/80 shrink-0">
      <EditableProjectName />
    </header>
  );
}
