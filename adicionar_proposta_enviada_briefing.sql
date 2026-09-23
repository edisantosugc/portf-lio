-- =====================================================================
-- Guarda quando a proposta foi enviada de fato (botão "Enviar proposta"
-- do card de Briefing em Mensagens fica desabilitado depois disso, pra
-- evitar clique duplo por engano).
-- Cole este arquivo inteiro no SQL Editor do Supabase (aba nova) e clique em "Run".
-- =====================================================================

alter table public.painel_briefing_respostas
  add column if not exists proposta_enviada_em timestamptz;

NOTIFY pgrst, 'reload schema';
