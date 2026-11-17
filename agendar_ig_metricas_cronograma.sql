-- =====================================================================
-- AGENDAMENTO: métricas do Instagram no Cronograma, todo dia às 9h (Brasília)
-- Chama o robô ig-metricas-cronograma com a mesma senha secreta guardada
-- na app_config que os outros robôs usam. Não mexe em nenhum outro agendamento.
-- O robô decide sozinho quais posts completaram 48h ou 7 dias.
-- =====================================================================

-- Se já existir um agendamento com esse nome, troca (não duplica)
select cron.unschedule(jobid) from cron.job where jobname = 'ig-metricas-cronograma-9h';

select cron.schedule(
  'ig-metricas-cronograma-9h',
  '0 12 * * *',            -- 12h no relógio do servidor (UTC) = 9h de Brasília
  $$
  select net.http_post(
    url := 'https://dqtoxxngjqyoibdgmrjr.supabase.co/functions/v1/ig-metricas-cronograma',
    headers := jsonb_build_object('x-sched-key', (select valor from public.app_config where nome = 'sched_secret'), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- Conferência: o agendamento novo e os que já existiam continuam lá
select jobname, schedule, active from cron.job order by jobname;
