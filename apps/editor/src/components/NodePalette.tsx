import type { TimelineNode } from '../stores/projectStore';

export const NODE_TYPES: { type: string; label: string; duration: number }[] = [
  { type: 'clip', label: 'Clip', duration: 5 },
  { type: 'image', label: 'Image', duration: 3 },
  { type: 'audio', label: 'Audio', duration: 10 },
];

const DRAG_TYPE = 'application/x-rendera-timeline-node';

export function setDragNodeData(dataTransfer: DataTransfer, node: Omit<TimelineNode, 'id'>) {
  dataTransfer.setData(DRAG_TYPE, JSON.stringify(node));
  dataTransfer.effectAllowed = 'copy';
}

export function getDragNodeData(dataTransfer: DataTransfer): Omit<TimelineNode, 'id'> | null {
  const raw = dataTransfer.getData(DRAG_TYPE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Omit<TimelineNode, 'id'>;
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
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 cursor-grab active:cursor-grabbing text-sm font-medium"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {label}
          <span className="text-slate-400 text-xs">{duration}s</span>
        </div>
      ))}
    </div>
  );
}
