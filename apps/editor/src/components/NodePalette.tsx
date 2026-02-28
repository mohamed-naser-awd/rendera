import type { TimelineNode } from '../stores/projectStore';

export const NODE_TYPES: { type: string; label: string; duration: number }[] = [
  { type: 'clip', label: 'Clip', duration: 5 },
  { type: 'image', label: 'Image', duration: 3 },
  { type: 'audio', label: 'Audio', duration: 10 },
];

const DRAG_TYPE_NODE = 'application/x-rendera-timeline-node';
const DRAG_TYPE_MEDIA = 'application/x-rendera-media-item';

export function setDragNodeData(dataTransfer: DataTransfer, node: Omit<TimelineNode, 'id'>) {
  dataTransfer.setData(DRAG_TYPE_NODE, JSON.stringify(node));
  dataTransfer.effectAllowed = 'copy';
}

export function getDragNodeData(dataTransfer: DataTransfer): Omit<TimelineNode, 'id'> | null {
  const raw = dataTransfer.getData(DRAG_TYPE_NODE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Omit<TimelineNode, 'id'>;
  } catch {
    return null;
  }
}

export interface MediaDragData {
  path: string;
  type: 'image' | 'video' | 'text' | 'other';
  label: string;
}

export function setDragMediaData(dataTransfer: DataTransfer, data: MediaDragData) {
  dataTransfer.setData(DRAG_TYPE_MEDIA, JSON.stringify(data));
  dataTransfer.effectAllowed = 'copy';
}

export function getDragMediaData(dataTransfer: DataTransfer): MediaDragData | null {
  const raw = dataTransfer.getData(DRAG_TYPE_MEDIA);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MediaDragData;
  } catch {
    return null;
  }
}

export function NodePalette() {
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {NODE_TYPES.map(({ type, label, duration }) => (
        <div
          key={type}
          draggable
          onDragStart={(e) => {
            setDragNodeData(e.dataTransfer, { type, duration, label });
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-200 dark:bg-[#383838] hover:bg-slate-300 dark:hover:bg-[#424242] border border-slate-300 dark:border-white/5 hover:border-slate-400 dark:hover:border-white/10 cursor-grab active:cursor-grabbing text-sm font-medium text-slate-800 dark:text-white/90 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
          {label}
          <span className="text-slate-500 dark:text-white/50 text-xs">{duration}s</span>
        </div>
      ))}
    </div>
  );
}
