import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from 'd3-force-3d';
import type { GraphModel, GraphPosition } from '../../model/graph-types';

type SimulationNode = {
  id: string;
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  radius: number;
};
type SimulationEdge = { source: string; target: string };

function createClusterForce(nodes: SimulationNode[]) {
  const strength = 1;

  return (alpha: number) => {
    nodes.forEach((node) => {
      node.vx = (node.vx ?? 0) - (node.x ?? 0) * strength * alpha;
      node.vy = (node.vy ?? 0) - (node.y ?? 0) * strength * alpha;
    });
  };
}

/** Runs a fixed number of force ticks so the prototype remains deterministic after load. */
export function calculateForceLayout(
  graph: GraphModel,
): Map<string, GraphPosition> {
  const nodes: SimulationNode[] = graph.nodes.map((node, index) => ({
    id: node.id,
    radius: node.radius,
    x: Math.sin(index * 2.4) * 6,
    y: Math.cos(index * 1.7) * 5,
    z: 0,
  }));
  const edges: SimulationEdge[] = graph.edges.map((edge) => ({
    source: edge.sourceId,
    target: edge.targetId,
  }));
  const simulation = forceSimulation(nodes, 2)
    .force(
      'link',
      forceLink(edges)
        .id((node: unknown) => (node as SimulationNode).id)
        .distance(3.1)
        .strength(0.8),
    )
    .force('charge', forceManyBody().strength(-10))
    .force('center', forceCenter(0, 0, 0))
    .force('cluster', createClusterForce(nodes))
    .force(
      'collide',
      forceCollide<SimulationNode>().radius(
        (node: SimulationNode) => node.radius + 0.38,
      ),
    )
    .stop();

  for (let step = 0; step < 260; step += 1) simulation.tick();

  // Keep sparse graphs compact while allowing dense graphs to use more of the camera volume.
  const maxExtent = Math.max(
    1,
    ...nodes.map((node) =>
      Math.max(
        Math.abs(node.x ?? 0),
        Math.abs(node.y ?? 0),
        Math.abs(node.z ?? 0),
      ),
    ),
  );
  const targetExtent = Math.min(
    20,
    0.8 + Math.sqrt(nodes.length) * 1.25 + nodes.length * 0.11,
  );
  const scale = targetExtent / maxExtent;

  return new Map(
    nodes.map((node) => [
      node.id,
      {
        x: (node.x ?? 0) * scale,
        y: (node.y ?? 0) * scale,
        z: 0,
      },
    ]),
  );
}
