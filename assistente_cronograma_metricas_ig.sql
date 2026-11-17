-- =====================================================================
-- CRONOGRAMA: métricas puxadas do Instagram
-- Só ACRESCENTA colunas em assistente_cronograma. Não mexe em nenhum dado
-- existente: as métricas já digitadas continuam iguais; as colunas novas
-- nascem vazias (a "origem" nasce como {} = nada marcado ainda).
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- Post do Instagram ligado à ideia
alter table public.assistente_cronograma add column if not exists ig_media_id text;
alter table public.assistente_cronograma add column if not exists ig_permalink text;
alter table public.assistente_cronograma add column if not exists ig_tipo text;

-- De onde veio cada métrica: {"curtidas":"instagram","seguidores_ganhos":"manual", ...}
alter table public.assistente_cronograma add column if not exists metricas_origem jsonb not null default '{}'::jsonb;

-- Última busca no Instagram e o último erro (se houver)
alter table public.assistente_cronograma add column if not exists metricas_atualizadas_em timestamptz;
alter table public.assistente_cronograma add column if not exists metricas_erro text;

-- Regras simples pros campos novos
alter table public.assistente_cronograma drop constraint if exists assistente_cronograma_ig_checks;
alter table public.assistente_cronograma add constraint assistente_cronograma_ig_checks check (
  (ig_media_id is null or ig_media_id ~ '^[0-9]{1,40}$')
  and (ig_permalink is null or (ig_permalink like 'https://%' and char_length(ig_permalink) <= 500))
  and (ig_tipo is null or ig_tipo in ('REELS', 'FEED'))
  and (metricas_erro is null or char_length(metricas_erro) <= 1000)
  and jsonb_typeof(metricas_origem) = 'object'
);

-- Conferência: as 6 colunas novas + as suas ideias continuam lá
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'assistente_cronograma'
       and column_name in ('ig_media_id','ig_permalink','ig_tipo','metricas_origem','metricas_atualizadas_em','metricas_erro')) as colunas_novas,
  (select count(*) from public.assistente_cronograma where lista = 'Grade') as grade_total,
  (select count(*) from public.assistente_cronograma where lista = 'Postados') as postados_total;
