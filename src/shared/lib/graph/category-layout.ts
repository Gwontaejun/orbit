import type {
  GraphModel,
  GraphPosition,
} from '../../../entities/note/model/graph-types';

/** Groups nodes into spatial clusters based on their category, not their relationships. */
export function calculateCategoryLayout(
  graph: GraphModel,
): Map<string, GraphPosition> {
  const categoryIds = [...new Set(graph.nodes.map((node) => node.categoryId))];
  const groups = new Map(
    categoryIds.map((categoryId) => [categoryId, [] as typeof graph.nodes]),
  );

  for (const node of graph.nodes) groups.get(node.categoryId)?.push(node);

  const positions = new Map<string, GraphPosition>();
  const clusterRadius = Math.max(11, categoryIds.length * 4.8);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  categoryIds.forEach((categoryId, categoryIndex) => {
    const clusterAngle = (categoryIndex / categoryIds.length) * Math.PI * 2;
    const nodes = groups.get(categoryId) ?? [];
    const depthSpacing = 5 + Math.sqrt(nodes.length) * 1.15;
    const localDepthMultiplier = 0.35 + Math.sqrt(nodes.length) * 0.065;
    const center = {
      x: Math.cos(clusterAngle) * clusterRadius,
      y: Math.sin(clusterAngle) * clusterRadius * 0.58,
      z: (categoryIndex - (categoryIds.length - 1) / 2) * depthSpacing,
    };

    nodes.forEach((node, index) => {
      const progress = nodes.length === 1 ? 0 : index / (nodes.length - 1);
      const radius = 1.3 + Math.sqrt(progress) * 5.2;
      const angle = goldenAngle * index;
      positions.set(node.id, {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
        z: center.z + Math.sin(angle * 0.7) * radius * localDepthMultiplier,
      });
    });
  });

  return positions;
}
