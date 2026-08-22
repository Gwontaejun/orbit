import type { Note } from './types';

export type NoteHierarchyItem = {
  note: Note;
  depth: number;
};

/** Flattens the note tree in display order while preserving each note's depth. */
export function buildNoteHierarchy(notes: Note[]): NoteHierarchyItem[] {
  const noteIds = new Set(notes.map((note) => note.id));
  const childrenByParent = new Map<string | null, Note[]>();

  for (const note of notes) {
    const parentId =
      note.parentNoteId && noteIds.has(note.parentNoteId)
        ? note.parentNoteId
        : null;
    const children = childrenByParent.get(parentId) ?? [];
    children.push(note);
    childrenByParent.set(parentId, children);
  }

  const hierarchy: NoteHierarchyItem[] = [];
  const visited = new Set<string>();
  const visit = (parentId: string | null, depth: number) => {
    for (const note of childrenByParent.get(parentId) ?? []) {
      if (visited.has(note.id)) continue;
      visited.add(note.id);
      hierarchy.push({ note, depth });
      visit(note.id, depth + 1);
    }
  };

  visit(null, 0);
  for (const note of notes) {
    if (visited.has(note.id)) continue;
    hierarchy.push({ note, depth: 0 });
  }

  return hierarchy;
}

export function includeParentContext(
  notes: Note[],
  noteIds: Set<string>,
): Set<string> {
  const noteById = new Map(notes.map((note) => [note.id, note]));
  const withContext = new Set(noteIds);

  for (const noteId of noteIds) {
    let parentId = noteById.get(noteId)?.parentNoteId;
    while (parentId) {
      if (withContext.has(parentId)) break;
      withContext.add(parentId);
      parentId = noteById.get(parentId)?.parentNoteId;
    }
  }

  return withContext;
}
