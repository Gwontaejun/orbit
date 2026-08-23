import type { GraphModel, GraphPosition } from '../../model/graph-types';

/** Arranges notes along an evenly spaced, relationship-independent 3D helix. */
export function calculateHelixLayout(
  graph: GraphModel,
): Map<string, GraphPosition> {
  const total = graph.nodes.length;
  const turns = 4.2;
  const radius = 8.2;
  const height = 22;

  return new Map(
    graph.nodes.map((node, index) => {
      const progress = total === 1 ? 0.5 : index / (total - 1);
      const angle = progress * Math.PI * 2 * turns;

      return [
        node.id,
        {
          x: Math.cos(angle) * radius,
          y: (progress - 0.5) * height,
          z: Math.sin(angle) * radius,
        } satisfies GraphPosition,
      ];
    }),
  );
}
