import { useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import type { StylesConfig } from 'react-select';
import {
  deleteNote,
  saveNote,
} from '../../../entities/note/api/notes-repository';
import type { Note } from '../../../entities/note/model/types';
import { useAuth } from '../../auth/model/use-auth';
import { useWorkspaceData } from '../../workspace/model/workspace-provider';
import { RichTextEditor } from './RichTextEditor';
import styles from './NoteEditor.module.css';

type Props = {
  note: Note | null;
  initialParentNoteId?: string | null;
  onClose: () => void;
};
type CategoryOption = { value: string; label: string };

function resolveUniqueTitle(
  title: string,
  notes: Note[],
  currentNoteId?: string,
) {
  const baseTitle = title.trim() || 'Untitled';
  const existingTitles = new Set(
    notes
      .filter((note) => note.id !== currentNoteId)
      .map((note) => note.title.trim().toLocaleLowerCase()),
  );
  if (!existingTitles.has(baseTitle.toLocaleLowerCase())) return baseTitle;

  let suffix = 1;
  let candidate = `${baseTitle} (${suffix})`;
  while (existingTitles.has(candidate.toLocaleLowerCase())) {
    suffix += 1;
    candidate = `${baseTitle} (${suffix})`;
  }
  return candidate;
}

const categorySelectStyles: StylesConfig<CategoryOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    borderColor: state.isFocused
      ? 'rgba(151, 175, 235, 0.58)'
      : 'rgba(151, 175, 235, 0.25)',
    boxShadow: state.isFocused
      ? 'inset 0 0 0 1px rgba(151, 175, 235, 0.24)'
      : 'none',
    background: 'rgba(5, 9, 19, 0.85)',
    '&:hover': { borderColor: 'rgba(151, 175, 235, 0.48)' },
  }),
  input: (base) => ({
    ...base,
    color: '#edf2ff',
    fontFamily: "'NeoDunggeunmo Pro', monospace",
    fontSize: 16,
  }),
  singleValue: (base) => ({
    ...base,
    color: '#edf2ff',
    fontFamily: "'NeoDunggeunmo Pro', monospace",
    fontSize: 16,
  }),
  placeholder: (base) => ({
    ...base,
    color: '#6f7f9f',
    fontFamily: "'NeoDunggeunmo Pro', monospace",
    fontSize: 16,
  }),
  menu: (base) => ({
    ...base,
    overflow: 'hidden',
    border: '1px solid rgba(151, 175, 235, 0.28)',
    background: '#0c1223',
    boxShadow: '0 14px 34px rgba(0, 0, 0, 0.48)',
  }),
  option: (base, state) => ({
    ...base,
    color: state.isFocused ? '#f1f5ff' : '#b9c8e8',
    background: state.isFocused ? 'rgba(111, 142, 205, 0.25)' : '#0c1223',
    fontFamily: "'NeoDunggeunmo Pro', monospace",
    fontSize: 16,
    cursor: 'pointer',
  }),
  menuPortal: (base) => ({ ...base, zIndex: 2147483647 }),
};

