import { useState } from 'react';
import { AuthControls } from '@/features/auth/ui/AuthControls';
import { useAuth } from '@/features/auth/model/use-auth';
import { NoteEditor } from '@/features/note-editor/ui/NoteEditor';
import { useWorkspaceData } from '@/features/workspace/model/workspace-provider';
import { deleteNote } from '@/entities/note/api/notes-repository';
import type { Note } from '@/entities/note/model/types';
import { useGraphStore } from '@/widgets/orbit-graph/model/store';
import { GraphFilters } from '@/widgets/orbit-graph/ui/GraphFilters';
import { NoteList } from '@/widgets/orbit-graph/ui/NoteList';
import { OrbitGraph } from '@/widgets/orbit-graph/ui/OrbitGraph';
import styles from './App.module.css';

export function App() {
  const { notes, workspace, isDemo, reload, deleteDemoNote } =
    useWorkspaceData();
  const { user } = useAuth();
  const [editorNote, setEditorNote] = useState<Note | null | undefined>(
    undefined,
  );
  const [newNoteParentId, setNewNoteParentId] = useState<string | null>(null);
  const selectedNoteId = useGraphStore((state) => state.selectedNoteId);
  const selectNote = useGraphStore((state) => state.selectNote);

  const deleteNoteFromList = async (note: Note) => {
    if (!window.confirm(`Delete ${note.title}?`)) return;

    if (isDemo) {
      await deleteDemoNote(note.id);
    } else if (workspace && user) {
      await deleteNote(note.id, workspace.id);
      await reload();
    }
    if (selectedNoteId === note.id) selectNote(null);
  };

  return (
    <main className={styles.orbitApp}>
      <header className={styles.header}>
        <span className={styles.brand}>ORBIT</span>
        <span className={styles.prototype}>Record your ideas in 3D</span>
        <AuthControls />
      </header>
      <section className={styles.workspace}>
        <aside className={styles.sidebar}>
          <GraphFilters />
          <NoteList
            onCreateNote={() => {
              setNewNoteParentId(null);
              setEditorNote(null);
            }}
            onCreateChildNote={(parentNoteId) => {
              setNewNoteParentId(parentNoteId);
              setEditorNote(null);
            }}
            onDeleteNote={(note) => void deleteNoteFromList(note)}
            onOpenNote={(note) => setEditorNote(note)}
          />
        </aside>
        <OrbitGraph
          onCreateNote={() => {
            setNewNoteParentId(null);
            setEditorNote(null);
          }}
          onOpenNote={(noteId) =>
            setEditorNote(notes.find((note) => note.id === noteId) ?? null)
          }
        />
      </section>
      {editorNote !== undefined && (
        <NoteEditor
          note={editorNote}
          initialParentNoteId={newNoteParentId}
          onClose={() => setEditorNote(undefined)}
        />
      )}
    </main>
  );
}
