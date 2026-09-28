-- Adiciona o status "Follow up" na base de Marcas, entre "Enviado" e "Respondeu" —
-- pra marcar que já mandou um follow-up e está esperando resposta.
alter table public.painel_marcas drop constraint if exists painel_marcas_status_check;
alter table public.painel_marcas add constraint painel_marcas_status_check
  check (status in ('a_enviar', 'enviado', 'follow_up', 'respondeu', 'proposta', 'fechado', 'sem_interesse'));
