import type { Category, Note, NoteRelation, Tag } from '../model/types';
import { supabase } from '../../../shared/lib/supabase/client';

export type Workspace = { id: string; name: string };
export type WorkspaceGraphData = {
  workspace: Workspace;
  notes: Note[];
  categories: Category[];
  tags: Tag[];
  relations: NoteRelation[];
};
export type SaveNoteInput = {
  id?: string;
  workspaceId: string;
  title: string;
  content: string;
  categoryName: string;
  parentNoteId: string | null;
  tagIds: string[];
  newTagNames: string[];
  relatedNoteIds: string[];
};

async function removeUnusedMetadata(workspaceId: string) {
  if (!supabase) return;
  const database = supabase;
  const [notesResult, categoriesResult, tagsResult, noteTagsResult] =
    await Promise.all([
      database
        .from('notes')
        .select('category_id')
        .eq('workspace_id', workspaceId),
      database.from('categories').select('id').eq('workspace_id', workspaceId),
      database.from('tags').select('id').eq('workspace_id', workspaceId),
      database.from('note_tags').select('note_id, tag_id'),
    ]);
  const resultWithError = [
    notesResult,
    categoriesResult,
    tagsResult,
    noteTagsResult,
  ].find((result) => result.error);
  if (resultWithError?.error) throw resultWithError.error;

  const usedCategoryIds = new Set(
    (notesResult.data ?? [])
      .map((note) => note.category_id)
      .filter((categoryId): categoryId is string => Boolean(categoryId)),
  );
  const unusedCategoryIds = (categoriesResult.data ?? [])
    .map((category) => category.id)
    .filter((categoryId) => !usedCategoryIds.has(categoryId));
  if (unusedCategoryIds.length > 0) {
    const { error } = await database
      .from('categories')
      .delete()
      .in('id', unusedCategoryIds);
    if (error) throw error;
  }

  const usedTagIds = new Set(
    (noteTagsResult.data ?? []).map((tag) => tag.tag_id),
  );
  const unusedTagIds = (tagsResult.data ?? [])
    .map((tag) => tag.id)
    .filter((tagId) => !usedTagIds.has(tagId));
  if (unusedTagIds.length > 0) {
    const { error } = await database
      .from('tags')
      .delete()
      .in('id', unusedTagIds);
    if (error) throw error;
  }
}

type NoteRow = {
  id: string;
  title: string;
  content: string;
  category_id: string | null;
  parent_note_id: string | null;
};

/** Loads domain data separately from the graph renderer and layout engine. */
export async function loadWorkspaceGraph(
  userId: string,
): Promise<WorkspaceGraphData | null> {
  if (!supabase) return null;

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('user_id', userId)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (workspaceError) throw workspaceError;
  if (!workspace) return null;

  const [
    notesResult,
    categoriesResult,
    tagsResult,
    noteTagsResult,
    relationsResult,
  ] = await Promise.all([
    supabase
      .from('notes')
      .select('id, title, content, category_id, parent_note_id')
      .eq('workspace_id', workspace.id),
    supabase
      .from('categories')
      .select('id, name, color')
      .eq('workspace_id', workspace.id),
    supabase.from('tags').select('id, name').eq('workspace_id', workspace.id),
    supabase.from('note_tags').select('note_id, tag_id'),
    supabase
      .from('note_relations')
      .select('id, source_note_id, target_note_id, relation_type')
      .eq('workspace_id', workspace.id),
  ]);

  const resultWithError = [
    notesResult,
    categoriesResult,
    tagsResult,
    noteTagsResult,
    relationsResult,
  ].find((result) => result.error);
  if (resultWithError?.error) throw resultWithError.error;

  const tagIdsByNote = new Map<string, string[]>();
  for (const entry of noteTagsResult.data ?? []) {
    const tagIds = tagIdsByNote.get(entry.note_id) ?? [];
    tagIds.push(entry.tag_id);
    tagIdsByNote.set(entry.note_id, tagIds);
  }

  const notes = ((notesResult.data as NoteRow[] | null) ?? []).map((note) => ({
    id: note.id,
    title: note.title,
    content: note.content,
    categoryId: note.category_id ?? 'uncategorized',
    parentNoteId: note.parent_note_id,
    tagIds: tagIdsByNote.get(note.id) ?? [],
  }));
  const usedCategoryIds = new Set(notes.map((note) => note.categoryId));
  const usedTagIds = new Set(notes.flatMap((note) => note.tagIds));

  return {
    workspace,
    notes,
    categories: (categoriesResult.data ?? []).filter((category) =>
      usedCategoryIds.has(category.id),
    ),
    tags: (tagsResult.data ?? []).filter((tag) => usedTagIds.has(tag.id)),
    relations: (relationsResult.data ?? []).map((relation) => ({
      id: relation.id,
      sourceNoteId: relation.source_note_id,
      targetNoteId: relation.target_note_id,
      relationType: relation.relation_type,
    })),
  };
}

export async function saveNote(input: SaveNoteInput): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured');
  const database = supabase;

  let resolvedCategoryId: string | null = null;
  if (input.categoryName.trim()) {
    const { data, error } = await database
      .from('categories')
      .upsert(
        {
          workspace_id: input.workspaceId,
          name: input.categoryName.trim(),
          color: '#8ba8ff',
        },
        { onConflict: 'workspace_id,name' },
      )
      .select('id')
      .single();
    if (error) throw error;
    resolvedCategoryId = data.id;
  }

  const payload = {
    workspace_id: input.workspaceId,
    title: input.title.trim(),
    content: input.content,
    category_id: resolvedCategoryId,
    parent_note_id: input.parentNoteId,
  };
  const result = input.id
    ? await database
        .from('notes')
        .update(payload)
        .eq('id', input.id)
        .select('id')
        .single()
    : await database.from('notes').insert(payload).select('id').single();
  if (result.error) throw result.error;
  const noteId = result.data.id;

  const deleteTags = await database
    .from('note_tags')
    .delete()
    .eq('note_id', noteId);
  if (deleteTags.error) throw deleteTags.error;
  const createdTags = await Promise.all(
    input.newTagNames.map(async (name) => {
      const { data, error } = await database
        .from('tags')
        .upsert(
          { workspace_id: input.workspaceId, name },
          { onConflict: 'workspace_id,name' },
        )
        .select('id')
        .single();
      if (error) throw error;
      return data.id;
    }),
  );
  const allTagIds = [...new Set([...input.tagIds, ...createdTags])];
  const insertTags = await Promise.all(
    allTagIds.map((tagId) =>
      database.from('note_tags').insert({ note_id: noteId, tag_id: tagId }),
    ),
  );
  const tagError = insertTags.find((operation) => operation.error)?.error;
  if (tagError) throw tagError;

  const deleteRelations = await database
    .from('note_relations')
    .delete()
    .eq('workspace_id', input.workspaceId)
    .or(`source_note_id.eq.${noteId},target_note_id.eq.${noteId}`);
  if (deleteRelations.error) throw deleteRelations.error;
  if (input.relatedNoteIds.length > 0) {
    const { error } = await database.from('note_relations').insert(
      input.relatedNoteIds.map((targetNoteId) => ({
        workspace_id: input.workspaceId,
        source_note_id: noteId,
        target_note_id: targetNoteId,
        relation_type: 'related',
      })),
    );
    if (error) throw error;
  }

  await removeUnusedMetadata(input.workspaceId);

  return noteId;
}

export async function deleteNote(noteId: string, workspaceId: string) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.from('notes').delete().eq('id', noteId);
  if (error) throw error;
  await removeUnusedMetadata(workspaceId);
}
