/// <reference path="./electron.d.ts" />

/**
 * Shared source of truth for the API base URL.
 * In Electron: main process spawns the server on a random port and exposes it via getApiUrl().
 * In browser/dev: use VITE_API_URL env or default.
 */

export async function getApiBaseUrl(): Promise<string> {
  if (typeof window !== 'undefined' && window.electronAPI?.getApiUrl) {
    return window.electronAPI.getApiUrl();
  }
  try {
    // Vite provides import.meta.env; safe fallback when not in Vite
    const meta = import.meta as unknown as { env?: { VITE_API_URL?: string } };
    const url = meta?.env?.VITE_API_URL;
    if (url) return url;
  } catch {
    /* ignore */
  }
  return 'http://127.0.0.1:8000';
}
