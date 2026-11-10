-- Allow an administrator or the assigned cashbox to cancel pending charges.
-- Paid sessions cannot be deleted through this policy.
drop policy if exists "Owner and assigned box delete pending sessions"
  on public.sessoes_caixa;

create policy "Owner and assigned box delete pending sessions"
  on public.sessoes_caixa
  for delete to authenticated
  using (
    status = 'pendente'
    and (public.is_app_admin() or public.can_access_cashbox(caixa_id))
  );

grant delete on public.sessoes_caixa to authenticated;
