/* eslint-disable react-hooks/set-state-in-effect */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  loadWorkspaceGraph,
  type Workspace,
} from '../../../entities/note/api/notes-repository';
import {
  categories as mockCategories,
  notes as mockNotes,
  relations as mockRelations,
  tags as mockTags,
} from '../../../entities/note/model/mock-data';
import type {
  Category,
  Note,
  NoteRelation,
  Tag,
} from '../../../entities/note/model/types';
import { useAuth } from '../../auth/model/use-auth';

type OrbitData = {
  notes: Note[];
  categories: Category[];
  tags: Tag[];
  relations: NoteRelation[];
};
export type DemoNoteInput = {
  id?: string;
  title: string;
  content: string;
  categoryName: string;
  parentNoteId: string | null;
  tagIds: string[];
  newTagNames: string[];
};
type WorkspaceContextValue = OrbitData & {
  workspace: Workspace | null;
  isDemo: boolean;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  saveDemoNote: (input: DemoNoteInput) => Promise<void>;
  deleteDemoNote: (noteId: string) => Promise<void>;
};
const demoData: OrbitData = {
  notes: mockNotes,
  categories: mockCategories,
  tags: mockTags,
  relations: mockRelations,
};
const emptyData: OrbitData = {
  notes: [],
  categories: [],
  tags: [],
  relations: [],
};
const demoWorkspace: Workspace = { id: 'demo-workspace', name: 'Orbit Demo' };
const categoryPalette = ['#8ba8ff', '#a990ff', '#79d6c7', '#ffae7d', '#f29cc2'];
const createDemoId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const colorForCategory = (name: string) =>
  categoryPalette[
    [...name].reduce((total, character) => total + character.charCodeAt(0), 0) %
      categoryPalette.length
  ];
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { isConfigured, isLoading: isAuthLoading, user } = useAuth();
  const userId = user?.id ?? null;
  const [data, setData] = useState<OrbitData>(demoData);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveDemoNote = useCallback(async (input: DemoNoteInput) => {
    setData((current) => {
      const categoryName = input.categoryName.trim();
      const existingCategory = current.categories.find(
        (category) =>
          category.name.toLocaleLowerCase() ===
          categoryName.toLocaleLowerCase(),
      );
      const category = categoryName
        ? (existingCategory ?? {
            id: createDemoId('category'),
            name: categoryName,
            color: colorForCategory(categoryName),
          })
        : null;
      const categories =
        category && !existingCategory
          ? [...current.categories, category]
          : current.categories;
      const newTags = input.newTagNames
        .filter(
          (name) =>
            !current.tags.some(
              (tag) =>
                tag.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
            ),
        )
        .map((name) => ({ id: createDemoId('tag'), name }));
      const resolvedTagIds = [
        ...input.tagIds,
        ...input.newTagNames.map(
          (name) =>
            current.tags.find(
              (tag) =>
                tag.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
            )?.id ?? newTags.find((tag) => tag.name === name)?.id,
        ),
      ].filter((tagId): tagId is string => Boolean(tagId));
      const updatedNote: Note = {
        id: input.id ?? createDemoId('note'),
        title: input.title.trim(),
        content: input.content,
        categoryId: category?.id ?? 'uncategorized',
        parentNoteId: input.parentNoteId,
        tagIds: [...new Set(resolvedTagIds)],
      };
      const notes = input.id
        ? current.notes.map((note) =>
            note.id === input.id ? updatedNote : note,
          )
        : [...current.notes, updatedNote];
      const usedCategoryIds = new Set(notes.map((note) => note.categoryId));
      const usedTagIds = new Set(notes.flatMap((note) => note.tagIds));
      return {
        ...current,
        notes,
        categories: categories.filter((item) => usedCategoryIds.has(item.id)),
        tags: [...current.tags, ...newTags].filter((item) =>
          usedTagIds.has(item.id),
        ),
      };
    });
  }, []);

  const deleteDemoNote = useCallback(async (noteId: string) => {
    setData((current) => {
      const notes = current.notes
        .filter((note) => note.id !== noteId)
        .map((note) =>
          note.parentNoteId === noteId ? { ...note, parentNoteId: null } : note,
        );
      const relations = current.relations.filter(
        (relation) =>
          relation.sourceNoteId !== noteId && relation.targetNoteId !== noteId,
      );
      const usedCategoryIds = new Set(notes.map((note) => note.categoryId));
      const usedTagIds = new Set(notes.flatMap((note) => note.tagIds));
      return {
        notes,
        relations,
        categories: current.categories.filter((item) =>
          usedCategoryIds.has(item.id),
        ),
        tags: current.tags.filter((item) => usedTagIds.has(item.id)),
      };
    });
  }, []);

  const reload = useCallback(async () => {
    if (!isConfigured || !userId) return;
    setIsLoading(true);
    setError(null);
    setData(emptyData);
    setWorkspace(null);
    try {
      const result = await loadWorkspaceGraph(userId);
      setData(result ?? emptyData);
      setWorkspace(result?.workspace ?? null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to load workspace',
      );
    } finally {
      setLoadedUserId(userId);
      setIsLoading(false);
    }
  }, [isConfigured, userId]);

  useEffect(() => {
    if (!isConfigured || !userId) return;
    void reload();
  }, [isConfigured, userId, reload]);

  const value = useMemo<WorkspaceContextValue>(() => {
    const isWorkspacePending =
      isConfigured && Boolean(userId) && loadedUserId !== userId;

    if (!isConfigured || (!isAuthLoading && !userId)) {
      return {
        ...(isConfigured ? demoData : data),
        workspace: !isConfigured ? demoWorkspace : null,
        isDemo: !isConfigured,
        isLoading: false,
        error: null,
        reload,
        saveDemoNote,
        deleteDemoNote,
      };
    }
    if (isAuthLoading || isWorkspacePending) {
      return {
        ...emptyData,
        workspace: null,
        isDemo: false,
        isLoading: true,
        error: null,
        reload,
        saveDemoNote,
        deleteDemoNote,
      };
    }
    return {
      ...data,
      workspace,
      isDemo: false,
      isLoading,
      error,
      reload,
      saveDemoNote,
      deleteDemoNote,
    };
  }, [
    data,
    error,
    isAuthLoading,
    isConfigured,
    isLoading,
    loadedUserId,
    reload,
    saveDemoNote,
    userId,
    workspace,
    deleteDemoNote,
  ]);
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspaceData() {
  const context = useContext(WorkspaceContext);
  if (!context)
    throw new Error('useWorkspaceData must be used within WorkspaceProvider');
  return context;
}
