import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore, getActiveTimeline } from '@/stores/projectStore';
import { usePlaybackStore } from '@/stores/playbackStore';
import { useMediaSelectionStore } from '@/stores/mediaSelectionStore';
import { useTimelineSelectionStore } from '@/stores/timelineSelectionStore';
import {
  transformNoiseCancellation,
  transformNanoBanana,
  transformExtractTranscript,
  transformVoiceOver,
  transformRecordVoice,
  type TransformSource,
} from '@/lib/transformApi';

export function TransformTab() {
  const { t } = useTranslation();
  const { project, addMediaPath, addTimelineNode, updateProject } = useProjectStore();
  const { videoTime } = usePlaybackStore();
  const { selectedMediaPath } = useMediaSelectionStore();
  const { selectedIds } = useTimelineSelectionStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceOverOpen, setVoiceOverOpen] = useState(false);
  const [voiceOverText, setVoiceOverText] = useState('');
  const [recordVoiceOpen, setRecordVoiceOpen] = useState(false);
  const [nanoPromptOpen, setNanoPromptOpen] = useState(false);
  const [nanoPrompt, setNanoPrompt] = useState('');

  const projectId = project?.id ?? null;
  const root = project?.root;
  const activeTimeline = root ? getActiveTimeline(root) : null;
  const items = activeTimeline?.items ?? [];
  const trackCount = Math.max(activeTimeline?.trackCount ?? 1, 1);

  /** Build source from selection: media panel selection or first selected timeline node. */
  function getSource(): TransformSource & { startTime?: number; trackIndex?: number } {
    if (selectedMediaPath && !selectedMediaPath.startsWith('pending:')) {
      return { media_path: selectedMediaPath };
    }
    const firstId = selectedIds[0];
    if (!firstId) return {};
    const node = items.find((n) => n.id === firstId);
    if (!node) return { node_id: firstId };
    const startTime = node.startTime ?? 0;
    const trackIndex = (node.trackIndex ?? 0) + 1; // place above current track
    return {
      node_id: firstId,
      media_path: node.mediaPath ?? undefined,
      startTime,
      trackIndex: Math.min(trackIndex, trackCount),
    };
  }

  function addResultAsNode(path: string, startTime?: number, trackIndex?: number) {
    addMediaPath(path);
    const start = startTime ?? videoTime;
    const track = trackIndex ?? trackCount;
    addTimelineNode(
      {
        type: 'video',
        duration: 5,
        label: path.replace(/^media\/generated\//, ''),
        mediaPath: path,
      },
      { startTime: start, trackIndex: track }
    );
    updateProject({ root: project!.root }); // ensure trackCount if we added above
  }

  async function runNoiseCancellation() {
    if (!projectId) return;
    const source = getSource();
    if (!source.media_path && !source.node_id) {
      setError(t('editor.transform.selectNodeOrMedia', 'Select a node or media first'));
      return;
    }
    setError(null);
    setBusy('noise');
    try {
      const r = await transformNoiseCancellation(projectId, source);
      addMediaPath(r.path);
      addTimelineNode(
        { type: 'video', duration: 5, label: 'Noise cancelled', mediaPath: r.path },
        { startTime: (source as { startTime?: number }).startTime ?? videoTime, trackIndex: (source as { trackIndex?: number }).trackIndex ?? 0 }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function runNanoBanana(prompt?: string) {
    if (!projectId) return;
    const source = getSource();
    if (!source.media_path && !source.node_id) {
      setError(t('editor.transform.selectNodeOrMedia', 'Select a node or media first'));
      return;
    }
    setError(null);
    setBusy('nano');
    setNanoPromptOpen(false);
    try {
      const r = await transformNanoBanana(projectId, source, prompt);
      addMediaPath(r.path);
      addTimelineNode(
        { type: 'image', duration: 5, label: 'Nano Banana', mediaPath: r.path },
        { startTime: (source as { startTime?: number }).startTime ?? videoTime, trackIndex: (source as { trackIndex?: number }).trackIndex ?? 0 }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function runExtractTranscript() {
    if (!projectId) return;
    const source = getSource();
    if (!source.media_path && !source.node_id) {
      setError(t('editor.transform.selectNodeOrMedia', 'Select a node or media first'));
      return;
    }
    setError(null);
    setBusy('transcript');
    try {
      const r = await transformExtractTranscript(projectId, source);
      addMediaPath(r.path);
      // Optionally show transcript in UI; for now we just add the file to media
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function runVoiceOver() {
    if (!projectId || !voiceOverText.trim()) return;
    setError(null);
    setBusy('voiceover');
    const source = getSource();
    const nodeId = source.node_id ?? undefined;
    try {
      const r = await transformVoiceOver(projectId, voiceOverText.trim(), nodeId);
      addMediaPath(r.path);
      addResultAsNode(r.path, source.startTime, source.trackIndex);
      setVoiceOverText('');
      setVoiceOverOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function runRecordVoice(file: File) {
    if (!projectId) return;
    setError(null);
    setBusy('record');
    const source = getSource();
    try {
      const r = await transformRecordVoice(
        projectId,
        file,
        source.node_id ?? undefined,
        source.startTime ?? undefined
      );
      addMediaPath(r.path);
      addResultAsNode(r.path, r.start_time ?? source.startTime ?? videoTime, source.trackIndex);
      setRecordVoiceOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  const hasSelection = !!(selectedMediaPath && !selectedMediaPath.startsWith('pending:')) || selectedIds.length > 0;

  return (
    <div className="flex flex-col gap-3 p-2">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
          {error}
        </p>
      )}
      <p className="text-xs text-slate-500 dark:text-white/50">
        {hasSelection
          ? t('editor.transform.hasSelection', 'Apply to selected node or media')
          : t('editor.transform.noSelection', 'Select a timeline node or media in the panel')}
      </p>

      <button
        type="button"
        className="w-full px-3 py-2 text-sm text-left rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#383838] hover:bg-slate-50 dark:hover:bg-[#424242] flex items-center gap-2 disabled:opacity-50"
        disabled={!hasSelection || !!busy}
        onClick={runNoiseCancellation}
      >
        <span className="w-5 h-5 rounded bg-slate-200 dark:bg-white/20 flex items-center justify-center text-xs">1</span>
        {t('editor.transform.noiseCancellation', 'Noise Cancellation')}
        {busy === 'noise' && <span className="text-xs opacity-70">…</span>}
      </button>

      <button
        type="button"
        className="w-full px-3 py-2 text-sm text-left rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#383838] hover:bg-slate-50 dark:hover:bg-[#424242] flex items-center gap-2 disabled:opacity-50"
        disabled={!hasSelection || !!busy}
        onClick={() => (nanoPrompt ? runNanoBanana(nanoPrompt) : setNanoPromptOpen(true))}
      >
        <span className="w-5 h-5 rounded bg-slate-200 dark:bg-white/20 flex items-center justify-center text-xs">2</span>
        {t('editor.transform.nanoBanana', 'Nano Banana')}
        {busy === 'nano' && <span className="text-xs opacity-70">…</span>}
      </button>
      {nanoPromptOpen && (
        <div className="flex flex-col gap-2 pl-7">
          <input
            type="text"
            value={nanoPrompt}
            onChange={(e) => setNanoPrompt(e.target.value)}
            placeholder={t('editor.transform.promptPlaceholder', 'Describe edit or leave empty')}
            className="px-2 py-1.5 text-sm border border-slate-200 dark:border-white/10 rounded bg-white dark:bg-[#2d2d2d]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="px-2 py-1 text-sm bg-emerald-600 text-white rounded"
              onClick={() => runNanoBanana(nanoPrompt || undefined)}
            >
              {t('common.apply', 'Apply')}
            </button>
            <button
              type="button"
              className="px-2 py-1 text-sm border rounded"
              onClick={() => { setNanoPromptOpen(false); setNanoPrompt(''); }}
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="w-full px-3 py-2 text-sm text-left rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#383838] hover:bg-slate-50 dark:hover:bg-[#424242] flex items-center gap-2 disabled:opacity-50"
        disabled={!hasSelection || !!busy}
        onClick={runExtractTranscript}
      >
        <span className="w-5 h-5 rounded bg-slate-200 dark:bg-white/20 flex items-center justify-center text-xs">3</span>
        {t('editor.transform.extractTranscript', 'Extract Transcript')}
        {busy === 'transcript' && <span className="text-xs opacity-70">…</span>}
      </button>

      <button
        type="button"
        className="w-full px-3 py-2 text-sm text-left rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#383838] hover:bg-slate-50 dark:hover:bg-[#424242] flex items-center gap-2 disabled:opacity-50"
        disabled={!!busy}
        onClick={() => setVoiceOverOpen(true)}
      >
        <span className="w-5 h-5 rounded bg-slate-200 dark:bg-white/20 flex items-center justify-center text-xs">4</span>
        {t('editor.transform.voiceOver', 'Voice Over')}
        {busy === 'voiceover' && <span className="text-xs opacity-70">…</span>}
      </button>
      {voiceOverOpen && (
        <div className="flex flex-col gap-2 pl-7 border-l-2 border-emerald-500/30 pl-4">
          <textarea
            value={voiceOverText}
            onChange={(e) => setVoiceOverText(e.target.value)}
            placeholder={t('editor.transform.voiceOverPlaceholder', 'Type text to generate speech')}
            className="min-h-[80px] px-2 py-1.5 text-sm border border-slate-200 dark:border-white/10 rounded bg-white dark:bg-[#2d2d2d] resize-y"
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="px-2 py-1 text-sm bg-emerald-600 text-white rounded disabled:opacity-50"
              disabled={!voiceOverText.trim() || !!busy}
              onClick={() => runVoiceOver()}
            >
              {t('editor.transform.generate', 'Generate')}
            </button>
            <button
              type="button"
              className="px-2 py-1 text-sm border rounded"
              onClick={() => { setVoiceOverOpen(false); setVoiceOverText(''); }}
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="w-full px-3 py-2 text-sm text-left rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#383838] hover:bg-slate-50 dark:hover:bg-[#424242] flex items-center gap-2 disabled:opacity-50"
        disabled={!!busy}
        onClick={() => setRecordVoiceOpen(true)}
      >
        <span className="w-5 h-5 rounded bg-slate-200 dark:bg-white/20 flex items-center justify-center text-xs">5</span>
        {t('editor.transform.recordVoice', 'Record Voice')}
        {busy === 'record' && <span className="text-xs opacity-70">…</span>}
      </button>
      {recordVoiceOpen && (
        <RecordVoiceBlock
          onUpload={runRecordVoice}
          onClose={() => setRecordVoiceOpen(false)}
          disabled={!!busy}
        />
      )}
    </div>
  );
}

function RecordVoiceBlock({
  onUpload,
  onClose,
  disabled,
}: {
  onUpload: (file: File) => void;
  onClose: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const blobs: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) blobs.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (blobs.length) {
          const file = new File([new Blob(blobs)], `recorded_${Date.now()}.webm`, { type: 'audio/webm' });
          onUpload(file);
        }
      };
      rec.start();
      setRecorder(rec);
      setRecording(true);
    } catch {
      // permission or no mic
    }
  }

  function stopRecording() {
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      setRecorder(null);
      setRecording(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 pl-7 border-l-2 border-emerald-500/30 pl-4">
      {recording ? (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm">{t('editor.transform.recording', 'Recording…')}</span>
          <button
            type="button"
            className="px-2 py-1 text-sm bg-red-600 text-white rounded"
            onClick={stopRecording}
          >
            {t('editor.transform.stop', 'Stop')}
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="px-2 py-1 text-sm bg-emerald-600 text-white rounded disabled:opacity-50"
            disabled={disabled}
            onClick={startRecording}
          >
            {t('editor.transform.startRecording', 'Start recording')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/webm"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="text-sm text-slate-600 dark:text-white/70 underline"
            onClick={() => fileInputRef.current?.click()}
          >
            {t('editor.transform.uploadAudio', 'Or upload audio file')}
          </button>
        </>
      )}
      <button type="button" className="text-sm border rounded px-2 py-1 self-start" onClick={onClose}>
        {t('common.cancel', 'Cancel')}
      </button>
    </div>
  );
}
