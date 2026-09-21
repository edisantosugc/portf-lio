-- =====================================================================
-- RESET SEMANAL DO CHECKLIST DIARIO
-- Toda semana o checklist ja nasce zerado sozinho (cada caixinha marcada
-- fica salva por DATA exata, nao por "segunda/terca"), mas essa rotina
-- limpa o historico de verdade toda semana, rodando sozinha no servidor
-- (nao depende do navegador/aba estar aberta) -- direto as 00h de
-- Brasilia (03h UTC) de todo domingo.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- =====================================================================

select cron.schedule(
  'resetar-checklist-semanal',
  '0 3 * * 0',
  $$
  delete from public.painel_checklist_progresso where data >= (current_date - 10);
  $$
);

NOTIFY pgrst, 'reload schema';
