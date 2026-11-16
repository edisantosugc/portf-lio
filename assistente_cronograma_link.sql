-- =====================================================================
-- CRONOGRAMA: campo novo "Link do roteiro" (opcional)
-- Só ACRESCENTA uma coluna em assistente_cronograma. Não mexe em nenhum
-- dado existente: todas as ideias ficam com o link vazio.
-- Só aceita link que começa com https:// (até 2000 letras).
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

alter table public.assistente_cronograma
  add column if not exists link_roteiro text;

alter table public.assistente_cronograma
  drop constraint if exists assistente_cronograma_link_roteiro_check;
alter table public.assistente_cronograma
  add constraint assistente_cronograma_link_roteiro_check
  check (link_roteiro is null or (link_roteiro like 'https://%' and char_length(link_roteiro) <= 2000));

-- Conferência: a coluna nova e quantas ideias continuam lá (Grade 43 / Postados 1)
select
  (select data_type from information_schema.columns
     where table_schema = 'public' and table_name = 'assistente_cronograma' and column_name = 'link_roteiro') as coluna_link_roteiro,
  (select count(*) from public.assistente_cronograma where lista = 'Grade') as grade_total,
  (select count(*) from public.assistente_cronograma where lista = 'Postados') as postados_total;
