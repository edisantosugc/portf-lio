-- =====================================================================
-- ABA ASSISTENTE: permitir EXCLUIR de verdade (só pelo app, só a dona)
-- Tabelas: pendências, lembretes e compras/indicações. Nada mais.
-- - Devolve a permissão de apagar SÓ pro login do painel (authenticated),
--   com uma regra que só deixa a dona (edilainesantosugc@gmail.com) apagar.
-- - O robô do conector (service_role) CONTINUA SEM permissão de apagar.
-- - Visitantes (anon) continuam sem nada.
-- - Passagens, cronograma e qualquer outra tabela: não mudam.
-- Não apaga nem altera nenhum dado. Pode rodar mais de uma vez.
-- =====================================================================

grant delete on public.assistente_pendencias, public.assistente_lembretes, public.assistente_indicacoes to authenticated;

drop policy if exists "Dona apaga pendencias" on public.assistente_pendencias;
create policy "Dona apaga pendencias" on public.assistente_pendencias
  for delete to authenticated using (public.assistente_eh_dona());

drop policy if exists "Dona apaga lembretes" on public.assistente_lembretes;
create policy "Dona apaga lembretes" on public.assistente_lembretes
  for delete to authenticated using (public.assistente_eh_dona());

drop policy if exists "Dona apaga indicacoes" on public.assistente_indicacoes;
create policy "Dona apaga indicacoes" on public.assistente_indicacoes
  for delete to authenticated using (public.assistente_eh_dona());

-- Garantia extra: o robô do conector segue sem poder apagar
revoke delete on public.assistente_pendencias, public.assistente_lembretes, public.assistente_indicacoes from service_role, anon;

-- Conferência: quem pode apagar em cada tabela
select table_name as tabela,
       string_agg(grantee, ', ' order by grantee) as quem_pode_apagar
from information_schema.role_table_grants
where table_schema = 'public' and privilege_type = 'DELETE'
  and table_name in ('assistente_pendencias','assistente_lembretes','assistente_indicacoes','assistente_passagens','assistente_cronograma')
group by table_name
order by table_name;
