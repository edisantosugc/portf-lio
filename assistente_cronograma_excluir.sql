-- =====================================================================
-- CRONOGRAMA DE CONTEÚDOS: permitir EXCLUIR ideia de verdade (só pelo app, só a dona)
-- - Dá a permissão de apagar SÓ pro login do painel (authenticated),
--   com uma regra que só deixa a dona apagar (mesma regra das outras tabelas da Assistente).
-- - O robô do conector (service_role) CONTINUA SEM permissão de apagar.
-- - Visitantes (anon) continuam sem nada.
-- Não apaga nem altera nenhum dado. Pode rodar mais de uma vez.
-- =====================================================================

grant delete on public.assistente_cronograma to authenticated;

drop policy if exists "Dona apaga cronograma" on public.assistente_cronograma;
create policy "Dona apaga cronograma" on public.assistente_cronograma
  for delete to authenticated using (public.assistente_eh_dona());

revoke delete on public.assistente_cronograma from service_role, anon;

-- Conferência: deve mostrar só "authenticated"
select string_agg(grantee, ', ' order by grantee) as quem_pode_apagar
from information_schema.role_table_grants
where table_schema = 'public' and privilege_type = 'DELETE'
  and table_name = 'assistente_cronograma';
