-- MERCADO ALTERNATIVO — CONFIGURAÇÃO DO SUPABASE
-- Execute este arquivo inteiro no Supabase SQL Editor.
-- O operador não digita senha: o link secreto vincula a sessão anônima ao caixa.
-- RLS permite que o dono veja tudo e que cada sessão de caixa veja apenas seu terminal.

create extension if not exists pg_cron;
create extension if not exists pgcrypto with schema extensions;

drop function if exists public.create_cashbox_install_ticket(uuid, text);
drop function if exists public.redeem_cashbox_install_ticket(uuid, text);
drop table if exists public.cashbox_install_tickets;

create table if not exists public.administradores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.caixas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 60),
  ativo boolean not null default true,
  excluido boolean not null default false,
  access_token_hash text,
  created_at timestamptz not null default now()
);

alter table public.caixas add column if not exists access_token_hash text;
alter table public.caixas add column if not exists excluido boolean not null default false;

create table if not exists public.caixa_links (
  caixa_id uuid primary key references public.caixas(id) on delete cascade,
  access_token text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.caixa_display_links (
  caixa_id uuid primary key references public.caixas(id) on delete cascade,
  display_token text not null unique,
  updated_at timestamptz not null default now()
);

create table if not exists public.caixa_dispositivos (
  user_id uuid not null references auth.users(id) on delete cascade,
  caixa_id uuid not null references public.caixas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, caixa_id)
);

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

