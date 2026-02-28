/**
 * Node types for Rendera project schema.
 * Stack items inherit from Node (items: Node[]).
 */

export type Position = { x: number; y: number };
export type Crop = { left: number; top: number; width: number; height: number };

export interface BaseNode {
  id: string;
  startTime: number;
  duration: number;
  trackIndex: number;
  position?: Position;
  crop?: Crop;
  scale?: number;
}

export interface VideoNode extends BaseNode {
  type: 'video';
  sourcePath?: string;
  assetId?: string;
  endTime?: number;
  trimStart?: number;
  trimEnd?: number;
}

export interface ImageNode extends BaseNode {
  type: 'image';
  sourcePath?: string;
  assetId?: string;
}

export interface GifNode extends BaseNode {
  type: 'gif';
  sourcePath?: string;
  assetId?: string;
}

export interface TextNode extends BaseNode {
  type: 'text';
  content: string;
  style?: { font?: string; size?: number; color?: string };
}

export interface StackNode extends BaseNode {
  type: 'stack';
  items: Node[];
}

export type Node = VideoNode | ImageNode | GifNode | TextNode | StackNode;
