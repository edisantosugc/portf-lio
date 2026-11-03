-- Conferência da fatura (Financeiro > Lançamentos do mês): guarda o ✓ de cada lançamento
-- conferido com o app do banco. Só adiciona a coluna, não altera nada existente.
alter table public.financas_lancamentos add column if not exists conferido boolean not null default false;

NOTIFY pgrst, 'reload schema';
