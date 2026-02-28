import { useEffect } from 'react';
import { usePlaybackStore } from '../stores/playbackStore';
import { useTimelineDuration } from '../hooks/useTimelineDuration';

export function PlaybackControls() {
  const { videoTime, playing, setVideoTime, setPlaying } = usePlaybackStore();
  const { maxEnd } = useTimelineDuration();

  const videoDuration = maxEnd > 0 ? maxEnd : 0.01;

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const TICK_MS = 10;

  useEffect(() => {
    if (!playing || videoDuration <= 0) return;
    const id = setInterval(() => {
      const state = usePlaybackStore.getState();
      const next = Math.min(state.videoTime + TICK_MS / 1000, videoDuration);
      state.setVideoTime(next);
      if (next >= videoDuration) state.setPlaying(false);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing, videoDuration]);

  function handleVideoSeek(value: number) {
    setVideoTime(Math.min(value, maxEnd));
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-slate-100 dark:bg-[#252525] border-t border-slate-200 dark:border-white/10 flex-shrink-0">
      <button
        type="button"
        onClick={() => setPlaying(!playing)}
        className="p-2 rounded-lg bg-slate-200 dark:bg-[#383838] hover:bg-slate-300 dark:hover:bg-[#424242] transition-colors"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <svg className="w-5 h-5 text-slate-700 dark:text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-slate-700 dark:text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7L8 5z" />
          </svg>
        )}
      </button>
      <span className="text-sm text-slate-600 dark:text-white/70 tabular-nums min-w-[2.5rem]">
        {formatTime(videoTime)}
      </span>
      <div className="flex-1 flex items-center">
        <input
          type="range"
          min={0}
          max={Math.max(videoDuration, 0.01)}
          step={0.01}
          value={Math.min(videoTime, videoDuration)}
          onChange={(e) => handleVideoSeek(Number(e.target.value))}
          className="flex-1 h-1.5 rounded-full appearance-none bg-slate-300 dark:bg-[#383838] accent-emerald-500"
        />
      </div>
      <span className="text-sm text-slate-600 dark:text-white/70 tabular-nums min-w-[2.5rem]">
        {formatTime(videoDuration)}
      </span>
      <button
        type="button"
        className="p-2 rounded-lg text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-[#383838] transition-colors"
        aria-label="Volume"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      </button>
    </div>
  );
}
