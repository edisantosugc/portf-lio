-- Adiciona o status "Contato futuro" (marca respondeu mas pediu pra retomar contato daqui
-- uns meses) nas duas tabelas onde o status vive: Marcas e Abordagens.
alter table public.painel_marcas drop constraint if exists painel_marcas_status_check;
alter table public.painel_marcas add constraint painel_marcas_status_check
  check (status in ('a_enviar', 'enviado', 'follow_up', 'respondeu', 'contato_futuro', 'proposta', 'fechado', 'sem_interesse'));

alter table public.painel_abordagens drop constraint if exists painel_abordagens_status_check;
alter table public.painel_abordagens add constraint painel_abordagens_status_check
  check (status in ('rascunho', 'realizada', 'follow_up', 'andamento', 'contato_futuro', 'fechada', 'sem_retorno'));