create table if not exists public.caixa_chaves (
  caixa_id uuid not null references public.caixas(id) on delete cascade,
  chave_id uuid not null references public.chaves_pix(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (caixa_id, chave_id)
);

alter table public.chaves_pix
  drop constraint if exists chaves_pix_tipo_chave_check;
alter table public.chaves_pix
  add constraint chaves_pix_tipo_chave_check
  check (tipo_chave in ('telefone', 'cpf', 'cnpj', 'email', 'aleatoria'));

create table if not exists public.sessoes_caixa (
  id uuid primary key default gen_random_uuid(),
  chave_id uuid not null references public.chaves_pix(id) on delete restrict,
  caixa_id uuid references public.caixas(id) on delete set null,
  caixa_nome text not null default 'Caixa principal',
  valor numeric(12, 2) not null check (valor > 0),
  payload_pix text not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago')),
  created_at timestamptz not null default now()
);

alter table public.sessoes_caixa
  add column if not exists caixa_id uuid references public.caixas(id) on delete set null;
alter table public.sessoes_caixa
  add column if not exists caixa_nome text not null default 'Caixa principal';

-- Migra cobranças antigas para o caixa principal sem apagar registros.
insert into public.caixas (nome)
select 'Caixa principal'
where not exists (select 1 from public.caixas);

update public.sessoes_caixa
set caixa_id = (select id from public.caixas order by created_at, id limit 1)
where caixa_id is null;

alter table public.sessoes_caixa
  drop constraint if exists sessoes_caixa_status_check;
-- Cancelamentos antigos não fazem parte do histórico: remova-os ao reaplicar este SQL.
delete from public.sessoes_caixa where status = 'cancelado';
alter table public.sessoes_caixa
  add constraint sessoes_caixa_status_check
  check (status in ('pendente', 'pago'));

create index if not exists sessoes_caixa_created_at_idx
  on public.sessoes_caixa (created_at desc);
create index if not exists sessoes_caixa_status_created_at_idx
  on public.sessoes_caixa (status, created_at desc);
create index if not exists sessoes_caixa_caixa_created_at_idx
  on public.sessoes_caixa (caixa_id, created_at desc);
create index if not exists caixa_dispositivos_user_id_idx
  on public.caixa_dispositivos (user_id);
create unique index if not exists caixas_access_token_hash_idx
  on public.caixas (access_token_hash)
  where access_token_hash is not null;

create or replace function public.limitar_chaves_pix()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(782901);
  if tg_op = 'INSERT'
    and not exists (select 1 from public.chaves_pix where id = new.id)
    and (select count(*) from public.chaves_pix) >= 10 then
    raise exception 'O limite de 10 chaves Pix foi atingido.';
  end if;
  return new;
end;
$$;

drop trigger if exists chaves_pix_limite on public.chaves_pix;
create trigger chaves_pix_limite
before insert on public.chaves_pix
for each row execute function public.limitar_chaves_pix();

create table if not exists public.configuracoes_sistema (
  id integer primary key check (id = 1),
  dias_retencao integer not null default 60 check (dias_retencao between 1 and 3650),
  updated_at timestamptz not null default now()
);

insert into public.configuracoes_sistema (id, dias_retencao)
values (1, 60)
on conflict (id) do nothing;

create or replace function public.owner_setup_available()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (select 1 from public.administradores);
$$;

create or replace function public.claim_first_admin(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(781204);
  if exists (select 1 from public.administradores) then
    return false;
  end if;
  insert into public.administradores (user_id) values (p_user_id);
  return true;
end;
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.administradores where user_id = auth.uid()
  );
$$;

create or replace function public.can_access_cashbox(p_box_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_app_admin()
    or exists (
      select 1
      from public.caixa_dispositivos
      where user_id = auth.uid() and caixa_id = p_box_id
    );
$$;

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

insert into public.caixa_chaves (caixa_id, chave_id)
select caixa.id, chave.id
from public.caixas as caixa
cross join public.chaves_pix as chave
on conflict do nothing;

create or replace function public.redeem_cashbox_link(p_box_id uuid, p_access_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if auth.uid() is null or p_access_token is null or char_length(p_access_token) < 32 then
    raise exception 'Link do caixa inválido.';
  end if;

  if not exists (
    select 1
    from public.caixas
    where id = p_box_id
      and ativo
      and access_token_hash = encode(digest(convert_to(p_access_token, 'UTF8'), 'sha256'), 'hex')
  ) then
    raise exception 'Link do caixa inválido ou revogado.';
  end if;

  insert into public.caixa_dispositivos (user_id, caixa_id)
  values (auth.uid(), p_box_id)
  on conflict (user_id, caixa_id) do nothing;

  return true;
end;
$$;

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

create or replace function public.set_history_retention(p_days integer)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Somente o administrador pode alterar a retenção.';
  end if;
  if p_days not between 1 and 3650 then
    raise exception 'O prazo deve estar entre 1 e 3650 dias.';
  end if;

  insert into public.configuracoes_sistema (id, dias_retencao, updated_at)
  values (1, p_days, now())
  on conflict (id) do update
  set dias_retencao = excluded.dias_retencao, updated_at = now();
  return p_days;
end;
$$;

create or replace function public.limpar_sessoes_pix()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  total_removido bigint;
  dias_configurados integer;
begin
  select dias_retencao into dias_configurados
  from public.configuracoes_sistema where id = 1;
  dias_configurados := coalesce(dias_configurados, 60);

  delete from public.sessoes_caixa
  where created_at < now() - make_interval(days => dias_configurados);
  get diagnostics total_removido = row_count;
  return total_removido;
end;
$$;

revoke all on function public.claim_first_admin(uuid) from public, anon, authenticated;
grant execute on function public.claim_first_admin(uuid) to service_role;
revoke all on function public.limpar_sessoes_pix() from public, anon, authenticated;
grant execute on function public.owner_setup_available() to anon, authenticated;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.can_access_cashbox(uuid) to authenticated;
revoke all on function public.save_cashbox_display_link(uuid, text) from public, anon;
grant execute on function public.save_cashbox_display_link(uuid, text) to authenticated;
revoke all on function public.get_cashbox_display_session(uuid, text) from public;
grant execute on function public.get_cashbox_display_session(uuid, text) to anon, authenticated;
grant execute on function public.set_cashbox_pix_keys(uuid, uuid[]) to authenticated;
grant execute on function public.can_use_cashbox_pix_key(uuid, uuid) to authenticated;
grant execute on function public.redeem_cashbox_link(uuid, text) to authenticated;
grant execute on function public.create_cashbox(text, text) to authenticated;
grant execute on function public.rotate_cashbox_link(uuid, text) to authenticated;
grant execute on function public.archive_cashbox(uuid) to authenticated;
grant execute on function public.delete_cashbox(uuid) to authenticated;
grant execute on function public.set_history_retention(integer) to authenticated;

grant select, insert, update on public.administradores to authenticated;
grant select, insert, update on public.caixas to authenticated;
grant select on public.caixa_dispositivos to authenticated;
grant select on public.caixa_chaves to authenticated;
grant select, insert, update on public.chaves_pix to authenticated;
grant delete on public.chaves_pix to authenticated;
revoke all on public.sessoes_caixa from public, anon, authenticated;
grant select, delete on public.sessoes_caixa to authenticated;
grant insert (id, chave_id, caixa_id, caixa_nome, valor, payload_pix, status)
  on public.sessoes_caixa to authenticated;
grant update (status) on public.sessoes_caixa to authenticated;
grant select, update on public.configuracoes_sistema to authenticated;

revoke all on public.caixa_links from public, anon, authenticated;
grant select on public.caixa_links to authenticated;
revoke all on public.caixa_display_links from public, anon, authenticated;
grant select on public.caixa_display_links to authenticated;

alter table public.administradores enable row level security;
alter table public.caixas enable row level security;
alter table public.caixa_dispositivos enable row level security;
alter table public.caixa_chaves enable row level security;
alter table public.caixa_links enable row level security;
alter table public.chaves_pix enable row level security;
alter table public.sessoes_caixa enable row level security;
alter table public.configuracoes_sistema enable row level security;

drop policy if exists "Owner administers admins" on public.administradores;
create policy "Owner administers admins" on public.administradores
  for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "Owner or assigned device reads boxes" on public.caixas;
create policy "Owner or assigned device reads boxes" on public.caixas
  for select to authenticated
  using (public.is_app_admin() or public.can_access_cashbox(id));
drop policy if exists "Owner manages boxes" on public.caixas;
create policy "Owner manages boxes" on public.caixas
  for all to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "Owner reads saved cashbox links" on public.caixa_links;
create policy "Owner reads saved cashbox links" on public.caixa_links
  for select to authenticated
  using (public.is_app_admin());

alter table public.caixa_display_links enable row level security;
drop policy if exists "Owner reads saved customer display links" on public.caixa_display_links;
create policy "Owner reads saved customer display links" on public.caixa_display_links
  for select to authenticated
  using (public.is_app_admin());

drop policy if exists "Device reads its own assignment" on public.caixa_dispositivos;
create policy "Device reads its own assignment" on public.caixa_dispositivos
  for select to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

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
drop policy if exists "Owner manages Pix keys" on public.chaves_pix;
create policy "Owner manages Pix keys" on public.chaves_pix
  for insert to authenticated
  with check (public.is_app_admin());
drop policy if exists "Owner updates Pix keys" on public.chaves_pix;
create policy "Owner updates Pix keys" on public.chaves_pix
  for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "Owner deletes unused Pix keys" on public.chaves_pix;
create policy "Owner deletes unused Pix keys" on public.chaves_pix
  for delete to authenticated
  using (public.is_app_admin());

drop policy if exists "Owner and assigned box read sessions" on public.sessoes_caixa;
drop policy if exists "Teste publico sessoes caixa" on public.sessoes_caixa;
create policy "Owner and assigned box read sessions" on public.sessoes_caixa
  for select to authenticated
  using (public.is_app_admin() or public.can_access_cashbox(caixa_id));
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

drop policy if exists "Owner reads settings" on public.configuracoes_sistema;
create policy "Owner reads settings" on public.configuracoes_sistema
  for select to authenticated using (public.is_app_admin());
drop policy if exists "Owner updates settings" on public.configuracoes_sistema;
create policy "Owner updates settings" on public.configuracoes_sistema
  for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());

revoke all on public.administradores from anon;
revoke all on public.caixas from anon;
revoke all on public.caixa_dispositivos from anon;
revoke all on public.caixa_chaves from anon;
revoke all on public.caixa_links from anon;
revoke all on public.chaves_pix from anon;
revoke all on public.sessoes_caixa from anon;
revoke all on public.configuracoes_sistema from anon;

-- Postgres Changes para atualizar o display em tempo real.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sessoes_caixa'
  ) then
    alter publication supabase_realtime add table public.sessoes_caixa;
  end if;
end;
$$;

-- Retenção global: valor inicial 60 dias, editável pelo dono no app.
-- A limpeza roda diariamente às 04:00 UTC e lê configuracoes_sistema.dias_retencao.
do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job
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

-- Não crie policies para anon: login do dono e sessão anônima vinculada pelo link
-- usam role authenticated; o banco aplica RLS por proprietário/caixa.
