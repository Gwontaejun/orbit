import type { GraphNode, GraphPosition } from '@/entities/note';
import type { GraphLayoutMode } from './graph-store';

export type GraphCluster = {
  id: string;
  name: string;
  count: number;
  color: string;
  center: GraphPosition;
  radius: number;
  memberTargets: Array<{ id: string; position: GraphPosition }>;
};

const tagClusterColors = ['#7fa8ff', '#d892ff', '#66dbc3', '#ffc77a'];

export function buildClusters({
  nodes,
  layoutMode,
  categoryById,
  tagById,
}: {
  nodes: GraphNode[];
  layoutMode: GraphLayoutMode;
  categoryById: Map<string, { id: string; name: string; color: string }>;
  tagById: Map<string, { id: string; name: string }>;
}): GraphCluster[] {
  const groups = new Map<string, GraphNode[]>();

  for (const node of nodes) {
    const groupId =
      layoutMode === 'category'
        ? node.categoryId
        : layoutMode === 'tag'
          ? node.tagIds[0]
          : undefined;
    if (!groupId) continue;
    groups.set(groupId, [...(groups.get(groupId) ?? []), node]);
  }

  return [...groups.entries()].flatMap(([id, groupNodes], index) => {
    const center = groupNodes.reduce<GraphPosition>(
      (sum, node) => ({
        x: sum.x + node.position.x / groupNodes.length,
        y: sum.y + node.position.y / groupNodes.length,
        z: sum.z + node.position.z / groupNodes.length,
      }),
      { x: 0, y: 0, z: 0 },
    );
    const radius = Math.max(
      4.2,
      ...groupNodes.map(
        (node) =>
          Math.hypot(
            node.position.x - center.x,
            node.position.y - center.y,
            node.position.z - center.z,
          ) + 3.4,
      ),
    );
    const category = categoryById.get(id);
    const tag = tagById.get(id);

    return category || tag
      ? [
          {
            id,
            name: category?.name ?? `#${tag?.name ?? 'Tag'}`,
            count: groupNodes.length,
            color:
              category?.color ??
              tagClusterColors[index % tagClusterColors.length],
            center,
            radius,
            memberTargets: groupNodes.map(({ id, position }) => ({
              id,
              position,
            })),
          },
        ]
      : [];
  });
}
