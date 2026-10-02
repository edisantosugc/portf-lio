-- O robô de renovação do token do Instagram foi agendado com o endereço de exemplo
-- (SEU_PROJETO) e nunca chegou na função de verdade — por isso o token venceu.
-- Troca só o endereço; a senha continua vindo da app_config.
select cron.alter_job(
  jobid,
  command := replace(command, 'SEU_PROJETO', 'dqtoxxngjqyoibdgmrjr')
)
from cron.job
where jobname = 'ig-token-refresh-semanal';
