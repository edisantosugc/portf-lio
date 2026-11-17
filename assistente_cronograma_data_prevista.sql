-- =====================================================================
-- CRONOGRAMA: campo novo "Data prevista" (opcional)
-- Só ACRESCENTA uma coluna em assistente_cronograma. Não mexe em nenhum
-- dado existente: todas as ideias ficam com a data vazia.
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

alter table public.assistente_cronograma
  add column if not exists data_prevista date;

-- Conferência: a coluna nova, quantas ideias têm data (tem que ser 0)
-- e quantas ideias continuam lá (Grade 43 / Postados 1)
select
  (select data_type from information_schema.columns
     where table_schema = 'public' and table_name = 'assistente_cronograma' and column_name = 'data_prevista') as coluna_data_prevista,
  (select count(*) from public.assistente_cronograma where data_prevista is not null) as ideias_com_data,
  (select count(*) from public.assistente_cronograma where lista = 'Grade') as grade_total,
  (select count(*) from public.assistente_cronograma where lista = 'Postados') as postados_total;
