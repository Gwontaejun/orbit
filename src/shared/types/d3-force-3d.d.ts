declare module 'd3-force-3d' {
  export const forceCenter: (...args: number[]) => unknown;
  export const forceCollide: <NodeDatum>() => {
    radius: (accessor: (node: NodeDatum) => number) => unknown;
  };
  export const forceLink: (links: unknown[]) => {
    id: (accessor: (node: unknown) => string) => {
      distance: (value: number) => { strength: (value: number) => unknown };
    };
  };
  export const forceManyBody: () => { strength: (value: number) => unknown };
  export const forceSimulation: <NodeDatum>(
    nodes: NodeDatum[],
    dimensions?: number,
  ) => {
    force: (
      name: string,
      force: unknown,
    ) => ReturnType<typeof forceSimulation<NodeDatum>>;
    stop: () => ReturnType<typeof forceSimulation<NodeDatum>>;
    tick: () => unknown;
  };
}
