import {
  calculateCategoryLayout,
  calculateForceLayout,
  calculateHelixLayout,
  calculateSphereLayout,
  calculateTagLayout,
  type GraphModel,
  type GraphPosition,
} from '@/entities/note';
import type { GraphLayoutMode } from './graph-store';

export function calculateLayout(
  graph: GraphModel,
  layoutMode: GraphLayoutMode,
): Map<string, GraphPosition> {
  switch (layoutMode) {
    case 'force':
      return calculateForceLayout(graph);
    case 'category':
      return calculateCategoryLayout(graph);
    case 'tag':
      return calculateTagLayout(graph);
    case 'sphere':
      return calculateSphereLayout(graph);
    case 'helix':
      return calculateHelixLayout(graph);
    default:
      return calculateForceLayout(graph);
  }
}
