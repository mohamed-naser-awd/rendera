/**
 * FFmpeg xfade filter transitions.
 * Sourced from FFmpeg libavfilter/vf_xfade.c - all transitions except "custom".
 * Transitions are app-defined; only applied transitions are persisted in project data.
 * requiresTwoVideos: true = must drop between two adjacent clips; false = can drop on single clip.
 */
export const FFMPEG_XFADE_TRANSITIONS = [
  { id: 'fade', label: 'Fade', requiresTwoVideos: true },
  { id: 'wipeleft', label: 'Wipe left', requiresTwoVideos: true },
  { id: 'wiperight', label: 'Wipe right', requiresTwoVideos: true },
  { id: 'wipeup', label: 'Wipe up', requiresTwoVideos: true },
  { id: 'wipedown', label: 'Wipe down', requiresTwoVideos: true },
  { id: 'slideleft', label: 'Slide left', requiresTwoVideos: true },
  { id: 'slideright', label: 'Slide right', requiresTwoVideos: true },
  { id: 'slideup', label: 'Slide up', requiresTwoVideos: true },
  { id: 'slidedown', label: 'Slide down', requiresTwoVideos: true },
  { id: 'circlecrop', label: 'Circle crop', requiresTwoVideos: true },
  { id: 'rectcrop', label: 'Rect crop', requiresTwoVideos: true },
  { id: 'distance', label: 'Distance', requiresTwoVideos: true },
  { id: 'fadeblack', label: 'Fade black', requiresTwoVideos: true },
  { id: 'fadewhite', label: 'Fade white', requiresTwoVideos: true },
  { id: 'radial', label: 'Radial', requiresTwoVideos: true },
  { id: 'smoothleft', label: 'Smooth left', requiresTwoVideos: true },
  { id: 'smoothright', label: 'Smooth right', requiresTwoVideos: true },
  { id: 'smoothup', label: 'Smooth up', requiresTwoVideos: true },
  { id: 'smoothdown', label: 'Smooth down', requiresTwoVideos: true },
  { id: 'circleopen', label: 'Circle open', requiresTwoVideos: true },
  { id: 'circleclose', label: 'Circle close', requiresTwoVideos: true },
  { id: 'vertopen', label: 'Vert open', requiresTwoVideos: true },
  { id: 'vertclose', label: 'Vert close', requiresTwoVideos: true },
  { id: 'horzopen', label: 'Horz open', requiresTwoVideos: true },
  { id: 'horzclose', label: 'Horz close', requiresTwoVideos: true },
  { id: 'dissolve', label: 'Dissolve', requiresTwoVideos: true },
  { id: 'pixelize', label: 'Pixelize', requiresTwoVideos: true },
  { id: 'diagtl', label: 'Diag top-left', requiresTwoVideos: true },
  { id: 'diagtr', label: 'Diag top-right', requiresTwoVideos: true },
  { id: 'diagbl', label: 'Diag bottom-left', requiresTwoVideos: true },
  { id: 'diagbr', label: 'Diag bottom-right', requiresTwoVideos: true },
  { id: 'hlslice', label: 'Slice left', requiresTwoVideos: true },
  { id: 'hrslice', label: 'Slice right', requiresTwoVideos: true },
  { id: 'vuslice', label: 'Slice up', requiresTwoVideos: true },
  { id: 'vdslice', label: 'Slice down', requiresTwoVideos: true },
  { id: 'hblur', label: 'Blur', requiresTwoVideos: true },
  { id: 'fadegrays', label: 'Fade grays', requiresTwoVideos: true },
  { id: 'wipetl', label: 'Wipe top-left', requiresTwoVideos: true },
  { id: 'wipetr', label: 'Wipe top-right', requiresTwoVideos: true },
  { id: 'wipebl', label: 'Wipe bottom-left', requiresTwoVideos: true },
  { id: 'wipebr', label: 'Wipe bottom-right', requiresTwoVideos: true },
  { id: 'squeezeh', label: 'Squeeze H', requiresTwoVideos: true },
  { id: 'squeezev', label: 'Squeeze V', requiresTwoVideos: true },
  { id: 'zoomin', label: 'Zoom in', requiresTwoVideos: true },
  { id: 'fadefast', label: 'Fast fade', requiresTwoVideos: true },
  { id: 'fadeslow', label: 'Slow fade', requiresTwoVideos: true },
  { id: 'hlwind', label: 'Wind left', requiresTwoVideos: true },
  { id: 'hrwind', label: 'Wind right', requiresTwoVideos: true },
  { id: 'vuwind', label: 'Wind up', requiresTwoVideos: true },
  { id: 'vdwind', label: 'Wind down', requiresTwoVideos: true },
  { id: 'coverleft', label: 'Cover left', requiresTwoVideos: true },
  { id: 'coverright', label: 'Cover right', requiresTwoVideos: true },
  { id: 'coverup', label: 'Cover up', requiresTwoVideos: true },
  { id: 'coverdown', label: 'Cover down', requiresTwoVideos: true },
  { id: 'revealleft', label: 'Reveal left', requiresTwoVideos: true },
  { id: 'revealright', label: 'Reveal right', requiresTwoVideos: true },
  { id: 'revealup', label: 'Reveal up', requiresTwoVideos: true },
  { id: 'revealdown', label: 'Reveal down', requiresTwoVideos: true },
] as const;

export type TransitionId = (typeof FFMPEG_XFADE_TRANSITIONS)[number]['id'];

export interface AppliedTransition {
  type: TransitionId;
  duration: number;
}

export const DEFAULT_TRANSITION_DURATION = 0.5;
