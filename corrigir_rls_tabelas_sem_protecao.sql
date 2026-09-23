-- =====================================================================
-- REVISÃO DE SEGURANÇA — RLS em tabelas que nunca passaram por um SQL
-- rastreado no repositório (mesmo padrão do incidente de financas_lancamentos/
-- financas_gastos_fixos, corrigido em 2026-08: tabela criada direto no Table
-- Editor do Supabase nunca teve RLS ativado de fato, então TODAS as policies
-- (inclusive restrictive) eram ignoradas pelo Postgres e qualquer conta
-- autenticada lia/escrevia sem filtro nenhum).
--
-- As 3 tabelas abaixo (negocio_lancamentos, financas_cartoes_pagos,
-- painel_tarefas_google_exclusoes) são usadas de verdade no painel.html mas
-- nunca apareceram com "enable row level security" em nenhum .sql do
-- histórico — não dá pra confirmar por aqui se o RLS já estava ligado direto
-- no Supabase ou não, então este script é seguro rodar de qualquer jeito
-- (idempotente: só reafirma o estado correto, não quebra nada se já estiver certo).
--
-- Cole este arquivo inteiro no SQL Editor do Supabase (aba nova) e clique em "Run".
-- =====================================================================

-- ---------- negocio_lancamentos (livro-caixa UGC) ----------
-- Já estava na lista de tabelas bloqueadas pro Gustavo lá embaixo no setup.sql,
-- mas essa restrictive policy só funciona se o RLS de verdade estiver ligado —
-- sem isso, ela era ignorada e Gustavo (ou qualquer autenticado) podia ler tudo.
alter table public.negocio_lancamentos enable row level security;

drop policy if exists "Autenticados leem e gerenciam negocio lancamentos" on public.negocio_lancamentos;
create policy "Autenticados leem e gerenciam negocio lancamentos"
  on public.negocio_lancamentos
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.negocio_lancamentos to authenticated;

-- Mesmo padrão restrictive já usado em financas_lancamentos/financas_gastos_fixos:
-- bloqueia a conta do Gustavo por completo (esse livro-caixa não é dele em
-- nenhuma hipótese).
drop policy if exists "Gustavo bloqueado" on public.negocio_lancamentos;
create policy "Gustavo bloqueado" on public.negocio_lancamentos
  as restrictive for all to authenticated
  using (not public.eh_conta_gustavo())
  with check (not public.eh_conta_gustavo());

-- ---------- financas_cartoes_pagos (controle de cartão pago por pessoa/mês) ----------
-- Nunca apareceu em nenhum .sql com "public." na frente — só existia como
-- comentário e como tabela usada direto no painel.html. Mesmo padrão de
-- financas_pessoas_pagas (que já tinha RLS correto).
alter table public.financas_cartoes_pagos enable row level security;

drop policy if exists "Autenticados leem e gerenciam cartoes pagos" on public.financas_cartoes_pagos;
create policy "Autenticados leem e gerenciam cartoes pagos"
  on public.financas_cartoes_pagos
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.financas_cartoes_pagos to authenticated;

drop policy if exists "Gustavo bloqueado" on public.financas_cartoes_pagos;
create policy "Gustavo bloqueado" on public.financas_cartoes_pagos
  as restrictive for all to authenticated
  using (not public.eh_conta_gustavo())
  with check (not public.eh_conta_gustavo());

-- ---------- painel_tarefas_google_exclusoes (fila de sincronização com Google Agenda) ----------
-- O próprio setup.sql já documentava que essa tabela "foi criada direto no
-- Table Editor (não tem create table aqui)" — mesmo padrão de risco, sem
-- nenhuma linha de RLS registrada em lugar nenhum. Mesma política da tabela
-- irmã painel_tarefas (autenticado gerencia).
alter table public.painel_tarefas_google_exclusoes enable row level security;

drop policy if exists "Usuaria autenticada gerencia exclusoes do google" on public.painel_tarefas_google_exclusoes;
create policy "Usuaria autenticada gerencia exclusoes do google"
  on public.painel_tarefas_google_exclusoes
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.painel_tarefas_google_exclusoes to authenticated;

NOTIFY pgrst, 'reload schema';
