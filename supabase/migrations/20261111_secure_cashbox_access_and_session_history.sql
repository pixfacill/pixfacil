-- Install links remain reusable; the permanent owner-generated cashbox link authorizes each operator device.
drop function if exists public.create_cashbox_install_ticket(uuid, text);
drop function if exists public.redeem_cashbox_install_ticket(uuid, text);
drop table if exists public.cashbox_install_tickets;

-- Cashiers may insert pending sales and only transition their own pending sale to paid.
revoke all on public.sessoes_caixa from public, anon, authenticated;
grant select, delete on public.sessoes_caixa to authenticated;
grant insert (id, chave_id, caixa_id, caixa_nome, valor, payload_pix, status)
  on public.sessoes_caixa to authenticated;
grant update (status) on public.sessoes_caixa to authenticated;

drop policy if exists "Owner and assigned box create sessions" on public.sessoes_caixa;
create policy "Owner and assigned box create sessions" on public.sessoes_caixa
  for insert to authenticated
  with check (
    status = 'pendente'
    and public.can_use_cashbox_pix_key(caixa_id, chave_id)
  );

drop policy if exists "Owner and assigned box update sessions" on public.sessoes_caixa;
create policy "Owner and assigned box update sessions" on public.sessoes_caixa
  for update to authenticated
  using (
    status = 'pendente'
    and (public.is_app_admin() or public.can_access_cashbox(caixa_id))
  )
  with check (
    status = 'pago'
    and (public.is_app_admin() or public.can_access_cashbox(caixa_id))
  );

drop policy if exists "Owner and assigned box delete pending sessions" on public.sessoes_caixa;
create policy "Owner and assigned box delete pending sessions" on public.sessoes_caixa
  for delete to authenticated
  using (
    status = 'pendente'
    and (public.is_app_admin() or public.can_access_cashbox(caixa_id))
  );
