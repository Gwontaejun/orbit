import { useState } from 'react';
import { AuthControls, useAuth } from '@/features/auth';
import { NoteEditor } from '@/features/note-editor';
import type { Note } from '@/entities/note';
import { deleteNote, useWorkspaceData } from '@/entities/workspace';
import {
  GraphFilters,
  NoteList,
  OrbitGraph,
  useGraphStore,
} from '@/widgets/orbit-graph';
import styles from './App.module.css';

export function App() {
  const { notes, workspace, isDemo, reload, deleteDemoNote } =
    useWorkspaceData();
  const { user, signInWithGoogle } = useAuth();
  const [editorNote, setEditorNote] = useState<Note | null | undefined>(
    undefined,
  );
  const [newNoteParentId, setNewNoteParentId] = useState<string | null>(null);
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const selectedNoteId = useGraphStore((state) => state.selectedNoteId);
  const selectNote = useGraphStore((state) => state.selectNote);

  const requestNoteAccess = () => {
    if (!isDemo && !user) {
      setLoginError(null);
      setIsLoginPromptOpen(true);
      return false;
    }
    return true;
  };

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
              if (!requestNoteAccess()) return;
              setNewNoteParentId(null);
              setEditorNote(null);
            }}
            onCreateChildNote={(parentNoteId) => {
              if (!requestNoteAccess()) return;
              setNewNoteParentId(parentNoteId);
              setEditorNote(null);
            }}
            onDeleteNote={(note) => {
              if (!requestNoteAccess()) return;
              void deleteNoteFromList(note);
            }}
            onOpenNote={(note) => {
              if (!requestNoteAccess()) return;
              setEditorNote(note);
            }}
          />
        </aside>
        <OrbitGraph
          onCreateNote={() => {
            if (!requestNoteAccess()) return;
            setNewNoteParentId(null);
            setEditorNote(null);
          }}
          onOpenNote={(noteId) => {
            if (!requestNoteAccess()) return;
            setEditorNote(notes.find((note) => note.id === noteId) ?? null);
          }}
        />
      </section>
      {editorNote !== undefined && (
        <NoteEditor
          note={editorNote}
          initialParentNoteId={newNoteParentId}
          onClose={() => setEditorNote(undefined)}
        />
      )}
      {isLoginPromptOpen && (
        <div
          className={styles.loginPromptBackdrop}
          role="presentation"
          onMouseDown={() => setIsLoginPromptOpen(false)}
        >
          <section
            className={styles.loginPrompt}
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-prompt-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className={styles.loginPromptEyebrow}>ORBIT ACCOUNT</span>
            <h2 id="login-prompt-title">Sign in to access notes</h2>
            <p>Explore the graph freely. Sign in to open or create notes.</p>
            <div className={styles.loginPromptActions}>
              <button
                type="button"
                className={styles.loginPromptDismiss}
                onClick={() => setIsLoginPromptOpen(false)}
              >
                Not now
              </button>
              <button
                type="button"
                className={styles.loginPromptSignIn}
                onClick={() => {
                  setLoginError(null);
                  void signInWithGoogle().catch((error: unknown) => {
                    setLoginError(
                      error instanceof Error
                        ? error.message
                        : 'Unable to sign in',
                    );
                  });
                }}
              >
                Sign in with Google
              </button>
            </div>
            {loginError && <small>{loginError}</small>}
          </section>
        </div>
      )}
    </main>
  );
}
