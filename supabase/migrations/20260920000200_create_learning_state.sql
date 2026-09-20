create table if not exists public.learning_state (
  user_id text primary key references public.users(id) on delete cascade,
  review_words jsonb not null default '[]'::jsonb,
  points integer not null default 0 check (points >= 0),
  daily_target jsonb,
  goal_wpm integer not null default 40 check (goal_wpm between 10 and 200),
  updated_at timestamptz not null default now()
);

alter table public.learning_state enable row level security;
create index if not exists learning_state_updated_at_idx on public.learning_state(updated_at desc);
