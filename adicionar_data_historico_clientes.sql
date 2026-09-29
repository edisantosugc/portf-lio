-- Adiciona um campo de data editável no histórico de anotações de Clientes — separado da
-- data de cadastro (created_at), pra você poder registrar quando o contato aconteceu de
-- verdade (inclusive retroativo).
alter table public.painel_clientes_notas add column if not exists data date not null default current_date;
