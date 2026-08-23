/* eslint-disable react-hooks/set-state-in-effect */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  mockCategories,
  mockNotes,
  mockRelations,
  mockTags,
  type Note,
} from '@/entities/note';
import {
  loadWorkspaceGraph,
  WorkspaceContext,
  type DemoNoteInput,
  type WorkspaceContextValue,
  type WorkspaceData,
} from '@/entities/workspace';
import type { Workspace } from '@/entities/workspace';
import { useAuth } from '@/features/auth';

const demoData: WorkspaceData = {
  notes: mockNotes,
  categories: mockCategories,
  tags: mockTags,
  relations: mockRelations,
};
const emptyData: WorkspaceData = {
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
export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { isConfigured, isLoading: isAuthLoading, user } = useAuth();
  const userId = user?.id ?? null;
  const [data, setData] = useState<WorkspaceData>(demoData);
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
