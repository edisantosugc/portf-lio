-- =====================================================================
-- Guarda o link da proposta gerada (colado no card de Briefing em Mensagens)
-- Cole este arquivo inteiro no SQL Editor do Supabase (aba nova) e clique em "Run".
-- =====================================================================

alter table public.painel_briefing_respostas
  add column if not exists proposta_url text;

NOTIFY pgrst, 'reload schema';
