-- Execute no Supabase SQL Editor para habilitar o cancelamento de cobranças existentes.
alter table public.sessoes_caixa
  drop constraint if exists sessoes_caixa_status_check;

alter table public.sessoes_caixa
  add constraint sessoes_caixa_status_check
  check (status in ('pendente', 'pago', 'cancelado'));
