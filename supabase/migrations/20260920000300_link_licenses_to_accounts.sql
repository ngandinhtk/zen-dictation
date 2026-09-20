alter table public.licenses
  add column if not exists activated_user_id text references public.users(id) on delete set null;

create index if not exists licenses_activated_user_idx
  on public.licenses(activated_user_id)
  where activated_user_id is not null;
