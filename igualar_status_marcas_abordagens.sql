-- Mesmos status nas duas abas (cada um com seu par do outro lado):
-- Abordagens ganha "Proposta" e "Sem interesse"; Marcas ganha "Sem retorno".
-- Só muda a regra de valores aceitos — não altera nenhum registro.
alter table public.painel_abordagens drop constraint if exists painel_abordagens_status_check;
alter table public.painel_abordagens add constraint painel_abordagens_status_check
  check (status in ('rascunho', 'realizada', 'follow_up', 'respondeu', 'proposta', 'andamento', 'contato_futuro', 'fechada', 'sem_retorno', 'sem_interesse'));

alter table public.painel_marcas drop constraint if exists painel_marcas_status_check;
alter table public.painel_marcas add constraint painel_marcas_status_check
  check (status in ('a_enviar', 'enviado', 'follow_up', 'respondeu', 'contato_futuro', 'proposta', 'andamento', 'fechado', 'sem_retorno', 'sem_interesse'));

NOTIFY pgrst, 'reload schema';
