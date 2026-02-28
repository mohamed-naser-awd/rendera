/**
 * Project metadata schema.
 * Root is a stack; nodes live in stack.items.
 */

import type { Node } from './nodeTypes';

export interface Project {
  id: string;
  name: string;
  description?: string;
  version?: string;
  createdAt: string;
  updatedAt: string;
  resolution: string;
  fps: number;
  duration?: number;
  root: Node; // Main item is a stack; root.items are top-level nodes
}
