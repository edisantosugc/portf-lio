-- Briefing do trabalho (aba Trabalhos): além do link, agora dá pra colar o texto e anexar
-- arquivos. Os arquivos ficam no bucket privado "documentos-juridicos" (pasta briefings/),
-- que já existe — aqui só guarda a lista deles. Só adiciona colunas, não altera nada existente.
alter table public.painel_ugc_trabalhos add column if not exists briefing_texto text;
alter table public.painel_ugc_trabalhos add column if not exists briefing_arquivos jsonb not null default '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
