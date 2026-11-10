-- Cancelled charges are not retained in history. Apply after 20261109_add_cancelled_status.sql.
alter table public.sessoes_caixa
  drop constraint if exists sessoes_caixa_status_check;

delete from public.sessoes_caixa
where status = 'cancelado';

alter table public.sessoes_caixa
  add constraint sessoes_caixa_status_check
  check (status in ('pendente', 'pago'));

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
  delete from public.sessoes_caixa
  where caixa_id = p_box_id and status = 'pendente';
  return true;
end;
$$;
