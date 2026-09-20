create table if not exists public.sentence_packs (
  id text primary key,
  name text not null,
  description text not null default '',
  is_premium boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sentences (
  id text primary key,
  pack_id text not null references public.sentence_packs(id) on delete cascade,
  text text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  topic text not null default 'general',
  source text not null default 'custom',
  license text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists sentences_pack_difficulty_idx
  on public.sentences (pack_id, difficulty, sort_order);

alter table public.sentence_packs enable row level security;
alter table public.sentences enable row level security;

comment on table public.sentence_packs is 'Practice sentence collections served by the Zen Dictation API.';
comment on table public.sentences is 'Individual dictation practice sentences.';
