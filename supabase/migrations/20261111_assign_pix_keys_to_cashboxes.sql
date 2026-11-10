-- Allow the owner to assign one or more Pix keys to each cashbox.
alter table public.caixas
  add column if not exists excluido boolean not null default false;

create table if not exists public.caixa_chaves (
  caixa_id uuid not null references public.caixas(id) on delete cascade,
  chave_id uuid not null references public.chaves_pix(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (caixa_id, chave_id)
);

-- Preserve the previous behavior for existing cashboxes: all current keys remain available.
insert into public.caixa_chaves (caixa_id, chave_id)
select caixa.id, chave.id
from public.caixas as caixa
cross join public.chaves_pix as chave
on conflict do nothing;

create or replace function public.can_use_cashbox_pix_key(p_box_id uuid, p_key_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_app_admin()
    or (
      public.can_access_cashbox(p_box_id)
      and exists (
        select 1
        from public.caixa_chaves
        where caixa_id = p_box_id and chave_id = p_key_id
      )
    );
$$;

create or replace function public.set_cashbox_pix_keys(p_box_id uuid, p_key_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  unique_count integer;
begin
  if not public.is_app_admin() then
    raise exception 'Somente o administrador pode configurar as chaves dos caixas.';
  end if;
  if not exists (select 1 from public.caixas where id = p_box_id and not excluido) then
    raise exception 'Caixa inexistente ou removido.';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_key_ids, array[]::uuid[])) as requested(key_id)
    where not exists (select 1 from public.chaves_pix where id = requested.key_id)
  ) then
    raise exception 'Uma ou mais chaves Pix não existem.';
  end if;

  delete from public.caixa_chaves where caixa_id = p_box_id;
  insert into public.caixa_chaves (caixa_id, chave_id)
  select p_box_id, requested.key_id
  from (
    select distinct key_id
    from unnest(coalesce(p_key_ids, array[]::uuid[])) as ids(key_id)
  ) as requested;

  get diagnostics unique_count = row_count;
  return unique_count;
end;
$$;

grant execute on function public.set_cashbox_pix_keys(uuid, uuid[]) to authenticated;
grant execute on function public.can_use_cashbox_pix_key(uuid, uuid) to authenticated;
grant select on public.caixa_chaves to authenticated;
revoke all on public.caixa_chaves from anon;
alter table public.caixa_chaves enable row level security;

drop policy if exists "Owner and assigned devices read box Pix keys" on public.caixa_chaves;
create policy "Owner and assigned devices read box Pix keys" on public.caixa_chaves
  for select to authenticated
  using (public.is_app_admin() or public.can_access_cashbox(caixa_id));

drop policy if exists "Assigned devices read Pix keys" on public.chaves_pix;
drop policy if exists "Teste publico chaves pix" on public.chaves_pix;
create policy "Assigned devices read Pix keys" on public.chaves_pix
  for select to authenticated
  using (
    public.is_app_admin()
    or exists (
      select 1
      from public.caixa_chaves as assignment
      where assignment.chave_id = chaves_pix.id
        and public.can_access_cashbox(assignment.caixa_id)
    )
  );

drop policy if exists "Owner and assigned box create sessions" on public.sessoes_caixa;
create policy "Owner and assigned box create sessions" on public.sessoes_caixa
  for insert to authenticated
  with check (public.can_use_cashbox_pix_key(caixa_id, chave_id));

drop policy if exists "Owner and assigned box update sessions" on public.sessoes_caixa;
create policy "Owner and assigned box update sessions" on public.sessoes_caixa
  for update to authenticated
  using (public.is_app_admin() or public.can_access_cashbox(caixa_id))
  with check (public.is_app_admin() or public.can_access_cashbox(caixa_id));
