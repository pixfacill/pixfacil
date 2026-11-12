create table if not exists public.licenca_aceites (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now()
);

alter table public.licenca_aceites enable row level security;
revoke all on public.licenca_aceites from public, anon, authenticated;
grant select on public.licenca_aceites to authenticated;

drop policy if exists "Owner reads own license acceptance" on public.licenca_aceites;
create policy "Owner reads own license acceptance" on public.licenca_aceites
  for select to authenticated
  using (user_id = auth.uid() and public.is_app_admin());

create or replace function public.accept_software_terms(p_terms_version text)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  acceptance_time timestamptz;
begin
  if auth.uid() is null or not public.is_app_admin() then
    raise exception 'Somente o administrador autenticado pode aceitar os termos.';
  end if;
  if p_terms_version is distinct from '2026-11-11-v1' then
    raise exception 'A versão dos termos informada é inválida.';
  end if;

  insert into public.licenca_aceites (user_id, terms_version, accepted_at)
  values (auth.uid(), p_terms_version, now())
  on conflict (user_id) do update
  set terms_version = excluded.terms_version,
      accepted_at = case
        when public.licenca_aceites.terms_version is distinct from excluded.terms_version
          then excluded.accepted_at
        else public.licenca_aceites.accepted_at
      end
  returning accepted_at into acceptance_time;

  return acceptance_time;
end;
$$;

revoke all on function public.accept_software_terms(text) from public, anon, authenticated;
grant execute on function public.accept_software_terms(text) to authenticated;
