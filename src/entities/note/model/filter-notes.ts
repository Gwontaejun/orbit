import type { Note } from './types';
import type { GraphFilter } from './graph-types';

export function hasActiveGraphFilter(filter: GraphFilter): boolean {
  return filter.categoryIds.length > 0 || filter.tagIds.length > 0;
}

/** Returns note IDs that satisfy all active filter groups. */
export function filterNoteIds(notes: Note[], filter: GraphFilter): Set<string> {
  return new Set(
    notes
      .filter((note) => {
        const matchesCategories =
          filter.categoryIds.length === 0 ||
          filter.categoryIds.includes(note.categoryId);
        const matchesTags =
          filter.tagIds.length === 0 ||
          note.tagIds.some((tagId) => filter.tagIds.includes(tagId));
        return matchesCategories && matchesTags;
      })
      .map((note) => note.id),
  );
}
