import type { Category, Note, NoteRelation } from './types';
import type { GraphEdge, GraphModel, GraphNode } from './graph-types';

/** Converts domain notes into a renderer-independent graph model. */
export function buildGraph(
  notes: Note[],
  relations: NoteRelation[],
  categories: Category[],
): GraphModel {
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const degree = new Map(notes.map((note) => [note.id, 0]));
  const edges: GraphEdge[] = [];

  for (const note of notes) {
    if (note.parentNoteId && degree.has(note.parentNoteId)) {
      edges.push({
        id: `parent:${note.parentNoteId}:${note.id}`,
        sourceId: note.parentNoteId,
        targetId: note.id,
        type: 'hierarchy',
      });
      degree.set(note.id, (degree.get(note.id) ?? 0) + 1);
      degree.set(note.parentNoteId, (degree.get(note.parentNoteId) ?? 0) + 1);
    }
  }

  for (const relation of relations) {
    if (
      !degree.has(relation.sourceNoteId) ||
      !degree.has(relation.targetNoteId)
    )
      continue;
    edges.push({
      id: relation.id,
      sourceId: relation.sourceNoteId,
      targetId: relation.targetNoteId,
      type: 'related',
    });
    degree.set(
      relation.sourceNoteId,
      (degree.get(relation.sourceNoteId) ?? 0) + 1,
    );
    degree.set(
      relation.targetNoteId,
      (degree.get(relation.targetNoteId) ?? 0) + 1,
    );
  }

  const nodes: GraphNode[] = notes.map((note) => ({
    id: note.id,
    title: note.title,
    categoryId: note.categoryId,
    tagIds: note.tagIds,
    color: categoryById.get(note.categoryId)?.color ?? '#a6b0ca',
    radius: Math.min(0.7, 0.32 + (degree.get(note.id) ?? 0) * 0.07),
    position: { x: 0, y: 0, z: 0 },
  }));

  return { nodes, edges };
}