export function NoteEditor({ note, initialParentNoteId, onClose }: Props) {
  const { user } = useAuth();
  const {
    workspace,
    isDemo,
    categories,
    tags,
    notes,
    relations,
    reload,
    saveDemoNote,
    deleteDemoNote,
  } = useWorkspaceData();
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [categoryName, setCategoryName] = useState(
    () =>
      categories.find((category) => category.id === note?.categoryId)?.name ??
      '',
  );
  const parentNoteId = note?.parentNoteId ?? initialParentNoteId ?? '';
  const [tagIds, setTagIds] = useState(note?.tagIds ?? []);
  const [newTagNames, setNewTagNames] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const relatedNoteIds = note
    ? relations.flatMap((relation) =>
        relation.sourceNoteId === note.id
          ? [relation.targetNoteId]
          : relation.targetNoteId === note.id
            ? [relation.sourceNoteId]
            : [],
      )
    : [];
  const [isSaving, setIsSaving] = useState(false);

  const addTag = () => {
    const name = tagInput.trim();
    if (!name) return;

    const existingTag = tags.find(
      (tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (existingTag) {
      setTagIds((current) =>
        current.includes(existingTag.id)
          ? current
          : [...current, existingTag.id],
      );
    } else {
      setNewTagNames((current) =>
        current.some(
          (tagName) => tagName.toLocaleLowerCase() === name.toLocaleLowerCase(),
        )
          ? current
          : [...current, name],
      );
    }
    setTagInput('');
  };

  const save = async () => {
    setIsSaving(true);
    try {
      const resolvedTitle = resolveUniqueTitle(title, notes, note?.id);
      if (isDemo) {
        await saveDemoNote({
          id: note?.id,
          title: resolvedTitle,
          content,
          categoryName,
          parentNoteId: parentNoteId || null,
          tagIds,
          newTagNames,
        });
      } else {
        if (!workspace || !user) return;
        await saveNote({
          id: note?.id,
          workspaceId: workspace.id,
          title: resolvedTitle,
          content,
          categoryName,
          parentNoteId: parentNoteId || null,
          tagIds,
          newTagNames,
          relatedNoteIds,
        });
        await reload();
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!note || !window.confirm(`Delete ${note.title}?`)) return;
    setIsSaving(true);
    try {
      if (isDemo) {
        await deleteDemoNote(note.id);
      } else {
        if (!workspace) return;
        await deleteNote(note.id, workspace.id);
        await reload();
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const categoryOptions = categories.map((category) => ({
    value: category.name,
    label: category.name,
  }));
  return (
    <div
      className={styles.editorBackdrop}
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className={styles.noteEditor}
        role="dialog"
        aria-modal="true"
        aria-label={note ? 'Edit note' : 'New note'}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {!isDemo && (!user || !workspace) ? (
          <p>Sign in to create and edit notes.</p>
        ) : (
          <>
            <input
              className={styles.noteTitleInput}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled"
              aria-label="Note title"
              autoFocus
            />
            <section
              className={`${styles.noteProperties}${isPropertiesOpen ? ` ${styles.isOpen}` : ''}`}
            >
              <button
                className={styles.notePropertiesToggle}
                type="button"
                aria-expanded={isPropertiesOpen}
                onClick={() => setIsPropertiesOpen((isOpen) => !isOpen)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="m4 6 4 4 4-4" />
                </svg>
                Properties
              </button>
              <div className={styles.notePropertiesReveal}>
                <div className={styles.notePropertiesGrid}>
                  <label className={styles.noteCategoryField}>
                    Category
                    <CreatableSelect<CategoryOption, false>
                      options={categoryOptions}
                      value={
                        categoryName
                          ? { value: categoryName, label: categoryName }
                          : null
                      }
                      onChange={(option) =>
                        setCategoryName(option?.value ?? '')
                      }
                      onCreateOption={(name) => setCategoryName(name.trim())}
                      placeholder="Search or create a category"
                      formatCreateLabel={(name) => `Create "${name}"`}
                      isClearable
                      menuPortalTarget={document.body}
                      menuPosition="fixed"
                      noOptionsMessage={({ inputValue }) =>
                        inputValue
                          ? 'Press Enter to create this category'
                          : 'Start typing a category'
                      }
                      styles={categorySelectStyles}
                    />
                  </label>
                  <fieldset>
                    <legend>Tags</legend>
                    {(tagIds.length > 0 || newTagNames.length > 0) && (
                      <div
                        className={styles.selectedTagChips}
                        aria-label="Selected tags"
                      >
                        {tags
                          .filter((tag) => tagIds.includes(tag.id))
                          .map((tag) => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() =>
                                setTagIds((current) =>
                                  current.filter((tagId) => tagId !== tag.id),
                                )
                              }
                            >
                              #{tag.name} ×
                            </button>
                          ))}
                        {newTagNames.map((tagName) => (
                          <button
                            key={tagName}
                            type="button"
                            onClick={() =>
                              setNewTagNames((current) =>
                                current.filter((name) => name !== tagName),
                              )
                            }
                          >
                            #{tagName} ×
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        addTag();
                      }}
                      placeholder="Type a tag and press Enter"
                    />
                  </fieldset>
                </div>
              </div>
            </section>
            <RichTextEditor content={content} onChange={setContent} />
            <footer>
              {note && (
                <button
                  className={styles.danger}
                  type="button"
                  disabled={isSaving}
                  onClick={() => void remove()}
                >
                  Delete
                </button>
              )}
              <span />
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button
                className={styles.primary}
                type="button"
                disabled={isSaving}
                onClick={() => void save()}
              >
                {isSaving ? 'Saving...' : 'Save note'}
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
