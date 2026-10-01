-- Desfaz o arquivamento AUTOMÁTICO da virada de mês (regra removida do painel em 2026-10-01).
-- Só mexe nas que o painel arquivou sozinho — as arquivadas na mão continuam arquivadas.
update public.painel_abordagens
set arquivado = false,
    motivo_arquivamento = null,
    arquivado_automaticamente = false
where arquivado_automaticamente = true;
