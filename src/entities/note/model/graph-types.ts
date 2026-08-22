export type GraphPosition = { x: number; y: number; z: number };

export type GraphNode = {
  id: string;
  title: string;
  categoryId: string;
  tagIds: string[];
  color: string;
  radius: number;
  position: GraphPosition;
};

export type GraphEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'hierarchy' | 'related';
};

export type GraphModel = { nodes: GraphNode[]; edges: GraphEdge[] };

export type GraphFilter = {
  categoryIds: string[];
  tagIds: string[];
};
