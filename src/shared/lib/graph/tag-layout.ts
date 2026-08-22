import type {
  GraphModel,
  GraphPosition,
} from '../../../entities/note/model/graph-types';

/** Places notes sharing a tag near the same spatial cluster. */
export function calculateTagLayout(
  graph: GraphModel,
): Map<string, GraphPosition> {
  const tagIds = [...new Set(graph.nodes.flatMap((node) => node.tagIds))];
  const clusterRadius = Math.max(14, tagIds.length * 4.5);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const nodesPerTag = new Map(
    tagIds.map((tagId) => [
      tagId,
      graph.nodes.filter((node) => node.tagIds.includes(tagId)).length,
    ]),
  );
  const tagCenters = new Map(
    tagIds.map((tagId, index) => {
      const angle = (index / Math.max(tagIds.length, 1)) * Math.PI * 2;
      const nodeCount = nodesPerTag.get(tagId) ?? 0;
      const depthSpacing = 5 + Math.sqrt(nodeCount) * 1.05;
      return [
        tagId,
        {
          x: Math.cos(angle) * clusterRadius,
          y: Math.sin(angle) * clusterRadius,
          z: (index - (tagIds.length - 1) / 2) * depthSpacing,
        },
      ];
    }),
  );
  const positions = new Map<string, GraphPosition>();
  const nodesPerPrimaryTag = new Map<string, number>();

  graph.nodes.forEach((node) => {
    const centers = node.tagIds
      .map((tagId) => tagCenters.get(tagId))
      .filter((center): center is { x: number; y: number; z: number } =>
        Boolean(center),
      );
    const center = centers.reduce(
      (sum, current) => ({
        x: sum.x + current.x,
        y: sum.y + current.y,
        z: sum.z + current.z,
      }),
      { x: 0, y: 0, z: 0 },
    );
    const centerCount = Math.max(centers.length, 1);
    const primaryTagId = node.tagIds[0] ?? 'untagged';
    const localIndex = nodesPerPrimaryTag.get(primaryTagId) ?? 0;
    nodesPerPrimaryTag.set(primaryTagId, localIndex + 1);
    const localRadius = 1.2 + Math.sqrt(localIndex) * 1.25;
    const primaryTagNodeCount = nodesPerTag.get(primaryTagId) ?? 1;
    const localDepthMultiplier = 0.55 + Math.sqrt(primaryTagNodeCount) * 0.1;
    const localAngle =
      goldenAngle * (localIndex + tagIds.indexOf(primaryTagId) * 11);

    positions.set(node.id, {
      x: center.x / centerCount + Math.cos(localAngle) * localRadius,
      y: center.y / centerCount + Math.sin(localAngle) * localRadius,
      z:
        center.z / centerCount +
        Math.sin(localAngle * 0.7) * localRadius * localDepthMultiplier,
    });
  });

  return positions;
}
