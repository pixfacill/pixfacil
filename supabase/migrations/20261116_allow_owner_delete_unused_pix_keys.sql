-- Allow only the administrator to delete Pix keys.
-- The sessoes_caixa foreign key uses ON DELETE RESTRICT, preserving keys with history.
grant delete on public.chaves_pix to authenticated;

drop policy if exists "Owner deletes unused Pix keys" on public.chaves_pix;
create policy "Owner deletes unused Pix keys" on public.chaves_pix
  for delete to authenticated
  using (public.is_app_admin());
