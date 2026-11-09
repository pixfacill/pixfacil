-- MERCADO ALTERNATIVO — CONFIGURAÇÃO INICIAL DO SUPABASE
-- Cole este arquivo inteiro no Supabase Dashboard > SQL Editor > New query e execute.
-- Este script prepara tabelas, RLS, Realtime e limpeza diária do histórico.

create extension if not exists pg_cron;

create table if not exists public.chaves_pix (
  id uuid primary key default gen_random_uuid(),
  apelido text not null check (char_length(apelido) between 1 and 60),
  tipo_chave text not null check (tipo_chave in ('telefone', 'cpf', 'cnpj', 'email', 'aleatoria')),
  chave text not null check (char_length(chave) between 1 and 150),
  titular text not null check (char_length(titular) between 1 and 25),
  cidade text not null default 'BRASILIA' check (char_length(cidade) between 1 and 15),
  ativa boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sessoes_caixa (
  id uuid primary key default gen_random_uuid(),
  chave_id uuid not null references public.chaves_pix(id) on delete restrict,
  valor numeric(12, 2) not null check (valor > 0),
  payload_pix text not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago')),
  created_at timestamptz not null default now()
);

create index if not exists sessoes_caixa_created_at_idx
  on public.sessoes_caixa (created_at desc);
create index if not exists sessoes_caixa_status_created_at_idx
  on public.sessoes_caixa (status, created_at desc);

grant select, insert, update, delete on public.chaves_pix to anon, authenticated;
grant select, insert, update, delete on public.sessoes_caixa to anon, authenticated;

-- Impede ultrapassar o limite de 10 chaves, inclusive em inserções concorrentes.
create or replace function public.limitar_chaves_pix()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(782901);
  if tg_op = 'INSERT' and (select count(*) from public.chaves_pix) >= 10 then
    raise exception 'O limite de 10 chaves Pix foi atingido.';
  end if;
  return new;
end;
$$;

drop trigger if exists chaves_pix_limite on public.chaves_pix;
create trigger chaves_pix_limite
before insert on public.chaves_pix
for each row execute function public.limitar_chaves_pix();

alter table public.chaves_pix enable row level security;
alter table public.sessoes_caixa enable row level security;

drop policy if exists "Teste publico chaves pix" on public.chaves_pix;
create policy "Teste publico chaves pix"
  on public.chaves_pix for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "Teste publico sessoes caixa" on public.sessoes_caixa;
create policy "Teste publico sessoes caixa"
  on public.sessoes_caixa for all to anon, authenticated
  using (true) with check (true);

-- Habilita eventos de INSERT/UPDATE do Postgres Changes para o /display.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sessoes_caixa'
  ) then
    alter publication supabase_realtime add table public.sessoes_caixa;
  end if;
end;
$$;

-- >>> CONFIGURAR A RETENCAO DO HISTORICO AQUI <<<
-- O padrão é 60 dias. Para mudar, altere "default 60" abaixo (por exemplo, default 90)
-- e execute este trecho novamente. O agendamento diário chama a função sem argumento,
-- então usará exatamente este período. Isso limpa registros remotos de sessoes_caixa.
create or replace function public.limpar_sessoes_pix(p_dias_retencao integer default 60)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  total_removido bigint;
begin
  if p_dias_retencao < 1 then
    raise exception 'O período de retenção deve ser de pelo menos 1 dia.';
  end if;

  delete from public.sessoes_caixa
  where created_at < now() - make_interval(days => p_dias_retencao);
  get diagnostics total_removido = row_count;
  return total_removido;
end;
$$;

revoke all on function public.limpar_sessoes_pix(integer) from public, anon, authenticated;

-- Agenda a limpeza todos os dias às 04:00 UTC e evita criar jobs duplicados.
do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'mercado-alternativo-limpeza-pix'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'mercado-alternativo-limpeza-pix',
    '0 4 * * *',
    'select public.limpar_sessoes_pix();'
  );
end;
$$;

-- Segurança: as políticas públicas acima são somente para teste rápido sem login.
-- Qualquer pessoa com acesso ao projeto poderá ler/alterar chaves e cobranças.
-- Antes de uso real, implemente autenticação e substitua as policies por regras
-- vinculadas ao usuário/loja. Nunca coloque a service_role key no navegador.
