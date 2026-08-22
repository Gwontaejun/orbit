export type Category = {
  id: string;
  name: string;
  color: string;
};

export type Tag = {
  id: string;
  name: string;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  tagIds: string[];
  parentNoteId: string | null;
};

export type NoteRelation = {
  id: string;
  sourceNoteId: string;
  targetNoteId: string;
  relationType: 'related';
};
