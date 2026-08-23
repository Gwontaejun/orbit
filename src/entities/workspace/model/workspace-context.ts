import { createContext, useContext } from 'react';
import type { Category, Note, NoteRelation, Tag } from '@/entities/note';
import type { Workspace } from './types';

export type DemoNoteInput = {
  id?: string;
  title: string;
  content: string;
  categoryName: string;
  parentNoteId: string | null;
  tagIds: string[];
  newTagNames: string[];
};

export type WorkspaceData = {
  notes: Note[];
  categories: Category[];
  tags: Tag[];
  relations: NoteRelation[];
};

export type WorkspaceContextValue = WorkspaceData & {
  workspace: Workspace | null;
  isDemo: boolean;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  saveDemoNote: (input: DemoNoteInput) => Promise<void>;
  deleteDemoNote: (noteId: string) => Promise<void>;
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);

export function useWorkspaceData() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspaceData must be used within WorkspaceProvider');
  }
  return context;
}
