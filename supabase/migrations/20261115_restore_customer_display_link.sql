-- Separate, read-only customer display links from operator access links.
create table if not exists public.caixa_display_links (
  caixa_id uuid primary key references public.caixas(id) on delete cascade,
  display_token text not null unique,
  updated_at timestamptz not null default now()
);

revoke all on public.caixa_display_links from public, anon, authenticated;
grant select on public.caixa_display_links to authenticated;
alter table public.caixa_display_links enable row level security;

drop policy if exists "Owner reads saved customer display links"
  on public.caixa_display_links;
create policy "Owner reads saved customer display links"
  on public.caixa_display_links
  for select to authenticated
  using (public.is_app_admin());

create or replace function public.save_cashbox_display_link(p_box_id uuid, p_display_token text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Somente o administrador pode gerar o link da tela do cliente.';
  end if;
  if char_length(p_display_token) < 32 then
    raise exception 'Token da tela do cliente inválido.';
  end if;
  if not exists (select 1 from public.caixas where id = p_box_id and ativo and not excluido) then
    raise exception 'Caixa inexistente, arquivado ou removido.';
  end if;

  insert into public.caixa_display_links (caixa_id, display_token)
  values (p_box_id, p_display_token)
  on conflict (caixa_id) do update
  set display_token = excluded.display_token, updated_at = now();
  return true;
end;
$$;

revoke all on function public.save_cashbox_display_link(uuid, text) from public, anon;
grant execute on function public.save_cashbox_display_link(uuid, text) to authenticated;

drop function if exists public.get_cashbox_display_session(uuid, text);
create function public.get_cashbox_display_session(p_box_id uuid, p_display_token text)
returns table (
  link_valid boolean,
  session_id uuid,
  caixa_nome text,
  valor numeric,
  payload_pix text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select true, s.id, box.nome, s.valor, s.payload_pix, s.created_at
  from public.caixa_display_links as display_link
  join public.caixas as box on box.id = display_link.caixa_id
  left join lateral (
    select session.id, session.caixa_nome, session.valor, session.payload_pix, session.created_at
    from public.sessoes_caixa as session
    where session.caixa_id = box.id and session.status = 'pendente'
    order by session.created_at desc, session.id
    limit 1
  ) as s on true
  where display_link.caixa_id = p_box_id
    and display_link.display_token = p_display_token
    and box.ativo
    and not box.excluido
  limit 1;
$$;

revoke all on function public.get_cashbox_display_session(uuid, text) from public;
grant execute on function public.get_cashbox_display_session(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
