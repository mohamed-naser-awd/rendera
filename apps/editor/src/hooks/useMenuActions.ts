import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../stores/projectStore';
import { useThemeStore } from '../stores/themeStore';
import { useClipboardActions } from './useClipboardActions';

export function useMenuActions() {
  const { createProject, saveProject, undo, redo } = useProjectStore();
  const { setTheme } = useThemeStore();
  const { i18n } = useTranslation();
  const { copy, cut, paste, deleteSelected } = useClipboardActions();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveProject();
      }
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (inInput) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        copy();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        if (cut()) e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (paste()) e.preventDefault();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (deleteSelected()) e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveProject, undo, redo, copy, cut, paste, deleteSelected]);

  useEffect(() => {
    const api = (window as { electronAPI?: unknown }).electronAPI as {
      onMenuNewProject?: (cb: () => void) => () => void;
      onMenuSetTheme?: (cb: (t: 'light' | 'dark') => void) => () => void;
      onMenuSetLanguage?: (cb: (lang: string) => void) => () => void;
    } | undefined;

    const unsubNew = api?.onMenuNewProject?.(createProject);
    const unsubTheme = api?.onMenuSetTheme?.(setTheme);
    const unsubLang = api?.onMenuSetLanguage?.((lang) => i18n.changeLanguage(lang));

    return () => {
      unsubNew?.();
      unsubTheme?.();
      unsubLang?.();
    };
  }, [createProject, setTheme, i18n]);
}
