-- =====================================================================
-- ABA ASSISTENTE > PREFERÊNCIAS (ex.: cores da matriz de pendências)
-- Só CRIA uma tabela nova. Não mexe em nenhuma tabela existente.
-- Só a dona lê e grava; ninguém apaga. O conector do Claude não usa.
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

create table if not exists public.assistente_config (
  chave text primary key check (char_length(chave) between 1 and 100),
  valor jsonb not null check (pg_column_size(valor) < 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists assistente_config_upd on public.assistente_config;
create trigger assistente_config_upd before update on public.assistente_config
  for each row execute function public.assistente_marcar_atualizacao();

alter table public.assistente_config enable row level security;

-- Visitantes sem login: nada. Ninguém apaga (nem o painel, nem robôs).
revoke all on public.assistente_config from anon;
revoke delete on public.assistente_config from authenticated, service_role;

drop policy if exists "Dona le config" on public.assistente_config;
create policy "Dona le config" on public.assistente_config
  for select to authenticated using (public.assistente_eh_dona());
drop policy if exists "Dona cria config" on public.assistente_config;
create policy "Dona cria config" on public.assistente_config
  for insert to authenticated with check (public.assistente_eh_dona());
drop policy if exists "Dona atualiza config" on public.assistente_config;
create policy "Dona atualiza config" on public.assistente_config
  for update to authenticated using (public.assistente_eh_dona()) with check (public.assistente_eh_dona());

-- Conferência
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'assistente_config';
