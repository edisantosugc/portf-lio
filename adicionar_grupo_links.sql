-- Adiciona a coluna "grupo" nas tabelas de Links, pra separar Links e Referências em
-- sub-abas dentro da mesma aba do painel — cada uma com sua própria lista de
-- categorias (na aba Referências, "categoria" aparece como "formato").
alter table public.painel_links add column if not exists grupo text not null default 'links';
create index if not exists idx_painel_links_grupo on public.painel_links (grupo);

alter table public.painel_links_categorias add column if not exists grupo text not null default 'links';
create index if not exists idx_painel_links_categorias_grupo on public.painel_links_categorias (grupo);

-- A categoria era única só pelo nome; agora precisa ser única por nome+grupo, senão um
-- formato de Referências não pode ter o mesmo nome de uma categoria já usada em Links.
alter table public.painel_links_categorias drop constraint if exists painel_links_categorias_nome_key;
alter table public.painel_links_categorias add constraint painel_links_categorias_nome_grupo_key unique (nome, grupo);

-- Formatos de conteúdo já vêm prontos na aba Referências — "do nothing" de propósito,
-- pra rodar este arquivo de novo no futuro não apagar formatos que você já criou/editou.
insert into public.painel_links_categorias (nome, grupo) values
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
