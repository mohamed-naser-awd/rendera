/**
 * Settings API - get/update app settings (e.g. Nano Banana API key).
 */

import { getApiBaseUrl } from '@shared/getApiUrl';

export interface Settings {
  nano_banana_api_key: string | null;
}

export async function getSettings(): Promise<Settings> {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}/api/settings`);
  if (!res.ok) throw new Error('Failed to load settings');
  return res.json();
}

export async function putSettings(settings: Partial<Settings>): Promise<void> {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to save settings');
}
