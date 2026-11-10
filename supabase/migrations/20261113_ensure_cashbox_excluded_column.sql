-- Ensure older Supabase projects have the soft-delete flag used by cashbox RPCs.
alter table public.caixas
  add column if not exists excluido boolean not null default false;
