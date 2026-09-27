-- =====================================================================
-- ABA "LINKS" (abaixo de Financeiro no menu lateral)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- =====================================================================

-- Categorias ficam numa tabela própria (não só "o que já foi usado em algum link"),
-- assim uma categoria criada na hora já existe pros próximos links, mesmo antes de
-- qualquer link usar ela.
create table if not exists public.painel_links_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  grupo text not null default 'links', -- 'links' ou 'referencias' — nome só precisa ser único dentro do mesmo grupo
  created_at timestamptz not null default now(),
  unique (nome, grupo)
);

alter table public.painel_links_categorias add column if not exists grupo text not null default 'links';
create index if not exists idx_painel_links_categorias_grupo on public.painel_links_categorias (grupo);

create table if not exists public.painel_links (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  url text not null,
  categoria text,
  grupo text not null default 'links', -- 'links' ou 'referencias' (sub-abas dentro de Links)
  created_at timestamptz not null default now()
);

-- Garante a coluna em quem já rodou este arquivo antes de "grupo" existir.
alter table public.painel_links add column if not exists grupo text not null default 'links';

create index if not exists idx_painel_links_categoria on public.painel_links (categoria);
create index if not exists idx_painel_links_grupo on public.painel_links (grupo);

alter table public.painel_links_categorias enable row level security;
alter table public.painel_links enable row level security;

drop policy if exists "Usuaria autenticada gerencia categorias de links" on public.painel_links_categorias;
create policy "Usuaria autenticada gerencia categorias de links"
  on public.painel_links_categorias
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Usuaria autenticada gerencia links" on public.painel_links;
create policy "Usuaria autenticada gerencia links"
  on public.painel_links
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_links_categorias to authenticated;
grant select, insert, update, delete on public.painel_links to authenticated;

-- Categorias/formatos de exemplo pra já nascer com algo no dropdown — "do nothing" de
-- propósito, pra rodar esse arquivo de novo no futuro nunca apagar o que você já criou.
insert into public.painel_links_categorias (nome, grupo) values
  ('Estudo', 'links'), ('Plataforma', 'links'), ('Meu App/Admin', 'links'), ('Dominio', 'links'),
  ('Antes e Depois', 'referencias'),
  ('Criativo', 'referencias'),
  ('Depoimento', 'referencias'),
  ('Gancho', 'referencias'),
  ('Marketplace', 'referencias'),
  ('Mini-Vlog / Lifestyle', 'referencias'),
  ('Orgânico', 'referencias'),
  ('Problema vs. Solução', 'referencias'),
  ('Review', 'referencias'),
  ('Storytelling', 'referencias'),
  ('Tráfego Pago', 'referencias'),
  ('Tutorial / Como Usar', 'referencias'),
  ('Unboxing', 'referencias'),
  ('Vídeos de Lista', 'referencias')
on conflict (nome, grupo) do nothing;

NOTIFY pgrst, 'reload schema';
