-- Liga o robô das automações de DM (ig-scheduler), que estava agendado com o endereço
-- de exemplo (SEU_PROJETO) e nunca rodou. Na mesma transação, limpa o que ficou parado
-- na fila desde então, pra nenhuma mensagem antiga sair com meses de atraso.

-- Liga o robô com o endereço certo (o editor do Supabase roda tudo numa transação só)
select cron.alter_job(jobid, command := replace(command, 'SEU_PROJETO', 'dqtoxxngjqyoibdgmrjr'))
from cron.job
where jobname = 'ig-scheduler-cada-minuto';

-- Passos agendados que já deviam ter saído há mais de 1 dia: cancela (fora da janela de
-- 24h do Instagram, falhariam de qualquer jeito). Respostas a comentário com mais de
-- 7 dias: expira (o próprio robô faria isso). Mostra o resumo no final.
with cancelados as (
  update public.ig_scheduled set sent = true
  where sent = false and send_at < now() - interval '1 day'
  returning 1
),
expirados as (
  update public.ig_send_queue set status = 'expirado'
  where status = 'pendente' and created_at < now() - interval '7 days'
  returning 1
)
select (select count(*) from cancelados) as agendadas_antigas_canceladas,
       (select count(*) from expirados) as respostas_antigas_expiradas,
       (select count(*) from public.ig_scheduled where sent = false and send_at >= now() - interval '1 day') as agendadas_que_vao_sair,
       (select count(*) from public.ig_send_queue where status = 'pendente' and created_at >= now() - interval '7 days') as respostas_que_vao_sair,
       (select substring(command from 'url := ''([^'']+)''') from cron.job where jobname = 'ig-scheduler-cada-minuto') as endereco_robo;

