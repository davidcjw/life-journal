-- ─────────────────────────────────────────────────────────────────────────────
-- Live Journal — Supabase schema
--
-- Run this once in the Supabase SQL editor (or via `psql`) to provision the
-- database. Every table has RLS enabled with NO policies: nothing is reachable
-- with the anon/public key. All app access uses the service_role key, which
-- bypasses RLS and is server-only.
--
-- Also create a PRIVATE storage bucket named `journal-photos` (Storage → New
-- bucket → uncheck "Public"). Its objects are served via short-lived signed URLs.
--
-- Upgrading an existing single-journal deployment? See the MIGRATION block at the
-- bottom — this file is safe to re-run (everything is IF NOT EXISTS / additive).
-- ─────────────────────────────────────────────────────────────────────────────

-- Journals: each row is one photo book. A deployment can hold several at once.
create table if not exists public.journals (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  title      text not null,
  subtitle   text not null default '',
  created_at timestamptz not null default now()
);

-- Memories. Each belongs to exactly one journal.
create table if not exists public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  journal_id  uuid references public.journals(id) on delete cascade,
  event_date  date not null,
  title       text not null,
  description text,
  photos      text[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists journal_entries_journal_id_idx
  on public.journal_entries (journal_id, event_date);

-- In-progress bot conversations (one row per Telegram chat). `journal_id` is the
-- journal the in-progress memory will be saved to (snapshotted at /new).
create table if not exists public.journal_bot_drafts (
  chat_id       bigint primary key,
  step          text not null default 'idle',
  title         text,
  event_date    date,
  description   text,
  photos        text[] not null default '{}',
  edit_entry_id uuid,
  journal_id    uuid references public.journals(id) on delete set null
);

-- Per-chat bot settings: which journal the bot is currently writing to.
create table if not exists public.journal_bot_settings (
  chat_id           bigint primary key,
  active_journal_id uuid references public.journals(id) on delete set null,
  updated_at        timestamptz not null default now()
);

-- Race-safe photo append for album uploads (each photo arrives as its own
-- webhook call). Appends only while under the 3-photo cap; returns the result.
create or replace function public.journal_append_draft_photo(p_chat_id bigint, p_path text)
returns text[]
language plpgsql
as $$
declare
  result text[];
begin
  update public.journal_bot_drafts
     set photos = case
       when coalesce(array_length(photos, 1), 0) >= 3 then photos
       else array_append(photos, p_path)
     end
   where chat_id = p_chat_id
   returning photos into result;
  return coalesce(result, '{}');
end;
$$;

-- Lock everything down: RLS on, zero policies (service_role bypasses RLS).
alter table public.journals            enable row level security;
alter table public.journal_entries     enable row level security;
alter table public.journal_bot_drafts  enable row level security;
alter table public.journal_bot_settings enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION — existing single-journal deployments only.
--
-- If `journal_entries` predates the `journals` table, add the column and adopt
-- the orphaned entries into a first journal. The app also does this lazily
-- (ensureDefaultJournal), so running this by hand is optional but tidy.
-- ─────────────────────────────────────────────────────────────────────────────
-- alter table public.journal_entries
--   add column if not exists journal_id uuid references public.journals(id) on delete cascade;
-- alter table public.journal_bot_drafts
--   add column if not exists journal_id uuid references public.journals(id) on delete set null;
--
-- insert into public.journals (slug, title, subtitle)
-- select 'our-journal', 'Our Journal', 'A book of moments'
-- where not exists (select 1 from public.journals);
--
-- update public.journal_entries
--    set journal_id = (select id from public.journals order by created_at asc limit 1)
--  where journal_id is null;
