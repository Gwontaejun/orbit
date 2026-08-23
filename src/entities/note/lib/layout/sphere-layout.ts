import type { GraphModel, GraphPosition } from '../../model/graph-types';

/** Covers a sphere evenly without using note relationships. */
export function calculateSphereLayout(
  graph: GraphModel,
  radius = 12,
): Map<string, GraphPosition> {
  const total = graph.nodes.length;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  return new Map(
    graph.nodes.map((node, index) => {
      const y = total === 1 ? 0 : 1 - (index / (total - 1)) * 2;
      const horizontal = Math.sqrt(1 - y * y);
      const angle = goldenAngle * index;

      return [
        node.id,
        {
          x: Math.cos(angle) * horizontal * radius,
          y: y * radius,
          z: Math.sin(angle) * horizontal * radius,
        } satisfies GraphPosition,
      ];
    }),
  );
}
