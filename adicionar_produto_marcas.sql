-- Adiciona a coluna "Produto" na base de prospecção (aba Marcas), pra dar pra
-- filtrar pelo produto específico da marca que você quer abordar (separado do
-- "nicho", que é a categoria mais ampla).
alter table public.painel_marcas add column if not exists produto text;
create index if not exists idx_painel_marcas_produto on public.painel_marcas (produto);
