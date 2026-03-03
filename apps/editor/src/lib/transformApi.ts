/**
 * Transform API client: noise cancellation, Nano Banana, transcript, voice over, record voice.
 * All endpoints are under /api/projects/{projectId}/transform/...
 */

import { getApiBaseUrl } from '@shared/getApiUrl';

export interface TransformSource {
  media_path?: string | null;
  node_id?: string | null;
}

export interface NoiseCancellationResult {
  path: string;
  node_id?: string | null;
}

export interface NanoBananaResult {
  path: string;
  node_id?: string | null;
}

export interface ExtractTranscriptResult {
  transcript: string;
  path: string;
  node_id?: string | null;
}

export interface VoiceOverResult {
  path: string;
  node_id?: string | null;
}

export interface RecordVoiceResult {
  path: string;
  node_id?: string | null;
  start_time?: number | null;
}

export async function transformNoiseCancellation(
  projectId: string,
  source: TransformSource
): Promise<NoiseCancellationResult> {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}/api/projects/${projectId}/transform/noise-cancellation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, options: {} }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail ?? 'Noise cancellation failed');
  }
  return res.json();
}

export async function transformNanoBanana(
  projectId: string,
  source: TransformSource,
  prompt?: string
): Promise<NanoBananaResult> {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}/api/projects/${projectId}/transform/nano-banana`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, prompt: prompt ?? null, options: {} }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail ?? 'Nano Banana failed');
  }
  return res.json();
}

export async function transformExtractTranscript(
  projectId: string,
  source: TransformSource
): Promise<ExtractTranscriptResult> {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}/api/projects/${projectId}/transform/extract-transcript`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail ?? 'Extract transcript failed');
  }
  return res.json();
}

export async function transformVoiceOver(
  projectId: string,
  text: string,
  nodeId?: string | null
): Promise<VoiceOverResult> {
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}/api/projects/${projectId}/transform/voice-over`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, node_id: nodeId ?? null, options: {} }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail ?? 'Voice over failed');
  }
  return res.json();
}

export async function transformRecordVoice(
  projectId: string,
  file: File,
  nodeId?: string | null,
  startTime?: number | null
): Promise<RecordVoiceResult> {
  const base = await getApiBaseUrl();
  const form = new FormData();
  form.append('file', file);
  if (nodeId != null) form.append('node_id', nodeId);
  if (startTime != null) form.append('start_time', String(startTime));
  const res = await fetch(`${base}/api/projects/${projectId}/transform/record-voice`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as { detail?: string }).detail ?? 'Record voice upload failed');
  }
  return res.json();
}
