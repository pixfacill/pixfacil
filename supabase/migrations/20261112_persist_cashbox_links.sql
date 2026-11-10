-- Save the current operator link so the owner can retrieve it from the cashbox details.
create table if not exists public.caixa_links (
  caixa_id uuid primary key references public.caixas(id) on delete cascade,
  access_token text not null,
  updated_at timestamptz not null default now()
);

revoke all on public.caixa_links from public, anon, authenticated;
grant select on public.caixa_links to authenticated;
alter table public.caixa_links enable row level security;

drop policy if exists "Owner reads saved cashbox links" on public.caixa_links;
create policy "Owner reads saved cashbox links" on public.caixa_links
  for select to authenticated
  using (public.is_app_admin());

drop function if exists public.create_cashbox(text, text);
create function public.create_cashbox(p_nome text, p_access_token text)
returns public.caixas
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  created_box public.caixas;
begin
  if not public.is_app_admin() then
    raise exception 'Somente o administrador pode criar caixas.';
  end if;
  if char_length(trim(p_nome)) not between 1 and 60 or char_length(p_access_token) < 32 then
    raise exception 'Nome ou link do caixa inválido.';
  end if;

  insert into public.caixas (nome, access_token_hash)
  values (trim(p_nome), encode(digest(convert_to(p_access_token, 'UTF8'), 'sha256'), 'hex'))
  returning * into created_box;

  insert into public.caixa_links (caixa_id, access_token)
  values (created_box.id, p_access_token);
  return created_box;
end;
$$;

drop function if exists public.rotate_cashbox_link(uuid, text);
create function public.rotate_cashbox_link(p_box_id uuid, p_access_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Somente o administrador pode renovar links.';
  end if;
  if char_length(p_access_token) < 32 then
    raise exception 'Token do caixa inválido.';
  end if;

  update public.caixas
  set access_token_hash = encode(digest(convert_to(p_access_token, 'UTF8'), 'sha256'), 'hex')
  where id = p_box_id and ativo;
  if not found then
    raise exception 'Caixa inexistente ou arquivado.';
  end if;

  insert into public.caixa_links (caixa_id, access_token, updated_at)
  values (p_box_id, p_access_token, now())
  on conflict (caixa_id) do update
  set access_token = excluded.access_token, updated_at = excluded.updated_at;

  delete from public.caixa_dispositivos where caixa_id = p_box_id;
  return true;
end;
$$;

create or replace function public.archive_cashbox(p_box_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Somente o administrador pode arquivar caixas.';
  end if;

  update public.caixas
  set ativo = false, access_token_hash = null
  where id = p_box_id and ativo;
  if not found then
    raise exception 'Caixa inexistente ou já arquivado.';
  end if;

  delete from public.caixa_dispositivos where caixa_id = p_box_id;
  delete from public.caixa_links where caixa_id = p_box_id;
  delete from public.sessoes_caixa
  where caixa_id = p_box_id and status = 'pendente';
  return true;
end;
$$;

create or replace function public.delete_cashbox(p_box_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Somente o administrador pode remover caixas.';
  end if;

  update public.caixas
  set ativo = false, excluido = true, access_token_hash = null
  where id = p_box_id and not excluido;
  if not found then
    raise exception 'Caixa inexistente ou já removido.';
  end if;

  delete from public.caixa_dispositivos where caixa_id = p_box_id;
  delete from public.caixa_links where caixa_id = p_box_id;
  delete from public.sessoes_caixa
  where caixa_id = p_box_id and status = 'pendente';
  return true;
end;
$$;

grant execute on function public.create_cashbox(text, text) to authenticated;
grant execute on function public.rotate_cashbox_link(uuid, text) to authenticated;
grant execute on function public.archive_cashbox(uuid) to authenticated;
grant execute on function public.delete_cashbox(uuid) to authenticated;
