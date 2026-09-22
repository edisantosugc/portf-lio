-- =====================================================================
-- ABA ROTEIROS > SUB-ABA "TRANSCRIÇÃO" (biblioteca de vídeos transcritos)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Pode rodar de novo no futuro sem problema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) roteiros: cada linha é um vídeo transcrito (ou escrito na mão),
--    seu ou de outra creator, guardado na biblioteca.
-- ---------------------------------------------------------------------
create table if not exists public.roteiros (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fonte text not null default 'manual' check (fonte in ('instagram', 'tiktok', 'youtube', 'manual')),
  url text,
  perfil text,
  de_quem text not null default 'outra' check (de_quem in ('minha', 'outra')),
  titulo text,
  transcricao text,
  legenda text,
  postado_em date,
  tags text[] not null default '{}',
  obs text,
  status text not null default 'pronto' check (status in ('processando', 'pronto', 'falhou')),
  erro text,
  segmentos jsonb
);

alter table public.roteiros add column if not exists capa_url text;

create index if not exists idx_roteiros_created_at on public.roteiros (created_at desc);

alter table public.roteiros enable row level security;

drop policy if exists "Usuaria autenticada gerencia roteiros" on public.roteiros;
create policy "Usuaria autenticada gerencia roteiros"
  on public.roteiros
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.roteiros to authenticated;

-- ---------------------------------------------------------------------
-- 2) A chave da Supadata usa a MESMA tabela de segredos que o resto do
--    painel já usa (app_config), em vez de criar uma tabela nova só pra
--    isso. Se app_config ainda não existir na sua conta (só existiria se
--    você nunca rodou o setup.sql original), este bloco cria ela também.
-- ---------------------------------------------------------------------
create table if not exists public.app_config (
  nome text primary key,
  valor text not null
);
alter table public.app_config add column if not exists updated_at timestamptz not null default now();
alter table public.app_config enable row level security;

drop policy if exists "Usuaria autenticada gerencia app_config" on public.app_config;
create policy "Usuaria autenticada gerencia app_config"
  on public.app_config
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.app_config to authenticated;

-- Atualiza o cache do Supabase pra reconhecer a tabela/colunas novas na hora.
NOTIFY pgrst, 'reload schema';
