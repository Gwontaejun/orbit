create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Orbit',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  content text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  parent_note_id uuid references public.notes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.note_tags (
  note_id uuid not null references public.notes(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (note_id, tag_id)
);

create table public.note_relations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_note_id uuid not null references public.notes(id) on delete cascade,
  target_note_id uuid not null references public.notes(id) on delete cascade,
  relation_type text not null default 'related',
  created_at timestamptz not null default now(),
  check (source_note_id <> target_note_id),
  unique (workspace_id, source_note_id, target_note_id, relation_type)
);

create index notes_workspace_id_idx on public.notes(workspace_id);
create index notes_parent_note_id_idx on public.notes(parent_note_id);
create index note_relations_workspace_id_idx on public.note_relations(workspace_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.owns_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces
    where id = target_workspace_id and user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.workspaces (user_id, name) values (new.id, 'Orbit');
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger tags_set_updated_at before update on public.tags
for each row execute function public.set_updated_at();
create trigger notes_set_updated_at before update on public.notes
for each row execute function public.set_updated_at();
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.notes enable row level security;
alter table public.note_tags enable row level security;
alter table public.note_relations enable row level security;

create policy "profiles: own row" on public.profiles
for all using (id = auth.uid()) with check (id = auth.uid());
create policy "workspaces: own rows" on public.workspaces
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "categories: owned workspace" on public.categories
for all using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy "tags: owned workspace" on public.tags
for all using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy "notes: owned workspace" on public.notes
for all using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy "relations: owned workspace" on public.note_relations
for all using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy "note tags: owned note" on public.note_tags
for all using (
  exists (
    select 1 from public.notes
    where notes.id = note_tags.note_id and public.owns_workspace(notes.workspace_id)
  )
) with check (
  exists (
    select 1 from public.notes
    where notes.id = note_tags.note_id and public.owns_workspace(notes.workspace_id)
  )
);
