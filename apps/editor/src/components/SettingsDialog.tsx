import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSettings, putSettings } from '@/lib/settingsApi';

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [nanoBananaKey, setNanoBananaKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setNanoBananaKey(s.nano_banana_api_key ?? '');
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await putSettings({
        nano_banana_api_key: nanoBananaKey.trim() || '',
      });
      onClose();
    } catch {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div
        className="bg-white dark:bg-[#2d2d2d] rounded-xl shadow-xl border border-slate-200 dark:border-white/10 w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <h2 id="settings-title" className="text-lg font-semibold text-slate-800 dark:text-white">
            {t('editor.settings.title', 'Settings')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-[#383838]"
            aria-label={t('common.close', 'Close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-white/50">Loading…</p>
          ) : (
            <>
              <div>
                <label
                  htmlFor="nano-banana-key"
                  className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-1"
                >
                  {t('editor.settings.nanoBananaApiKey', 'Nano Banana API key')}
                </label>
                <input
                  id="nano-banana-key"
                  type="password"
                  autoComplete="off"
                  value={nanoBananaKey}
                  onChange={(e) => setNanoBananaKey(e.target.value)}
                  placeholder={t('editor.settings.nanoBananaApiKeyPlaceholder', 'Paste your API key (Google AI Studio / Gemini)')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#383838] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-white/50">
                  {t('editor.settings.nanoBananaApiKeyHint', 'Stored locally as plain text. Get a key at Google AI Studio.')}
                </p>
              </div>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </>
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-200 dark:border-white/10 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-[#383838]"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
          >
            {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}
