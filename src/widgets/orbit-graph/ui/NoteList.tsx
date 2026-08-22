import { useMemo, type CSSProperties } from 'react';
import { useWorkspaceData } from '../../../features/workspace/model/workspace-provider';
import {
  filterNoteIds,
  hasActiveGraphFilter,
} from '../../../entities/note/model/filter-notes';
import {
  buildNoteHierarchy,
  includeParentContext,
} from '../../../entities/note/model/note-hierarchy';
import type { GraphFilter } from '../../../entities/note/model/graph-types';
import type { Note } from '../../../entities/note/model/types';
import { useGraphStore } from '../model/store';
import styles from './NoteList.module.css';

type NoteListProps = {
  onCreateNote: () => void;
  onCreateChildNote: (parentNoteId: string) => void;
  onDeleteNote: (note: Note) => void;
  onOpenNote: (note: Note) => void;
};

export function NoteList({
  onCreateNote,
  onCreateChildNote,
  onDeleteNote,
  onOpenNote,
}: NoteListProps) {
  const { categories, notes } = useWorkspaceData();
  const selectedNoteId = useGraphStore((state) => state.selectedNoteId);
  const selectedCategoryIds = useGraphStore(
    (state) => state.selectedCategoryIds,
  );
  const selectedTagIds = useGraphStore((state) => state.selectedTagIds);
  const collapsedNoteIds = useGraphStore((state) => state.collapsedNoteIds);
  const selectNote = useGraphStore((state) => state.selectNote);
  const toggleNoteCollapsed = useGraphStore(
    (state) => state.toggleNoteCollapsed,
  );
  const filter = useMemo<GraphFilter>(
    () => ({
      categoryIds: selectedCategoryIds,
      tagIds: selectedTagIds,
    }),
    [selectedCategoryIds, selectedTagIds],
  );
  const filteredNoteIds = useMemo(
    () => filterNoteIds(notes, filter),
    [filter, notes],
  );
  const visibleNotes = useMemo(() => {
    const visibleIds = hasActiveGraphFilter(filter)
      ? includeParentContext(notes, filteredNoteIds)
      : new Set(notes.map((note) => note.id));

    return buildNoteHierarchy(notes).filter((item) =>
      visibleIds.has(item.note.id),
    );
  }, [filter, filteredNoteIds, notes]);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const noteById = useMemo(
    () => new Map(notes.map((note) => [note.id, note])),
    [notes],
  );
  const visibleParentIds = useMemo(
    () =>
      new Set(
        visibleNotes.flatMap((item) =>
          item.note.parentNoteId ? [item.note.parentNoteId] : [],
        ),
      ),
    [visibleNotes],
  );
  const expandedNoteIds = useMemo(
    () =>
      new Set(
        visibleNotes
          .filter(({ note }) => {
            let parentNoteId = note.parentNoteId;
            while (parentNoteId) {
              if (collapsedNoteIds.includes(parentNoteId)) return false;
              parentNoteId = noteById.get(parentNoteId)?.parentNoteId ?? null;
            }
            return true;
          })
          .map((item) => item.note.id),
      ),
    [collapsedNoteIds, noteById, visibleNotes],
  );

  return (
    <section className={styles.noteList} aria-label="Notes">
      <div className={styles.noteListHeader}>
        <span className={styles.filterTitle}>Notes</span>
        <span className={styles.noteListActions}>
          <button
            className={styles.noteListAddButton}
            type="button"
            aria-label="Add note"
            title="Add note"
            onClick={onCreateNote}
          >
            +
          </button>
          <span className={styles.noteListCount}>({visibleNotes.length})</span>
        </span>
      </div>
      <div className={styles.noteListItems}>
        {visibleNotes.map(({ note, depth }) => {
          const category = categoryById.get(note.categoryId);
          const isContext =
            hasActiveGraphFilter(filter) && !filteredNoteIds.has(note.id);
          const hasChildren = visibleParentIds.has(note.id);
          const isCollapsed = collapsedNoteIds.includes(note.id);
          return (
            <div
              key={note.id}
              className={`${styles.noteListRow}${expandedNoteIds.has(note.id) ? '' : ` ${styles.isCollapsed}`}`}
              style={{ '--note-depth': depth } as CSSProperties}
            >
              <div
                className={`${styles.noteListItem}${selectedNoteId === note.id ? ` ${styles.active}` : ''}${isContext ? ` ${styles.context}` : ''}`}
              >
                <button
                  type="button"
                  className={styles.noteSelectButton}
                  aria-label={`Select ${note.title}`}
                  onClick={() => {
                    if (selectedNoteId === note.id) {
                      onOpenNote(note);
                    } else {
                      selectNote(note.id);
                    }
                  }}
                />
                {hasChildren && (
                  <button
                    type="button"
                    className={styles.noteExpandButton}
                    aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${note.title}`}
                    onClick={() => toggleNoteCollapsed(note.id)}
                  >
                    {isCollapsed ? '▸' : '▾'}
                  </button>
                )}
                <span className={styles.noteListContent}>
                  <i style={{ backgroundColor: category?.color }} />
                  <span>{note.title}</span>
                </span>
                <button
                  type="button"
                  className={styles.noteAddChildButton}
                  aria-label={`Add child note to ${note.title}`}
                  title="Add child note"
                  onClick={() => onCreateChildNote(note.id)}
                >
                  +
                </button>
                <button
                  type="button"
                  className={styles.noteDeleteButton}
                  aria-label={`Delete ${note.title}`}
                  title="Delete note"
                  onClick={() => onDeleteNote(note)}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3.5 4.5h9M6 4.5V3h4v1.5M5 6.5v5.5M8 6.5v5.5M11 6.5v5.5M4.5 4.5l.6 9h5.8l.6-9" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
