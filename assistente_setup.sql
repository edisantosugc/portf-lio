-- =====================================================================
-- ABA "ASSISTENTE" + CONECTOR DO CLAUDE — Etapa A (tabelas)
-- Só CRIA coisas novas (tudo começa com "assistente_"). Não altera
-- nenhuma tabela que já existe. Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- ---------- Quem é a dona (único e-mail liberado) ----------
create or replace function public.assistente_eh_dona()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'edilainesantosugc@gmail.com';
$$;

-- Atualiza "updated_at" sozinho a cada alteração
create or replace function public.assistente_marcar_atualizacao()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- 1. Pendências ----------
create table if not exists public.assistente_pendencias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 300),
  descricao text check (char_length(descricao) <= 20000),
  categoria text not null default 'Outros'
    check (categoria in ('Roteiros','Edição','Estudos','Projetos','Pessoal','Mudança','Outros')),
  prioridade smallint not null default 4 check (prioridade between 1 and 4),
  status text not null default 'Pendente'
    check (status in ('Pendente','Em andamento','Feito')),
  data_limite date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 2. Compras e indicações ----------
create table if not exists public.assistente_indicacoes (
  id uuid primary key default gen_random_uuid(),
  produto text not null check (char_length(produto) between 1 and 300),
  marca_modelo text check (char_length(marca_modelo) <= 300),
  detalhes text check (char_length(detalhes) <= 20000),
  quem_indicou text check (char_length(quem_indicou) <= 200),
  link text check (char_length(link) <= 2000),
  status text not null default 'Quero comprar'
    check (status in ('Quero comprar','Comprado','Desisti')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 3. Lembretes ----------
create table if not exists public.assistente_lembretes (
  id uuid primary key default gen_random_uuid(),
  texto text not null check (char_length(texto) between 1 and 2000),
  data date not null,
  status text not null default 'Pendente' check (status in ('Pendente','Feito')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 4. Passagem (atual + histórico na mesma tabela) ----------
-- "atual = true" é a passagem vigente (só pode existir UMA). As outras são o histórico.
create table if not exists public.assistente_passagens (
  id uuid primary key default gen_random_uuid(),
  texto text not null check (char_length(texto) between 1 and 200000),
  atual boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists assistente_passagens_so_uma_atual
  on public.assistente_passagens (atual) where atual;

-- Salvar passagem nova: a anterior vira histórico, tudo de uma vez só.
create or replace function public.assistente_salvar_passagem(p_texto text)
returns public.assistente_passagens
language plpgsql
security definer
set search_path = public
as $$
declare
  nova public.assistente_passagens;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.assistente_eh_dona() then
    raise exception 'Sem permissão';
  end if;
  if p_texto is null or char_length(trim(p_texto)) = 0 then
    raise exception 'A passagem não pode ficar vazia';
  end if;
  update public.assistente_passagens set atual = false where atual;
  insert into public.assistente_passagens (texto, atual) values (p_texto, true)
    returning * into nova;
  return nova;
end;
$$;

-- ---------- Gatilhos de updated_at ----------
drop trigger if exists assistente_pendencias_upd on public.assistente_pendencias;
create trigger assistente_pendencias_upd before update on public.assistente_pendencias
  for each row execute function public.assistente_marcar_atualizacao();
drop trigger if exists assistente_indicacoes_upd on public.assistente_indicacoes;
create trigger assistente_indicacoes_upd before update on public.assistente_indicacoes
  for each row execute function public.assistente_marcar_atualizacao();
drop trigger if exists assistente_lembretes_upd on public.assistente_lembretes;
create trigger assistente_lembretes_upd before update on public.assistente_lembretes
  for each row execute function public.assistente_marcar_atualizacao();

-- ---------- Tabelas internas do porteiro do conector ----------
-- Só o robô do conector usa. Sem nenhuma regra de acesso = ninguém de fora lê nem escreve.
create table if not exists public.assistente_oauth_clientes (
  client_id text primary key,
  nome text,
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);
create table if not exists public.assistente_oauth_codigos (
  codigo_hash text primary key,
  client_id text not null references public.assistente_oauth_clientes(client_id),
  redirect_uri text not null,
  code_challenge text not null,
  expira_em timestamptz not null,
  usado boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.assistente_oauth_tokens (
  token_hash text primary key,
  tipo text not null check (tipo in ('access','refresh')),
  client_id text not null references public.assistente_oauth_clientes(client_id),
  expira_em timestamptz not null,
  revogado boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Segurança (RLS) ----------
alter table public.assistente_pendencias     enable row level security;
alter table public.assistente_indicacoes     enable row level security;
alter table public.assistente_lembretes      enable row level security;
alter table public.assistente_passagens      enable row level security;
alter table public.assistente_oauth_clientes enable row level security;
alter table public.assistente_oauth_codigos  enable row level security;
alter table public.assistente_oauth_tokens   enable row level security;

-- Visitantes (sem login) não têm acesso a nada daqui
revoke all on public.assistente_pendencias, public.assistente_indicacoes,
  public.assistente_lembretes, public.assistente_passagens,
  public.assistente_oauth_clientes, public.assistente_oauth_codigos,
  public.assistente_oauth_tokens from anon;

-- Logados (painel) não acessam as tabelas internas do porteiro
revoke all on public.assistente_oauth_clientes, public.assistente_oauth_codigos,
  public.assistente_oauth_tokens from authenticated;

-- NINGUÉM apaga (nem o painel, nem o conector): só muda status
revoke delete on public.assistente_pendencias, public.assistente_indicacoes,
  public.assistente_lembretes, public.assistente_passagens from authenticated, service_role;

-- Passagem: ninguém edita nem cria direto; só pela função de salvar (histórico fica intocável)
revoke insert, update on public.assistente_passagens from authenticated, service_role;
revoke all on function public.assistente_salvar_passagem(text) from public, anon;
grant execute on function public.assistente_salvar_passagem(text) to authenticated, service_role;

-- Regras: só a dona vê, cria e atualiza
drop policy if exists "Dona le pendencias" on public.assistente_pendencias;
create policy "Dona le pendencias" on public.assistente_pendencias
  for select to authenticated using (public.assistente_eh_dona());
drop policy if exists "Dona cria pendencias" on public.assistente_pendencias;
create policy "Dona cria pendencias" on public.assistente_pendencias
  for insert to authenticated with check (public.assistente_eh_dona());
drop policy if exists "Dona atualiza pendencias" on public.assistente_pendencias;
create policy "Dona atualiza pendencias" on public.assistente_pendencias
  for update to authenticated using (public.assistente_eh_dona()) with check (public.assistente_eh_dona());

drop policy if exists "Dona le indicacoes" on public.assistente_indicacoes;
create policy "Dona le indicacoes" on public.assistente_indicacoes
  for select to authenticated using (public.assistente_eh_dona());
drop policy if exists "Dona cria indicacoes" on public.assistente_indicacoes;
create policy "Dona cria indicacoes" on public.assistente_indicacoes
  for insert to authenticated with check (public.assistente_eh_dona());
drop policy if exists "Dona atualiza indicacoes" on public.assistente_indicacoes;
create policy "Dona atualiza indicacoes" on public.assistente_indicacoes
  for update to authenticated using (public.assistente_eh_dona()) with check (public.assistente_eh_dona());

drop policy if exists "Dona le lembretes" on public.assistente_lembretes;
create policy "Dona le lembretes" on public.assistente_lembretes
  for select to authenticated using (public.assistente_eh_dona());
drop policy if exists "Dona cria lembretes" on public.assistente_lembretes;
create policy "Dona cria lembretes" on public.assistente_lembretes
  for insert to authenticated with check (public.assistente_eh_dona());
drop policy if exists "Dona atualiza lembretes" on public.assistente_lembretes;
create policy "Dona atualiza lembretes" on public.assistente_lembretes
  for update to authenticated using (public.assistente_eh_dona()) with check (public.assistente_eh_dona());

drop policy if exists "Dona le passagens" on public.assistente_passagens;
create policy "Dona le passagens" on public.assistente_passagens
  for select to authenticated using (public.assistente_eh_dona());
