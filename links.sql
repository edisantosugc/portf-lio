-- =====================================================================
-- ABA "LINKS" (abaixo de Financeiro no menu lateral)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- =====================================================================

-- Categorias ficam numa tabela própria (não só "o que já foi usado em algum link"),
-- assim uma categoria criada na hora já existe pros próximos links, mesmo antes de
-- qualquer link usar ela.
create table if not exists public.painel_links_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.painel_links (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  url text not null,
  categoria text,
  created_at timestamptz not null default now()
);

create index if not exists idx_painel_links_categoria on public.painel_links (categoria);

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

-- Categorias de exemplo pra já nascer com algo no dropdown — "do nothing" de propósito,
-- pra rodar esse arquivo de novo no futuro nunca apagar categorias que você já criou.
insert into public.painel_links_categorias (nome) values
  ('Estudo'), ('Plataforma'), ('Meu App/Admin'), ('Dominio')
on conflict (nome) do nothing;

NOTIFY pgrst, 'reload schema';
